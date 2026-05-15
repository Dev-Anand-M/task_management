import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button } from '../../components/common';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ListTodo,
    HelpCircle,
    CheckCircle,
    Clock,
    Award,
    Star,
    Flame,
    Target,
    Zap
} from 'lucide-react';
import * as db from '../../services/database';
import { formatDate, getDifficultyColor } from '../../utils/constants';
import { format12h } from '../../utils/timeFormat';
import { useMiniReload } from '../../hooks/useMiniReload';
import { routineService } from '../../services/routineService';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Calendar = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [view, setView] = useState('month'); // 'month' | 'list'

    const loadEvents = useCallback(async (silent = false) => {
        if (!user?.id) return;
        try {
            if (!silent) setLoading(true);
            const [tasks, submissions, quizzes, quizAttempts, routines, routineLogs] = await Promise.race([
                Promise.all([
                    db.getTasks().catch(() => []),
                    db.getSubmissionsByUser(user.id).catch(() => []),
                    db.getQuizzes().catch(() => []),
                    db.getQuizAttemptsByUser(user.id).catch(() => []),
                    routineService.getRoutines().catch(() => []),
                    routineService.getAllLogs().catch(() => [])
                ]),
                new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 10000))
            ]);

            const allEvents = [];

            // Tasks as events (due date)
            (tasks || []).forEach(t => {
                const dueDate = t.due_date || t.deadline;
                if (dueDate) {
                    const sub = (submissions || []).find(s => s.task_id === t.id);
                    allEvents.push({
                        id: `task-${t.id}`,
                        title: t.title,
                        date: new Date(dueDate),
                        type: 'task',
                        status: sub ? sub.status : 'pending',
                        difficulty: t.difficulty,
                        points: t.points,
                        link: `/tasks/${t.id}`
                    });
                }
                // Also show creation date
                if (t.created_at) {
                    allEvents.push({
                        id: `task-created-${t.id}`,
                        title: `📋 ${t.title} assigned`,
                        date: new Date(t.created_at),
                        type: 'task-created',
                        status: 'info',
                        link: `/tasks/${t.id}`
                    });
                }
            });

            // Quizzes as events
            (quizzes || []).forEach(q => {
                if (q.created_at) {
                    const attempt = (quizAttempts || []).find(a => a.quiz_id === q.id);
                    allEvents.push({
                        id: `quiz-${q.id}`,
                        title: `📝 ${q.title}`,
                        date: new Date(q.created_at),
                        type: 'quiz',
                        status: attempt ? (attempt.passed ? 'passed' : 'failed') : 'available',
                        points: q.points,
                        link: `/quizzes/${q.id}`
                    });
                }
            });

            // Quiz attempts as events
            (quizAttempts || []).forEach(a => {
                allEvents.push({
                    id: `attempt-${a.id}`,
                    title: `${a.passed ? '✅' : '❌'} ${a.quizzes?.title || 'Quiz'} ${a.passed ? 'Passed' : 'Failed'}`,
                    date: new Date(a.created_at),
                    type: 'quiz-result',
                    status: a.passed ? 'passed' : 'failed',
                    score: a.score
                });
            });

            // Submissions as events
            (submissions || []).forEach(s => {
                allEvents.push({
                    id: `sub-${s.id}`,
                    title: `${s.status === 'approved' ? '🎉' : s.status === 'rejected' ? '🔄' : '📤'} ${s.tasks?.title || 'Task'} ${s.status}`,
                    date: new Date(s.submitted_at || s.created_at),
                    type: 'submission',
                    status: s.status,
                    score: s.score
                });
            });

            // Routines (Virtual events based on recurrence)
            // We'll show routines for the current viewed month (+/- some buffer)
            const calendarStart = new Date(year, month - 1, 1);
            const calendarEnd = new Date(year, month + 2, 0);
            
            (routines || []).forEach(r => {
                let iter = new Date(calendarStart);
                while (iter <= calendarEnd) {
                    const dayNum = iter.getDay() === 0 ? 7 : iter.getDay(); // 1=Mon, 7=Sun
                    if (r.days_of_week.includes(dayNum)) {
                        // Check if there's a log for this specific date
                        const dateStr = iter.toISOString().split('T')[0];
                        const log = (routineLogs || []).find(l => l.routine_id === r.id && l.log_date === dateStr);
                        
                        allEvents.push({
                            id: `routine-${r.id}-${dateStr}`,
                            title: `🔄 ${r.title}`,
                            date: new Date(iter),
                            type: 'routine',
                            status: log ? log.status : (iter < today ? 'missed' : 'scheduled'),
                            routineId: r.id,
                            startTime: r.start_time
                        });
                    }
                    iter.setDate(iter.getDate() + 1);
                }
            });

            setEvents(allEvents);
        } catch (e) {
            console.error('[Calendar] Load error:', e);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { loadEvents(); }, [loadEvents]);
    useMiniReload(() => loadEvents(true));

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        // Previous month filler
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
        }
        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
        }
        // Next month filler
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
        }
        return days;
    }, [year, month]);

    const getEventsForDay = (date) => {
        return events.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
        });
    };

    const today = new Date();
    const isToday = (date) => date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

    const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

    const navigate = (dir) => setCurrentDate(new Date(year, month + dir, 1));

    const getEventColor = (type, status) => {
        if (type === 'task' && status === 'approved') return 'var(--success-500)';
        if (type === 'task' && status === 'pending') return 'var(--warning-500)';
        if (type === 'task') return 'var(--primary-500)';
        if (type === 'quiz') return '#8b5cf6';
        if (type === 'quiz-result' && status === 'passed') return 'var(--success-500)';
        if (type === 'quiz-result') return 'var(--error-500)';
        if (type === 'submission' && status === 'approved') return 'var(--success-500)';
        if (type === 'submission' && status === 'rejected') return 'var(--error-500)';
        if (type === 'submission') return 'var(--warning-500)';
        if (type === 'routine' && status === 'done') return 'var(--success-500)';
        if (type === 'routine' && status === 'missed') return 'var(--error-500)';
        if (type === 'routine' && status === 'scheduled') return 'var(--primary-400)';
        if (type === 'routine') return 'var(--primary-500)';
        return 'var(--text-muted)';
    };

    // All events this month sorted by date for list view
    const monthEvents = useMemo(() => {
        return events
            .filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === year && d.getMonth() === month;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [events, year, month]);

    if (loading) return <div className="flex items-center justify-center" style={{ minHeight: '400px' }}><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CalendarIcon className="text-primary-400" />
                        Activity Calendar
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Tasks, quizzes, and milestones at a glance</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setView('month')} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', cursor: 'pointer',
                        fontWeight: 700, fontSize: 'var(--text-xs)',
                        background: view === 'month' ? 'var(--primary-500)' : 'var(--card)', color: view === 'month' ? 'white' : 'var(--text)'
                    }}>Month</button>
                    <button onClick={() => setView('list')} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', cursor: 'pointer',
                        fontWeight: 700, fontSize: 'var(--text-xs)',
                        background: view === 'list' ? 'var(--primary-500)' : 'var(--card)', color: view === 'list' ? 'white' : 'var(--text)'
                    }}>List</button>
                </div>
            </div>

            {/* Month Nav */}
            <Card style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="flex justify-between items-center">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft size={20} /></Button>
                    <h3 style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {MONTHS[month]} {year}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight size={20} /></Button>
                </div>
            </Card>

            {view === 'month' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-lg)' }} className="grid-2-mobile-1">
                    {/* Calendar Grid */}
                    <Card style={{ padding: 'var(--space-md)', overflow: 'hidden' }}>
                        {/* Day Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                            {DAYS.map(d => (
                                <div key={d} style={{
                                    textAlign: 'center', padding: '8px 0',
                                    fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.05em'
                                }}>{d}</div>
                            ))}
                        </div>
                        {/* Days Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                            {calendarDays.map((d, idx) => {
                                const dayEvents = getEventsForDay(d.date);
                                const isSelected = selectedDay && d.date.toDateString() === selectedDay.toDateString();
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => d.currentMonth && setSelectedDay(d.date)}
                                        style={{
                                            minHeight: '70px', padding: '6px',
                                            borderRadius: 'var(--radius-md)',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : isToday(d.date) ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                                            border: isSelected ? '2px solid var(--primary-500)' : isToday(d.date) ? '2px solid var(--primary-300)' : '1px solid var(--border)',
                                            cursor: d.currentMonth ? 'pointer' : 'default',
                                            opacity: d.currentMonth ? 1 : 0.3,
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 'var(--text-xs)', fontWeight: isToday(d.date) ? 800 : 600,
                                            color: isToday(d.date) ? 'var(--primary-500)' : 'var(--text)',
                                            marginBottom: '4px'
                                        }}>{d.day}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {dayEvents.slice(0, 3).map(e => (
                                                <div key={e.id} style={{
                                                    width: '100%', height: '4px', borderRadius: '2px',
                                                    background: getEventColor(e.type, e.status)
                                                }} />
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700 }}>+{dayEvents.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-md" style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border)' }}>
                            {[
                                { label: 'Task Due', color: 'var(--primary-500)' },
                                { label: 'Quiz', color: '#8b5cf6' },
                                { label: 'Routine Done', color: 'var(--success-500)' },
                                { label: 'Routine Scheduled', color: 'var(--primary-400)' },
                                { label: 'Missed/Failed', color: 'var(--error-500)' }
                            ].map(l => (
                                <div key={l.label} className="flex items-center gap-xs" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                                    {l.label}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Selected Day Detail Panel */}
                    <Card>
                        <h4 style={{ margin: '0 0 var(--space-md)', fontWeight: 800 }}>
                            {selectedDay ? (
                                <>
                                    <CalendarIcon size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                    {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </>
                            ) : 'Select a day'}
                        </h4>
                        {!selectedDay ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                                Click on a day to see events
                            </p>
                        ) : selectedDayEvents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                                <CalendarIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No events on this day</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {selectedDayEvents.map(e => (
                                    <div key={e.id} style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--surface)',
                                        borderLeft: `3px solid ${getEventColor(e.type, e.status)}`,
                                        transition: 'all 0.15s'
                                    }}>
                                        <div className="flex items-center gap-sm">
                                            {e.type === 'routine' ? <Zap size={14} className="text-primary-500" /> : (e.type === 'task' || e.type === 'task-created' ? <ListTodo size={14} /> : <HelpCircle size={14} />)}
                                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, flex: 1 }}>{e.title}</span>
                                            {e.type === 'routine' && e.startTime && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{format12h(e.startTime)}</span>}
                                        </div>
                                        <div className="flex items-center gap-sm" style={{ marginTop: '4px' }}>
                                            {e.points && <Badge variant="accent" size="xs">{e.points} XP</Badge>}
                                            {e.score !== undefined && <Badge variant="primary" size="xs">{e.score}%</Badge>}
                                            {e.link && (
                                                <Link to={e.link} style={{ fontSize: '10px', color: 'var(--primary-500)', fontWeight: 700 }}>View →</Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                /* List View */
                <Card>
                    {monthEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                            <CalendarIcon size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                            <h3>No events this month</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Navigate to a different month to see activity.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {monthEvents.map(e => (
                                <div key={e.id} style={{
                                    padding: 'var(--space-md)',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--surface)',
                                    borderLeft: `4px solid ${getEventColor(e.type, e.status)}`,
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                    transition: 'all 0.15s'
                                }}>
                                    <div style={{
                                        width: '44px', textAlign: 'center', flexShrink: 0
                                    }}>
                                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text)' }}>
                                            {new Date(e.date).getDate()}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {DAYS[new Date(e.date).getDay()]}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>{e.title}</p>
                                        <div className="flex items-center gap-sm" style={{ marginTop: '4px' }}>
                                            <Badge variant={e.type === 'routine' ? 'success' : e.type.includes('quiz') ? 'accent' : 'primary'} size="xs">{e.type.replace('-', ' ')}</Badge>
                                            {e.type === 'routine' && e.startTime && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{format12h(e.startTime)}</span>}
                                            {e.points && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{e.points} XP</span>}
                                        </div>
                                    </div>
                                    {e.link && (
                                        <Link to={e.link}><Button variant="ghost" size="xs">View</Button></Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default Calendar;
