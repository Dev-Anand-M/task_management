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
    Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import * as db from '../../services/database';

// Weekly assignment data for The Tarot Club
const WEEKLY_ASSIGNMENTS = [
    { week: 1, title: 'Core Storefront', assignments: { hemanth: 'UPI Settings & Bank Details', dhanushree: 'Public Catalog Layout & Grid', dev: 'Voice Input & API Routes Setup' } },
    { week: 2, title: 'Payments & i18n', assignments: { hemanth: 'Dynamic QR Generator & WhatsApp Order Link', dhanushree: '6-Language Regional Keyboard & Selector', dev: 'AI Response Parsing & Supabase DB' } },
    { week: 3, title: 'Exporters & Prices', assignments: { hemanth: 'Pricing Data Structures & API Handlers', dhanushree: 'Export Catalog UI Cards (Shopify/Amazon)', dev: 'Shopify REST Sync Endpoints' } },
    { week: 4, title: '🃏 TAROTHON #1', assignments: { hemanth: 'Innovation Pitch', dhanushree: 'Innovation Pitch', dev: 'Technical Mentoring & PR Reviews' }, isTarothon: true },
    { week: 5, title: 'Dashboards', assignments: { hemanth: 'Payment Toggles & Summary UI', dhanushree: 'Dashboard Layout & Filters', dev: 'Voice Command Interpreter Endpoint' } },
    { week: 6, title: 'Multimodal UI', assignments: { hemanth: 'Product Edit Pricing Fields', dhanushree: 'Camera Capture Modal UI', dev: 'AI Fallback Handlers (Gemini/Perplexity)' } },
    { week: 7, title: 'Landing & Polish', assignments: { hemanth: 'Payment Security Review & Setup Guide', dhanushree: 'Landing Page UI & Docs Polish', dev: 'Vercel Production Build & Deploy' } },
    { week: 8, title: '🏆 TAROTHON #2', assignments: { hemanth: 'Final Showcase Feature', dhanushree: 'Final Showcase Feature', dev: 'Final Pitch Defense & Launch Prep' }, isTarothon: true }
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
    const [evalTarget, setEvalTarget] = useState(null);
    const [evalScores, setEvalScores] = useState({ task_ownership: 5, code_quality: 5, demo_understanding: 5, autonomy: 5, notes: '' });
    const [saving, setSaving] = useState(false);
    const [expandedWeek, setExpandedWeek] = useState(null);

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

    // Check if a week is locked (manual override > automatic schedule)
    const isWeekLocked = (weekNum) => {
        if (sprintLocks[weekNum] !== undefined) {
            return sprintLocks[weekNum];
        }
        // Auto-lock schedule: future weeks are locked unless unlocked by Admin or Sunday demo
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

    // Get evaluatable teammates (Admin gets full control over all members)
    const getEvaluatableMembers = () => isAdmin ? teamMembers : teamMembers.filter(m => m.id !== user?.id);

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

    return (
        <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', margin: 0 }}>
                    <Trophy size={28} style={{ color: 'var(--warning)' }} />
                    Sprint Tracker
                </h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                    The Tarot Club — Weekly Peer Evaluations & Scoreboard
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
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
                                        {WEEKLY_ASSIGNMENTS.map(assignment => {
                                            return (
                                                <tr key={assignment.week} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: 'var(--space-sm) var(--space-xs)', fontWeight: 600 }}>
                                                        W{assignment.week} {assignment.isTarothon && '🃏'}
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
                        {WEEKLY_ASSIGNMENTS.map(week => (
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
                                {WEEKLY_ASSIGNMENTS[selectedWeek - 1]?.isTarothon ? '🃏 ' : '📌 '}
                                Week {selectedWeek}: {WEEKLY_ASSIGNMENTS[selectedWeek - 1]?.title}
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
                                <div key={member.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border)',
                                    background: evaluated ? 'var(--success-50, rgba(34,197,94,0.05))' : 'var(--card)',
                                    flexWrap: 'wrap', gap: 'var(--space-sm)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                            background: 'var(--primary-100)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, color: 'var(--primary-600)',
                                            fontSize: 'var(--text-sm)'
                                        }}>
                                            {(member.name || member.email)?.[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                                fontSize: 'var(--text-sm)', fontWeight: 600,
                                                color: 'var(--success)'
                                            }}>
                                                <CheckCircle size={16} />
                                                {totalScore}/40
                                            </span>
                                        )}

                                        {isWeekLocked(selectedWeek) && !isAdmin ? (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <Lock size={13} /> Locked until Demo
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

                    {WEEKLY_ASSIGNMENTS.map(week => {
                        const isExpanded = expandedWeek === week.week;
                        return (
                            <div key={week.week} style={{ marginBottom: 'var(--space-sm)' }}>
                                <button
                                    onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                                    style={{
                                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: 'var(--space-md) var(--space-lg)',
                                        background: week.isTarothon ? 'var(--primary-50)' : 'var(--surface)',
                                        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer', color: 'var(--text)', fontWeight: 600,
                                        fontSize: 'var(--text-sm)', textAlign: 'left'
                                    }}
                                >
                                    <span>{week.isTarothon ? '🃏' : '📌'} Week {week.week}: {week.title}</span>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>

                                {isExpanded && (
                                    <div style={{
                                        padding: 'var(--space-md) var(--space-lg)',
                                        border: '1px solid var(--border)', borderTop: 'none',
                                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                                        background: 'var(--card)'
                                    }}>
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
        </div>
    );
};

export default SprintTracker;
