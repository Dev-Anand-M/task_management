import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import { Mail, Lock, Zap, ArrowRight, Target, Award, TrendingUp, Users } from 'lucide-react';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        console.log('Login attempt started...');
        
        try {
            const result = await login(email, password);
            console.log('Login result:', result);

            if (result.success) {
                console.log('Login successful, waiting for redirect...');
                // Navigation will be handled by AuthRoute redirect
                // No need to manually navigate
            } else {
                console.error('Login failed:', result.error);
                setError(result.error || 'Invalid credentials');
                setLoading(false);
            }
        } catch (err) {
            console.error('Login exception:', err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
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

                    {/* Login Form */}
                    <form onSubmit={handleSubmit}>
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

                            <Input
                                type="password"
                                label="Password"
                                placeholder="Enter your password"
                                icon={Lock}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <Button
                                type="submit"
                                className="submit-btn"
                                loading={loading}
                            >
                                <span>Sign In</span>
                                <ArrowRight size={18} />
                            </Button>
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

                /* Responsive */
                @media (max-width: 1024px) {
                    .auth-page {
                        flex-direction: column;
                    }

                    .auth-left {
                        display: none;
                    }

                    .auth-right {
                        flex: 1;
                        width: 100%;
                        min-height: 100vh;
                        border-radius: 0;
                    }

                    .mobile-logo {
                        display: flex;
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
