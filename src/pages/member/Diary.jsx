import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, ProgressBar, LoadingSpinner } from '../../components/common';
import { format12h, minutesTo12h } from '../../utils/timeFormat';
import { Link } from 'react-router-dom';
import { 
    Target, Calendar, PieChart, Activity, 
    ChevronLeft, ChevronRight, Filter, BookOpen,
    Zap, Award, TrendingUp, Brain, AlertTriangle
} from 'lucide-react';

const Diary = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [filter, setFilter] = useState('all'); // all, done, ignored, postponed
    const [selectedRoutine, setSelectedRoutine] = useState('all');
    const [view, setView] = useState('list'); // list, analytics, mindmap
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

    useEffect(() => {
        fetchLogs();
    }, [selectedMonth, user?.id]);

    const fetchLogs = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [logData, notes, shared] = await Promise.all([
                routineService.getAllLogs(),
                supabase.from('study_notes').select('id, title').eq('user_id', user.id),
                supabase.from('knowledge_base').select('id, title').eq('classroom_id', user.classroom_id)
            ]);
            setLogs(logData);
            setMaterials([...(notes.data || []), ...(shared.data || [])]);
        } catch (err) {
            console.error('Failed to fetch diary data:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Analytics Helpers ---
    const filteredLogs = logs.filter(l => {
        const matchesStatus = filter === 'all' || l.status === filter;
        const matchesRoutine = selectedRoutine === 'all' || l.routines?.id === selectedRoutine;
        return matchesStatus && matchesRoutine;
    });

    const stats = {
        totalDays: filteredLogs.length,
        doneCount: filteredLogs.filter(l => l.status === 'done').length,
        totalTime: filteredLogs.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0),
        consistencyRate: filteredLogs.length ? Math.round((filteredLogs.filter(l => l.status === 'done').length / filteredLogs.length) * 100) : 0
    };

    const uniqueRoutines = Array.from(new Set(logs.map(l => l.routines).filter(Boolean).map(r => JSON.stringify(r)))).map(s => JSON.parse(s));

    const LinkifiedText = ({ text }) => {
        if (!text) return null;
        
        // Split by # followed by non-space characters
        const parts = text.split(/(#[^\s,]+)/g);
        
        return (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {parts.map((part, i) => {
                    if (part.startsWith('#')) {
                        const title = part.slice(1);
                        const match = materials.find(m => m.title.toLowerCase() === title.toLowerCase());
                        if (match) {
                            return (
                                <Link 
                                    key={i} 
                                    to={`/study-materials/${match.id}`}
                                    style={{ color: 'var(--primary-500)', fontWeight: 700, textDecoration: 'none' }}
                                    className="hover:underline"
                                >
                                    {part}
                                </Link>
                            );
                        }
                    }
                    return part;
                })}
            </p>
        );
    };

    const renderListView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {filteredLogs.map(log => (
                <Card key={log.id}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-sm mb-xs">
                                <Badge variant={log.status === 'done' ? 'success' : log.status === 'ignored' ? 'error' : 'warning'}>
                                    {log.status === 'ignored' ? 'MISSED' : log.status.toUpperCase()}
                                </Badge>
                                <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{log.routines?.title}</span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                <Calendar size={12} /> {new Date(log.log_date).toLocaleDateString()} • {log.time_spent_minutes} mins spent • Started at {format12h(log.actual_start_time)}
                            </p>
                        </div>
                        {log.actual_response_time && (
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Logged at</p>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                                    {new Date(log.actual_response_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        )}
                    </div>
                    {log.learning_notes && (
                        <div style={{ 
                            marginTop: 'var(--space-md)', 
                            padding: 'var(--space-md)', 
                            background: 'var(--bg)', 
                            borderRadius: 'var(--radius-md)',
                            borderLeft: '3px solid var(--primary-500)',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-500)', letterSpacing: '1px' }}>Insight Log</p>
                            <LinkifiedText text={log.learning_notes} />
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );

    const renderAnalyticsView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--bg) 100%)' }}>
                    <TrendingUp size={24} style={{ color: 'var(--primary-500)', marginBottom: '8px' }} />
                    <h2 style={{ margin: 0 }}>{stats.consistencyRate}%</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Consistency Rate</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Activity size={24} style={{ color: 'var(--success-500)', marginBottom: '8px' }} />
                    <h2 style={{ margin: 0 }}>{stats.totalTime}</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Minutes Invested</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Award size={24} style={{ color: 'var(--warning-500)', marginBottom: '8px' }} />
                    <h2 style={{ margin: 0 }}>{stats.doneCount}</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Sessions Completed</p>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 md-grid-cols-2 gap-lg">
                <Card title="Routine Breakdown">
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>Time distribution across your architecture</p>
                    {uniqueRoutines.map(routine => {
                        const routineLogs = logs.filter(l => l.routine_id === routine.id);
                        const routineTime = routineLogs.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0);
                        const totalTimeSpent = logs.reduce((acc, curr) => acc + (curr.time_spent_minutes || 0), 0) || 1;
                        const percentage = Math.min(100, (routineTime / totalTimeSpent) * 100);
                        return (
                            <div key={routine.id} style={{ marginBottom: 'var(--space-md)' }}>
                                <div className="flex justify-between items-center mb-xs">
                                    <span style={{ fontWeight: 600 }}>{routine.title}</span>
                                    <span style={{ fontSize: 'var(--text-xs)' }}>{routineTime} mins</span>
                                </div>
                                <ProgressBar value={percentage} color="var(--primary-500)" />
                            </div>
                        );
                    })}
                </Card>

                <Card title="Task Analytics (Efficiency)">
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>Consistency per specific task</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {uniqueRoutines.map(routine => {
                            const routineLogs = logs.filter(l => l.routine_id === routine.id);
                            const done = routineLogs.filter(l => l.status === 'done').length;
                            const total = routineLogs.length || 1;
                            const rate = Math.round((done / total) * 100);
                            
                            return (
                                <div key={routine.id} className="flex items-center gap-md">
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary-500)', border: '1px solid var(--border)' }}>
                                        {rate}%
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>{routine.title}</p>
                                        <div className="flex gap-sm">
                                            <Badge variant="success" size="xs">{done} Done</Badge>
                                            <Badge variant="error" size="xs">{routineLogs.filter(l => l.status === 'ignored').length} Missed</Badge>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
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

    const renderTimelineView = () => {
        const todayLogs = filteredLogs.filter(l => l.status === 'done' && l.actual_start_time);
        const hours = Array.from({ length: 24 }, (_, i) => i);

        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        return (
            <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)', border: '1px solid var(--border)', minHeight: '800px' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                    {/* Time Axis */}
                    <div style={{ width: '60px', flexShrink: 0 }}>
                        {hours.map(h => (
                            <div key={h} style={{ height: '60px', color: 'var(--text-muted)', fontSize: '10px', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
                                {format12h(`${h.toString().padStart(2, '0')}:00`)}
                            </div>
                        ))}
                    </div>

                    {/* Timeline Grid */}
                    <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--border)' }}>
                        {todayLogs.map((log, i) => {
                            const start = toMinutes(log.actual_start_time);
                            const duration = log.time_spent_minutes || 30;
                            const top = (start / 60) * 60; // 60px per hour
                            const height = (duration / 60) * 60;
                            
                            // Simple overlap check for visual warning
                            const hasOverlap = todayLogs.some(other => {
                                if (other.id === log.id) return false;
                                const otherStart = toMinutes(other.actual_start_time);
                                const otherEnd = otherStart + other.time_spent_minutes;
                                const logEnd = start + duration;
                                return (start < otherEnd) && (logEnd > otherStart);
                            });

                            return (
                                <div 
                                    key={log.id} 
                                    style={{
                                        position: 'absolute', top: `${top}px`, left: '10px', right: '10px',
                                        height: `${Math.max(height, 25)}px`,
                                        background: hasOverlap ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                        border: `1px solid ${hasOverlap ? 'var(--error-500)' : 'var(--primary-500)'}`,
                                        borderRadius: '8px', padding: '8px', overflow: 'hidden',
                                        boxShadow: hasOverlap ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none',
                                        zIndex: hasOverlap ? 2 : 1,
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div style={{ fontSize: '11px', fontWeight: 700 }}>{log.routines?.title}</div>
                                        {hasOverlap && <Badge variant="error" size="xs"><AlertTriangle size={10} /> Conflict</Badge>}
                                    </div>
                                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                        {format12h(log.actual_start_time)} • {duration}m
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="page-content animate-fade-in">
            <div className="flex flex-mobile-col justify-between items-center mb-xl gap-md">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BookOpen className="text-primary-500" /> Learning Diary
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Your consistency logs and analytics</p>
                </div>
                <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '4px', border: '1px solid var(--border)' }}>
                    <button onClick={() => setView('list')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'list' ? 'var(--primary-500)' : 'transparent', color: view === 'list' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>List</button>
                    <button onClick={() => setView('timeline')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'timeline' ? 'var(--primary-500)' : 'transparent', color: view === 'timeline' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Timeline</button>
                    <button onClick={() => setView('analytics')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'analytics' ? 'var(--primary-500)' : 'transparent', color: view === 'analytics' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Analytics</button>
                    <button onClick={() => setView('mindmap')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: view === 'mindmap' ? 'var(--primary-500)' : 'transparent', color: view === 'mindmap' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Mindmap</button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-mobile-col gap-md mb-xl items-center bg-surface p-md rounded-lg border border-border">
                <div className="flex items-center gap-sm" style={{ flex: 1 }}>
                    <Filter size={16} className="text-muted" />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Filter by:</span>
                </div>
                <div className="flex gap-sm">
                    <select 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 'var(--text-sm)' }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="done">Done</option>
                        <option value="ignored">Missed</option>
                        <option value="postponed">Postponed</option>
                    </select>
                    <select 
                        value={selectedRoutine} 
                        onChange={(e) => setSelectedRoutine(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 'var(--text-sm)' }}
                    >
                        <option value="all">All Routines</option>
                        {uniqueRoutines.map(r => (
                            <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                    </select>
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
                    {view === 'timeline' && renderTimelineView()}
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
