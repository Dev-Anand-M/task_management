
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Input, Modal } from '../../components/common';
import { 
    BookOpen, 
    Plus, 
    Trash2, 
    Edit2,
    Search, 
    Tag, 
    Info, 
    Brain,
    Database,
    Clock,
    FileText,
    Sparkles,
    Layout,
    Link as LinkIcon,
    Upload,
    File,
    ExternalLink,
    Download
} from 'lucide-react';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../utils/constants';

const KnowledgeBase = () => {
    const { user } = useAuth();
    const [knowledge, setKnowledge] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
        const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [newSnippet, setNewSnippet] = useState({
        title: '',
        content: '',
        tags: '',
        subject: '',
        classroom_id: '',
        material_type: 'file', // 'file', 'link', 'text'
        file: null,
        url: ''
    });
    const [editSnippet, setEditSnippet] = useState({
        id: '',
        title: '',
        content: '',
        tags: '',
        subject: '',
        classroom_id: '',
        material_type: 'file',
        file: null,
        file_url: '',
        url: ''
    });
    const [classrooms, setClassrooms] = useState([]);
    const [saving, setSaving] = useState(false);
    const [previewAsStudent, setPreviewAsStudent] = useState(false);
    const [previewClassroomId, setPreviewClassroomId] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // Safety timeout to prevent infinite loading
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.warn('KnowledgeBase load taking too long, forcing loading to false');
                    setLoading(false);
                }
            }, 8000);
            const [data, classes] = await Promise.all([
                db.getKnowledgeBase(user?.role === 'member' ? user.classroom_id : null),
                db.getClassrooms()
            ]);
            setKnowledge(data);
            setClassrooms(classes);
            
            // Set default classroom if available
            if (classes.length > 0) {
                setNewSnippet(prev => ({ ...prev, classroom_id: classes[0].id }));
                setPreviewClassroomId(prev => prev || classes[0].id);
            }
        } catch (error) {
            console.error('Error loading knowledge base:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.role, user?.classroom_id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAddSnippet = async (e) => {
        e.preventDefault();
        if (!newSnippet.title) return;
        if (newSnippet.material_type === 'text' && !newSnippet.content) return;
        if (newSnippet.material_type === 'link' && !newSnippet.url) return;
        if (newSnippet.material_type === 'file' && !newSnippet.file) return;

        setSaving(true);
        try {
            let file_url = newSnippet.url;
            if (newSnippet.material_type === 'file' && newSnippet.file) {
                file_url = await db.uploadStudyMaterial(newSnippet.file);
            }

            const tagsArray = newSnippet.tags.split(',').map(t => t.trim()).filter(t => t !== '');
            const material = await db.addKnowledgeSnippet({
                title: newSnippet.title,
                content: newSnippet.content || 'Attached Material',
                subject: newSnippet.subject,
                classroom_id: newSnippet.classroom_id,
                tags: tagsArray,
                material_type: newSnippet.material_type,
                file_url: file_url
            });

            // --- NOTIFY STUDENTS IN CLASSROOM (BATCH) ---
            try {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('classroom_id', newSnippet.classroom_id)
                    .eq('role', 'member');

                if (profiles && profiles.length > 0) {
                    const userIds = profiles.map(p => p.id).filter(Boolean);

                    if (userIds.length > 0) {
                        const { data: { session } } = await supabase.auth.getSession();
                        await fetch(`${window.location.origin}/api/push`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session?.access_token}`
                            },
                            body: JSON.stringify({
                                user_ids: userIds,
                                title: 'New Learning Resource! 📚',
                                body: `"${newSnippet.title}" has been shared in ${newSnippet.subject || 'your classroom'}.`,
                                url: '/knowledge-base'
                            })
                        });
                    }
                }
            } catch (notifyErr) {
                console.error('Failed to send notifications:', notifyErr);
            }

            setShowAddModal(false);
            setNewSnippet({ title: '', content: '', tags: '', subject: '', classroom_id: classrooms[0]?.id || '', material_type: 'file', file: null, url: '' });
            loadData();
        } catch (error) {
            console.error('Error adding snippet:', error);
            alert('Failed to add knowledge. Ensure the database table exists.');
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (item) => {
        setEditSnippet({
            id: item.id,
            title: item.title || '',
            content: item.content || '',
            tags: item.tags ? item.tags.join(', ') : '',
            subject: item.subject || '',
            classroom_id: item.classroom_id || '',
            material_type: item.material_type || 'file',
            file: null,
            file_url: item.file_url || '',
            url: item.material_type === 'link' ? item.file_url : ''
        });
        setShowEditModal(true);
    };

    const handleEditSnippet = async (e) => {
        e.preventDefault();
        if (!editSnippet.title) return;
        if (editSnippet.material_type === 'text' && !editSnippet.content) return;
        if (editSnippet.material_type === 'link' && !editSnippet.url) return;

        setSaving(true);
        try {
            let file_url = editSnippet.file_url;
            if (editSnippet.material_type === 'file' && editSnippet.file) {
                file_url = await db.uploadStudyMaterial(editSnippet.file);
            } else if (editSnippet.material_type === 'link') {
                file_url = editSnippet.url;
            } else if (editSnippet.material_type === 'text') {
                file_url = '';
            }

            const tagsArray = editSnippet.tags.split(',').map(t => t.trim()).filter(t => t !== '');
            await db.updateKnowledgeSnippet(editSnippet.id, {
                title: editSnippet.title,
                content: editSnippet.content || 'Attached Material',
                subject: editSnippet.subject,
                classroom_id: editSnippet.classroom_id || null,
                tags: tagsArray,
                material_type: editSnippet.material_type,
                file_url: file_url
            });

            setShowEditModal(false);
            loadData();
        } catch (error) {
            console.error('Error updating snippet:', error);
            alert('Failed to update knowledge snippet.');
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

    const displaySnippets = previewAsStudent
        ? knowledge.filter(k => k.classroom_id === null || k.classroom_id === undefined || k.classroom_id === '' || k.classroom_id === previewClassroomId)
        : knowledge;

    const filteredKnowledge = displaySnippets.filter(k => 
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
                        Share study resources, reference materials, and documents with your team members.
                    </p>
                </div>
                {user?.role === 'admin' && !previewAsStudent && (
                    <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
                        Add Material
                    </Button>
                )}
            </div>

            {user?.role === 'admin' && (
                <Card style={{ 
                    marginBottom: 'var(--space-md)', 
                    padding: 'var(--space-md)', 
                    border: previewAsStudent ? '1px solid var(--primary-500)' : '1px solid var(--border)',
                    background: previewAsStudent ? 'var(--primary-50)' : 'var(--card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-md)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge variant={previewAsStudent ? "primary" : "secondary"}>Admin Mode</Badge>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>
                            Student View Preview (Error Checking)
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', cursor: 'pointer', userSelect: 'none', color: 'var(--text)' }}>
                            <input 
                                type="checkbox" 
                                checked={previewAsStudent}
                                onChange={(e) => setPreviewAsStudent(e.target.checked)}
                            />
                            Preview as Student
                        </label>
                        {previewAsStudent && (
                            <select
                                className="input"
                                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', width: 'auto', minWidth: '150px', height: '32px' }}
                                value={previewClassroomId}
                                onChange={(e) => setPreviewClassroomId(e.target.value)}
                            >
                                <option value="">No Classroom (Unassigned)</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </Card>
            )}

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
                    <h3>No Materials Shared</h3>
                    <p className="text-muted mb-lg">
                        Upload files, share links, or post textbook notes with your members.
                    </p>
                    <Button variant="outline" onClick={() => setShowAddModal(true)}>
                        Share First Material
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
                                {user?.role === 'admin' && !previewAsStudent && (
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative', zIndex: 10 }}>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                            style={{ color: 'var(--primary-500)' }}
                                            title="Edit resource"
                                        >
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(item.id); }}
                                            style={{ color: 'var(--error-500)' }}
                                            title="Delete resource"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                {item.material_type === 'file' && <File size={16} className="text-primary-500" />}
                                {item.material_type === 'link' && <LinkIcon size={16} className="text-primary-500" />}
                                {item.material_type === 'text' && <FileText size={16} className="text-primary-500" />}
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
                                {item.content !== 'Attached Material' ? item.content : 'View attached resource.'}
                            </p>

                            {item.file_url && (
                                <div style={{ marginBottom: 'var(--space-md)' }}>
                                    <a 
                                        href={item.file_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            padding: '8px 16px', 
                                            background: 'var(--primary-50)', 
                                            color: 'var(--primary-600)', 
                                            borderRadius: 'var(--radius-md)',
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            fontSize: 'var(--text-sm)'
                                        }}
                                        className="hover:bg-primary-100 transition-colors"
                                    >
                                        {item.material_type === 'file' ? <><Download size={14} /> Download File</> : <><ExternalLink size={14} /> Open Link</>}
                                    </a>
                                </div>
                            )}

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



            {/* Add Snippet Modal */}
            <Modal 
                isOpen={showAddModal} 
                onClose={() => setShowAddModal(false)}
                title="Add Shared Material"
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

                    {/* Material Type Selector */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <button type="button" onClick={() => setNewSnippet({ ...newSnippet, material_type: 'file' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: newSnippet.material_type === 'file' ? 'var(--primary-500)' : 'transparent', color: newSnippet.material_type === 'file' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Upload size={16} /> File
                        </button>
                        <button type="button" onClick={() => setNewSnippet({ ...newSnippet, material_type: 'link' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: newSnippet.material_type === 'link' ? 'var(--primary-500)' : 'transparent', color: newSnippet.material_type === 'link' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <LinkIcon size={16} /> Link
                        </button>
                        <button type="button" onClick={() => setNewSnippet({ ...newSnippet, material_type: 'text' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: newSnippet.material_type === 'text' ? 'var(--primary-500)' : 'transparent', color: newSnippet.material_type === 'text' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FileText size={16} /> Text
                        </button>
                    </div>

                    <div>
                        <label className="label">Resource Title</label>
                        <Input 
                            placeholder="e.g. Physics Formula Sheet"
                            value={newSnippet.title}
                            onChange={(e) => setNewSnippet({ ...newSnippet, title: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Subject / Category</label>
                        <Input 
                            list="subject-suggestions"
                            placeholder="e.g. Physics, Chemistry"
                            value={newSnippet.subject}
                            onChange={(e) => setNewSnippet({ ...newSnippet, subject: e.target.value })}
                            required
                        />
                        <datalist id="subject-suggestions">
                            {[...new Set(knowledge.map(k => k.subject))].filter(Boolean).map(cat => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </div>

                    {newSnippet.material_type === 'file' && (
                        <div>
                            <label className="label">Upload File (PDF, Image, Doc)</label>
                            <input 
                                type="file" 
                                className="input" 
                                style={{ padding: '8px' }}
                                onChange={(e) => setNewSnippet({ ...newSnippet, file: e.target.files[0] })}
                                required
                            />
                        </div>
                    )}

                    {newSnippet.material_type === 'link' && (
                        <div>
                            <label className="label">Resource Link (URL)</label>
                            <Input 
                                type="url"
                                placeholder="https://..."
                                value={newSnippet.url}
                                onChange={(e) => setNewSnippet({ ...newSnippet, url: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {(newSnippet.material_type === 'text' || newSnippet.material_type !== 'file') && (
                        <div>
                            <label className="label">{newSnippet.material_type === 'text' ? 'Content / Notes' : 'Description (Optional)'}</label>
                            <textarea 
                                className="input"
                                style={{ minHeight: '100px' }}
                                placeholder={newSnippet.material_type === 'text' ? "Write your notes here..." : "Add a short description..."}
                                value={newSnippet.content}
                                onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
                                required={newSnippet.material_type === 'text'}
                            />
                        </div>
                    )}

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
                        <Button variant="primary" type="submit" loading={saving}>Share Material</Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Snippet Modal */}
            <Modal 
                isOpen={showEditModal} 
                onClose={() => setShowEditModal(false)}
                title="Edit Shared Material"
            >
                <form onSubmit={handleEditSnippet} className="flex flex-col gap-md">
                    <div>
                        <label className="label">Classroom Context</label>
                        <select 
                            className="input"
                            value={editSnippet.classroom_id}
                            onChange={(e) => setEditSnippet({ ...editSnippet, classroom_id: e.target.value })}
                        >
                            <option value="">Global / All Classrooms</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Material Type Selector */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <button type="button" onClick={() => setEditSnippet({ ...editSnippet, material_type: 'file' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: editSnippet.material_type === 'file' ? 'var(--primary-500)' : 'transparent', color: editSnippet.material_type === 'file' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Upload size={16} /> File
                        </button>
                        <button type="button" onClick={() => setEditSnippet({ ...editSnippet, material_type: 'link' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: editSnippet.material_type === 'link' ? 'var(--primary-500)' : 'transparent', color: editSnippet.material_type === 'link' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <LinkIcon size={16} /> Link
                        </button>
                        <button type="button" onClick={() => setEditSnippet({ ...editSnippet, material_type: 'text' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: editSnippet.material_type === 'text' ? 'var(--primary-500)' : 'transparent', color: editSnippet.material_type === 'text' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FileText size={16} /> Text
                        </button>
                    </div>

                    <div>
                        <label className="label">Resource Title</label>
                        <Input 
                            placeholder="e.g. Physics Formula Sheet"
                            value={editSnippet.title}
                            onChange={(e) => setEditSnippet({ ...editSnippet, title: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Subject / Category</label>
                        <Input 
                            list="edit-subject-suggestions"
                            placeholder="e.g. Physics, Chemistry"
                            value={editSnippet.subject}
                            onChange={(e) => setEditSnippet({ ...editSnippet, subject: e.target.value })}
                            required
                        />
                        <datalist id="edit-subject-suggestions">
                            {[...new Set(knowledge.map(k => k.subject))].filter(Boolean).map(cat => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </div>

                    {editSnippet.material_type === 'file' && (
                        <div>
                            <label className="label">Upload New File (Optional, leave blank to keep current)</label>
                            <input 
                                type="file" 
                                className="input" 
                                style={{ padding: '8px' }}
                                onChange={(e) => setEditSnippet({ ...editSnippet, file: e.target.files[0] })}
                            />
                            {editSnippet.file_url && (
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                                    Current File: <a href={editSnippet.file_url} target="_blank" rel="noopener noreferrer">{editSnippet.file_url.split('/').pop()}</a>
                                </p>
                            )}
                        </div>
                    )}

                    {editSnippet.material_type === 'link' && (
                        <div>
                            <label className="label">Resource Link (URL)</label>
                            <Input 
                                type="url"
                                placeholder="https://..."
                                value={editSnippet.url}
                                onChange={(e) => setEditSnippet({ ...editSnippet, url: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {(editSnippet.material_type === 'text' || editSnippet.material_type !== 'file') && (
                        <div>
                            <label className="label">{editSnippet.material_type === 'text' ? 'Content / Notes' : 'Description (Optional)'}</label>
                            <textarea 
                                className="input"
                                style={{ minHeight: '100px' }}
                                placeholder={editSnippet.material_type === 'text' ? "Write your notes here..." : "Add a short description..."}
                                value={editSnippet.content}
                                onChange={(e) => setEditSnippet({ ...editSnippet, content: e.target.value })}
                                required={editSnippet.material_type === 'text'}
                            />
                        </div>
                    )}

                    <div>
                        <label className="label">Keywords / Tags (Comma separated)</label>
                        <Input 
                            placeholder="e.g. chemistry, defects, physics"
                            value={editSnippet.tags}
                            onChange={(e) => setEditSnippet({ ...editSnippet, tags: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" loading={saving}>Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default KnowledgeBase;
