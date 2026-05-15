import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, LoadingSpinner } from '../../components/common';
import { 
    BookOpen, Send, Printer, Maximize2, Minimize2, 
    ChevronLeft, ChevronRight, Share2, Sparkles, FileText, 
    Download, Info, Settings, MessageSquare,
    Eye, EyeOff, ExternalLink, Globe, RefreshCw,
    Brain, CloudLightning
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
    const [viewMode, setViewMode] = useState('split'); // 'split', 'doc', 'chat'
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncText, setSyncText] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [urlInput, setUrlInput] = useState('');
    const chatEndRef = useRef(null);
    const printRef = useRef(null);

    useEffect(() => {
        if (materialId) {
            fetchMaterial();
        }
    }, [materialId]);

    useEffect(() => {
        if (material?.file_url) {
            setUrlInput(material.file_url);
        }
    }, [material?.file_url]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (messages.length > 1) {
            saveChatHistory(messages);
        }
    }, [messages]);

    const fetchMaterial = async () => {
        setLoading(true);
        try {
            // Check both tables
            const [noteRes, kbRes] = await Promise.all([
                supabase.from('study_notes').select('*').eq('id', materialId).maybeSingle(),
                supabase.from('knowledge_base').select('*').eq('id', materialId).maybeSingle()
            ]);

            const foundMaterial = noteRes.data || kbRes.data;
            if (foundMaterial) {
                setMaterial(foundMaterial);
                if (foundMaterial.file_url) {
                    setHistory([foundMaterial.file_url]);
                    setHistoryIndex(0);
                }
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
                            content: `Zenith Lab Assistant Online. I have indexed "${foundMaterial.title}" and am ready to act as your deep-subject expert. How can I help you understand this topic today?` 
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

    const syncContext = async () => {
        if (!syncText.trim()) return;
        
        try {
            // Update the source material in DB so AI has it forever
            const table = material?.course_id ? 'knowledge_base' : 'study_notes';
            const { error } = await supabase
                .from(table)
                .update({ content: syncText })
                .eq('id', materialId);

            if (error) throw error;

            setMaterial(prev => ({ ...prev, content: syncText }));
            setShowSyncModal(false);
            setSyncText('');
            setMessages(prev => [...prev, { role: 'assistant', content: "🧠 **Knowledge Sync Complete.** I have successfully indexed the document text and saved it to my long-term memory. I am now fully ready to assist you with this specific content." }]);
        } catch (err) {
            console.error('Error syncing context:', err);
            alert('Failed to sync context. Please try again.');
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
            let contextMessage = userMsg;
            let isScanning = false;

            if (userMsg?.includes("[SYSTEM_ACTION: SCAN_DOCUMENT]")) {
                isScanning = true;
                contextMessage = "I have requested a deep scan of the current document. Please acknowledge the content index and let me know you're ready to answer questions based on it.";
            }

            // Filter history to remove any old "I don't have access" apologies that might confuse the model
            const cleanHistory = messages.filter(m => !m.content.toLowerCase().includes("don't have access") && !m.content.toLowerCase().includes("sync ai"));

            const systemPrompt = `You are the Zenith Lab Assistant, a specialized AI tutor with DEEP access to the current material.
            
            MATERIAL CONTEXT:
            TITLE: ${material?.title}
            SOURCE: ${material?.file_url}
            ${material?.content && material.content !== 'Attached Material' ? `FULL CONTENT INDEX: ${material.content}` : 'Note: The student is viewing a complex document. Use your internal expertise on this topic to act as a primary tutor.'}
            
            ${isScanning ? 'IMPORTANT: The student has just clicked "Read for AI". You MUST perform a thorough analysis of the FULL CONTENT INDEX above. If the index contains specific questions (like 2-mark or 5-mark), acknowledge them.' : ''}

            STRICT DIRECTIVES:
            1. NEVER say "I don't have access" or "I can't see the document." You HAVE the index.
            2. If asked to list questions or sections (e.g., "list all 2m questions"), extract them accurately from the CONTENT INDEX provided above.
            3. Act as a subject-matter expert. If the material is about Computer Science, you are a CS Professor.
            4. If the CONTENT INDEX is sparse, use your expert knowledge to fill in the gaps based on the TITLE provided, while staying aligned with the student's context.
            5. Your responses must be structured, professional, and academic.`;

            const response = await generateChat([...cleanHistory, { role: 'user', content: contextMessage }], systemPrompt);
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
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '8px' }}>
                                            <button 
                                                onClick={() => {
                                                    if (historyIndex > 0) {
                                                        const newIndex = historyIndex - 1;
                                                        setHistoryIndex(newIndex);
                                                        setMaterial(prev => ({ ...prev, file_url: history[newIndex] }));
                                                    }
                                                }}
                                                disabled={historyIndex <= 0}
                                                style={{ background: 'none', border: 'none', color: historyIndex > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)', cursor: historyIndex > 0 ? 'pointer' : 'default', padding: '4px' }}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (historyIndex < history.length - 1) {
                                                        const newIndex = historyIndex + 1;
                                                        setHistoryIndex(newIndex);
                                                        setMaterial(prev => ({ ...prev, file_url: history[newIndex] }));
                                                    }
                                                }}
                                                disabled={historyIndex >= history.length - 1}
                                                style={{ background: 'none', border: 'none', color: historyIndex < history.length - 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)', cursor: historyIndex < history.length - 1 ? 'pointer' : 'default', padding: '4px' }}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                        <div style={{ 
                                            flex: 1, 
                                            background: 'rgba(255,255,255,0.1)', 
                                            padding: '4px 12px', 
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <Globe size={14} className="text-primary" />
                                            <input 
                                                type="text"
                                                value={urlInput}
                                                onChange={(e) => setUrlInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.target.value;
                                                        // Update history
                                                        const newHistory = history.slice(0, historyIndex + 1);
                                                        newHistory.push(url);
                                                        setHistory(newHistory);
                                                        setHistoryIndex(newHistory.length - 1);
                                                        setMaterial(prev => ({ ...prev, file_url: url }));
                                                    }
                                                }}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: 'white', 
                                                    fontSize: '12px', 
                                                    width: '100%',
                                                    outline: 'none',
                                                    fontWeight: '500'
                                                }}
                                                placeholder="Paste a link to study (Drive, PDF, Doc...)"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            {sending ? (
                                                <Badge variant="outline" style={{ background: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa', border: '1px solid rgba(124, 58, 237, 0.3)', gap: '6px' }}>
                                                    <Brain size={12} className="animate-pulse" /> AI Indexing...
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)', gap: '6px' }}>
                                                    <Sparkles size={12} /> AI Synced
                                                </Badge>
                                            )}
                                            
                                            <button 
                                                onClick={() => {
                                                    const currentUrl = material?.file_url;
                                                    setMaterial(prev => ({ ...prev, file_url: '' }));
                                                    setTimeout(() => setMaterial(prev => ({ ...prev, file_url: currentUrl })), 50);
                                                }}
                                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }}
                                                title="Refresh View"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                            
                                            <Button 
                                                size="sm" 
                                                variant="primary" 
                                                onClick={() => handleSendMessage(null, `[SYSTEM_ACTION: SCAN_DOCUMENT] URL: ${material?.file_url}`)}
                                                disabled={sending || !material?.file_url}
                                                style={{ 
                                                    padding: '4px 12px', 
                                                    fontSize: '10px', 
                                                    height: '28px',
                                                    background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
                                                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                                    gap: '6px'
                                                }}
                                            >
                                                <Sparkles size={12} /> Read for AI
                                            </Button>

                                            <a 
                                                href={material?.file_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
                                                title="Open in Full Browser"
                                            >
                                                <ExternalLink size={16} />
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
                                                                    // REVERT: Use the most stable embedded view to avoid 403 errors
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

                                                            if (url.toLowerCase().endsWith('.pdf') || url.includes('/public/study_materials/')) {
                                                                return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
                                                            }

                                                            if (url.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i)) {
                                                                return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
                                                            }

                                                            return url;
                                                        })()} 
                                                        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-md)', background: 'white' }}
                                                        title="Resource Viewer"
                                                        allow="autoplay; encrypted-media; clipboard-read; clipboard-write; camera; microphone"
                                                        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-top-navigation"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="lab-content" style={{ color: '#d1d1d1', lineHeight: 1.8, fontSize: 'var(--text-base)', padding: 'var(--space-md)' }}>
                                                {material?.content && material.content !== 'Attached Material' ? (
                                                    <ReactMarkdown>{material.content}</ReactMarkdown>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                                                        <Info size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                                        <p>Load a URL to begin your deep-study session. AI will automatically index the content.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                        </div>
                    </div>
                )}

                    {/* Sync Context Modal */}
                    {showSyncModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: 'var(--space-md)'
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '600px',
                                background: '#1a1a20',
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: 'var(--space-xl)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-md)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Brain className="text-primary" size={20} />
                                        AI Deep Scan & Sync
                                    </h3>
                                    <button onClick={() => setShowSyncModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><Maximize2 size={16} /></button>
                                </div>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                                    Because Google Drive and private storage protect content, the AI cannot "see" inside the document automatically. 
                                    **Paste the text from the document below** to sync it with the AI's deep memory.
                                </p>
                                <textarea 
                                    value={syncText}
                                    onChange={(e) => setSyncText(e.target.value)}
                                    placeholder="Paste document content here..."
                                    style={{
                                        width: '100%',
                                        height: '300px',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-md)',
                                        color: 'white',
                                        fontSize: '13px',
                                        fontFamily: 'monospace',
                                        resize: 'none',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <Button variant="outline" onClick={() => setShowSyncModal(false)}>Cancel</Button>
                                    <Button 
                                        disabled={!syncText.trim()} 
                                        onClick={syncContext}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <CloudLightning size={16} /> Sync Brain
                                    </Button>
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
