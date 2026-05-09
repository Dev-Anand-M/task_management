import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import { Mail, Lock, User, Zap, Key, ArrowRight, Shield, Rocket, Star, CheckCircle } from 'lucide-react';
import * as inviteCodes from '../../services/inviteCodes';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [validationStatus, setValidationStatus] = useState(null); // 'valid', 'invalid', or null

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            setInviteCode(code);
            validateCode(code);
        }
    }, []);

    const validateCode = async (code) => {
        if (!code || code.length < 6) return;
        const valid = await inviteCodes.validateInviteCode(code);
        setValidationStatus(valid ? 'valid' : 'invalid');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Validate invite code (double check before submit)
        if (validationStatus === 'invalid') {
            setError('Please enter a valid invite code');
            return;
        }

        const codeData = await inviteCodes.validateInviteCode(inviteCode.toUpperCase());
        if (!codeData) {
            setError('Invalid or already used invite code');
            setValidationStatus('invalid');
            return;
        }

        setLoading(true);

        const result = await register(name, email, password, codeData.classroom_id);

        if (result.success) {
            // Mark invite code as used
            await inviteCodes.useInviteCode(inviteCode.toUpperCase(), result.user.id);
            // Manual navigation as a fallback
            console.log('Registration success, manual redirect to dashboard');
            navigate('/dashboard', { replace: true });
        } else {
            setError(result.error || 'Registration failed');
            setLoading(false);
        }
    };

    const benefits = [
        { icon: Rocket, text: 'Access exclusive learning content' },
        { icon: Star, text: 'Earn XP and unlock achievements' },
        { icon: Shield, text: 'Join a verified community' },
        { icon: CheckCircle, text: 'Track your skill progress' }
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
                    <h1 className="brand-title">Join Zenith</h1>
                    <p className="brand-tagline">
                        Begin your journey to mastery with our exclusive community
                    </p>

                    {/* Benefits List */}
                    <div className="benefits-list">
                        {benefits.map((benefit, i) => (
                            <div key={i} className="benefit-item" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className="benefit-icon">
                                    <benefit.icon size={18} />
                                </div>
                                <span>{benefit.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Invite Note */}
                    <div className="invite-note">
                        <Key size={16} />
                        <span>Invite code required for registration</span>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="deco-circle deco-1"></div>
                <div className="deco-circle deco-2"></div>
            </div>

            {/* Right Side - Register Form */}
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
                        <h2>Create Account</h2>
                        <p>Start your skill enhancement journey</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-box">
                            {error}
                        </div>
                    )}

                    {/* Register Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="form-fields">
                            <Input
                                type="text"
                                label="Full Name"
                                placeholder="Enter your name"
                                icon={User}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />

                            <Input
                                type="email"
                                label="Email"
                                placeholder="Enter your email"
                                icon={Mail}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <div className="password-row">
                                <Input
                                    type="password"
                                    label="Password"
                                    placeholder="Create password"
                                    icon={Lock}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />

                                <Input
                                    type="password"
                                    label="Confirm"
                                    placeholder="Confirm password"
                                    icon={Lock}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Input
                                type="text"
                                label="Invite Code"
                                placeholder="Enter your invite code"
                                icon={Key}
                                value={inviteCode}
                                onChange={async (e) => {
                                    const code = e.target.value.toUpperCase();
                                    setInviteCode(code);
                                    setValidationStatus(null);
                                    if (code.length >= 6) {
                                        validateCode(code);
                                    }
                                }}
                                required
                                style={{
                                    borderColor: validationStatus === 'valid' ? 'var(--success-500)' :
                                        validationStatus === 'invalid' ? 'var(--error-500)' : undefined
                                }}
                            />
                            {validationStatus === 'valid' && (
                                <p style={{ color: 'var(--success-500)', fontSize: '0.8rem', marginTop: '-0.5rem' }}>
                                    All clear! Join the classroom.
                                </p>
                            )}
                            {validationStatus === 'invalid' && (
                                <p style={{ color: 'var(--error-500)', fontSize: '0.8rem', marginTop: '-0.5rem' }}>
                                    Invalid or used invite code
                                </p>
                            )}

                            <Button
                                type="submit"
                                className="submit-btn"
                                loading={loading}
                            >
                                <span>Create Account</span>
                                <ArrowRight size={18} />
                            </Button>
                        </div>
                    </form>

                    {/* Login Link */}
                    <div className="login-link">
                        <p>
                            Already have an account?{' '}
                            <Link to="/login">Sign in</Link>
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
                    background: linear-gradient(135deg, #be123c 0%, #e11d48 30%, #f43f5e 60%, #fb7185 100%);
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
                    max-width: 420px;
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
                    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
                }

                .brand-title {
                    font-size: 3rem;
                    font-weight: 800;
                    margin: 0 0 var(--space-md);
                    letter-spacing: -0.03em;
                    text-shadow: 0 4px 30px rgba(0,0,0,0.15);
                }

                .brand-tagline {
                    font-size: 1.1rem;
                    color: rgba(255,255,255,0.9);
                    line-height: 1.6;
                    margin: 0 0 var(--space-2xl);
                }

                .benefits-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-md);
                    text-align: left;
                    margin-bottom: var(--space-xl);
                }

                .benefit-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-md);
                    padding: var(--space-sm) 0;
                    animation: fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                }

                .benefit-icon {
                    width: 36px;
                    height: 36px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .invite-note {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    padding: var(--space-md);
                    background: rgba(255,255,255,0.15);
                    backdrop-filter: blur(8px);
                    border-radius: var(--radius-xl);
                    font-size: 0.875rem;
                    font-weight: 600;
                }

                /* Decorative Circles */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(60px);
                }

                .deco-1 { width: 350px; height: 350px; top: -80px; right: -80px; background: rgba(251, 113, 133, 0.2); }
                .deco-2 { width: 250px; height: 250px; bottom: -50px; left: -50px; background: rgba(244, 63, 94, 0.2); }

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
                    max-width: 440px;
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
                    background: linear-gradient(135deg, #f43f5e, #be123c);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 8px 20px rgba(244, 63, 94, 0.3);
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
                    margin-bottom: var(--space-xl);
                    text-align: left;
                }

                .form-header h2 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 0 0 var(--space-xs);
                }

                .form-header p {
                    color: var(--text-muted);
                    font-size: 1rem;
                }

                .password-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-md);
                }

                .submit-btn {
                    width: 100%;
                    height: 52px;
                    margin-top: var(--space-md);
                    background: linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%) !important;
                    border: none !important;
                    font-weight: 700;
                    font-size: 1rem;
                    box-shadow: 0 10px 30px rgba(244, 63, 94, 0.2) !important;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }

                .submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 35px rgba(244, 63, 94, 0.4) !important;
                }

                .login-link {
                    text-align: center;
                    margin-top: var(--space-2xl);
                    padding-top: var(--space-xl);
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                @keyframes fadeInLeft {
                    from { opacity: 0; transform: translateX(-30px); }
                    to { opacity: 1; transform: translateX(0); }
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
                        padding-top: 8vh;
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
                        background: rgba(244, 63, 94, 0.4); /* Rose glow */
                    }

                    .mobile-deco-2 {
                        width: 250px;
                        height: 250px;
                        bottom: 10%;
                        left: -50px;
                        background: rgba(190, 18, 60, 0.4); /* Darker rose glow */
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

                    .password-row {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: var(--space-md);
                        padding-top: 5vh;
                    }
                    .auth-form-container {
                        padding: var(--space-xl);
                        border-radius: 24px;
                    }
                }

                /* Theme Colors */
                html[data-theme="light"] .auth-right { background: #f9fafb; }
                html[data-theme="light"] .auth-form-container { background: white; border-color: #e5e7eb; }
                html[data-theme="light"] .form-header h2 { color: #111827; }
                html[data-theme="light"] .mobile-logo span { background: linear-gradient(to bottom, #111827, #4b5563); -webkit-text-fill-color: transparent; -webkit-background-clip: text; }
                
                .form-header h2 { color: #fafaf9; }
                .form-header p { color: #a8a29e; }

                /* Override Input Focus for Register Page */
                .auth-right .input:focus {
                    border-color: #f43f5e !important;
                    box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2) !important;
                }
            `}</style>
        </div>
    );
};

export default Register;
