// Zenith - Local Storage Service

const STORAGE_KEYS = {
    THEME: 'zenith_theme'
};

// Generic storage functions
export const getItem = (key) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error getting item ${key}:`, error);
        return null;
    }
};

export const setItem = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Error setting item ${key}:`, error);
        return false;
    }
};

export const removeItem = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing item ${key}:`, error);
        return false;
    }
};

// Theme functions
export const getTheme = () => getItem(STORAGE_KEYS.THEME) || 'dark';
export const setTheme = (theme) => setItem(STORAGE_KEYS.THEME, theme);

export { STORAGE_KEYS };
