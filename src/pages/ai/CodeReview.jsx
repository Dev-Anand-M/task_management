import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../../components/common';
import {
    Code,
    Play,
    Copy,
    CheckCircle,
    Loader2,
    FileCode,
    AlertTriangle,
    Lightbulb,
    Shield,
    ThumbsUp,
    Trash2
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import ReactMarkdown from 'react-markdown';

const LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'cpp', label: 'C++' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'sql', label: 'SQL' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' }
];

const CodeReview = () => {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [review, setReview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState('review'); // 'review' or 'explain'
    const [availableModels, setAvailableModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');

    // History state
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Load available models and history
    useEffect(() => {
        const loadInitData = async () => {
            // Get all configured models from all providers
            const allModels = aiService.AVAILABLE_MODELS;
            const configuredModels = [];

            // This is a bit of a hack: ideally we'd have a service method to get "valid" models
            // but for now, let's just show models where the provider key exists locally
            for (const model of allModels) {
                if (aiService.isAPIKeyConfigured(model.provider)) {
                    configuredModels.push(model);
                }
            }

            if (configuredModels.length > 0) {
                setAvailableModels(configuredModels);
                const savedToolModel = localStorage.getItem('ai_codereview_model');
                if (savedToolModel && configuredModels.some(m => m.id === savedToolModel)) {
                    setSelectedModel(savedToolModel);
                } else {
                    const globalModel = aiService.getSelectedModel();
                    setSelectedModel(configuredModels.some(m => m.id === globalModel) ? globalModel : configuredModels[0].id);
                }
            }

            // Load History
            await loadHistory();
        };
        loadInitData();
    }, []);

    const loadHistory = async () => {
        setHistoryLoading(true);
        const data = await aiService.getHistory('code_review');
        setHistory(data || []);
        setHistoryLoading(false);
    };

    const handleModelChange = (modelId) => {
        setSelectedModel(modelId);
        localStorage.setItem('ai_codereview_model', modelId);
    };

    const loadReviewItem = (item) => {
        if (item.content) {
            setCode(item.content.code || '');
            setLanguage(item.content.language || 'javascript');
            setMode(item.content.mode || 'review');
            setReview(item.content.review || null);
        }
    };

    const deleteReviewItem = async (e, id) => {
        e.stopPropagation();
        if (confirm('Delete this code review?')) {
            await aiService.deleteHistoryItem(id);
            loadHistory();
        }
    };

    const handleSubmit = async () => {
        if (!code.trim()) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an AI provider (Gemini, OpenAI, etc.) in Settings > AI Settings.');
            return;
        }

        setLoading(true);
        setReview(null);

        try {
            const result = mode === 'review'
                ? await aiService.reviewCode(code, language, selectedModel)
                : await aiService.explainCode(code, language, selectedModel);
            setReview(result);

            // Save to history
            const titleCode = code.substring(0, 30).replace(/\n/g, ' ') + '...';
            const title = `${mode === 'review' ? 'Review' : 'Explain'}: ${titleCode}`;
            await aiService.saveHistory('code_review', { code, language, mode, review: result }, title, selectedModel);

            loadHistory();

        } catch (error) {
            setReview(`**Error:** ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(review);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const clearInput = () => {
        setCode('');
        setReview(null);
    };

    const sampleCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 10 fibonacci numbers
for (let i = 0; i < 10; i++) {
  console.log(fibonacci(i));
}`;

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>

            {/* History Sidebar */}
            <Card style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={clearInput} style={{ width: '100%' }}>
                        <Code size={16} />
                        <span style={{ marginLeft: '8px' }}>New Review</span>
                    </Button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No past reviews
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {history.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => loadReviewItem(item)}
                                    className="history-item"
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        fontSize: 'var(--text-sm)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        color: 'var(--text-main)'
                                    }}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString()}</div>
                                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                                    </div>
                                    <Trash2
                                        size={14}
                                        className="delete-icon"
                                        style={{ opacity: 0.5 }}
                                        onClick={(e) => deleteReviewItem(e, item.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Main Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-lg">
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Code className="text-primary" />
                            AI Code Review & Explainer
                        </h2>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Get AI-powered feedback on your code or understand how it works
                        </p>
                    </div>
                    {/* Model Selector */}
                    {availableModels.length > 0 && (
                        <div style={{ minWidth: '200px' }}>
                            <select
                                value={selectedModel}
                                onChange={(e) => handleModelChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                    color: 'var(--text-main)',
                                    fontSize: 'var(--text-sm)',
                                    cursor: 'pointer'
                                }}
                            >
                                {availableModels.map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2" style={{ gap: 'var(--space-lg)', minHeight: '600px' }}>
                    {/* Input Section */}
                    <Card style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-center mb-md">
                            <h3 style={{ margin: 0 }}>Your Code</h3>
                            <div className="flex gap-sm">
                                <select
                                    className="input select"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    style={{ width: 'auto' }}
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Paste your code here..."
                            style={{
                                width: '100%',
                                flex: 1,
                                minHeight: '300px',
                                padding: 'var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-main)',
                                fontFamily: "'Fira Code', 'Consolas', monospace",
                                fontSize: 'var(--text-sm)',
                                lineHeight: 1.6,
                                resize: 'vertical'
                            }}
                        />

                        <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
                            <Button
                                onClick={() => setCode(sampleCode)}
                                variant="secondary"
                                size="sm"
                            >
                                <FileCode size={16} />
                                Load Sample
                            </Button>
                        </div>

                        {/* Mode Selection */}
                        <div style={{
                            marginTop: 'var(--space-lg)',
                            padding: 'var(--space-md)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)'
                        }}>
                            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', display: 'block' }}>
                                What would you like?
                            </label>
                            <div className="flex gap-sm">
                                <button
                                    onClick={() => setMode('review')}
                                    className={`btn ${mode === 'review' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ flex: 1 }}
                                >
                                    <AlertTriangle size={16} style={{ marginRight: '8px' }} />
                                    Review Code
                                </button>
                                <button
                                    onClick={() => setMode('explain')}
                                    className={`btn ${mode === 'explain' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ flex: 1 }}
                                >
                                    <Lightbulb size={16} style={{ marginRight: '8px' }} />
                                    Explain Code
                                </button>
                            </div>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={!code.trim() || loading}
                            style={{ width: '100%', marginTop: 'var(--space-md)' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span style={{ marginLeft: '8px' }}>Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <Play size={18} />
                                    <span style={{ marginLeft: '8px' }}>
                                        {mode === 'review' ? 'Review Code' : 'Explain Code'}
                                    </span>
                                </>
                            )}
                        </Button>
                    </Card>

                    {/* Results Section */}
                    <Card style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-center mb-md">
                            <h3 style={{ margin: 0 }}>
                                {mode === 'review' ? 'Code Review' : 'Code Explanation'}
                            </h3>
                            {review && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyToClipboard}
                                >
                                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    <span style={{ marginLeft: '4px' }}>{copied ? 'Copied!' : 'Copy'}</span>
                                </Button>
                            )}
                        </div>

                        {!review && !loading && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                <Code size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                <p>Paste your code and click "{mode === 'review' ? 'Review Code' : 'Explain Code'}" to get AI feedback.</p>
                            </div>
                        )}

                        {loading && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-500)' }} />
                                <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)' }}>
                                    AI is analyzing your code...
                                </p>
                            </div>
                        )}

                        {review && (
                            <div className="markdown-content">
                                <ReactMarkdown>{review}</ReactMarkdown>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <style>{`
                .btn { padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); font-weight: 500; transition: all var(--transition-fast); cursor: pointer; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; }
                .btn-primary { background: var(--primary-500); color: white; }
                .btn-secondary { background: var(--card); border-color: var(--border); color: var(--text-main); }
                .btn:hover { opacity: 0.9; }
                .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 { margin-top: var(--space-md); margin-bottom: var(--space-sm); color: var(--text-main); }
                .markdown-content p { margin-bottom: var(--space-sm); line-height: 1.6; }
                .markdown-content code { background: var(--card); padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.9em; }
                .markdown-content pre { background: var(--card); padding: var(--space-md); border-radius: var(--radius-md); overflow-x: auto; margin: var(--space-sm) 0; }
                .markdown-content pre code { background: none; padding: 0; }
                .markdown-content ul, .markdown-content ol { margin-left: var(--space-lg); margin-bottom: var(--space-sm); }
                .markdown-content li { margin-bottom: var(--space-xs); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .history-item:hover { background: var(--surface-hover/50) !important; }
                .history-item:hover .delete-icon { opacity: 1 !important; color: var(--error-500); }
            `}</style>
        </div>
    );
};

export default CodeReview;
