import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../../components/common';
import {
    BookOpen,
    Sparkles,
    Copy,
    CheckCircle,
    Loader2,
    GraduationCap,
    FileText,
    Map,
    Target,
    Trash2
} from 'lucide-react';
import * as aiService from '../../services/aiService';
import ReactMarkdown from 'react-markdown';

const POPULAR_TOPICS = [
    'React Hooks',
    'JavaScript Promises',
    'CSS Flexbox',
    'REST APIs',
    'Git Version Control',
    'SQL Databases',
    'Node.js',
    'TypeScript',
    'Python Basics',
    'Data Structures',
    'Algorithms',
    'Web Security'
];

const SKILL_LEVELS = [
    { value: 'beginner', label: 'Beginner', description: 'Just starting out' },
    { value: 'intermediate', label: 'Intermediate', description: 'Know the basics' },
    { value: 'advanced', label: 'Advanced', description: 'Looking to master' }
];

const StudyTools = () => {
    const [topic, setTopic] = useState('');
    const [level, setLevel] = useState('beginner');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('notes'); // 'notes' or 'path'

    // History state
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);



    useEffect(() => {
        const loadInitData = async () => {
            // Load History
            await loadHistory();
        };
        loadInitData();
    }, []);

    const loadHistory = async () => {
        setHistoryLoading(true);
        const data = await aiService.getHistory('study_tools');
        setHistory(data || []);
        setHistoryLoading(false);
    };

    const loadStudyItem = (item) => {
        if (item.content) {
            setActiveTab(item.content.type || 'notes');
            setTopic(item.content.topic || '');
            setLevel(item.content.level || 'beginner');
            setResult(item.content.result || null);
        }
    };

    const deleteStudyItem = async (e, id) => {
        e.stopPropagation();
        if (confirm('Delete this study item?')) {
            await aiService.deleteHistoryItem(id);
            loadHistory();
        }
    };

    const handleGenerate = async () => {
        if (!topic.trim()) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an AI provider (Gemini, OpenAI, etc.) in Settings > AI Settings.');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const content = activeTab === 'notes'
                ? await aiService.generateStudyNotes(topic)
                : await aiService.generateLearningPath(topic, level);
            setResult(content);

            // Save to history
            const title = `${activeTab === 'notes' ? 'Notes' : 'Path'}: ${topic}`;
            await aiService.saveHistory('study_tools', {
                type: activeTab,
                topic,
                level,
                result: content
            }, title);
            loadHistory();

        } catch (error) {
            setResult(`**Error:** ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const clearInput = () => {
        setTopic('');
        setResult(null);
    };

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>

            {/* History Sidebar */}
            <Card style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={clearInput} style={{ width: '100%' }}>
                        <BookOpen size={16} />
                        <span style={{ marginLeft: '8px' }}>New Study Session</span>
                    </Button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No past sessions
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {history.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => loadStudyItem(item)}
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
                                        onClick={(e) => deleteStudyItem(e, item.id)}
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
                            <GraduationCap className="text-primary" />
                            AI Study Tools
                        </h2>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Generate study notes and personalized learning paths
                        </p>
                    </div>
                </div>

                {/* Tab Selection */}
                <div className="flex gap-sm mb-lg">
                    <button
                        onClick={() => { setActiveTab('notes'); setResult(null); }}
                        className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                    >
                        <FileText size={18} style={{ marginRight: '8px' }} />
                        Study Notes
                    </button>
                    <button
                        onClick={() => { setActiveTab('path'); setResult(null); }}
                        className={`btn ${activeTab === 'path' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                    >
                        <Map size={18} style={{ marginRight: '8px' }} />
                        Learning Path
                    </button>
                </div>

                <div className="grid grid-cols-2" style={{ gap: 'var(--space-lg)', minHeight: '600px' }}>
                    {/* Input Section */}
                    <Card>
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>
                            {activeTab === 'notes' ? 'Generate Study Notes' : 'Create Learning Path'}
                        </h3>

                        <Input
                            label={activeTab === 'notes' ? 'Topic' : 'Skill to Learn'}
                            placeholder={activeTab === 'notes'
                                ? 'e.g., React useEffect Hook'
                                : 'e.g., Full Stack Development'}
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />

                        {activeTab === 'path' && (
                            <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="input-label">Your Current Level</label>
                                <div className="flex gap-sm">
                                    {SKILL_LEVELS.map(l => (
                                        <button
                                            key={l.value}
                                            onClick={() => setLevel(l.value)}
                                            className={`btn ${level === l.value ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ flex: 1, flexDirection: 'column', padding: 'var(--space-md)' }}
                                        >
                                            <span style={{ fontWeight: 600 }}>{l.label}</span>
                                            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>{l.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Topics */}
                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <label className="input-label">Popular Topics</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                {POPULAR_TOPICS.map(t => (
                                    <Badge
                                        key={t}
                                        style={{
                                            cursor: 'pointer',
                                            padding: 'var(--space-xs) var(--space-sm)',
                                            background: topic === t ? 'var(--primary-500)' : undefined,
                                            color: topic === t ? 'white' : undefined
                                        }}
                                        onClick={() => setTopic(t)}
                                    >
                                        {t}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={!topic.trim() || loading}
                            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span style={{ marginLeft: '8px' }}>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    <span style={{ marginLeft: '8px' }}>
                                        Generate {activeTab === 'notes' ? 'Notes' : 'Path'}
                                    </span>
                                </>
                            )}
                        </Button>
                    </Card>

                    {/* Results Section */}
                    <Card style={{ maxHeight: '600px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-center mb-md">
                            <h3 style={{ margin: 0 }}>
                                {activeTab === 'notes' ? 'Study Notes' : 'Learning Path'}
                            </h3>
                            {result && (
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

                        {!result && !loading && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                <BookOpen size={48} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                                <p>
                                    {activeTab === 'notes'
                                        ? 'Enter a topic to generate comprehensive study notes.'
                                        : 'Enter a skill to create a personalized learning roadmap.'}
                                </p>
                            </div>
                        )}

                        {loading && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-500)' }} />
                                <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)' }}>
                                    AI is preparing your {activeTab === 'notes' ? 'study notes' : 'learning path'}...
                                </p>
                            </div>
                        )}

                        {result && (
                            <div className="markdown-content">
                                <ReactMarkdown>{result}</ReactMarkdown>
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

export default StudyTools;
