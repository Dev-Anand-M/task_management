import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, Input, Modal, ProgressBar, LoadingSpinner } from '../../components/common';
import {
    RefreshCw, Plus, Trash2, CheckCircle, Circle, Clock, Bell,
    Calendar, ChevronDown, ChevronRight, ChevronLeft, Sparkles, Brain, Send,
    Flame, X, Edit3, Check, Mic, MicOff, Volume2, VolumeX,
    History, BookOpen, AlertTriangle
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RoutineItem = ({ routine, log, onUpdate, onDelete }) => {
    const [spentTime, setSpentTime] = useState(log?.time_spent_minutes || 0);
    const [notes, setNotes] = useState(log?.learning_notes || '');
    const [showDetails, setShowDetails] = useState(false);
    const isDone = log?.status === 'done';

    const handleSave = async () => {
        await onUpdate(routine.id, {
            time_spent_minutes: parseInt(spentTime) || 0,
            learning_notes: notes,
            status: 'done',
            actual_response_time: new Date().toISOString()
        });
        setShowDetails(false);
    };

    const handlePostpone = async () => {
        // Simple postpone: add 30 mins to current time (client-side display or backend logic)
        // For this demo, we'll just mark status as postponed in the log
        await onUpdate(routine.id, {
            status: 'postponed',
            postponed_count: (log?.postponed_count || 0) + 1
        });
    };

    return (
        <Card style={{ 
            borderLeft: `4px solid ${isDone ? 'var(--success-500)' : log?.status === 'postponed' ? 'var(--warning-500)' : 'var(--border)'}`,
            opacity: isDone ? 0.8 : 1,
            transition: 'all 0.3s'
        }}>
            <div className="flex items-center gap-md">
                <button 
                    onClick={() => setShowDetails(!showDetails)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                    {isDone ? <CheckCircle size={24} style={{ color: 'var(--success-500)' }} /> : <Circle size={24} style={{ color: 'var(--text-muted)' }} />}
                </button>
                
                <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-sm">
                        <p style={{ margin: 0, fontWeight: 700, textDecoration: isDone ? 'line-through' : 'none' }}>{routine.title}</p>
                        {log?.postponed_count > 0 && <Badge variant="warning" size="xs">Postponed {log.postponed_count}x</Badge>}
                    </div>
                    <div className="flex items-center gap-sm" style={{ marginTop: '2px' }}>
                        <Badge variant="secondary" size="xs"><Clock size={10} /> {routine.start_time}</Badge>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {routine.days_of_week.map(d => DAYS[d-1]).join(', ')}
                        </span>
                    </div>
                </div>

                <div className="flex gap-sm">
                    {!isDone && (
                        <Button variant="ghost" size="sm" onClick={handlePostpone}>Postpone</Button>
                    )}
                    <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {showDetails && (
                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div className="flex flex-col gap-md">
                        <div>
                            <label className="input-label">Time Spent (minutes)</label>
                            <Input 
                                type="number" 
                                value={spentTime} 
                                onChange={e => setSpentTime(e.target.value)} 
                                placeholder="How long did you study?"
                            />
                        </div>
                        <div>
                            <label className="input-label">Learning Diary (What did you learn?)</label>
                            <textarea 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Topics covered, difficulties, mindmap nodes..."
                                style={{ 
                                    width: '100%', 
                                    height: '80px', 
                                    padding: '12px', 
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--surface)',
                                    color: 'var(--text)',
                                    border: '1px solid var(--border)',
                                    fontSize: 'var(--text-sm)'
                                }}
                            />
                        </div>
                        <div className="flex gap-sm justify-end">
                            <Button variant="ghost" onClick={() => setShowDetails(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave}>Log Progress</Button>
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
        description: '' 
    });

    useEffect(() => {
        if (user?.id) {
            fetchData();
        }
    }, [user?.id, selectedDate]);

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
            <div className="flex flex-mobile-col justify-between items-center mb-xl">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <RefreshCw className="text-primary-500" /> Daily Routines
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Coursework consistency & learning logs</p>
                </div>
                <div className="flex gap-sm">
                    <Button variant="secondary" icon={History} onClick={() => window.location.href='/diary'}>Diary</Button>
                    <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>New Routine</Button>
                </div>
            </div>

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
                    <Input 
                        label="Start Time" 
                        type="time" 
                        value={form.start_time} 
                        onChange={e => setForm({...form, start_time: e.target.value})} 
                        required 
                    />
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
