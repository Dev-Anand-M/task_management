import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import * as db from '../../services/database';
import { Mail, Lock, Zap, ArrowRight, Target, Award, TrendingUp, Users, Shield } from 'lucide-react';
import { PlatformService } from '../../services/infrastructure/PlatformService';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isResetMode, setIsResetMode] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            // Manual navigation as a fallback to AuthRoute redirect
            const userRole = result.profile?.role || result.user?.user_metadata?.role || 'member';
            const redirectPath = userRole === 'admin' ? '/admin' : '/dashboard';
            navigate(redirectPath, { replace: true });
        } else {
            setError(result.error || 'Invalid credentials');
            setLoading(false); // Only set loading false if we didn't redirect
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { success, error: resetError } = await db.sendPasswordResetEmail(email);

        if (success) {
            alert('Password reset email sent! Please check your inbox.');
            setIsResetMode(false);
        } else {
            setError(resetError || 'Failed to send reset email');
        }

        setLoading(false);
    };

    const features = [
        { icon: Shield, title: 'Invite-Only Access', desc: 'Private workspace for verified members' },
        { icon: Target, title: 'Task & Goal Hub', desc: 'Streamlined execution & milestones' },
        { icon: Zap, title: 'Intelligent Workflows', desc: 'AI-assisted productivity tools' },
        { icon: TrendingUp, title: 'Real-Time Analytics', desc: 'Track progress & performance' }
    ];

    return (
        <div className="auth-page">
            {/* Left Side - Brand & Visual */}
            <div className="auth-left">
                {/* Gradient Overlay */}
                <div className="auth-left-overlay"></div>

                {/* Content */}
                <div className="auth-brand">
                    <div className="auth-logo-large">
                        <img src="/zenith.png" alt="Zenith" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <h1 className="brand-title">Zenith OS</h1>
                    <p className="brand-tagline">
                        Your private, invite-only command center for high-performance productivity
                    </p>

                    {/* Feature Cards */}
                    <div className="feature-grid">
                        {features.map((feature, i) => (
                            <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
                                <feature.icon size={20} />
                                <div>
                                    <h4>{feature.title}</h4>
                                    <p>{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="deco-circle deco-1"></div>
                <div className="deco-circle deco-2"></div>
                <div className="deco-circle deco-3"></div>
            </div>

            {/* Right Side - Login Form */}
            <div className="auth-right">
                {/* Liquid Background */}
                <div className="liquid-bg">
                    <div className="liquid-wave liquid-wave-1"></div>
                    <div className="liquid-wave liquid-wave-2"></div>
                    <div className="liquid-wave liquid-wave-3"></div>
                </div>

                <div className="auth-form-container" style={{ position: 'relative', zIndex: 10 }}>
                    {/* Mobile Logo */}
                    <div className="mobile-logo">
                        <div className="mobile-logo-icon">
                            <img src="/zenith.png" alt="Zenith" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        </div>
                        <span><span style={{ color: '#10b981' }}>Zenith</span> OS</span>
                    </div>

                    {/* Header */}
                    <div className="form-header">
                        <h2>Welcome to <span style={{ background: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zenith</span></h2>
                        <p>Sign in to access your private workspace</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-box">
                            {error}
                        </div>
                    )}

                    {/* Login / Reset Form */}
                    <form onSubmit={isResetMode ? handleResetSubmit : handleSubmit}>
                        <div className="form-fields">
                            <Input
                                type="email"
                                label="Email"
                                placeholder="Enter your email"
                                icon={Mail}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            {!isResetMode && (
                                <>
                                    <Input
                                        type="password"
                                        label="Password"
                                        placeholder="Enter your password"
                                        icon={Lock}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const subject = encodeURIComponent("Zenith Password Reset Request");
                                                const body = encodeURIComponent(`Hi Dev,\n\nI need to reset my password for the Zenith App. My account email is: ${email || '[Enter your email here]'}\n\nThank you.`);
                                                const mailtoUrl = `mailto:dev.klinux@proton.me?subject=${subject}&body=${body}`;
                                                if (PlatformService.isNative()) {
                                                    window.open(mailtoUrl, '_system');
                                                } else {
                                                    window.location.href = mailtoUrl;
                                                }
                                            }}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: '#10b981', 
                                                fontSize: '0.75rem', 
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                </>
                            )}

                            <Button
                                type="submit"
                                className="submit-btn"
                                loading={loading}
                            >
                                <span>{isResetMode ? 'Send Reset Link' : 'Sign In'}</span>
                                <ArrowRight size={18} />
                            </Button>

                            {isResetMode && (
                                <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() => setIsResetMode(false)}
                                    style={{ width: '100%', color: 'var(--text-muted)' }}
                                >
                                    Back to Login
                                </Button>
                            )}
                        </div>
                    </form>

                    {/* APK Download Option */}
                    {!PlatformService.isNative() && (
                        <div style={{
                            marginTop: 'var(--space-md)',
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'color-mix(in srgb, var(--primary-500), transparent 95%)',
                            border: '1px dashed color-mix(in srgb, var(--primary-500), transparent 70%)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 'var(--space-sm)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    background: '#10b981',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px'
                                }}>
                                    🤖
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.2' }}>Get the Android App</p>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text)', lineHeight: '1.2' }}>Zenith Mobile</p>
                                </div>
                            </div>
                            <a 
                                href="/zenith-v1.5.0.apk" 
                                download 
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    transition: 'opacity 0.2s',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                                className="hover:opacity-90 active:scale-95"
                            >
                                Download
                            </a>
                        </div>
                    )}

                    {/* Register Link */}
                    <div className="register-link">
                        <p>
                            Don't have an account?{' '}
                            <Link to="/register">Create one</Link>
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                body {
                    background: 
                        linear-gradient(135deg, rgba(255,255,255,0.08) 25%, transparent 25%),
                        linear-gradient(225deg, rgba(255,255,255,0.08) 25%, transparent 25%),
                        linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
                        linear-gradient(315deg, rgba(255,255,255,0.05) 25%, transparent 25%),
                        linear-gradient(to right, #047857 0%, #059669 15%, #10b981 35%, #34d399 40%, #1c1917 60%, #1c1917 100%) !important;
                    background-size: 10px 10px, 10px 10px, 10px 10px, 10px 10px, 100% 100%;
                }

                .auth-page {
                    display: flex;
                    flex-direction: row;
                    height: 100vh;
                    width: 100%;
                    overflow: hidden;
                }

                /* LEFT SIDE - Green Brand Area */
                .auth-left {
                    width: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-3xl);
                    background: linear-gradient(135deg, #047857 0%, #059669 30%, #10b981 60%, #34d399 100%);
                    position: relative;
                    overflow: hidden;
                    height: 100%;
                }

                .auth-left-overlay {
                    position: absolute;
                    inset: 0;
                    background: 
                        radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%);
                }

                .auth-brand {
                    position: relative;
                    z-index: 2;
                    text-align: center;
                    color: white;
                    max-width: 480px;
                }

                .auth-logo-large {
                    width: 80px;
                    height: 80px;
                    background: transparent !important;
                    border: none !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--space-lg);
                    box-shadow: none !important;
                }

                .brand-title {
                    font-size: 3rem;
                    font-weight: 800;
                    margin: 0 0 var(--space-md);
                    letter-spacing: -0.03em;
                    text-shadow: 0 2px 20px rgba(0,0,0,0.2);
                    color: white;
                }

                .brand-tagline {
                    font-size: 1.1rem;
                    color: rgba(255,255,255,0.95);
                    line-height: 1.6;
                    margin: 0 0 var(--space-2xl);
                }

                .feature-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-md);
                    text-align: left;
                }

                .feature-card {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-sm);
                    padding: var(--space-md);
                    background: rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: var(--radius-lg);
                    animation: fadeInUp 0.5s ease forwards;
                    opacity: 0;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                }

                .feature-card:hover {
                    transform: translateX(6px) translateY(-2px);
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(52, 211, 153, 0.4);
                    box-shadow: 0 10px 28px rgba(16, 185, 129, 0.25);
                }

                .feature-card h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin: 0 0 2px;
                    color: white;
                }

                .feature-card p {
                    font-size: 0.75rem;
                    opacity: 0.85;
                    margin: 0;
                    color: rgba(255, 255, 255, 0.8);
                }

                /* Decorative Circles & Ambient Mesh */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    pointer-events: none;
                }

                .deco-1 {
                    width: 450px;
                    height: 450px;
                    top: -120px;
                    left: -120px;
                    background: radial-gradient(circle, rgba(52, 211, 153, 0.18) 0%, transparent 70%);
                    animation: meshPulse 10s ease-in-out infinite alternate;
                }

                .deco-2 {
                    width: 380px;
                    height: 380px;
                    bottom: -80px;
                    right: -80px;
                    background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
                    animation: meshPulse 12s ease-in-out infinite alternate-reverse;
                }

                .deco-3 {
                    width: 200px;
                    height: 200px;
                    top: 35%;
                    right: 8%;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
                }

                @keyframes meshPulse {
                    0% { transform: scale(1) translate(0, 0); opacity: 0.7; }
                    100% { transform: scale(1.15) translate(20px, -20px); opacity: 1; }
                }

                /* RIGHT SIDE - Form Area */
                .auth-right {
                    width: 50%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-2xl);
                    background: linear-gradient(135deg, rgba(28, 25, 23, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
                    overflow-y: auto;
                    position: relative;
                    border-radius: 0 40px 40px 0;
                    z-index: 10;
                }

                /* Custom Scrollbar for the right side */
                .auth-right::-webkit-scrollbar {
                    width: 6px;
                }
                
                .auth-right::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .auth-right::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }

                .auth-form-container {
                    width: 100%;
                    max-width: 420px;
                    padding: 40px 36px;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 28px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }

                .auth-form-container:hover {
                    border-color: rgba(52, 211, 153, 0.3);
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 30px rgba(16, 185, 129, 0.2);
                }

                .mobile-logo {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    margin-bottom: var(--space-xl);
                }

                .mobile-logo-icon {
                    width: 48px;
                    height: 48px;
                    background: transparent !important;
                    border: none !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: none !important;
                }

                .mobile-logo span {
                    font-size: var(--text-xl);
                    font-weight: 800;
                    background: linear-gradient(135deg, #ffffff 0%, #10b981 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }

                .form-header {
                    margin-bottom: var(--space-xl);
                    text-align: center;
                }

                .form-header h2 {
                    font-size: 1.85rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #ffffff 0%, #34d399 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0 0 var(--space-xs);
                    letter-spacing: -0.02em;
                }

                .form-header p {
                    color: #a8a29e;
                    margin: 0;
                    font-size: var(--text-sm);
                }

                .error-box {
                    padding: var(--space-md);
                    background: rgba(244, 63, 94, 0.12);
                    border: 1px solid rgba(244, 63, 94, 0.3);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--space-lg);
                    color: #fb7185;
                    font-size: var(--text-sm);
                    text-align: center;
                    box-shadow: 0 4px 14px rgba(244, 63, 94, 0.15);
                }

                .form-fields {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-lg);
                }

                .submit-btn {
                    position: relative !important;
                    overflow: hidden !important;
                    width: 100%;
                    height: 52px;
                    margin-top: var(--space-md);
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
                    border: 1px solid rgba(255, 215, 0, 0.35) !important;
                    border-radius: 14px !important;
                    font-weight: 700;
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    color: white !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.35) !important;
                    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.35s ease, box-shadow 0.35s ease !important;
                }

                .submit-btn::before {
                    content: '' !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    height: 2.5px !important;
                    background: linear-gradient(90deg, transparent 0%, #ffd700 30%, #f59e0b 50%, #d4af37 70%, transparent 100%) !important;
                    transform: scaleX(0);
                    transform-origin: center;
                    opacity: 0;
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease !important;
                    pointer-events: none !important;
                    z-index: 3 !important;
                }

                .submit-btn::after {
                    content: '' !important;
                    position: absolute !important;
                    inset: 0 !important;
                    background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 215, 0, 0.25) 50%, transparent 80%) !important;
                    opacity: 0 !important;
                    transition: opacity 0.35s ease !important;
                    pointer-events: none !important;
                    z-index: 2 !important;
                }

                .submit-btn:hover {
                    transform: translateY(-2px) !important;
                    border-color: rgba(255, 215, 0, 0.7) !important;
                    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35), 0 0 16px rgba(255, 215, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.6) !important;
                }

                .submit-btn:hover::before {
                    transform: scaleX(1) !important;
                    opacity: 1 !important;
                }

                .submit-btn:hover::after {
                    opacity: 1 !important;
                }

                .register-link {
                    text-align: center;
                    margin-top: var(--space-xl);
                    padding-top: var(--space-lg);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .register-link p {
                    color: var(--text-muted);
                    font-size: var(--text-sm);
                    margin: 0;
                }

                .register-link a {
                    color: #10b981;
                    font-weight: 600;
                    text-decoration: none;
                }

                .register-link a:hover {
                    color: #34d399;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Liquid Wave Animation */
                .liquid-bg {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    z-index: 0;
                    pointer-events: none;
                }

                .liquid-wave {
                    position: absolute;
                    width: 250vw;
                    height: 250vw;
                    bottom: -230vw;
                    left: -75vw;
                    border-radius: 40%;
                    animation: liquid-spin 10s linear infinite;
                    opacity: 0.8;
                }

                @media (min-width: 1025px) {
                    .liquid-wave {
                        width: 150vh;
                        height: 150vh;
                        bottom: -130vh;
                        left: -25vh;
                    }
                }

                .liquid-wave-1 {
                    background: rgba(6, 95, 70, 0.75); /* Deep dark green */
                    border-radius: 42%;
                }

                .liquid-wave-2 {
                    background: rgba(4, 120, 87, 0.55);
                    border-radius: 38%;
                    animation: liquid-spin 15s linear infinite reverse;
                }

                .liquid-wave-3 {
                    background: rgba(6, 78, 59, 0.40);
                    border-radius: 45%;
                    animation: liquid-spin 12s linear infinite;
                }

                @keyframes liquid-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Zero-Scroll Ultra-Compact Mobile Layout */
                @media (max-width: 1024px) {
                    .auth-page {
                        flex-direction: column;
                        height: 100dvh;
                        max-height: 100dvh;
                        width: 100%;
                        overflow: hidden !important;
                    }

                    .auth-left {
                        display: none;
                    }

                    .auth-right {
                        width: 100%;
                        height: 100dvh;
                        max-height: 100dvh;
                        padding: 12px;
                        border-radius: 24px;
                        background: transparent !important;
                        overflow: hidden !important;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                    }

                    .auth-form-container {
                        width: 100%;
                        max-width: 380px;
                        padding: 24px 20px;
                        margin: 0 auto;
                        box-sizing: border-box;
                        border-radius: 22px;
                        background: rgba(12, 16, 28, 0.92) !important;
                        backdrop-filter: blur(20px) !important;
                        -webkit-backdrop-filter: blur(20px) !important;
                        border: 1px solid rgba(52, 211, 153, 0.2) !important;
                        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(52, 211, 153, 0.08) !important;
                    }

                    .mobile-logo {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        margin-bottom: 12px;
                    }

                    .mobile-logo-icon {
                        width: 36px;
                        height: 36px;
                    }

                    .mobile-logo span {
                        font-size: 1.15rem;
                    }

                    .form-header {
                        margin-bottom: 14px;
                        text-align: center;
                    }

                    .form-header h2 {
                        font-size: 1.45rem;
                        margin: 0 0 2px;
                    }

                    .form-header p {
                        font-size: 0.85rem;
                    }

                    .form-fields {
                        gap: 10px !important;
                    }

                    .submit-btn {
                        height: 46px !important;
                        margin-top: 10px !important;
                        font-size: 0.95rem !important;
                    }

                    .register-link {
                        margin-top: 12px !important;
                        padding-top: 10px !important;
                    }

                    .register-link p {
                        font-size: 0.825rem !important;
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: 8px;
                        background: transparent !important;
                        border-radius: 20px;
                    }

                    .auth-form-container {
                        padding: 20px 16px;
                        border-radius: 18px;
                    }
                }

                /* Light mode adjustments */
                html[data-theme="light"] .auth-right {
                    background: #ffffff;
                }

                html[data-theme="light"] .form-header h2 {
                    color: #1c1917;
                }

                html[data-theme="light"] .form-header p {
                    color: #78716c;
                }

                /* Dark mode text colors */
                .form-header h2 {
                    color: #fafaf9;
                }

                .form-header p {
                    color: #a8a29e;
                }

                .register-link p {
                    color: #a8a29e;
                }
            `}</style>
        </div>
    );
};

export default Login;
