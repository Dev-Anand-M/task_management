import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, ProgressBar, LoadingSpinner, Modal } from '../../components/common';
import { format12h, minutesTo12h } from '../../utils/timeFormat';
import { Link, useLocation } from 'react-router-dom';
import { 
    Target, Calendar, PieChart, Activity, 
    ChevronLeft, ChevronRight, Filter, BookOpen,
    Zap, Award, TrendingUp, Brain, AlertTriangle, Clock
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
    
    const getLocalDateStr = (d = new Date()) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60 * 1000));
        return local.toISOString().split('T')[0];
    };
    const [timelineDate, setTimelineDate] = useState(getLocalDateStr());
    const [selectedLog, setSelectedLog] = useState(null);
    
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
        let mindmapLogs = logs.filter(l => l.learning_notes && l.status === 'done');
        if (mindmapLogs.length === 0) {
            // Fallback 1: any completed logs
            mindmapLogs = logs.filter(l => l.status === 'done');
        }
        if (mindmapLogs.length === 0) {
            // Fallback 2: any logs at all
            mindmapLogs = logs;
        }
        mindmapLogs = mindmapLogs.slice(0, 12);
        
        // Group logs by routine category
        const routineGroups = {};
        mindmapLogs.forEach(l => {
            const rId = l.routine_id || 'flexible';
            const rTitle = l.snapshot_title || l.routines?.title || 'Flexible Logs';
            if (!routineGroups[rId]) {
                routineGroups[rId] = {
                    id: rId,
                    title: rTitle,
                    logs: []
                };
            }
            routineGroups[rId].logs.push(l);
        });
        const groupedRoutines = Object.values(routineGroups);

        // Compute layout dimensions
        const cx = 350;
        const cy = 350;
        
        // Calculate coordinates for parent routine nodes & leaf log nodes
        const routineNodes = [];
        const logNodes = [];
        const lines = [];

        groupedRoutines.forEach((group, groupIdx) => {
            const N = groupedRoutines.length;
            const angle = (groupIdx / N) * Math.PI * 2;
            const rRadius = isMobile ? 100 : 160;
            const rx = cx + Math.cos(angle) * rRadius;
            const ry = cy + Math.sin(angle) * rRadius;
            
            // Primary branch color
            const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];
            const color = colors[groupIdx % colors.length];

            routineNodes.push({
                id: group.id,
                title: group.title,
                x: rx,
                y: ry,
                color
            });

            // Connect core to routine
            lines.push({
                x1: cx,
                y1: cy,
                x2: rx,
                y2: ry,
                color,
                dashed: false,
                width: 2.5
            });

            // Distribute children log nodes around parent routine node
            const M = group.logs.length;
            group.logs.forEach((log, logIdx) => {
                const logRadius = isMobile ? 65 : 100;
                // Fan out around the routine node angle
                const fanAngle = M === 1 ? angle : angle - 0.5 + (logIdx / (M - 1)) * 1.0;
                const lx = rx + Math.cos(fanAngle) * logRadius;
                const ly = ry + Math.sin(fanAngle) * logRadius;

                const notesText = log.learning_notes || log.notes || log.notes_text || `Log #${log.id?.toString().slice(0, 4) || logIdx}`;
                logNodes.push({
                    id: log.id,
                    log,
                    title: notesText.length > 20 ? notesText.substring(0, 18) + '...' : notesText,
                    x: lx,
                    y: ly,
                    color
                });

                // Connect routine to log
                lines.push({
                    x1: rx,
                    y1: ry,
                    x2: lx,
                    y2: ly,
                    color,
                    dashed: true,
                    width: 1.5
                });
            });
        });

        return (
            <Card style={{ 
                minHeight: '700px', 
                position: 'relative', 
                overflowX: 'auto',
                overflowY: 'hidden',
                background: 'radial-gradient(circle at center, #13141f 0%, #08080c 100%)',
                border: '1.5px solid rgba(99, 102, 241, 0.15)',
                boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.8)',
                padding: 0
            }}>
                <div style={{ 
                    position: 'relative', 
                    width: '700px', 
                    height: '700px', 
                    margin: '0 auto'
                }}>
                    {/* SVG Connections Canvas */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                        {lines.map((line, idx) => (
                            <line 
                                key={idx}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke={line.color}
                                strokeWidth={line.width}
                                strokeDasharray={line.dashed ? "4,4" : "none"}
                                opacity="0.35"
                            />
                        ))}
                    </svg>

                    {/* Core Mind Node */}
                    <div style={{
                        position: 'absolute',
                        left: `${cx}px`,
                        top: `${cy}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10,
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(0,0,0,0.8) 100%)',
                        padding: '16px',
                        borderRadius: '50%',
                        border: '2px solid #6366f1',
                        boxShadow: '0 0 35px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(99,102,241,0.2)',
                        textAlign: 'center',
                        backdropFilter: 'blur(8px)',
                        cursor: 'default'
                    }}>
                        <Brain size={isMobile ? 24 : 36} style={{ color: '#6366f1', filter: 'drop-shadow(0 0 8px #6366f1)' }} />
                        <div style={{ marginTop: '4px' }}>
                            <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '1px' }}>CORE MIND</h4>
                        </div>
                    </div>

                    {/* Routine Category Nodes */}
                    {routineNodes.map(node => (
                        <div 
                            key={node.id}
                            style={{
                                position: 'absolute',
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 8,
                                padding: '6px 14px',
                                background: 'rgba(10, 11, 16, 0.9)',
                                border: `1.5px solid ${node.color}`,
                                borderRadius: '30px',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                boxShadow: `0 0 15px ${node.color}33`,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}
                        >
                            {node.title}
                        </div>
                    ))}

                    {/* Leaf Insight Log Nodes */}
                    {logNodes.map(node => (
                        <div 
                            key={node.id}
                            className="mindmap-leaf-node"
                            onClick={() => setSelectedLog(node.log)}
                            style={{
                                position: 'absolute',
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 6,
                                padding: '8px 12px',
                                background: 'rgba(20, 21, 30, 0.95)',
                                border: `1px solid rgba(255, 255, 255, 0.08)`,
                                borderLeft: `3px solid ${node.color}`,
                                borderRadius: '10px',
                                color: 'var(--text-secondary)',
                                fontSize: '9px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                transition: 'all 0.25s ease-out'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: node.color }} />
                                {node.title}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ position: 'absolute', bottom: '16px', width: '100%', textAlign: 'center', zIndex: 10 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '10px', margin: 0, fontWeight: 600 }}>
                        {isMobile ? 'Swipe horizontally to explore · Tap insights to read detail' : 'Interactive structured graph · Click insight nodes to view full entry'}
                    </p>
                </div>

                <style>{`
                    .mindmap-leaf-node:hover {
                        transform: translate(-50%, -50%) scale(1.08) !important;
                        border-color: rgba(255, 255, 255, 0.2) !important;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
                        color: white !important;
                        z-index: 12 !important;
                    }
                `}</style>
            </Card>
        );
    };
    const renderTimelineView = () => {
        const todayLogs = filteredLogs.filter(l => l.log_date === timelineDate && l.status === 'done' && l.actual_start_time);
        const hours = Array.from({ length: 24 }, (_, i) => i);

        const toMinutes = (time) => {
            if (!time) return 0;
            const [h, m] = time.slice(0, 5).split(':').map(Number);
            return h * 60 + m;
        };

        const navTimelineDate = (dir) => {
            const d = new Date(timelineDate);
            d.setDate(d.getDate() + dir);
            setTimelineDate(getLocalDateStr(d));
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {/* Date Switcher */}
                <div className="flex justify-between items-center bg-surface p-sm rounded-lg border border-border" style={{ marginBottom: 'var(--space-sm)' }}>
                    <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => navTimelineDate(-1)} />
                    <h3 style={{ margin: 0, fontWeight: 800 }}>
                        {new Date(timelineDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => navTimelineDate(1)} />
                </div>

                <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)', border: '1px solid var(--border)', minHeight: '1500px' }}>
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
                        <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--border)', minHeight: '1440px' }}>
                            {todayLogs.length === 0 ? (
                                <div style={{
                                    position: 'absolute', top: '50px', left: '20px', right: '20px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)'
                                }}>
                                    <Clock size={40} className="text-primary-300 mb-sm" />
                                    <h4>No active log timestamps on this date</h4>
                                    <p style={{ fontSize: 'var(--text-xs)', maxWidth: '300px', margin: '4px 0 0' }}>
                                        Navigate to another day or log routines for today to view their diary timeline mapping!
                                    </p>
                                </div>
                            ) : todayLogs.map((log, i) => {
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
                                            height: `${Math.max(height, 50)}px`,
                                            background: hasOverlap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                                            border: `1.5px solid ${hasOverlap ? 'var(--error-500)' : 'var(--primary-500)'}`,
                                            borderRadius: '12px', padding: '8px 12px', overflow: 'hidden',
                                            boxShadow: hasOverlap ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none',
                                            zIndex: hasOverlap ? 2 : 1,
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)' }}>
                                                {log.snapshot_title || log.routines?.title}
                                                {log.routines?.is_anonymous && <Badge variant="accent" size="xs" style={{ marginLeft: '6px' }}>FLEXIBLE</Badge>}
                                            </div>
                                            {hasOverlap && <Badge variant="error" size="xs"><AlertTriangle size={10} /> Overlap</Badge>}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                            <span>Start: {format12h(log.actual_start_time)}</span>
                                            <span>•</span>
                                            <span>Duration: {duration} mins</span>
                                        </div>
                                        {log.learning_notes && (
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                Notes: {log.learning_notes}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
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

            {selectedLog && (
                <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Insight Log Detail">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '8px' }}>
                            <Badge variant={selectedLog.status === 'done' ? 'success' : selectedLog.status === 'ignored' ? 'error' : 'warning'}>
                                {selectedLog.status.toUpperCase()}
                            </Badge>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {new Date(selectedLog.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--text-md)' }}>
                                {selectedLog.snapshot_title || selectedLog.routines?.title}
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Time Spent: {selectedLog.time_spent_minutes} mins · Scheduled at {format12h(selectedLog.snapshot_start_time || selectedLog.routines?.start_time)}
                            </p>
                        </div>
                        {selectedLog.learning_notes && (
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg)', borderRadius: 'var(--radius-md)', borderLeft: '3.5px solid var(--primary-500)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                <p style={{ margin: '0 0 6px 0', fontSize: '9px', fontWeight: 800, color: 'var(--primary-500)', letterSpacing: '1px', textTransform: 'uppercase' }}>Diary Entry</p>
                                <div className="markdown-body-zen">
                                    <ReactMarkdown>{selectedLog.learning_notes}</ReactMarkdown>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-sm)' }}>
                            <Button variant="ghost" onClick={() => setSelectedLog(null)}>Close</Button>
                        </div>
                    </div>
                </Modal>
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
