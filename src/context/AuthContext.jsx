import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log('Tab became visible, checking session state...');
                
                // SAFETY: If we are stuck in a loading state, force release it after 1.5 seconds of being visible
                // This prevents the "infinite loading" issue reported by the user
                const stuckTimeout = setTimeout(() => {
                    setLoading(prev => {
                        if (prev) {
                            console.warn('Recovering from stuck loading state on visibility change (forced)');
                            return false;
                        }
                        return prev;
                    });
                }, 1500);

                try {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error) {
                        console.error('Visibility check session error:', error);
                        setLoading(false);
                    } else if (session?.user) {
                        console.log('Session verified on visibility change');
                        setUser(session.user);
                        fetchProfile(session.user.id);
                        setLoading(false);
                    } else {
                        // No session, but we should still stop loading
                        setLoading(false);
                    }
                } catch (e) {
                    console.error('Visibility check unexpected error:', e);
                    setLoading(false);
                } finally {
                    clearTimeout(stuckTimeout);
                }
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
