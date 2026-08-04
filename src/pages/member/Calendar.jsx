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
import { supabase } from '../../lib/supabase';
import { formatDate, formatDeadline, getDifficultyColor } from '../../utils/constants';
import { format12h } from '../../utils/timeFormat';
import { useMiniReload } from '../../hooks/useMiniReload';
import { routineService } from '../../services/routineService';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toLocalISO = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
};

const getEventStatusLabel = (type, status, isAnonymous) => {
    if (type === 'sprint-start') return 'Sprint Kickoff';
    if (type === 'sprint-end') return 'Sprint Evaluation';
    if (type === 'routine') {
        if (status === 'done') return 'Completed';
        if (status === 'missed') return isAnonymous ? 'Expired' : 'Missed';
        return isAnonymous ? 'Flexible' : 'Scheduled';
    }
    if (type === 'task-deadline') {
        if (status === 'approved') return 'Task Completed';
        if (status === 'pending') return 'Review Pending';
        if (status === 'rejected') return 'Rejected';
        return 'Task Due';
    }
    if (type.includes('quiz')) {
        return 'Quiz Completed';
    }
    return type.replace('-', ' ');
};

const getEventBadgeVariant = (type, status, isAnonymous) => {
    if (type === 'sprint-start') return 'warning';
    if (type === 'sprint-end') return 'accent';
    if (type === 'routine') {
        if (status === 'done') return 'success';
        if (status === 'missed') return 'error';
        return isAnonymous ? 'accent' : 'primary';
    }
    if (type === 'task-deadline') {
        if (status === 'approved') return 'success';
        if (status === 'pending') return 'warning';
        if (status === 'rejected') return 'error';
        return 'primary';
    }
    if (type.includes('quiz')) {
        return 'accent';
    }
    return 'primary';
};

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
            const [tasks, submissions, quizzes, quizAttempts, routines, routineLogs, sprintTemplatesRes] = await Promise.race([
                Promise.all([
                    db.getTasks().catch(() => []),
                    db.getSubmissionsByUser(user.id).catch(() => []),
                    db.getQuizzes().catch(() => []),
                    db.getQuizAttemptsByUser(user.id).catch(() => []),
                    routineService.getAllRoutinesForHistory().catch(() => []),
                    routineService.getAllLogs().catch(() => []),
                    supabase.from('sprint_templates').select('*').order('week_number', { ascending: true }).catch(() => ({ data: [] }))
                ]),
                new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 10000))
            ]);

            const sprintTemplates = sprintTemplatesRes?.data || [];
            const allEvents = [];
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            // Format Sprint Weeks / Milestones as events
            (sprintTemplates || []).forEach(st => {
                if (st.start_date) {
                    const startDateObj = new Date(`${st.start_date}T09:00:00`);
                    if (!isNaN(startDateObj.getTime())) {
                        allEvents.push({
                            id: `sprint-start-${st.id || st.week_number}`,
                            title: `${st.is_showcase ? '🃏' : '⚡'} Sprint W${st.week_number}: ${st.title}`,
                            date: startDateObj,
                            type: 'sprint-start',
                            status: 'active',
                            weekNumber: st.week_number,
                            isShowcase: !!st.is_showcase,
                            link: `/sprint-tracker?week=${st.week_number}`
                        });
                    }
                }
                if (st.end_date) {
                    const endDateObj = new Date(`${st.end_date}T23:59:59`);
                    if (!isNaN(endDateObj.getTime())) {
                        allEvents.push({
                            id: `sprint-end-${st.id || st.week_number}`,
                            title: `🏁 W${st.week_number} Eval Due: ${st.title}`,
                            date: endDateObj,
                            type: 'sprint-end',
                            status: 'deadline',
                            weekNumber: st.week_number,
                            isShowcase: !!st.is_showcase,
                            link: `/sprint-tracker?week=${st.week_number}`
                        });
                    }
                }
            });

            // Format submissions & tasks as events
            (submissions || []).forEach(s => {
                const task = (tasks || []).find(t => t.id === s.task_id);
                if (task && s.evaluated_at) {
                    allEvents.push({
                        id: `task-${s.id}`,
                        title: `📝 Sub: ${task.title}`,
                        date: new Date(s.evaluated_at),
                        type: 'task',
                        status: s.status,
                        score: s.score,
                        points: task.points,
                        link: `/tasks`
                    });
                }
            });

            // Format task deadlines as events
            const myTasks = (tasks || []).filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
            myTasks.forEach(task => {
                if (task.deadline) {
                    const sub = (submissions || []).find(s => s.task_id === task.id);
                    const status = sub ? sub.status : 'not-started';
                    allEvents.push({
                        id: `task-deadline-${task.id}`,
                        title: `🚨 Deadline: ${task.title}`,
                        date: new Date(task.deadline),
                        type: 'task-deadline',
                        status: status,
                        points: task.points,
                        link: `/tasks/${task.id}`
                    });
                }
            });

            // Format quiz attempts as events
            (quizAttempts || []).forEach(att => {
                const quiz = (quizzes || []).find(q => q.id === att.quiz_id);
                if (quiz && att.completed_at) {
                    allEvents.push({
                        id: `quiz-${att.id}`,
                        title: `🏆 Quiz: ${quiz.title}`,
                        date: new Date(att.completed_at),
                        type: 'quiz',
                        status: att.passed ? 'passed' : 'failed',
                        score: att.score,
                        points: quiz.points,
                        link: `/quizzes`
                    });
                }
            });

            // Routines (Virtual events based on recurrence)
            // We'll show routines for the current viewed month (+/- some buffer)
            const calendarStart = new Date(year, month - 1, 1);
            const calendarEnd = new Date(year, month + 2, 0);
            const todayStr = toLocalISO(new Date());

            (routines || []).forEach(r => {
                let iter = new Date(calendarStart);
                while (iter <= calendarEnd) {
                    const dayNum = iter.getDay() === 0 ? 7 : iter.getDay(); // 1=Mon, 7=Sun
                    if (r.days_of_week.includes(dayNum)) {
                        const dateStr = toLocalISO(iter);
                        const createdDate = toLocalISO(r.created_at);
                        
                        // Check if within valid date range
                        const isAfterCreation = dateStr >= createdDate;
                        const isBeforeDeadline = !r.deadline || dateStr <= r.deadline;

                        if (isAfterCreation && isBeforeDeadline) {
                            // Check if there's a log for this specific date
                            const log = (routineLogs || []).find(l => l.routine_id === r.id && l.log_date === dateStr);
                            
                            // For inactive/deleted routines, only show dates with actual logs
                            if (r.is_active || log) {
                                let eventStatus = 'scheduled';
                                if (log && (log.status === 'done' || log.status === 'completed')) {
                                    eventStatus = 'done';
                                } else if (dateStr < todayStr) {
                                    eventStatus = 'missed';
                                } else if (dateStr === todayStr) {
                                    if (log && (log.status === 'done' || log.status === 'completed')) {
                                        eventStatus = 'done';
                                    } else if (r.is_anonymous) {
                                        eventStatus = 'scheduled';
                                    } else {
                                        const [h, m] = (r.start_time || '00:00').split(':').map(Number);
                                        const routineStartTime = new Date();
                                        routineStartTime.setHours(h, m, 0, 0);
                                        const missTime = new Date(routineStartTime.getTime() + 15 * 60 * 1000);
                                        if (new Date() > missTime) {
                                            eventStatus = 'missed';
                                        } else {
                                            eventStatus = 'scheduled';
                                        }
                                    }
                                } else {
                                    eventStatus = 'scheduled';
                                }

                                allEvents.push({
                                    id: `routine-${r.id}-${dateStr}`,
                                    title: `${r.is_anonymous ? '⚡' : '🔄'} ${r.title}`,
                                    date: new Date(iter),
                                    type: 'routine',
                                    status: eventStatus,
                                    routineId: r.id,
                                    startTime: r.start_time,
                                    isAnonymous: !!r.is_anonymous
                                });
                            }
                        }
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
    }, [user?.id, currentDate]);

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
    today.setHours(0, 0, 0, 0);
    const isToday = (date) => date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

    const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

    const navigate = (dir) => setCurrentDate(new Date(year, month + dir, 1));

    const getEventColor = (type, status, isAnonymous) => {
        if (type === 'sprint-start') return '#f59e0b'; // Amber Gold
        if (type === 'sprint-end') return '#a855f7'; // Purple Accent
        if (type === 'task' && status === 'approved') return '#10b981'; // Green
        if (type === 'task' && status === 'pending') return '#f59e0b'; // Amber
        if (type === 'task') return '#f59e0b'; // Amber
        if (type === 'quiz') return '#8b5cf6'; // Purple
        if (type === 'quiz-result' && status === 'passed') return '#10b981';
        if (type === 'quiz-result') return '#ef4444';
        if (type === 'submission' && status === 'approved') return '#10b981';
        if (type === 'submission' && status === 'rejected') return '#ef4444';
        if (type === 'submission') return '#f59e0b';
        if (type === 'routine' && status === 'done') return '#10b981'; // Green
        if (type === 'routine' && status === 'missed') return '#ef4444'; // Red
        if (type === 'routine' && status === 'scheduled') return isAnonymous ? '#ec4899' : '#3b82f6'; // Pink vs Blue
        if (type === 'routine') return isAnonymous ? '#ec4899' : '#3b82f6';
        if (type === 'task-deadline' && status === 'approved') return '#10b981';
        if (type === 'task-deadline' && status === 'pending') return '#f59e0b';
        if (type === 'task-deadline' && status === 'rejected') return '#ef4444';
        if (type === 'task-deadline') return '#f59e0b';
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
            <div className="flex flex-mobile-col justify-between items-start mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--text-xl)' }}>
                        <CalendarIcon className="text-primary-400" size={24} />
                        Activity Calendar
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 'var(--text-sm)' }}>Tasks, quizzes, sprint milestones, and routines at a glance</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
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
                                                    background: getEventColor(e.type, e.status, e.isAnonymous)
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
                                { label: 'Sprint Kickoff', color: '#f59e0b' },
                                { label: 'Sprint Eval Due', color: '#a855f7' },
                                { label: 'Task Due', color: '#f59e0b' },
                                { label: 'Quiz', color: '#8b5cf6' },
                                { label: 'Routine Done', color: '#10b981' },
                                { label: 'Routine Scheduled', color: '#3b82f6' },
                                { label: 'Flexible Routine', color: '#ec4899' },
                                { label: 'Missed/Expired', color: '#ef4444' }
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
                                        borderLeft: `3px solid ${getEventColor(e.type, e.status, e.isAnonymous)}`,
                                        transition: 'all 0.15s'
                                    }}>
                                        <div className="flex items-center gap-sm">
                                            {e.type.startsWith('sprint') ? <Zap size={14} style={{ color: e.type === 'sprint-start' ? '#f59e0b' : '#a855f7' }} /> : e.type === 'routine' ? <Zap size={14} className={e.status === 'done' ? "text-success-500" : "text-primary-500"} /> : (e.type.startsWith('task') ? <ListTodo size={14} /> : <HelpCircle size={14} />)}
                                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, flex: 1 }}>{e.title}</span>
                                            {e.type === 'routine' && e.startTime && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{format12h(e.startTime)}</span>}
                                            {e.type === 'routine' && e.status === 'done' && (
                                                <Button 
                                                    size="xs" 
                                                    variant="ghost" 
                                                    onClick={async () => {
                                                        if (confirm('Reset this log?')) {
                                                            await routineService.deleteLog(e.routineId, toLocalISO(e.date));
                                                            loadEvents(true);
                                                        }
                                                    }}
                                                    style={{ color: 'var(--error-500)', padding: '2px 4px', height: 'auto' }}
                                                >
                                                    Reset
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-sm" style={{ marginTop: '4px', flexWrap: 'wrap' }}>
                                            <Badge variant={getEventBadgeVariant(e.type, e.status, e.isAnonymous)} size="xs">
                                                {getEventStatusLabel(e.type, e.status, e.isAnonymous)}
                                            </Badge>
                                            {e.points !== undefined && e.points !== null && <Badge variant="accent" size="xs">{e.points} XP</Badge>}
                                            {e.score !== undefined && <Badge variant="primary" size="xs">{e.score}%</Badge>}
                                            {e.type === 'task-deadline' && (
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    {formatDeadline(e.date)}
                                                </span>
                                            )}
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
                /* Grouped List View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {(() => {
                        const groups = {};
                        monthEvents.forEach(e => {
                            const dateStr = new Date(e.date).toDateString();
                            if (!groups[dateStr]) groups[dateStr] = [];
                            groups[dateStr].push(e);
                        });
                        
                        const groupedList = Object.entries(groups).map(([dateStr, list]) => ({
                            dateStr,
                            dateObj: new Date(dateStr),
                            eventsList: list
                        })).sort((a, b) => a.dateObj - b.dateObj);

                        if (groupedList.length === 0) {
                            return (
                                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                    <CalendarIcon size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                    <h3>No events this month</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>Navigate to a different month to see activity.</p>
                                </Card>
                            );
                        }

                        return groupedList.map(group => (
                            <Card key={group.dateStr} style={{ padding: 'var(--space-md)' }}>
                                <div style={{ 
                                    borderBottom: '1px solid var(--border)', 
                                    paddingBottom: '8px', 
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--primary-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CalendarIcon size={14} />
                                        {group.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </h4>
                                    <Badge variant="secondary" size="xs">{group.eventsList.length} events</Badge>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {group.eventsList.map(e => (
                                        <div key={e.id} style={{
                                            padding: 'var(--space-sm) var(--space-md)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface)',
                                            borderLeft: `4px solid ${getEventColor(e.type, e.status, e.isAnonymous)}`,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 'var(--space-md)',
                                            flexWrap: 'wrap'
                                        }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{e.title}</span>
                                                    {e.type === 'routine' && e.startTime && (
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{format12h(e.startTime)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-sm" style={{ marginTop: '4px', flexWrap: 'wrap' }}>
                                                    <Badge variant="primary" size="xs">{e.type.replace('-', ' ')}</Badge>
                                                    <Badge variant={getEventBadgeVariant(e.type, e.status, e.isAnonymous)} size="xs">
                                                        {getEventStatusLabel(e.type, e.status, e.isAnonymous)}
                                                    </Badge>
                                                    {e.points !== undefined && e.points !== null && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{e.points} XP</span>}
                                                </div>
                                            </div>
                                            {e.link && (
                                                <Link to={e.link}><Button variant="ghost" size="xs">View</Button></Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ));
                    })()}
                </div>
            )}
        </div>
    );
};

export default Calendar;
