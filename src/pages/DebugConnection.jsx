import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge } from '../components/common';
import { CheckCircle, XCircle, Loader2, RefreshCw, Database } from 'lucide-react';

const DebugConnection = () => {
    const [results, setResults] = useState({
        envVars: { status: 'pending', detail: '' },
        auth: { status: 'pending', detail: '' },
        database: { status: 'pending', detail: '' },
        realtime: { status: 'pending', detail: '' } // Optional check
    });
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    const checkConnection = async () => {
        setLoading(true);
        // ... (keep existing init)
        const newResults = {
            envVars: { status: 'pending', detail: '' },
            auth: { status: 'pending', detail: '' },
            database: { status: 'pending', detail: '' },
            realtime: { status: 'skipped', detail: 'Not critical' }
        };

        // 1. Check Env Vars
        try {
            const url = import.meta.env.VITE_SUPABASE_URL;
            const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (url && key) {
                newResults.envVars = {
                    status: 'success',
                    detail: `URL: ${url.substring(0, 15)}... | Key: Present`
                };
            } else {
                newResults.envVars = {
                    status: 'error',
                    detail: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'
                };
            }
        } catch (e) {
            newResults.envVars = { status: 'error', detail: e.message };
        }

        // 2. Check Auth
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (data.session) {
                setCurrentUser(data.session.user);
                // Fetch profile to get role
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
                newResults.auth = {
                    status: 'success',
                    detail: `Logged in as ${data.session.user.email} (${profile?.role || 'no role'})`
                };
                if (profile) setCurrentUser(prev => ({ ...prev, role: profile.role }));
            } else {
                newResults.auth = { status: 'success', detail: 'No active session (Guest)' };
            }
        } catch (e) {
            newResults.auth = { status: 'error', detail: e.message };
        }

        // 3. Check Database (Profiles Table)
        try {
            // Perform a simple HEAD request to check connection/permissions
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            newResults.database = {
                status: 'success',
                detail: `Connected. Accessible Rows: ${count !== null ? count : 'Unknown'}`
            };
        } catch (e) {
            newResults.database = { status: 'error', detail: e.message };
        }

        setResults(newResults);
        setLoading(false);
    };

    const handlePromoteToAdmin = async () => {
        if (!currentUser) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', currentUser.id);

            if (error) throw error;
            alert('Success! Role updated to ADMIN. Please refresh the page.');
            checkConnection();
        } catch (e) {
            alert('Error updating role: ' + e.message + '\n\nIf this fails, you must update it in the Supabase Dashboard SQL Editor:\nUPDATE profiles SET role = \'admin\' WHERE id = \'' + currentUser.id + '\';');
        }
    };

    useEffect(() => {
        checkConnection();
    }, []);

    const getStatusColor = (status) => {
        if (status === 'success') return 'var(--success-500)';
        if (status === 'error') return 'var(--error-500)';
        if (status === 'pending') return 'var(--warning-500)';
        return 'var(--text-muted)';
    };

    const getIcon = (status) => {
        if (status === 'success') return <CheckCircle size={20} />;
        if (status === 'error') return <XCircle size={20} />;
        if (status === 'pending') return <Loader2 size={20} className="animate-spin" />;
        return <Database size={20} />;
    };

    return (
        <div className="animate-fade-in p-xl max-w-2xl mx-auto">
            <Card>
                <div className="flex justify-between items-center mb-xl">
                    <h2 className="m-0 flex items-center gap-md">
                        <Database className="text-primary" />
                        System Diagnostics
                    </h2>
                    <Button onClick={checkConnection} loading={loading} icon={RefreshCw}>
                        Run Checks
                    </Button>
                </div>

                <div className="flex flex-col gap-md">
                    {/* Env Vars */}
                    <div className="flex items-center justify-between p-md bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-md">
                            <div style={{ color: getStatusColor(results.envVars.status) }}>
                                {getIcon(results.envVars.status)}
                            </div>
                            <div>
                                <h4 className="m-0">Environment Variables</h4>
                                <p className="m-0 text-sm text-muted">{results.envVars.detail}</p>
                            </div>
                        </div>
                        <Badge variant={results.envVars.status === 'success' ? 'success' : 'danger'}>
                            {results.envVars.status.toUpperCase()}
                        </Badge>
                    </div>

                    {/* Auth */}
                    <div className="flex items-center justify-between p-md bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-md">
                            <div style={{ color: getStatusColor(results.auth.status) }}>
                                {getIcon(results.auth.status)}
                            </div>
                            <div>
                                <h4 className="m-0">Auth Service</h4>
                                <p className="m-0 text-sm text-muted">{results.auth.detail}</p>
                            </div>
                        </div>
                        <Badge variant={results.auth.status === 'success' ? 'success' : 'danger'}>
                            {results.auth.status.toUpperCase()}
                        </Badge>
                    </div>

                    {/* Database */}
                    <div className="flex items-center justify-between p-md bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-md">
                            <div style={{ color: getStatusColor(results.database.status) }}>
                                {getIcon(results.database.status)}
                            </div>
                            <div>
                                <h4 className="m-0">Database Connection</h4>
                                <p className="m-0 text-sm text-muted">{results.database.detail}</p>
                            </div>
                        </div>
                        <Badge variant={results.database.status === 'success' ? 'success' : 'danger'}>
                            {results.database.status.toUpperCase()}
                        </Badge>
                    </div>

                    {/* Admin Promotion Tool */}
                    {currentUser && (
                        <div className="mt-md p-md bg-surface rounded-lg border border-border flex justify-between items-center">
                            <div>
                                <h4 className="m-0">Current Role: {currentUser.role || 'member'}</h4>
                                <p className="m-0 text-sm text-muted">User ID: {currentUser.id}</p>
                            </div>
                            {currentUser.role !== 'admin' && (
                                <Button onClick={handlePromoteToAdmin} variant="secondary" size="sm">
                                    Force Upgrade to Admin
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {results.database.status === 'error' && (
                    <div className="mt-xl p-md bg-error-500/10 border border-error-500 rounded-lg text-error-500 text-sm">
                        <strong>Troubleshooting Tip:</strong> If Environment Variables are present but Database fails, check if your Supabase project is paused or if RLS policies are blocking access.
                    </div>
                )}
            </Card>
        </div>
    );
};

export default DebugConnection;
