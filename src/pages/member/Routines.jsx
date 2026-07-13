import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { supabase } from '../../lib/supabase';
import { format12h, minutesTo12h, getLocalDatePickerDate } from '../../utils/timeFormat';
import { Card, Badge, Button, Input, Modal, ProgressBar, LoadingSpinner } from '../../components/common';
import { 
    Check, Clock, Trash2, Plus, AlertTriangle, CheckCircle, Circle, X, Book, Zap, Calendar, BookOpen, Brain,
    ChevronLeft, ChevronRight
} from 'lucide-react';

const MentionInput = ({ value, onChange, placeholder, materials, label }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filter, setFilter] = useState('');
    const [cursorPos, setCursorPos] = useState(0);

    const handleTextChange = (e) => {
        const text = e.target.value;
        const pos = e.target.selectionStart;
        setCursorPos(pos);
        onChange(text);

        const lastHash = text.lastIndexOf('#', pos - 1);
        if (lastHash !== -1 && !text.slice(lastHash, pos).includes(' ')) {
            setShowSuggestions(true);
            setFilter(text.slice(lastHash + 1, pos).toLowerCase());
        } else {
            setShowSuggestions(false);
        }
    };

    const selectMaterial = (title) => {
        const lastHash = value.lastIndexOf('#', cursorPos - 1);
        const before = value.slice(0, lastHash);
        const after = value.slice(cursorPos);
        onChange(`${before}#${title}${after}`);
        setShowSuggestions(false);
    };

    const filtered = (materials || []).filter(m => m.title.toLowerCase().includes(filter));

    return (
        <div style={{ position: 'relative' }}>
            {label && <label className="input-label">{label}</label>}
            <textarea 
                className="input" 
                style={{ minHeight: '100px', lineHeight: 1.6 }}
                placeholder={placeholder}
                value={value}
                onChange={handleTextChange}
            />
            {showSuggestions && filtered.length > 0 && (
                <Card style={{ 
                    position: 'absolute', bottom: '100%', left: 0, right: 0, 
                    zIndex: 100, maxHeight: '200px', overflowY: 'auto',
                    boxShadow: 'var(--shadow-xl)', border: '1px solid var(--primary-500)',
                    padding: '8px'
                }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>STUDY MATERIALS</p>
                    {filtered.map(m => (
                        <div 
                            key={m.id} 
                            onClick={() => selectMaterial(m.title)}
                            style={{ 
                                padding: '8px 12px', cursor: 'pointer', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)'
                            }}
                            className="hover:bg-primary-50"
                        >
                            <Book size={14} className="text-primary-500" />
                            {m.title}
                        </div>
                    ))}
                </Card>
            )}
        </div>
    );
};
import { useNavigate } from 'react-router-dom';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RoutineItem = ({ routine, log, onUpdate, onDelete, onResetLog, nextAlarmInfo, materials, allLogs, selectedDate, navDate }) => {
    const [actualStartTime, setActualStartTime] = useState(
        log?.actual_start_time || 
        (routine.is_anonymous ? new Date().toTimeString().slice(0, 5) : routine.start_time.slice(0, 5))
    );
    const [actualDuration, setActualDuration] = useState(log?.time_spent_minutes || routine.duration_minutes || 60);
    const [notes, setNotes] = useState(log?.learning_notes || '');
    const [showDetails, setShowDetails] = useState(false);
    const isDone = log?.status === 'done';
    const isIgnored = log?.status === 'ignored';
    const isPostponed = log?.status === 'postponed';
    
    // Is this the very next alarm?
    const isNext = nextAlarmInfo?.title === routine.title;

    const handleSave = async () => {
        // Conflict check for logs
        const logsArray = Object.values(allLogs || {});
        const conflicts = routineService.checkLogConflicts(logsArray, {
            start_time: actualStartTime,
            minutes: actualDuration,
            routine_id: routine.id
        });

        if (conflicts.length > 0) {
            alert(`🛑 STRICT BLOCK: Time Conflict Detected!\n\nThis slot overlaps with another logged activity.\n\nYou must adjust your start time or duration to avoid overlapping.`);
            return;
        }

        await onUpdate(routine.id, {
            time_spent_minutes: actualDuration,
            actual_start_time: actualStartTime,
            learning_notes: notes,
            status: 'done',
            actual_response_time: new Date().toISOString(),
            log_date: selectedDate
        });
        setShowDetails(false);
    };

    const handlePostpone = async (minutes) => {
        // Calculate new time for today only
        const now = new Date();
        const newTime = new Date(now.getTime() + minutes * 60000);
        const timeStr = newTime.toTimeString().slice(0, 8);

        await onUpdate(routine.id, {
            status: 'postponed',
            start_time: timeStr,
            postponed_count: (log?.postponed_count || 0) + 1,
            log_date: selectedDate
        });
        setShowDetails(false);
    };

    const handleIgnore = async () => {
        await onUpdate(routine.id, {
            status: 'ignored',
            log_date: selectedDate
        });
        setShowDetails(false);
    };

    const isLocked = !routine.is_anonymous && !isDone && !isIgnored && (
        new Date().toTimeString().slice(0, 5) < routine.start_time.slice(0, 5)
    );

    return (
        <Card style={{ 
            borderLeft: `4px solid ${
                isDone ? 'var(--success-500)' : 
                isIgnored ? 'var(--error-500)' : 
                isPostponed ? 'var(--warning-500)' : 
                isNext ? 'var(--primary-500)' : 'var(--border)'
            }`,
            opacity: (isDone || isIgnored || isLocked) ? 0.8 : 1,
            transition: 'all 0.3s',
            background: isNext ? 'rgba(99, 102, 241, 0.03)' : 'var(--surface)'
        }}>
            <div className="flex items-center gap-md">
                <button 
                    disabled={isLocked}
                    onClick={() => setShowDetails(!showDetails)}
                    style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', padding: 0 }}
                >
                    {isDone ? <CheckCircle size={24} style={{ color: 'var(--success-500)' }} /> : 
                     isIgnored ? <X size={24} style={{ color: 'var(--error-500)' }} /> :
                     <Circle size={24} style={{ color: isLocked ? 'var(--border)' : 'var(--text-muted)' }} />}
                </button>
                
                <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-sm">
                        <p style={{ margin: 0, fontWeight: 700, textDecoration: (isDone || isIgnored) ? 'line-through' : 'none', color: isLocked ? 'var(--text-muted)' : 'inherit' }}>
                            {routine.title}
                            {isLocked && <span style={{ fontSize: '9px', fontWeight: 400, marginLeft: '8px' }}>(Locked until {format12h(routine.start_time)})</span>}
                        </p>
                        {isNext && !isDone && !isIgnored && (
                            <Badge variant="primary" className="animate-pulse">
                                NEXT IN {nextAlarmInfo.minutes} MINS
                            </Badge>
                        )}
                        {isIgnored && <Badge variant="error">Missed</Badge>}
                        {log?.postponed_count > 0 && <Badge variant="warning" size="xs">Postponed {log.postponed_count}x</Badge>}
                    </div>
                    <div className="flex items-center gap-sm" style={{ marginTop: '2px' }}>
                        <Badge variant="secondary" size="xs"><Clock size={10} /> {format12h(routine.start_time)}</Badge>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {routine.days_of_week.map(d => DAYS[d-1]).join(', ')}
                        </span>
                    </div>
                </div>

                <div className="flex gap-sm items-center">
                    {(isDone || isIgnored) && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onResetLog(routine.id)} 
                            style={{ color: 'var(--text-muted)', fontSize: '10px' }}
                        >
                            Reset
                        </Button>
                    )}
                    {!isDone && !isIgnored && (
                        <>
                            {!isLocked && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <Button variant="ghost" size="xs" onClick={() => handlePostpone(15)}>+15m</Button>
                                    <Button variant="ghost" size="xs" onClick={() => handlePostpone(30)}>+30m</Button>
                                </div>
                            )}
                            <Button variant="primary" size="sm" disabled={isLocked} onClick={() => setShowDetails(true)} icon={isLocked ? Clock : Check}>
                                {isLocked ? 'Locked' : 'Log'}
                            </Button>
                        </>
                    )}
                    <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {showDetails && (
                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    {!isDone && !isIgnored && (
                        <div style={{ marginBottom: 'var(--space-md)', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid var(--error-500)' }}>
                            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--error-500)', fontWeight: 600 }}>
                                <AlertTriangle size={12} /> Respond within 15 mins or it marks as Ignored!
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-md">
                        <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--primary-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={14} className="text-primary-500" />
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                                Target Day: <span style={{ color: 'var(--primary-500)' }}>{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                            </span>
                            {new Date().getHours() < 5 && selectedDate === getLocalDatePickerDate() && (
                                <Button 
                                    variant="ghost" 
                                    size="xs" 
                                    onClick={() => navDate(-1)}
                                    style={{ marginLeft: 'var(--space-sm)', fontSize: '9px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error-500)' }}
                                >
                                    Log for Yesterday?
                                </Button>
                            )}
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                (Use date arrows at top to log for other days)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-md">
                            <div>
                                <label className="input-label">Actual Start</label>
                                <div className="flex items-center gap-xs">
                                    <Input 
                                        type="time" 
                                        value={actualStartTime} 
                                        onChange={e => setActualStartTime(e.target.value)} 
                                        required
                                        style={{ flex: 1 }}
                                    />
                                    <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', padding: '2px' }}>
                                        {['AM', 'PM'].map(p => {
                                            const isPM = parseInt(actualStartTime.split(':')[0]) >= 12;
                                            const active = (p === 'PM' && isPM) || (p === 'AM' && !isPM);
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => {
                                                        const [h, m] = actualStartTime.split(':').map(Number);
                                                        let newH = h;
                                                        if (p === 'PM' && h < 12) newH = h + 12;
                                                        if (p === 'AM' && h >= 12) newH = h - 12;
                                                        setActualStartTime(`${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                                                    }}
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 800,
                                                        cursor: 'pointer', background: active ? 'var(--primary-500)' : 'transparent',
                                                        color: active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Time Spent (mins)</label>
                                <Input 
                                    type="number" 
                                    value={actualDuration} 
                                    onChange={e => setActualDuration(parseInt(e.target.value) || 0)} 
                                    min="1"
                                    required
                                />
                            </div>
                        </div>
                        <MentionInput 
                            label="What did you learn today? (Diary Entry)"
                            placeholder="Topics covered, insights, or tasks completed... Type # to mention materials."
                            value={notes}
                            onChange={setNotes}
                            materials={materials}
                        />
                        <div className="flex gap-sm justify-end">
                            {!isDone && !isIgnored && <Button variant="ghost" onClick={handleIgnore} style={{ color: 'var(--error-500)' }}>Mark Ignored</Button>}
                            <Button variant="ghost" onClick={() => setShowDetails(false)}>Minimize</Button>
                            <Button variant="primary" onClick={handleSave}>{isDone ? 'Update Entry' : 'Finish & Save to Diary'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

const Routines = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [routines, setRoutines] = useState([]);
    const [logs, setLogs] = useState({}); // routineId -> log object
    const [showAdd, setShowAdd] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getLocalDatePickerDate());
    
    const [form, setForm] = useState({ 
        title: '', 
        start_time: '08:00:00', 
        duration_minutes: 60,
        days_of_week: [1,2,3,4,5], 
        deadline: '', 
        description: '',
        is_anonymous: false
    });
    const [activeTimetable, setActiveTimetable] = useState(null);
    const [nextAlarmInfo, setNextAlarmInfo] = useState(null);
    const [studyMaterials, setStudyMaterials] = useState([]);

    const fetchMaterials = async () => {
        if (!user) return;
        try {
            const { data: notes } = await supabase.from('study_notes').select('id, title').eq('user_id', user.id);
            const { data: shared } = await supabase.from('knowledge_base').select('id, title').eq('classroom_id', user.classroom_id);
            setStudyMaterials([...(notes || []), ...(shared || [])]);
        } catch (e) { console.warn('Failed to fetch materials:', e); }
    };

    useEffect(() => {
        fetchData();
        fetchMaterials();
        
        const channel = supabase.channel('routines_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'routines' }, fetchData)
            .subscribe();
            
        return () => supabase.removeChannel(channel);
    }, [user?.id]);
        
    useEffect(() => {
        const handleNextAlarm = (e) => setNextAlarmInfo(e.detail);
        window.addEventListener('next-alarm-update', handleNextAlarm);
        
        if (user?.id) {
            fetchData();
            checkTodayTimetable();
        }
        
        return () => window.removeEventListener('next-alarm-update', handleNextAlarm);
    }, [user?.id, selectedDate]);

    const checkTodayTimetable = async () => {
        try {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStart = getLocalDatePickerDate(new Date(today.setDate(diff)));
            const data = await routineService.getTimetable(weekStart);
            if (data) setActiveTimetable(data.schedule_data);
        } catch (err) {
            console.error("Failed to fetch current timetable:", err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [routineData, logData] = await Promise.all([
                routineService.getRoutines(),
                routineService.getLogsForDate(selectedDate)
            ]);
            
            setRoutines(routineData);
            
            // Map logs for easy access
            const logMap = {};
            logData.forEach(l => {
                logMap[l.routine_id] = l;
            });
            setLogs(logMap);
        } catch (err) {
            console.error('Failed to fetch routines:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        
        // Conflict Detection
        const conflicts = routineService.checkConflicts(routines, form);
        if (conflicts.length > 0) {
            const confirmCreate = confirm(`⚠️ Conflict Detected!\n\nThis routine overlaps with "${conflicts[0].title}" at ${conflicts[0].start_time.slice(0, 5)}.\n\nDo you want to create it anyway?`);
            if (!confirmCreate) return;
        }

        try {
            await routineService.createRoutine(form);
            setShowAdd(false);
            setForm({ title: '', start_time: '08:00:00', days_of_week: [1,2,3,4,5], deadline: '', description: '' });
            fetchData();
        } catch (err) {
            alert('Failed to create routine: ' + err.message);
        }
    };

    const handleUpdateLog = async (routineId, updates) => {
        try {
            await routineService.updateLog(routineId, updates);
            fetchData();
        } catch (err) {
            console.error('Update log failed:', err);
        }
    };

    const handleResetLog = async (routineId) => {
        if (confirm('Clear today\'s log for this routine?')) {
            try {
                await routineService.deleteLog(routineId, selectedDate);
                fetchData();
            } catch (err) {
                console.error('Reset log failed:', err);
            }
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this routine?')) {
            try {
                await routineService.deleteRoutine(id);
                fetchData();
            } catch (err) {
                console.error('Delete failed:', err);
            }
        }
    };

    const toggleDay = (day) => {
        setForm(f => ({ 
            ...f, 
            days_of_week: f.days_of_week.includes(day) 
                ? f.days_of_week.filter(d => d !== day) 
                : [...f.days_of_week, day] 
        }));
    };

    const getFreeSlots = () => {
        const today = new Date(selectedDate).getDay() || 7; // 1-7
        const todayRoutines = routines.filter(r => r.days_of_week.includes(today) && r.is_active);
        
        const intervals = todayRoutines.map(r => {
            const [h, m] = r.start_time.split(':').map(Number);
            const start = h * 60 + m;
            return { start, end: start + (r.duration_minutes || 60) };
        }).sort((a, b) => a.start) || [];

        const freeSlots = [];
        let current = 480; // Start at 8 AM
        const dayEnd = 1320; // End at 10 PM

        intervals.forEach(int => {
            if (int.start > current + 15) {
                freeSlots.push({ start: current, end: int.start });
            }
            current = Math.max(current, int.end);
        });

        if (current < dayEnd) {
            freeSlots.push({ start: current, end: dayEnd });
        }

        return freeSlots;
    };

    const formatMinutes = (total) => {
        const h = Math.floor(total / 60);
        const m = total % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const handleAddSlot = (startMinutes) => {
        setForm({
            ...form,
            start_time: `${formatMinutes(startMinutes)}:00`,
            is_anonymous: false
        });
        setShowAdd(true);
    };

    const navDate = (dir) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + dir);
        setSelectedDate(getLocalDatePickerDate(d));
    };

    // Filter routines active for selected date
    const activeRoutines = routines.filter(r => {
        const d = new Date(selectedDate);
        const day = d.getDay() === 0 ? 7 : d.getDay();
        
        // Don't show routines before they were created
        const toLocalISO = (date) => {
            const dr = new Date(date);
            const offset = dr.getTimezoneOffset();
            const local = new Date(dr.getTime() - (offset * 60 * 1000));
            return local.toISOString().split('T')[0];
        };
        const createdDate = toLocalISO(r.created_at);
        
        // Allow logging for 'Yesterday' even if created today (grace period for late-night additions)
        const todayISO = toLocalISO(new Date());
        const yesterday = new Date(new Date().getTime() - 86400000);
        const yesterdayISO = toLocalISO(yesterday);
        const isGracePeriod = (selectedDate === yesterdayISO && createdDate === todayISO);

        if (createdDate > selectedDate && !isGracePeriod) return false;
        
        // Don't show if after deadline
        if (r.deadline && new Date(r.deadline) < d) return false;
        
        return r.days_of_week.includes(day);
    });

    const doneCount = activeRoutines.filter(r => logs[r.id]?.status === 'done').length;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            <div className="flex flex-mobile-col justify-between items-start mb-xl gap-md">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Clock className="text-primary-500" /> My Routines
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Enforce discipline, track your progress</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="ghost" icon={Calendar} onClick={() => navigate('/timetable')}>View AI Timetable</Button>
                    <Button variant="ghost" icon={BookOpen} onClick={() => navigate('/diary')}>Learning Diary</Button>
                    <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Add Routine</Button>
                </div>
            </div>

            {activeTimetable && (
                <Card style={{ 
                    marginBottom: 'var(--space-xl)', 
                    background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--bg) 100%)',
                    border: '1px solid var(--primary-500)'
                }}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-md">
                            <Brain className="text-primary-500" />
                            <div>
                                <h3 style={{ margin: 0 }}>Today's AI Strategy</h3>
                                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                    Based on your weekly architecture
                                </p>
                            </div>
                        </div>
                        <Badge variant="primary">Active Plan</Badge>
                    </div>
                </Card>
            )}

            {/* Date Selector */}
            <div className="flex justify-between items-center mb-lg" style={{ background: 'var(--surface)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => navDate(-1)} />
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 800 }}>
                        {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                </div>
                <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => navDate(1)} />
            </div>

            {/* Daily Stats */}
            <Card style={{ marginBottom: 'var(--space-xl)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(167, 139, 250, 0.05))' }}>
                <div className="flex items-center gap-lg">
                    <div style={{ 
                        width: '70px', height: '70px', borderRadius: '24px', 
                        background: 'var(--surface)', border: '3px solid var(--primary-500)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--primary-500)'
                    }}>
                        {activeRoutines.length ? Math.round((doneCount / activeRoutines.length) * 100) : 0}%
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0 }}>Consistency Today</h3>
                        <p style={{ margin: '4px 0 12px 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            {doneCount} of {activeRoutines.length} routines completed
                        </p>
                        <ProgressBar value={activeRoutines.length ? (doneCount / activeRoutines.length) * 100 : 0} color="var(--primary-500)" />
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="flex justify-center p-xl"><LoadingSpinner /></div>
            ) : activeRoutines.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <AlertTriangle size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
                    <h3>No routines for today</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Enjoy your break or create a new routine!</p>
                </Card>
            ) : (
                <div className="flex flex-col gap-md">
                    {activeRoutines.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(routine => (
                        <RoutineItem 
                            key={routine.id} 
                            routine={routine} 
                            log={logs[routine.id]}
                            onUpdate={handleUpdateLog}
                            onDelete={() => handleDelete(routine.id)}
                            onResetLog={handleResetLog}
                            nextAlarmInfo={nextAlarmInfo}
                            materials={studyMaterials}
                            allLogs={logs}
                            selectedDate={selectedDate}
                            navDate={navDate}
                        />
                    ))}
                </div>
            )}

            <div style={{ marginTop: 'var(--space-2xl)' }}>
                <div className="flex items-center gap-sm mb-md">
                    <Zap size={20} className="text-warning-500" />
                    <h3 style={{ margin: 0 }}>Available Slots Today</h3>
                </div>
                <div className="flex flex-wrap gap-sm">
                    {getFreeSlots().map((slot, i) => (
                        <button 
                            key={i}
                            onClick={() => handleAddSlot(slot.start)}
                            style={{ 
                                padding: '12px 20px', background: 'var(--surface)', border: '1px dashed var(--primary-500)',
                                borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left'
                            }}
                            className="hover:bg-primary-50 hover:border-solid"
                        >
                            <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary-500)' }}>FREE WINDOW</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                                {minutesTo12h(slot.start)} - {minutesTo12h(slot.end)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                ({slot.end - slot.start} mins available)
                            </span>
                        </button>
                    ))}
                    {getFreeSlots().length === 0 && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Your day is fully packed! Great architecture.
                        </p>
                    )}
                </div>
            </div>

            {/* Add Routine Modal */}
            <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Create Routine">
                <form onSubmit={handleCreate} className="flex flex-col gap-md">
                    <Input 
                        label="Task Title" 
                        placeholder="e.g. Study DSA" 
                        value={form.title} 
                        onChange={e => setForm({...form, title: e.target.value})} 
                        required 
                    />
                    <MentionInput 
                        label="Description"
                        placeholder="What is this routine about? Type # to link materials..."
                        value={form.description}
                        onChange={val => setForm({ ...form, description: val })}
                        materials={studyMaterials}
                    />
                    {!form.is_anonymous && (
                        <div className="grid grid-cols-2 gap-md">
                            <div>
                                <label className="input-label">Start Time</label>
                                <div className="flex items-center gap-xs">
                                    <Input 
                                        type="time" 
                                        value={form.start_time} 
                                        onChange={e => setForm({...form, start_time: e.target.value})} 
                                        required 
                                        style={{ flex: 1 }}
                                    />
                                    <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', padding: '2px' }}>
                                        {['AM', 'PM'].map(p => {
                                            const isPM = parseInt(form.start_time.split(':')[0]) >= 12;
                                            const active = (p === 'PM' && isPM) || (p === 'AM' && !isPM);
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => {
                                                        const [h, m] = form.start_time.split(':').map(Number);
                                                        let newH = h;
                                                        if (p === 'PM' && h < 12) newH = h + 12;
                                                        if (p === 'AM' && h >= 12) newH = h - 12;
                                                        setForm({...form, start_time: `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`});
                                                    }}
                                                    style={{
                                                        padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 800,
                                                        cursor: 'pointer', background: active ? 'var(--primary-500)' : 'transparent',
                                                        color: active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {form.start_time.startsWith('00:00') && (
                                    <p style={{ fontSize: '10px', color: 'var(--warning-500)', marginTop: '4px', fontStyle: 'italic' }}>
                                        Note: 12:00 AM is the **start** of the day.
                                    </p>
                                )}
                            </div>
                            <Input 
                                label="Duration (mins)" 
                                type="number" 
                                value={form.duration_minutes} 
                                onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value)})} 
                                required 
                                min="1"
                            />
                        </div>
                    )}
                    <div>
                        <label className="input-label">Repeat Days</label>
                        <div className="flex gap-xs">
                            {[1,2,3,4,5,6,7].map(d => (
                                <button 
                                    key={d} 
                                    type="button" 
                                    onClick={() => toggleDay(d)}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                                        background: form.days_of_week.includes(d) ? 'var(--primary-500)' : 'var(--surface)',
                                        color: form.days_of_week.includes(d) ? 'white' : 'var(--text)',
                                        fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {DAYS[d % 7]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 'var(--space-md)', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                            type="checkbox" 
                            id="is_anon"
                            checked={form.is_anonymous} 
                            onChange={e => setForm({ 
                                ...form, 
                                is_anonymous: e.target.checked,
                                start_time: e.target.checked ? '23:59:00' : '08:00:00' 
                            })} 
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="is_anon" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                            <strong style={{ display: 'block', color: 'var(--primary-500)' }}>Anonymous Routine</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allow retroactive logging (any time). Standard routines are locked until start time.</span>
                        </label>
                    </div>
                    <Input 
                        label="Deadline (optional)" 
                        type="date" 
                        value={form.deadline} 
                        onChange={e => setForm({...form, deadline: e.target.value})} 
                    />
                    <div className="flex gap-sm justify-end mt-lg">
                        <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button variant="primary" type="submit">Create Routine</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Routines;
