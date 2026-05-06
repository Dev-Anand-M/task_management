import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BackHandler = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showExitPrompt, setShowExitPrompt] = useState(false);
    const [lastBackTime, setLastBackTime] = useState(0);

    useEffect(() => {
        const handlePopState = (event) => {
            const isRootPage = 
                location.pathname === '/dashboard' || 
                location.pathname === '/admin' || 
                location.pathname === '/login';

            if (isRootPage) {
                const currentTime = Date.now();
                if (currentTime - lastBackTime < 2000) {
                    // Double back - let it happen (will exit app or go to browser home)
                } else {
                    // First back on root - block it and show toast/prompt
                    event.preventDefault();
                    window.history.pushState(null, null, window.location.pathname);
                    setLastBackTime(currentTime);
                    setShowExitPrompt(true);
                    
                    // Auto-hide prompt after 2 seconds
                    setTimeout(() => setShowExitPrompt(false), 2000);
                }
            }
        };

        window.history.pushState(null, null, window.location.pathname);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [location.pathname, lastBackTime]);

    if (!showExitPrompt) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '40px',
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
