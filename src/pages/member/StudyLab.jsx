import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, LoadingSpinner } from '../../components/common';
import { 
    BookOpen, Send, Printer, Maximize2, Minimize2, 
    ChevronLeft, Share2, Sparkles, FileText, 
    Download, Info, Settings, MessageSquare,
    Eye, EyeOff, ExternalLink, Globe, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateChat } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';

const StudyLab = () => {
    const { id: materialId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [material, setMaterial] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [viewMode, setViewMode] = useState('split'); // split, doc, chat
    const chatEndRef = useRef(null);
    const printRef = useRef(null);

    useEffect(() => {
        if (materialId) {
            fetchMaterial();
        } else {
            setLoading(false);
        }
    }, [materialId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (messages.length > 1) {
            saveChatHistory(messages);
        }
    }, [messages]);

    const fetchMaterial = async () => {
        setLoading(true);
        try {
            // Use maybeSingle to avoid errors if not found in one table
            const [noteRes, kbRes] = await Promise.all([
                supabase.from('study_notes').select('*').eq('id', materialId).maybeSingle(),
                supabase.from('knowledge_base').select('*').eq('id', materialId).maybeSingle()
            ]);

            const foundMaterial = noteRes.data || kbRes.data;
            if (foundMaterial) {
                setMaterial(foundMaterial);
                // Load existing chat history from ai_history
                const { data: historyData } = await supabase
                    .from('ai_history')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('tool', 'study_lab')
                    .eq('title', materialId)
                    .maybeSingle();

                if (historyData?.content?.messages) {
                    setMessages(historyData.content.messages);
                } else {
                    setMessages([
                        { 
                            role: 'assistant', 
                            content: `Welcome to the Lab! I have loaded "${foundMaterial.title}". I've indexed all the content and am ready to help you understand it, summarize sections, or even print specific pages. What would you like to explore?` 
                        }
                    ]);
                }
            }
        } catch (err) {
            console.error('Error fetching material:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveChatHistory = async (newMessages) => {
        try {
            await supabase.from('ai_history').upsert({
                user_id: user.id,
                tool: 'study_lab',
                title: materialId,
                content: { messages: newMessages },
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id,tool,title' });
        } catch (err) {
            console.error('Error saving chat history:', err);
        }
    };

    const handleCommand = (text) => {
        const printMatch = text.toLowerCase().match(/print (page|all)\s*(\d+)?/);
        if (printMatch) {
            const type = printMatch[1];
            const pageNum = printMatch[2];
            handlePrint(type, pageNum);
            return true;
        }
        return false;
    };

    const handlePrint = (type, pageNum) => {
        const printWindow = window.open('', '_blank');
        const content = material?.content || 'No content available';
        
        // Basic page splitting by double newline or custom marker
        const pages = content.split(/\n\s*\n/); 
        let printContent = '';

        if (type === 'all') {
            printContent = pages.join('<div style="page-break-after: always;"></div>');
        } else if (pageNum && pages[pageNum - 1]) {
            printContent = pages[pageNum - 1];
        } else {
            printContent = content;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Zenith Lab - ${material?.title}</title>
                    <style>
                        body { font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
                        h1 { color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                        pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
                        .footer { margin-top: 50px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <h1>${material?.title}</h1>
                    <div class="content">${printContent}</div>
                    <div class="footer">Generated by Zenith Study Lab - ${new Date().toLocaleDateString()}</div>
                    <script>window.onload = () => { window.print(); window.close(); };</script>
                </body>
            </html>
        `);
        printWindow.document.close();

        setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: `🖨️ Preparation complete. Sent ${type === 'all' ? 'the full document' : `page ${pageNum}`} to the printer.` }]);
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!input.trim() || sending) return;

        const userMsg = input.trim();
        setInput('');
        
        // 1. Check for local commands (like print)
        if (handleCommand(userMsg)) {
            return;
        }

        // 2. Otherwise use AI
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setSending(true);

        try {
            const systemPrompt = `You are the Zenith Lab Assistant, a specialized AI tutor integrated into the Study Lab.
            
            You are currently assisting the student with the following resource:
            TITLE: ${material?.title}
            SOURCE: ${material?.file_url || 'Local Document'}
            ${material?.content && material.content !== 'Attached Material' ? `RAW CONTENT: ${material.content}` : 'Note: The student is viewing this via an integrated viewer. Please provide assistance based on the title and any context provided in the conversation.'}
            
            Your role:
            1. Act as a deep-subject expert for the material provided.
            2. Even if raw text is limited, you should use your extensive internal knowledge to explain concepts related to "${material?.title}".
            3. Help the student summarize, understand, and master the topics in this resource.
            4. Do NOT say you don't have access to the content. Instead, say "I see you're working on ${material?.title}, how can I help you understand this specific topic?"
            5. If you identify specific commands (like printing), acknowledge them gracefully.
            
            Maintain a premium, academic, and encouraging tone at all times.`;

            const response = await generateChat([...messages, { role: 'user', content: userMsg }], systemPrompt);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error processing your request. Please try again." }]);
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
            <LoadingSpinner size="lg" color="var(--primary-500)" />
        </div>
    );

    if (!materialId) {
        return (
            <div style={{ padding: 'var(--space-xl)', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Study <span style={{ color: 'var(--primary-500)' }}>Lab</span></h1>
                    <p style={{ color: 'var(--text-muted)' }}>Select a material to begin your AI-powered deep dive.</p>
                </div>
                <Button onClick={() => navigate('/study-materials')} variant="primary">
                    <BookOpen size={20} style={{ marginRight: '8px' }} /> Browse Materials
                </Button>
            </div>
        );
    }

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            background: 'var(--bg-dark)',
            color: 'white',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <header style={{ 
                height: '64px', 
                padding: '0 var(--space-lg)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'rgba(20, 20, 25, 0.8)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <button 
                        onClick={() => navigate(-1)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0 }}>{material?.title}</h2>
                        <span style={{ fontSize: '10px', color: 'var(--primary-400)' }}>Study Lab Active</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <Button size="sm" variant="outline" onClick={() => handlePrint('all')} style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Printer size={16} />
                    </Button>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: '4px', display: 'flex', gap: '2px' }}>
                        <button onClick={() => setViewMode('doc')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'doc' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer' }}><FileText size={16} /></button>
                        <button onClick={() => setViewMode('split')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'split' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer' }}><Maximize2 size={16} /></button>
                        <button onClick={() => setViewMode('chat')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'chat' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer' }}><MessageSquare size={16} /></button>
                    </div>
                </div>
            </header>

            <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Left: Document Viewer (Media Player Style) */}
                {(viewMode === 'split' || viewMode === 'doc') && (
                    <div style={{ 
                        flex: viewMode === 'doc' ? 1 : 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        background: '#0f0f12'
                    }}>
                        <div style={{ 
                            flex: 1, 
                            padding: 'var(--space-xl)', 
                            overflowY: 'auto',
                            display: 'flex',
                            justifyContent: 'center'
                        }}>
                            <div style={{ 
                                width: '100%',
                                maxWidth: '1000px',
                                background: '#1a1a20',
                                borderRadius: 'var(--radius-xl)',
                                padding: 'var(--space-md)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                height: 'calc(100vh - 180px)',
                                overflow: 'hidden'
                            }}>
                                {/* Mini Browser Toolbar */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 16px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    marginBottom: '12px',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }}></div>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }}></div>
                                    </div>
                                    <div style={{ 
                                        flex: 1, 
                                        background: 'rgba(255,255,255,0.05)', 
                                        padding: '4px 12px', 
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        color: 'rgba(255,255,255,0.5)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <Globe size={12} />
                                        {material?.file_url || 'Local Document'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => {
                                                const currentUrl = material?.file_url;
                                                setMaterial(prev => ({ ...prev, file_url: '' }));
                                                setTimeout(() => setMaterial(prev => ({ ...prev, file_url: currentUrl })), 50);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }}
                                            title="Refresh"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                        <a 
                                            href={material?.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
                                            title="Open in New Tab"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>

                                <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
                                    {material?.file_url ? (
                                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                            {material.file_url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ? (
                                                <img 
                                                    src={material.file_url} 
                                                    alt="Attached Material" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} 
                                                />
                                            ) : (
                                                <iframe 
                                                    key={material.file_url} // Force reload on URL change
                                                    src={(() => {
                                                        const url = material.file_url;
                                                        if (!url) return '';
                                                        
                                                        if (url.includes('drive.google.com') && url.includes('/folders/')) {
                                                            const folderId = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1];
                                                            if (folderId) {
                                                                return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
                                                            }
                                                        }
                                                        
                                                        if (url.includes('drive.google.com')) {
                                                            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
                                                        }
                                                        
                                                        if (url.includes('docs.google.com')) {
                                                            if (!url.includes('embedded=true')) {
                                                                const separator = url.includes('?') ? '&' : '?';
                                                                return `${url}${separator}embedded=true`;
                                                            }
                                                            return url;
                                                        }

                                                        if (url.toLowerCase().endsWith('.pdf')) {
                                                            return url;
                                                        }

                                                        if (url.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i)) {
                                                            return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
                                                        }

                                                        return url;
                                                    })()} 
                                                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-md)', background: 'white' }}
                                                    title="Resource Viewer"
                                                    allow="autoplay; encrypted-media"
                                                    sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="lab-content" style={{ color: '#d1d1d1', lineHeight: 1.8, fontSize: 'var(--text-base)', padding: 'var(--space-md)' }}>
                                            {material?.content === 'Attached Material' ? (
                                                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                                                    <Info size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                                    <p>This material doesn't have text content to display, and no file was found.</p>
                                                </div>
                                            ) : (
                                                <ReactMarkdown>{material?.content}</ReactMarkdown>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right: AI Assistant */}
                {(viewMode === 'split' || viewMode === 'chat') && (
                    <div style={{ 
                        width: viewMode === 'chat' ? '100%' : '450px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: 'rgba(20, 20, 25, 0.4)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        {/* Chat History */}
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: 'var(--space-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-lg)'
                        }}>
                            {messages.map((msg, i) => (
                                <div key={i} style={{ 
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '90%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}>
                                    <div style={{ 
                                        padding: '16px', 
                                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                        background: msg.role === 'user' ? 'var(--primary-600)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        fontSize: 'var(--text-sm)',
                                        lineHeight: 1.6,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textAlign: msg.role === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        {msg.role === 'assistant' && <Sparkles size={10} style={{ color: 'var(--primary-400)' }} />}
                                        {msg.role === 'user' ? 'Student' : 'Lab Assistant'}
                                    </span>
                                </div>
                            ))}
                            {sending && (
                                <div style={{ alignSelf: 'flex-start', padding: '12px', display: 'flex', gap: '8px' }}>
                                    <div className="typing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', opacity: 0.6 }}></div>
                                    <div className="typing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', opacity: 0.6, animationDelay: '0.2s' }}></div>
                                    <div className="typing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-500)', opacity: 0.6, animationDelay: '0.4s' }}></div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ padding: 'var(--space-lg)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <form onSubmit={handleSendMessage} style={{ position: 'relative' }}>
                                <textarea 
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask anything about this material..."
                                    style={{ 
                                        width: '100%', 
                                        padding: '16px 56px 16px 16px', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 'var(--radius-lg)',
                                        color: 'white',
                                        fontSize: 'var(--text-sm)',
                                        resize: 'none',
                                        minHeight: '60px',
                                        maxHeight: '150px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || sending}
                                    style={{ 
                                        position: 'absolute', 
                                        right: '12px', 
                                        bottom: '12px', 
                                        width: '36px', 
                                        height: '36px', 
                                        borderRadius: 'var(--radius-md)', 
                                        background: 'var(--primary-500)', 
                                        border: 'none', 
                                        color: 'white', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        cursor: 'pointer',
                                        opacity: (!input.trim() || sending) ? 0.5 : 1,
                                        transition: 'transform 0.2s'
                                    }}
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center' }}>
                                Try: "Summarize this page", "What is the main concept?", or "Print page 1"
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                .lab-content h1, .lab-content h2, .lab-content h3 { color: white; margin-top: var(--space-lg); }
                .lab-content p { margin-bottom: var(--space-md); }
                .lab-content code { background: rgba(255,255,255,0.1); padding: 2px 4px; borderRadius: 4px; }
                .lab-content pre { background: rgba(0,0,0,0.3); padding: var(--space-md); borderRadius: var(--radius-md); overflow-x: auto; }
                
                @keyframes typing {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .typing-dot { animation: typing 1s infinite ease-in-out; }
            `}</style>
        </div>
    );
};

export default StudyLab;
