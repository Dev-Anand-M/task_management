import { useState, useEffect } from 'react';
import { Card, Button } from '../common';
import { supabase } from '../../lib/supabase';
import { Shield } from 'lucide-react';

const SecuritySettings = () => {
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

    return (
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
    );
};

export default SecuritySettings;
