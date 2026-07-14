import { useState, useEffect } from 'react';
import { Card, Button } from '../common';
import { Shield, Download, Github, Smartphone, RefreshCw } from 'lucide-react';
import { PlatformService } from '../../services/infrastructure/PlatformService';
import { updateChecker } from '../../services/updateChecker';
import packageJson from '../../../package.json';

const AboutSettings = () => {
    const [checking, setChecking] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('idle'); // 'idle', 'up-to-date', 'available', 'error'
    const [updateData, setUpdateData] = useState(null);
    const [patchNotes, setPatchNotes] = useState('');

    useEffect(() => {
        // Fetch current release/patch notes from Vercel version.json
        const fetchPatchNotes = async () => {
            try {
                const res = await fetch('https://zenith-sable-alpha.vercel.app/version.json', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setPatchNotes(data.releaseNotes || '');
                }
            } catch (err) {
                console.warn('Failed to fetch latest patch notes:', err);
            }
        };
        fetchPatchNotes();
    }, []);

    const handleCheckUpdate = async () => {
        setChecking(true);
        setUpdateStatus('idle');
        try {
            const result = await updateChecker.checkForUpdates();
            if (result.error) {
                setUpdateStatus('error');
                setUpdateData({ error: result.error });
            } else if (result.updateAvailable) {
                setUpdateStatus('available');
                setUpdateData(result);
            } else {
                setUpdateStatus('up-to-date');
            }
        } catch (e) {
            setUpdateStatus('error');
            setUpdateData({ error: e.message });
        } finally {
            setChecking(false);
        }
    };

    return (
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
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{packageJson.version}</p>
                </div>
                <div style={{ padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Build</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>2026.07.13</p>
                </div>
            </div>

            {!PlatformService.isNative() && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-lg)',
                    borderTop: '1px solid var(--border)'
                }}>
                    <h4 style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--text-md)', fontWeight: 600 }}>Desktop & Mobile Apps</h4>
                    
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-md)'
                    }}>
                        {/* Android APK */}
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'color-mix(in srgb, #10b981, transparent 95%)',
                            border: '1px dashed color-mix(in srgb, #10b981, transparent 70%)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 'var(--space-md)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1, minWidth: '200px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    background: '#10b981',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '18px'
                                }}>
                                    📱
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Zenith Mobile (Android)</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>v{packageJson.version} APK</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                <a 
                                    href={`/zenith-v${packageJson.version}.apk`}
                                    download 
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        background: '#10b981',
                                        color: 'white',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        transition: 'opacity 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:opacity-90 active:scale-95"
                                >
                                    <Download size={14} /> Download APK
                                </a>
                                <a 
                                    href="https://github.com/Dev-Anand-M/task_management/releases" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        background: 'var(--surface-hover)',
                                        color: 'var(--text)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        transition: 'background-color 0.2s, color 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:bg-var(--border) active:scale-95"
                                >
                                    <Github size={14} /> Releases
                                </a>
                            </div>
                        </div>

                        {/* Windows Installers */}
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'color-mix(in srgb, #3b82f6, transparent 95%)',
                            border: '1px dashed color-mix(in srgb, #3b82f6, transparent 70%)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 'var(--space-md)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1, minWidth: '200px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    background: '#3b82f6',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '18px'
                                }}>
                                    💻
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Zenith Desktop (Windows)</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>v1.0.1 Installers</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                <a 
                                    href="/Zenith_1.0.1_x64-setup.exe" 
                                    download 
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        transition: 'opacity 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:opacity-90 active:scale-95"
                                >
                                    <Download size={14} /> EXE Installer
                                </a>
                                <a 
                                    href="/Zenith_1.0.1_x64_en-US.msi" 
                                    download 
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        background: 'var(--surface-hover)',
                                        color: 'var(--text)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        transition: 'background-color 0.2s, color 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:bg-var(--border) active:scale-95"
                                >
                                    <Download size={14} /> MSI Installer
                                </a>
                            </div>
                        </div>
                    </div>
            {/* Check for Updates (Native only) or general Info */}
            <div style={{
                marginTop: 'var(--space-lg)',
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid var(--border)'
            }}>
                <h4 style={{ margin: '0 0 var(--space-sm) 0', fontSize: 'var(--text-md)', fontWeight: 600 }}>🔄 App Updates</h4>
                <p style={{ margin: '0 0 var(--space-md) 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    Check if a newer version of Zenith is available.
                </p>
                
                <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={handleCheckUpdate} 
                    disabled={checking}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking...' : 'Check for Updates'}
                </Button>

                {updateStatus === 'available' && updateData && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--primary-600)' }}>
                            🚀 Update Available: v{updateData.latestVersion}
                        </h4>
                        {updateData.releaseNotes && (
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                padding: 'var(--space-sm)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '12px',
                                fontSize: 'var(--text-xs)',
                                color: 'rgba(255,255,255,0.87)',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap'
                            }}>
                                📋 Patch Notes:<br/>{updateData.releaseNotes}
                            </div>
                        )}
                        <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => updateChecker.downloadUpdate(updateData.downloadUrl)}
                        >
                            Update Now
                        </Button>
                    </div>
                )}

                {updateStatus === 'up-to-date' && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--success-600)',
                        fontWeight: 500
                    }}>
                        ✅ Zenith is up to date! (v{packageJson.version})
                    </div>
                )}

                {updateStatus === 'error' && updateData && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--error-600)',
                        fontWeight: 500
                    }}>
                        ❌ Update Check Failed: {updateData.error} (Updates only checkable on native Android devices)
                    </div>
                )}
            </div>

            {/* Permanent Patch Notes Display */}
            {patchNotes && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-lg)',
                    borderTop: '1px solid var(--border)'
                }}>
                    <h4 style={{ margin: '0 0 var(--space-sm) 0', fontSize: 'var(--text-md)', fontWeight: 600 }}>📋 Version Patch Notes</h4>
                    <div style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        padding: 'var(--space-md)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-main)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6'
                    }}>
                        {patchNotes}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default AboutSettings;
