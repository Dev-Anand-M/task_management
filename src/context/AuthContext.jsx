import { createContext, useContext, useState, useEffect } from 'react';
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
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    setUser(session.user);
                    // Don't wait for profile to set loading to false if we have a session
                    fetchProfile(session.user.id).finally(() => {
                        if (mounted) setLoading(false);
                        authInitialized = true;
                        clearTimeout(timeoutId);
                    });
                } else {
                    authInitialized = true;
                    if (mounted) setLoading(false);
                    clearTimeout(timeoutId);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                if (mounted) setLoading(false);
                clearTimeout(timeoutId);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                }

                if (authInitialized || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    setLoading(false);
                    clearTimeout(timeoutId);
                }
            }
        );

        // Visibility Change listener to fix "stuck session" on mobile tab switching
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !loading) {
                console.log('App became visible, refreshing session...');
                forceRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            subscription?.unsubscribe();
            clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const fetchProfile = async (userId) => {
        if (!userId) return;
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
                .select('*, classrooms(name)')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Profile fetch error:', error);
                return;
            }

            if (userProfile) {
                setProfile({
                    ...userProfile,
                    classroom_name: userProfile.classrooms?.name || null
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

    const login = async (email, password) => {
        try {
            const signInPromise = supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sign in timeout. Please check your connection and try again.')), 30000) // 30 seconds
            );

            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            if (data.user) {
                setUser(data.user);
                // Fetch profile in background, don't block the UI transition
                fetchProfile(data.user.id).catch(err => console.error('Profile fetch error:', err));
                return { success: true, user: data.user };
            }
            return { success: false, error: 'No user data returned' };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, error: err.message || 'Login failed. Please try again.' };
        }
    };

    const register = async (name, email, password, classroomId) => {
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
                setTimeout(() => reject(new Error('Sign up timeout. Please check your connection and try again.')), 30000) // 30 seconds
            );

            const { data, error } = await Promise.race([signUpPromise, timeoutPromise]);

            if (error) {
                return { success: false, error: error.message };
            }

            setUser(data.user);
            // Fetch profile in background, don't block registration
            fetchProfile(data.user.id).catch(err => console.error('Profile fetch error:', err));
            return { success: true, user: data.user };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, error: err.message || 'Registration failed. Please try again.' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    const refreshUser = async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    };

    const forceRefresh = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
        }
    };

    const updateProfile = async (updates) => {
        if (!user?.id) return;

        const updated = await db.updateProfile(user.id, updates);
        if (updated) {
            setProfile(prev => ({ ...prev, ...updated }));
        }
        return updated;
    };

    const addXP = async (amount) => {
        if (!profile) return;
        const newXP = (profile.xp || 0) + amount;
        await updateProfile({ xp: newXP });
    };

    const addBadge = async (badgeId) => {
        if (!profile) return;
        const currentBadges = profile.badges || [];
        if (!currentBadges.includes(badgeId)) {
            await updateProfile({ badges: [...currentBadges, badgeId] });
        }
    };

    const value = {
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
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
