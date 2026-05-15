import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, ProgressBar, LoadingSpinner } from '../../components/common';
import { format12h, minutesTo12h } from '../../utils/timeFormat';
import { Link, useLocation } from 'react-router-dom';
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
    // Use local month instead of UTC to avoid mismatch at beginning of month
    const getInitialMonth = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };
    const [selectedMonth, setSelectedMonth] = useState(getInitialMonth()); // YYYY-MM
    const isMobile = window.innerWidth < 768;

    const location = useLocation();
    
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam && ['list', 'timeline', 'analytics', 'mindmap'].includes(viewParam)) {
            setView(viewParam);
        }
    }, [location.search]);

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
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.shiftKey && e.altKey && (e.key === 'C' || e.key === 'c')) {
                handleClearAllLogs();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClearAllLogs = async () => {
        if (window.confirm('⚠️ CRITICAL: Are you sure you want to PERMANENTLY DELETE all diary logs? This cannot be undone.')) {
            try {
                setLoading(true);
                await routineService.clearAllLogs();
                await fetchLogs();
                alert('Success: All diary records have been cleared.');
            } catch (err) {
                console.error('Failed to clear logs:', err);
                alert('Error: Failed to clear records.');
            } finally {
                setLoading(false);
            }
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
        
        // Sort materials by title length (longest first) to prevent partial matches 
        // (e.g., matching "#Physics" instead of "#Physics Chapter 1")
        const sortedMaterials = [...materials].sort((a, b) => b.title.length - a.title.length);
        
        // We use an array of elements that can be strings or React components
        let elements = [text];
        
        sortedMaterials.forEach(material => {
            const mention = `#${material.title}`;
            const newElements = [];
            
            elements.forEach(el => {
                if (typeof el !== 'string') {
                    newElements.push(el);
                    return;
                }
                
                // Escape special regex characters in the title
                const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const parts = el.split(new RegExp(`(${escapedMention})`, 'gi'));
                
                parts.forEach((part, index) => {
                    if (part.toLowerCase() === mention.toLowerCase()) {
                        newElements.push(
                            <Link 
                                key={`${material.id}-${index}`} 
                                to={`/study-materials/${material.id}`}
                                style={{ color: 'var(--primary-500)', fontWeight: 700, textDecoration: 'none' }}
                                className="hover:underline"
                            >
                                {part}
                            </Link>
                        );
                    } else if (part) {
                        newElements.push(part);
                    }
                });
            });
            elements = newElements;
        });
        
        return (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {elements}
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
                                <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{log.snapshot_title || log.routines?.title}</span>
                                {(log.routines?.is_anonymous) && <Badge variant="accent" size="xs">FLEXIBLE</Badge>}
                            </div>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                <Calendar size={12} /> {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • {log.time_spent_minutes} mins spent • Scheduled at {format12h(log.snapshot_start_time || log.routines?.start_time)}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Recorded at {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                on {new Date(log.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            {log.actual_start_time && (
                                <div style={{ fontSize: '10px', color: 'var(--primary-500)', fontWeight: 700, marginTop: '4px' }}>
                                    Started {log.actual_start_time.slice(0, 5)}
                                </div>
                            )}
                        </div>
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

    const renderMindmapView = () => {
        const mindmapLogs = logs.filter(l => l.learning_notes).slice(0, 15);
        
        return (
            <Card style={{ 
                textAlign: 'center', 
                padding: isMobile ? 'var(--space-md)' : 'var(--space-2xl)', 
                minHeight: '600px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: 'radial-gradient(circle at center, #1a1a24 0%, #0f0f12 100%)',
                border: '1px solid var(--primary-900)'
            }}>
                {/* Background Glow */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.1,
                    background: 'radial-gradient(circle at center, var(--primary-500) 0%, transparent 70%)',
                    zIndex: 0
                }} />
                
                {/* Center Core */}
                <div style={{ 
                    zIndex: 10, 
                    position: 'relative',
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: 'var(--space-xl)',
                    borderRadius: '50%',
                    border: '1px solid var(--primary-500)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 40px rgba(99, 102, 241, 0.2)'
                }}>
                    <Brain size={isMobile ? 32 : 48} style={{ color: 'var(--primary-500)', filter: 'drop-shadow(0 0 10px var(--primary-500))' }} />
                    <div style={{ marginTop: '8px' }}>
                        <h3 style={{ fontSize: isMobile ? 'var(--text-sm)' : 'var(--text-lg)', fontWeight: 800, margin: 0 }}>CORE</h3>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>KNOWLEDGE</p>
                    </div>
                </div>

                {/* Nodes & Connections */}
                <div style={{ 
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {mindmapLogs.map((l, i) => {
                        const total = mindmapLogs.length;
                        const angle = (i / total) * Math.PI * 2;

                        
                        // Use multiple rings for better distribution
                        const ring = (i % 2 === 0) ? 1 : 1.6;
                        const radius = isMobile ? (80 * ring) : (180 * ring);
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        
                        const color = i % 3 === 0 ? 'var(--primary-500)' : i % 3 === 1 ? 'var(--success-500)' : 'var(--warning-500)';
                        
                        return (
                            <div key={i} style={{ position: 'absolute' }}>
                                {/* Connection Line */}
                                <div style={{ 
                                    position: 'absolute', 
                                    width: `${radius}px`, 
                                    height: '1px', 
                                    background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`, 
                                    opacity: 0.2, 
                                    top: '0', 
                                    left: '0', 
                                    transform: `rotate(${angle}rad)`, 
                                    transformOrigin: 'left center' 
                                }} />
                                
                                {/* Node */}
                                <div 
                                    className="mindmap-node"
                                    style={{
                                        position: 'absolute',
                                        left: `${x}px`,
                                        top: `${y}px`,
                                        transform: 'translate(-50%, -50%)',
                                        padding: '8px 12px',
                                        background: 'rgba(26, 26, 36, 0.9)',
                                        color: 'white',
                                        borderRadius: '12px',
                                        border: `1px solid ${color}`,
                                        fontSize: isMobile ? '9px' : '11px',
                                        fontWeight: 700,
                                        boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 10px ${color}33`,
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer',
                                        zIndex: 5,
                                        transition: 'all 0.3s ease',
                                        animation: `float ${4 + i % 2}s ease-in-out infinite`,
                                        animationDelay: `${i * 0.3}s`
                                    }}
                                    onClick={() => {
                                        setFilter('all');
                                        setSelectedRoutine(l.routine_id);
                                        setView('list');
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                        {(l.learning_notes || '').length > 25 ? (l.learning_notes || '').substring(0, 22) + '...' : (l.learning_notes || '')}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ position: 'absolute', bottom: 'var(--space-md)', width: '100%', textAlign: 'center', zIndex: 10 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
                        {isMobile ? 'Nodes scaled for mobile view' : 'Click nodes to filter and view full logs'}
                    </p>
                </div>

                <style>{`
                    .mindmap-node:hover {
                        transform: translate(-50%, -50%) scale(1.1) !important;
                        background: var(--surface) !important;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px var(--primary-500)66 !important;
                        z-index: 20 !important;
                    }
                    @keyframes float {
                        0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                        50% { transform: translate(-50%, -50%) translateY(-10px); }
                    }
                `}</style>
            </Card>
        );
    };

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mode:</span>
                    <select 
                        value={view} 
                        onChange={(e) => setView(e.target.value)}
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: 'var(--radius-lg)', 
                            background: 'var(--surface)', 
                            color: 'var(--primary-500)', 
                            border: '1px solid var(--primary-500)', 
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)'
                        }}
                    >
                        <option value="list">📜 List View</option>
                        <option value="timeline">⏳ Timeline</option>
                        <option value="analytics">📊 Analytics</option>
                        <option value="mindmap">🧠 Mindmap</option>
                    </select>
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
