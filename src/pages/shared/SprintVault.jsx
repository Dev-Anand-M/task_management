import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal } from '../../components/common';
import { 
    Zap, 
    Plus, 
    Trash2, 
    BookOpen, 
    ExternalLink, 
    FileText, 
    Upload, 
    Link as LinkIcon,
    ArrowRight,
    Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import * as db from '../../services/database';

const DEFAULT_WEEKS = Array.from({ length: 8 }, (_, i) => ({
    week_number: i + 1,
    title: `Week ${i + 1}`,
    description: ''
}));

function SprintVault() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [sprintTemplates, setSprintTemplates] = useState([]);
    const [vaultDocs, setVaultDocs] = useState([]);
    
    console.log('[SprintVault] Current user:', user);
    console.log('[SprintVault] isAdmin:', isAdmin);
    
    // Add Doc Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [targetWeek, setTargetWeek] = useState(1);
    const [saving, setSaving] = useState(false);
    const [docForm, setDocForm] = useState({
        title: '',
        content: '',
        material_type: 'file', // 'file' or 'link'
        file: null,
        url: ''
    });

    const loadVaultData = useCallback(async () => {
        if (!user?.id) return;
        const cid = user.classroom_id;
        try {
            if (vaultDocs.length === 0) {
                setLoading(true);
            }
            const [tempRes, vaultRes, kbRes] = await Promise.all([
                supabase.from('sprint_templates').select('*').order('week_number', { ascending: true }),
                supabase.from('sprint_vault').select('*').order('week_number', { ascending: true }),
                supabase.from('knowledge_base').select('*').order('created_at', { ascending: false })
            ]);

            let templates = tempRes?.data || [];
            if (cid) {
                templates = templates.filter(t => !t.classroom_id || t.classroom_id === cid);
            }
            setSprintTemplates(templates.length > 0 ? templates : DEFAULT_WEEKS);

            // Merge docs from both sprint_vault (new) and knowledge_base (old migrated docs)
            let newDocs = vaultRes?.data || [];
            let oldDocs = kbRes?.data || [];
            
            console.log('[SprintVault] Raw sprint_vault docs:', newDocs);
            console.log('[SprintVault] Raw knowledge_base docs:', oldDocs);
            
            // Map old knowledge_base docs to match sprint_vault structure
            const mappedOldDocs = oldDocs.map(d => {
                const weekMatch = (d.subject || '').match(/week\s*(\d+)/i);
                const weekNum = weekMatch ? parseInt(weekMatch[1]) : null;
                console.log(`[SprintVault] Mapping old doc "${d.title}" - subject: "${d.subject}" - extracted week: ${weekNum}`);
                return {
                    ...d,
                    week_number: weekNum,
                    file_type: d.material_type || 'file',
                    file_url: d.url || d.file_url,
                    uploaded_by: d.created_by || null,
                    is_old_migration: true
                };
            }).filter(d => d.week_number !== null);
            
            console.log('[SprintVault] Mapped old docs:', mappedOldDocs);
            
            let allDocs = [...newDocs, ...mappedOldDocs];
            
            if (cid) {
                allDocs = allDocs.filter(d => !d.classroom_id || d.classroom_id === cid);
            }
            
            console.log('[SprintVault] Final merged docs:', allDocs);
            setVaultDocs(allDocs);
        } catch (err) {
            console.error('[SprintVault] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.classroom_id]);

    useEffect(() => {
        loadVaultData();
    }, [loadVaultData]);

    const handleOpenAddModal = (weekNum) => {
        setTargetWeek(weekNum);
        setDocForm({ title: '', content: '', material_type: 'file', file: null, url: '' });
        setShowAddModal(true);
    };

    const handleSaveDoc = async (e) => {
        e.preventDefault();
        if (!docForm.title) return;
        setSaving(true);

        try {
            let file_url = docForm.url;
            if (docForm.material_type === 'file' && docForm.file) {
                file_url = await db.uploadStudyMaterial(docForm.file);
            }

            // Save directly to sprint_vault table (NOT knowledge_base)
            await supabase.from('sprint_vault').insert({
                classroom_id: user?.classroom_id,
                week_number: targetWeek,
                title: docForm.title,
                description: docForm.content || `Sprint Vault Resource for Week ${targetWeek}`,
                file_url: file_url,
                file_type: docForm.material_type,
                uploaded_by: user?.id
            });

            // Also update sprint_templates resource_url for quick reference
            await supabase.from('sprint_templates').upsert({
                classroom_id: user?.classroom_id,
                week_number: targetWeek,
                title: sprintTemplates.find(t => t.week_number === targetWeek)?.title || `Week ${targetWeek}`,
                resource_url: file_url || `/sprint-vault`,
                resource_label: docForm.title
            }, { onConflict: 'classroom_id,week_number' });

            setShowAddModal(false);
            loadVaultData();
        } catch (err) {
            console.error('Save doc error:', err);
            alert('Failed to save document: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDoc = async (doc) => {
        if (!confirm('Are you sure you want to delete this resource?')) return;
        try {
            if (typeof doc === 'object' && doc.is_template_resource) {
                const weekNum = parseInt(doc.id.replace('template-res-', ''), 10);
                await supabase.from('sprint_templates').update({ resource_url: null, resource_label: null }).eq('week_number', weekNum);
            } else {
                const docId = typeof doc === 'object' ? doc.id : doc;
                
                // Try deleting from sprint_vault first
                const { error: vaultErr } = await supabase.from('sprint_vault').delete().eq('id', docId);
                
                // If not found in sprint_vault, try knowledge_base (for old migrated docs)
                if (vaultErr || vaultErr?.code === 'PGRST116') {
                    const { error: kbErr } = await supabase.from('knowledge_base').delete().eq('id', docId);
                    if (kbErr) throw kbErr;
                }
            }
            loadVaultData();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    // Filter documents attached to a specific week in Sprint Vault
    const getDocsForWeek = (weekNum) => {
        const list = [];
        const template = sprintTemplates.find(t => t.week_number === weekNum);

        // 1. Include resource from sprint_templates if present
        if (template && template.resource_url && template.resource_url !== '/sprint-vault' && template.resource_url.trim() !== '') {
            list.push({
                id: `template-res-${weekNum}`,
                title: template.resource_label || `${template.title || 'Week ' + weekNum} Resource`,
                file_url: template.resource_url,
                material_type: template.resource_url.startsWith('http') ? 'link' : 'file',
                is_template_resource: true
            });
        }

        // 2. Include sprint_vault documents for this week (direct week_number match)
        const sprintDocs = vaultDocs.filter(d => d.week_number === weekNum);

        // Merge without duplicating file_urls
        sprintDocs.forEach(d => {
            if (!list.some(existing => existing.file_url === d.file_url)) {
                list.push(d);
            }
        });

        return list;
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg" style={{ gap: 'var(--space-md)' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Zap className="text-primary-400" />
                        Sprint Vault
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Weekly sprint briefs, documentation & learning resources for Tarothon
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="outline" icon={Zap} onClick={() => navigate('/sprint-tracker')}>
                        Go to Sprint Tracker <ArrowRight size={14} />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                    Loading Sprint Vault...
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 'var(--space-xl)' }}>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(weekNum => {
                        const template = sprintTemplates.find(t => t.week_number === weekNum) || { title: `Week ${weekNum}` };
                        const docs = getDocsForWeek(weekNum);

                        return (
                            <Card key={weekNum} style={{
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                border: '1px solid var(--border)', background: 'var(--card)', position: 'relative',
                                borderRadius: 'var(--radius-xl)', minHeight: '240px'
                            }}>
                                <div style={{ padding: 'var(--space-xl)' }}>
                                    {/* Week Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                                        <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text)', lineHeight: 1.3 }}>
                                            📌 Week {weekNum}: {template.title || `Week ${weekNum}`}
                                        </div>
                                        {template.is_showcase && (
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'var(--primary-500)', color: '#fff', fontWeight: 700 }}>
                                                🃏 Showcase
                                            </span>
                                        )}
                                    </div>

                                    {template.description && 
                                     !template.description.toLowerCase().includes('configure this template') && (
                                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--space-md)', lineHeight: 1.4 }}>
                                            {template.description}
                                        </p>
                                    )}

                                    {/* Attached Documents List */}
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                            Attached Resources ({docs.length})
                                        </div>

                                        {docs.length === 0 ? (
                                            <div style={{ padding: 'var(--space-md)', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                No documents attached yet for Week {weekNum}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {docs.map(doc => (
                                                    <div key={doc.id} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '10px 14px', borderRadius: 'var(--radius-lg)',
                                                        background: 'var(--surface)', border: '1px solid var(--border)',
                                                        fontSize: 'var(--text-sm)'
                                                    }}>
                                                        <a
                                                            href={doc.file_url || doc.url || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: 600, textDecoration: 'none', minWidth: 0, flex: 1 }}
                                                        >
                                                            <FileText size={16} style={{ flexShrink: 0 }} />
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {doc.title}
                                                            </span>
                                                            <ExternalLink size={13} style={{ flexShrink: 0 }} />
                                                        </a>

                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                onClick={() => handleDeleteDoc(doc)}
                                                                title="Delete Resource"
                                                                style={{ 
                                                                    background: '#fee2e2', 
                                                                    border: '1px solid #fecaca', 
                                                                    color: '#dc2626', 
                                                                    cursor: 'pointer', 
                                                                    padding: '6px 10px',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: 'var(--text-xs)',
                                                                    fontWeight: 600,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={e => {
                                                                    e.currentTarget.style.background = '#fecaca';
                                                                    e.currentTarget.style.borderColor = '#dc2626';
                                                                }}
                                                                onMouseLeave={e => {
                                                                    e.currentTarget.style.background = '#fee2e2';
                                                                    e.currentTarget.style.borderColor = '#fecaca';
                                                                }}
                                                            >
                                                                <Trash2 size={14} /> Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer for Admin */}
                                {isAdmin && (
                                    <div style={{ padding: 'var(--space-md) var(--space-xl)', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleOpenAddModal(weekNum)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                padding: '10px 18px', borderRadius: 'var(--radius-lg)',
                                                background: 'var(--primary-500)', color: '#fff',
                                                border: 'none', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                                                transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                                            }}
                                        >
                                            <Plus size={16} /> Add Doc to Week {weekNum}
                                        </button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Document Modal for Admins */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title={`+ Add Document / Link to Week ${targetWeek}`}
            >
                <form onSubmit={handleSaveDoc} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>
                            Resource Title *
                        </label>
                        <input
                            type="text"
                            value={docForm.title || ''}
                            onChange={e => setDocForm({ ...docForm, title: e.target.value })}
                            placeholder="e.g. Week 1 Briefing & Architecture Overview"
                            required
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text)', fontSize: 'var(--text-sm)'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>
                            Type
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <button
                                type="button"
                                onClick={() => setDocForm({ ...docForm, material_type: 'file' })}
                                style={{
                                    flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)',
                                    border: docForm.material_type === 'file' ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                                    background: docForm.material_type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface)',
                                    color: 'var(--text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <Upload size={16} /> File / PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => setDocForm({ ...docForm, material_type: 'link' })}
                                style={{
                                    flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)',
                                    border: docForm.material_type === 'link' ? '2px solid var(--primary-500)' : '1px solid var(--border)',
                                    background: docForm.material_type === 'link' ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface)',
                                    color: 'var(--text)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <LinkIcon size={16} /> External Link / URL
                            </button>
                        </div>
                    </div>

                    {docForm.material_type === 'file' ? (
                        <div>
                            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>
                                Choose File (PDF, Image, Doc) *
                            </label>
                            <input
                                type="file"
                                onChange={e => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                                required
                                style={{
                                    width: '100%', padding: '6px', borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)', background: 'var(--surface)',
                                    color: 'var(--text)', fontSize: 'var(--text-xs)'
                                }}
                            />
                        </div>
                    ) : (
                        <div>
                            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>
                                URL Link *
                            </label>
                            <input
                                type="url"
                                value={docForm.url || ''}
                                onChange={e => setDocForm({ ...docForm, url: e.target.value })}
                                placeholder="https://notion.so/..."
                                required
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)', background: 'var(--surface)',
                                    color: 'var(--text)', fontSize: 'var(--text-sm)'
                                }}
                            />
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                            Briefing / Description (Optional)
                        </label>
                        <textarea
                            value={docForm.content || ''}
                            onChange={e => setDocForm({ ...docForm, content: e.target.value })}
                            placeholder="Add brief instructions or outline for students..."
                            rows={3}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text)', fontSize: 'var(--text-xs)', fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                        <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={saving}>
                            {saving ? 'Uploading...' : `💾 Save to Week ${targetWeek}`}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
export default memo(SprintVault);
