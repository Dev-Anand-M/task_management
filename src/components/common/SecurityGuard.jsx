import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, WifiOff, MonitorOff } from 'lucide-react';
import { securityDetector } from '../../services/securityDetector';

export const SecurityGuard = ({ children }) => {
  const [securityStatus, setSecurityStatus] = useState({
    isRestricted: false,
    isDevToolsOpen: false,
    isVpnDetected: false,
    isDeveloperModeDetected: false,
    isTorOrIpBlocked: false,
    reasons: []
  });

  useEffect(() => {
    securityDetector.startMonitoring();
    const unsubscribe = securityDetector.subscribe((status) => {
      setSecurityStatus(status);
    });
    
    return () => {
      unsubscribe();
      securityDetector.stopMonitoring();
    };
  }, []);

  const handleRetry = () => {
    // Hard reload: clear service worker cache and force reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Force hard reload with cache bypass (Ctrl+F5 equivalent)
    window.location.reload(true);
  };

  if (!securityStatus.isRestricted) return children;

  // Determine primary issue and customize messaging
  const getPrimaryIssue = () => {
    if (securityStatus.isDevToolsOpen) {
      return {
        icon: <MonitorOff size={48} strokeWidth={1.5} />,
        title: 'Developer Tools Detected',
        subtitle: 'Browser inspection tools are currently active and must be closed to continue.',
        instruction: 'Close Developer Tools (F12, DevTools panel) and reload the page.',
        iconColor: '#f59e0b' // orange
      };
    }
    if (securityStatus.isDeveloperModeDetected) {
      return {
        icon: <ShieldAlert size={48} strokeWidth={1.5} />,
        title: 'Android Developer Mode Active',
        subtitle: 'USB debugging or developer options are enabled on your device.',
        instruction: 'Disable Developer Options and USB Debugging in your Android settings, then reload.',
        iconColor: '#f59e0b' // orange
      };
    }
    if (securityStatus.isVpnDetected) {
      return {
        icon: <WifiOff size={48} strokeWidth={1.5} />,
        title: 'VPN or Proxy Detected',
        subtitle: 'Your connection is routed through a VPN, proxy, or datacenter network.',
        instruction: 'Disconnect your VPN or proxy service, then reload the page.',
        iconColor: '#ef4444' // red
      };
    }
    if (securityStatus.isTorOrIpBlocked) {
      return {
        icon: <WifiOff size={48} strokeWidth={1.5} />,
        title: 'Network Connection Issue',
        subtitle: 'Your IP address cannot be verified. This may occur with TOR browser, extreme privacy tools, or network blocks.',
        instruction: 'Switch to a standard network connection without anonymization tools, then reload.',
        iconColor: '#8b5cf6' // purple
      };
    }
    // Fallback for multiple issues
    return {
      icon: <ShieldAlert size={48} strokeWidth={1.5} />,
      title: 'Access Restricted',
      subtitle: 'Multiple security concerns detected with your connection or browser environment.',
      instruction: 'Review the issues below, resolve them, and reload the page.',
      iconColor: '#ef4444' // red
    };
  };

  const issue = getPrimaryIssue();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      overflow: 'hidden',
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
    }}>
      {/* Blurred page beneath */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        filter: 'blur(18px) grayscale(70%) brightness(0.3)',
        userSelect: 'none',
        overflow: 'hidden',
      }}>
        {children}
      </div>

      {/* Full-screen gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(239,68,68,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 70% 50% at 80% 90%, rgba(168,85,247,0.14) 0%, transparent 60%),
          linear-gradient(160deg, #07060f 0%, #0d0a1a 40%, #100812 70%, #080610 100%)
        `,
      }} />

      {/* Noise texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.6,
        pointerEvents: 'none',
      }} />

      {/* Center content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        boxSizing: 'border-box',
      }}>

        {/* Badge */}
        <div style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${issue.iconColor}33, ${issue.iconColor}11)`,
          border: `1.5px solid ${issue.iconColor}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: issue.iconColor,
          boxShadow: `0 0 48px ${issue.iconColor}33, 0 0 100px ${issue.iconColor}15`,
          marginBottom: '32px',
          animation: 'sgPulse 3s ease-in-out infinite',
        }}>
          {issue.icon}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: '800',
          color: '#ffffff',
          margin: '0 0 14px 0',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          textAlign: 'center',
        }}>
          {issue.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(14px, 2vw, 16px)',
          lineHeight: '1.7',
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 40px 0',
          maxWidth: '480px',
          textAlign: 'center',
        }}>
          {issue.subtitle}
        </p>

        {/* Reason pills */}
        {securityStatus.reasons.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '40px',
            width: '100%',
            maxWidth: '400px',
          }}>
            {securityStatus.reasons.map((reason, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '13px',
                fontWeight: '500',
              }}>
                {reason.toLowerCase().includes('vpn') || reason.toLowerCase().includes('proxy')
                  ? <WifiOff size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                  : <MonitorOff size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                }
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Instruction */}
        <p style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.3)',
          margin: '0 0 28px 0',
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}>
          {issue.instruction}
        </p>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          style={{
            padding: '16px 48px',
            borderRadius: '14px',
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(185,28,28,0.9) 100%)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '15px',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(239,68,68,0.3), 0 2px 8px rgba(0,0,0,0.4)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(239,68,68,0.45), 0 2px 8px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(239,68,68,0.3), 0 2px 8px rgba(0,0,0,0.4)';
          }}
        >
          <RefreshCw size={16} />
          <span>Retry — Reload Page</span>
        </button>
      </div>

      <style>{`
        @keyframes sgPulse {
          0%, 100% { box-shadow: 0 0 48px ${issue.iconColor}33, 0 0 100px ${issue.iconColor}15; }
          50% { box-shadow: 0 0 64px ${issue.iconColor}55, 0 0 120px ${issue.iconColor}25; }
        }
      `}</style>
    </div>
  );
};

export default SecurityGuard;
