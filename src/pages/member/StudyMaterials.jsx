import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Input, Modal } from '../../components/common';
import {
    BookOpen, Plus, Trash2, Search, Edit3, Pin, PinOff,
    FolderOpen, Clock, Tag, Sparkles, Eye, ChevronDown, ChevronRight,
    BookMarked, StickyNote, Filter, X,
    File, Link as LinkIcon, FileText, Download, ExternalLink,
    Zap, Calendar, ArrowRight
} from 'lucide-react';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatRelativeTime } from '../../utils/constants';
import { supabase } from '../../lib/supabase';
import { useMiniReload } from '../../hooks/useMiniReload';

const NOTE_COLORS = [
    { name: 'Default', value: null },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Cyan', value: '#06b6d4' },
];

const StudyMaterials = () => {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { id: urlId } = useParams();
    
    // Default to sprint tab if tab=sprint in URL, otherwise sprint vault by default
    const initialTab = new URLSearchParams(window.location.search).get('tab') || 'sprint';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [sharedMaterials, setSharedMaterials] = useState([]);
    const [myNotes, setMyNotes] = useState([]);
    const [sprintTemplates, setSprintTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [viewingItem, setViewingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [selectedTag, setSelectedTag] = useState(null);
    const [expandedCategories, setExpandedCategories] = useState({});
    const [noteForm, setNoteForm] = useState({ title: '', content: '', category: 'General', color: null, material_type: 'text', file: null, url: '' });

    const [showAddSharedModal, setShowAddSharedModal] = useState(false);
    const [sharedForm, setSharedForm] = useState({ title: '', content: '', subject: 'Week 1', material_type: 'file', file: null, url: '' });

    const handleSaveSharedResource = async (e) => {
        e.preventDefault();
        if (!sharedForm.title) return;
        setSaving(true);
        try {
            let file_url = sharedForm.url;
            if (sharedForm.material_type === 'file' && sharedForm.file) {
                file_url = await db.uploadStudyMaterial(sharedForm.file);
            }
            await db.addKnowledgeSnippet({
                title: sharedForm.title,
                content: sharedForm.content || 'Attached Shared Resource',
                subject: sharedForm.subject || 'General',
                classroom_id: user?.classroom_id,
                material_type: sharedForm.material_type,
                file_url: file_url
            });
            setShowAddSharedModal(false);
            setSharedForm({ title: '', content: '', subject: 'Week 1', material_type: 'file', file: null, url: '' });
            loadData(true);
        } catch (err) {
            console.error('Save resource error:', err);
            alert('Failed to save resource: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedCategory('All');
        setSelectedTag(null);
    };

    const loadData = useCallback(async (silent = false) => {
        if (!user?.id || !user?.classroom_id) return;
        try {
            if (!silent) setLoading(true);
            const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 10000));
            const [shared, notes, sprintRes] = await Promise.race([
                Promise.all([
                    db.getKnowledgeBase(user?.classroom_id).catch(() => []),
                    db.getStudyNotes(user.id).catch(() => []),
                    supabase.from('sprint_templates').select('*').eq('classroom_id', user.classroom_id).order('week_number', { ascending: true })
                ]),
                timeout
            ]);
            setSharedMaterials(shared || []);
            setMyNotes(notes || []);
            setSprintTemplates(sprintRes?.data || []);
        } catch (e) {
            console.error('[StudyMaterials] Load error:', e);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.classroom_id]);

    useEffect(() => { loadData(); }, [loadData]);
    useMiniReload(() => loadData(true));

    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`study-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_base' }, () => loadData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'study_notes', filter: `user_id=eq.${user.id}` }, () => loadData(true))
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [user?.id, user?.classroom_id, loadData]);

    useEffect(() => {
        if (urlId && (sharedMaterials.length > 0 || myNotes.length > 0)) {
            const item = [...sharedMaterials, ...myNotes].find(i => i.id === urlId);
            if (item) {
                setViewingItem(item);
                setActiveTab(sharedMaterials.find(m => m.id === urlId) ? 'shared' : 'notes');
            }
        }
    }, [urlId, sharedMaterials, myNotes]);

    // Note CRUD
    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!noteForm.title) return;
        if (noteForm.material_type === 'text' && !noteForm.content) return;
        if (noteForm.material_type === 'link' && !noteForm.url) return;
        if (noteForm.material_type === 'file' && !noteForm.file && !editingNote?.file_url) return;

        setSaving(true);
        try {
            let file_url = noteForm.url;
            if (noteForm.material_type === 'file' && noteForm.file) {
                file_url = await db.uploadStudyMaterial(noteForm.file);
            } else if (editingNote && noteForm.material_type === editingNote.material_type && !noteForm.file) {
                file_url = noteForm.url || editingNote.file_url;
            }

            const payload = {
                title: noteForm.title,
                content: noteForm.content || 'Attached Note',
                category: noteForm.category,
                color: noteForm.color,
                material_type: noteForm.material_type,
                file_url: file_url
            };

            if (editingNote) {
                await db.updateStudyNote(editingNote.id, payload);
            } else {
                await db.addStudyNote(payload);
            }
            setShowAddModal(false);
            setEditingNote(null);
            setNoteForm({ title: '', content: '', category: 'General', color: null, material_type: 'text', file: null, url: '' });
            loadData(true);
        } catch (err) {
            console.error('Save note error:', err);
            alert('Failed to save note. Make sure the study_notes table exists in Supabase.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('Delete this note?')) return;
        try {
            await db.deleteStudyNote(id);
            loadData(true);
        } catch (err) { console.error(err); }
    };

    const handleTogglePin = async (note) => {
        try {
            await db.updateStudyNote(note.id, { is_pinned: !note.is_pinned });
            loadData(true);
        } catch (err) { console.error(err); }
    };

    const openEdit = (note) => {
        setEditingNote(note);
        setNoteForm({ title: note.title, content: note.content, category: note.category, color: note.color, material_type: note.material_type || 'text', file: null, url: note.file_url || '' });
        setShowAddModal(true);
    };

    // Filtering
    const items = activeTab === 'shared' ? sharedMaterials : myNotes;

    const allCategories = ['All', ...new Set(
        activeTab === 'shared'
            ? sharedMaterials.map(m => m.subject || 'General')
            : myNotes.map(n => n.category || 'General')
    )];

    const allTags = [...new Set(items.flatMap(item => item.tags || []))].filter(Boolean).sort();

    const filtered = items.filter(item => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            item.title?.toLowerCase().includes(q) ||
            item.content?.toLowerCase().includes(q) ||
            (item.tags || []).some(t => t.toLowerCase().includes(q));
        const cat = activeTab === 'shared' ? (item.subject || 'General') : (item.category || 'General');
        const matchesCat = selectedCategory === 'All' || cat === selectedCategory;
        const matchesTag = !selectedTag || (item.tags || []).includes(selectedTag);
        return matchesSearch && matchesCat && matchesTag;
    });

    const pinnedNotes = activeTab === 'notes' ? filtered.filter(n => n.is_pinned) : [];
    const unpinnedNotes = activeTab === 'notes' ? filtered.filter(n => !n.is_pinned) : [];

    const groupedShared = activeTab === 'shared' ? filtered.reduce((acc, item) => {
        const cat = item.subject || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {}) : {};

    const groupedUnpinnedNotes = activeTab === 'notes' ? unpinnedNotes.reduce((acc, item) => {
        const cat = item.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {}) : {};

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
    };

    // Delete Sprint Vault document
    const handleDeleteSprintDoc = async (docId, tableName) => {
        if (!window.confirm('Delete this document?')) return;
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', docId);
            if (error) throw error;
            loadData(true);
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete: ' + (err.message || err));
        }
    };

    const tabStyle = (tab) => ({
        padding: '10px 20px',
        background: activeTab === tab ? 'var(--primary-500)' : 'transparent',
        color: activeTab === tab ? 'white' : 'var(--text-muted)',
        border: activeTab === tab ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
    });

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BookMarked className="text-primary-400" />
                        Knowledge Hub
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {activeTab === 'sprint'
                            ? 'Sprint Vault & weekly learning resources'
                            : activeTab === 'shared'
                            ? 'Shared reference documents & course material'
                            : 'Your personal study notes & categorized files'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                    {activeTab === 'sprint' ? (
                        <Button 
                            variant="primary" 
                            icon={Zap} 
                            onClick={() => navigate('/sprint-tracker')}
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 700,
                                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)'
                            }}
                        >
                            ⚡ Open Sprint Tracker
                        </Button>
                    ) : (
                        <>
                            {isAdmin && (
                                <Button variant="secondary" icon={Plus} onClick={() => { setShowAddSharedModal(true); }}>
                                    + Add Shared Resource
                                </Button>
                            )}
                            <Button variant="primary" icon={Plus} onClick={() => { setEditingNote(null); setNoteForm({ title: '', content: '', category: 'General', color: null, material_type: 'text', file: null, url: '' }); setShowAddModal(true); }}>
                                New Note / Doc
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                <button onClick={() => handleTabChange('sprint')} style={tabStyle('sprint')}>
                    <Zap size={16} /> ⚡ Sprint Vault
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px', fontSize: '11px' }}>
                        {sprintTemplates.length}
                    </span>
                </button>
                <button onClick={() => handleTabChange('shared')} style={tabStyle('shared')}>
                    <BookOpen size={16} /> Shared Resources
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px', fontSize: '11px' }}>
                        {sharedMaterials.length}
                    </span>
                </button>
                <button onClick={() => handleTabChange('notes')} style={tabStyle('notes')}>
                    <StickyNote size={16} /> My Notes
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px', fontSize: '11px' }}>
                        {myNotes.length}
                    </span>
                </button>
            </div>

            {/* Search + Filter for Shared and Notes */}
            {activeTab !== 'sprint' && (
                <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                    <div className="search-container-box" style={{ flex: 1, minWidth: '220px' }}>
                        <Search className="text-muted" size={18} style={{ flexShrink: 0 }} />
                        <input
                            className="search-bar-input"
                            placeholder={activeTab === 'shared' ? 'Search shared materials...' : 'Search your notes...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {allCategories.length > 2 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                            {allCategories.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                                    padding: '4px 12px',
                                    borderRadius: 'var(--radius-full)',
                                    border: selectedCategory === cat ? '1px solid var(--primary-500)' : '1px solid var(--border)',
                                    background: selectedCategory === cat ? 'color-mix(in srgb, var(--primary-500), transparent 85%)' : 'transparent',
                                    color: selectedCategory === cat ? 'var(--primary-500)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    transition: 'all 0.2s ease'
                                }}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                    {allTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
                            <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                            {allTags.map(tag => (
                                <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} style={{
                                    padding: '2px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    border: selectedTag === tag ? '1px dashed var(--border)' : '1px dashed var(--border)',
                                    background: selectedTag === tag ? 'color-mix(in srgb, var(--primary-500), transparent 85%)' : 'transparent',
                                    color: selectedTag === tag ? 'var(--primary-500)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    transition: 'all 0.2s ease'
                                }}>
                                    #{tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center p-xl"><div className="loading-spinner" /></div>
            ) : activeTab === 'sprint' ? (
                /* Sprint Vault View */
                <div>
                    {sprintTemplates.length === 0 ? (
                        <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                            <Zap size={48} className="text-muted mb-md" />
                            <h3>No Sprint Weeks Configured Yet</h3>
                            <p className="text-muted mb-lg">
                                {isAdmin
                                    ? 'Click below to set up week titles, descriptions, dates, and resource links.'
                                    : 'Your instructor has not published the sprint template yet. Check back soon!'}
                            </p>
                            {isAdmin && (
                                <Button variant="primary" icon={Zap} onClick={() => navigate('/sprint-tracker')}>
                                    Configure Sprint Template
                                </Button>
                            )}
                        </Card>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
                            {sprintTemplates.map(st => (
                                <Card
                                    key={st.id || st.week_number}
                                    style={{
                                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                        position: 'relative', overflow: 'hidden',
                                        border: st.is_showcase ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border)',
                                        background: st.is_showcase
                                            ? 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(126,34,206,0.03))'
                                            : 'var(--card)'
                                    }}
                                >
                                    <div>
                                        <div className="flex justify-between items-center mb-xs">
                                            <Badge variant={st.is_showcase ? 'accent' : 'primary'} size="xs">
                                                {st.is_showcase ? '🃏 Showcase Week' : `📌 Week ${st.week_number}`}
                                            </Badge>
                                            {(st.start_date || st.end_date) && (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} />
                                                    {st.start_date ? new Date(st.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                    {' → '}
                                                    {st.end_date ? new Date(st.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ margin: 'var(--space-xs) 0 var(--space-sm)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                                            {st.title}
                                        </h3>

                                        {st.description && (
                                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-md)' }}>
                                                {st.description}
                                            </p>
                                        )}

                                        {/* Attached Files & Notes matching this Sprint Week */}
                                        {(() => {
                                            const weekTarget = `week ${st.week_number}`;
                                            const matchedDocs = [...sharedMaterials, ...myNotes].filter(item => {
                                                const cat = (item.subject || item.category || '').toLowerCase();
                                                return cat.includes(weekTarget) || cat === `w${st.week_number}` || (item.tags || []).some(t => t.toLowerCase().includes(weekTarget));
                                            });
                                            if (matchedDocs.length === 0) return null;
                                            return (
                                                <div style={{ marginTop: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.05em' }}>
                                                        Attached Documents & Notes ({matchedDocs.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {matchedDocs.map(doc => {
                                                            // Determine which table this doc is from
                                                            const docTable = sharedMaterials.some(m => m.id === doc.id) ? 'knowledge_base' : 'study_notes';
                                                            return (
                                                            <div
                                                                key={doc.id}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    padding: '6px 10px', borderRadius: 'var(--radius-md)',
                                                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                                                    fontSize: 'var(--text-xs)', cursor: 'pointer'
                                                                }}
                                                            >
                                                                <div 
                                                                    onClick={() => setViewingItem(doc)}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}
                                                                >
                                                                    {doc.material_type === 'file' && <File size={13} style={{ color: 'var(--primary-400)' }} />}
                                                                    {doc.material_type === 'link' && <LinkIcon size={13} style={{ color: 'var(--primary-400)' }} />}
                                                                    {doc.material_type === 'text' && <FileText size={13} style={{ color: 'var(--primary-400)' }} />}
                                                                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {doc.title}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => setViewingItem(doc)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                                                        title="View"
                                                                    >
                                                                        <Eye size={12} />
                                                                    </button>
                                                                    {(isAdmin || doc.user_id === user?.id) && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (docTable === 'study_notes') {
                                                                                        openEdit(doc);
                                                                                    } else {
                                                                                        alert('Editing shared resources coming soon!');
                                                                                    }
                                                                                }}
                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--primary-500)', display: 'flex', alignItems: 'center' }}
                                                                                title="Edit"
                                                                            >
                                                                                <Edit3 size={12} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteSprintDoc(doc.id, docTable)}
                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--error-500)', display: 'flex', alignItems: 'center' }}
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border)' }}>
                                        {isAdmin && (
                                            <button
                                                onClick={() => {
                                                    setSharedForm({ title: '', content: '', subject: `Week ${st.week_number}`, material_type: 'file', file: null, url: '' });
                                                    setShowAddSharedModal(true);
                                                }}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    padding: '6px 12px', borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6',
                                                    border: '1px dashed rgba(59, 130, 246, 0.3)', cursor: 'pointer',
                                                    fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 'var(--space-xs)'
                                                }}
                                            >
                                                <Plus size={13} /> + Add Doc to Week {st.week_number}
                                            </button>
                                        )}

                                        {st.resource_url && (
                                            <a
                                                href={st.resource_url}
                                                target={st.resource_url.startsWith('http') ? '_blank' : '_self'}
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6',
                                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                                    textDecoration: 'none', fontWeight: 600, fontSize: 'var(--text-xs)',
                                                    marginBottom: 'var(--space-sm)', transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <BookOpen size={14} />
                                                {st.resource_label || 'View Week Briefing & Materials'}
                                                <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            ) : filtered.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    {activeTab === 'shared' ? <BookOpen size={48} className="text-muted mb-md" /> : <StickyNote size={48} className="text-muted mb-md" />}
                    <h3>{activeTab === 'shared' ? 'No Shared Materials Yet' : 'No Notes Yet'}</h3>
                    <p className="text-muted mb-lg">
                        {activeTab === 'shared'
                            ? 'Your instructor hasn\'t shared any materials yet. Check back later!'
                            : 'Start building your personal study library.'}
                    </p>
                    {activeTab === 'notes' && (
                        <Button variant="primary" icon={Plus} onClick={() => { setEditingNote(null); setNoteForm({ title: '', content: '', category: 'General', color: null }); setShowAddModal(true); }}>
                            Create First Note
                        </Button>
                    )}
                </Card>
            ) : activeTab === 'shared' ? (
                /* Shared Materials Grid */
                <div>
                    {Object.entries(groupedShared).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
                        const isExpanded = expandedCategories[cat] !== false;
                        return (
                            <div key={cat} style={{ marginBottom: 'var(--space-xl)' }}>
                                <div onClick={() => toggleCategory(cat)} className="flex items-center gap-sm mb-md" style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    {isExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                                    <h3 style={{ margin: 0 }}>{cat}</h3>
                                    <Badge variant="secondary" size="xs">{items.length}</Badge>
                                </div>
                                {isExpanded && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                                        {items.map(item => (
                                            <Card key={item.id} style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setViewingItem(item)}>
                                                <div className="flex justify-between items-start mb-sm">
                                                    <Badge variant="accent" size="xs">{item.subject || 'General'}</Badge>
                                                    <div className="flex items-center gap-xs">
                                                        <Clock size={12} className="text-muted" />
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatDate(item.created_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-xs mb-sm">
                                                    {item.material_type === 'file' && <File size={16} className="text-primary-500" />}
                                                    {item.material_type === 'link' && <LinkIcon size={16} className="text-primary-500" />}
                                                    {item.material_type === 'text' && <FileText size={16} className="text-primary-500" />}
                                                    <h4 style={{ margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                                                </div>
                                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 'var(--space-sm)', lineHeight: 1.6 }}>
                                                    {item.content !== 'Attached Material' ? item.content : 'View attached resource.'}
                                                </p>
                                                {item.file_url && (
                                                    <div style={{ marginBottom: 'var(--space-md)', display: 'flex', gap: '8px' }}>
                                                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary-50)', color: 'var(--primary-600)', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--text-sm)' }} className="hover:bg-primary-100 transition-colors" onClick={e => e.stopPropagation()}>
                                                            {item.material_type === 'file' ? <><Download size={14} /> Download</> : <><ExternalLink size={14} /> Open</>}
                                                        </a>
                                                        <Button size="xs" variant="primary" style={{ padding: '8px 16px' }} onClick={(e) => { e.stopPropagation(); navigate(`/study-lab/${item.id}`); }}>
                                                            <Sparkles size={14} style={{ marginRight: '4px' }} /> Lab
                                                        </Button>
                                                    </div>
                                                )}
                                                {item.tags?.length > 0 && (
                                                    <div className="flex flex-wrap gap-xs">
                                                        {item.tags.slice(0, 4).map((tag, i) => <Badge key={i} variant="outline" size="xs">#{tag}</Badge>)}
                                                        {item.tags.length > 4 && <Badge variant="outline" size="xs">+{item.tags.length - 4}</Badge>}
                                                    </div>
                                                )}
                                                <div style={{ position: 'absolute', bottom: '12px', right: '12px', opacity: 0.3 }}><Eye size={16} /></div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* My Notes */
                <div>
                    {pinnedNotes.length > 0 && (
                        <>
                            <div className="flex items-center gap-sm mb-md">
                                <Pin size={14} className="text-primary-400" />
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pinned</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                                {pinnedNotes.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={handleDeleteNote} onTogglePin={handleTogglePin} onView={setViewingItem} />)}
                            </div>
                        </>
                    )}
                    {unpinnedNotes.length > 0 && (
                        <div style={{ marginTop: 'var(--space-xl)' }}>
                            {pinnedNotes.length > 0 && (
                                <div className="flex items-center gap-sm mb-md pb-sm" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <FolderOpen size={14} className="text-muted" />
                                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Categories</span>
                                </div>
                            )}
                            {Object.entries(groupedUnpinnedNotes).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
                                const isExpanded = expandedCategories[`notes_${cat}`] !== false;
                                return (
                                    <div key={cat} style={{ marginBottom: 'var(--space-xl)' }}>
                                        <div onClick={() => toggleCategory(`notes_${cat}`)} className="flex items-center gap-sm mb-md" style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            {isExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                                            <h3 style={{ margin: 0 }}>{cat}</h3>
                                            <Badge variant="secondary" size="xs">{items.length}</Badge>
                                        </div>
                                        {isExpanded && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                                                {items.map(note => <NoteCard key={note.id} note={note} onEdit={openEdit} onDelete={handleDeleteNote} onTogglePin={handleTogglePin} onView={setViewingItem} />)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* View Item Modal */}
            <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title={viewingItem?.title || ''} size="full">
                {viewingItem && (
                    <div>
                        <div className="flex flex-wrap justify-between items-center gap-sm mb-md">
                            <div className="flex gap-sm">
                                <Badge variant="accent">{viewingItem.subject || viewingItem.category || 'General'}</Badge>
                                {viewingItem.color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: viewingItem.color }} />}
                            </div>
                            <Button size="sm" variant="primary" onClick={() => { navigate(`/study-lab/${viewingItem.id}`); setViewingItem(null); }}>
                                <Sparkles size={16} className="mr-sm" /> Enter Study Lab
                            </Button>
                        </div>
                        {viewingItem.file_url && viewingItem.material_type === 'file' ? (
                            <div style={{ marginTop: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-xl)', textAlign: 'center', border: '1px solid var(--border)' }}>
                                {viewingItem.file_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                    <img src={viewingItem.file_url} alt="Attached Material" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', borderRadius: 'var(--radius-md)' }} />
                                ) : (
                                        <div style={{ position: 'relative', height: '80vh', background: 'var(--surface)' }}>
                                            <iframe 
                                                src={`https://docs.google.com/gview?url=${encodeURIComponent(viewingItem.file_url)}&embedded=true`}
                                                width="100%" 
                                                height="100%" 
                                                style={{ border: 'none', display: 'block' }} 
                                                title="Document Preview"
                                            />
                                            {/* Fallback buttons in case the viewer fails */}
                                            <div style={{ position: 'absolute', bottom: '20px', right: '20px', display: 'flex', gap: '8px' }}>
                                                <a href={viewingItem.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                                                    <ExternalLink size={14} /> Open Original
                                                </a>
                                            </div>
                                        </div>
                                )}
                            </div>
                        ) : viewingItem.file_url && viewingItem.material_type === 'link' ? (
                            <div style={{ marginTop: 'var(--space-md)' }}>
                                <a href={viewingItem.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                                    <ExternalLink size={16} /> Open External Link
                                </a>
                            </div>
                        ) : null}

                        {viewingItem.content && viewingItem.content !== 'Attached Material' && viewingItem.content !== 'Attached Note' && (
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--text)', fontSize: 'var(--text-sm)', maxHeight: '60vh', overflowY: 'auto', padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)' }}>
                                {viewingItem.content}
                            </div>
                        )}
                        {viewingItem.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-xs mt-md">
                                {viewingItem.tags.map((tag, i) => <Badge key={i} variant="outline" size="xs">#{tag}</Badge>)}
                            </div>
                        )}
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
                            {viewingItem.created_at && `Created ${formatDate(viewingItem.created_at)}`}
                            {viewingItem.updated_at && ` · Updated ${formatRelativeTime(viewingItem.updated_at)}`}
                        </p>
                    </div>
                )}
            </Modal>

            {/* Add/Edit Note Modal */}
            <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingNote(null); }} title={editingNote ? 'Edit Note' : 'New Study Note'}>
                <form onSubmit={handleSaveNote} className="flex flex-col gap-md">
                    {/* Material Type Selector */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <button type="button" onClick={() => setNoteForm({ ...noteForm, material_type: 'file' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: noteForm.material_type === 'file' ? 'var(--primary-500)' : 'transparent', color: noteForm.material_type === 'file' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <File size={16} /> File
                        </button>
                        <button type="button" onClick={() => setNoteForm({ ...noteForm, material_type: 'link' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: noteForm.material_type === 'link' ? 'var(--primary-500)' : 'transparent', color: noteForm.material_type === 'link' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <LinkIcon size={16} /> Link
                        </button>
                        <button type="button" onClick={() => setNoteForm({ ...noteForm, material_type: 'text' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: noteForm.material_type === 'text' ? 'var(--primary-500)' : 'transparent', color: noteForm.material_type === 'text' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FileText size={16} /> Text
                        </button>
                    </div>

                    <div>
                        <label className="label">Title</label>
                        <Input placeholder="e.g. React Hooks Summary" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} required />
                    </div>
                    <div>
                        <label className="label">Category</label>
                        <Input 
                            list="category-suggestions"
                            placeholder="e.g. Physics, React, DSA" 
                            value={noteForm.category} 
                            onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })} 
                        />
                        <datalist id="category-suggestions">
                            {allCategories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>

                    {noteForm.material_type === 'file' && (
                        <div>
                            <label className="label">Upload File (PDF, Image, Doc)</label>
                            {editingNote?.file_url && !noteForm.file && (
                                <p style={{ fontSize: '12px', color: 'var(--primary-500)', marginBottom: '4px' }}>Current file will be kept. Upload new to replace.</p>
                            )}
                            <input 
                                type="file" 
                                className="input" 
                                style={{ padding: '8px' }}
                                onChange={(e) => setNoteForm({ ...noteForm, file: e.target.files[0] })}
                                required={!editingNote?.file_url}
                            />
                        </div>
                    )}

                    {noteForm.material_type === 'link' && (
                        <div>
                            <label className="label">Resource Link (URL)</label>
                            <Input 
                                type="url"
                                placeholder="https://..."
                                value={noteForm.url}
                                onChange={(e) => setNoteForm({ ...noteForm, url: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    {(noteForm.material_type === 'text' || noteForm.material_type !== 'file') && (
                        <div>
                            <label className="label">{noteForm.material_type === 'text' ? 'Content / Notes' : 'Description (Optional)'}</label>
                            <textarea
                                className="input"
                                style={{ minHeight: '150px', lineHeight: 1.7 }}
                                placeholder={noteForm.material_type === 'text' ? "Write your notes here..." : "Add a short description..."}
                                value={noteForm.content}
                                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                                required={noteForm.material_type === 'text'}
                            />
                        </div>
                    )}
                    <div>
                        <label className="label" style={{ marginBottom: '8px' }}>Color Label</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {NOTE_COLORS.map(c => (
                                <button key={c.name} type="button" onClick={() => setNoteForm({ ...noteForm, color: c.value })} style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: c.value || 'var(--border)',
                                    border: noteForm.color === c.value ? '3px solid var(--primary-500)' : '2px solid transparent',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    outline: noteForm.color === c.value ? '2px solid var(--primary-300)' : 'none',
                                    outlineOffset: '2px'
                                }} title={c.name} />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => { setShowAddModal(false); setEditingNote(null); }}>Cancel</Button>
                        <Button variant="primary" type="submit" loading={saving}>{editingNote ? 'Save Changes' : 'Create Note'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Add Shared Resource Modal (Admin) */}
            <Modal isOpen={showAddSharedModal} onClose={() => setShowAddSharedModal(false)} title="Add Shared Resource">
                <form onSubmit={handleSaveSharedResource} className="flex flex-col gap-md">
                    {/* Material Type Selector */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <button type="button" onClick={() => setSharedForm({ ...sharedForm, material_type: 'file' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: sharedForm.material_type === 'file' ? 'var(--primary-500)' : 'transparent', color: sharedForm.material_type === 'file' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <File size={16} /> File Upload
                        </button>
                        <button type="button" onClick={() => setSharedForm({ ...sharedForm, material_type: 'link' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: sharedForm.material_type === 'link' ? 'var(--primary-500)' : 'transparent', color: sharedForm.material_type === 'link' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <LinkIcon size={16} /> Link / URL
                        </button>
                        <button type="button" onClick={() => setSharedForm({ ...sharedForm, material_type: 'text' })} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: sharedForm.material_type === 'text' ? 'var(--primary-500)' : 'transparent', color: sharedForm.material_type === 'text' ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FileText size={16} /> Briefing / Doc
                        </button>
                    </div>

                    <div>
                        <label className="label">Title</label>
                        <Input placeholder="e.g. Week 1 Handout or System Architecture PDF" value={sharedForm.title} onChange={(e) => setSharedForm({ ...sharedForm, title: e.target.value })} required />
                    </div>

                    <div>
                        <label className="label">Category / Sprint Week</label>
                        <Input
                            list="shared-category-suggestions"
                            placeholder="e.g. Week 1, Week 2, Sprint Briefings, React"
                            value={sharedForm.subject}
                            onChange={(e) => setSharedForm({ ...sharedForm, subject: e.target.value })}
                            required
                        />
                        <datalist id="shared-category-suggestions">
                            <option value="Week 1" />
                            <option value="Week 2" />
                            <option value="Week 3" />
                            <option value="Week 4" />
                            <option value="Week 5" />
                            <option value="Week 6" />
                            <option value="Week 7" />
                            <option value="Week 8" />
                            <option value="Sprint Briefings" />
                            <option value="General" />
                        </datalist>
                    </div>

                    {sharedForm.material_type === 'file' && (
                        <div>
                            <label className="label">Upload File (PDF, Image, Doc)</label>
                            <Input type="file" onChange={(e) => setSharedForm({ ...sharedForm, file: e.target.files[0] })} required />
                        </div>
                    )}

                    {sharedForm.material_type === 'link' && (
                        <div>
                            <label className="label">External URL (Notion, Figma, GitHub, Drive)</label>
                            <Input type="url" placeholder="https://..." value={sharedForm.url} onChange={(e) => setSharedForm({ ...sharedForm, url: e.target.value })} required />
                        </div>
                    )}

                    <div>
                        <label className="label">Description / Summary (Optional)</label>
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="Add brief details about this resource..."
                            value={sharedForm.content}
                            onChange={(e) => setSharedForm({ ...sharedForm, content: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-sm justify-end mt-md">
                        <Button variant="ghost" onClick={() => setShowAddSharedModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" loading={saving}>Publish Resource</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// Note Card Component
const NoteCard = ({ note, onEdit, onDelete, onTogglePin, onView }) => {
    const accentBorder = note.color ? `3px solid ${note.color}` : '1px solid var(--border)';

    return (
        <Card style={{ borderLeft: accentBorder, cursor: 'pointer', position: 'relative' }} onClick={() => onView(note)}>
            <div className="flex justify-between items-start mb-sm">
                <Badge variant="secondary" size="xs">{note.category || 'General'}</Badge>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/study-lab/${note.id}`; }} 
                        style={{ background: 'var(--primary-50)', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'var(--primary-600)', borderRadius: '4px', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}
                    >
                        <Sparkles size={10} /> LAB
                    </button>
                    <button onClick={() => onTogglePin(note)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: note.is_pinned ? 'var(--primary-500)' : 'var(--text-muted)', transition: 'color 0.2s' }} title={note.is_pinned ? 'Unpin' : 'Pin'}>
                        {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button onClick={() => onEdit(note)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }} title="Edit">
                        <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--error-500)' }} title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-xs mb-xs">
                {note.material_type === 'file' && <File size={14} className="text-primary-500" />}
                {note.material_type === 'link' && <LinkIcon size={14} className="text-primary-500" />}
                <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title}
                </h4>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, margin: '0 0 8px' }}>
                {note.content !== 'Attached Note' ? note.content : 'View attached resource.'}
            </p>
            <div className="flex items-center gap-xs" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                <Clock size={10} />
                {formatRelativeTime(note.updated_at || note.created_at)}
            </div>
        </Card>
    );
};

export default StudyMaterials;
