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

        const initializeAuth = async () => {
            try {
                // Add a timeout to prevent getSession from hanging indefinitely
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
                );
                
                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

                if (session?.user && mounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (error) {
                console.warn('Auth initialization warning:', error);
                // If it times out or fails, we will rely on onAuthStateChange below
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        // Set up listener for subsequent changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (session?.user) {
                    // Prevent duplicate fetching if we already fetched it above
                    setUser(prevUser => {
                        if (!prevUser || prevUser.id !== session.user.id) {
                            fetchProfile(session.user.id);
                        }
                        return session.user;
                    });
                } else {
                    setUser(null);
                    setProfile(null);
                }

                setLoading(false);
            }
        );

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const fetchPromise = supabase
                .from('profiles')
                .select('*, classrooms(name)')
                .eq('id', userId)
                .single();
                
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            );

            const { data: userProfile, error } = await Promise.race([fetchPromise, timeoutPromise]);

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
            const signInPromise = supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sign in timeout. The server is taking too long to respond.')), 8000)
            );

            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            setUser(data.user);
            await fetchProfile(data.user.id);
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
                setTimeout(() => reject(new Error('Sign up timeout. The server is taking too long to respond.')), 8000)
            );

            const { data, error } = await Promise.race([signUpPromise, timeoutPromise]);

            if (error) {
                return { success: false, error: error.message };
            }

            setUser(data.user);
            await fetchProfile(data.user.id);
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
