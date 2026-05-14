import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge } from '../components/common';
import { supabase } from '../lib/supabase';
import {
    Palette,
    Sun,
    Moon,
    Check,
    Bell,
    Shield,
    User,
    Globe,
    AlertTriangle,
    RefreshCw,
    Brain,
    Key,
    ExternalLink,
    Plus
} from 'lucide-react';

const colorSchemes = [
    {
        id: 'gold',
        name: 'Shiny Gold',
        description: 'Elegant gold and white theme',
        primary: '#f59e0b',
        gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
        colors: ['#fbbf24', '#f59e0b', '#d97706']
    },
    {
        id: 'purple',
        name: 'Royal Purple',
        description: 'Bold and vibrant purple theme',
        primary: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)',
        colors: ['#a78bfa', '#8b5cf6', '#7c3aed']
    },
    {
        id: 'blue',
        name: 'Ocean Blue',
        description: 'Professional blue theme',
        primary: '#3b82f6',
        gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
        colors: ['#60a5fa', '#3b82f6', '#2563eb']
    },
    {
        id: 'emerald',
        name: 'Emerald Green',
        description: 'Fresh and natural theme',
        primary: '#10b981',
        gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
        colors: ['#34d399', '#10b981', '#059669']
    },
    {
        id: 'rose',
        name: 'Rose Pink',
        description: 'Warm and friendly theme',
        primary: '#f43f5e',
        gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%)',
        colors: ['#fb7185', '#f43f5e', '#e11d48']
    },
    {
        id: 'orange',
        name: 'Sunset Orange',
        description: 'Energetic and bold theme',
        primary: '#f97316',
        gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)',
        colors: ['#fb923c', '#f97316', '#ea580c']
    }
];

const Settings = () => {
    const { isDark, toggleTheme, colorScheme, setColorScheme } = useTheme();
    const { user, forceRefresh } = useAuth();
    const [notifications, setNotifications] = useState({
        push: false,
        taskReminders: true,
        quizResults: true
    });
    const [saving, setSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        // Check if user reached here via reset link
        if (window.location.search.includes('reset=true')) {
            setIsResetting(true);
        }
    }, []);

    // AI Settings
    const [selectedProvider, setSelectedProvider] = useState('sambanova');
    const [aiApiKey, setAiApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [aiKeyStatus, setAiKeyStatus] = useState('unconfigured'); // 'unconfigured', 'configured', 'testing', 'invalid'
    const [selectedModel, setSelectedModel] = useState('');
    const [usageStats, setUsageStats] = useState({ requestsToday: 0, totalRequests: 0, lastDate: '' });
    const [loadingAISettings, setLoadingAISettings] = useState(true);
    const [validationMessage, setValidationMessage] = useState({ type: '', text: '' }); // type: 'success', 'error', 'warning'
    const [availableModels, setAvailableModels] = useState([]); // Dynamic models from API
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [swStatus, setSwStatus] = useState('Checking...');
    const [subCount, setSubCount] = useState(0);

    // Check SW and Subscriptions status
    useEffect(() => {
        const checkStatus = async () => {
            if ('serviceWorker' in navigator) {
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    setSwStatus(regs.length > 0 ? `Active (${regs.length})` : 'Not Found');
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.getSubscription();
                    setSubCount(sub ? 1 : 0);
                } catch (e) { setSwStatus('Error'); }
            } else { setSwStatus('Unsupported'); }
        };
        checkStatus();
    }, [notifications.push]);

    // Load AI settings when provider changes or on mount
    useEffect(() => {
        const loadAISettings = async () => {
            setLoadingAISettings(true);
            try {
                const {
                    loadFromDatabase,
                    getAPIKey,
                    isAPIKeyConfigured,
                    validateAPIKey,
                    getSelectedModel,
                    getUsageStats
                } = await import('../services/aiService');

                // Load from DB first
                await loadFromDatabase();

                // Get Key for current provider
                const key = getAPIKey(selectedProvider);
                setAiApiKey(key);
                setAiKeyStatus(isAPIKeyConfigured(selectedProvider) ? 'configured' : 'unconfigured');
                setValidationMessage({ type: '', text: '' });

                if (key) {
                    // Start validating
                    setAiKeyStatus('testing');
                    const validation = await validateAPIKey(selectedProvider, key);

                    if (validation.valid) {
                        setAiKeyStatus('configured');
                        setAvailableModels(validation.models || []);

                        // If no valid model is selected for this provider, try to select one
                        const savedModel = getSelectedModel();
                        if (!savedModel || (validation.models && !validation.models.find(m => m.id === savedModel))) {
                            if (validation.models && validation.models.length > 0) {
                                const { setSelectedModel: saveModelToService } = await import('../services/aiService');
                                await saveModelToService(validation.models[0].id);
                                setSelectedModel(validation.models[0].id);
                            }
                        }

                    } else {
                        setAiKeyStatus('invalid');
                        setValidationMessage({ type: 'error', text: validation.error });
                        setAvailableModels([]);
                    }
                } else {
                    setAvailableModels([]);
                }

                // Load saved model and usage
                const savedModel = getSelectedModel();
                if (savedModel) setSelectedModel(savedModel);

                const stats = getUsageStats();
                setUsageStats(stats);

                setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);
                
                const handleBeforeInstall = (e) => {
                    e.preventDefault();
                    setDeferredPrompt(e);
                };
                
                window.addEventListener('beforeinstallprompt', handleBeforeInstall);
                return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            } catch (err) {
                console.error('PWA Setup Error:', err);
            } finally {
                setLoadingAISettings(false);
            }
        };

        loadAISettings();
    }, [selectedProvider, user?.id]);

    // Initial load from profile
    useEffect(() => {
        if (user) {
            setNotifications(prev => {
                const dbNotifications = user.preferences?.notifications || {};
                const hasToken = !!user.preferences?.onesignal_id || !!user.preferences?.fcm_token;
                return {
                    ...prev,
                    ...dbNotifications,
                    // Only use db state for push if we haven't manually toggled it yet
                    // or if the user object just loaded for the first time
                    push: dbNotifications.push !== undefined ? dbNotifications.push : hasToken
                };
            });
        }
    }, [user?.id]); // Only run when user ID changes (mount/auth change)

    const syncNotificationsToDb = async (newNotifications) => {
        if (!user) return;
        setSaving(true);
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('preferences')
                .eq('id', user.id)
                .single();

            const currentPrefs = profile?.preferences || {};
            const newPrefs = {
                ...currentPrefs,
                notifications: newNotifications
            };

            await supabase
                .from('profiles')
                .update({ preferences: newPrefs })
                .eq('id', user.id);

        } catch (err) {
            console.error('Failed to sync notification settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNotificationChange = (key, value) => {
        const newNotifications = { ...notifications, [key]: value };
        setNotifications(newNotifications);
        syncNotificationsToDb(newNotifications);
    };

    const handleColorSchemeChange = (schemeId) => {
        setColorScheme(schemeId);
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            alert('Password updated successfully!');
            setNewPassword('');
            setConfirmPassword('');
            setIsResetting(false);
        } catch (err) {
            console.error('Error updating password:', err);
            alert(err.message || 'Failed to update password');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveApiKey = async () => {
        if (!aiApiKey.trim()) return;

        setValidationMessage({ type: '', text: '' });
        setAiKeyStatus('testing');
        setAvailableModels([]);

        try {
            const { validateAPIKey, saveAPIKey } = await import('../services/aiService');
            const result = await validateAPIKey(selectedProvider, aiApiKey.trim());

            if (!result.valid) {
                setAiKeyStatus('invalid');
                setValidationMessage({ type: 'error', text: result.error });
                return;
            }

            // Save via service
            await saveAPIKey(selectedProvider, aiApiKey.trim());
            setAiKeyStatus('configured');
            setAvailableModels(result.models || []);

            if (result.models && result.models.length > 0 && !selectedModel) {
                const { setSelectedModel: saveModelToService } = await import('../services/aiService');
                const firstModel = result.models[0].id;
                await saveModelToService(firstModel);
                setSelectedModel(firstModel);
            }

            setValidationMessage({
                type: 'success',
                text: `${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API key validated and saved!`
            });
        } catch (e) {
            console.error('Failed to validate/save API key:', e);
            setAiKeyStatus('invalid');
            setValidationMessage({ type: 'error', text: 'Failed to save API key: ' + e.message });
        }
    };

    const handleRemoveApiKey = async () => {
        if (confirm('Are you sure you want to remove this API key?')) {
            try {
                const { removeAPIKey } = await import('../services/aiService');
                await removeAPIKey(selectedProvider);
                setAiApiKey('');
                setAiKeyStatus('unconfigured');
                setAvailableModels([]);
            } catch (e) {
                console.error('Failed to remove API key:', e);
            }
        }
    };

    const handleModelChange = async (modelId) => {
        setSelectedModel(modelId);
        try {
            const { setSelectedModel: saveModelToService } = await import('../services/aiService');
            await saveModelToService(modelId);
        } catch (e) {
            console.error('Failed to sync model change:', e);
        }
    };

    return (
        <div className="page-content">
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    Settings
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Customize your Zenith experience
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                {/* Appearance Settings */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Palette size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Appearance</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                Customize how Zenith looks
                            </p>
                        </div>
                    </div>

                    {/* Theme Toggle */}
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            THEME MODE
                        </h4>
                        <div className="flex-mobile-col" style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <button
                                onClick={() => isDark && toggleTheme()}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-lg)',
                                    background: !isDark ? 'var(--primary-100)' : 'var(--card)',
                                    border: !isDark ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <Sun size={24} style={{ color: !isDark ? 'var(--primary-600)' : 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 600, color: !isDark ? 'var(--primary-600)' : 'var(--text)' }}>Light</span>
                                {!isDark && <Check size={16} style={{ color: 'var(--primary-600)' }} />}
                            </button>
                            <button
                                onClick={() => !isDark && toggleTheme()}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-lg)',
                                    background: isDark ? 'var(--primary-100)' : 'var(--card)',
                                    border: isDark ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <Moon size={24} style={{ color: isDark ? 'var(--primary-600)' : 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 600, color: isDark ? 'var(--primary-600)' : 'var(--text)' }}>Dark</span>
                                {isDark && <Check size={16} style={{ color: 'var(--primary-600)' }} />}
                            </button>
                        </div>
                    </div>

                    {/* Color Scheme */}
                    <div>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            COLOR SCHEME
                        </h4>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: 'var(--space-md)'
                        }}>
                            {colorSchemes.map((scheme) => (
                                <button
                                    key={scheme.id}
                                    onClick={() => handleColorSchemeChange(scheme.id)}
                                    style={{
                                        padding: 'var(--space-md)',
                                        background: colorScheme === scheme.id ? 'var(--primary-50)' : 'var(--card)',
                                        border: colorScheme === scheme.id ? `2px solid ${scheme.primary}` : '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all var(--transition-fast)',
                                        position: 'relative'
                                    }}
                                >
                                    {colorScheme === scheme.id && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            width: '20px',
                                            height: '20px',
                                            background: scheme.primary,
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Check size={12} color="white" />
                                        </div>
                                    )}
                                    <div style={{
                                        width: '100%',
                                        height: '40px',
                                        background: scheme.gradient,
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 'var(--space-sm)'
                                    }} />
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-sm)' }}>
                                        {scheme.colors.map((color, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    background: color,
                                                    borderRadius: '4px'
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <h5 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>
                                        {scheme.name}
                                    </h5>
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {scheme.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Notification Settings */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--gradient-accent)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Bell size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Notifications</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                Manage your notification preferences
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {Notification.permission === 'denied' && (
                            <div style={{ 
                                padding: 'var(--space-sm) var(--space-md)', 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                border: '1px solid var(--error)', 
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                color: 'var(--error)'
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                                    <strong>Permissions Blocked:</strong> Your browser has blocked notifications for this site. 
                                    Click the <strong>tune/lock icon</strong> next to the URL to "Allow" them.
                                </p>
                            </div>
                        )}
                        {[
                            { key: 'push', label: 'Push Notifications', desc: 'Native device/browser notifications' },
                            { key: 'taskReminders', label: 'Task Reminders', desc: 'Get reminded about pending tasks' },
                            { key: 'quizResults', label: 'Quiz Results', desc: 'Notify when quiz is evaluated' }
                        ]
                        .filter(() => true)
                        .map((item) => (
                            <div
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-md)',
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                <div>
                                    <p style={{ margin: 0, fontWeight: 500 }}>{item.label}</p>
                                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        {item.desc}
                                    </p>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                                    <input
                                        type="checkbox"
                                        checked={notifications[item.key]}
                                        onChange={async (e) => {
                                            const isChecked = e.target.checked;
                                            
                                            if (item.key === 'push') {
                                                 try {
                                                     const { requestPushPermission, unsubscribePush } = await import('../lib/nativePush');
                                                     if (isChecked) {
                                                         console.log('[Settings] Requesting push permission...');
                                                         const subscription = await requestPushPermission();
                                                         
                                                         if (subscription) {
                                                             console.log('[Settings] Got subscription:', subscription.endpoint);
                                                             
                                                             // Save subscription to database
                                                             const { error } = await supabase.from('profiles').update({
                                                                 push_subscription: subscription.toJSON(),
                                                                 preferences: { 
                                                                     ...user.preferences, 
                                                                     notifications: { ...notifications, push: true } 
                                                                 }
                                                             }).eq('id', user.id);
                                                             
                                                             if (error) {
                                                                 console.error('[Settings] Failed to save subscription:', error);
                                                                 alert('Failed to save push subscription. Please try again.');
                                                                 setNotifications(prev => ({ ...prev, push: false }));
                                                                 return;
                                                             }
                                                             
                                                             console.log('[Settings] Successfully enabled push notifications');
                                                             setNotifications(prev => ({ ...prev, push: true }));
                                                             await forceRefresh();
                                                         } else {
                                                             console.error('[Settings] Failed to get subscription');
                                                             alert('Could not enable notifications. Please check:\n\n1. You clicked "Allow" on the permission prompt\n2. Ad-blockers are disabled\n3. Browser supports notifications');
                                                             setNotifications(prev => ({ ...prev, push: false }));
                                                         }
                                                     } else {
                                                         console.log('[Settings] Disabling push notifications...');
                                                         await unsubscribePush();
                                                         
                                                         const { error } = await supabase.from('profiles').update({
                                                             push_subscription: null,
                                                             preferences: { 
                                                                 ...user.preferences, 
                                                                 notifications: { ...notifications, push: false } 
                                                             }
                                                         }).eq('id', user.id);
                                                         
                                                         if (error) {
                                                             console.error('[Settings] Failed to update database:', error);
                                                         }
                                                         
                                                         console.log('[Settings] Successfully disabled push notifications');
                                                         setNotifications(prev => ({ ...prev, push: false }));
                                                         await forceRefresh();
                                                     }
                                                 } catch (err) {
                                                     console.error("[Settings] Push toggle error:", err);
                                                     alert(`Error: ${err.message}`);
                                                     setNotifications(prev => ({ ...prev, push: false }));
                                                 }
                                            } else {
                                                handleNotificationChange(item.key, isChecked);
                                            }
                                        }}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: notifications[item.key] ? 'var(--primary-500)' : 'var(--border)',
                                        transition: 'all var(--transition-fast)',
                                        borderRadius: '24px'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: notifications[item.key] ? '26px' : '3px',
                                            bottom: '3px',
                                            background: 'white',
                                            transition: 'all var(--transition-fast)',
                                            borderRadius: '50%'
                                        }} />
                                    </span>
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* PWA Install Prompt */}
                    {!isInstalled && (deferredPrompt || /iPhone|iPad|iPod/.test(navigator.userAgent)) && (
                        <div style={{
                            marginTop: 'var(--space-lg)',
                            padding: 'var(--space-lg)',
                            background: 'rgba(99, 102, 241, 0.05)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px dashed var(--primary-300)',
                            textAlign: 'center'
                        }}>
                            <h4 style={{ marginBottom: '8px' }}>📱 Install Zenith Mobile</h4>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                                Install Zenith as an app for much more reliable push notifications and background updates.
                            </p>
                            
                            {deferredPrompt ? (
                                <Button 
                                    icon={Plus} 
                                    onClick={async () => {
                                        deferredPrompt.prompt();
                                        const { outcome } = await deferredPrompt.userChoice;
                                        if (outcome === 'accepted') {
                                            setDeferredPrompt(null);
                                            setIsInstalled(true);
                                        }
                                    }}
                                >
                                    Install Zenith App
                                </Button>
                            ) : (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    To install: Tap <strong style={{ color: 'var(--primary-400)' }}>Share</strong> then <strong style={{ color: 'var(--primary-400)' }}>Add to Home Screen</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Troubleshooting & Status section */}
                    <div style={{ 
                        marginTop: 'var(--space-lg)', 
                        padding: 'var(--space-md)',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                            <h4 style={{ fontSize: 'var(--text-sm)', margin: 0, color: 'var(--text-muted)' }}>SYSTEM STATUS</h4>
                            <Badge variant={('serviceWorker' in navigator) ? 'success' : 'error'}>
                                {('serviceWorker' in navigator) ? 'PWA Supported' : 'No PWA Support'}
                            </Badge>
                        </div>
                        
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Service Worker:</span>
                                <span style={{ color: swStatus.includes('Active') ? 'var(--success-600)' : 'var(--error)' }}>{swStatus}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Browser Subscription:</span>
                                <span style={{ color: subCount > 0 ? 'var(--success-600)' : 'var(--text-muted)' }}>{subCount > 0 ? 'Registered' : 'Not Found'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Cloud Database:</span>
                                <span>{user.preferences?.push_subscriptions?.length || 0} device(s)</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                style={{ flex: 1, color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', fontSize: '11px' }}
                                onClick={async () => {
                                    if (!window.confirm("This will force recreate your push subscription with the latest VAPID keys. Continue?")) {
                                        return;
                                    }
                                    
                                    try {
                                        // 1. Unsubscribe from browser
                                        const { unsubscribePush } = await import('../lib/nativePush');
                                        await unsubscribePush();
                                        
                                        // 2. Clear database subscription
                                        await supabase.from('profiles').update({
                                            push_subscription: null,
                                            preferences: { 
                                                ...user.preferences, 
                                                notifications: { ...notifications, push: false } 
                                            }
                                        }).eq('id', user.id);
                                        
                                        // 3. Wait a moment
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                        
                                        // 4. Create new subscription
                                        const { requestPushPermission } = await import('../lib/nativePush');
                                        const subscription = await requestPushPermission();
                                        
                                        if (subscription) {
                                            await supabase.from('profiles').update({
                                                push_subscription: subscription.toJSON(),
                                                preferences: { 
                                                    ...user.preferences, 
                                                    notifications: { ...notifications, push: true } 
                                                }
                                            }).eq('id', user.id);
                                            
                                            setNotifications(prev => ({ ...prev, push: true }));
                                            await forceRefresh();
                                            alert('✅ Push subscription recreated successfully!\n\nTry the Test Alert button now.');
                                        } else {
                                            alert('❌ Failed to create new subscription');
                                        }
                                    } catch (error) {
                                        console.error('[ForceRecreate] Error:', error);
                                        alert('Error: ' + error.message);
                                    }
                                }}
                            >
                                Force Recreate Push
                            </Button>
                            
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '11px' }}
                                onClick={async () => {
                                    if (window.confirm("This will clear all background services and refresh the app. Continue?")) {
                                        if ('serviceWorker' in navigator) {
                                            const regs = await navigator.serviceWorker.getRegistrations();
                                            for (let reg of regs) {
                                                await reg.unregister();
                                            }
                                        }
                                        localStorage.clear();
                                        sessionStorage.clear();
                                        window.location.reload();
                                    }
                                }}
                            >
                                Reset System
                            </Button>
                            
                            {notifications.push && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    style={{ flex: 1, fontSize: '11px' }}
                                    onClick={async () => {
                                        try {
                                            // Get user's push subscription from database
                                            const { data: profile } = await supabase
                                                .from('profiles')
                                                .select('push_subscription')
                                                .eq('id', user.id)
                                                .single();
                                            
                                            if (!profile?.push_subscription) {
                                                alert("⚠️ No push subscription found.\n\nTry toggling Push Notifications OFF and ON again.");
                                                return;
                                            }
                                            
                                            console.log("[TestPush] Sending to subscription:", profile.push_subscription.endpoint);
                                            
                                            const res = await fetch(`${window.location.origin}/api/native-push`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    subscription: profile.push_subscription,
                                                    title: 'Native Push Test 🔔',
                                                    body: 'If you see this, background notifications are working perfectly!',
                                                    url: '/settings'
                                                })
                                            });
                                            
                                            const data = await res.json();
                                            console.log("[TestPush] Response:", data);
                                            
                                            if (data.success) {
                                                alert(`✅ Test notification sent!\n\nCheck your device for the notification.\n\nNote: Close the app to test background notifications.`);
                                            } else if (data.expired) {
                                                alert(`⚠️ Push subscription expired.\n\nPlease toggle Push Notifications OFF and ON again.`);
                                            } else {
                                                alert("❌ Failed: " + (data.error || 'Unknown error'));
                                            }
                                        } catch (error) {
                                            console.error("[TestPush] Error:", error);
                                            alert("Error sending test: " + error.message);
                                        }
                                    }}
                                >
                                    Test Alert
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Account Info */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{

                            width: '40px',
                            height: '40px',
                            background: 'var(--gradient-secondary)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>About</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                App information
                            </p>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: 'var(--space-md)'
                    }}>
                        <div style={{ padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Version</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>1.0.0</p>
                        </div>
                        <div style={{ padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Build</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>2024.02.01</p>
                        </div>
                        <div style={{ padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Theme</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{colorSchemes.find(s => s.id === colorScheme)?.name || 'Shiny Gold'}</p>
                        </div>
                    </div>
                </Card>
                {/* Data Management */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--error-500)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Data Management</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                Manage your account data
                            </p>
                        </div>
                    </div>

                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        <h4 style={{ margin: '0 0 var(--space-sm)', color: 'var(--error-500)', fontSize: 'var(--text-base)' }}>
                            Refresh User Data
                        </h4>
                        <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            If you are experiencing issues with data synchronization or missing updates, force a refresh of your profile data.
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => {
                                forceRefresh();
                                alert('User data refreshed successfully!');
                            }}
                            icon={RefreshCw}
                            style={{
                                background: 'white',
                                color: 'var(--error-600)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            Force Refresh Data
                        </Button>
                    </div>
                </Card>

                {/* Security Settings */}
                <Card id="security-settings" style={{ 
                    border: isResetting ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                    boxShadow: isResetting ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Security</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                {isResetting ? 'Complete your password reset' : 'Manage your account security'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        <div className="grid-2-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    NEW PASSWORD
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    required
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    CONFIRM NEW PASSWORD
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={saving}
                            style={{ alignSelf: 'flex-start' }}
                        >
                            {saving ? 'Updating...' : 'Update Password'}
                        </Button>
                    </form>
                </Card>

                {/* AI Settings */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Brain size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>AI Settings</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                Configure AI-powered features
                            </p>
                        </div>
                    </div>

                    {/* Provider Tabs */}
                    <div className="tabs-scrollable" style={{
                        display: 'flex',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        {['gemini', 'openai', 'anthropic', 'perplexity', 'sambanova', 'groq'].map(pid => {
                            const pName = {
                                gemini: 'Google Gemini',
                                openai: 'OpenAI',
                                anthropic: 'Anthropic',
                                perplexity: 'Perplexity',
                                sambanova: 'SambaNova',
                                groq: 'Groq'
                            }[pid];
                            return (
                                <button
                                    key={pid}
                                    onClick={async () => {
                                        const { getAPIKey, isAPIKeyConfigured, validateAPIKey } = await import('../services/aiService');
                                        setSelectedProvider(pid);
                                        const key = getAPIKey(pid);
                                        setAiApiKey(key);
                                        setAiKeyStatus(isAPIKeyConfigured(pid) ? 'configured' : 'unconfigured');
                                        setAvailableModels([]);
                                        setValidationMessage({ type: '', text: '' });
                                        if (key) {
                                            const res = await validateAPIKey(pid, key);
                                            if (res.valid) setAvailableModels(res.models || []);
                                        }
                                    }}
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: selectedProvider === pid ? 'var(--primary-50)' : 'transparent',
                                        borderBottom: selectedProvider === pid ? '2px solid var(--primary-500)' : 'none',
                                        color: selectedProvider === pid ? 'var(--primary-600)' : 'var(--text-muted)',
                                        fontWeight: selectedProvider === pid ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {pName}
                                </button>
                            );
                        })}
                    </div>

                    {/* API Key Status */}
                    <div style={{
                        padding: 'var(--space-md)',
                        background: aiKeyStatus === 'configured'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : aiKeyStatus === 'testing'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : aiKeyStatus === 'invalid'
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(251, 191, 36, 0.1)',
                        border: `1px solid ${aiKeyStatus === 'configured'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : aiKeyStatus === 'testing'
                                ? 'rgba(59, 130, 246, 0.3)'
                                : aiKeyStatus === 'invalid'
                                    ? 'rgba(239, 68, 68, 0.3)'
                                    : 'rgba(251, 191, 36, 0.3)'
                            }`,
                        borderRadius: 'var(--radius-md)',
                        marginBottom: validationMessage.text ? 'var(--space-sm)' : 'var(--space-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)'
                    }}>
                        <Key
                            size={16}
                            style={{
                                color: aiKeyStatus === 'configured'
                                    ? 'var(--success-500)'
                                    : aiKeyStatus === 'testing'
                                        ? 'var(--info-500)'
                                        : aiKeyStatus === 'invalid'
                                            ? 'var(--error-500)'
                                            : 'var(--warning-500)',
                                animation: aiKeyStatus === 'testing' ? 'pulse 1s infinite' : 'none'
                            }}
                        />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                            {aiKeyStatus === 'configured'
                                ? `✅ ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} API Key Configured`
                                : aiKeyStatus === 'testing'
                                    ? '🔄 Validating API key...'
                                    : aiKeyStatus === 'invalid'
                                        ? '❌ Invalid API Key'
                                        : '⚠️ API Key Not Configured'}
                        </span>
                    </div>

                    {validationMessage.text && (
                        <div style={{
                            marginBottom: 'var(--space-lg)',
                            padding: 'var(--space-sm)',
                            borderRadius: 'var(--radius-md)',
                            background: validationMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: validationMessage.type === 'error' ? 'var(--error-600)' : 'var(--success-600)',
                            fontSize: 'var(--text-sm)'
                        }}>
                            {validationMessage.text}
                        </div>
                    )}

                    {/* Usage Statistics */}
                    {aiKeyStatus === 'configured' && (
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-lg)'
                        }}>
                            <div className="flex justify-between items-center mb-md">
                                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--text-muted)' }}>
                                    USAGE STATISTICS
                                </h4>
                                <Badge variant="primary" size="xs">Provider: {selectedProvider.toUpperCase()}</Badge>
                            </div>
                            
                            <div className="grid-3-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
                                {(() => {
                                    const pStats = usageStats.providers?.[selectedProvider] || { requestsToday: 0, totalRequests: 0 };
                                    return (
                                        <>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--primary-500)' }}>
                                                    {pStats.requestsToday || 0}
                                                </div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                    Today
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    {pStats.totalRequests || 0}
                                                </div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                    Total
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--success-500)' }}>
                                        <span style={{ fontSize: '14px' }}>varies</span>
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        Limits
                                    </div>
                                </div>
                            </div>

                            {/* Global Aggregator */}
                            <div style={{ 
                                marginTop: 'var(--space-lg)', 
                                paddingTop: 'var(--space-md)', 
                                borderTop: '1px dotted var(--border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>PLATFORM-WIDE LIFETIME USAGE:</span>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{usageStats.totalRequests || 0}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>REQ</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Get API Key Link */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                            GET YOUR API KEY
                        </h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                            Get your API key from the {selectedProvider} dashboard.
                        </p>
                        <a
                            href={
                                selectedProvider === 'gemini' ? 'https://makersuite.google.com/app/apikey' :
                                    selectedProvider === 'openai' ? 'https://platform.openai.com/api-keys' :
                                        selectedProvider === 'anthropic' ? 'https://console.anthropic.com/settings/keys' :
                                            selectedProvider === 'perplexity' ? 'https://www.perplexity.ai/settings/api' :
                                                selectedProvider === 'groq' ? 'https://console.groq.com/keys' :
                                                    'https://cloud.sambanova.ai/'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--primary-500)',
                                color: 'white',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 500
                            }}
                        >
                            <ExternalLink size={14} />
                            Get {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} Key
                        </a>
                    </div>

                    {/* API Key Input */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                            {selectedProvider.toUpperCase()} API KEY
                        </h4>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={aiApiKey}
                                onChange={(e) => setAiApiKey(e.target.value)}
                                placeholder={`Enter your ${selectedProvider} API key...`}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-sm) var(--space-md)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                    color: 'var(--text-main)',
                                    fontSize: 'var(--text-sm)'
                                }}
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowApiKey(!showApiKey)}
                            >
                                {showApiKey ? 'Hide' : 'Show'}
                            </Button>
                        </div>
                        <div className="flex-mobile-col" style={{ marginTop: 'var(--space-sm)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
                            {aiKeyStatus === 'configured' && (
                                <Button
                                    variant="ghost"
                                    style={{ color: 'var(--error-500)' }}
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to remove this API key?')) {
                                            const { removeAPIKey } = await import('../services/aiService');
                                            await removeAPIKey(selectedProvider);
                                            setAiApiKey('');
                                            setAiKeyStatus('unconfigured');
                                            setAvailableModels([]);
                                        }
                                    }}
                                >
                                    Remove Key
                                </Button>
                            )}
                            <Button onClick={async () => {
                                if (!aiApiKey.trim()) return;
                                setValidationMessage({ type: '', text: '' });
                                setAiKeyStatus('testing');

                                const { validateAPIKey, saveAPIKey } = await import('../services/aiService');
                                const result = await validateAPIKey(selectedProvider, aiApiKey);

                                if (result.valid) {
                                    await saveAPIKey(selectedProvider, aiApiKey);
                                    setAiKeyStatus('configured');
                                    setAvailableModels(result.models || []);
                                    setValidationMessage({ type: 'success', text: 'API Key saved successfully!' });

                                    // Auto-select first model if needed
                                    if (result.models && result.models.length > 0) {
                                        const { setSelectedModel } = await import('../services/aiService');
                                        setSelectedModel(result.models[0].id);
                                        handleModelChange(result.models[0].id); // Update local state
                                    }
                                } else {
                                    setAiKeyStatus('invalid');
                                    setValidationMessage({ type: 'error', text: result.error });
                                }
                            }}>
                                Save & Test Key
                            </Button>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                            Your API key is stored locally in your browser.
                        </p>
                    </div>

                    {/* Model Selection removed per user request for automatic calibration */}

                    {/* Save/Remove Buttons */}
                    <div className="flex-mobile-col" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <Button
                            onClick={handleSaveApiKey}
                            disabled={!aiApiKey.trim() || aiKeyStatus === 'testing'}
                        >
                            {aiKeyStatus === 'testing' ? 'Validating...' : 'Validate & Save Key'}
                        </Button>
                        {aiKeyStatus === 'configured' && (
                            <Button
                                variant="secondary"
                                onClick={handleRemoveApiKey}
                                style={{ color: 'var(--error-500)' }}
                            >
                                Remove Key
                            </Button>
                        )}
                    </div>

                    {/* Custom Model Addition */}
                    {aiKeyStatus === 'configured' && (
                        <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border)' }}>
                            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                                ADD CUSTOM MODEL
                            </h4>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                                If your API key supports a model not listed above (like specific experimental versions), add its ID here.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input
                                    placeholder="e.g. gemini-2.5-flash"
                                    id="custom-model-input"
                                    style={{
                                        flex: 1,
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)',
                                        fontSize: 'var(--text-sm)'
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        const input = document.getElementById('custom-model-input');
                                        const modelId = input.value.trim();
                                        if (modelId) {
                                            const newModel = {
                                                id: modelId,
                                                provider: selectedProvider,
                                                name: `${modelId} (Custom)`,
                                                description: 'Custom added model'
                                            };
                                            // Add to available models if not exists
                                            if (!availableModels.some(m => m.id === modelId)) {
                                                setAvailableModels([newModel, ...availableModels]);
                                            }
                                            // Select it
                                            handleModelChange(modelId);
                                            input.value = '';

                                            // Persist custom preference
                                            const customModels = JSON.parse(localStorage.getItem('custom_ai_models') || '[]');
                                            if (!customModels.find(m => m.id === modelId)) {
                                                customModels.push(newModel);
                                                localStorage.setItem('custom_ai_models', JSON.stringify(customModels));
                                            }

                                            alert(`Added and selected ${modelId}`);
                                        }
                                    }}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Validation Result - Below Button */}
                    {validationMessage.text && (
                        <div style={{
                            marginTop: 'var(--space-md)',
                            padding: 'var(--space-md)',
                            background: validationMessage.type === 'success'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : validationMessage.type === 'warning'
                                    ? 'rgba(251, 191, 36, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                            border: `2px solid ${validationMessage.type === 'success'
                                ? 'rgba(16, 185, 129, 0.5)'
                                : validationMessage.type === 'warning'
                                    ? 'rgba(251, 191, 36, 0.5)'
                                    : 'rgba(239, 68, 68, 0.5)'
                                }`,
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            color: validationMessage.type === 'success'
                                ? 'var(--success-600)'
                                : validationMessage.type === 'warning'
                                    ? 'var(--warning-600)'
                                    : 'var(--error-600)'
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>
                                {validationMessage.type === 'success' && '✅'}
                                {validationMessage.type === 'warning' && '⚠️'}
                                {validationMessage.type === 'error' && '❌'}
                            </span>
                            <span>
                                {validationMessage.type === 'success' && 'VALID - '}
                                {validationMessage.type === 'error' && 'INVALID - '}
                                {validationMessage.text}
                            </span>
                        </div>
                    )}

                    {/* Beta Notice */}
                    <div style={{
                        marginTop: 'var(--space-lg)',
                        padding: 'var(--space-md)',
                        background: 'rgba(167, 139, 250, 0.1)',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-sm)'
                    }}>
                        <Brain size={18} style={{ color: '#a78bfa', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <span style={{
                                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 700,
                                marginRight: '8px'
                            }}>
                                BETA
                            </span>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                AI features are in beta. Results may vary based on the model selected.
                                The free tier has usage limits that reset daily.
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Settings;

