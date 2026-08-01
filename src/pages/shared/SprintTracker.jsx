import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Modal, Input } from '../../components/common';
import {
    Trophy,
    Star,
    Users,
    ChevronDown,
    ChevronUp,
    Send,
    BarChart3,
    Edit2,
    CheckCircle,
    AlertCircle,
    Calendar,
    Zap,
    Trash2,
    Lock,
    Unlock,
    UserPlus,
    UserCheck,
    Settings,
    Download,
    PlusCircle,
    BookOpen,
    ExternalLink,
    Link as LinkIcon,
    HelpCircle,
    Upload,
    Copy,
    Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import * as db from '../../services/database';

// Fallback default template — used only when no DB template is configured for a classroom
const DEFAULT_TEMPLATE = [
    { week: 1, title: 'Week 1', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 2, title: 'Week 2', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 3, title: 'Week 3', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 4, title: 'Week 4 — Showcase', description: 'Mid-sprint showcase. Configure from Admin Panel.', is_showcase: true },
    { week: 5, title: 'Week 5', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 6, title: 'Week 6', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 7, title: 'Week 7', description: 'Configure this template from Admin Panel → Configure Sprint Weeks.', is_showcase: false },
    { week: 8, title: 'Week 8 — Final Showcase', description: 'Final sprint showcase. Configure from Admin Panel.', is_showcase: true }
];

const RUBRIC = [
    { key: 'task_ownership', label: 'Task Ownership', emoji: '📋', description: 'Read, tested, and contributed to the assigned feature' },
    { key: 'code_quality', label: 'Code Quality', emoji: '💻', description: 'Clean code, responsive UI, no console errors' },
    { key: 'demo_understanding', label: 'Demo & Understanding', emoji: '🎤', description: 'Can explain how the feature works' },
    { key: 'autonomy', label: 'Autonomy', emoji: '🚀', description: 'Solved blockers independently' }
];

const SprintTracker = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [evaluations, setEvaluations] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [allClassroomMembers, setAllClassroomMembers] = useState([]);
    const [participantIds, setParticipantIds] = useState(new Set());
    const [sprintLocks, setSprintLocks] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [showEvalModal, setShowEvalModal] = useState(false);
    const [showParticipantModal, setShowParticipantModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [evalTarget, setEvalTarget] = useState(null);
    const [evalScores, setEvalScores] = useState({ task_ownership: 5, code_quality: 5, demo_understanding: 5, autonomy: 5, notes: '' });
    const [saving, setSaving] = useState(false);
    const [expandedWeek, setExpandedWeek] = useState(null);

    // Sprint template state
    const [sprintTemplate, setSprintTemplate] = useState(DEFAULT_TEMPLATE);
    const [templateDraft, setTemplateDraft] = useState([]);
    const [templateSaving, setTemplateSaving] = useState(false);
    const [showCsvHelp, setShowCsvHelp] = useState(false);
    const [copiedFormat, setCopiedFormat] = useState(false);

    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState(user?.classroom_id || '');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const safetyTimeout = setTimeout(() => setLoading(false), 8000);

            // Fetch available classrooms (for admin classroom selection)
            if (isAdmin) {
                const { data: clsData } = await supabase.from('classrooms').select('*').order('name');
                setClassrooms(clsData || []);
            }

            // Determine active classroom ID
            const targetClassroomId = isAdmin ? (selectedClassroomId || user?.classroom_id) : user?.classroom_id;

            // Load sprint evaluations
            let evalQuery = supabase.from('sprint_evaluations').select('*').order('week_number', { ascending: true });
            if (targetClassroomId) {
                evalQuery = evalQuery.eq('classroom_id', targetClassroomId);
            }
            const { data: evals, error: evalErr } = await evalQuery;
            if (evalErr) console.error('[SprintTracker] Eval load error:', evalErr);
            setEvaluations(evals || []);

            // Load classroom members
            let memberQuery = supabase.from('profiles').select('id, name, email, role, avatar_url').order('name');
            if (targetClassroomId) {
                memberQuery = memberQuery.eq('classroom_id', targetClassroomId);
            }
            const { data: members, error: memberErr } = await memberQuery;
            if (memberErr) console.error('[SprintTracker] Members load error:', memberErr);

            const fetchedMembers = members || [];
            setAllClassroomMembers(fetchedMembers);

            // Load sprint participants added by admin
            let partQuery = supabase.from('sprint_participants').select('*');
            if (targetClassroomId) {
                partQuery = partQuery.eq('classroom_id', targetClassroomId);
            }
            const { data: parts, error: partErr } = await partQuery;
            if (partErr) console.error('[SprintTracker] Participants load error:', partErr);

            const partSet = new Set((parts || []).map(p => p.user_id));
            setParticipantIds(partSet);

            // Filter active sprint team members strictly by participants added by admin
            setTeamMembers(fetchedMembers.filter(m => partSet.has(m.id)));

            // Load sprint lock overrides
            let lockQuery = supabase.from('sprint_locks').select('*');
            if (targetClassroomId) {
                lockQuery = lockQuery.eq('classroom_id', targetClassroomId);
            }
            const { data: locks, error: lockErr } = await lockQuery;
            if (!lockErr && locks) {
                const lockMap = {};
                locks.forEach(l => { lockMap[l.week_number] = l.is_locked; });
                setSprintLocks(lockMap);
            }

            // Load sprint template for this classroom
            let templateQuery = supabase
                .from('sprint_templates')
                .select('*')
                .order('week_number', { ascending: true });
            if (targetClassroomId) {
                templateQuery = templateQuery.eq('classroom_id', targetClassroomId);
            }
            const { data: templateRows, error: templateErr } = await templateQuery;
            if (templateErr) console.error('[SprintTracker] Template load error:', templateErr);

            if (templateRows && templateRows.length > 0) {
                // Map DB rows to consistent shape
                const mapped = templateRows.map(r => ({
                    week: r.week_number,
                    title: r.title,
                    description: r.description || '',
                    is_showcase: r.is_showcase || false,
                    start_date: r.start_date || '',
                    end_date: r.end_date || '',
                    resource_url: r.resource_url || '',
                    resource_label: r.resource_label || ''
                }));
                setSprintTemplate(mapped);
            } else {
                // Fall back to default template
                setSprintTemplate(DEFAULT_TEMPLATE);
            }

            clearTimeout(safetyTimeout);
        } catch (err) {
            console.error('[SprintTracker] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.classroom_id, selectedClassroomId, isAdmin]);

    useEffect(() => {
        loadData();

        // Realtime updates
        const channel = supabase
            .channel(`sprint-tracker-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_evaluations' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_locks' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_participants' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sprint_templates' }, () => loadData())
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [loadData]);

    // Admin Toggle Participant (Add or Remove member to/from sprint)
    const handleToggleParticipant = async (targetUserId) => {
        const isParticipant = participantIds.has(targetUserId);
        const classroomId = user?.classroom_id || null;

        try {
            if (isParticipant) {
                const { error } = await supabase
                    .from('sprint_participants')
                    .delete()
                    .eq('user_id', targetUserId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sprint_participants')
                    .insert({ classroom_id: classroomId, user_id: targetUserId });
                if (error) throw error;
            }
            loadData();
        } catch (err) {
            console.error('[SprintTracker] Participant toggle error:', err);
            alert('Failed to update participant: ' + err.message);
        }
    };

    // Check if a week is locked (manual DB override > deadline > automatic day-of-week schedule)
    const isWeekLocked = (weekNum) => {
        // 1. Manual admin override takes priority
        if (sprintLocks[weekNum] !== undefined) {
            return sprintLocks[weekNum];
        }
        // 2. Auto-lock if today is past the week's end_date
        const weekData = sprintTemplate[weekNum - 1];
        if (weekData?.end_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadline = new Date(weekData.end_date);
            deadline.setHours(23, 59, 59, 999); // lock after end of deadline day
            if (today > deadline) return true;
        }
        // 3. Default: lock all weeks except week 1, unless it's Sunday (demo day)
        return weekNum > 1 && new Date().getDay() !== 0;
    };

    // Manual Admin Lock Toggle
    const handleToggleLock = async (weekNum) => {
        const currentlyLocked = isWeekLocked(weekNum);
        const newLockState = !currentlyLocked;
        try {
            const classroomId = user?.classroom_id || null;
            const { error } = await supabase.from('sprint_locks').upsert({
                classroom_id: classroomId,
                week_number: weekNum,
                is_locked: newLockState,
                updated_at: new Date().toISOString()
            }, { onConflict: 'classroom_id,week_number' });

            if (error) throw error;
            setSprintLocks(prev => ({ ...prev, [weekNum]: newLockState }));
        } catch (err) {
            console.error('[SprintTracker] Lock toggle error:', err);
            alert('Failed to update submission lock: ' + err.message);
        }
    };

    // ─── Admin: Save Sprint Template ──────────────────────────────────────────
    const saveSprintTemplate = async () => {
        if (templateDraft.length === 0) {
            alert('Template cannot be empty — add at least one week.');
            return;
        }
        setTemplateSaving(true);
        const classroomId = selectedClassroomId || user?.classroom_id || null;
        try {
            // Delete all existing rows for this classroom first
            const { error: delErr } = await supabase
                .from('sprint_templates')
                .delete()
                .eq('classroom_id', classroomId);
            if (delErr) throw delErr;

            // Insert the new template rows
            const rows = templateDraft.map((w, idx) => ({
                classroom_id: classroomId,
                week_number: idx + 1,
                title: w.title || `Week ${idx + 1}`,
                description: w.description || '',
                is_showcase: w.is_showcase || false,
                start_date: w.start_date || null,
                end_date: w.end_date || null,
                resource_url: w.resource_url || null,
                resource_label: w.resource_label || null,
                updated_at: new Date().toISOString()
            }));
            const { error: insErr } = await supabase.from('sprint_templates').insert(rows);
            if (insErr) throw insErr;

            setShowTemplateModal(false);
            loadData();
        } catch (err) {
            console.error('[SprintTracker] Save template error:', err);
            alert('Failed to save template: ' + err.message);
        } finally {
            setTemplateSaving(false);
        }
    };

    // Template draft helpers
    const openTemplateModal = () => {
        // Clone current template into draft (re-index weeks to match position)
        setTemplateDraft(sprintTemplate.map((w, idx) => ({
            title: w.title,
            description: w.description,
            is_showcase: w.is_showcase,
            start_date: w.start_date || '',
            end_date: w.end_date || '',
            resource_url: w.resource_url || '',
            resource_label: w.resource_label || ''
        })));
        setShowTemplateModal(true);
    };

    const updateDraftWeek = (idx, field, value) => {
        setTemplateDraft(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
    };

    const addDraftWeek = () => {
        setTemplateDraft(prev => [...prev, { title: `Week ${prev.length + 1}`, description: '', is_showcase: false, start_date: '', end_date: '', resource_url: '', resource_label: '' }]);
    };

    const removeDraftWeek = (idx) => {
        if (templateDraft.length <= 1) { alert('A template must have at least one week.'); return; }
        setTemplateDraft(prev => prev.filter((_, i) => i !== idx));
    };

    // CSV Import Parser
    const parseSprintCSV = (csvText) => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine.trim()) continue;

            const cols = [];
            let cur = '';
            let inQuotes = false;
            for (let c = 0; c < rawLine.length; c++) {
                const char = rawLine[c];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cols.push(cur.trim().replace(/^["']|["']$/g, ''));
                    cur = '';
                } else {
                    cur += char;
                }
            }
            cols.push(cur.trim().replace(/^["']|["']$/g, ''));

            const getCol = (key) => {
                const idx = headers.indexOf(key);
                return idx !== -1 && cols[idx] !== undefined ? cols[idx] : '';
            };

            const week = parseInt(getCol('week_number') || getCol('week') || i, 10);
            const title = getCol('title') || `Week ${week}`;
            const description = getCol('description') || '';
            const is_showcase = ['true', '1', 'yes'].includes((getCol('is_showcase') || '').toLowerCase());
            const start_date = getCol('start_date') || '';
            const end_date = getCol('end_date') || '';
            const resource_url = getCol('resource_url') || '';
            const resource_label = getCol('resource_label') || '';

            rows.push({
                week,
                title,
                description,
                is_showcase,
                start_date,
                end_date,
                resource_url,
                resource_label
            });
        }
        return rows;
    };

    const handleImportCSV = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = parseSprintCSV(evt.target.result);
                if (parsed.length === 0) {
                    alert('No valid week rows found in CSV. Click the (?) icon for expected format.');
                    return;
                }
                setTemplateDraft(parsed.map(w => ({
                    title: w.title,
                    description: w.description,
                    is_showcase: w.is_showcase,
                    start_date: w.start_date,
                    end_date: w.end_date,
                    resource_url: w.resource_url,
                    resource_label: w.resource_label
                })));
                alert(`Successfully imported ${parsed.length} weeks from CSV! Review and click Save Template.`);
            } catch (err) {
                console.error('CSV parse error:', err);
                alert('Failed to parse CSV file: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportTemplateCSV = () => {
        const headers = ['week_number', 'title', 'description', 'is_showcase', 'start_date', 'end_date', 'resource_url', 'resource_label'];
        const rows = templateDraft.map((w, idx) => [
            idx + 1,
            `"${(w.title || '').replace(/"/g, '""')}"`,
            `"${(w.description || '').replace(/"/g, '""')}"`,
            w.is_showcase ? 'true' : 'false',
            w.start_date || '',
            w.end_date || '',
            `"${(w.resource_url || '').replace(/"/g, '""')}"`,
            `"${(w.resource_label || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sprint_weeks_template.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Move a week up or down
    const moveDraftWeek = (idx, direction) => {
        setTemplateDraft(prev => {
            const arr = [...prev];
            const target = idx + direction;
            if (target < 0 || target >= arr.length) return arr;
            [arr[idx], arr[target]] = [arr[target], arr[idx]];
            return arr;
        });
    };

    // Get evaluatable teammates (self-evaluation is strictly disallowed)
    const getEvaluatableMembers = () => teamMembers.filter(m => m.id !== user?.id);

    // Delete evaluation entry (Admin full control feature)
    const handleDeleteEval = async (evalId) => {
        if (!window.confirm('Admin Action: Delete this evaluation entry?')) return;
        try {
            const { error } = await supabase.from('sprint_evaluations').delete().eq('id', evalId);
            if (error) throw error;
            loadData();
        } catch (err) {
            console.error('[SprintTracker] Delete error:', err);
            alert('Failed to delete evaluation: ' + err.message);
        }
    };

    // Calculate averaged scores for a member in a given week
    const getWeeklyAvg = (subjectId, weekNum) => {
        const weekEvals = evaluations.filter(e => e.subject_id === subjectId && e.week_number === weekNum);
        if (weekEvals.length === 0) return null;

        const total = weekEvals.reduce((sum, e) => sum + e.task_ownership + e.code_quality + e.demo_understanding + e.autonomy, 0);
        return Math.round((total / weekEvals.length) * 10) / 10;
    };

    // Calculate cumulative score for a member across all weeks
    const getCumulativeScore = (subjectId) => {
        let total = 0;
        let weeksScored = 0;
        for (let w = 1; w <= 8; w++) {
            const avg = getWeeklyAvg(subjectId, w);
            if (avg !== null) {
                total += avg;
                weeksScored++;
            }
        }
        return { total: Math.round(total * 10) / 10, weeksScored };
    };

    // Check if current user already evaluated a member for a week
    const hasEvaluated = (subjectId, weekNum) => {
        return evaluations.some(e => e.evaluator_id === user?.id && e.subject_id === subjectId && e.week_number === weekNum);
    };

    // Get the existing evaluation if it exists
    const getExistingEval = (subjectId, weekNum) => {
        return evaluations.find(e => e.evaluator_id === user?.id && e.subject_id === subjectId && e.week_number === weekNum);
    };

    // Open evaluation modal
    const openEvalModal = (member, weekNum) => {
        if (member.id === user?.id) {
            alert('Self-evaluation is not allowed.');
            return;
        }
        const existing = getExistingEval(member.id, weekNum);
        if (existing) {
            setEvalScores({
                task_ownership: existing.task_ownership,
                code_quality: existing.code_quality,
                demo_understanding: existing.demo_understanding,
                autonomy: existing.autonomy,
                notes: existing.notes || ''
            });
        } else {
            setEvalScores({ task_ownership: 5, code_quality: 5, demo_understanding: 5, autonomy: 5, notes: '' });
        }
        setEvalTarget({ member, week: weekNum });
        setShowEvalModal(true);
    };

    // Submit evaluation
    const submitEvaluation = async () => {
        if (!evalTarget || !user) return;
        setSaving(true);

        try {
            const evalData = {
                classroom_id: user.classroom_id || null,
                week_number: evalTarget.week,
                evaluator_id: user.id,
                subject_id: evalTarget.member.id,
                task_ownership: evalScores.task_ownership,
                code_quality: evalScores.code_quality,
                demo_understanding: evalScores.demo_understanding,
                autonomy: evalScores.autonomy,
                notes: evalScores.notes,
                updated_at: new Date().toISOString()
            };

            const existing = getExistingEval(evalTarget.member.id, evalTarget.week);

            if (existing) {
                const { error } = await supabase.from('sprint_evaluations').update(evalData).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('sprint_evaluations').insert(evalData);
                if (error) throw error;

                // Send notification to the evaluated person
                try {
                    await db.createNotification({
                        user_id: evalTarget.member.id,
                        title: '📊 Sprint Evaluation Received',
                        message: `${user.name || 'A teammate'} submitted a Week ${evalTarget.week} evaluation for you.`,
                        type: 'info',
                        link: '/sprint-tracker'
                    });
                } catch (notifErr) {
                    console.error('[SprintTracker] Notification error:', notifErr);
                }
            }

            setShowEvalModal(false);
            setEvalTarget(null);
            loadData();
        } catch (err) {
            console.error('[SprintTracker] Submit error:', err);
            alert('Failed to submit evaluation: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Score slider component
    const ScoreSlider = ({ label, emoji, value, onChange, description }) => (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{emoji} {label}</span>
                <span style={{
                    fontWeight: 700, fontSize: 'var(--text-lg)',
                    color: value >= 8 ? 'var(--success)' : value >= 5 ? 'var(--warning)' : 'var(--danger)',
                    minWidth: '45px', textAlign: 'right'
                }}>{value}/10</span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--space-xs)' }}>{description}</p>
            <input
                type="range"
                min="0"
                max="10"
                value={value}
                onChange={e => onChange(parseInt(e.target.value))}
                style={{
                    width: '100%', cursor: 'pointer',
                    accentColor: value >= 8 ? 'var(--success)' : value >= 5 ? 'var(--warning)' : 'var(--danger)'
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <span>0</span><span>5</span><span>10</span>
            </div>
        </div>
    );

    // Rank badge color
    const getRankStyle = (rank) => {
        if (rank === 1) return { background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1a1a1a' };
        if (rank === 2) return { background: 'linear-gradient(135deg, #C0C0C0, #808080)', color: '#1a1a1a' };
        if (rank === 3) return { background: 'linear-gradient(135deg, #CD7F32, #8B4513)', color: 'white' };
        return { background: 'var(--surface)', color: 'var(--text)' };
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    // Strict access control: If user is not an Admin and not in participantIds, show Access Restricted
    if (!isAdmin && !participantIds.has(user?.id)) {
        return (
            <div className="page-content" style={{ maxWidth: '580px', margin: '60px auto', textAlign: 'center' }}>
                <Card style={{ padding: '40px 24px', borderRadius: '24px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        <Lock size={32} />
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', color: 'var(--text)' }}>
                        Sprint Access Restricted
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '28px' }}>
                        You are not currently enrolled as an active participant in this classroom's Sprint. Contact your administrator if you need to be added to the sprint roster.
                    </p>
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </Button>
                </Card>
            </div>
        );
    }

    // Sort members by cumulative score for the leaderboard
    const rankedMembers = [...teamMembers]
        .map(m => ({ ...m, cumulative: getCumulativeScore(m.id) }))
        .sort((a, b) => b.cumulative.total - a.cumulative.total);

    const exportToCSV = () => {
        const headers = ['Rank', 'Name', 'Email', 'Total Score (out of 320)', 'Weeks Scored'];
        const rows = rankedMembers.map((m, idx) => {
            const totalScore = m.cumulative?.total ?? 0;
            const weeksScored = m.cumulative?.weeksScored ?? 0;
            return [
                idx + 1,
                `"${(m.name || 'Member').replace(/"/g, '""')}"`,
                `"${(m.email || '').replace(/"/g, '""')}"`,
                totalScore.toFixed(1),
                weeksScored
            ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Zenith_Sprint_Evaluations_Summary.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: 0 }}>
                    <Trophy size={28} style={{ color: 'var(--warning)' }} />
                    Sprint Tracker
                </h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                    {classrooms.find(c => c.id === selectedClassroomId)?.name || 'Classroom'} — 8-Week Milestone Scoreboard & Peer Evaluations
                </p>
                {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: 'var(--space-md)' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--primary-500), transparent 85%)',
                            color: 'var(--primary-400)', border: '1px solid var(--primary-500)',
                            fontSize: 'var(--text-xs)', fontWeight: 700
                        }}>
                            <Zap size={14} /> Admin Mode
                        </div>

                        {/* Classroom Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>Classroom:</span>
                            <select
                                value={selectedClassroomId}
                                onChange={(e) => setSelectedClassroomId(e.target.value)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                    color: 'var(--text)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">All Classrooms (Global View)</option>
                                {classrooms.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowParticipantModal(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Users size={14} /> Manage Sprint Roster ({teamMembers.length})
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={openTemplateModal}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Settings size={14} /> Configure Sprint Weeks ({sprintTemplate.length} wks)
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={exportToCSV}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Download size={14} /> Export CSV
                        </Button>
                    </div>
                )}
            </div>

            {/* Master Scoreboard */}
            <Card style={{ marginBottom: 'var(--space-xl)', overflow: 'visible' }}>
                <div style={{ padding: 'var(--space-lg)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: '0 0 var(--space-lg)' }}>
                        <BarChart3 size={22} />
                        Master Scoreboard
                    </h2>

                    {teamMembers.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: 'var(--space-xl) var(--space-md)',
                            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
                            border: '1px dashed var(--border)', color: 'var(--text-muted)'
                        }}>
                            <Users size={36} style={{ marginBottom: 'var(--space-xs)', opacity: 0.6 }} />
                            <h3 style={{ margin: '0 0 var(--space-xs)', color: 'var(--text)', fontSize: 'var(--text-md)', fontWeight: 700 }}>
                                No Sprint Participants Added Yet
                            </h3>
                            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                                {isAdmin 
                                    ? "Click 'Manage Sprint Roster' above to select classroom members for this sprint." 
                                    : "Your administrator hasn't added sprint participants for this classroom yet."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Podium-style leaderboard */}
                            <div className="leaderboard-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                                {rankedMembers.map((member, idx) => (
                                    <div key={member.id} style={{
                                        flex: '1 1 180px', minWidth: '140px', padding: 'var(--space-md)',
                                        borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
                                        background: 'var(--card)', textAlign: 'center',
                                        position: 'relative', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: '8px', left: '8px',
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 'var(--text-xs)', fontWeight: 800,
                                            ...getRankStyle(idx + 1)
                                        }}>
                                            #{idx + 1}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xs)', wordBreak: 'break-word' }}>
                                            {member.name || member.email?.split('@')[0]}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary-400)', marginBottom: 'var(--space-xs)' }}>
                                            {member.cumulative.total}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            / {member.cumulative.weeksScored * 40} pts ({member.cumulative.weeksScored} wks)
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Weekly breakdown table */}
                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', margin: '0 0 var(--space-xs)' }}>
                                <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: 'var(--space-sm) var(--space-xs)', textAlign: 'left', minWidth: '75px' }}>Week</th>
                                            {teamMembers.map(m => (
                                                <th key={m.id} style={{ padding: 'var(--space-sm) var(--space-xs)', textAlign: 'center', minWidth: '95px' }}>
                                                    {m.name || m.email?.split('@')[0]}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sprintTemplate.map(assignment => {
                                            return (
                                                <tr key={assignment.week} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: 'var(--space-sm) var(--space-xs)', fontWeight: 600 }}>
                                                        W{assignment.week} {assignment.is_showcase && '🃏'}
                                                    </td>
                                                    {teamMembers.map(m => {
                                                        const score = getWeeklyAvg(m.id, assignment.week);
                                                        return (
                                                            <td key={m.id} style={{ padding: 'var(--space-sm) var(--space-xs)', textAlign: 'center' }}>
                                                                {score !== null ? (
                                                                    <span style={{
                                                                        display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
                                                                        fontWeight: 700, fontSize: 'var(--text-xs)',
                                                                        background: score >= 32 ? 'color-mix(in srgb, var(--success), transparent 85%)' : score >= 20 ? 'color-mix(in srgb, var(--warning), transparent 85%)' : 'var(--surface)',
                                                                        color: score >= 32 ? 'var(--success)' : score >= 20 ? 'var(--warning)' : 'var(--text-muted)'
                                                                    }}>
                                                                        {score}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            {/* Weekly Evaluation Section */}
            <Card style={{ marginBottom: 'var(--space-xl)' }}>
                <div style={{ padding: 'var(--space-lg)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: '0 0 var(--space-lg)' }}>
                        <Star size={22} />
                        Weekly Evaluations
                    </h2>

                    {/* Week selector */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', marginBottom: 'var(--space-lg)' }}>
                        {sprintTemplate.map(week => (
                            <button
                                key={week.week}
                                onClick={() => setSelectedWeek(week.week)}
                                style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: selectedWeek === week.week ? '1px solid var(--primary-500)' : '1px solid var(--border)',
                                    background: selectedWeek === week.week ? 'var(--primary-500)' : 'var(--card)',
                                    color: selectedWeek === week.week ? '#ffffff' : 'var(--text)',
                                    cursor: 'pointer', fontWeight: selectedWeek === week.week ? 700 : 400,
                                    fontSize: 'var(--text-sm)', transition: 'all 0.15s ease'
                                }}
                            >
                                W{week.week}
                            </button>
                        ))}
                    </div>

                    {/* Selected week info with Lock status & Admin toggle */}
                    <div style={{
                        padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                        background: 'var(--card)', border: '1px solid var(--border)',
                        marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)'
                    }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-xs)' }}>
                                {sprintTemplate[selectedWeek - 1]?.is_showcase ? '🃏 ' : '📌 '}
                                Week {selectedWeek}: {sprintTemplate[selectedWeek - 1]?.title}
                            </div>
                            {sprintTemplate[selectedWeek - 1]?.description && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', lineHeight: 1.4 }}>
                                    {sprintTemplate[selectedWeek - 1].description}
                                </div>
                            )}
                            {(sprintTemplate[selectedWeek - 1]?.start_date || sprintTemplate[selectedWeek - 1]?.end_date) && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'var(--space-xs)' }}>
                                    <Calendar size={12} />
                                    {sprintTemplate[selectedWeek - 1]?.start_date
                                        ? new Date(sprintTemplate[selectedWeek - 1].start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : '—'}
                                    {' → '}
                                    {sprintTemplate[selectedWeek - 1]?.end_date
                                        ? new Date(sprintTemplate[selectedWeek - 1].end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : '—'}
                                </div>
                            )}
                            <div style={{ marginTop: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
                                <a
                                    href={sprintTemplate[selectedWeek - 1]?.resource_url || `/study-materials?tab=sprint`}
                                    target={sprintTemplate[selectedWeek - 1]?.resource_url?.startsWith('http') ? '_blank' : '_self'}
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        fontSize: 'var(--text-xs)', fontWeight: 600,
                                        color: '#3b82f6',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        padding: '4px 10px', borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(59, 130, 246, 0.25)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <BookOpen size={13} />
                                    {sprintTemplate[selectedWeek - 1]?.resource_label || 'View Sprint Vault & Resources'}
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: isWeekLocked(selectedWeek) ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isWeekLocked(selectedWeek) ? <><Lock size={13} /> Submissions Locked (Auto Schedule / Admin Lock)</> : <><Unlock size={13} /> Submissions Open</>}
                            </div>
                        </div>

                        {isAdmin && (
                            <Button
                                variant={isWeekLocked(selectedWeek) ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => handleToggleLock(selectedWeek)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                {isWeekLocked(selectedWeek) ? <><Unlock size={14} /> Admin: Unlock Week</> : <><Lock size={14} /> Admin: Lock Week</>}
                            </Button>
                        )}
                    </div>

                    {/* Evaluatable teammates */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {getEvaluatableMembers().map(member => {
                            const evaluated = hasEvaluated(member.id, selectedWeek);
                            const existingEval = getExistingEval(member.id, selectedWeek);
                            const totalScore = existingEval
                                ? existingEval.task_ownership + existingEval.code_quality + existingEval.demo_understanding + existingEval.autonomy
                                : null;

                            return (
                                <div key={member.id} className="eval-member-row" style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                                    border: evaluated ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)',
                                    borderLeft: evaluated ? '4px solid #22c55e' : '1px solid var(--border)',
                                    background: evaluated ? 'rgba(34, 197, 94, 0.08)' : 'var(--card)',
                                    flexWrap: 'wrap', gap: 'var(--space-sm)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                            background: 'rgba(59, 130, 246, 0.15)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, color: 'var(--primary-400, #60a5fa)',
                                            fontSize: 'var(--text-sm)', border: '1px solid rgba(59, 130, 246, 0.2)'
                                        }}>
                                            {(member.name || member.email)?.[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.name || member.email?.split('@')[0]}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.role === 'admin' ? '⚡ Lead' : '👤 Member'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexShrink: 0 }}>
                                        {evaluated && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                                                fontSize: 'var(--text-sm)', fontWeight: 700,
                                                color: '#4ade80'
                                            }}>
                                                <CheckCircle size={16} />
                                                {totalScore}/40
                                            </span>
                                        )}

                                        {isWeekLocked(selectedWeek) && !isAdmin ? (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <Lock size={13} /> Locked
                                            </span>
                                        ) : (
                                            <Button
                                                variant={evaluated ? 'ghost' : 'primary'}
                                                size="sm"
                                                onClick={() => openEvalModal(member, selectedWeek)}
                                            >
                                                {evaluated ? <><Edit2 size={14} /> Edit</> : <><Star size={14} /> Rate</>}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {getEvaluatableMembers().length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                            <Users size={40} style={{ marginBottom: 'var(--space-md)', opacity: 0.5 }} />
                            <p>No team members found to evaluate. Make sure your teammates are registered in Zenith.</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Weekly Details Accordion */}
            <Card>
                <div style={{ padding: 'var(--space-lg)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: '0 0 var(--space-lg)' }}>
                        <Calendar size={22} />
                        Weekly Details
                    </h2>

                    {sprintTemplate.map(week => {
                        const isExpanded = expandedWeek === week.week;
                        return (
                            <div key={week.week} style={{ marginBottom: 'var(--space-sm)' }}>
                                <button
                                    onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                                    style={{
                                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: 'var(--space-md) var(--space-lg)',
                                        background: week.is_showcase ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface)',
                                        border: week.is_showcase ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer', color: 'var(--text)', fontWeight: 600,
                                        fontSize: 'var(--text-sm)', textAlign: 'left'
                                    }}
                                >
                                    <span>{week.is_showcase ? '🃏' : '📌'} Week {week.week}: {week.title}</span>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>

                                {isExpanded && (
                                    <div style={{
                                        padding: 'var(--space-md) var(--space-lg)',
                                        border: '1px solid var(--border)', borderTop: 'none',
                                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                                        background: 'var(--card)'
                                    }}>
                                        {(week.description || week.resource_url) && (
                                            <div style={{
                                                marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)',
                                                background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {week.description && (
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: week.resource_url ? 'var(--space-xs)' : 0 }}>
                                                        {week.description}
                                                    </div>
                                                )}
                                                {week.resource_url && (
                                                    <a
                                                        href={week.resource_url}
                                                        target={week.resource_url.startsWith('http') ? '_blank' : '_self'}
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                            fontSize: 'var(--text-xs)', fontWeight: 600,
                                                            color: '#3b82f6', textDecoration: 'none'
                                                        }}
                                                    >
                                                        <BookOpen size={13} />
                                                        {week.resource_label || 'View Study Material / Resource'}
                                                        <ExternalLink size={11} />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {teamMembers.map(member => {
                                            const weekEvals = evaluations.filter(e => e.subject_id === member.id && e.week_number === week.week);
                                            const avg = getWeeklyAvg(member.id, week.week);

                                            return (
                                                <div key={member.id} style={{
                                                    padding: 'var(--space-md) 0',
                                                    borderBottom: '1px solid var(--border)'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                                        <span style={{ fontWeight: 600 }}>
                                                            {member.name || member.email?.split('@')[0]}
                                                        </span>
                                                        <span style={{ fontWeight: 700, color: avg !== null ? 'var(--primary-400)' : 'var(--text-muted)' }}>
                                                            {avg !== null ? `${avg}/40 avg` : 'Not rated'}
                                                        </span>
                                                    </div>
                                                    {weekEvals.length > 0 && (
                                                        <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                            {weekEvals.map((ev, idx) => {
                                                                const evaluator = teamMembers.find(m => m.id === ev.evaluator_id);
                                                                const total = ev.task_ownership + ev.code_quality + ev.demo_understanding + ev.autonomy;
                                                                return (
                                                                    <div key={idx} style={{ marginTop: 'var(--space-xs)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                        <span>
                                                                            Rated by {evaluator?.name || 'Unknown'}: <strong>{total}/40</strong>
                                                                            {ev.notes && <span> — "{ev.notes}"</span>}
                                                                        </span>
                                                                        {isAdmin && (
                                                                            <button
                                                                                onClick={() => handleDeleteEval(ev.id)}
                                                                                title="Admin: Delete this rating entry"
                                                                                style={{
                                                                                    background: 'none', border: 'none', color: 'var(--danger)',
                                                                                    cursor: 'pointer', padding: '2px 4px', opacity: 0.8
                                                                                }}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Evaluation Modal */}
            <Modal
                isOpen={showEvalModal}
                onClose={() => setShowEvalModal(false)}
                title={`Rate ${evalTarget?.member?.name || 'Teammate'} — Week ${evalTarget?.week}`}
                size="md"
                footer={
                    <div style={{ display: 'flex', gap: 'var(--space-md)', width: '100%', justifyContent: 'flex-end' }}>
                        <Button variant="ghost" onClick={() => setShowEvalModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={submitEvaluation} disabled={saving}>
                            {saving ? 'Saving...' : <><Send size={16} /> Submit Score</>}
                        </Button>
                    </div>
                }
            >
                <div>
                    {/* Total preview */}
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-md)',
                        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                        marginBottom: 'var(--space-lg)'
                    }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>Total Score</div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--primary-400)' }}>
                            {evalScores.task_ownership + evalScores.code_quality + evalScores.demo_understanding + evalScores.autonomy}/40
                        </div>
                    </div>

                    {RUBRIC.map(criterion => (
                        <ScoreSlider
                            key={criterion.key}
                            label={criterion.label}
                            emoji={criterion.emoji}
                            value={evalScores[criterion.key]}
                            onChange={val => setEvalScores(prev => ({ ...prev, [criterion.key]: val }))}
                            description={criterion.description}
                        />
                    ))}

                    {/* Notes */}
                    <div style={{ marginTop: 'var(--space-md)' }}>
                        <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                            📝 Notes (optional)
                        </label>
                        <textarea
                            value={evalScores.notes}
                            onChange={e => setEvalScores(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Quick feedback..."
                            rows={3}
                            style={{
                                width: '100%', padding: 'var(--space-md)',
                                borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                                background: 'var(--surface)', color: 'var(--text)',
                                resize: 'vertical', fontFamily: 'inherit', fontSize: 'var(--text-sm)',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>
            </Modal>

            {/* Manage Sprint Roster Modal */}
            <Modal
                isOpen={showParticipantModal}
                onClose={() => setShowParticipantModal(false)}
                title="⚙️ Manage Sprint Roster (Add / Remove Members)"
                size="md"
                footer={
                    <Button variant="primary" onClick={() => setShowParticipantModal(false)}>
                        Done
                    </Button>
                }
            >
                <div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                        Select classroom members to include in this Sprint. Only checked members will be displayed on the master scoreboard and peer evaluations.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {allClassroomMembers.map(member => {
                            const isAdded = participantIds.has(member.id);
                            return (
                                <div
                                    key={member.id}
                                    onClick={() => handleToggleParticipant(member.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border)', background: isAdded ? 'color-mix(in srgb, var(--primary-500), transparent 90%)' : 'var(--card)',
                                        cursor: 'pointer', transition: 'all 0.15s ease', gap: 'var(--space-sm)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                            background: isAdded ? 'var(--primary-500)' : 'var(--surface)',
                                            color: isAdded ? '#ffffff' : 'var(--text)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, fontSize: 'var(--text-sm)'
                                        }}>
                                            {(member.name || member.email)?.[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.name || member.email?.split('@')[0]}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.email} {member.role === 'admin' && '• ⚡ Lead'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ flexShrink: 0 }}>
                                        <Button
                                            variant={isAdded ? 'primary' : 'ghost'}
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleToggleParticipant(member.id); }}
                                        >
                                            {isAdded ? <><UserCheck size={14} /> In Sprint</> : <><UserPlus size={14} /> Add</>}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            {/* ─── Sprint Template Editor Modal ─── */}
            {isAdmin && (
                <Modal
                    isOpen={showTemplateModal}
                    onClose={() => setShowTemplateModal(false)}
                    title="⚙️ Configure Sprint Weeks"
                    size="lg"
                    footer={
                        <div style={{ display: 'flex', gap: 'var(--space-md)', width: '100%', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={addDraftWeek}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 16px', borderRadius: 'var(--radius-lg)',
                                    border: '1px dashed var(--primary-500)',
                                    background: 'color-mix(in srgb, var(--primary-500), transparent 90%)',
                                    color: 'var(--primary-400)', fontWeight: 600,
                                    fontSize: 'var(--text-sm)', cursor: 'pointer'
                                }}
                            >
                                <PlusCircle size={16} /> Add Week
                            </button>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
                                <Button variant="primary" onClick={saveSprintTemplate} disabled={templateSaving}>
                                    {templateSaving ? 'Saving...' : '💾 Save Template'}
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div>
                        {/* Info banner & CSV Toolbar */}
                        <div className="sprint-config-banner" style={{
                            padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                            background: 'color-mix(in srgb, var(--primary-500), transparent 90%)',
                            border: '1px solid color-mix(in srgb, var(--primary-500), transparent 60%)',
                            marginBottom: 'var(--space-md)', display: 'flex', flexWrap: 'wrap',
                            justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)'
                        }}>
                            <div>
                                <strong style={{ color: 'var(--primary-400)' }}>Classroom:</strong>{' '}
                                {classrooms.find(c => c.id === (selectedClassroomId || user?.classroom_id))?.name || 'Current Classroom'}
                            </div>

                            {/* CSV Actions Toolbar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: 'var(--text-xs)', fontWeight: 600, padding: '4px 10px',
                                    borderRadius: 'var(--radius-md)', background: 'var(--surface)',
                                    border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)'
                                }}>
                                    <Upload size={13} /> Import CSV
                                    <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
                                </label>

                                <button
                                    onClick={handleExportTemplateCSV}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: 'var(--text-xs)', fontWeight: 600, padding: '4px 10px',
                                        borderRadius: 'var(--radius-md)', background: 'var(--surface)',
                                        border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)'
                                    }}
                                >
                                    <Download size={13} /> Export CSV
                                </button>

                                <button
                                    onClick={() => setShowCsvHelp(!showCsvHelp)}
                                    title="View expected CSV format guide"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: showCsvHelp ? 'var(--primary-500)' : 'var(--surface)',
                                        color: showCsvHelp ? '#fff' : 'var(--text-muted)',
                                        border: '1px solid var(--border)', cursor: 'pointer',
                                        fontSize: 'var(--text-xs)', fontWeight: 700
                                    }}
                                >
                                    ?
                                </button>
                            </div>
                        </div>

                        {/* Expandable CSV Help Tooltip Guide */}
                        {showCsvHelp && (
                            <div className="sprint-csv-guide" style={{
                                padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                                background: 'var(--surface)', border: '1px solid var(--primary-400)',
                                marginBottom: 'var(--space-lg)', fontSize: 'var(--text-xs)', color: 'var(--text)'
                            }}>
                                <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-400)' }}>
                                        <HelpCircle size={14} /> Expected CSV Format Guide
                                    </div>
                                    <button
                                        onClick={() => {
                                            const text = `week_number,title,description,is_showcase,start_date,end_date,resource_url,resource_label\n1,Week 1: Setup & Overview,Environment setup and orientation,false,2026-08-01,2026-08-07,https://notion.so/w1,View Briefing\n2,Week 2: Frontend Architecture,Building core UI components,false,2026-08-08,2026-08-14,,\n4,Week 4: Mid Showcase,Mid-sprint project showcase demo,true,2026-08-22,2026-08-28,,`;
                                            navigator.clipboard.writeText(text);
                                            setCopiedFormat(true);
                                            setTimeout(() => setCopiedFormat(false), 2000);
                                        }}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--card)', border: '1px solid var(--border)',
                                            color: copiedFormat ? '#22c55e' : 'var(--text)',
                                            fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >
                                        {copiedFormat ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Format</>}
                                    </button>
                                </div>
                                <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                                    Upload a <code>.csv</code> file with the headers below. You can also click <strong>Export CSV</strong> above to download your current week configuration as a template!
                                </p>
                                <pre style={{
                                    background: 'var(--card)', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                    overflowX: 'auto', border: '1px solid var(--border)', fontFamily: 'monospace',
                                    fontSize: '11px', lineHeight: 1.4
                                }}>
{`week_number,title,description,is_showcase,start_date,end_date,resource_url,resource_label
1,Week 1: Setup & Overview,Environment setup and orientation,false,2026-08-01,2026-08-07,https://notion.so/w1,View Briefing
2,Week 2: Frontend Architecture,Building core UI components,false,2026-08-08,2026-08-14,,
4,Week 4: Mid Showcase,Mid-sprint project showcase demo,true,2026-08-22,2026-08-28,,`}
                                </pre>
                            </div>
                        )}

                        {/* Week rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {templateDraft.map((week, idx) => (
                                <div key={idx} style={{
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
                                    background: week.is_showcase
                                        ? 'color-mix(in srgb, var(--primary-500), transparent 94%)'
                                        : 'var(--card)',
                                    overflow: 'hidden'
                                }}>
                                    {/* Week header row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderBottom: '1px solid var(--border)',
                                        background: 'var(--surface)'
                                    }}>
                                        {/* Reorder arrows */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                onClick={() => moveDraftWeek(idx, -1)}
                                                disabled={idx === 0}
                                                title="Move up"
                                                style={{
                                                    background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                                                    color: idx === 0 ? 'var(--border)' : 'var(--text-muted)',
                                                    padding: '0 4px', lineHeight: 1
                                                }}
                                            >▲</button>
                                            <button
                                                onClick={() => moveDraftWeek(idx, 1)}
                                                disabled={idx === templateDraft.length - 1}
                                                title="Move down"
                                                style={{
                                                    background: 'none', border: 'none', cursor: idx === templateDraft.length - 1 ? 'default' : 'pointer',
                                                    color: idx === templateDraft.length - 1 ? 'var(--border)' : 'var(--text-muted)',
                                                    padding: '0 4px', lineHeight: 1
                                                }}
                                            >▼</button>
                                        </div>

                                        {/* Week badge */}
                                        <span style={{
                                            flexShrink: 0, fontWeight: 800, fontSize: 'var(--text-xs)',
                                            padding: '3px 10px', borderRadius: '20px',
                                            background: week.is_showcase ? 'var(--primary-500)' : 'var(--surface)',
                                            color: week.is_showcase ? '#fff' : 'var(--text-muted)',
                                            border: '1px solid var(--border)'
                                        }}>
                                            {week.is_showcase ? '🃏' : '📌'} W{idx + 1}
                                        </span>

                                        {/* Title input */}
                                        <input
                                            type="text"
                                            value={week.title}
                                            onChange={e => updateDraftWeek(idx, 'title', e.target.value)}
                                            placeholder={`Week ${idx + 1} title`}
                                            style={{
                                                flex: 1, padding: '6px 12px', borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)', background: 'var(--surface)',
                                                color: 'var(--text)', fontSize: 'var(--text-sm)', fontWeight: 600,
                                                minWidth: 0
                                            }}
                                        />

                                        {/* Showcase toggle */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                                            fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)',
                                            cursor: 'pointer', userSelect: 'none'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={week.is_showcase}
                                                onChange={e => updateDraftWeek(idx, 'is_showcase', e.target.checked)}
                                                style={{ accentColor: 'var(--primary-500)', width: '14px', height: '14px' }}
                                            />
                                            Showcase
                                        </label>

                                        {/* Delete button */}
                                        <button
                                            onClick={() => removeDraftWeek(idx)}
                                            title="Remove this week"
                                            style={{
                                                flexShrink: 0, background: 'none', border: 'none',
                                                color: 'var(--danger)', cursor: 'pointer',
                                                padding: '4px', borderRadius: 'var(--radius-sm)', opacity: 0.8
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    {/* Description + Dates */}
                                    <div style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        <textarea
                                            value={week.description}
                                            onChange={e => updateDraftWeek(idx, 'description', e.target.value)}
                                            placeholder="Week description / goals (optional)"
                                            rows={2}
                                            style={{
                                                width: '100%', padding: '8px 12px',
                                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                                background: 'var(--surface)', color: 'var(--text-muted)',
                                                resize: 'vertical', fontFamily: 'inherit',
                                                fontSize: 'var(--text-xs)', lineHeight: 1.5,
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                        {/* Date range + Resource Link */}
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 160px' }}>
                                                <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>Start</label>
                                                <input
                                                    type="date"
                                                    value={week.start_date || ''}
                                                    onChange={e => updateDraftWeek(idx, 'start_date', e.target.value)}
                                                    style={{
                                                        flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)', background: 'var(--surface)',
                                                        color: 'var(--text)', fontSize: 'var(--text-xs)',
                                                        minWidth: 0
                                                    }}
                                                />
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>→</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 160px' }}>
                                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>End</label>
                                                <input
                                                    type="date"
                                                    value={week.end_date || ''}
                                                    onChange={e => updateDraftWeek(idx, 'end_date', e.target.value)}
                                                    style={{
                                                        flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)', background: 'var(--surface)',
                                                        color: 'var(--text)', fontSize: 'var(--text-xs)',
                                                        minWidth: 0
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Resource Link & Label */}
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '2 1 200px' }}>
                                                <LinkIcon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                <input
                                                    type="text"
                                                    value={week.resource_url || ''}
                                                    onChange={e => updateDraftWeek(idx, 'resource_url', e.target.value)}
                                                    placeholder="Study Material / Announcement URL (e.g. /study-materials or https://...)"
                                                    style={{
                                                        flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)', background: 'var(--surface)',
                                                        color: 'var(--text)', fontSize: 'var(--text-xs)',
                                                        minWidth: 0
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 140px' }}>
                                                <input
                                                    type="text"
                                                    value={week.resource_label || ''}
                                                    onChange={e => updateDraftWeek(idx, 'resource_label', e.target.value)}
                                                    placeholder="Link Button Label (optional)"
                                                    style={{
                                                        flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border)', background: 'var(--surface)',
                                                        color: 'var(--text)', fontSize: 'var(--text-xs)',
                                                        minWidth: 0
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {templateDraft.length === 0 && (
                                <div style={{
                                    textAlign: 'center', padding: 'var(--space-xl)',
                                    color: 'var(--text-muted)', border: '1px dashed var(--border)',
                                    borderRadius: 'var(--radius-xl)'
                                }}>
                                    No weeks configured. Click <strong>Add Week</strong> to start building your sprint template.
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SprintTracker;
