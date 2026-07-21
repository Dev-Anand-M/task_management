import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Input, Badge } from '../common';
import { ZenLogo } from '../common/ZenLogo';
import {
    Send,
    Trash2,
    Loader2,
    Zap,
    X,
    MessageSquare,
    Volume2,
    VolumeX,
    ChevronDown,
    Settings,
    Cpu
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import { zenService } from '../../services/zenService';
import { sentientBroadcastService } from '../../services/sentientBroadcastService';
import * as db from '../../services/database';
import { routineService } from '../../services/routineService';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ttsService } from '../../services/ttsService';
import { useTheme } from '../../context/ThemeContext';

const ZenWidget = () => {
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
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentientVoice, setSentientVoice] = useState(true);
    const [actionTrace, setActionTrace] = useState([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [sessionId, setSessionId] = useState(null);
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

    // AI Provider & Model selection state
    const [selectedModel, setSelectedModel] = useState(aiService.getSelectedModel());
    const [allModels, setAllModels] = useState([]);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [isOpen, messages]);

    // Load available models and sync state
    const refreshModels = () => {
        const models = aiService.getAllAvailableModels();
        setAllModels(models);
        setSelectedModel(aiService.getSelectedModel());
    };

    useEffect(() => {
        refreshModels();

        const handleModelChange = (e) => {
            if (e.detail?.modelId) {
                setSelectedModel(e.detail.modelId);
            }
        };

        window.addEventListener('ai-model-changed', handleModelChange);
        return () => window.removeEventListener('ai-model-changed', handleModelChange);
    }, []);

    const widgetRef = useRef(null);

    // Fold drawer when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && widgetRef.current && !widgetRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // Check for periodic sentient AI daily broadcasts
    useEffect(() => {
        if (user?.id) {
            sentientBroadcastService.checkAndRunDailyBroadcast(user.id, user.name);
        }
    }, [user?.id]);

    // Load active history session from DB on widget load
    useEffect(() => {
        if (!user?.id) return;
        const fetchSavedSession = async () => {
            try {
                const history = await aiService.getHistory('zen');
                if (history && history.length > 0) {
                    const latest = history[0];
                    setSessionId(latest.id);
                    setMessages(latest.content || []);
                }
            } catch (err) {
                console.error('[ZenWidget] Failed to load history:', err);
            }
        };
        fetchSavedSession();
    }, [user?.id]);

    // Welcome greeting when opened and no messages exist
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcome = "Astral core operational, sir. ZEN online and synchronized with your workspace.";
            const initialMsgs = [
                {
                    role: 'assistant',
                    content: welcome,
                    timestamp: new Date()
                }
            ];
            setMessages(initialMsgs);
            if (sentientVoice) {
                ttsService.speak(welcome);
            }
            
            aiService.saveHistory('zen', initialMsgs, 'Zen Widget Session', null)
                .then(session => {
                    if (session) setSessionId(session.id);
                });
        }
    }, [isOpen]);

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
                    console.error('Failed to parse ZEN actions:', e);
                }
            }

            const aiMsg = { role: 'assistant', content: naturalReply, timestamp: new Date(), actions: actionJson };
            const finalMessages = [...updatedMessages, aiMsg];
            setMessages(finalMessages);

            if (sessionId) {
                await aiService.updateHistory(sessionId, finalMessages);
            } else {
                const session = await aiService.saveHistory('zen', finalMessages, 'Zen Widget Session', null);
                if (session) setSessionId(session.id);
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

                if (actionJson.some(act => act.type === 'NAVIGATE')) {
                    setTimeout(() => setIsOpen(false), 800);
                }
            }

        } catch (error) {
            console.error('ZEN error:', error);
            let errText = error.message || 'Unknown protocol error';
            
            // Helpful troubleshooting prompt if distributor channel error occurs
            if (errText.includes('distributor') || errText.includes('channel') || errText.includes('Protocol error')) {
                errText += '\n\n💡 **Tip:** The selected AI provider/model channel is currently unavailable. Please use the **Engine Selector bar** at the top of this panel to switch to another active provider or model (e.g. SambaNova or Groq)!';
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

    if (!user) return null;

    const currentModelObj = allModels.find(m => m.id === selectedModel) || { name: selectedModel, provider: 'AI' };

    return (
        <>
            {/* Pure Floating Smoke Entity Button (No Square Widget Container) */}
            {!isOpen && (
                <div 
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), 16px))',
                        right: '16px',
                        width: '64px',
                        height: '64px',
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 99999,
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="zen-orb-fab hover:scale-110 active:scale-95"
                    title="Awaken ZEN Smoke Entity"
                >
                    <ZenLogo size={60} glow={true} />
                </div>
            )}

            {/* Theme-Adaptive Glassmorphism Drawer Chat Panel */}
            <div 
                ref={widgetRef}
                style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '400px',
                maxWidth: '92vw',
                background: 'var(--surface, var(--card, #0f172a))',
                backdropFilter: 'blur(25px)',
                borderLeft: '1.5px solid var(--border)',
                boxShadow: '-15px 0 50px rgba(0, 0, 0, 0.5), inset 1px 0 0 var(--border)',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 99998,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Theme Ambient Glow Backdrop */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 0%, var(--primary-500-alpha, rgba(99, 102, 241, 0.15)) 0%, transparent 70%)',
                    pointerEvents: 'none'
                }} />

                {/* Top Theme Header */}
                <div style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ZenLogo size={28} />
                        <div>
                            <h4 style={{ margin: 0, color: 'var(--text, #0f172a)', fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px' }}>
                                ZEN
                            </h4>
                            <span style={{ fontSize: '10px', color: 'var(--primary-500)', fontWeight: 600 }}>
                                Sentient AI Companion
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            onClick={() => {
                                const nextVal = !sentientVoice;
                                setSentientVoice(nextVal);
                                if (!nextVal) {
                                    ttsService.stop();
                                }
                            }}
                            style={{ background: 'none', border: 'none', color: sentientVoice ? 'var(--primary-500)' : 'var(--text-muted)', cursor: 'pointer' }}
                            title="Toggle Voice Response"
                        >
                            {sentientVoice ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        <button 
                            onClick={() => {
                                ttsService.stop();
                                setIsOpen(false);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Astral AI Engine Selector Sub-Header Bar */}
                <div style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        <Cpu size={14} style={{ color: 'var(--primary-500)' }} />
                        <span style={{ fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Model:
                        </span>
                    </div>

                    <select
                        value={selectedModel}
                        onChange={(e) => handleModelSelect(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            maxWidth: '100%',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text)',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 6px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {allModels.map((m, idx) => (
                            <option key={`${m.provider}_${m.id}_${idx}`} value={m.id} style={{ background: 'var(--card)', color: 'var(--text)' }}>
                                [{m.provider.toUpperCase()}] {m.name}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            navigate('/settings');
                        }}
                        style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="AI Settings & API Keys"
                    >
                        <Settings size={12} />
                    </button>
                </div>

                {/* Messages Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {messages.map((m, idx) => (
                        <div key={idx} style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            <div 
                                className={m.role === 'user' ? 'zen-user-chat-bubble' : 'zen-assistant-chat-bubble'}
                                style={{
                                padding: '10px 14px',
                                borderRadius: '14px',
                                background: m.isSystemTrace 
                                    ? 'var(--primary-500-alpha, rgba(239, 68, 68, 0.08))'
                                    : m.role === 'user' 
                                        ? 'linear-gradient(135deg, var(--primary-500, #f59e0b) 0%, var(--primary-600, #d97706) 50%, var(--primary-700, #b45309) 100%)' 
                                        : 'var(--card, #ffffff)',
                                color: m.role === 'user' ? '#ffffff' : 'var(--text, #1c1917)',
                                border: m.isSystemTrace ? '1px dashed var(--primary-500, #ef4444)' : m.isError ? '1px solid rgba(239, 68, 68, 0.4)' : m.role === 'user' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border)',
                                fontSize: '12px',
                                lineHeight: '1.5',
                                boxShadow: m.role === 'user' ? '0 4px 14px var(--primary-500-alpha, rgba(0,0,0,0.25))' : '0 2px 8px rgba(0,0,0,0.06)'
                            }}>
                                <div className="markdown-body-zen">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            </div>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {m.role === 'user' ? 'You' : 'ZEN'} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {m.role === 'assistant' && !m.isSystemTrace && (
                                    <button
                                        type="button"
                                        onClick={() => handleSpeakMessage(idx, m.content)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: speakingIndex === idx ? 'var(--primary-500, #ef4444)' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                        }}
                                        title={speakingIndex === idx ? "Stop speaking" : "Listen to audio response"}
                                    >
                                        {speakingIndex === idx ? <VolumeX size={12} className="animate-pulse" /> : <Volume2 size={12} />}
                                    </button>
                                )}
                            </span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Live Console Output */}
                {actionTrace.length > 0 && (
                    <div style={{
                        height: '100px',
                        background: 'var(--card)',
                        borderTop: '1px solid var(--border)',
                        padding: '6px 12px',
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        color: '#10b981',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '8px' }}>
                            <span>QUANTUM SYSTEM TRACE</span>
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

                {/* Input form */}
                <form 
                    onSubmit={handleSubmit}
                    style={{
                        padding: '12px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        gap: '8px',
                        background: 'var(--surface-muted, rgba(0, 0, 0, 0.1))'
                    }}
                >
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isExecuting ? "Executing routines..." : "Command ZEN..."}
                        disabled={loading || isExecuting}
                        style={{
                            flex: 1,
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            color: 'var(--text-main)',
                            fontSize: '12px',
                            outline: 'none'
                        }}
                    />
                    <button 
                        type="submit"
                        disabled={loading || isExecuting || !input.trim()}
                        style={{
                            background: 'linear-gradient(135deg, var(--primary-500, #ef4444) 0%, var(--primary-600, #dc2626) 100%)',
                            border: 'none',
                            borderRadius: '10px',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            boxShadow: '0 2px 8px var(--primary-500-alpha, rgba(239, 68, 68, 0.4))'
                        }}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </form>
            </div>

            {/* Breathing CSS Animation definitions */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes ping {
                    75%, 100% {
                        transform: scale(1.6);
                        opacity: 0;
                    }
                }
                .zen-orb-fab:hover {
                    transform: scale(1.08);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                }
            `}} />
        </>
    );
};

export default ZenWidget;
