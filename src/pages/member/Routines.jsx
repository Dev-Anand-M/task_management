import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, Input, Modal, ProgressBar, LoadingSpinner } from '../../components/common';
import {
    RefreshCw, Plus, Trash2, CheckCircle, Circle, Clock, Bell,
    Calendar, ChevronDown, ChevronRight, ChevronLeft, Sparkles, Brain, Send,
    Flame, X, Edit3, Check, Mic, MicOff, Volume2, VolumeX,
    History, BookOpen, AlertTriangle, BellRing
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RoutineItem = ({ routine, log, onUpdate, onDelete, nextAlarmInfo }) => {
    const [spentTime, setSpentTime] = useState(log?.time_spent_minutes || 0);
    const [actualStartTime, setActualStartTime] = useState(log?.actual_start_time || routine.start_time.slice(0, 5));
    const [notes, setNotes] = useState(log?.learning_notes || '');
    const [showDetails, setShowDetails] = useState(false);
    const isDone = log?.status === 'done';
    const isIgnored = log?.status === 'ignored';
    const isPostponed = log?.status === 'postponed';
    
    // Is this the very next alarm?
    const isNext = nextAlarmInfo?.title === routine.title;

    const handleSave = async () => {
        await onUpdate(routine.id, {
            time_spent_minutes: parseInt(spentTime) || 0,
            actual_start_time: actualStartTime,
            learning_notes: notes,
            status: 'done',
            actual_response_time: new Date().toISOString()
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
            postponed_count: (log?.postponed_count || 0) + 1
        });
        setShowDetails(false);
    };

    const handleIgnore = async () => {
        await onUpdate(routine.id, {
            status: 'ignored'
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
                            {isLocked && <span style={{ fontSize: '9px', fontWeight: 400, marginLeft: '8px' }}>(Locked until {routine.start_time.slice(0, 5)})</span>}
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
                        <Badge variant="secondary" size="xs"><Clock size={10} /> {routine.start_time.slice(0, 5)}</Badge>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {routine.days_of_week.map(d => DAYS[d-1]).join(', ')}
                        </span>
                    </div>
                </div>

                <div className="flex gap-sm items-center">
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
                        <div className="grid grid-cols-3 gap-md">
                            <div>
                                <label className="input-label">Actual Start</label>
                                <Input 
                                    type="time" 
                                    value={actualStartTime} 
                                    onChange={e => setActualStartTime(e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className="input-label">Minutes Spent</label>
                                <Input 
                                    type="number" 
                                    value={spentTime} 
                                    onChange={e => setSpentTime(e.target.value)} 
                                    placeholder="e.g. 45"
                                />
                            </div>
                            <div>
                                <label className="input-label">Deadline</label>
                                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                    {routine.deadline ? new Date(routine.deadline).toLocaleDateString() : 'None'}
                                </p>
                            </div>
                        </div>
                        <div>
                            <label className="input-label">What did you learn today? (Diary Entry)</label>
                            <textarea 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Topics covered, insights, or tasks completed..."
                                style={{ 
                                    width: '100%', 
                                    height: '100px', 
                                    padding: '12px', 
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg)',
                                    color: 'var(--text)',
                                    border: '1px solid var(--border)',
                                    fontSize: 'var(--text-sm)',
                                    resize: 'none'
                                }}
                            />
                        </div>
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
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [routines, setRoutines] = useState([]);
    const [logs, setLogs] = useState({}); // routineId -> log object
    const [showAdd, setShowAdd] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [form, setForm] = useState({ 
        title: '', 
        start_time: '08:00:00', 
        days_of_week: [1,2,3,4,5], 
        deadline: '', 
        description: '',
        is_anonymous: false
    });
    const [activeTimetable, setActiveTimetable] = useState(null);
    const [nextAlarmInfo, setNextAlarmInfo] = useState(null);
    const navigate = useNavigate();

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
            const weekStart = new Date(today.setDate(diff)).toISOString().split('T')[0];
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

    const navDate = (dir) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + dir);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    // Filter routines active for selected date
    const activeRoutines = routines.filter(r => {
        const d = new Date(selectedDate);
        const day = d.getDay() === 0 ? 7 : d.getDay();
        if (r.deadline && new Date(r.deadline) < d) return false;
        return r.days_of_week.includes(day);
    });

    const doneCount = activeRoutines.filter(r => logs[r.id]?.status === 'done').length;

    return (
        <div className="page-content animate-fade-in">
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
                            nextAlarmInfo={nextAlarmInfo}
                        />
                    ))}
                </div>
            )}

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
                    {!form.is_anonymous && (
                        <Input 
                            label="Start Time" 
                            type="time" 
                            value={form.start_time} 
                            onChange={e => setForm({...form, start_time: e.target.value})} 
                            required 
                        />
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
                                start_time: e.target.checked ? '00:00:00' : '08:00:00' 
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
