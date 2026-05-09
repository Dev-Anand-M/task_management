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
                    background: 
                        linear-gradient(135deg, rgba(255,255,255,0.08) 25%, transparent 25%),
                        linear-gradient(225deg, rgba(255,255,255,0.08) 25%, transparent 25%),
                        linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
                        linear-gradient(315deg, rgba(255,255,255,0.05) 25%, transparent 25%),
                        linear-gradient(to right, #be123c 0%, #e11d48 15%, #f43f5e 35%, #fb7185 40%, #1c1917 60%, #1c1917 100%) !important;
                    background-size: 10px 10px, 10px 10px, 10px 10px, 10px 10px, 100% 100%;
                }

                .auth-page {
                    display: flex;
                    flex-direction: row;
                    height: 100vh;
                    width: 100%;
                    overflow: hidden;
                }

                /* LEFT SIDE - Rose/Red Brand Area */
                .auth-left {
                    width: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-3xl);
                    background: linear-gradient(135deg, #be123c 0%, #e11d48 30%, #f43f5e 60%, #fb7185 100%);
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
                    max-width: 420px;
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
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                }

                .brand-title {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin: 0 0 var(--space-md);
                    letter-spacing: -0.03em;
                    text-shadow: 0 2px 20px rgba(0,0,0,0.15);
                    color: white;
                }

                .brand-tagline {
                    font-size: 1rem;
                    color: rgba(255,255,255,0.95);
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
                    animation: fadeInLeft 0.5s ease forwards;
                    opacity: 0;
                }

                .benefit-icon {
                    width: 36px;
                    height: 36px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .benefit-item span {
                    font-size: 0.95rem;
                    font-weight: 500;
                }

                .invite-note {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                    padding: var(--space-md);
                    background: rgba(255,255,255,0.15);
                    border-radius: var(--radius-lg);
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                /* Decorative Circles */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.15);
                }

                .deco-1 {
                    width: 350px;
                    height: 350px;
                    top: -80px;
                    right: -80px;
                    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
                }

                .deco-2 {
                    width: 250px;
                    height: 250px;
                    bottom: -50px;
                    left: -50px;
                    background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
                }

                /* RIGHT SIDE - Form Area */
                .auth-right {
                    width: 50%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-xl);
                    background: linear-gradient(to right, transparent, #1c1917 40px);
                    overflow-y: auto;
                    position: relative;
                    border-radius: 0 40px 40px 0;
                    z-index: 10;
                }

                /* Custom Scrollbar */
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
                    max-width: 420px;
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
                    margin-bottom: var(--space-lg);
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
                    gap: var(--space-md);
                }

                .password-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-md);
                }

                .submit-btn {
                    width: 100%;
                    height: 48px;
                    margin-top: var(--space-sm);
                    background: linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%) !important;
                    border: none !important;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-sm);
                }

                .submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(244, 63, 94, 0.5) !important;
                }

                .login-link {
                    text-align: center;
                    margin-top: var(--space-lg);
                    padding-top: var(--space-lg);
                    border-top: 1px solid var(--border);
                }

                .login-link p {
                    color: var(--text-muted);
                    font-size: var(--text-sm);
                    margin: 0;
                }

                .login-link a {
                    color: #f43f5e;
                    font-weight: 600;
                    text-decoration: none;
                }

                .login-link a:hover {
                    color: #fb7185;
                }

                @keyframes fadeInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
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
                    background: rgba(244, 63, 94, 0.15); /* Red liquid */
                    border-radius: 42%;
                }

                .liquid-wave-2 {
                    background: rgba(244, 63, 94, 0.1);
                    border-radius: 38%;
                    animation: liquid-spin 15s linear infinite reverse;
                }

                .liquid-wave-3 {
                    background: rgba(244, 63, 94, 0.05);
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
                        height: 100vh;
                    }

                    .auth-left {
                        display: none;
                    }

                    .auth-right {
                        flex: 1;
                        width: 100%;
                        height: 100vh;
                        padding: var(--space-md); /* Very reduced padding */
                        background: #1c1917;
                        overflow: hidden !important; /* Force hide overflow */
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        scrollbar-width: none; /* Firefox */
                        -ms-overflow-style: none; /* IE/Edge */
                    }
                    
                    .auth-right::-webkit-scrollbar {
                        display: none; /* Chrome/Safari/Webkit */
                    }

                    .auth-form-container {
                        width: 100%;
                        max-width: 420px;
                        margin: 0 auto;
                        transform: translateY(-5px);
                    }

                    .mobile-logo {
                        display: flex;
                        margin-bottom: var(--space-md); /* Reduced margin */
                    }
                    
                    .mobile-logo-icon {
                        width: 28px; /* Reduced size */
                        height: 28px;
                    }

                    .form-header {
                        margin-bottom: var(--space-md); /* Reduced margin */
                    }
                    
                    .form-header h2 {
                        font-size: 1.25rem; /* Shrunk title */
                    }

                    .form-fields {
                        gap: var(--space-sm); /* Tight gaps */
                    }
                    
                    .form-fields input {
                        height: 40px; /* Reduced input height */
                        padding: 0 var(--space-md);
                    }

                    .register-link {
                        margin-top: var(--space-md); /* Reduced margin */
                        padding-top: var(--space-sm);
                    }
                    
                    .password-row {
                        grid-template-columns: 1fr;
                        gap: var(--space-sm);
                    }
                    
                    .submit-btn {
                        height: 40px; /* Reduced button height */
                        margin-top: var(--space-sm);
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: var(--space-lg);
                    }
                }

                /* Light mode */
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

                .login-link p {
                    color: #a8a29e;
                }

                /* Override Input Focus for Register Page to be Red/Pink */
                .auth-right .input:focus {
                    border-color: #f43f5e !important;
                    box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2) !important;
                }
            `}</style>
        </div>
    );
};

export default Register;
