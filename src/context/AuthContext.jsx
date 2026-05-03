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
        let subscription = null;

        // Initialize session handling
        const initializeAuth = async () => {
            try {
                // Get initial session - removed timeout to prevent false failures
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Session fetch error:', error);
                    if (mounted) {
                        setLoading(false);
                    }
                    return;
                }

                if (session?.user && mounted) {
                    console.log('Initial session found for user:', session.user.id);
                    setUser(session.user);
                    // Fetch profile immediately for initial load
                    await fetchProfile(session.user.id);
                    // Check deadlines in background
                    if (session.user.id) {
                        db.checkDeadlines(session.user.id).catch(console.error);
                    }
                } else {
                    console.log('No initial session found');
                }
            } catch (error) {
                console.error('Init auth error:', error);
                // Don't clear user state on initialization errors
            } finally {
                if (mounted) setLoading(false);
            }

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

    const fetchProfile = async (userId, retryCount = 0) => {
        if (!userId) {
            console.error('fetchProfile called without userId');
            return;
        }

        try {
            console.log(`Fetching profile for user: ${userId} (attempt ${retryCount + 1})`);
            
            // Fetch profile including classroom details
            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*, classrooms(name)')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Profile fetch error:', error);
                
                // Retry logic for transient errors (but not for "not found" errors)
                if (retryCount < 1 && error.code !== 'PGRST116') {
                    console.log(`Retrying profile fetch (attempt ${retryCount + 2})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return fetchProfile(userId, retryCount + 1);
                }
                
                // Fallback to simple profile fetch
                console.log('Attempting fallback profile fetch...');
                try {
                    const simpleProfile = await db.getProfileById(userId);
                    if (simpleProfile) {
                        console.log('Fallback profile fetch successful');
                        setProfile(simpleProfile);
                        return;
                    }
                } catch (fallbackError) {
                    console.error('Fallback profile fetch failed:', fallbackError);
                }
                
                // If all else fails, keep the user logged in but without full profile
                console.warn('Could not fetch profile, user will remain logged in with limited data');
                return;
            }

            if (userProfile) {
                console.log('Profile fetched successfully');
                // Flatten classroom name into profile for easier access
                setProfile({
                    ...userProfile,
                    classroom_name: userProfile.classrooms?.name
                });
            }
        } catch (err) {
            console.error('Profile fetch exception:', err);
            
            // Try fallback
            try {
                console.log('Attempting fallback profile fetch after exception...');
                const simpleProfile = await db.getProfileById(userId);
                if (simpleProfile) {
                    console.log('Fallback profile fetch successful');
                    setProfile(simpleProfile);
                    return;
                }
            } catch (fallbackErr) {
                console.error('Fallback profile fetch error:', fallbackErr);
            }
            
            // Don't throw - keep user logged in even if profile fetch fails
            console.warn('Profile fetch failed, but user session is maintained');
        }
    };

    const login = async (email, password) => {
        try {
            console.log('Login: Starting authentication...');
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password
            });

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: error.message };
            }

            console.log('Login: Authentication successful, user ID:', data.user.id);
            
            // Set user immediately
            setUser(data.user);
            
            // Fetch profile in background (don't wait for it)
            fetchProfile(data.user.id).catch(err => {
                console.warn('Profile fetch failed during login:', err);
            });
            
            // Ensure loading is set to false
            setLoading(false);
            console.log('Login: Complete, returning success');
            
            return { success: true };
        } catch (err) {
            console.error('Login error:', err);
            setLoading(false);
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
        } else {
            // Try to recover session if user is null
            console.log('Attempting to recover session...');
            await forceRefresh();
        }
    };

    const forceRefresh = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('Force refresh error:', error);
                // Don't clear state on error - keep user logged in
                return;
            }
            
            if (session?.user) {
                setUser(session.user);
                await fetchProfile(session.user.id);
            } else {
                console.warn('No session found during force refresh');
                // Don't automatically log out - session might be temporarily unavailable
            }
        } catch (err) {
            console.error('Force refresh exception:', err);
            // Don't clear state on exception
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
