import React from 'react';

const SplashScreen = () => {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(circle at center, #111827 0%, #090d16 100%)', // Harmonized dark mode background
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '28px'
            }}>
                {/* Logo Container with floating animation and pulsing glow */}
                <div className="splash-logo-container" style={{
                    position: 'relative',
                    width: '128px',
                    height: '128px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1.5px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 50px rgba(16, 185, 129, 0.15)', // Subtle green/emerald aura
                    overflow: 'hidden'
                }}>
                    {/* Zenith Logo Image */}
                    <img 
                        src="/zenith.png" 
                        alt="Zenith Logo" 
                        style={{ 
                            width: '84px', 
                            height: '84px', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))'
                        }} 
                    />
                    
                    {/* Metallic sweep shine animation layer */}
                    <div className="splash-logo-shine" style={{
                        position: 'absolute',
                        top: 0,
                        left: '-150%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                        transform: 'skewX(-25deg)',
                        animation: 'shineSweep 2.2s infinite ease-in-out'
                    }} />
                </div>

                {/* Brand Name Typography */}
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        letterSpacing: '0.18em',
                        color: 'white',
                        textTransform: 'uppercase',
                        background: 'linear-gradient(to right, #ffffff 0%, #e2e8f0 50%, #ffffff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 4px 24px rgba(16, 185, 129, 0.1)'
                    }}>
                        Zenith
                    </h1>
                    <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.35)',
                        letterSpacing: '0.35em',
                        textTransform: 'uppercase',
                        fontWeight: 600
                    }}>
                        Transform Skills
                    </p>
                </div>

                {/* Micro progress line loader */}
                <div style={{
                    width: '140px',
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginTop: '16px'
                }}>
                    <div style={{
                        width: '40%',
                        height: '100%',
                        background: 'linear-gradient(90deg, #34d399, #10b981)',
                        borderRadius: '4px',
                        animation: 'progressLoading 1.6s infinite ease-in-out'
                    }} />
                </div>
            </div>

            <style>{`
                @keyframes shineSweep {
                    0% { left: -150%; }
                    50% { left: 150%; }
                    100% { left: 150%; }
                }
                @keyframes progressLoading {
                    0% { transform: translateX(-150%) scaleX(0.5); }
                    50% { transform: translateX(100%) scaleX(1); }
                    100% { transform: translateX(250%) scaleX(0.5); }
                }
                .splash-logo-container {
                    animation: floatLogo 3.6s ease-in-out infinite;
                }
                @keyframes floatLogo {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;
