import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Input, Badge } from '../common';
import {
    Brain,
    Send,
    Trash2,
    Loader2,
    Terminal,
    Zap,
    X,
    MessageSquare,
    Volume2,
    VolumeX
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import { zenService } from '../../services/zenService';
import * as db from '../../services/database';
import { routineService } from '../../services/routineService';
import ReactMarkdown from 'react-markdown';

const ZenWidget = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentientVoice, setSentientVoice] = useState(true);
    const [actionTrace, setActionTrace] = useState([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [isOpen, messages]);

    // Load active history session from DB on widget load
    useEffect(() => {
        if (!user?.id) return;
        const fetchSavedSession = async () => {
            try {
                const history = await aiService.getHistory('zen');
                if (history && history.length > 0) {
                    // Load the most recent session
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
            const welcome = "Systems operational, sir. ZEN online and standing by.";
            const initialMsgs = [
                {
                    role: 'assistant',
                    content: welcome,
                    timestamp: new Date()
                }
            ];
            setMessages(initialMsgs);
            if (sentientVoice && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(welcome);
                utterance.pitch = 0.95;
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
            
            // Persist initial message
            aiService.saveHistory('zen', initialMsgs, 'Zen Widget Session', null)
                .then(session => {
                    if (session) setSessionId(session.id);
                });
        }
    }, [isOpen]);

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
            const contextData = await getSystemContext();
            const response = await aiService.zenChat(updatedMessages, contextData, null);

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

            // Persist conversation history to Supabase
            if (sessionId) {
                await aiService.updateHistory(sessionId, finalMessages);
            } else {
                const session = await aiService.saveHistory('zen', finalMessages, 'Zen Widget Session', null);
                if (session) setSessionId(session.id);
            }

            if (sentientVoice && 'speechSynthesis' in window) {
                const cleanText = naturalReply.replace(/[*#`_]/g, '');
                const utterance = new SpeechSynthesisUtterance(cleanText.substring(0, 200));
                utterance.pitch = 0.95;
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
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
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `**Protocol error:** ${error.message}`, timestamp: new Date(), isError: true }
            ]);
        } finally {
            setLoading(false);
            setIsExecuting(false);
        }
    };

    if (!user) return null;

    return (
        <>
            {/* Holographic Glowing Floating Orb (FAB) - Hidden when drawer is open */}
            {!isOpen && (
                <div 
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: '85px',
                        right: '24px',
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #6366f1 0%, #4338ca 70%, #000 100%)',
                        boxShadow: '0 0 15px rgba(99, 102, 241, 0.4), inset 0 0 5px rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 99999,
                        border: '1.5px solid rgba(255,255,255,0.15)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="zen-orb-fab"
                >
                    <div style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '2px solid rgba(99, 102, 241, 0.3)',
                        animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                        pointerEvents: 'none'
                    }} />
                    <Brain size={24} className="text-white" />
                </div>
            )}

            {/* Glowing Drawer Style Chat Panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '380px',
                maxWidth: '90vw',
                background: 'rgba(10, 11, 16, 0.95)',
                backdropFilter: 'blur(16px)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 99998,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: 'var(--space-md) var(--space-lg)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative' }}>
                            <Brain className="text-primary-400 animate-pulse" size={20} />
                            <span style={{
                                position: 'absolute', bottom: -2, right: -2,
                                width: 6, height: 6, borderRadius: '50%',
                                background: '#10b981', border: '1.5px solid #000'
                            }} />
                        </div>
                        <div>
                            <h4 style={{ margin: 0, color: 'white', fontWeight: 800 }}>ZEN Companion</h4>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Sentient Interface Module</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            onClick={() => setSentientVoice(!sentientVoice)}
                            style={{ background: 'none', border: 'none', color: sentientVoice ? 'var(--primary-400)' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                            title="Toggle Voice Response"
                        >
                            {sentientVoice ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
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
                            <div style={{
                                padding: '8px 12px',
                                borderRadius: '12px',
                                background: m.isSystemTrace 
                                    ? 'rgba(99, 102, 241, 0.05)'
                                    : m.role === 'user' ? 'var(--primary-600)' : 'rgba(255, 255, 255, 0.04)',
                                color: 'white',
                                border: m.isSystemTrace ? '1px dashed rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                                fontSize: '12px',
                                lineHeight: '1.5'
                            }}>
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                            <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)', marginTop: '2px' }}>
                                {m.role === 'user' ? 'You' : 'ZEN'} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Live Console Output */}
                {actionTrace.length > 0 && (
                    <div style={{
                        height: '100px',
                        background: 'rgba(5, 5, 8, 0.9)',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        padding: '6px 12px',
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        color: '#10b981',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontSize: '8px' }}>
                            <span>SYSTEM EXECUTION TRACE</span>
                            {isExecuting && <span className="animate-pulse">RUNNING...</span>}
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
                        padding: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        gap: '6px',
                        background: 'rgba(0, 0, 0, 0.2)'
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
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: 'white',
                            fontSize: '12px',
                            outline: 'none'
                        }}
                    />
                    <button 
                        type="submit"
                        disabled={loading || isExecuting || !input.trim()}
                        style={{
                            background: 'var(--primary-600)',
                            border: 'none',
                            borderRadius: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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
                    transform: scale(1.15) rotate(5deg);
                    box-shadow: 0 0 25px rgba(99, 102, 241, 0.8), inset 0 0 15px rgba(255,255,255,0.5);
                }
                .active-orb {
                    transform: rotate(180deg) scale(0.9);
                }
            `}} />
        </>
    );
};

export default ZenWidget;
