import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import * as db from '../../services/database';
import { Mail, Lock, Zap, ArrowRight, Target, Award, TrendingUp, Users } from 'lucide-react';

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
            const userRole = result.user?.user_metadata?.role || 'member';
            const redirectPath = userRole === 'admin' ? '/admin' : '/dashboard';
            console.log('Login success, manual redirect to:', redirectPath);
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
        { icon: Target, title: 'Task-Based Learning', desc: 'Complete real projects' },
        { icon: Award, title: 'Earn Rewards', desc: 'XP, badges & rankings' },
        { icon: TrendingUp, title: 'Track Progress', desc: 'Visual skill growth' },
        { icon: Users, title: 'Team Collaboration', desc: 'Learn together' }
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
                        <Zap size={36} strokeWidth={2.5} />
                    </div>
                    <h1 className="brand-title">Zenith</h1>
                    <p className="brand-tagline">
                        Transform your skills into superpowers with interactive challenges
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
                {/* Mobile Background Overlays */}
                <div className="mobile-deco mobile-deco-1"></div>
                <div className="mobile-deco mobile-deco-2"></div>
                
                <div className="auth-form-container">
                    {/* Mobile Logo */}
                    <div className="mobile-logo">
                        <div className="mobile-logo-icon">
                            <Zap size={24} />
                        </div>
                        <span>Zenith</span>
                    </div>

                    {/* Header */}
                    <div className="form-header">
                        <h2>Welcome Back</h2>
                        <p>Sign in to continue your journey</p>
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
                                            onClick={() => setIsResetMode(true)}
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
                    background: #1c1917 !important;
                    margin: 0;
                    padding: 0;
                }

                .auth-page {
                    display: flex;
                    flex-direction: row;
                    min-height: 100vh;
                    width: 100%;
                    background: #1c1917;
                }

                /* LEFT SIDE - Brand Area */
                .auth-left {
                    width: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-3xl);
                    background: linear-gradient(135deg, #047857 0%, #059669 30%, #10b981 60%, #34d399 100%);
                    position: relative;
                    overflow: hidden;
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
                    background: rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--space-lg);
                    color: white;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                }

                .brand-title {
                    font-size: 3.5rem;
                    font-weight: 800;
                    margin: 0 0 var(--space-md);
                    letter-spacing: -0.04em;
                    text-shadow: 0 4px 30px rgba(0,0,0,0.3);
                    color: white;
                }

                .brand-tagline {
                    font-size: 1.15rem;
                    color: rgba(255,255,255,0.9);
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
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: var(--radius-xl);
                    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                }

                /* Decorative Circles */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(60px);
                }

                .deco-1 { width: 400px; height: 400px; top: -100px; left: -100px; background: rgba(52, 211, 153, 0.2); }
                .deco-2 { width: 300px; height: 300px; bottom: -50px; right: -50px; background: rgba(16, 185, 129, 0.2); }

                /* RIGHT SIDE - Form Area */
                .auth-right {
                    width: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-2xl);
                    background: #1c1917;
                    position: relative;
                }

                .auth-form-container {
                    width: 100%;
                    max-width: 400px;
                    z-index: 2;
                }

                .mobile-logo {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    margin-bottom: var(--space-2xl);
                }

                .mobile-logo-icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
                }

                .mobile-logo span {
                    font-size: 1.5rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    background: linear-gradient(to bottom, #fff, #a8a29e);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .form-header {
                    margin-bottom: var(--space-2xl);
                    text-align: left;
                }

                .form-header h2 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 0 0 var(--space-xs);
                    letter-spacing: -0.02em;
                }

                .form-header p {
                    color: var(--text-muted);
                    font-size: 1rem;
                }

                .submit-btn {
                    width: 100%;
                    height: 52px;
                    margin-top: var(--space-lg);
                    background: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%) !important;
                    border: none !important;
                    font-weight: 700;
                    font-size: 1rem;
                    letter-spacing: 0.01em;
                    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.2) !important;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }

                .submit-btn:hover {
                    transform: translateY(-2px) scale(1.01);
                    box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4) !important;
                }

                .register-link {
                    text-align: center;
                    margin-top: var(--space-2xl);
                    padding-top: var(--space-xl);
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Mobile Optimization */
                @media (max-width: 1024px) {
                    .auth-page {
                        flex-direction: column;
                        background: #0f172a; /* Deep dark blue/black base */
                    }

                    .auth-left {
                        display: none;
                    }

                    .auth-right {
                        width: 100%;
                        flex: 1;
                        padding: var(--space-xl);
                        background: transparent;
                        align-items: flex-start;
                        padding-top: 10vh;
                        position: relative;
                        overflow: hidden;
                    }

                    .mobile-deco {
                        position: absolute;
                        border-radius: 50%;
                        filter: blur(80px);
                        z-index: 0;
                        opacity: 0.6;
                        animation: pulse-slow 8s ease-in-out infinite alternate;
                    }

                    .mobile-deco-1 {
                        width: 300px;
                        height: 300px;
                        top: -50px;
                        right: -50px;
                        background: rgba(16, 185, 129, 0.4); /* Emerald glow */
                    }

                    .mobile-deco-2 {
                        width: 250px;
                        height: 250px;
                        bottom: 10%;
                        left: -50px;
                        background: rgba(4, 120, 87, 0.4); /* Darker emerald glow */
                        animation-delay: -4s;
                    }

                    @keyframes pulse-slow {
                        0% { transform: scale(1) translate(0, 0); opacity: 0.4; }
                        100% { transform: scale(1.1) translate(-20px, 20px); opacity: 0.7; }
                    }

                    .auth-form-container {
                        background: rgba(30, 41, 59, 0.7); /* Slightly blueish slate glass */
                        backdrop-filter: blur(25px);
                        -webkit-backdrop-filter: blur(25px);
                        padding: var(--space-2xl);
                        border-radius: 32px;
                        border: 1px solid rgba(255,255,255,0.1);
                        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                        z-index: 2;
                    }

                    .mobile-logo {
                        display: flex;
                    }

                    .form-header {
                        text-align: center;
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: var(--space-md);
                        padding-top: 6vh;
                    }
                    .auth-form-container {
                        padding: var(--space-xl);
                        border-radius: 24px;
                    }
                    .brand-title {
                        font-size: 2.5rem;
                    }
                }

                /* Theme Colors */
                html[data-theme="light"] .auth-right { background: #f9fafb; }
                html[data-theme="light"] .auth-form-container { background: white; border-color: #e5e7eb; }
                html[data-theme="light"] .form-header h2 { color: #111827; }
                html[data-theme="light"] .mobile-logo span { background: linear-gradient(to bottom, #111827, #4b5563); -webkit-text-fill-color: transparent; -webkit-background-clip: text; }
                
                .form-header h2 { color: #fafaf9; }
                .form-header p { color: #a8a29e; }
            `}</style>
        </div>
    );
};

export default Login;
