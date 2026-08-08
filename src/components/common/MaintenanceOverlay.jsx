import { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, LogOut, Wrench, Lock, Zap } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from '../../context/AuthContext';

const MaintenanceOverlay = ({ maintenanceMessage, onRefresh }) => {
  const { user } = useAuth();
  const [isAdminBypassed, setIsAdminBypassed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(new Date().toLocaleTimeString());

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleRefresh = async () => {
    setChecking(true);
    setLastCheckTime(new Date().toLocaleTimeString());
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setChecking(false), 800);
  };

  const handleExitApp = () => {
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.exitApp();
      } catch (err) {
        console.error('[Maintenance] Exit app error:', err);
      }
    } else {
      window.location.href = 'about:blank';
    }
  };

  // Allow admin bypass if admin clicks bypass button
  if (user?.role === 'admin' && isAdminBypassed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, rgba(30, 27, 75, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        userSelect: 'none'
      }}
    >
      {/* Background Pulsating Ambient Light */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(0, 0, 0, 0) 70%)',
        filter: 'blur(40px)',
        animation: 'pulse 3s infinite ease-in-out',
        pointerEvents: 'none'
      }} />

      <div
        style={{
          background: 'rgba(23, 23, 33, 0.85)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '28px',
          padding: '44px 36px',
          maxWidth: '480px',
          width: '100%',
          position: 'relative',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.25)',
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden'
        }}
      >
        {/* Top Glowing Strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #f59e0b 100%)',
          boxShadow: '0 0 12px #f59e0b'
        }} />

        {/* Animated Icon Container */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            position: 'relative',
            width: '90px',
            height: '90px',
            borderRadius: '26px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.15) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.2)'
          }}>
            <Wrench size={44} style={{ animation: 'spin 12s linear infinite' }} />
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              background: '#ef4444',
              borderRadius: '50%',
              padding: '5px',
              border: '2px solid #171721',
              color: 'white'
            }}>
              <Lock size={12} />
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '9999px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '16px'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b',
            boxShadow: '0 0 8px #f59e0b',
            animation: 'pulse 1.5s infinite ease-in-out'
          }} />
          Mandatory System Maintenance
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 800,
          margin: '0 0 12px 0',
          color: '#ffffff',
          letterSpacing: '-0.02em'
        }}>
          Zenith OS Under Maintenance
        </h2>

        {/* Description / Announcement */}
        <div style={{
          background: 'rgba(10, 10, 15, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '18px 20px',
          marginBottom: '24px',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.8)',
          lineHeight: 1.6,
          textAlign: 'center',
          whiteSpace: 'pre-line'
        }}>
          {maintenanceMessage || '🛠️ Zenith OS is currently undergoing critical system maintenance & server upgrades.\n\nAll platform services and access are temporarily paused to ensure data security. Please check back in a few minutes.'}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleRefresh}
            disabled={checking}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: checking ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)',
              transition: 'all 0.15s ease',
              opacity: checking ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking Status...' : 'Check Connection Status'}
          </button>

          {Capacitor.isNativePlatform() && (
            <button
              onClick={handleExitApp}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <LogOut size={15} /> Exit Application
            </button>
          )}
        </div>

        {/* Admin Emergency Bypass */}
        {user?.role === 'admin' && (
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setIsAdminBypassed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-400, #818cf8)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Zap size={12} /> Admin Emergency Bypass →
            </button>
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
          Last status check: {lastCheckTime}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;
