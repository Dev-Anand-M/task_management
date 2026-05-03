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

        // Initialize session handling
        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (error) {
                console.error('Init auth error:', error);
            } finally {
                if (mounted) setLoading(false);
            }

            // Set up listener for subsequent changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    if (!mounted) return;

                    if (event === 'INITIAL_SESSION') {
                        return;
                    }

                    if (session?.user) {
                        setUser(session.user);
                        await fetchProfile(session.user.id);
                    } else {
                        setUser(null);
                        setProfile(null);
                    }

                    setLoading(false);
                }
            );

            return subscription;
        };

        const authPromise = initializeAuth();

        return () => {
            mounted = false;
            authPromise.then(subscription => subscription?.unsubscribe());
        };
    }, []);

            // Set up listener for subsequent changes
            const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    if (!mounted) return;

                    console.log('Auth state change:', event, session?.user?.id);

                    // Ignore INITIAL_SESSION as we handled it above
                    if (event === 'INITIAL_SESSION') {
                        return;
                    }

                    // Handle explicit sign out
                    if (event === 'SIGNED_OUT') {
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                        return;
                    }

                    // Handle token refresh - don't clear state on refresh
                    if (event === 'TOKEN_REFRESHED') {
                        if (session?.user) {
                            setUser(session.user);
                            // Optionally refresh profile on token refresh
                            // Only if we don't have a profile yet
                            if (!profile) {
                                await fetchProfile(session.user.id);
                            }
                        }
                        setLoading(false);
                        return;
                    }

                    // Handle sign in
                    if (event === 'SIGNED_IN') {
                        if (session?.user) {
                            setUser(session.user);
                            // Fetch profile with timeout to prevent hanging
                            fetchProfile(session.user.id).catch(err => {
                                console.warn('Profile fetch failed on sign in:', err);
                            });
                        }
                        setLoading(false);
                        return;
                    }

                    // Handle user updated
                    if (event === 'USER_UPDATED') {
                        if (session?.user) {
                            setUser(session.user);
                            // Refresh profile on user update
                            fetchProfile(session.user.id).catch(err => {
                                console.warn('Profile fetch failed on user update:', err);
                            });
                        }
                        setLoading(false);
                        return;
                    }

                    // Default: if we have a session, keep the user logged in
                    if (session?.user) {
                        setUser(session.user);
                        // Only fetch profile if we don't have one
                        if (!profile) {
                            await fetchProfile(session.user.id);
                        }
                    } else {
                        // Only clear state if explicitly no session
                        setUser(null);
                        setProfile(null);
                    }

                    setLoading(false);
                }
            );

            subscription = authSubscription;
        };

        initializeAuth();

        return () => {
            mounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*, classrooms(name)')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Profile fetch error:', error);
                const simpleProfile = await db.getProfileById(userId);
                if (simpleProfile) {
                    setProfile(simpleProfile);
                }
                return;
            }

            if (userProfile) {
                setProfile({
                    ...userProfile,
                    classroom_name: userProfile.classrooms?.name
                });
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
        }
    };

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            await fetchProfile(data.user.id);
            return { success: true };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, error: err.message || 'Login failed. Please try again.' };
        }
    };

    const register = async (name, email, password, classroomId) => {
        try {
            const { data, error } = await supabase.auth.signUp({
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

            if (error) {
                return { success: false, error: error.message };
            }

            await fetchProfile(data.user.id);
            return { success: true, user: data.user };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, error: 'Registration failed. Please try again.' };
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
