import AppearanceSettings from '../components/settings/AppearanceSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import AISettings from '../components/settings/AISettings';
import AboutSettings from '../components/settings/AboutSettings';

const Settings = () => {
    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    Settings
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Customize your Zenith experience
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                <AppearanceSettings />
                <NotificationSettings />
                <SecuritySettings />
                <AISettings />
                <AboutSettings />
            </div>
        </div>
    );
};

export default Settings;
