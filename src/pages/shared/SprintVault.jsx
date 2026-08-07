import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal } from '../../components/common';
import { CodeVaultViewer } from '../../components/sprint/CodeVaultViewer';
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
    Check,
    Code,
    Lock
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
            const [tempRes, vaultRes, profilesRes] = await Promise.all([
                supabase.from('sprint_templates').select('*').order('week_number', { ascending: true }),
                supabase.from('sprint_vault').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles').select('id, name, email, avatar_url')
            ]);
            const profilesMap = {};
            (profilesRes?.data || []).forEach(p => { profilesMap[p.id] = p; });

            let templates = tempRes?.data || [];
            if (cid) {
                templates = templates.filter(t => !t.classroom_id || t.classroom_id === cid);
            }
            setSprintTemplates(templates.length > 0 ? templates : DEFAULT_WEEKS);

            let rawVaultDocs = vaultRes?.data || [];
            if (vaultRes.error) {
                console.error('[SprintVault] Error loading sprint_vault docs:', vaultRes.error);
            }
            
            // Map sprint_vault docs with integer week_number and uploader profile details
            const mappedDocs = rawVaultDocs.map(d => {
                const uploader = profilesMap[d.uploaded_by] || null;
                const formattedDate = d.created_at ? new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
                
                return {
                    ...d,
                    week_number: parseInt(d.week_number, 10) || 1,
                    uploader_name: uploader?.name || uploader?.email?.split('@')[0] || (d.uploaded_by ? 'Team Member' : 'Classroom Lead'),
                    uploader_avatar: uploader?.avatar_url || null,
                    formatted_date: formattedDate
                };
            });
            
            console.log('[SprintVault] Loaded vault docs:', mappedDocs);
            setVaultDocs(mappedDocs);
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

    const [viewingCodeDoc, setViewingCodeDoc] = useState(null);

    const handleSaveDoc = async (e) => {
        e.preventDefault();
        if (!docForm.title) return;
        setSaving(true);

        try {
            let file_url = docForm.url;
            if (docForm.material_type === 'file' && docForm.file) {
                file_url = await db.uploadStudyMaterial(docForm.file);
            }

            // Save exclusively to sprint_vault table
            const { error: vaultErr } = await supabase.from('sprint_vault').insert({
                classroom_id: user?.classroom_id,
                week_number: targetWeek,
                title: docForm.title,
                description: docForm.content || `Sprint Vault Resource for Week ${targetWeek}`,
                file_url: file_url,
                file_type: docForm.material_type,
                uploaded_by: user?.id
            });

            if (vaultErr) {
                console.error('[SprintVault] sprint_vault insert error:', vaultErr);
                throw new Error(vaultErr.message || 'Failed to save to sprint_vault');
            }

            // Notify classroom of new Sprint Vault upload
            try {
                if (user?.classroom_id) {
                    await db.notifyClassroom(user.classroom_id, {
                        title: `📁 New Sprint Vault Upload (Week ${targetWeek})`,
                        message: `${user.name || 'A teammate'} uploaded "${docForm.title}" for Week ${targetWeek}.`,
                        type: 'vault',
                        link: '/sprint-vault'
                    });
                }
            } catch (notifErr) {
                console.error('[SprintVault] Notification error:', notifErr);
            }

            // Update sprint_templates primary resource for quick reference (Admin capability or safe try-catch)
            if (isAdmin) {
                try {
                    await supabase.from('sprint_templates').upsert({
                        classroom_id: user?.classroom_id,
                        week_number: targetWeek,
                        title: sprintTemplates.find(t => t.week_number === targetWeek)?.title || `Week ${targetWeek}`,
                        resource_url: file_url || `/sprint-vault`,
                        resource_label: docForm.title
                    }, { onConflict: 'classroom_id,week_number' });
                } catch (tmplErr) {
                    console.warn('[SprintVault] Template upsert non-critical warning:', tmplErr);
                }
            }

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
        const canDelete = isAdmin || (typeof doc === 'object' && !doc.is_template_resource && doc.uploaded_by && doc.uploaded_by === user?.id);
        if (!canDelete) {
            alert('Permission denied: Only admins or the uploader can delete this resource.');
            return;
        }

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
        const sprintDocs = vaultDocs.filter(d => Number(d.week_number) === Number(weekNum));

        // Merge without duplicating
        sprintDocs.forEach(d => {
            const isDuplicate = list.some(existing => 
                existing.id === d.id || (d.file_url && existing.file_url === d.file_url)
            );
            if (!isDuplicate) {
                list.push(d);
            }
        });

        return list;
    };

    const isWeekLocked = (weekNum) => {
        const template = sprintTemplates.find(t => Number(t.week_number) === Number(weekNum));
        if (!template || !template.start_date || !template.end_date) return false;

        const todayStr = new Date().toISOString().split('T')[0];
        const startStr = template.start_date.split('T')[0];
        const endStr = template.end_date.split('T')[0];

        return todayStr < startStr || todayStr > endStr;
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
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                    Loading Sprint Vault...
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 'var(--space-xl)' }}>
                    {(sprintTemplates && sprintTemplates.length > 0 ? sprintTemplates : DEFAULT_WEEKS).map(tmpl => {
                        const weekNum = Number(tmpl.week_number || tmpl.week || 1);
                        const template = tmpl;
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
                                        {(() => {
                                            const officialBriefings = docs.filter(d => d.is_template_resource);
                                            const teamSubmissions = docs.filter(d => !d.is_template_resource);

                                            if (docs.length === 0) {
                                                return (
                                                    <div style={{ padding: 'var(--space-md)', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        No uploads or briefings yet for Week {weekNum}
                                                    </div>
                                                );
                                            }

                                            const renderDocItem = (doc, isOfficial = false) => {
                                                const uploadedAt = doc.created_at ? new Date(doc.created_at) : null;
                                                const timeAgo = uploadedAt ? (() => {
                                                    const diff = Date.now() - uploadedAt.getTime();
                                                    const mins = Math.floor(diff / 60000);
                                                    const hrs = Math.floor(mins / 60);
                                                    const days = Math.floor(hrs / 24);
                                                    if (days > 0) return `${days}d ago`;
                                                    if (hrs > 0) return `${hrs}h ago`;
                                                    if (mins > 0) return `${mins}m ago`;
                                                    return 'just now';
                                                })() : null;

                                                const urlLower = (doc.file_url || doc.url || '').toLowerCase();
                                                const typeLower = (doc.file_type || doc.material_type || '').toLowerCase();
                                                const isZip = urlLower.includes('.zip') || typeLower === 'zip';
                                                const isLink = typeLower === 'link' || (!isZip && urlLower.startsWith('http') && (urlLower.includes('notion.so') || urlLower.includes('figma.com') || urlLower.includes('google.com')));

                                                // Tree-suitable: zip files, code files, text, markdown, json, py, js, etc.
                                                const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.cpp', '.c', '.h', '.java', '.md', '.txt', '.xml', '.yaml', '.yml'];
                                                const isTreeSuitable = !isOfficial && (isZip || codeExts.some(ext => urlLower.endsWith(ext)) || (typeLower === 'file' && !isLink));

                                                return (
                                                    <div key={doc.id} style={{
                                                        borderRadius: 'var(--radius-lg)',
                                                        background: isOfficial ? 'color-mix(in srgb, var(--primary-500), transparent 93%)' : 'var(--surface)',
                                                        border: isOfficial ? '1px solid color-mix(in srgb, var(--primary-500), transparent 70%)' : '1px solid var(--border)',
                                                        overflow: 'hidden',
                                                        transition: 'border-color 0.2s ease'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-400)'}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = isOfficial ? 'color-mix(in srgb, var(--primary-500), transparent 70%)' : 'var(--border)'}
                                                    >
                                                        {/* Top row: icon + title + uploader info + actions */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
                                                            <div style={{
                                                                width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                                                                background: isOfficial ? 'rgba(59,130,246,0.2)' : isZip ? 'rgba(245,158,11,0.15)' : isLink ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                {isOfficial ? <BookOpen size={16} style={{ color: '#3b82f6' }} />
                                                                       : isZip ? <span style={{ fontSize: '16px' }}>🗜️</span>
                                                                       : isLink ? <ExternalLink size={16} style={{ color: '#3b82f6' }} />
                                                                       : <FileText size={16} style={{ color: '#10b981' }} />}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <a
                                                                    href={doc.file_url || doc.url || '#'}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-sm)', color: isOfficial ? '#3b82f6' : 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {doc.title}
                                                                </a>
                                                                {/* Uploader name & Upload timestamp */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                                                    {isOfficial ? (
                                                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                                                                            📜 Official Briefing
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            {doc.uploader_avatar ? (
                                                                                <img src={doc.uploader_avatar} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                                                                                    {(doc.uploader_name || '?')[0].toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                                Uploaded by <strong style={{ color: 'var(--text)' }}>{doc.uploader_name || 'Team Member'}</strong>
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {timeAgo && (
                                                                        <>
                                                                            <span style={{ fontSize: '10px', color: 'var(--border)' }}>·</span>
                                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Actions: Browse Tree only when suitable */}
                                                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                                                                {isTreeSuitable && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setViewingCodeDoc(doc)}
                                                                        title="Browse Code Tree & File Explorer"
                                                                        style={{
                                                                            background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                                                                            color: '#38bdf8', cursor: 'pointer', padding: '4px 9px',
                                                                            borderRadius: '6px', display: 'inline-flex', alignItems: 'center',
                                                                            gap: '4px', fontSize: '11px', fontWeight: 700
                                                                        }}
                                                                    >
                                                                        <Code size={12} /> Browse Tree
                                                                    </button>
                                                                )}
                                                                {(isAdmin || (!doc.is_template_resource && doc.uploaded_by && doc.uploaded_by === user?.id)) && (
                                                                    <button
                                                                        onClick={() => handleDeleteDoc(doc)}
                                                                        title="Delete Resource"
                                                                        style={{
                                                                            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
                                                                            color: '#dc2626', cursor: 'pointer', padding: '4px 7px',
                                                                            borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px',
                                                                            fontSize: '11px', fontWeight: 600
                                                                        }}
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Description strip if present */}
                                                        {(doc.description || doc.content) && (
                                                            <div style={{ padding: '0 14px 10px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                                                {(doc.description || doc.content).slice(0, 120)}{(doc.description || doc.content).length > 120 ? '…' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            };

                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {/* Official Briefings Section */}
                                                    {officialBriefings.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <BookOpen size={12} /> Official Briefing & Documentation ({officialBriefings.length})
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {officialBriefings.map(d => renderDocItem(d, true))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Section Divider Line */}
                                                    {officialBriefings.length > 0 && teamSubmissions.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 2px' }}>
                                                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Team Submissions ({teamSubmissions.length})
                                                            </span>
                                                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                                                        </div>
                                                    )}

                                                    {/* Team Submissions Section */}
                                                    {teamSubmissions.length > 0 && (
                                                        <div>
                                                            {officialBriefings.length === 0 && (
                                                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                                                                    Team Submissions ({teamSubmissions.length})
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {teamSubmissions.map(d => renderDocItem(d, false))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Card Footer for Members & Admins */}
                                <div style={{ padding: 'var(--space-md) var(--space-xl)', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {!isWeekLocked(weekNum) || isAdmin ? (
                                        <button
                                            onClick={() => handleOpenAddModal(weekNum)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                padding: '10px 18px', borderRadius: 'var(--radius-lg)',
                                                background: 'var(--primary-500)', color: '#fff',
                                                border: 'none', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                                                transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)', marginLeft: 'auto'
                                            }}
                                        >
                                            <Plus size={16} /> Add Doc to Week {weekNum}
                                        </button>
                                    ) : (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)'
                                        }}>
                                            <Lock size={13} style={{ color: '#ef4444' }} /> Upload Locked (Starts {template.start_date ? new Date(template.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Soon'})
                                        </span>
                                    )}
                                </div>
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

            {/* Embedded Code Tree & File Explorer Modal */}
            <CodeVaultViewer
                isOpen={!!viewingCodeDoc}
                onClose={() => setViewingCodeDoc(null)}
                doc={viewingCodeDoc}
            />
        </div>
    );
}
export default memo(SprintVault);
