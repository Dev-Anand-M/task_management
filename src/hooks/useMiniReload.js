import { useEffect } from 'react';

/**
 * Hook to listen for global refresh events and trigger a reload function.
 * @param {Function} reloadFn The function to call when a refresh is triggered.
 */
export const useMiniReload = (reloadFn) => {
    useEffect(() => {
        const handleRefresh = () => {
            if (reloadFn) reloadFn();
        };

        window.addEventListener('zenith-refresh', handleRefresh);
        return () => window.removeEventListener('zenith-refresh', handleRefresh);
    }, [reloadFn]);
};
