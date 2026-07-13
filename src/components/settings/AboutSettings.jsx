import { useState } from 'react';
import { Card, Button } from '../common';
import { Shield, Download, Github, Smartphone, RefreshCw } from 'lucide-react';
import { PlatformService } from '../../services/infrastructure/PlatformService';
import { updateChecker } from '../../services/updateChecker';
import packageJson from '../../../package.json';

const AboutSettings = () => {
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
                </div>
            )}
        </Card>
    );
};

export default AboutSettings;
