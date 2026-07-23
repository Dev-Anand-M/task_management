import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common';
import { Palette, Sun, Moon, Check } from 'lucide-react';

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
    },
    {
        id: 'glass',
        name: 'Liquid Glass',
        description: 'Teal & Coral 3D liquid glass theme',
        primary: '#14b8a6',
        gradient: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 50%, #f43f5e 100%)',
        colors: ['#14b8a6', '#0ea5e9', '#f43f5e']
    }
];

const AppearanceSettings = () => {
    const { isDark, toggleTheme, colorScheme, setColorScheme, fontSize, setFontSize } = useTheme();

    const fontSizes = [
        { id: 'small', label: 'Small', size: '14px' },
        { id: 'normal', label: 'Normal (Default)', size: '16px' },
        { id: 'large', label: 'Large', size: '18px' },
        { id: 'xlarge', label: 'Extra Large', size: '20px' }
    ];

    return (
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
                        Customize how Zenith looks and scales
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
                            background: !isDark ? `color-mix(in srgb, var(--primary-500), ${isDark ? 'var(--card)' : 'white'} 85%)` : 'var(--card)',
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
                        <Sun size={24} style={{ color: !isDark ? 'var(--primary-500)' : 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600, color: !isDark ? (isDark ? 'var(--primary-300)' : 'var(--primary-700)') : 'var(--text)' }}>Light</span>
                        {!isDark && <Check size={16} style={{ color: 'var(--primary-500)' }} />}
                    </button>
                    <button
                        onClick={() => !isDark && toggleTheme()}
                        style={{
                            flex: 1,
                            padding: 'var(--space-lg)',
                            background: isDark ? `color-mix(in srgb, var(--primary-500), var(--card) 85%)` : 'var(--card)',
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
                        <Moon size={24} style={{ color: isDark ? 'var(--primary-300)' : 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600, color: isDark ? 'var(--primary-300)' : 'var(--text)' }}>Dark</span>
                        {isDark && <Check size={16} style={{ color: 'var(--primary-300)' }} />}
                    </button>
                </div>
            </div>

            {/* Font Size Scaling */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-muted)' }}>
                    GLOBAL FONT / APP TEXT SCALE
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-sm)' }}>
                    {fontSizes.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFontSize(f.id)}
                            style={{
                                padding: 'var(--space-md)',
                                background: (fontSize === f.id || (!fontSize && f.id === 'normal')) ? 'var(--primary-500-alpha, rgba(99, 102, 241, 0.15))' : 'var(--card)',
                                border: (fontSize === f.id || (!fontSize && f.id === 'normal')) ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: 'var(--text)',
                                fontWeight: 600,
                                fontSize: f.size
                            }}
                        >
                            <span>{f.label}</span>
                            {(fontSize === f.id || (!fontSize && f.id === 'normal')) && <Check size={16} style={{ color: 'var(--primary-500)' }} />}
                        </button>
                    ))}
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
                            onClick={() => setColorScheme(scheme.id)}
                            style={{
                                padding: 'var(--space-md)',
                                background: colorScheme === scheme.id
                                    ? (isDark ? `color-mix(in srgb, ${scheme.primary}, #1c1917 85%)` : `color-mix(in srgb, ${scheme.primary}, white 88%)`)
                                    : 'var(--card)',
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
                            <h5 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: colorScheme === scheme.id ? (isDark ? '#f5f5f5' : '#1a1a1a') : 'var(--text)' }}>
                                {scheme.name}
                            </h5>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: colorScheme === scheme.id ? (isDark ? '#d4d4d4' : '#555') : 'var(--text-muted)' }}>
                                {scheme.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </Card>
    );
};

export default AppearanceSettings;
