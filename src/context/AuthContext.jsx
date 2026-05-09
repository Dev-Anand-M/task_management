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

    useEffect(() => {
        let mounted = true;
        let authInitialized = false;

        // EMERGENCY TIMEOUT: If auth takes more than 5 seconds (common on mobile), force stop loading
        const timeoutId = setTimeout(() => {
            if (mounted && !authInitialized) {
                console.warn('Auth initialization timed out, forcing loading to false');
                setLoading(false);
            }
        }, 6000);

        const initializeAuth = async () => {
            try {
                // Initial session check
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user && mounted) {
                    console.log('[AuthContext] Initial session found:', session.user.id);
                    setUser(session.user);
                    fetchProfile(session.user.id);
                }
            } catch (error) {
                console.error('[AuthContext] Initial session check error:', error);
            } finally {
                if (mounted) setLoading(false);
                authInitialized = true;
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                try {
                    if (!mounted) return;
                    console.log('[AuthContext] Auth State Event:', event, session?.user?.id);

                    if (session?.user) {
                        // Avoid redundant state updates if same user
                        setUser(prevUser => {
                            if (prevUser?.id === session.user.id) return prevUser;
                            return session.user;
                        });
                        fetchProfile(session.user.id);
                    } else {
                        setUser(null);
                        setProfile(null);
                    }
                    
                    // Only flip loading to false here if it wasn't already flipped
                    if (loading) setLoading(false);
                } catch (err) {
                    console.error('[AuthContext] onAuthStateChange Error:', err);
                }
            }
        );

        // Visibility check - Just ensure session is still valid, onAuthStateChange will handle results
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log('[AuthContext] Tab became visible. Verifying session...');
                try {
                    // getSession() will trigger onAuthStateChange if session refreshes/changes
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user && mounted) {
                        // Even if same user, force a profile refresh to ensure reactivity
                        fetchProfile(session.user.id, false);
                    }
                } catch (err) {
                    console.error('[AuthContext] Visibility session check failed:', err);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            subscription?.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Dedicated Loading Safety Effect
    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => {
                console.warn('CRITICAL: Stuck loading state detected (10s), forcing recovery.');
                setLoading(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    // DEBUG: Monitor state changes
    useEffect(() => {
        console.log('[AuthContext] State Update - Loading:', loading, 'User ID:', user?.id, 'Profile ID:', profile?.id);
    }, [loading, user, profile]);

    const fetchProfile = async (userId, force = false) => {
        if (!userId) return;
        
        // Throttling: Skip if fetched in the last 30 seconds, unless forced
        const now = Date.now();
        if (!force && profile && profile.id === userId && (now - lastFetchRef.current < 30000)) {
            console.log('Skipping redundant profile fetch (throttled)');
            return;
        }
        
        lastFetchRef.current = now;
        try {
            // Optimistic profile from metadata if we don't have one yet
            if (user && !profile) {
                setProfile({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.name || user.email?.split('@')[0],
                    role: user.user_metadata?.role || 'member',
                    classroom_id: user.user_metadata?.classroom_id
                });
            }

            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Profile fetch error:', error);
                return;
            }

            if (userProfile) {
                let classroom_name = null;
                if (userProfile.classroom_id) {
                    const { data: classroom } = await supabase
                        .from('classrooms')
                        .select('name')
                        .eq('id', userProfile.classroom_id)
                        .single();
                    if (classroom) {
                        classroom_name = classroom.name;
                    }
                }

                setProfile({
                    ...userProfile,
                    classroom_name
                });

                // Centralized AI Settings: Load from database into local storage cache
                try {
                    const { loadFromDatabase } = await import('../services/aiService');
                    await loadFromDatabase();
                } catch (aiErr) {
                    // Silently fail AI load to not block auth
                }
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
        }
    };

    const login = useCallback(async (email, password) => {
        try {
            const signInPromise = supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sign in is taking longer than expected. Please check your internet connection.')), 60000) 
            );

            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                setUser(data.user);
                fetchProfile(data.user.id).catch(err => console.error('Profile fetch error:', err));
                return { success: true, user: data.user };
            }
            return { success: false, error: 'No user data returned' };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, error: err.message || 'Login failed. Please try again.' };
        }
    }, [user]);

    const register = useCallback(async (name, email, password, classroomId) => {
        try {
            const signUpPromise = supabase.auth.signUp({
                email: email.toLowerCase().trim(),
                password,
                options: {
                    data: {
                        name,
                        role: 'member',
                        classroom_id: classroomId
                    }
                }
            });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Registration is taking longer than expected. Please check your internet connection.')), 60000) 
            );

            const { data, error } = await Promise.race([signUpPromise, timeoutPromise]);

            if (error) {
                return { success: false, error: error.message };
            }

            setUser(data.user);
            fetchProfile(data.user.id).catch(err => console.error('Profile fetch error:', err));
            return { success: true, user: data.user };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, error: err.message || 'Registration failed. Please try again.' };
        }
    }, []);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    }, []);

    const refreshUser = useCallback(async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    }, [user?.id]);

    const forceRefresh = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
        }
    }, []);

    const updateProfile = useCallback(async (updates) => {
        if (!user?.id) return;

        const updated = await db.updateProfile(user.id, updates);
        if (updated) {
            setProfile(prev => ({ ...prev, ...updated }));
        }
        return updated;
    }, [user?.id]);

    const addXP = useCallback(async (amount) => {
        if (!profile) return;
        const newXP = (profile.xp || 0) + amount;
        await updateProfile({ xp: newXP });
    }, [profile, updateProfile]);

    const addBadge = useCallback(async (badgeId) => {
        if (!profile) return;
        const currentBadges = profile.badges || [];
        if (!currentBadges.includes(badgeId)) {
            await updateProfile({ badges: [...currentBadges, badgeId] });
        }
    }, [profile, updateProfile]);

    const value = useMemo(() => ({
        user: profile,
        authUser: user,
        loading,
        isAdmin: profile?.role === 'admin',
        login,
        register,
        logout,
        refreshUser,
        forceRefresh,
        updateProfile,
        addXP,
        addBadge,
        currentClassroomName: profile?.classroom_name
    }), [profile, user, loading, login, register, logout, refreshUser, forceRefresh, updateProfile, addXP, addBadge]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
