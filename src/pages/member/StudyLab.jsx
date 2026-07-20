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
    const [viewMode, setViewMode] = useState(window.innerWidth < 1024 ? 'doc' : 'split'); // 'split', 'doc', 'chat'
    const [mockDeviceMode, setMockDeviceMode] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncText, setSyncText] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [urlInput, setUrlInput] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const chatEndRef = useRef(null);
    const printRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (material?.file_url && urlInput === '') {
            setUrlInput(material.file_url);
        }
    }, [material?.file_url]);

    useEffect(() => {
        if (materialId) {
            fetchMaterial();
        }
    }, [materialId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (messages.length > 1) {
            saveChatHistory(messages);
        }
    }, [messages]);

    const performRAGSearch = (documentText, query, chunkSize = 800, overlap = 200) => {
        if (!documentText) return "";
        const chunks = [];
        let start = 0;
        while (start < documentText.length) {
            const end = Math.min(start + chunkSize, documentText.length);
            chunks.push(documentText.slice(start, end));
            start += chunkSize - overlap;
        }
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        if (keywords.length === 0) {
            return chunks.slice(0, 3).join("\n\n---\n\n");
        }
        const scoredChunks = chunks.map(chunk => {
            let score = 0;
            const chunkLower = chunk.toLowerCase();
            keywords.forEach(kw => {
                const count = (chunkLower.match(new RegExp(kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
                score += count;
            });
            return { chunk, score };
        });
        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.filter(c => c.score > 0).slice(0, 3);
        if (topChunks.length === 0) {
            return chunks.slice(0, 3).join("\n\n---\n\n");
        }
        return topChunks.map(tc => tc.chunk).join("\n\n---\n\n");
    };

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

            // If we are currently viewing a document, we can overwrite its content,
            // otherwise create a brand new document!
            if (materialId && material) {
                const table = material?.course_id ? 'knowledge_base' : 'study_notes';
                const { error } = await supabase
                    .from(table)
                    .update({ content: contentText })
                    .eq('id', materialId);
                if (error) throw error;
                setMaterial(prev => ({ ...prev, content: contentText }));
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: `🧠 **RAG Brain Sync Complete.** I have successfully parsed and indexed "${file.name}" for semantic context retrieval.` }
                ]);
            } else {
                const title = file.name.replace(/\.[^/.]+$/, ""); // strip extension
                const { data, error } = await supabase
                    .from('study_notes')
                    .insert([{
                        title,
                        content: contentText,
                        user_id: user.id,
                        file_url: ""
                    }])
                    .select();

                if (error) throw error;
                navigate(`/study-lab/${data[0].id}`);
            }
        } catch (err) {
            console.error('File upload failed:', err);
            alert('File processing error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

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
                    setUrlInput(foundMaterial.file_url);
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
                            content: `Zenith Lab Assistant Online. **Note: I cannot see the document viewer directly.** To help you accurately, please copy and paste the specific sections you're studying into our chat. How can I help you today?` 
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
            handlePrint(type, pageNum, text);
            return true;
        }
        return false;
    };

    const handlePrint = (type, pageNum, originalText = '') => {
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

        const messageContent = originalText || `Print ${type === 'all' ? 'all pages' : `page ${pageNum}`}`;
        setMessages(prev => [...prev, { role: 'user', content: messageContent }, { role: 'assistant', content: `🖨️ Preparation complete. Sent ${type === 'all' ? 'the full document' : `page ${pageNum}`} to the printer.` }]);
    };

    const handleSendMessage = async (e, systemMessage = null) => {
        e?.preventDefault();
        
        const userMsg = systemMessage || input.trim();
        if (!userMsg || sending) return;

        if (!systemMessage) {
            setInput('');
        }
        
        // 1. Check for local commands (like print)
        if (handleCommand(userMsg)) {
            return;
        }

        // 2. Otherwise use AI
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setSending(true);

        try {
            // Filter history to remove old apologies
            const cleanHistory = messages.filter(m => !m.content.toLowerCase().includes("don't have access") && !m.content.toLowerCase().includes("sync ai"));

            // Perform local semantic chunk match
            const retrievedContext = performRAGSearch(material?.content || '', userMsg);

            const systemPrompt = `You are the Zenith Lab Assistant.
            
            ROLE: CS Professor & Advanced RAG Agent.
            
            RETRIEVED DOCUMENT CONTEXT (RAG):
            ${retrievedContext || 'No context indexed yet. The user has not uploaded or synced document text.'}
            
            MATERIAL METADATA:
            TITLE: ${material?.title}
            
            STRICT DIRECTIVES:
            - Answer the student's questions using the provided RETRIEVED DOCUMENT CONTEXT.
            - Synthesize context-aware responses with technical precision.
            - If the context doesn't contain the answer, tell the user politely and answer using your general computer science knowledge.
            - Maintain a professional CS Professor persona.`;

            const response = await generateChat([...cleanHistory, { role: 'user', content: userMsg }], systemPrompt);
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
            <div style={{ padding: 'var(--space-2xl)', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Study <span style={{ color: 'var(--primary-500)' }}>Lab</span></h1>
                    <p style={{ color: 'var(--text-muted)' }}>Advanced AI Retrieval-Augmented Generation (RAG) Playground</p>
                </div>
                
                <Card style={{ padding: 'var(--space-xl)', background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.05) 100%)', border: '1px dashed var(--primary-500)', textAlign: 'center' }}>
                    <CloudLightning size={48} className="text-primary-500 mb-md" style={{ margin: '0 auto 12px auto' }} />
                    <h3>Start RAG Session by Uploading</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: '450px', margin: '8px auto 20px' }}>
                        Upload any PDF, TXT, or MD study file. Zenith AI will parse, chunk, and index it locally for instant context-aware question answering.
                    </p>
                    <label 
                        htmlFor="dashboard-rag-upload" 
                        style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '8px', 
                            padding: '12px 24px', background: 'var(--primary-500)', color: 'white', 
                            borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer',
                            boxShadow: 'var(--shadow-lg)', transition: 'all 0.2s'
                        }}
                    >
                        <Download size={18} /> Upload Document
                    </label>
                    <input 
                        type="file" 
                        id="dashboard-rag-upload" 
                        accept=".pdf,.txt,.md" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleFileUpload(e)}
                    />
                </Card>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Button onClick={() => navigate('/study-materials')} variant="outline">
                        <BookOpen size={20} style={{ marginRight: '8px' }} /> Browse Existing Materials
                    </Button>
                </div>
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
                height: isMobile ? 'auto' : '64px', 
                padding: isMobile ? 'var(--space-sm) var(--space-md)' : '0 var(--space-lg)', 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center', 
                justifyContent: 'space-between',
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(15px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                gap: isMobile ? 'var(--space-sm)' : '0',
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <button 
                        onClick={() => navigate(-1)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: isMobile ? '32px' : '36px', height: isMobile ? '32px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
                    >
                        <ChevronLeft size={isMobile ? 18 : 20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: isMobile ? 'var(--text-xs)' : 'var(--text-sm)', fontWeight: 700, margin: 0 }}>
                            {isMobile ? (material?.title?.length > 25 ? material.title.substring(0, 22) + '...' : material?.title) : material?.title}
                        </h2>
                        <span style={{ fontSize: '9px', color: 'var(--primary-400)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Lab Mode</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                    <Button size="sm" variant="outline" onClick={() => handlePrint('all')} style={{ borderColor: 'rgba(255,255,255,0.1)', padding: isMobile ? '6px' : undefined }}>
                        <Printer size={16} />
                    </Button>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: '4px', display: 'flex', gap: '2px' }}>
                        <button onClick={() => setViewMode('doc')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'doc' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileText size={16} /> {isMobile && <span style={{ fontSize: '10px', fontWeight: 600 }}>Doc</span>}
                        </button>
                        {!isMobile && (
                            <button onClick={() => setViewMode('split')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'split' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer' }}><Maximize2 size={16} /></button>
                        )}
                        <button onClick={() => setViewMode('chat')} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: viewMode === 'chat' ? 'var(--primary-500)' : 'transparent', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageSquare size={16} /> {isMobile && <span style={{ fontSize: '10px', fontWeight: 600 }}>Chat</span>}
                        </button>
                    </div>
                </div>
            </header>

            <main style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                overflow: isMobile ? 'auto' : 'hidden' 
            }}>
                {/* Left: Document Viewer */}
                {(viewMode === 'split' || viewMode === 'doc') && (
                    <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        borderBottom: isMobile ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        background: '#0f0f12',
                        height: isMobile && viewMode === 'split' ? '55vh' : '100%',
                        minHeight: isMobile && viewMode === 'split' ? '400px' : 'auto'
                    }}>
                        <div style={{ 
                            flex: 1, 
                            padding: isMobile ? 'var(--space-xs)' : 'var(--space-md)', 
                            overflowY: 'auto',
                            display: 'flex',
                            justifyContent: 'center'
                        }}>
                                <div style={{ 
                                    width: '100%',
                                    maxWidth: viewMode === 'doc' ? '1200px' : 'none',
                                    background: '#1a1a20',
                                    borderRadius: isMobile ? 'var(--radius-md)' : 'var(--radius-xl)',
                                    padding: isMobile ? '4px' : 'var(--space-sm)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    overflow: 'hidden'
                                }}>
                                    {/* Mock Browser Window Bar */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        background: 'rgba(25, 25, 35, 0.8)',
                                        borderBottom: '1.5px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px 12px 0 0',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Window Dots */}
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                                            </div>
                                            
                                            {/* Browser Navigation */}
                                            <div style={{ display: 'flex', gap: '2px', marginLeft: '12px' }}>
                                                <button 
                                                    onClick={() => {
                                                        if (historyIndex > 0) {
                                                            const newIndex = historyIndex - 1;
                                                            setHistoryIndex(newIndex);
                                                            const prevUrl = history[newIndex];
                                                            setUrlInput(prevUrl);
                                                            setMaterial(prev => ({ ...prev, file_url: prevUrl }));
                                                        }
                                                    }}
                                                    disabled={historyIndex <= 0}
                                                    style={{ background: 'none', border: 'none', color: historyIndex > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)', cursor: historyIndex > 0 ? 'pointer' : 'default', padding: '4px' }}
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (historyIndex < history.length - 1) {
                                                            const newIndex = historyIndex + 1;
                                                            setHistoryIndex(newIndex);
                                                            const nextUrl = history[newIndex];
                                                            setUrlInput(nextUrl);
                                                            setMaterial(prev => ({ ...prev, file_url: nextUrl }));
                                                        }
                                                    }}
                                                    disabled={historyIndex >= history.length - 1}
                                                    style={{ background: 'none', border: 'none', color: historyIndex < history.length - 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)', cursor: historyIndex < history.length - 1 ? 'pointer' : 'default', padding: '4px' }}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* URL Bar */}
                                        <div style={{ 
                                            flex: 1, 
                                            background: 'rgba(0,0,0,0.4)', 
                                            padding: '6px 14px', 
                                            borderRadius: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            minWidth: '200px'
                                        }}>
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }} title="Secure SSL connection">🔒</span>
                                            <input 
                                                type="text"
                                                value={urlInput}
                                                onChange={(e) => setUrlInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.target.value;
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
                                                    fontSize: '11px', 
                                                    width: '100%',
                                                    outline: 'none',
                                                    fontWeight: '500'
                                                }}
                                                placeholder="Enter URL or paste website link..."
                                            />
                                        </div>

                                        {/* Actions Toolbar */}
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {/* RAG File Upload Trigger */}
                                            <label 
                                                htmlFor="lab-file-upload-input" 
                                                style={{ 
                                                    background: 'rgba(99, 102, 241, 0.1)', 
                                                    color: 'var(--primary-400)', 
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    borderRadius: '8px',
                                                    padding: '6px 12px',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Upload PDF/TXT/MD for AI RAG Search"
                                            >
                                                <Download size={12} /> RAG Upload
                                            </label>
                                            <input 
                                                type="file" 
                                                id="lab-file-upload-input" 
                                                accept=".pdf,.txt,.md" 
                                                style={{ display: 'none' }} 
                                                onChange={handleFileUpload} 
                                            />

                                            {/* Mock Mobile View Toggle */}
                                            <button 
                                                onClick={() => setMockDeviceMode(!mockDeviceMode)}
                                                style={{ 
                                                    background: mockDeviceMode ? 'var(--primary-500)' : 'rgba(255,255,255,0.05)', 
                                                    border: '1px solid rgba(255,255,255,0.1)', 
                                                    borderRadius: '8px', 
                                                    color: 'white', 
                                                    padding: '6px 10px',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer'
                                                }}
                                                title="Toggle Mobile Simulator Shell"
                                            >
                                                <Globe size={12} /> Mobile Shell
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    const currentUrl = material?.file_url;
                                                    setMaterial(prev => ({ ...prev, file_url: '' }));
                                                    setTimeout(() => setMaterial(prev => ({ ...prev, file_url: currentUrl })), 50);
                                                }}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '6px', cursor: 'pointer' }}
                                                title="Refresh View"
                                            >
                                                <RefreshCw size={12} />
                                            </button>

                                            <a 
                                                href={material?.file_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '6px', display: 'flex', alignItems: 'center' }}
                                                title="Open in Full Browser"
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>

                                    <div style={{ 
                                        flex: 1, 
                                        position: 'relative', 
                                        overflowY: 'auto',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        background: mockDeviceMode ? '#1e1e26' : 'transparent',
                                        padding: mockDeviceMode ? '20px' : 0,
                                        transition: 'background 0.3s ease'
                                    }}>
                                        <div style={mockDeviceMode ? {
                                            width: '320px',
                                            height: '568px',
                                            borderRadius: '24px',
                                            border: '10px solid #2d2d3d',
                                            background: '#000',
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        } : { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            
                                            {/* Simulated Phone Status Bar */}
                                            {mockDeviceMode && (
                                                <div style={{
                                                    height: '20px',
                                                    background: '#2d2d3d',
                                                    color: 'rgba(255,255,255,0.7)',
                                                    fontSize: '9px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0 12px',
                                                    fontFamily: 'system-ui',
                                                    fontWeight: 600
                                                }}>
                                                    <span>9:41 AM</span>
                                                    <span style={{ display: 'flex', gap: '4px' }}>
                                                        <span>📶</span>
                                                        <span>🛜</span>
                                                        <span>🔋 100%</span>
                                                    </span>
                                                </div>
                                            )}

                                            {/* Resource Viewer Content */}
                                            {material?.file_url ? (
                                                <div style={{ width: '100%', height: '100%', position: 'relative', flex: 1 }}>
                                                    {material.file_url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ? (
                                                        <img 
                                                            src={material.file_url} 
                                                            alt="Attached Material" 
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                                        />
                                                    ) : (
                                                        <iframe 
                                                            key={material.file_url} // Force reload on URL change
                                                            src={(() => {
                                                                const url = material.file_url;
                                                                if (!url) return '';
                                                                
                                                                if (url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id=')) && !url.includes('/folders/')) {
                                                                    const fileId = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
                                                                    if (fileId && !url.includes('folders')) {
                                                                        return `https://drive.google.com/file/d/${fileId}/preview`;
                                                                    }
                                                                }
                                                                
                                                                if (url.includes('drive.google.com') && url.includes('folders')) {
                                                                    const folderId = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
                                                                    if (folderId) {
                                                                        return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
                                                                    }
                                                                }

                                                                if (url.includes('drive.google.com')) {
                                                                    if (url.includes('/view') || url.includes('/edit')) {
                                                                        return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
                                                                    }
                                                                    return url;
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
                                                            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                                                            title="Resource Viewer"
                                                            allow="autoplay; encrypted-media; clipboard-read; clipboard-write; camera; microphone"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="lab-content" style={{ color: '#d1d1d1', lineHeight: 1.8, fontSize: 'var(--text-base)', padding: 'var(--space-md)', flex: 1, overflowY: 'auto' }}>
                                                    {material?.content && material.content !== 'Attached Material' ? (
                                                        <ReactMarkdown>{material.content}</ReactMarkdown>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                                                            <Info size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                                            <p style={{ fontSize: 'var(--text-sm)' }}>Load a URL or upload a file to begin your study session. AI will automatically index the content.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
                        width: isMobile || viewMode === 'chat' ? '100%' : '450px', 
                        flex: isMobile && viewMode === 'split' ? 1 : (isMobile || viewMode === 'chat' ? 'none' : 1),
                        height: isMobile && viewMode === 'split' ? 'auto' : '100%',
                        minHeight: isMobile && viewMode === 'split' ? '500px' : 'auto',
                        display: 'flex', 
                        flexDirection: 'column',
                        background: 'rgba(20, 20, 25, 0.4)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        {/* Chat History */}
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: isMobile ? 'var(--space-md)' : 'var(--space-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? 'var(--space-md)' : 'var(--space-lg)'
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
                                        padding: isMobile ? '12px 14px' : '16px', 
                                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                        background: msg.role === 'user' ? 'var(--primary-600)' : 'rgba(255,255,255,0.08)',
                                        color: 'white',
                                        fontSize: isMobile ? '13px' : '14px',
                                        fontWeight: '500',
                                        lineHeight: 1.5,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'anywhere'
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
                        <div style={{ padding: isMobile ? 'var(--space-md)' : 'var(--space-lg)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
