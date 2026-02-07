import { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../../components/common';
import {
    Brain,
    Send,
    Trash2,
    Copy,
    CheckCircle,
    Sparkles,
    Code,
    MessageSquare,
    Loader2
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import ReactMarkdown from 'react-markdown';

const AIAssistant = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [context, setContext] = useState('');
    const [loading, setLoading] = useState(false);
    const [showContext, setShowContext] = useState(false);
    const [copied, setCopied] = useState(null);
    const messagesEndRef = useRef(null);

    // History state
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(true);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const loadInitData = async () => {
            // Load History
            await loadHistory();
        };
        loadInitData();
    }, []);

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await aiService.getHistory('assistant');
            setHistory(data || []);
        } catch (error) {
            console.error('Failed to load history:', error);
            // Optionally set an error state here if you want to show a message
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadSession = (session) => {
        setSessionId(session.id);
        setMessages(session.content || []);

        // History model restoration removed for automatic calibration
        if (session.model_used) {
            // We can log or display the model used if desired, but we won't switch settings.
        }
    };

    const startNewChat = () => {
        setSessionId(null);
        setMessages([]);
        setContext('');
        setInput('');
        // Automatic calibration applies. No need to revert model.
    };

    const deleteSession = async (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat?')) {
            const success = await aiService.deleteHistoryItem(id);
            if (success) {
                if (sessionId === id) {
                    startNewChat();
                }
                await loadHistory();
            } else {
                alert('Failed to delete chat. Please ensuring you have run the database migration.');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an AI provider (Gemini, OpenAI, etc.) in Settings > AI Settings.');
            return;
        }

        const userMessage = { role: 'user', content: input, timestamp: new Date() };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const response = await aiService.askCodingAssistant(input, context, null);
            const aiMessage = { role: 'assistant', content: response, timestamp: new Date() };
            const finalMessages = [...updatedMessages, aiMessage];

            setMessages(finalMessages);

            // Save to history
            if (sessionId) {
                await aiService.updateHistory(sessionId, finalMessages);
                // Update local history list to show new preview presumably? (optional)
            } else {
                const title = userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? '...' : '');
                const newSession = await aiService.saveHistory('assistant', finalMessages, title, null);
                if (newSession) {
                    setSessionId(newSession.id);
                    loadHistory();
                }
            }

        } catch (error) {
            const errorMessage = { role: 'assistant', content: `**Error:** ${error.message}`, timestamp: new Date(), isError: true };
            const finalMessages = [...updatedMessages, errorMessage];
            setMessages(finalMessages);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = async (action) => {
        const prompts = {
            'explain': 'Explain the concept of React hooks and when to use them.',
            'debug': 'What are common causes of "undefined is not an object" error in JavaScript?',
            'best-practices': 'What are the best practices for writing clean React components?',
            'interview': 'What are common web development interview questions for beginners?'
        };
        setInput(prompts[action] || '');
    };

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopied(index);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>

            {/* History Sidebar */}
            <Card style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={startNewChat} style={{ width: '100%' }}>
                        <MessageSquare size={16} />
                        <span style={{ marginLeft: '8px' }}>New Chat</span>
                    </Button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No past chats
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
                                        alignItems: 'center',
                                        group: 'true'
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

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-md">
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Brain className="text-primary" />
                            AI Coding Assistant
                        </h2>
                    </div>
                    <div className="flex gap-sm items-center">
                        {/* Model Selector removed for automatic calibration */}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowContext(!showContext)}
                        >
                            {showContext ? 'Hide' : 'Add'} Context
                        </Button>
                    </div>
                </div>

                {/* Context Input */}
                {showContext && (
                    <Card style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)' }}>
                        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-xs)', display: 'block' }}>
                            Context (optional code or information)
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Paste your code or add context here..."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: 'var(--space-sm)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-main)',
                                fontFamily: 'monospace',
                                fontSize: 'var(--text-sm)',
                                resize: 'vertical'
                            }}
                        />
                    </Card>
                )}

                {/* Chat Messages */}
                <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                <Sparkles size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                <h3 style={{ margin: '0 0 var(--space-sm)' }}>How can I help you today?</h3>
                                <p style={{ marginBottom: 'var(--space-lg)' }}>
                                    Ask me anything about coding, debugging, or learning new skills.
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', justifyContent: 'center' }}>
                                    <Badge style={{ cursor: 'pointer', padding: 'var(--space-sm) var(--space-md)' }} onClick={() => handleQuickAction('explain')}>Explain React Hooks</Badge>
                                    <Badge style={{ cursor: 'pointer', padding: 'var(--space-sm) var(--space-md)' }} onClick={() => handleQuickAction('debug')}>Debug Help</Badge>
                                    <Badge style={{ cursor: 'pointer', padding: 'var(--space-sm) var(--space-md)' }} onClick={() => handleQuickAction('best-practices')}>Best Practices</Badge>
                                    <Badge style={{ cursor: 'pointer', padding: 'var(--space-sm) var(--space-md)' }} onClick={() => handleQuickAction('interview')}>Interview Prep</Badge>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: '80%',
                                                padding: 'var(--space-md)',
                                                borderRadius: 'var(--radius-lg)',
                                                background: message.role === 'user' ? 'var(--primary-500)' : message.isError ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)',
                                                color: message.role === 'user' ? 'white' : 'var(--text-main)',
                                                border: message.role === 'user' ? 'none' : '1px solid var(--border)'
                                            }}
                                        >
                                            {message.role === 'assistant' ? (
                                                <div className="markdown-content">
                                                    <ReactMarkdown>{message.content}</ReactMarkdown>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(message.content, index)}
                                                        style={{ marginTop: 'var(--space-sm)' }}
                                                    >
                                                        {copied === index ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                        <span style={{ marginLeft: '4px' }}>{copied === index ? 'Copied!' : 'Copy'}</span>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            padding: 'var(--space-md)',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            gap: 'var(--space-sm)'
                        }}
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a coding question..."
                            style={{ flex: 1 }}
                            disabled={loading}
                        />
                        <Button type="submit" disabled={loading || !input.trim()}>
                            <Send size={18} />
                        </Button>
                    </form>
                </Card>
            </div>

            <style>{`
                .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: var(--space-md); margin-bottom: var(--space-sm); }
                .markdown-content p { margin-bottom: var(--space-sm); }
                .markdown-content code { background: var(--card); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
                .markdown-content pre { background: var(--card); padding: var(--space-md); border-radius: var(--radius-md); overflow-x: auto; margin: var(--space-sm) 0; }
                .markdown-content pre code { background: none; padding: 0; }
                .markdown-content ul, .markdown-content ol { margin-left: var(--space-lg); margin-bottom: var(--space-sm); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .history-item:hover { background: var(--surface-hover/50) !important; }
                .history-item:hover .delete-icon { opacity: 1 !important; color: var(--error-500); }
            `}</style>
        </div>
    );
};

export default AIAssistant;
