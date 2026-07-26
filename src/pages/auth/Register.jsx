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
            navigate('/dashboard', { replace: true });
        } else {
            setError(result.error || 'Registration failed');
            setLoading(false);
        }
    };

    const benefits = [
        { icon: Key, text: 'Invite code required for verification' },
        { icon: Shield, text: 'Private team & classroom channels' },
        { icon: Rocket, text: 'Structured tasks, routines & XP milestones' },
        { icon: CheckCircle, text: 'Encrypted communication & workspace tools' }
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
                    <h1 className="brand-title">Join Room</h1>
                    <p className="brand-tagline">
                        Exclusive invite-only workspace for high-performance productivity
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
                            <img src="/zenith.png" alt="Zenith" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        </div>
                        <span><span style={{ color: '#f43f5e' }}>Zenith</span> OS</span>
                    </div>

                    {/* Header */}
                    <div className="form-header">
                        <h2>Create <span style={{ background: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zenith</span> Account</h2>
                        <p>Enter your details & invite code to access your workspace</p>
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
                                    placeholder="Password"
                                    icon={Lock}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />

                                <Input
                                    type="password"
                                    label="Confirm"
                                    placeholder="Confirm"
                                    icon={Lock}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Input
                                type="text"
                                label="Invite Code"
                                placeholder="Enter invite code"
                                icon={Key}
                                value={inviteCode}
                                onChange={(e) => {
                                    const code = e.target.value;
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
                                <span>Join Room</span>
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
                    background: transparent !important;
                    border: none !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto var(--space-lg);
                    box-shadow: none !important;
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

                /* Decorative Circles & Mesh */
                .deco-circle {
                    position: absolute;
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    pointer-events: none;
                }

                .deco-1 {
                    width: 420px;
                    height: 420px;
                    top: -100px;
                    right: -100px;
                    background: radial-gradient(circle, rgba(244, 63, 94, 0.18) 0%, transparent 70%);
                    animation: meshPulse 10s ease-in-out infinite alternate;
                }

                .deco-2 {
                    width: 320px;
                    height: 320px;
                    bottom: -60px;
                    left: -60px;
                    background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
                    animation: meshPulse 12s ease-in-out infinite alternate-reverse;
                }

                @keyframes meshPulse {
                    0% { transform: scale(1) translate(0, 0); opacity: 0.7; }
                    100% { transform: scale(1.15) translate(20px, -20px); opacity: 1; }
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
                    background: rgba(136, 19, 55, 0.75); /* Deep dark rose */
                    border-radius: 42%;
                }

                .liquid-wave-2 {
                    background: rgba(159, 18, 57, 0.55);
                    border-radius: 38%;
                    animation: liquid-spin 15s linear infinite reverse;
                }

                .liquid-wave-3 {
                    background: rgba(112, 11, 45, 0.40);
                    border-radius: 45%;
                    animation: liquid-spin 12s linear infinite;
                }

                @keyframes liquid-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* RIGHT SIDE - Form Area */
                .auth-right {
                    width: 50%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-xl);
                    background: linear-gradient(135deg, rgba(28, 25, 23, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
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

                .auth-form-container {
                    width: 100%;
                    max-width: 440px;
                    padding: 36px 32px;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 28px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }

                .auth-form-container:hover {
                    border-color: rgba(244, 63, 94, 0.3);
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 30px rgba(244, 63, 94, 0.2);
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
                    background: linear-gradient(135deg, #ffffff 0%, #f43f5e 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }

                .form-header {
                    margin-bottom: var(--space-lg);
                    text-align: center;
                }

                .form-header h2 {
                    font-size: 1.85rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #ffffff 0%, #fb7185 100%);
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
                    gap: var(--space-md);
                }

                .password-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-md);
                }

                .submit-btn {
                    position: relative !important;
                    overflow: hidden !important;
                    width: 100%;
                    height: 52px;
                    margin-top: var(--space-sm);
                    background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%) !important;
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
                    box-shadow: 0 8px 24px rgba(244, 63, 94, 0.35), 0 0 16px rgba(255, 215, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.6) !important;
                }

                .submit-btn:hover::before {
                    transform: scaleX(1) !important;
                    opacity: 1 !important;
                }

                .submit-btn:hover::after {
                    opacity: 1 !important;
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
                        height: 100dvh;
                    }

                    .auth-left {
                        display: none;
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
                        padding: 20px 18px;
                        margin: 0 auto;
                        box-sizing: border-box;
                        border-radius: 20px;
                        background: rgba(12, 16, 28, 0.92) !important;
                        backdrop-filter: blur(20px) !important;
                        -webkit-backdrop-filter: blur(20px) !important;
                        border: 1px solid rgba(244, 63, 94, 0.2) !important;
                        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(244, 63, 94, 0.08) !important;
                    }

                    .mobile-logo {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        margin-bottom: 10px;
                    }

                    .mobile-logo-icon {
                        width: 34px;
                        height: 34px;
                    }

                    .mobile-logo span {
                        font-size: 1.1rem;
                    }

                    .form-header {
                        margin-bottom: 12px;
                        text-align: center;
                    }

                    .form-header h2 {
                        font-size: 1.35rem;
                        margin: 0 0 2px;
                    }

                    .form-header p {
                        font-size: 0.8rem;
                    }

                    .form-fields {
                        gap: 8px !important;
                    }

                    .password-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                    }

                    .submit-btn {
                        height: 44px !important;
                        margin-top: 8px !important;
                        font-size: 0.9rem !important;
                    }

                    .login-link {
                        margin-top: 10px !important;
                        padding-top: 8px !important;
                    }

                    .login-link p {
                        font-size: 0.8rem !important;
                    }
                }

                @media (max-width: 480px) {
                    .auth-right {
                        padding: 8px;
                        background: transparent !important;
                        border-radius: 20px;
                    }

                    .auth-form-container {
                        padding: 18px 14px;
                        border-radius: 18px;
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
