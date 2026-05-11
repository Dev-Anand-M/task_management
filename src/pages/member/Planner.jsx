import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Button, Input, Modal, ProgressBar } from '../../components/common';
import {
    Target, Plus, Trash2, CheckCircle, Circle, Star, Flame, Zap,
    Calendar as CalIcon, Clock, ChevronDown, ChevronRight, Award,
    Sparkles, TrendingUp, RotateCcw
} from 'lucide-react';

// ── Focus XP System (completely separate from classroom XP) ──
const FOCUS_LEVELS = [
    { level: 1, title: 'Beginner', xpNeeded: 0, emoji: '🌱' },
    { level: 2, title: 'Starter', xpNeeded: 100, emoji: '🌿' },
    { level: 3, title: 'Focused', xpNeeded: 300, emoji: '🎯' },
    { level: 4, title: 'Dedicated', xpNeeded: 600, emoji: '🔥' },
    { level: 5, title: 'Consistent', xpNeeded: 1000, emoji: '⚡' },
    { level: 6, title: 'Disciplined', xpNeeded: 1500, emoji: '💎' },
    { level: 7, title: 'Master Planner', xpNeeded: 2200, emoji: '🏆' },
    { level: 8, title: 'Unstoppable', xpNeeded: 3000, emoji: '👑' },
    { level: 9, title: 'Legendary', xpNeeded: 4000, emoji: '🌟' },
    { level: 10, title: 'Ascended', xpNeeded: 5500, emoji: '🚀' },
];

const PRIORITY_XP = { low: 5, medium: 10, high: 20, urgent: 30 };
const PRIORITY_COLORS = {
    low: 'var(--success-500)', medium: 'var(--warning-500)',
    high: '#f97316', urgent: 'var(--error-500)'
};
const STREAK_BONUS = [0, 0, 5, 10, 15, 25, 35, 50]; // bonus at streak day 3,4,5...

const getFocusLevel = (xp) => {
    for (let i = FOCUS_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= FOCUS_LEVELS[i].xpNeeded) return FOCUS_LEVELS[i];
    }
    return FOCUS_LEVELS[0];
};

const getNextLevel = (xp) => {
    const current = getFocusLevel(xp);
    const next = FOCUS_LEVELS.find(l => l.xpNeeded > xp);
    return next || current;
};

const getLevelProgress = (xp) => {
    const current = getFocusLevel(xp);
    const next = getNextLevel(xp);
    if (current === next) return 100;
    return Math.round(((xp - current.xpNeeded) / (next.xpNeeded - current.xpNeeded)) * 100);
};

// ── Storage helpers (localStorage, user-scoped) ──
const getStorageKey = (userId) => `zenith_planner_${userId}`;

const loadPlannerData = (userId) => {
    const defaults = { todos: [], focusXp: 0, streak: 0, lastCompletedDate: null, completedCount: 0 };
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
    } catch { return defaults; }
};

const savePlannerData = (userId, data) => {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
};

const Planner = () => {
    const { user } = useAuth();
    const [data, setData] = useState({ todos: [], focusXp: 0, streak: 0, lastCompletedDate: null, completedCount: 0 });
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ title: '', priority: 'medium', dueDate: '' });
    const [filter, setFilter] = useState('active'); // active, completed, all
    const [xpPopup, setXpPopup] = useState(null); // { amount, x, y }
    const [expandedSections, setExpandedSections] = useState({ today: true, upcoming: true, someday: true });

    useEffect(() => {
        if (user?.id) {
            const loaded = loadPlannerData(user.id);
            // Check streak
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (loaded.lastCompletedDate && loaded.lastCompletedDate !== today && loaded.lastCompletedDate !== yesterday) {
                loaded.streak = 0; // Reset streak if gap
            }
            setData(loaded);
        }
    }, [user?.id]);

    const persist = useCallback((newData) => {
        setData(newData);
        if (user?.id) savePlannerData(user.id, newData);
    }, [user?.id]);

    const handleAddTodo = (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        const newTodo = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            title: form.title.trim(),
            priority: form.priority,
            dueDate: form.dueDate || null,
            completed: false,
            createdAt: new Date().toISOString()
        };
        persist({ ...data, todos: [newTodo, ...data.todos] });
        setForm({ title: '', priority: 'medium', dueDate: '' });
        setShowAdd(false);
    };

    const handleToggle = (id, event) => {
        const todo = data.todos.find(t => t.id === id);
        if (!todo || todo.completed) return; // Can't un-complete (XP already awarded)

        const xpEarned = PRIORITY_XP[todo.priority] || 10;
        const today = new Date().toDateString();
        let newStreak = data.streak;
        let streakBonus = 0;

        if (data.lastCompletedDate !== today) {
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            newStreak = (data.lastCompletedDate === yesterday) ? data.streak + 1 : 1;
            streakBonus = newStreak < STREAK_BONUS.length ? STREAK_BONUS[newStreak] : 50;
        }

        const totalXp = xpEarned + streakBonus;

        // XP popup animation
        if (event?.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            setXpPopup({ amount: totalXp, x: rect.right, y: rect.top });
            setTimeout(() => setXpPopup(null), 1500);
        }

        persist({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t),
            focusXp: data.focusXp + totalXp,
            streak: newStreak,
            lastCompletedDate: today,
            completedCount: data.completedCount + 1
        });
    };

    const handleDelete = (id) => {
        persist({ ...data, todos: data.todos.filter(t => t.id !== id) });
    };

    const handleClearCompleted = () => {
        persist({ ...data, todos: data.todos.filter(t => !t.completed) });
    };

    // Categorize todos
    const today = new Date();
    const todayStr = today.toDateString();
    const tomorrowStr = new Date(Date.now() + 86400000).toDateString();

    const activeTodos = data.todos.filter(t => !t.completed);
    const completedTodos = data.todos.filter(t => t.completed);

    const todayTodos = activeTodos.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
    const upcomingTodos = activeTodos.filter(t => t.dueDate && new Date(t.dueDate) > today && new Date(t.dueDate).toDateString() !== todayStr);
    const somedayTodos = activeTodos.filter(t => !t.dueDate);
    const overdueTodos = activeTodos.filter(t => t.dueDate && new Date(t.dueDate) < today && new Date(t.dueDate).toDateString() !== todayStr);

    const focusLevel = getFocusLevel(data.focusXp);
    const nextLevel = getNextLevel(data.focusXp);
    const levelProgress = getLevelProgress(data.focusXp);

    const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    const TodoItem = ({ todo }) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius-md)', background: 'var(--surface)',
            borderLeft: `3px solid ${PRIORITY_COLORS[todo.priority]}`,
            opacity: todo.completed ? 0.5 : 1, transition: 'all 0.2s'
        }}>
            <button
                onClick={(e) => !todo.completed && handleToggle(todo.id, e)}
                style={{ background: 'none', border: 'none', cursor: todo.completed ? 'default' : 'pointer', padding: 0, display: 'flex' }}
            >
                {todo.completed
                    ? <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                    : <Circle size={20} style={{ color: 'var(--text-muted)' }} />
                }
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>{todo.title}</p>
                <div className="flex items-center gap-sm" style={{ marginTop: '2px' }}>
                    <Badge variant={todo.priority === 'urgent' ? 'error' : todo.priority === 'high' ? 'warning' : 'secondary'} size="xs">
                        {todo.priority}
                    </Badge>
                    {todo.dueDate && !isNaN(new Date(todo.dueDate).getTime()) && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Clock size={10} />{new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{PRIORITY_XP[todo.priority] || 10}✨</span>
                </div>
            </div>
            {!todo.completed && (
                <button onClick={() => handleDelete(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );

    const SectionHeader = ({ sectionKey, icon: Icon, label, count, color }) => (
        <div onClick={() => toggleSection(sectionKey)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
            padding: 'var(--space-sm) 0', userSelect: 'none'
        }}>
            {expandedSections[sectionKey] ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
            <Icon size={16} style={{ color }} />
            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{label}</span>
            <Badge variant="secondary" size="xs">{count}</Badge>
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* XP Popup Animation */}
            {xpPopup && (
                <div style={{
                    position: 'fixed', left: xpPopup.x, top: xpPopup.y, zIndex: 9999,
                    color: 'var(--primary-500)', fontWeight: 800, fontSize: 'var(--text-lg)',
                    animation: 'floatUp 1.5s ease-out forwards', pointerEvents: 'none'
                }}>+{xpPopup.amount} ✨</div>
            )}

            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Target className="text-primary-400" /> Planner
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Your personal goals & to-do tracker</p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>New Goal</Button>
            </div>

            {/* Focus XP Card */}
            <Card style={{
                marginBottom: 'var(--space-xl)', position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', color: 'white'
            }}>
                <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                <div className="flex flex-mobile-col items-center gap-lg" style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: 'var(--radius-xl)',
                        background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '40px', flexShrink: 0
                    }}>{focusLevel.emoji}</div>
                    <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Focus Level {focusLevel.level}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.15)' }}>{focusLevel.title}</span>
                        </div>
                        <h3 style={{ margin: '4px 0', fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{data.focusXp} Focus XP</h3>
                        <div style={{ maxWidth: '300px' }}>
                            <ProgressBar value={levelProgress} size="sm" color="#7c3aed" />
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>
                                {focusLevel.level < 10 ? `${data.focusXp - focusLevel.xpNeeded} / ${nextLevel.xpNeeded - focusLevel.xpNeeded} to ${nextLevel.title}` : 'MAX LEVEL'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-lg" style={{ textAlign: 'center' }}>
                        <div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{data.streak}</div>
                            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>
                                <Flame size={10} style={{ verticalAlign: 'middle' }} /> Streak
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{data.completedCount}</div>
                            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>
                                <CheckCircle size={10} style={{ verticalAlign: 'middle' }} /> Done
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                {[
                    { key: 'active', label: `Active (${activeTodos.length})` },
                    { key: 'completed', label: `Done (${completedTodos.length})` },
                    { key: 'all', label: `All (${data.todos.length})` }
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700,
                        fontSize: 'var(--text-xs)',
                        background: filter === f.key ? 'var(--primary-500)' : 'var(--card)',
                        color: filter === f.key ? 'white' : 'var(--text)', transition: 'all 0.2s'
                    }}>{f.label}</button>
                ))}
                {completedTodos.length > 0 && (
                    <button onClick={handleClearCompleted} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-full)', marginLeft: 'auto',
                        border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700,
                        fontSize: 'var(--text-xs)', background: 'var(--card)', color: 'var(--error-500)',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}><RotateCcw size={12} /> Clear Done</button>
                )}
            </div>

            {/* Todo List */}
            <Card>
                {filter !== 'completed' && (
                    <>
                        {/* Overdue */}
                        {overdueTodos.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <SectionHeader sectionKey="overdue" icon={Clock} label="Overdue" count={overdueTodos.length} color="var(--error-500)" />
                                {expandedSections.overdue !== false && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                        {overdueTodos.map(t => <TodoItem key={t.id} todo={t} />)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Today */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <SectionHeader sectionKey="today" icon={Star} label="Today" count={todayTodos.length} color="var(--warning-500)" />
                            {expandedSections.today && (
                                todayTodos.length > 0
                                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>{todayTodos.map(t => <TodoItem key={t.id} todo={t} />)}</div>
                                    : <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', paddingLeft: '24px' }}>Nothing due today ✨</p>
                            )}
                        </div>

                        {/* Upcoming */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <SectionHeader sectionKey="upcoming" icon={CalIcon} label="Upcoming" count={upcomingTodos.length} color="var(--primary-500)" />
                            {expandedSections.upcoming && upcomingTodos.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                    {upcomingTodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map(t => <TodoItem key={t.id} todo={t} />)}
                                </div>
                            )}
                        </div>

                        {/* No Date */}
                        <div>
                            <SectionHeader sectionKey="someday" icon={Sparkles} label="Someday" count={somedayTodos.length} color="var(--text-muted)" />
                            {expandedSections.someday && somedayTodos.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                    {somedayTodos.map(t => <TodoItem key={t.id} todo={t} />)}
                                </div>
                            )}
                        </div>

                        {activeTodos.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                <Target size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                <h3>All clear!</h3>
                                <p style={{ color: 'var(--text-muted)' }}>Add goals to start earning Focus XP ✨</p>
                            </div>
                        )}
                    </>
                )}

                {filter === 'completed' && (
                    completedTodos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                            <CheckCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                            <h3>No completed goals yet</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Complete goals to level up!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                            {completedTodos.map(t => <TodoItem key={t.id} todo={t} />)}
                        </div>
                    )
                )}

                {filter === 'all' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                        {data.todos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                                <Target size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                <h3>No goals yet</h3>
                                <p style={{ color: 'var(--text-muted)' }}>Click "New Goal" to get started!</p>
                            </div>
                        ) : data.todos.map(t => <TodoItem key={t.id} todo={t} />)}
                    </div>
                )}
            </Card>

            {/* Add Goal Modal */}
            <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Goal">
                <form onSubmit={handleAddTodo} className="flex flex-col gap-md">
                    <Input label="What's the goal?" placeholder="e.g. Finish React project..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    <div>
                        <label className="input-label">Priority</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['low', 'medium', 'high', 'urgent'].map(p => (
                                <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })} style={{
                                    flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                                    background: form.priority === p ? PRIORITY_COLORS[p] : 'var(--surface)',
                                    color: form.priority === p ? 'white' : 'var(--text)', fontWeight: 700,
                                    fontSize: 'var(--text-xs)', textTransform: 'uppercase', transition: 'all 0.2s'
                                }}>
                                    {p} <span style={{ fontSize: '9px', opacity: 0.8 }}>+{PRIORITY_XP[p]}✨</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <Input label="Due Date (optional)" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button variant="primary" type="submit">Add Goal</Button>
                    </div>
                </form>
            </Modal>

            {/* Float Up Animation */}
            <style>{`
                @keyframes floatUp {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-60px) scale(1.3); }
                }
            `}</style>
        </div>
    );
};

export default Planner;
