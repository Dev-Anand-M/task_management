import { Card } from '../common';
import { Shield } from 'lucide-react';

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
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>1.0.0</p>
                </div>
                <div style={{ padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Build</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>2026.06.25</p>
                </div>
            </div>
        </Card>
    );
};

export default AboutSettings;
