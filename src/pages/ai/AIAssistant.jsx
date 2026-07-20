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
    Loader2,
    Paperclip,
    Globe,
    X,
    Download
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

    // New RAG / Active study lab doc states
    const [attachedFileName, setAttachedFileName] = useState('');
    const [useActiveStudyLabDoc, setUseActiveStudyLabDoc] = useState(false);
    const [activeStudyLabDoc, setActiveStudyLabDoc] = useState(null);

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

        // Load active study lab doc from localStorage
        const storedDoc = localStorage.getItem('active_study_lab_material');
        if (storedDoc) {
            try {
                const parsed = JSON.parse(storedDoc);
                setActiveStudyLabDoc(parsed);
                setUseActiveStudyLabDoc(true); // Automatically link it
            } catch (err) {
                console.error("Failed to parse active study lab material:", err);
            }
        }
    }, []);

    // Sync context when study lab document selection or file attachment changes
    useEffect(() => {
        if (useActiveStudyLabDoc && activeStudyLabDoc?.content) {
            setContext(activeStudyLabDoc.content);
            setAttachedFileName('');
        } else if (!attachedFileName) {
            setContext('');
        }
    }, [useActiveStudyLabDoc, activeStudyLabDoc, attachedFileName]);

    const parsePDF = async (file) => {
        if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Page ${i} ---\n` + pageText + '\n\n';
        }
        return fullText;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            let contentText = '';
            if (file.name.toLowerCase().endsWith('.pdf')) {
                contentText = await parsePDF(file);
            } else {
                contentText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.onerror = (err) => reject(err);
                    reader.readAsText(file);
                });
            }

            if (!contentText.trim()) {
                throw new Error("No readable text content found in document.");
            }

            setContext(contentText);
            setAttachedFileName(file.name);
            setUseActiveStudyLabDoc(false); // upload overrides active doc
        } catch (err) {
            console.error('File upload failed:', err);
            alert('File processing error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

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
        <div className="animate-fade-in flex-mobile-col ai-container-mobile" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>

            {/* History Sidebar */}
            <Card className="ai-sidebar-mobile" style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
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
                <div className="flex flex-mobile-col justify-between items-center mb-md">
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Brain className="text-primary" />
                            AI Coding Assistant
                        </h2>
                    </div>
                    <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap' }}>
                        {/* File Upload Selector */}
                        <label 
                            htmlFor="ai-upload-file-selector"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                            title="Upload PDF, TXT, or MD context file"
                        >
                            <Paperclip size={14} /> Upload File
                        </label>
                        <input 
                            type="file" 
                            id="ai-upload-file-selector" 
                            accept=".pdf,.txt,.md" 
                            style={{ display: 'none' }} 
                            onChange={handleFileUpload} 
                        />

                        {/* Active Study Note Link Indicator */}
                        {activeStudyLabDoc && (
                            <button
                                onClick={() => {
                                    setUseActiveStudyLabDoc(!useActiveStudyLabDoc);
                                    if (!useActiveStudyLabDoc) {
                                        setAttachedFileName('');
                                    }
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: useActiveStudyLabDoc ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                    color: useActiveStudyLabDoc ? 'var(--primary-400)' : 'rgba(255,255,255,0.6)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: useActiveStudyLabDoc ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                title="Sync context with active Study Lab document"
                            >
                                <Globe size={14} /> {useActiveStudyLabDoc ? 'Active Doc Linked' : 'Link Active Doc'}
                            </button>
                        )}

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowContext(!showContext)}
                        >
                            {showContext ? 'Hide' : 'Add'} Context
                        </Button>
                    </div>
                </div>

                {/* Context Attachment Info Bar */}
                {(attachedFileName || (useActiveStudyLabDoc && activeStudyLabDoc)) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        marginBottom: 'var(--space-md)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--primary-400)', fontWeight: 600 }}>
                            <span style={{ fontSize: '16px' }}>🧠</span>
                            <span>
                                {attachedFileName ? `Context File: "${attachedFileName}" (${Math.round(context.length / 102.4) / 10} KB)` : `Linked Study Lab Doc: "${activeStudyLabDoc?.title}"`}
                            </span>
                        </div>
                        <button 
                            onClick={() => {
                                setAttachedFileName('');
                                setUseActiveStudyLabDoc(false);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

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


        </div>
    );
};

export default AIAssistant;
