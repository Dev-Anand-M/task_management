import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Input, Badge } from '../../components/common';
import { ZenLogo } from '../../components/common/ZenLogo';
import {
    Send,
    Trash2,
    MessageSquare,
    Loader2,
    Terminal,
    Sparkles,
    Shield,
    CheckCircle,
    XCircle,
    AlertCircle,
    Zap,
    Play,
    Cpu,
    Settings,
    Volume2,
    VolumeX
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import { zenService } from '../../services/zenService';
import { sentientBroadcastService } from '../../services/sentientBroadcastService';
import { ttsService } from '../../services/ttsService';
import * as db from '../../services/database';
import { routineService } from '../../services/routineService';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const Zen = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    let themeCtx = null;
    try {
        themeCtx = useTheme();
    } catch {
        themeCtx = null;
    }

    const activeTheme = (themeCtx?.theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : '') || '').toLowerCase();
    const activeColorScheme = (themeCtx?.colorScheme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-color-scheme') : '') || '').toLowerCase();

    const isLiquidGlass = 
        activeTheme.includes('liquid') || activeTheme.includes('crystal') || activeTheme.includes('glass') ||
        activeColorScheme.includes('liquid') || activeColorScheme.includes('crystal') || activeColorScheme.includes('glass');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [sentientVoice, setSentientVoice] = useState(true);
    const [actionTrace, setActionTrace] = useState([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [speakingIndex, setSpeakingIndex] = useState(null);

    const handleSpeakMessage = (index, text) => {
        if (speakingIndex === index) {
            ttsService.stop();
            setSpeakingIndex(null);
        } else {
            ttsService.stop();
            const success = ttsService.speak(text);
            if (success) {
                setSpeakingIndex(index);
            }
        }
    };

    // Active AI Model Selection
    const [selectedModel, setSelectedModel] = useState(aiService.getSelectedModel());
    const [allModels, setAllModels] = useState([]);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        loadHistory();
        refreshModels();

        const handleModelChange = (e) => {
            if (e.detail?.modelId) {
                setSelectedModel(e.detail.modelId);
            }
        };

        window.addEventListener('ai-model-changed', handleModelChange);
        return () => window.removeEventListener('ai-model-changed', handleModelChange);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const refreshModels = () => {
        const models = aiService.getAllAvailableModels();
        setAllModels(models);
        setSelectedModel(aiService.getSelectedModel());
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await aiService.getHistory('zen');
            setHistory(data || []);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const startNewChat = () => {
        setSessionId(null);
        setMessages([]);
        setInput('');
        setActionTrace([]);
    };

    const loadSession = (session) => {
        setSessionId(session.id);
        setMessages(session.content || []);
        setActionTrace([]);
    };

    const deleteSession = async (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat with ZEN?')) {
            const success = await aiService.deleteHistoryItem(id);
            if (success) {
                if (sessionId === id) startNewChat();
                await loadHistory();
            }
        }
    };

    const getSystemContext = async () => {
        const isAdmin = user?.role === 'admin';
        try {
            const basePromises = [
                routineService.getAllRoutinesForHistory().catch(() => []),
                db.getTasks().catch(() => []),
                db.getClassrooms().catch(() => []),
                routineService.getAllLogs().catch(() => []),
                db.getQuizAttemptsByUser(user.id).catch(() => []),
                db.getStudyNotes(user.id).catch(() => []),
                db.getProfiles().catch(() => []),
                db.getNotifications(user.id).catch(() => []),
                db.getAnnouncements().catch(() => [])
            ];

            const adminPromises = isAdmin ? [
                db.getMembers().catch(() => []),
                db.getGlobalSubmissions().catch(() => []),
                db.getInviteCodes().catch(() => [])
            ] : [];

            const [
                routines, tasks, classrooms, logs, quizAttempts, studyNotes, profiles, notifications, announcements,
                ...adminData
            ] = await Promise.all([...basePromises, ...adminPromises]);

            const sortedProfiles = [...(profiles || [])].sort((a, b) => (b.xp || 0) - (a.xp || 0));
            const ranking = sortedProfiles.findIndex(p => p.id === user.id) + 1;
            const userProfile = profiles?.find(p => p.id === user.id) || {};

            const userRoutines = (routines || []).filter(r => r.user_id === user?.id);
            const userTasks = (tasks || []).slice(0, 15);

            // Time-Aware Start-of-Day Dispatch Executor
            const todayDispatchPlan = await sentientBroadcastService.checkAndExecuteScheduledDispatches(
                user?.id,
                user?.name,
                userRoutines,
                userTasks,
                messages
            );

            const broadcastHistory = sentientBroadcastService.getBroadcastHistory(user?.id);

            const context = {
                user: { 
                    id: user?.id, 
                    email: user?.email, 
                    role: user?.role, 
                    name: user?.name,
                    xp: userProfile.xp || 0,
                    streak: userProfile.streak || 0,
                    level: userProfile.level || 1,
                    leaderboard_rank: ranking || 'N/A'
                },
                routines: userRoutines.slice(0, 20),
                routine_logs: (logs || []).filter(l => l.user_id === user?.id).slice(0, 25),
                tasks: userTasks,
                classrooms: (classrooms || []).slice(0, 10),
                quiz_attempts: (quizAttempts || []).slice(0, 10),
                study_notes: (studyNotes || []).slice(0, 15),
                announcements: (announcements || []).slice(0, 10),
                notifications: (notifications || []).filter(n => !n.is_read).slice(0, 10),
                broadcast_history: broadcastHistory,
                today_dispatch_plan: todayDispatchPlan
            };

            if (isAdmin && adminData.length === 3) {
                const [members, submissions, inviteCodes] = adminData;
                context.members = (members || []).slice(0, 20);
                context.submissions = (submissions || []).filter(s => s.status === 'pending').slice(0, 10);
                context.inviteCodes = (inviteCodes || []).filter(c => !c.is_used).slice(0, 10);
            }

            return context;
        } catch (err) {
            console.error('Error fetching ZEN context:', err);
            return { user };
        }
    };

    const handleModelSelect = async (modelId) => {
        setSelectedModel(modelId);
        await aiService.setSelectedModel(modelId);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || isExecuting) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an API Key in Settings > AI Settings to use ZEN.');
            navigate('/settings');
            return;
        }

        const userMsg = { role: 'user', content: input, timestamp: new Date() };
        const updatedMessages = [...messages, userMsg];

        setMessages(updatedMessages);
        setInput('');
        setLoading(true);
        setActionTrace([]);

        try {
            const contextData = await getSystemContext();
            const response = await aiService.zenChat(updatedMessages, contextData, selectedModel);

            let naturalReply = response;
            let actionJson = null;

            if (response.includes('---ACTIONS---')) {
                const parts = response.split('---ACTIONS---');
                naturalReply = parts[0].trim();
                const jsonText = parts[1].trim();
                try {
                    actionJson = JSON.parse(jsonText);
                } catch (e) {
                    console.error('Failed to parse ZEN actions JSON:', e);
                }
            }

            const aiMsg = { role: 'assistant', content: naturalReply, timestamp: new Date(), actions: actionJson };
            const finalMessages = [...updatedMessages, aiMsg];
            setMessages(finalMessages);

            if (sessionId) {
                await aiService.updateHistory(sessionId, finalMessages);
            } else {
                const title = userMsg.content.substring(0, 30) + (userMsg.content.length > 30 ? '...' : '');
                const newSession = await aiService.saveHistory('zen', finalMessages, title, null);
                if (newSession) {
                    setSessionId(newSession.id);
                    loadHistory();
                }
            }

            if (sentientVoice) {
                ttsService.speak(naturalReply);
            }

            if (actionJson && actionJson.length > 0) {
                setIsExecuting(true);
                setActionTrace(actionJson.map(act => ({ type: act.type, status: 'pending', details: act.payload })));

                const results = await zenService.executeActions(actionJson, user);
                
                setActionTrace(results.map(res => ({
                    type: res.action,
                    status: res.status,
                    message: res.message || (res.status === 'success' ? 'Completed successfully' : 'Failed')
                })));

                const traceSummary = results.map(res => 
                    `- **${res.action}**: ${res.status === 'success' ? '✅ Executed' : `❌ ${res.message}`}`
                ).join('\n');

                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: `*System Protocol Output:*\n\n${traceSummary}`,
                        timestamp: new Date(),
                        isSystemTrace: true
                    }
                ]);
            }

        } catch (error) {
            console.error('ZEN error:', error);
            let errText = error.message || 'Unknown protocol error';
            if (errText.includes('distributor') || errText.includes('channel') || errText.includes('Protocol error')) {
                errText += '\n\n💡 **Tip:** The selected AI provider/model channel is currently unavailable. Please use the **Model Selector bar** at the top of this panel to switch to another active provider or model (e.g. SambaNova or Groq)!';
            }

            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `**Protocol error:** ${errText}`, timestamp: new Date(), isError: true }
            ]);
        } finally {
            setLoading(false);
            setIsExecuting(false);
        }
    };

    return (
        <div className="stagger-in flex-mobile-col ai-container-mobile" style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--space-md)' }}>
            
            {/* History Sidebar */}
            <Card className="ai-sidebar-mobile" style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={startNewChat} style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
                        <MessageSquare size={16} />
                        <span style={{ marginLeft: '8px' }}>Initiate New Session</span>
                    </Button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No active ZEN logs
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {history.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => loadSession(item)}
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        background: sessionId === item.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                        border: sessionId === item.id ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                                        color: sessionId === item.id ? '#c084fc' : 'var(--text-main)',
                                        fontSize: 'var(--text-sm)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                    className="history-item"
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                                    <Trash2
                                        size={14}
                                        className="delete-icon"
                                        style={{ opacity: 0.5 }}
                                        onClick={(e) => deleteSession(e, item.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Main Chat & Execution Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 'var(--space-md)' }}>
                
                <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                    {/* Header */}
                    <div style={{ 
                        padding: 'var(--space-md)', 
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--card)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div className="flex items-center gap-md">
                            <ZenLogo size={32} />
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                                    ZEN <Badge variant="accent" size="xs">Sentient AI v3.0</Badge>
                                </h3>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    Active Core Module · Direct Platform Access
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-sm">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    const nextVal = !sentientVoice;
                                    setSentientVoice(nextVal);
                                    if (!nextVal && 'speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                    }
                                }}
                                style={{ color: sentientVoice ? '#c084fc' : 'var(--text-muted)' }}
                            >
                                <Zap size={14} /> Voice Synthesis: {sentientVoice ? 'ON' : 'OFF'}
                            </Button>
                        </div>
                    </div>

                    {/* AI Model Selector Sub-Header Bar */}
                    <div style={{
                        padding: '8px 16px',
                        background: 'rgba(15, 17, 26, 0.8)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                            <Cpu size={14} className="text-indigo-400" />
                            <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Engine Model:
                            </span>
                        </div>

                        <select
                            value={selectedModel}
                            onChange={(e) => handleModelSelect(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                borderRadius: '8px',
                                color: '#a78bfa',
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '6px 12px',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {allModels.map((m, idx) => (
                                <option key={`${m.provider}_${m.id}_${idx}`} value={m.id} style={{ background: '#0f172a', color: 'white' }}>
                                    [{m.provider.toUpperCase()}] {m.name}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => navigate('/settings')}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px'
                            }}
                        >
                            <Settings size={14} /> AI Settings
                        </button>
                    </div>

                    {/* Messages Container */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }} className="flex flex-col gap-md">
                        {messages.length === 0 ? (
                            <div style={{ 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl)'
                            }}>
                                <ZenLogo size={64} className="mb-md" />
                                <h3>ZEN Initialized</h3>
                                <p style={{ maxWidth: '420px', fontSize: 'var(--text-sm)' }}>
                                    "Systems online and fully synchronized. I am ready to manage your routines, schedule tasks, grade submissions, or analyze your performance trends. What are your instructions?"
                                </p>
                            </div>
                        ) : (
                            messages.map((m, idx) => (
                                <div key={idx} style={{
                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                                }}>
                                    <div 
                                        className={m.role === 'user' ? 'zen-user-chat-bubble' : 'zen-assistant-chat-bubble'}
                                        style={{
                                        padding: 'var(--space-md) var(--space-lg)',
                                        borderRadius: 'var(--radius-lg)',
                                        background: m.isSystemTrace 
                                            ? 'var(--primary-500-alpha, rgba(239, 68, 68, 0.08))'
                                            : m.role === 'user' 
                                                ? 'linear-gradient(135deg, var(--primary-500, #f59e0b) 0%, var(--primary-600, #d97706) 50%, var(--primary-700, #b45309) 100%)' 
                                                : 'var(--card, var(--surface, #ffffff))',
                                        color: m.role === 'user' ? '#ffffff' : 'var(--text, var(--text-main, #1c1917))',
                                        border: m.isSystemTrace ? '1px dashed var(--primary-500)' : m.isError ? '1px solid rgba(239, 68, 68, 0.4)' : m.role === 'user' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border)',
                                        fontSize: 'var(--text-sm)',
                                        boxShadow: m.role === 'user' ? '0 4px 14px var(--primary-500-alpha, rgba(0, 0, 0, 0.25))' : '0 2px 8px rgba(0,0,0,0.06)'
                                    }}>
                                        <div className="markdown-body-zen">
                                            <ReactMarkdown>{m.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {m.role === 'user' ? 'You' : 'ZEN'} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {m.role === 'assistant' && !m.isSystemTrace && (
                                            <button
                                                type="button"
                                                onClick={() => handleSpeakMessage(idx, m.content)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: speakingIndex === idx ? 'var(--primary-500)' : 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    padding: '2px 4px',
                                                    borderRadius: '4px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '2px',
                                                    fontSize: '10px'
                                                }}
                                                title={speakingIndex === idx ? "Stop speaking" : "Listen to audio response"}
                                            >
                                                {speakingIndex === idx ? <VolumeX size={12} className="animate-pulse" /> : <Volume2 size={12} />}
                                                {speakingIndex === idx ? 'Stop' : 'Read Aloud'}
                                            </button>
                                        )}
                                    </span>
                                </div>
                            ))
                        )}
                        {loading && (
                            <div style={{
                                alignSelf: 'flex-start',
                                maxWidth: '85%',
                                padding: 'var(--space-md) var(--space-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--card, #ffffff)',
                                border: '1px solid var(--primary-500)',
                                boxShadow: '0 0 15px var(--primary-500-alpha, rgba(99, 102, 241, 0.2))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <Loader2 size={16} className="animate-spin text-primary-500" />
                                <span className="animate-pulse" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--primary-500)' }}>
                                    {[
                                        "Calibrating neural core...",
                                        "Reading context nodes...",
                                        "For real thinking bro...",
                                        "Synthesizing wisdom...",
                                        "Querying matrix..."
                                    ][Math.floor((Date.now() / 2500) % 5)]}
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Execution trace */}
                    {actionTrace.length > 0 && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(5, 5, 8, 0.95)',
                            borderTop: '1px solid var(--border)',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#10b981'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', opacity: 0.7 }}>
                                <span>EXECUTION TRACE</span>
                                {isExecuting && <span className="animate-pulse">EXECUTING...</span>}
                            </div>
                            {actionTrace.map((trace, idx) => (
                                <div key={idx} style={{ 
                                    color: trace.status === 'success' ? '#10b981' : trace.status === 'pending' ? '#f59e0b' : '#ef4444' 
                                }}>
                                    {trace.type} {"->"} {trace.status.toUpperCase()} {trace.message ? `(${trace.message})` : ''}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Input Form */}
                    <form onSubmit={handleSubmit} style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)', display: 'flex', gap: 'var(--space-sm)' }}>
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={loading ? "ZEN is thinking..." : isExecuting ? "Executing actions..." : "Command ZEN..."}
                            disabled={loading || isExecuting}
                            style={{ flex: 1 }}
                        />
                        <Button type="submit" disabled={loading || isExecuting || !input.trim()} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default Zen;
