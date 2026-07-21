import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Transparent Glass Orb with Free-Traveling Smoke ZEN Logo Component
 * - Standard Themes: Clean transparent glass orb with subtle theme-matched smoke (var(--primary-500), var(--accent-500)).
 * - EXCLUSIVE LIQUID GLASS THEME:
 *   - Exotic Red-to-Green Crimson Emerald Liquid Smoke Gradient!
 *   - Photorealistic Red-Green Prism Glass Rim Shimmer!
 *   - Sparkling Diamond Caustic Refraction Stars!
 */
export const ZenLogo = ({ size = 28, glow = true, className = '', style = {} }) => {
    let themeCtx = null;
    try {
        themeCtx = useTheme();
    } catch {
        themeCtx = null;
    }

    const [isLiquidGlass, setIsLiquidGlass] = useState(false);

    useEffect(() => {
        const checkTheme = () => {
            if (typeof document === 'undefined') return;
            const t = (themeCtx?.theme || document.documentElement.getAttribute('data-theme') || '').toLowerCase();
            const cs = (themeCtx?.colorScheme || document.documentElement.getAttribute('data-color-scheme') || '').toLowerCase();
            const localCs = (localStorage.getItem('skillquest_color_scheme') || '').toLowerCase();

            const isLiquid = 
                t.includes('liquid') || t.includes('crystal') || t.includes('glass') ||
                cs.includes('liquid') || cs.includes('crystal') || cs.includes('glass') ||
                localCs.includes('liquid') || localCs.includes('crystal') || localCs.includes('glass');

            setIsLiquidGlass(isLiquid);
        };

        checkTheme();

        if (typeof document !== 'undefined') {
            const observer = new MutationObserver(checkTheme);
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme', 'data-color-scheme']
            });

            window.addEventListener('storage', checkTheme);

            return () => {
                observer.disconnect();
                window.removeEventListener('storage', checkTheme);
            };
        }
    }, [themeCtx?.theme, themeCtx?.colorScheme]);

    return (
        <div 
            className={`zen-theme-aware-smoke-orb-logo ${className}`}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                ...style
            }}
        >
            {/* Ambient Aura Background */}
            {glow && (
                <div 
                    style={{
                        position: 'absolute',
                        inset: '-10%',
                        borderRadius: '50%',
                        background: isLiquidGlass 
                            ? 'radial-gradient(circle, #ef4444 0%, #10b981 40%, #22c55e 75%, transparent 100%)' 
                            : 'radial-gradient(circle, var(--primary-500, #9333ea) 0%, var(--accent-500, #ec4899) 60%, transparent 90%)',
                        filter: 'blur(3px)',
                        animation: isLiquidGlass ? 'liquid-glass-aura-shimmer 3s ease-in-out infinite alternate' : 'standard-orb-aura 4s ease-in-out infinite alternate',
                        pointerEvents: 'none',
                        opacity: isLiquidGlass ? 0.25 : 0.12
                    }} 
                />
            )}

            {/* Vector SVG Transparent Glass Orb */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'visible'
                }}
            >
                <defs>
                    {/* Standard Glass Rim Gradient */}
                    <linearGradient id="stdGlassRim" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                        <stop offset="25%" stopColor="rgba(255, 255, 255, 0.3)" />
                        <stop offset="65%" stopColor="var(--primary-400, #c084fc)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
                    </linearGradient>

                    {/* Special Liquid Glass RED to GREEN Prism Rim */}
                    <linearGradient id="liquidGlassRedGreenPrismRim" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="33%" stopColor="#f87171" />
                        <stop offset="66%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>

                    {/* Top Main Specular Glare Arc */}
                    <linearGradient id="stdGlassGlare" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                        <stop offset="60%" stopColor="#ffffff" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>

                    {/* Inner Glass Vignette Depth Shadow */}
                    <radialGradient id="stdGlassVignette" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="rgba(0, 0, 0, 0)" />
                        <stop offset="88%" stopColor="rgba(15, 23, 42, 0.35)" />
                        <stop offset="100%" stopColor="rgba(2, 6, 23, 0.65)" />
                    </radialGradient>

                    {/* Standard Theme Smoke Gradients */}
                    <linearGradient id="stdSmokeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--primary-300, #d8b4fe)" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="var(--primary-500, #9333ea)" stopOpacity="0.65" />
                        <stop offset="100%" stopColor="var(--accent-500, #ec4899)" stopOpacity="0.75" />
                    </linearGradient>

                    <linearGradient id="stdSmokeGrad2" x1="100%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
                        <stop offset="50%" stopColor="var(--accent-400, #f472b6)" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="var(--primary-400, #c084fc)" stopOpacity="0.7" />
                    </linearGradient>

                    {/* ── EXCLUSIVE LIQUID GLASS RED-TO-GREEN SMOKE GRADIENTS ── */}
                    <linearGradient id="liquidGlassRedGreenSmoke1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                        <stop offset="35%" stopColor="#dc2626" stopOpacity="0.85" />
                        <stop offset="70%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
                    </linearGradient>

                    <linearGradient id="liquidGlassRedGreenSmoke2" x1="100%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
                        <stop offset="40%" stopColor="#10b981" stopOpacity="0.85" />
                        <stop offset="80%" stopColor="#f87171" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                    </linearGradient>

                    {/* High-Precision Organic Smoke Noise Filter */}
                    <filter id="stdSmokeTurbulence" x="-30%" y="-30%" width="160%" height="160%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.038" numOctaves="4" result="stdNoise">
                            <animate attributeName="baseFrequency" values="0.018 0.038; 0.038 0.018; 0.018 0.038" dur="8s" repeatCount="indefinite" />
                        </feTurbulence>
                        <feDisplacementMap in="SourceGraphic" in2="stdNoise" scale="20" xChannelSelector="R" yChannelSelector="G" result="displacedStd" />
                        <feGaussianBlur in="displacedStd" stdDeviation="2.2" result="smoothStd" />
                        <feMerge>
                            <feMergeNode in="smoothStd" />
                        </feMerge>
                    </filter>

                    {/* Glass Sphere Boundary Clip */}
                    <clipPath id="stdOrbClip">
                        <circle cx="50" cy="50" r="43" />
                    </clipPath>
                </defs>

                {/* Outer Glass Sphere Base Rim */}
                <circle
                    cx="50"
                    cy="50"
                    r="43"
                    fill="rgba(255, 255, 255, 0.02)"
                    stroke={isLiquidGlass ? 'url(#liquidGlassRedGreenPrismRim)' : 'url(#stdGlassRim)'}
                    strokeWidth={isLiquidGlass ? 2.5 : 2}
                />

                {/* VOLUMETRIC COLORED SMOKE FREELY ROAMING INSIDE */}
                <g clipPath="url(#stdOrbClip)">
                    {/* Primary Free-Traveling Smoke Plume */}
                    <g style={{ transformOrigin: '50px 50px', animation: 'std-smoke-orbit1 11s linear infinite' }}>
                        <path
                            d="M45,22 C64,18 78,34 74,54 C70,74 48,80 32,72 C16,64 18,42 28,30 C38,18 36,24 45,22 Z"
                            fill={isLiquidGlass ? 'url(#liquidGlassRedGreenSmoke1)' : 'url(#stdSmokeGrad1)'}
                            filter="url(#stdSmokeTurbulence)"
                            style={{
                                transformOrigin: '50px 50px',
                                animation: 'std-smoke-float1 6.5s ease-in-out infinite alternate'
                            }}
                        />
                    </g>

                    {/* Secondary Free-Traveling Smoke Streamer */}
                    <g style={{ transformOrigin: '50px 50px', animation: 'std-smoke-orbit2 15s linear infinite' }}>
                        <path
                            d="M55,26 C72,24 82,40 76,60 C70,80 52,76 38,66 C24,56 28,38 38,28 C46,16 44,22 55,26 Z"
                            fill={isLiquidGlass ? 'url(#liquidGlassRedGreenSmoke2)' : 'url(#stdSmokeGrad2)'}
                            filter="url(#stdSmokeTurbulence)"
                            style={{
                                transformOrigin: '50px 50px',
                                animation: 'std-smoke-float2 5.5s ease-in-out infinite alternate'
                            }}
                        />
                    </g>

                    {/* Liquid Glass Sparkling Diamond Refraction Stars (Liquid Glass Special Only) */}
                    {isLiquidGlass && (
                        <g style={{ transformOrigin: '50px 50px', animation: 'std-smoke-orbit1 12s linear infinite' }}>
                            <circle cx="35" cy="30" r="1.5" fill="#ef4444" opacity="0.6" />
                            <circle cx="65" cy="35" r="1.8" fill="#ffffff" opacity="0.7" />
                            <circle cx="70" cy="65" r="1.5" fill="#22c55e" opacity="0.6" />
                            <circle cx="30" cy="68" r="1.6" fill="#10b981" opacity="0.6" />
                            <circle cx="50" cy="25" r="1.4" fill="#f87171" opacity="0.6" />
                        </g>
                    )}

                    {/* Inner Glass Vignette Depth Shadow */}
                    <circle cx="50" cy="50" r="43" fill="url(#stdGlassVignette)" />
                </g>

                {/* Curved Specular Glare Arc 1 (Top Glass Reflection) */}
                <path
                    d="M20,20 Q50,4 80,20 Q50,28 20,20 Z"
                    fill="url(#stdGlassGlare)"
                    opacity="0.7"
                />

                {/* Secondary Caustic Edge Highlight (Bottom Glass Rim) */}
                <path
                    d="M26,80 Q50,96 74,80 Q50,86 26,80 Z"
                    fill="#ffffff"
                    opacity="0.3"
                />
            </svg>

            {/* Animations */}
            <style>{`
                @keyframes standard-orb-aura {
                    0% { transform: scale(0.95); opacity: 0.1; }
                    100% { transform: scale(1.08); opacity: 0.18; }
                }
                @keyframes liquid-glass-aura-shimmer {
                    0% { opacity: 0.15; transform: scale(0.95); }
                    100% { opacity: 0.28; transform: scale(1.1); }
                }
                @keyframes std-smoke-orbit1 {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes std-smoke-orbit2 {
                    0% { transform: rotate(360deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes std-smoke-float1 {
                    0% { transform: translate(-5px, -3px) scale(1.02); opacity: 0.65; }
                    50% { transform: translate(5px, 3px) scale(0.95); opacity: 0.8; }
                    100% { transform: translate(-2px, 5px) scale(1.01); opacity: 0.7; }
                }
                @keyframes std-smoke-float2 {
                    0% { transform: translate(4px, 5px) scale(0.96); opacity: 0.6; }
                    50% { transform: translate(-5px, -2px) scale(1.04); opacity: 0.75; }
                    100% { transform: translate(2px, -4px) scale(0.97); opacity: 0.65; }
                }
            `}</style>
        </div>
    );
};

export default ZenLogo;
