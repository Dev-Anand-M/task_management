import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as db from '../services/database';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const lastFetchRef = useRef(0);
    const fetchProfileRef = useRef(null);
    const profileRef = useRef(null);
    const forceRefreshRef = useRef(null);

    profileRef.current = profile;

    // Unified client-side NotificationManager hook
    useEffect(() => {
        const syncNotifications = async () => {
            if (user?.id) {
                try {
                    const { NotificationManager } = await import('../services/NotificationManager');
                    await NotificationManager.initialize(user.id);
                    await NotificationManager.register();
                } catch (e) {
                    console.warn('[AuthContext] Notification registration failed:', e);
                }
            } else {
                try {
                    const { NotificationManager } = await import('../services/NotificationManager');
                    await NotificationManager.unregister();
                } catch (e) {}
            }
        };
        syncNotifications();
    }, [user?.id]);

    // fetchProfile as useCallback — stored in ref so closures never go stale
    const fetchProfile = useCallback(async (userId, force = false) => {
        if (!userId) return null;

        const now = Date.now();
        if (!force && lastFetchRef.current > 0 && (now - lastFetchRef.current < 30000)) {
            return profile;
        }

        lastFetchRef.current = now;
        try {
            let { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Auto-provision profile if it doesn't exist
            if (error && (error.code === 'PGRST116' || error.details?.includes('0 rows'))) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    const meta = authUser.user_metadata || {};
                    const newProfile = {
                        id: userId,
                        email: authUser.email,
                        name: meta.name || authUser.email?.split('@')[0] || 'User',
                        role: meta.role || 'member',
                        classroom_id: meta.classroom_id || null,
                        preferences: {},
                    };
                    const { data: created, error: insertErr } = await supabase
                        .from('profiles')
                        .upsert(newProfile, { onConflict: 'id' })
                        .select('*')
                        .single();
                    if (!insertErr && created) {
                        userProfile = created;
                        error = null;
                    } else {
                        console.warn('[AuthContext] Failed to auto-provision profile:', insertErr);
                        return null;
                    }
                }
            } else if (error) {
                console.warn('[AuthContext] Profile fetch error:', error);
                return null;
            }

            if (userProfile) {
                let classroom_name = null;
                if (userProfile.classroom_id) {
                    const { data: classroom } = await supabase
                        .from('classrooms')
                        .select('name')
                        .eq('id', userProfile.classroom_id)
                        .single();
                    if (classroom) classroom_name = classroom.name;
                }

                const fullProfile = { ...userProfile, classroom_name };
                setProfile(fullProfile);
                try {
                    localStorage.setItem(`zenith_role_${userId}`, userProfile.role);
                } catch (e) {
                    console.warn('[AuthContext] Failed to save role to localStorage:', e);
                }

                // Load AI settings in background
                import('../services/aiService')
                    .then(({ loadFromDatabase }) => loadFromDatabase())
                    .catch(() => {});
                
                return fullProfile;
            }
        } catch (err) {
            console.error('[AuthContext] Profile fetch error:', err);
        }
        return null;
    }, [profile]);

    // Always keep ref pointing to latest
    fetchProfileRef.current = fetchProfile;

    useEffect(() => {
        let mounted = true;

        // 1. Initial session check (cold start only)
        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user && mounted) {
                    setUser(session.user);
                    // Optimistic profile so UI is never blank
                    let storedRole = 'member';
                    try {
                        storedRole = localStorage.getItem(`zenith_role_${session.user.id}`) || session.user.user_metadata?.role || 'member';
                    } catch (e) {}
                    setProfile({
                        id: session.user.id,
                        email: session.user.email,
                        name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                        role: storedRole,
                        classroom_id: session.user.user_metadata?.classroom_id
                    });
                    // Await the profile fetch so that the correct role is loaded before loading is set to false
                    await fetchProfileRef.current(session.user.id, true);
                }
            } catch (error) {
                console.error('[AuthContext] Init error:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        // 2. Auth state listener — single source of truth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return;

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                    return;
                }

                if (session?.user) {
                    setUser(session.user);
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                        let storedRole = 'member';
                        try {
                            storedRole = localStorage.getItem(`zenith_role_${session.user.id}`) || session.user.user_metadata?.role || 'member';
                        } catch (e) {}
                        setProfile(prev => prev || {
                            id: session.user.id,
                            email: session.user.email,
                            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                            role: storedRole,
                            classroom_id: session.user.user_metadata?.classroom_id
                        });
                        if (!profileRef.current) {
                            setLoading(true);
                        }
                        // Fetch the real profile in background but set loading false only when resolved
                        fetchProfileRef.current(session.user.id, true).then(() => {
                            if (mounted) setLoading(false);
                        });
                        return;
                    } else if (event === 'TOKEN_REFRESHED') {
                        // Also refresh profile on token refresh to ensure correct role
                        fetchProfileRef.current(session.user.id, true);
                    }
                }

                if (mounted) setLoading(false);
            }
        );

        // Visibility Change listener to fix "stuck session" on tab/app switching
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[AuthContext] App became visible, refreshing session...');
                if (forceRefreshRef.current) {
                    forceRefreshRef.current();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Emergency timeout
        const emergencyTimeout = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 5000);

        return () => {
            mounted = false;
            subscription?.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearTimeout(emergencyTimeout);
        };
    }, []);

    const login = useCallback(async (email, password) => {
        try {
            const { data, error } = await Promise.race([
                supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Sign in timed out.')), 60000))
            ]);

            if (error) {
                // Check if the user was removed from the system
                // If login fails with "Invalid login credentials", check if profile exists
                if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
                    // Try to check if a profile exists with this email
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', email.toLowerCase().trim())
                        .limit(1);
                    
                    // If no profile exists, user was likely removed
                    if (!profiles || profiles.length === 0) {
                        return { 
                            success: false, 
                            error: '⛔ Your account has been removed from the system. Please contact your administrator if you believe this is an error.',
                            isRemoved: true 
                        };
                    }
                }
                return { success: false, error: error.message };
            }
            if (data.user) {
                setUser(data.user);
                // Await real profile to ensure we navigate with correct role
                const prof = await fetchProfile(data.user.id, true);
                return { success: true, user: data.user, profile: prof };
            }
            return { success: false, error: 'No user data returned' };
        } catch (err) {
            return { success: false, error: err.message || 'Login failed.' };
        }
    }, [fetchProfile]);

    const register = useCallback(async (name, email, password, classroomId) => {
        try {
            const { data, error } = await Promise.race([
                supabase.auth.signUp({
                    email: email.toLowerCase().trim(),
                    password,
                    options: { data: { name, role: 'member', classroom_id: classroomId } }
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Registration timed out.')), 60000))
            ]);

            if (error) return { success: false, error: error.message };
            setUser(data.user);
            fetchProfileRef.current(data.user.id, true);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, error: err.message || 'Registration failed.' };
        }
    }, []);

    // logout with timeout — can NEVER hang
    const logout = useCallback(async () => {
        try {

            await Promise.race([
                supabase.auth.signOut(),
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        } catch (err) {
            console.error('[AuthContext] Sign out error:', err);
        }
        setUser(null);
        setProfile(null);
    }, [user?.id]);

    const refreshUser = useCallback(async () => {
        if (user?.id) await fetchProfileRef.current(user.id, true);
    }, [user?.id]);

    const forceRefresh = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                await fetchProfileRef.current(session.user.id, true);
            }
        } catch (err) {
            console.error('[AuthContext] Force refresh error:', err);
        }
    }, []);

    const updateProfile = useCallback(async (updates) => {
        if (!user?.id) return;
        const updated = await db.updateProfile(user.id, updates);
        if (updated) setProfile(prev => ({ ...prev, ...updated }));
        return updated;
    }, [user?.id]);

    const addXP = useCallback(async (amount) => {
        if (!profile) return;
        await updateProfile({ xp: (profile.xp || 0) + amount });
    }, [profile, updateProfile]);

    const addBadge = useCallback(async (badgeId) => {
        if (!profile) return;
        const currentBadges = profile.badges || [];
        if (!currentBadges.includes(badgeId)) {
            await updateProfile({ badges: [...currentBadges, badgeId] });
        }
    }, [profile, updateProfile]);

    forceRefreshRef.current = forceRefresh;

    const value = useMemo(() => ({
        user: profile,
        authUser: user,
        loading,
        isAdmin: profile?.role === 'admin',
        login, register, logout, refreshUser, forceRefresh,
        updateProfile, addXP, addBadge,
        currentClassroomName: profile?.classroom_name
    }), [profile, user, loading, login, register, logout, refreshUser, forceRefresh, updateProfile, addXP, addBadge]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
