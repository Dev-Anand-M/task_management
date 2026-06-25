import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { PlatformService } from '../../services/infrastructure/PlatformService';
import { App as CapApp } from '@capacitor/app';

const BackHandler = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const navType = useNavigationType();
    const [showExitPrompt, setShowExitPrompt] = useState(false);
    const lastBackTimeRef = useRef(0);

    // Keep track of our own app navigation stack
    const historyStackRef = useRef([location.pathname]);

    // Keep history stack synchronized with react-router-dom navigation
    useEffect(() => {
        const currentPath = location.pathname;
        const stack = historyStackRef.current;

        if (navType === 'PUSH') {
            stack.push(currentPath);
        } else if (navType === 'REPLACE') {
            stack[stack.length - 1] = currentPath;
        } else if (navType === 'POP') {
            // If the popped path matches the second-to-last item, it means we went back.
            if (stack.length > 1 && stack[stack.length - 2] === currentPath) {
                stack.pop();
            } else {
                stack.push(currentPath);
            }
        }
    }, [location.pathname, navType]);

    useEffect(() => {
        if (PlatformService.isNative()) {
            // NATIVE MOBILE HARDWARE BACK BUTTON HANDLING
            const setupCapacitorBack = async () => {
                const listener = await CapApp.addListener('backButton', () => {
                    const isHardExitRoot = 
                        location.pathname === '/dashboard' || 
                        location.pathname === '/admin' || 
                        location.pathname === '/login' ||
                        location.pathname === '/';

                    const stack = historyStackRef.current;
                    const canGoBack = stack.length > 1 && !isHardExitRoot;

                    if (!canGoBack) {
                        const currentTime = Date.now();
                        if (currentTime - lastBackTimeRef.current < 2000) {
                            CapApp.exitApp();
                        } else {
                            lastBackTimeRef.current = currentTime;
                            setShowExitPrompt(true);
                            // Auto-hide prompt after 2 seconds
                            setTimeout(() => setShowExitPrompt(false), 2000);
                        }
                    } else {
                        // Go back in navigation history
                        navigate(-1);
                    }
                });
                return listener;
            };

            const listenerPromise = setupCapacitorBack();
            return () => {
                listenerPromise.then(l => l.remove());
            };
        } else {
            // WEB BROWSER/PWA BACK BUTTON HANDLING (popstate)
            const handlePopState = (event) => {
                const isHardExitRoot = 
                    location.pathname === '/dashboard' || 
                    location.pathname === '/admin' || 
                    location.pathname === '/login' ||
                    location.pathname === '/';

                const stack = historyStackRef.current;
                const canGoBack = stack.length > 1 && !isHardExitRoot;

                if (!canGoBack) {
                    const currentTime = Date.now();
                    if (currentTime - lastBackTimeRef.current < 2000) {
                        // Allow browser default action (exit/close tab/go to search history)
                    } else {
                        event.preventDefault();
                        window.history.pushState(null, null, window.location.pathname);
                        lastBackTimeRef.current = currentTime;
                        setShowExitPrompt(true);
                        setTimeout(() => setShowExitPrompt(false), 2000);
                    }
                }
            };

            window.history.pushState(null, null, window.location.pathname);
            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [location.pathname, navigate]);

    if (!showExitPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(28, 25, 23, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: 600,
            zIndex: 99999,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'premiumSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--primary-500)',
                boxShadow: '0 0 10px var(--primary-500)'
            }} />
            Press back again to exit Zenith
            <style>{`
                @keyframes premiumSlideUp {
                    from { transform: translate(-50%, 40px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default BackHandler;
