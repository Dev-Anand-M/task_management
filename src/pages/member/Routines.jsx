import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, Input, Modal, ProgressBar } from '../../components/common';
import {
    RefreshCw, Plus, Trash2, CheckCircle, Circle, Clock, Bell,
    Calendar, ChevronDown, ChevronRight, Sparkles, Brain, Send,
    Flame, X, Edit3, Check, Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ROUTINE_XP = 15;

const getKey = (uid) => `zenith_routines_${uid}`;
const load = (uid) => { try { return JSON.parse(localStorage.getItem(getKey(uid))) || { routines: [], log: {}, aiChats: [] }; } catch { return { routines: [], log: {}, aiChats: [] }; } };
const save = (uid, d) => localStorage.setItem(getKey(uid), JSON.stringify(d));

const RoutineItem = ({ routine: r, entry, onToggle, onDelete, onSaveNote }) => {
    const [editNote, setEditNote] = useState(false);
    const [noteVal, setNoteVal] = useState(entry?.note || '');
    const done = entry?.done;

    return (
        <Card style={{ borderLeft: `4px solid ${done ? 'var(--success-500)' : 'var(--border)'}`, opacity: done ? 0.7 : 1 }}>
            <div className="flex items-center gap-md">
                <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {done ? <CheckCircle size={24} style={{ color: 'var(--success-500)' }} /> : <Circle size={24} style={{ color: 'var(--text-muted)' }} />}
                </button>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, textDecoration: done ? 'line-through' : 'none' }}>{r.title}</p>
                    <div className="flex items-center gap-sm" style={{ marginTop: '2px', flexWrap: 'wrap' }}>
                        <Badge variant="secondary" size="xs"><Clock size={10} /> {r.time}</Badge>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.days.map(d => DAYS[d]).join(', ')}</span>
                        {r.dueDate && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Until {new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        <span style={{ fontSize: '10px', color: 'var(--primary-500)' }}>+{ROUTINE_XP}✨</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {!editNote && (
                        <button onClick={() => { setEditNote(true); setNoteVal(entry?.note || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }} title="Add review note">
                            <Edit3 size={14} />
                        </button>
                    )}
                    <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {editNote && (
                <div className="flex gap-sm mt-sm">
                    <input value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="What did you do? How was it?" style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--text-sm)' }} />
                    <button onClick={() => { onSaveNote(noteVal); setEditNote(false); }} style={{ background: 'var(--primary-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px', cursor: 'pointer' }}><Check size={14} /></button>
                    <button onClick={() => setEditNote(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                </div>
            )}
            {entry?.note && !editNote && (
                <p style={{ margin: '8px 0 0 36px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>📝 {entry.note}</p>
            )}
        </Card>
    );
};

const Routines = () => {
    const { user } = useAuth();
    const [data, setData] = useState({ routines: [], log: {}, aiChats: [] });
    const [showAdd, setShowAdd] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [form, setForm] = useState({ title: '', time: '09:00', days: [1,2,3,4,5], dueDate: '', notes: '', alarmEnabled: true });
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [editId, setEditId] = useState(null);
    const timersRef = useRef([]);
    const [activeAlarm, setActiveAlarm] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioURL, setAudioURL] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const alarmAudioRef = useRef(null);

    useEffect(() => {
        if (user?.id) setData(load(user.id));
    }, [user?.id]);

    const persist = useCallback((d) => { setData(d); if (user?.id) save(user.id, d); }, [user?.id]);

    // Alarm sound (simple beep using Web Audio API)
    const playAlarmSound = () => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            
            // Repeat 3 times
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.frequency.value = 800;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.3);
            }, 400);
            
            setTimeout(() => {
                const osc3 = audioContext.createOscillator();
                const gain3 = audioContext.createGain();
                osc3.connect(gain3);
                gain3.connect(audioContext.destination);
                osc3.frequency.value = 800;
                osc3.type = 'sine';
                gain3.gain.setValueAtTime(0.3, audioContext.currentTime);
                osc3.start();
                osc3.stop(audioContext.currentTime + 0.3);
            }, 800);
        } catch (error) {
            console.error('Failed to play alarm sound:', error);
        }
    };

    // Voice recording functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                setAudioURL(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Microphone access denied. Please allow microphone access to record notes.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const saveVoiceNote = (routineId) => {
        if (audioURL) {
            const key = logKey(routineId, selectedDate);
            persist({ 
                ...data, 
                log: { 
                    ...data.log, 
                    [key]: { 
                        ...data.log[key], 
                        voiceNote: audioURL,
                        note: (data.log[key]?.note || '') + ' [Voice note attached]'
                    } 
                } 
            });
            setAudioURL(null);
            setActiveAlarm(null);
        }
    };

    // Schedule browser notifications and alarms for today's routines
    useEffect(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const now = new Date();
        data.routines.forEach(r => {
            if (!r.days.includes(now.getDay())) return;
            if (r.dueDate && new Date(r.dueDate) < new Date(now.toDateString())) return;
            const [h, m] = r.time.split(':').map(Number);
            const target = new Date(now); target.setHours(h, m, 0, 0);
            const diff = target - now;
            if (diff > 0 && diff < 86400000) {
                const t = setTimeout(() => {
                    // Show browser notification
                    new Notification(`⏰ ${r.title}`, { body: 'Time for your routine!', icon: '/zenith.png', tag: `routine-${r.id}` });
                    
                    // Show in-app alarm if enabled
                    if (r.alarmEnabled !== false) {
                        playAlarmSound();
                        setActiveAlarm(r);
                    }
                }, diff);
                timersRef.current.push(t);
            }
        });
        return () => timersRef.current.forEach(clearTimeout);
    }, [data.routines]);

    const addRoutine = (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        const routine = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            title: form.title.trim(), time: form.time, days: form.days,
            dueDate: form.dueDate || null, notes: form.notes, createdAt: new Date().toISOString(),
            alarmEnabled: form.alarmEnabled
        };
        persist({ ...data, routines: [...data.routines, routine] });
        setForm({ title: '', time: '09:00', days: [1,2,3,4,5], dueDate: '', notes: '', alarmEnabled: true });
        setShowAdd(false);
    };

    const deleteRoutine = (id) => {
        persist({ ...data, routines: data.routines.filter(r => r.id !== id) });
    };

    const toggleDay = (day) => {
        setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }));
    };

    const logKey = (routineId, date) => `${routineId}_${date}`;

    const toggleLog = (routineId) => {
        const key = logKey(routineId, selectedDate);
        const current = data.log[key];
        const newLog = { ...data.log };
        if (current?.done) {
            delete newLog[key]; // undo
        } else {
            newLog[key] = { done: true, time: new Date().toISOString() };
        }
        // Update planner Focus XP too (defensively load full object)
        const plannerKey = `zenith_planner_${user?.id}`;
        try {
            const raw = localStorage.getItem(plannerKey);
            const defaults = { todos: [], focusXp: 0, streak: 0, lastCompletedDate: null, completedCount: 0 };
            const planner = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
            
            if (!current?.done) {
                planner.focusXp += ROUTINE_XP;
                planner.completedCount += 1;
            }
            localStorage.setItem(plannerKey, JSON.stringify(planner));
        } catch (e) {
            console.error("Failed to sync XP to planner:", e);
        }
        persist({ ...data, log: newLog });
    };

    const addLogNote = (routineId, note) => {
        const key = logKey(routineId, selectedDate);
        persist({ ...data, log: { ...data.log, [key]: { ...data.log[key], note } } });
    };

    const isRoutineActiveOnDate = (routine, dateStr) => {
        const d = new Date(dateStr);
        if (routine.dueDate && new Date(routine.dueDate) < d) return false;
        return routine.days.includes(d.getDay());
    };

    const todayRoutines = data.routines.filter(r => isRoutineActiveOnDate(r, selectedDate));
    const doneCount = todayRoutines.filter(r => data.log[logKey(r.id, selectedDate)]?.done).length;

    // AI Scheduler
    const askAI = async () => {
        if (!aiInput.trim()) return;
        const userMsg = aiInput.trim();
        setAiInput('');
        const newChats = [...data.aiChats, { role: 'user', content: userMsg }];
        persist({ ...data, aiChats: newChats });
        setAiLoading(true);

        try {
            const { getAPIKey, getSelectedModel } = await import('../../services/aiService');
            const modelId = getSelectedModel();
            const providerMap = { 'gemini': 'gemini', 'gpt': 'openai', 'claude': 'anthropic', 'Meta': 'sambanova', 'DeepSeek': 'sambanova', 'gemma': 'sambanova', 'llama': 'sambanova', 'sonar': 'perplexity' };
            const providerId = Object.entries(providerMap).find(([k]) => modelId.toLowerCase().includes(k.toLowerCase()))?.[1] || 'sambanova';
            const apiKey = getAPIKey(providerId);

            if (!apiKey) {
                const errChats = [...newChats, { role: 'assistant', content: '⚠️ No API key configured. Go to Settings → AI Configuration to add your key.' }];
                persist({ ...data, aiChats: errChats });
                setAiLoading(false);
                return;
            }

            const routineContext = data.routines.map(r => `- ${r.title} at ${r.time} on ${r.days.map(d => DAYS[d]).join(',')}`).join('\n');
            const systemPrompt = `You are a smart scheduling assistant. The user's current routines:\n${routineContext || 'None yet'}\n\nHelp them plan their day, suggest routines, optimize their schedule, and give productivity tips. Be concise. If they ask you to create a routine, output it in this exact format on its own line:\n[ROUTINE] title | HH:MM | days (0-6 comma separated)\nExample: [ROUTINE] Morning Exercise | 07:00 | 1,2,3,4,5`;

            const res = await fetch('/api/ai-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: providerId,
                    endpoint: providerId === 'gemini' ? `/v1beta/models/${modelId}:generateContent` : '/v1/chat/completions',
                    apiKey,
                    body: providerId === 'gemini' ? {
                        contents: [{ parts: [{ text: systemPrompt + '\n\nUser: ' + userMsg }] }]
                    } : {
                        model: modelId,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...newChats.map(c => ({ role: c.role, content: c.content }))
                        ],
                        max_tokens: 500
                    }
                })
            });

            const json = await res.json();
            let reply = '';
            if (providerId === 'gemini') {
                reply = json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
            } else {
                reply = json.choices?.[0]?.message?.content || 'No response.';
            }

            // Auto-create routines from AI response
            const routineMatches = reply.matchAll(/\[ROUTINE\]\s*(.+?)\s*\|\s*(\d{2}:\d{2})\s*\|\s*([\d,]+)/g);
            const newRoutines = [...data.routines];
            for (const match of routineMatches) {
                newRoutines.push({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
                    title: match[1].trim(), time: match[2], days: match[3].split(',').map(Number),
                    dueDate: null, notes: 'Created by AI', createdAt: new Date().toISOString()
                });
            }

            const finalChats = [...newChats, { role: 'assistant', content: reply }];
            persist({ ...data, routines: newRoutines, aiChats: finalChats });
        } catch (err) {
            const errChats = [...newChats, { role: 'assistant', content: `Error: ${err.message}` }];
            persist({ ...data, aiChats: errChats });
        }
        setAiLoading(false);
    };

    // Date nav
    const navDate = (dir) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + dir);
        setSelectedDate(d.toISOString().split('T')[0]);
    };
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <RefreshCw className="text-primary-400" /> Routines
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Daily habits & AI-powered scheduling</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" icon={Brain} onClick={() => setShowAI(true)}>AI Scheduler</Button>
                    <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>New Routine</Button>
                </div>
            </div>

            {/* Date Selector */}
            <Card style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => navDate(-1)}>← Prev</Button>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontWeight: 800 }}>
                            {new Date(selectedDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        {!isToday && <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={{ background: 'none', border: 'none', color: 'var(--primary-500)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Go to Today</button>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navDate(1)}>Next →</Button>
                </div>
            </Card>

            {/* Progress */}
            <Card style={{ marginBottom: 'var(--space-lg)', background: todayRoutines.length && doneCount === todayRoutines.length ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.05))' : undefined }}>
                <div className="flex items-center gap-lg">
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface)', border: '3px solid var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--text-xl)', flexShrink: 0 }}>
                        {todayRoutines.length ? `${doneCount}/${todayRoutines.length}` : '—'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>
                            {!todayRoutines.length ? 'No routines scheduled' : doneCount === todayRoutines.length ? '🎉 All done! +' + (doneCount * ROUTINE_XP) + ' Focus XP' : `${todayRoutines.length - doneCount} remaining`}
                        </p>
                        <ProgressBar value={todayRoutines.length ? (doneCount / todayRoutines.length) * 100 : 0} size="sm" color="var(--success-500)" />
                    </div>
                </div>
            </Card>

            {/* Routine List */}
            {todayRoutines.length === 0 ? (
                <Card><div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                    <RefreshCw size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <h3>No routines for this day</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Create a routine or ask the AI Scheduler to help!</p>
                </div></Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {todayRoutines.sort((a, b) => a.time.localeCompare(b.time)).map(r => (
                        <RoutineItem key={r.id} routine={r} entry={data.log[logKey(r.id, selectedDate)]} onToggle={() => toggleLog(r.id)} onDelete={() => deleteRoutine(r.id)} onSaveNote={(note) => addLogNote(r.id, note)} />
                    ))}
                </div>
            )}

            {/* All Routines Overview */}
            {data.routines.length > 0 && (
                <Card style={{ marginTop: 'var(--space-xl)' }}>
                    <h4 style={{ margin: '0 0 var(--space-md)', fontWeight: 800 }}>📋 All Routines ({data.routines.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                        {data.routines.map(r => {
                            // Calculate streak for this routine
                            let streak = 0;
                            for (let i = 0; i < 30; i++) {
                                const d = new Date(); d.setDate(d.getDate() - i);
                                const ds = d.toISOString().split('T')[0];
                                if (!isRoutineActiveOnDate(r, ds)) continue;
                                if (data.log[logKey(r.id, ds)]?.done) streak++;
                                else break;
                            }
                            return (
                                <div key={r.id} style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{r.title}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>{r.time} • {r.days.map(d => DAYS[d]).join(', ')}</span>
                                    </div>
                                    {streak > 0 && <Badge variant="warning" size="xs"><Flame size={10} /> {streak}d streak</Badge>}
                                    <button onClick={() => deleteRoutine(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><Trash2 size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Add Routine Modal */}
            <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Create Routine">
                <form onSubmit={addRoutine} className="flex flex-col gap-md">
                    <Input label="Routine Name" placeholder="e.g. Morning Workout" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                    <Input label="Reminder Time" type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                    <div>
                        <label className="input-label">Repeat Days</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {DAYS.map((d, i) => (
                                <button key={i} type="button" onClick={() => toggleDay(i)} style={{
                                    width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                    background: form.days.includes(i) ? 'var(--primary-500)' : 'var(--surface)',
                                    color: form.days.includes(i) ? 'white' : 'var(--text)', fontWeight: 700,
                                    fontSize: '11px', transition: 'all 0.2s'
                                }}>{d}</button>
                            ))}
                        </div>
                    </div>
                    <Input label="Until Date (optional)" type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                    
                    {/* Alarm Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-sm)', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Bell size={18} style={{ color: 'var(--primary-500)' }} />
                            <div>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>In-App Alarm</p>
                                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Play sound & show alarm popup</p>
                            </div>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                            <input
                                type="checkbox"
                                checked={form.alarmEnabled}
                                onChange={(e) => setForm({...form, alarmEnabled: e.target.checked})}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: form.alarmEnabled ? 'var(--primary-500)' : 'var(--border)',
                                transition: 'all var(--transition-fast)',
                                borderRadius: '24px'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    content: '',
                                    height: '18px',
                                    width: '18px',
                                    left: form.alarmEnabled ? '26px' : '3px',
                                    bottom: '3px',
                                    background: 'white',
                                    transition: 'all var(--transition-fast)',
                                    borderRadius: '50%'
                                }} />
                            </span>
                        </label>
                    </div>
                    
                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </div>
                </form>
            </Modal>

            {/* AI Scheduler Modal */}
            <Modal isOpen={showAI} onClose={() => setShowAI(false)} title="🧠 AI Scheduler" size="lg">
                <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', padding: 'var(--space-sm)' }}>
                        {data.aiChats.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0', color: 'var(--text-muted)' }}>
                                <Brain size={40} style={{ marginBottom: '8px' }} />
                                <p>Ask me to help plan your schedule!</p>
                                <p style={{ fontSize: 'var(--text-xs)' }}>Try: "Create a morning routine for a student" or "Suggest a study schedule for 3 hours"</p>
                            </div>
                        )}
                        {data.aiChats.map((msg, i) => (
                            <div key={i} style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-lg)',
                                background: msg.role === 'user' ? 'var(--primary-500)' : 'var(--surface)',
                                color: msg.role === 'user' ? 'white' : 'var(--text)',
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap'
                            }}>{msg.content}</div>
                        ))}
                        {aiLoading && <div style={{ alignSelf: 'flex-start', padding: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Thinking...</div>}
                    </div>
                    <div className="flex gap-sm">
                        <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), askAI())}
                            placeholder="Ask the AI to schedule for you..." disabled={aiLoading}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--text-sm)' }} />
                        <Button variant="primary" icon={Send} onClick={askAI} disabled={aiLoading || !aiInput.trim()}>Send</Button>
                    </div>
                    {data.aiChats.length > 0 && (
                        <button onClick={() => persist({...data, aiChats: []})} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', marginTop: '8px', textAlign: 'center' }}>Clear chat</button>
                    )}
                </div>
            </Modal>

            {/* Alarm Popup */}
            {activeAlarm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    animation: 'fadeIn 0.3s ease-in-out'
                }}>
                    <Card style={{
                        maxWidth: '500px',
                        width: '90%',
                        padding: 'var(--space-xl)',
                        textAlign: 'center',
                        animation: 'slideUp 0.3s ease-out',
                        border: '3px solid var(--primary-500)',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            margin: '0 auto var(--space-lg)',
                            background: 'var(--gradient-primary)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }}>
                            <Bell size={40} color="white" />
                        </div>
                        
                        <h2 style={{ margin: '0 0 var(--space-sm)', fontSize: 'var(--text-2xl)' }}>⏰ Time for Routine!</h2>
                        <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--primary-500)', margin: '0 0 var(--space-lg)' }}>
                            {activeAlarm.title}
                        </p>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)' }}>
                            Scheduled for {activeAlarm.time}
                        </p>

                        {/* Voice Recording Section */}
                        <div style={{
                            padding: 'var(--space-lg)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-lg)'
                        }}>
                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                Quick Voice Note
                            </p>
                            
                            {!isRecording && !audioURL && (
                                <Button
                                    variant="primary"
                                    icon={Mic}
                                    onClick={startRecording}
                                    style={{ width: '100%' }}
                                >
                                    Start Recording
                                </Button>
                            )}
                            
                            {isRecording && (
                                <div>
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        margin: '0 auto var(--space-md)',
                                        background: 'var(--error)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        animation: 'pulse 1s ease-in-out infinite'
                                    }}>
                                        <Mic size={30} color="white" />
                                    </div>
                                    <p style={{ color: 'var(--error)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                        Recording...
                                    </p>
                                    <Button
                                        variant="secondary"
                                        icon={MicOff}
                                        onClick={stopRecording}
                                        style={{ width: '100%' }}
                                    >
                                        Stop Recording
                                    </Button>
                                </div>
                            )}
                            
                            {audioURL && (
                                <div>
                                    <audio src={audioURL} controls style={{ width: '100%', marginBottom: 'var(--space-md)' }} />
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setAudioURL(null)}
                                            style={{ flex: 1 }}
                                        >
                                            Re-record
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => saveVoiceNote(activeAlarm.id)}
                                            style={{ flex: 1 }}
                                        >
                                            Save Note
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <Button
                                variant="secondary"
                                onClick={() => setActiveAlarm(null)}
                                style={{ flex: 1 }}
                            >
                                Dismiss
                            </Button>
                            <Button
                                variant="primary"
                                icon={CheckCircle}
                                onClick={() => {
                                    toggleLog(activeAlarm.id);
                                    setActiveAlarm(null);
                                    setAudioURL(null);
                                }}
                                style={{ flex: 1 }}
                            >
                                Mark Done
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Routines;
