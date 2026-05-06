
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Input, Modal } from '../../components/common';
import { 
    BookOpen, 
    Plus, 
    Trash2, 
    Search, 
    Tag, 
    Info, 
    Brain,
    Database,
    Clock,
    FileText,
    Sparkles
} from 'lucide-react';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/constants';

const KnowledgeBase = () => {
    const { user } = useAuth();
    const [knowledge, setKnowledge] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSnippet, setNewSnippet] = useState({
        title: '',
        content: '',
        tags: '',
        subject: '',
        classroom_id: ''
    });
    const [classrooms, setClassrooms] = useState([]);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [data, classes] = await Promise.all([
                db.getKnowledgeBase(),
                db.getClassrooms()
            ]);
            setKnowledge(data);
            setClassrooms(classes);
            
            // Set default classroom if available
            if (classes.length > 0) {
                setNewSnippet(prev => ({ ...prev, classroom_id: classes[0].id }));
            }
        } catch (error) {
            console.error('Error loading knowledge base:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAddSnippet = async (e) => {
        e.preventDefault();
        if (!newSnippet.title || !newSnippet.content) return;

        setSaving(true);
        try {
            const tagsArray = newSnippet.tags.split(',').map(t => t.trim()).filter(t => t !== '');
            await db.addKnowledgeSnippet({
                ...newSnippet,
                tags: tagsArray
            });
            setShowAddModal(false);
            setNewSnippet({ title: '', content: '', tags: '', classroom_id: classrooms[0]?.id || '' });
            loadData();
        } catch (error) {
            console.error('Error adding snippet:', error);
            alert('Failed to add knowledge. Ensure the database table exists.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSnippet = async (id) => {
        if (!window.confirm('Are you sure you want to delete this knowledge snippet?')) return;
        
        try {
            await db.deleteKnowledgeSnippet(id);
            loadData();
        } catch (error) {
            console.error('Error deleting snippet:', error);
        }
    };

    const filteredKnowledge = knowledge.filter(k => 
        k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="animate-fade-in">
            <div className="flex flex-mobile-col justify-between items-center mb-lg">
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BookOpen className="text-primary-400" />
                        Learning Resource Center
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Educational materials and "Ground Truth" context for AI calibration.
                    </p>
                </div>
                {user?.role === 'admin' && (
                    <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
                        Add Material
                    </Button>
                )}
            </div>

            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <div className="flex items-center gap-md">
                    <Search className="text-muted" size={20} />
                    <Input 
                        placeholder="Search knowledge by title, content or tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', padding: 0 }}
                    />
                </div>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center p-xl">
                    <div className="loading-spinner" />
                </div>
            ) : filteredKnowledge.length === 0 ? (
                <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--space-xl)', 
                    background: 'var(--card)', 
                    borderRadius: 'var(--radius-lg)',
                    border: '2px dashed var(--border)'
                }}>
                    <Brain size={48} className="text-muted mb-md" />
                    <h3>No Knowledge Found</h3>
                    <p className="text-muted mb-lg">
                        Add textbook definitions, course rules, or fact sheets to help the AI grade better.
                    </p>
                    <Button variant="outline" onClick={() => setShowAddModal(true)}>
                        Create First Snippet
                    </Button>
                </div>
            ) : (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                    gap: 'var(--space-md)' 
                }}>
                    {filteredKnowledge.map(item => (
                        <Card key={item.id} className="h-full flex flex-col" style={{ position: 'relative', overflow: 'hidden', cursor: 'default' }}>
                            <div className="flex justify-between items-start mb-md">
                                <div style={{ minWidth: 0 }}>
                                    <Badge variant="accent" size="xs" style={{ marginBottom: '4px' }}>
                                        {item.subject || 'General'}
                                    </Badge>
                                    <h4 style={{ margin: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                                </div>
                                {user?.role === 'admin' && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(item.id); }}
                                        style={{ color: 'var(--error-500)', flexShrink: 0, position: 'relative', zIndex: 10 }}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                )}
                            </div>
                            
                            <p style={{ 
                                fontSize: 'var(--text-sm)', 
                                color: 'var(--text-muted)',
                                flex: 1,
                                marginBottom: 'var(--space-md)',
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {item.content}
                            </p>

                            <div className="flex flex-wrap gap-xs mb-md">
                                {item.tags?.map((tag, i) => (
                                    <Badge key={i} variant="outline" size="xs">
                                        #{tag}
                                    </Badge>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-md" style={{ borderTop: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-xs">
                                    <Layout size={12} className="text-muted" />
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {classrooms.find(c => c.id === item.classroom_id)?.name || 'Global'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-xs">
                                    <Clock size={12} className="text-muted" />
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {formatDate(item.created_at)}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* AI RAG INFO BOX */}
            <div style={{ 
                marginTop: 'var(--space-xl)', 
                padding: 'var(--space-lg)', 
                background: 'rgba(99, 102, 241, 0.05)', 
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                display: 'flex',
                gap: 'var(--space-md)',
                alignItems: 'flex-start'
            }}>
                <div style={{ 
                    padding: '12px', 
                    background: 'var(--primary-500)', 
                    borderRadius: 'var(--radius-md)',
                    color: 'white'
                }}>
                    <Sparkles size={24} />
                </div>
                <div>
                    <h4 style={{ margin: '0 0 8px' }}>How AI Knowledge (RAG) Works</h4>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        When an AI evaluates a quiz, it automatically searches this Knowledge Base for keywords matching the quiz title and questions. 
                        It injects the matching snippets as <strong>Ground Truth</strong> into its thinking process. 
                        This prevents AI hallucinations and ensures it grades based on <em>your</em> definitions, not general internet data.
                    </p>
                </div>
            </div>

            {/* Add Snippet Modal */}
            <Modal 
                isOpen={showAddModal} 
                onClose={() => setShowAddModal(false)}
                title="Add Ground Truth Knowledge"
            >
                <form onSubmit={handleAddSnippet} className="flex flex-col gap-md">
                    <div>
                        <label className="label">Classroom Context</label>
                        <select 
                            className="input"
                            value={newSnippet.classroom_id}
                            onChange={(e) => setNewSnippet({ ...newSnippet, classroom_id: e.target.value })}
                            required
                        >
                            <option value="">Select Classroom</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="label">Resource Title</label>
                        <Input 
                            placeholder="e.g. Frenkel vs Schottky Defect Rules"
                            value={newSnippet.title}
                            onChange={(e) => setNewSnippet({ ...newSnippet, title: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Subject / Category</label>
                        <Input 
                            placeholder="e.g. Physics, Chemistry, React JS"
                            value={newSnippet.subject}
                            onChange={(e) => setNewSnippet({ ...newSnippet, subject: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Content / Definition</label>
                        <textarea 
                            className="input"
                            style={{ minHeight: '150px' }}
                            placeholder="Paste the textbook definition or factual rules here..."
                            value={newSnippet.content}
                            onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Keywords / Tags (Comma separated)</label>
                        <Input 
                            placeholder="e.g. chemistry, defects, physics"
                            value={newSnippet.tags}
                            onChange={(e) => setNewSnippet({ ...newSnippet, tags: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" loading={saving}>Add to AI Brain</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default KnowledgeBase;
