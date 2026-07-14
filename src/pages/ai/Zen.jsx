import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Input, Badge } from '../../components/common';
import {
    Brain,
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
    Play
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import { zenService } from '../../services/zenService';
import * as db from '../../services/database';
import { routineService } from '../../services/routineService';
import ReactMarkdown from 'react-markdown';

const Zen = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [sentientVoice, setSentientVoice] = useState(true);
    const [actionTrace, setActionTrace] = useState([]); // execution log of actions
    const [isExecuting, setIsExecuting] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    // Load full system state for ZEN context
    const getSystemContext = async () => {
        try {
            const [members, routines, tasks, submissions, inviteCodes, classrooms] = await Promise.all([
                db.getMembers().catch(() => []),
                routineService.getAllRoutinesForHistory().catch(() => []),
                db.getTasks().catch(() => []),
                db.getGlobalSubmissions().catch(() => []),
                db.getInviteCodes().catch(() => []),
                db.getClassrooms().catch(() => [])
            ]);

            // Prune data to avoid exceeding context window / TPM limits
            const prunedMembers = (members || [])
                .map(m => ({ name: m.name, email: m.email, role: m.role }))
                .slice(0, 20);

            const prunedRoutines = (routines || [])
                .filter(r => r.user_id === user?.id)
                .map(r => ({ id: r.id, title: r.title, frequency: r.frequency, is_active: r.is_active }))
                .slice(0, 15);

            const prunedTasks = (tasks || [])
                .map(t => ({ id: t.id, title: t.title, status: t.status, xp: t.xp, due_date: t.due_date }))
                .slice(0, 15);

            const prunedSubmissions = (submissions || [])
                .filter(s => s.status === 'pending')
                .map(s => ({ id: s.id, task_title: s.task_title, member_name: s.user_name || s.member_name, submitted_at: s.created_at || s.submitted_at }))
                .slice(0, 10);

            const prunedInviteCodes = (inviteCodes || [])
                .filter(c => !c.is_used)
                .map(c => ({ code: c.code, role: c.role, created_at: c.created_at }))
                .slice(0, 10);

            const prunedClassrooms = (classrooms || [])
                .map(c => ({ id: c.id, name: c.name, description: c.description || '' }))
                .slice(0, 15);

            return {
                user: { id: user?.id, email: user?.email, role: user?.role, name: user?.name },
                members: prunedMembers,
                routines: prunedRoutines,
                tasks: prunedTasks,
                submissions: prunedSubmissions,
                inviteCodes: prunedInviteCodes,
                classrooms: prunedClassrooms
            };
        } catch (err) {
            console.error('Error fetching ZEN context:', err);
            return { user };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || isExecuting) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an API Key in Settings > AI Settings to use ZEN.');
            return;
        }

        const userMsg = { role: 'user', content: input, timestamp: new Date() };
        const updatedMessages = [...messages, userMsg];

        setMessages(updatedMessages);
        setInput('');
        setLoading(true);
        setActionTrace([]);

        try {
            // Gather system context for the model
            const contextData = await getSystemContext();

            // Ask ZEN
            const response = await aiService.zenChat(updatedMessages, contextData, null);

            // Separate action script and natural response
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

            // Save history
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

            // Speak sentient reply if enabled
            if (sentientVoice && 'speechSynthesis' in window) {
                const cleanText = naturalReply.replace(/[*#`_]/g, '');
                const utterance = new SpeechSynthesisUtterance(cleanText.substring(0, 200));
                utterance.pitch = 0.9;
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }

            // Execute Actions automatically
            if (actionJson && actionJson.length > 0) {
                setIsExecuting(true);
                setActionTrace(actionJson.map(act => ({ type: act.type, status: 'pending', details: act.payload })));

                const results = await zenService.executeActions(actionJson, user);
                
                setActionTrace(results.map(res => ({
                    type: res.action,
                    status: res.status,
                    message: res.message || (res.status === 'success' ? 'Completed successfully' : 'Failed')
                })));

                // Add response from actions execution trace
                const traceSummary = results.map(res => 
                    `- **${res.action}**: ${res.status === 'success' ? '✅ Executed' : `❌ ${res.message}`}`
                ).join('\n');

                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: `*System Execution Summary:*\n\n${traceSummary}`,
                        timestamp: new Date(),
                        isSystemTrace: true
                    }
                ]);
            }

        } catch (error) {
            console.error('ZEN chat error:', error);
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `**System Fault:** ${error.message}`, timestamp: new Date(), isError: true }
            ]);
        } finally {
            setLoading(false);
            setIsExecuting(false);
        }
    };

    return (
        <div className="animate-fade-in flex-mobile-col ai-container-mobile" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>
            
            {/* History Sidebar */}
            <Card className="ai-sidebar-mobile" style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={startNewChat} style={{ width: '100%' }}>
                        <MessageSquare size={16} />
                        <span style={{ marginLeft: '8px' }}>Initiate Session</span>
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
                                        background: sessionId === item.id ? 'var(--primary-100)' : 'transparent',
                                        color: sessionId === item.id ? 'var(--primary-700)' : 'var(--text-main)',
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
                
                {/* Chat Panel */}
                <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                    {/* Header */}
                    <div style={{ 
                        padding: 'var(--space-md)', 
                        borderBottom: '1px solid var(--border)',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div className="flex items-center gap-md">
                            <div style={{ position: 'relative' }}>
                                <Brain className="text-primary-500 animate-pulse" size={24} />
                                <span style={{
                                    position: 'absolute', bottom: -2, right: -2,
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: '#10b981', border: '2px solid var(--surface)'
                                }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    ZEN <Badge variant="accent" size="xs">Sentient AI v1.0</Badge>
                                </h3>
                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
                                    Active Core Module · Direct Platform Access
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-sm">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSentientVoice(!sentientVoice)}
                                style={{ color: sentientVoice ? 'var(--primary-500)' : 'var(--text-muted)' }}
                            >
                                <Zap size={14} /> Voice Synthesis: {sentientVoice ? 'ON' : 'OFF'}
                            </Button>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }} className="flex flex-col gap-md">
                        {messages.length === 0 ? (
                            <div style={{ 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl)'
                            }}>
                                <Brain size={48} className="text-primary-200 mb-md animate-bounce" />
                                <h3>ZEN Core Initialized</h3>
                                <p style={{ maxWidth: '400px', fontSize: 'var(--text-sm)' }}>
                                    "Good day, sir. I have synchronized with the database. You can ask me to manage routines, schedule tasks, grade submissions, or handle invitation codes. What are your instructions?"
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
                                    <div style={{
                                        padding: 'var(--space-md) var(--space-lg)',
                                        borderRadius: 'var(--radius-lg)',
                                        background: m.isSystemTrace 
                                            ? 'rgba(99, 102, 241, 0.05)'
                                            : m.role === 'user' ? 'var(--primary-500)' : 'var(--surface-muted)',
                                        color: m.role === 'user' ? 'white' : 'var(--text-main)',
                                        border: m.isSystemTrace ? '1px dashed var(--primary-500)' : '1px solid var(--border)',
                                        fontSize: 'var(--text-sm)',
                                        boxShadow: m.role === 'user' ? 'var(--shadow-md)' : 'none'
                                    }}>
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {m.role === 'user' ? 'You' : 'ZEN'} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSubmit} style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)', display: 'flex', gap: 'var(--space-sm)' }}>
                        <Input
                            placeholder={isExecuting ? "Executing action protocols..." : "Speak to ZEN (e.g., 'Grade my routine logs' or 'Create a task for tomorrow')"}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading || isExecuting}
                            style={{ flex: 1 }}
                        />
                        <Button variant="primary" type="submit" disabled={loading || isExecuting || !input.trim()}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </Button>
                    </form>
                </Card>

                {/* Execution Trace Console */}
                {actionTrace.length > 0 && (
                    <Card style={{ 
                        height: '160px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
                        border: '1px solid var(--primary-500)', background: '#0a0b10', color: '#10b981'
                    }}>
                        <div style={{ 
                            padding: 'var(--space-xs) var(--space-md)', borderBottom: '1px solid #1a1c23',
                            background: '#0e1017', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: '11px', fontWeight: 'bold'
                        }}>
                            <div className="flex items-center gap-xs">
                                <Terminal size={12} />
                                <span>EXECUTION PROTOCOLS ACTIVE</span>
                            </div>
                            {isExecuting && <Badge variant="warning" size="xs">RUNNING</Badge>}
                        </div>
                        <div style={{ flex: 1, padding: 'var(--space-sm) var(--space-md)', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px' }}>
                            {actionTrace.map((trace, idx) => (
                                <div key={idx} style={{ 
                                    marginBottom: '4px',
                                    color: trace.status === 'success' ? '#10b981' : trace.status === 'pending' ? '#f59e0b' : '#ef4444'
                                }}>
                                    [{new Date().toLocaleTimeString()}] {trace.type} {"->"} {trace.status.toUpperCase()} 
                                    {trace.message ? ` (${trace.message})` : ''}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default Zen;
