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
                        <img src="/zenith.png" alt="Zenith" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
                            <img src="/zenith.png" alt="Zenith" style={{ width: '24px', height: '24px' }} />
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
                    background: rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--space-lg);
                    color: white;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
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
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: var(--radius-lg);
                    animation: fadeInUp 0.5s ease forwards;
                    opacity: 0;
                }

                .feature-card h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin: 0 0 2px;
                }

                .feature-card p {
                    font-size: 0.75rem;
                    opacity: 0.8;
                    margin: 0;
                }

                /* Decorative Circles */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .deco-1 {
                    width: 400px;
                    height: 400px;
                    top: -100px;
                    left: -100px;
                    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
                }

                .deco-2 {
                    width: 300px;
                    height: 300px;
                    bottom: -50px;
                    right: -50px;
                    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                }

                .deco-3 {
                    width: 150px;
                    height: 150px;
                    top: 40%;
                    right: 10%;
                    background: rgba(255,255,255,0.05);
                }

                /* RIGHT SIDE - Form Area */
                .auth-right {
                    width: 50%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-2xl);
                    background: linear-gradient(to right, transparent, #1c1917 40px);
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
                
                .auth-right::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .auth-form-container {
                    width: 100%;
                    max-width: 380px;
                }

                .mobile-logo {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    margin-bottom: var(--space-xl);
                }

                .mobile-logo-icon {
                    width: 40px;
                    height: 40px;
                    background: var(--gradient-primary);
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .mobile-logo span {
                    font-size: var(--text-xl);
                    font-weight: 700;
                    color: var(--text);
                }

                .form-header {
                    margin-bottom: var(--space-xl);
                }

                .form-header h2 {
                    font-size: var(--text-2xl);
                    font-weight: 700;
                    color: var(--text);
                    margin: 0 0 var(--space-xs);
                }

                .form-header p {
                    color: var(--text-muted);
                    margin: 0;
                    font-size: var(--text-sm);
                }

                .error-box {
                    padding: var(--space-md);
                    background: rgba(244, 63, 94, 0.1);
                    border: 1px solid rgba(244, 63, 94, 0.2);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--space-lg);
                    color: var(--error-500);
                    font-size: var(--text-sm);
                    text-align: center;
                }

                .form-fields {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-lg);
                }

                .submit-btn {
                    width: 100%;
                    height: 48px;
                    margin-top: var(--space-md);
                    background: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%) !important;
                    border: none !important;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                }

                .submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5) !important;
                }

                .register-link {
                    text-align: center;
                    margin-top: var(--space-xl);
                    padding-top: var(--space-lg);
                    border-top: 1px solid var(--border);
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
                    background: rgba(16, 185, 129, 0.15); /* Green liquid */
                    border-radius: 42%;
                }

                .liquid-wave-2 {
                    background: rgba(16, 185, 129, 0.1);
                    border-radius: 38%;
                    animation: liquid-spin 15s linear infinite reverse;
                }

                .liquid-wave-3 {
                    background: rgba(16, 185, 129, 0.05);
                    border-radius: 45%;
                    animation: liquid-spin 12s linear infinite;
                }

                @keyframes liquid-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .auth-page {
                        flex-direction: column;
                        overflow: hidden;
                        height: 100dvh;
                    }

                    .auth-left {
                        display: none;
                    }

                    .auth-right {
                        flex: 1;
                        width: 100%;
                        height: 100dvh;
                        padding: var(--space-md);
                        background: #1c1917;
                        overflow: hidden !important;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    
                    .auth-right::-webkit-scrollbar {
                        display: none;
                    }

                    .auth-form-container {
                        width: 100%;
                        max-width: 400px;
                        margin: 0 auto;
                    }

                    .mobile-logo {
                        display: flex;
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: var(--space-lg);
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
