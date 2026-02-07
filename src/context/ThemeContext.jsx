import { createContext, useContext, useState, useEffect } from 'react';
import * as storage from '../services/storage';

const ThemeContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        const savedTheme = storage.getTheme();
        return savedTheme;
    });

    const [colorScheme, setColorSchemeState] = useState(() => {
        const savedScheme = localStorage.getItem('skillquest_color_scheme') || 'gold';
        return savedScheme;
    });

    // We can't use useAuth here directly if AuthContext depends on ThemeContext (circular)
    // But usually ThemeProvider wraps AuthProvider or vice versa.
    // In App.jsx: ThemeProvider -> AuthProvider. So ThemeContext cannot use AuthContext.
    // We need to listen to auth changes separately or handle it via a layout effect or pass user in.
    // Actually, looking at App.jsx, ThemeProvider is outside AuthProvider.
    // So we can't fully sync inside here without refactoring or using supabase directly.
    // Let's use supabase direct listener for preferences if needed, or better:
    // We can expose setPreferences functions that AuthContext calls when user loads.

    // HOWEVER, to make it simple and robust:
    // Let's rely on the components to update attributes, but allow external syncing.
    // Actually, simpler: Let's Move AuthProvider OUTSIDE ThemeProvider in App.jsx? 
    // No, usually Theme is lower level. 

    // Correct approach ensuring persistence:
    // 1. ThemeContext manages local state and DOM.
    // 2. A new component `ThemeSyncer` inside AuthProvider can handle the sync.
    // OR: We just use Supabase client here directly to listen to auth changes? 

    // Let's try to grab the user session directly from supabase in useEffect to sync initial state
    // but avoid tight coupling if possible.

    const setTheme = (newTheme) => {
        setThemeState(newTheme);
        storage.setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);

        // Save to DB if user is logged in
        syncPreferenceToDb({ theme: newTheme });
    };

    const setColorScheme = (newScheme) => {
        setColorSchemeState(newScheme);
        localStorage.setItem('skillquest_color_scheme', newScheme);
        document.documentElement.setAttribute('data-color-scheme', newScheme);

        // Save to DB if user is logged in
        syncPreferenceToDb({ colorScheme: newScheme });
    };

    // Helper to sync to DB without depending on AuthContext context (using direct client)
    const syncPreferenceToDb = async (prefUpdate) => {
        try {
            const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
            if (session?.user) {
                // Get current preferences first or merge? 
                // We'll do a simple merge on the server side ideally, but here we might need to read first.
                // Optimistically update partial jsonb is tricky without a function.
                // We will fetch current profile, merge, and update.
                const { data: profile } = await import('../lib/supabase')
                    .then(m => m.supabase.from('profiles').select('preferences').eq('id', session.user.id).single());

                const currentPrefs = profile?.preferences || {};
                const newPrefs = { ...currentPrefs, ...prefUpdate };

                await import('../lib/supabase')
                    .then(m => m.supabase.from('profiles').update({ preferences: newPrefs }).eq('id', session.user.id));
            }
        } catch (err) {
            console.error('Failed to sync theme preference:', err);
        }
    };

    // Load preferences from DB on mount/auth change
    useEffect(() => {
        // Initial set attrs
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-color-scheme', colorScheme);

        const { data: authListener } = import('../lib/supabase').then(m => m.supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                // Fetch preferences
                const { data: profile } = await m.supabase.from('profiles').select('preferences').eq('id', session.user.id).single();
                if (profile?.preferences) {
                    if (profile.preferences.theme) {
                        setThemeState(profile.preferences.theme);
                        storage.setTheme(profile.preferences.theme);
                        document.documentElement.setAttribute('data-theme', profile.preferences.theme);
                    }
                    if (profile.preferences.colorScheme) {
                        setColorSchemeState(profile.preferences.colorScheme);
                        localStorage.setItem('skillquest_color_scheme', profile.preferences.colorScheme);
                        document.documentElement.setAttribute('data-color-scheme', profile.preferences.colorScheme);
                    }
                }
            }
        }));

    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const value = {
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        colorScheme,
        setColorScheme
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;

