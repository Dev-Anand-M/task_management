import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, ProgressBar, LoadingSpinner } from '../../components/common';
import { 
    Target, Calendar, PieChart, Activity, 
    ChevronLeft, ChevronRight, Filter, BookOpen,
    Zap, Award, TrendingUp, Brain
} from 'lucide-react';

const Diary = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('all'); // all, done, ignored
    const [view, setView] = useState('list'); // list, analytics, mindmap
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

    useEffect(() => {
        fetchLogs();
    }, [selectedMonth, user?.id]);

    const fetchLogs = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            // In a real app, we'd fetch for the selected month
            // For now, let's fetch all and filter client-side
            const { data, error } = await supabase
                .from('routine_logs')
                .select('*, routines(*)')
                .eq('user_id', user.id)
                .order('log_date', { ascending: false });
                
            if (error) throw error;
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Analytics Helpers ---
    const stats = {
        totalDays: logs.length,
        doneCount: logs.filter(l => l.status === 'done').length,
        totalTime: logs.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0),
        consistencyRate: logs.length ? Math.round((logs.filter(l => l.status === 'done').length / logs.length) * 100) : 0
    };

    const renderListView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {logs.map(log => (
                <Card key={log.id}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-sm mb-xs">
                                <Badge variant={log.status === 'done' ? 'success' : log.status === 'ignored' ? 'error' : 'warning'}>
                                    {log.status.toUpperCase()}
                                </Badge>
                                <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{log.routines?.title}</span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                <Calendar size={12} /> {new Date(log.log_date).toLocaleDateString()} • {log.time_spent_minutes} mins spent
                            </p>
                        </div>
                        {log.actual_response_time && (
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Response Time</p>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                                    {new Date(log.actual_response_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        )}
                    </div>
                    {log.learning_notes && (
                        <div style={{ 
                            marginTop: 'var(--space-md)', 
                            padding: 'var(--space-sm)', 
                            background: 'var(--bg)', 
                            borderRadius: 'var(--radius-md)',
                            borderLeft: '3px solid var(--primary-500)'
                        }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-500)' }}>What I Learnt</p>
                            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{log.learning_notes}</p>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );

    const renderAnalyticsView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                <Card style={{ textAlign: 'center' }}>
                    <TrendingUp size={24} style={{ color: 'var(--primary-500)', marginBottom: '8px' }} />
                    <h2 style={{ margin: 0 }}>{stats.consistencyRate}%</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Consistency Rate</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Activity size={24} style={{ color: 'var(--success-500)', marginBottom: '8px' }} />
                    <h2 style={{ margin: 0 }}>{stats.totalTime}</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Minutes Spent</p>
                </Card>
            </div>
            
            <Card title="Routine Breakdown">
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>Time spent per routine category</p>
                {/* Simplified bar chart representation */}
                {Array.from(new Set(logs.map(l => l.routines?.title))).map(title => {
                    const routineLogs = logs.filter(l => l.routines?.title === title);
                    const routineTime = routineLogs.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0);
                    const percentage = Math.min(100, (routineTime / stats.totalTime) * 100);
                    return (
                        <div key={title} style={{ marginBottom: 'var(--space-md)' }}>
                            <div className="flex justify-between items-center mb-xs">
                                <span style={{ fontWeight: 600 }}>{title}</span>
                                <span style={{ fontSize: 'var(--text-xs)' }}>{routineTime} mins</span>
                            </div>
                            <ProgressBar value={percentage} color="var(--primary-500)" />
                        </div>
                    );
                })}
            </Card>
        </div>
    );

    const renderMindmapView = () => (
        <Card style={{ 
            textAlign: 'center', 
            padding: 'var(--space-2xl)', 
            minHeight: '500px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.05,
                background: 'radial-gradient(circle at center, var(--primary-500) 0%, transparent 70%)',
                zIndex: 0
            }} />
            
            <div style={{ zIndex: 1 }}>
                <Brain size={64} style={{ color: 'var(--primary-500)', marginBottom: 'var(--space-lg)', filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))' }} />
                <h3 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Knowledge Mindmap</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto var(--space-2xl)' }}>Visualizing your learning connections from your diary logs</p>
            </div>

            <div style={{ 
                position: 'relative',
                width: '100%',
                height: '300px',
                zIndex: 1
            }}>
                {logs.filter(l => l.learning_notes).slice(0, 12).map((l, i) => {
                    const angle = (i / 12) * Math.PI * 2;
                    const radius = 120 + (i % 3) * 30;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)',
                            padding: '10px 16px',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            borderRadius: '12px',
                            border: '1px solid var(--primary-500)',
                            fontSize: '11px',
                            fontWeight: 700,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            whiteSpace: 'nowrap',
                            animation: `float ${3 + i % 2}s ease-in-out infinite`,
                            animationDelay: `${i * 0.2}s`
                        }}>
                            <div style={{ position: 'absolute', width: '2px', height: `${radius}px`, background: 'var(--primary-500)', opacity: 0.2, top: y > 0 ? `-${radius}px` : '100%', left: '50%', transform: `rotate(${angle + Math.PI/2}rad)`, transformOrigin: 'top' }} />
                            {l.learning_notes.split(' ').slice(0, 3).join(' ')}
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                    50% { transform: translate(-50%, -50%) translateY(-10px); }
                }
            `}</style>
        </Card>
    );

    return (
        <div className="page-content animate-fade-in">
            <div className="flex flex-mobile-col justify-between items-center mb-xl">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BookOpen className="text-primary-500" /> Learning Diary
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Your consistency logs and analytics</p>
                </div>
                <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '4px', border: '1px solid var(--border)' }}>
                    <button onClick={() => setView('list')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'list' ? 'var(--primary-500)' : 'transparent', color: view === 'list' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>List</button>
                    <button onClick={() => setView('analytics')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'analytics' ? 'var(--primary-500)' : 'transparent', color: view === 'analytics' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Analytics</button>
                    <button onClick={() => setView('mindmap')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'mindmap' ? 'var(--primary-500)' : 'transparent', color: view === 'mindmap' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Mindmap</button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2xl)' }}>
                    <LoadingSpinner />
                </div>
            ) : logs.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <h3>No logs found</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Start completing your routines to see them here!</p>
                    <Button variant="primary" onClick={() => window.location.href='/routines'}>View Routines</Button>
                </Card>
            ) : (
                <>
                    {view === 'list' && renderListView()}
                    {view === 'analytics' && renderAnalyticsView()}
                    {view === 'mindmap' && renderMindmapView()}
                </>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.05); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Diary;
