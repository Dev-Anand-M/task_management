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
                // Pre-emptively set loading to false if we take too long
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                authInitialized = true;
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

                // Only set loading to false if we haven't already from initializeAuth
                // or if this is a subsequent change
                if (authInitialized || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    setLoading(false);
                    clearTimeout(timeoutId);
                }
            }
        );

        return () => {
            mounted = false;
            subscription?.unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            // First, set a basic profile from the auth user metadata as a fallback
            if (user) {
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
                console.warn('Profile fetch error, using fallback:', error);
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
                setTimeout(() => reject(new Error('Sign in timeout. The server is taking too long to respond.')), 15000) // Increased to 15 seconds
            );

            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            setUser(data.user);
            // Fetch profile in background, don't block login
            fetchProfile(data.user.id).catch(err => console.error('Profile fetch error:', err));
            return { success: true };
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
                setTimeout(() => reject(new Error('Sign up timeout. The server is taking too long to respond.')), 15000) // Increased to 15 seconds
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
