// Vercel Deployment Trigger: 2026-05-03-2001
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Avatar, Modal, Input, ProgressBar } from '../../components/common';
import {
    Search,
    Filter,
    CheckCircle,
    XCircle,
    Clock,
    ExternalLink,
    MessageSquare,
    Award,
    ArrowLeft,
    RefreshCw,
    AlertTriangle,
    Check,
    X,
    Brain,
    ChevronRight,
    Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as db from '../../services/database';
import { evaluateQuizAttempt, evaluateTaskSubmission } from '../../services/aiService';
import { formatDate, formatRelativeTime, getStatusColor, EVALUATION_CRITERIA } from '../../utils/constants';
import { exportAllQuizAttemptsToXLSX, exportQuizToCSV } from '../../utils/exportQuiz';
import { useMiniReload } from '../../hooks/useMiniReload';

const EvaluationCenter = () => {
    const { type, submissionId } = useParams();
    const navigate = useNavigate();
    const [mode, setMode] = useState(type || 'tasks'); // 'tasks' or 'quizzes'
    const [submissions, setSubmissions] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [evalAbortController, setEvalAbortController] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // Safety timeout to prevent infinite loading
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.warn('[EvaluationCenter] loadData taking too long, forcing loading to false');
                    setLoading(false);
                }
            }, 10000);
            const [subs, atts] = await Promise.all([
                db.getSubmissions().catch(e => { console.error('Submissions Fetch Error:', e); return []; }),
                db.getQuizAttempts().catch(e => { console.error('Quiz Attempts Fetch Error:', e); return []; })
            ]);
            
            
            setSubmissions(subs || []);
            setQuizAttempts(atts || []);
        } catch (error) {
            console.error('[EvaluationCenter] CRITICAL: Evaluation Data Load Failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        
        // GOD COMMAND: REALTIME UPDATES
        const channel = supabase
            .channel(`evaluation-updates-${Math.random().toString(36).substring(7)}`) // Unique channel name per mount
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, (payload) => {
                loadData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, (payload) => {
                loadData();
            })
            .subscribe((status) => {
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    useMiniReload(() => loadData());

    const filteredSubmissions = submissions
        .filter(sub => {
            const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
            const matchesSearch = searchQuery === '' ||
                sub.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sub.tasks?.title?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        })
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const filteredQuizzes = quizAttempts
        .filter(att => {
            // Filter out orphaned attempts (quiz doesn't exist)
            if (!att.quizzes && !att.quiz_id) {
                console.warn('[Evaluation] Skipping attempt with no quiz reference:', att.id);
                return false;
            }
            
            const userName = att.profiles?.name || '';
            const quizTitle = att.quizzes?.title || '';
            const matchesSearch = searchQuery === '' ||
                userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                quizTitle.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesSearch;
        })
        .sort((a, b) => new Date(b.created_at || b.completed_at) - new Date(a.created_at || a.completed_at));


    if (mode === 'tasks' && submissionId) {
        return <EvaluationDetail submissionId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }

    if (mode === 'quizzes' && submissionId) {
        return <QuizReviewDetail attemptId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }

    // Handle legacy URLs or automatic routing based on type param
    if (type === 'tasks' && submissionId) {
        return <EvaluationDetail submissionId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }
    if (type === 'quizzes' && submissionId) {
        return <QuizReviewDetail attemptId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }

    if (loading && submissions.length === 0 && quizAttempts.length === 0) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg">
                <div>
                    <h2 style={{ margin: 0 }}>Evaluation Center</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Review and evaluate team progress
                    </p>
                </div>
                <div className="flex gap-sm">
                    {mode === 'quizzes' && filteredQuizzes.length > 0 && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={Download} 
                            onClick={async () => {
                                const profiles = await db.getProfiles();
                                const quizzes = await Promise.all(
                                    [...new Set(filteredQuizzes.map(a => a.quiz_id))]
                                        .map(id => db.getQuizById(id))
                                );
                                exportAllQuizAttemptsToXLSX(filteredQuizzes, quizzes.filter(Boolean), profiles);
                            }}
                        >
                            Export All
                        </Button>
                    )}
                    {mode === 'quizzes' && quizAttempts.some(a => a.metadata?.has_key_error) && (
                        <Button 
                            variant="danger" 
                            size="sm" 
                            icon={AlertTriangle} 
                            className="animate-pulse"
                            onClick={async () => {
                                const flagged = quizAttempts.filter(a => a.metadata?.has_key_error);
                                if (window.confirm(`Are you sure you want to Intercept & Re-evaluate all ${flagged.length} flagged attempts?`)) {
                                    setLoading(true);
                                    try {
                                        const { evaluateQuizAttempt, getSelectedModel } = await import('../../services/aiService');
                                        const model = getSelectedModel();
                                        
                                        for (const att of flagged) {
                                            const quiz = await db.getQuizById(att.quiz_id);
                                            if (!quiz) {
                                                console.warn(`Skipping missing quiz ID: ${att.quiz_id}`);
                                                continue;
                                            }
                                            const report = await evaluateQuizAttempt(quiz, att.answers, model);
                                            
                                            // Simple auto-update for bulk
                                            const hasKeyError = report.suggestions.some(s => s.isKeyError === true);
                                            await db.updateQuizAttempt(att.id, {
                                                metadata: { 
                                                    ...att.metadata, 
                                                    ai_evaluated: true, 
                                                    ai_report: report, 
                                                    has_key_error: hasKeyError 
                                                }
                                            });
                                        }
                                        alert('Bulk re-evaluation complete!');
                                        loadData();
                                    } catch (e) {
                                        console.error('Bulk Error:', e);
                                        alert('Some attempts failed to re-evaluate.');
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                        >
                            Intercept All Flagged
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadData} loading={loading}>
                        Refresh Data
                    </Button>
                    <div className="tabs" style={{ background: 'var(--card)', padding: '4px' }}>
                        <button
                            className={`tab ${mode === 'tasks' ? 'active' : ''}`}
                            onClick={() => {
                                setMode('tasks');
                                setFilterStatus('pending');
                            }}
                        >
                            Tasks
                        </button>
                        <button
                            className={`tab ${mode === 'quizzes' ? 'active' : ''}`}
                            onClick={() => setMode('quizzes')}
                        >
                            Quizzes
                            <Badge variant="primary" style={{ marginLeft: '6px' }}>
                                {quizAttempts.length}
                            </Badge>
                        </button>
                    </div>
                </div>
            </div>

            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <div className="flex flex-mobile-col gap-md items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <Input
                            placeholder={mode === 'tasks' ? "Search by name or task..." : "Search by name or quiz..."}
                            icon={Search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {mode === 'tasks' && (
                        <div className="tabs" style={{ width: 'auto' }}>
                            {['all', 'pending', 'approved', 'rejected'].map(status => (
                                <button
                                    key={status}
                                    className={`tab ${filterStatus === status ? 'active' : ''}`}
                                    onClick={() => setFilterStatus(status)}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                    {status === 'pending' && (
                                        <Badge variant="warning" style={{ marginLeft: '6px' }}>
                                            {submissions.filter(s => s.status === 'pending').length}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* List */}
            {mode === 'tasks' ? (
                /* Submissions List */
                filteredSubmissions.length === 0 ? (
                    <Card>
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <CheckCircle size={32} />
                            </div>
                            <h3>No submissions found</h3>
                            <p>
                                {filterStatus === 'pending'
                                    ? 'All caught up! No pending submissions to review.'
                                    : 'No submissions match your current filters.'}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {filteredSubmissions.map(sub => (
                            <Link
                                key={sub.id}
                                to={`/admin/evaluations/tasks/${sub.id}`}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card className="evaluation-card">
                                    <Avatar name={sub.profiles?.name} image={sub.profiles?.avatar_url} size="lg" />

                                    <div className="evaluation-card-content" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="flex items-center gap-sm mb-xs">
                                            <h4 style={{ margin: 0 }}>{sub.profiles?.name}</h4>
                                            <Badge variant={getStatusColor(sub.status)}>{sub.status}</Badge>
                                            {sub.is_resubmission && <Badge variant="primary">Resubmitted</Badge>}
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            color: 'var(--text-muted)',
                                            fontSize: 'var(--text-sm)'
                                        }}>
                                            {sub.tasks?.title}
                                        </p>
                                    </div>

                                    <div className="evaluation-card-meta">
                                        {sub.score !== null && sub.score !== undefined && (
                                            <div style={{
                                                fontSize: 'var(--text-lg)',
                                                fontWeight: 600,
                                                color: sub.status === 'approved' ? 'var(--success-500)' : 'var(--text-muted)'
                                            }}>
                                                {sub.score}/100
                                            </div>
                                        )}
                                        <div style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {formatRelativeTime(sub.submitted_at)}
                                        </div>
                                    </div>

                                    <ExternalLink size={20} style={{ color: 'var(--text-muted)' }} />
                                </Card>
                            </Link>
                        ))}
                    </div>
                )
            ) : (
                /* Quizzes List */
                filteredQuizzes.length === 0 ? (
                    <Card>
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Award size={32} />
                            </div>
                            <h3>No quiz attempts yet</h3>
                            <p>Students haven't completed any quizzes yet.</p>
                        </div>
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {filteredQuizzes.map(att => (
                            <Link
                                key={att.id}
                                to={`/admin/evaluations/quizzes/${att.id}`}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card className="evaluation-card">
                                    <Avatar name={att.profiles?.name} image={att.profiles?.avatar_url} size="lg" />

                                    <div className="evaluation-card-content" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="flex items-center gap-sm mb-xs">
                                            <h4 style={{ margin: 0 }}>{att.profiles?.name}</h4>
                                            <Badge variant={att.passed ? 'success' : 'error'}>
                                                {att.passed ? 'Passed' : 'Failed'}
                                            </Badge>
                                            {att.metadata?.ai_evaluated ? (
                                                <Badge variant="primary">AI Evaluated</Badge>
                                            ) : (
                                                <Badge variant="warning">🤖 AI Processing...</Badge>
                                            )}
                                            {att.metadata?.finalized ? (
                                                <Badge variant="success">✓ Finalized</Badge>
                                            ) : att.metadata?.manually_evaluated ? (
                                                <Badge variant="accent">Draft Saved</Badge>
                                            ) : null}
                                            {att.metadata?.has_key_error && (
                                                <Badge variant="error">🚩 Key Error?</Badge>
                                            )}
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            color: 'var(--text-muted)',
                                            fontSize: 'var(--text-sm)'
                                        }}>
                                            {att.quizzes?.title}
                                        </p>
                                    </div>

                                    <div className="evaluation-card-meta">
                                        <div style={{
                                            fontSize: 'var(--text-lg)',
                                            fontWeight: 600,
                                            color: att.passed ? 'var(--success-500)' : 'var(--error-500)'
                                        }}>
                                            {att.score}%
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {formatRelativeTime(att.created_at || att.completed_at)}
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Download CSV"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            try {
                                                const quiz = await db.getQuizById(att.quiz_id);
                                                if (!quiz) {
                                                    alert('Quiz data not available for export.');
                                                    return;
                                                }
                                                exportQuizToCSV(att, quiz, att.profiles?.name || 'Unknown');
                                            } catch (err) {
                                                console.error('CSV export error:', err);
                                                alert('Failed to export CSV.');
                                            }
                                        }}
                                    >
                                        <Download size={16} />
                                    </Button>
                                    <ExternalLink size={20} style={{ color: 'var(--text-muted)' }} />
                                </Card>
                            </Link>
                        ))}
                    </div>
                )
            )}


        </div>
    );
};

// Detailed evaluation view
const EvaluationDetail = ({ submissionId, onBack, onUpdate }) => {
    const [submission, setSubmission] = useState(null);
    const [score, setScore] = useState('');
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [evaluating, setEvaluating] = useState(false);

    const loadSubmission = useCallback(async () => {
        try {
            setLoading(true);

            // Safety timeout
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.warn('[EvaluationDetail] loadSubmission taking too long, forcing loading to false');
                    setLoading(false);
                }
            }, 8000);

            const sub = await db.getSubmissionById(submissionId);
            if (sub) {
                setSubmission(sub);
                setScore(sub.score?.toString() || sub.suggested_score?.toString() || '');
                setFeedback(sub.feedback || '');
            }
        } catch (error) {
            console.error('Error loading submission:', error);
        } finally {
            setLoading(false);
        }
    }, [submissionId]);

    useEffect(() => {
        loadSubmission();
    }, [loadSubmission]);

    const handleApprove = async () => {
        if (!score) return;
        setSaving(true);

        try {
            const scoreNum = parseInt(score);
            await db.updateSubmission(submissionId, {
                status: 'approved',
                score: scoreNum,
                feedback,
                evaluated_at: new Date().toISOString()
            });

                // award XP to user
                if (submission.profiles?.id) {
                    const xpEarned = Math.round((scoreNum / 100) * (submission.tasks?.points || 100));
                    const currentXP = submission.profiles.xp || 0;
                    await db.updateProfile(submission.profiles.id, { xp: currentXP + xpEarned });

                    // Notify User (In-app)
                    await db.createNotification({
                        user_id: submission.profiles.id,
                        classroom_id: submission.tasks?.classroom_id,
                        title: 'Task Approved! 🥳',
                        message: `Your submission for "${submission.tasks?.title}" was approved with a score of ${scoreNum}/100. You earned ${xpEarned} XP!`,
                        type: 'success',
                        link: `/tasks/${submission.tasks?.id}`
                    });
                }

            onUpdate();
            onBack();
        } catch (error) {
            console.error('Error approving submission:', error);
        } finally {
            setSaving(false);
        }
    };

    const [revisionDeadline, setRevisionDeadline] = useState('');

    const handleReject = async () => {
        setSaving(true);
        try {
            const scoreNum = parseInt(score) || 0;
            const updateData = {
                status: 'rejected',
                score: scoreNum,
                feedback,
                evaluated_at: new Date().toISOString()
            };

            if (revisionDeadline) {
                updateData.revision_deadline = new Date(revisionDeadline).toISOString();
            }

            await db.updateSubmission(submissionId, updateData);

                // Notify User (In-app)
                if (submission.profiles?.id) {
                    let msg = `Reviewer requested a revision for "${submission.tasks?.title}". Check feedback for details.`;
                    if (revisionDeadline) {
                        msg += ` New deadline: ${new Date(revisionDeadline).toLocaleDateString()}`;
                    }

                    await db.createNotification({
                        user_id: submission.profiles.id,
                        classroom_id: submission.tasks?.classroom_id,
                        title: 'Revision Requested 📝',
                        message: msg,
                        type: 'error',
                        link: `/tasks/${submission.tasks?.id}`
                    });
                }

            onUpdate();
            onBack();
        } catch (error) {
            console.error('Error rejecting submission:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAiReview = async () => {
        if (!submission) return;
        setEvaluating(true);
        try {
            const report = await evaluateTaskSubmission(submission.tasks, submission);
            if (report) {
                setScore(report.suggestedScore.toString());
                setFeedback(report.feedback);
                // We don't save yet, let the admin review the AI suggestion
            }
        } catch (error) {
            console.error('AI Task Review Error:', error);
            alert('Failed to get AI review. Please try again.');
        } finally {
            setEvaluating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!submission) {
        return <div>Submission not found</div>;
    }

    const autoEval = submission.auto_evaluation || {};
    const taskCriteria = submission.tasks?.criteria || [];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-mobile-col items-center gap-md mb-lg">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h2 style={{ margin: 0 }}>Evaluate Submission</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        {submission.tasks?.title}
                    </p>
                </div>
            </div>

            <div className="grid-2-1">
                {/* Left Column - Submission Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Submitter Info */}
                    <Card>
                        <div className="flex items-center gap-md">
                            <Avatar name={submission.profiles?.name} image={submission.profiles?.avatar_url} size="lg" />
                            <div>
                                <h4 style={{ margin: 0 }}>{submission.profiles?.name}</h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                    {submission.profiles?.email}
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                <Badge variant={getStatusColor(submission.status)}>
                                    {submission.status}
                                </Badge>
                                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    Submitted {formatDate(submission.submitted_at)}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Repository Link */}
                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>Repository</h4>
                        <a
                            href={submission.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                padding: 'var(--space-md)',
                                background: 'var(--card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                color: 'var(--primary-400)',
                                fontSize: 'var(--text-sm)',
                                wordBreak: 'break-all'
                            }}
                        >
                            <ExternalLink size={16} />
                            {submission.repo_url}
                        </a>
                        {submission.notes && (
                            <div style={{ marginTop: 'var(--space-md)' }}>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Submission Notes:
                                </p>
                                <p style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--card)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--text-sm)'
                                }}>
                                    {submission.notes}
                                </p>
                            </div>
                        )}
                    </Card>

                    {/* Feedback */}
                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>
                            <MessageSquare size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Your Feedback
                        </h4>
                        <Input
                            type="textarea"
                            placeholder="Provide detailed feedback for the team member..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            style={{ minHeight: '150px' }}
                        />
                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                Revision Deadline (Optional)
                            </p>
                            <Input
                                type="date"
                                value={revisionDeadline}
                                onChange={(e) => setRevisionDeadline(e.target.value)}
                            />
                        </div>
                    </Card>
                </div>

                {/* Right Column - Auto Evaluation & Scoring */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Auto Evaluation */}
                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>
                            <RefreshCw size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Auto-Evaluation
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {taskCriteria.map(criteriaId => {
                                const criteria = EVALUATION_CRITERIA.find(c => c.id === criteriaId);
                                const passed = autoEval[criteriaId];

                                return (
                                    <div
                                        key={criteriaId}
                                        className="flex items-center gap-sm"
                                        style={{
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: 'var(--card)',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: `3px solid ${passed === true ? 'var(--success-500)' : passed === false ? 'var(--error-500)' : 'var(--warning-500)'}`
                                        }}
                                    >
                                        {passed === true ? (
                                            <Check size={16} style={{ color: 'var(--success-500)' }} />
                                        ) : passed === false ? (
                                            <X size={16} style={{ color: 'var(--error-500)' }} />
                                        ) : (
                                            <AlertTriangle size={16} style={{ color: 'var(--warning-500)' }} />
                                        )}
                                        <span style={{ fontSize: 'var(--text-sm)' }}>
                                            {criteria?.label || criteriaId}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {submission.suggested_score && (
                            <div style={{
                                marginTop: 'var(--space-lg)',
                                padding: 'var(--space-md)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center'
                            }}>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                                    Suggested Score
                                </p>
                                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0, color: 'var(--primary-400)' }}>
                                    {submission.suggested_score}/100
                                </p>
                            </div>
                        )}
                    </Card>

                    {/* Final Score */}
                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>
                            <Award size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Final Score
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={Brain}
                            onClick={handleAiReview}
                            loading={evaluating}
                            style={{ width: '100%', marginBottom: 'var(--space-md)', border: '1px dashed var(--primary-300)', color: 'var(--primary-600)' }}
                        >
                            {evaluating ? 'AI Reviewing...' : '🤖 AI Assistant Review'}
                        </Button>
                        <Input
                            type="number"
                            placeholder="0-100"
                            min="0"
                            max="100"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                        />

                        {score && submission.tasks?.points && (
                            <div style={{
                                marginTop: 'var(--space-md)',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--card)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-muted)'
                            }}>
                                XP to award: <strong style={{ color: 'var(--success-500)' }}>
                                    +{Math.round((parseInt(score) / 100) * submission.tasks.points)} XP
                                </strong>
                            </div>
                        )}
                    </Card>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        <Button
                            variant="success"
                            onClick={handleApprove}
                            disabled={!score || saving}
                            loading={saving}
                            icon={CheckCircle}
                            style={{ width: '100%' }}
                        >
                            Approve & Award XP
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleReject}
                            disabled={saving}
                            icon={XCircle}
                            style={{ width: '100%' }}
                        >
                            Request Revision
                        </Button>
                    </div>
                </div>
            </div>


        </div>
    );
};

// Detailed Quiz review view
const QuizReviewDetail = ({ attemptId, onBack, onUpdate }) => {
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [overrides, setOverrides] = useState({}); // { questionIndex: boolean }
    const [aiReport, setAiReport] = useState(null);
    const [evaluating, setEvaluating] = useState(false);
    const [selectedModel, setSelectedModel] = useState('');
    const [availableModels, setAvailableModels] = useState([]);
    const [evalAbortController, setEvalAbortController] = useState(null);
    const [evalStatus, setEvalStatus] = useState(''); // 'busy', 'retrying', etc.
    const [retryCount, setRetryCount] = useState(0);
    const [manualFeedback, setManualFeedback] = useState('');

    const loadAttempt = useCallback(async () => {
        try {
            setLoading(true);

            // Safety timeout
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.warn('[QuizReviewDetail] loadAttempt taking too long, forcing loading to false');
                    setLoading(false);
                }
            }, 8000);
            const data = await db.getQuizAttempts();
            const att = data.find(a => a.id === attemptId);
            if (att) {
                // Fetch the actual quiz questions for reference
                const quiz = await db.getQuizById(att.quiz_id);
                if (!quiz) {
                    console.error('Quiz not found for attempt:', att.quiz_id);
                    setAttempt({ ...att, quiz: null, quizDeleted: true });
                } else {
                    setAttempt({ ...att, quiz });
                }
            } else {
                console.error('Attempt not found:', attemptId);
                setAttempt(null);
            }
        } catch (error) {
            console.error('Error loading quiz attempt:', error);
        } finally {
            setLoading(false);
        }
    }, [attemptId]);

    useEffect(() => {
        loadAttempt();
        
        // Load configured models
        const loadModels = async () => {
            const { AVAILABLE_MODELS, isAPIKeyConfigured, getSelectedModel } = await import('../../services/aiService');
            const configured = AVAILABLE_MODELS.filter(m => isAPIKeyConfigured(m.provider));
            setAvailableModels(configured);
            const preferredModel = configured.find(m => m.provider === 'sambanova')?.id || getSelectedModel();
            setSelectedModel(preferredModel);
        };
        loadModels();
    }, [loadAttempt]);

    // Update local state from metadata when attempt loads
    useEffect(() => {
        if (attempt?.metadata) {
            // Load AI Report if it exists
            if (attempt.metadata.ai_report && !aiReport) {
                setAiReport(attempt.metadata.ai_report);
            }
            
            // Load Overrides (Manual or AI)
            if (attempt.metadata.overrides && Object.keys(overrides).length === 0) {
                const typedOverrides = {};
                Object.entries(attempt.metadata.overrides).forEach(([k, v]) => {
                    typedOverrides[Number(k)] = v;
                });
                setOverrides(typedOverrides);
            }

            // Load manual feedback if it exists
            if (attempt.metadata.manual_feedback && !manualFeedback) {
                setManualFeedback(attempt.metadata.manual_feedback);
            }
        }
    }, [attempt, aiReport, overrides, manualFeedback]);

    const handleAiEvaluation = async () => {
        if (!attempt) return;
        
        if (!selectedModel) {
            alert('Please select an AI model first.');
            return;
        }

        const controller = new AbortController();
        setEvalAbortController(controller);
        setEvaluating(true);
        setEvalStatus('Evaluating...');
        setRetryCount(0);
        
        try {
            // Define a local interceptor for the signal to track retries if possible
            // But since evaluateQuizAttempt is a service call, we'll just handle it there
            const report = await evaluateQuizAttempt(attempt.quiz, attempt.answers, selectedModel, controller.signal, {
                onRetry: (attempt, delay) => {
                    setEvalStatus(`Busy... Retrying in ${Math.round(delay/1000)}s`);
                    setRetryCount(attempt);
                }
            });
            setAiReport(report);
            
            // Auto-apply logic
            const newOverrides = { ...overrides };
            report.suggestions.forEach(s => {
                let qIndex = Number(s.questionIndex);
                
                // If AI used 1-based indexing (Common LLM quirk), adjust to 0-based
                if (qIndex > 0 && qIndex >= attempt.quiz.questions.length) {
                    qIndex -= 1;
                }

                if (qIndex >= 0 && qIndex < attempt.quiz.questions.length) {
                    newOverrides[qIndex] = s.isCorrect;
                }
            });
            setOverrides(prev => ({ ...prev, ...newOverrides }));

            // Calculate final score with AI suggestions applied
            const finalCorrect = attempt.quiz.questions.reduce((acc, q, idx) => {
                const override = newOverrides[idx];
                const isCorrect = override !== undefined ? override : (attempt.answers[idx] === q.correctAnswer);
                return acc + (isCorrect ? 1 : 0);
            }, 0);
            const finalScore = Math.round((finalCorrect / attempt.total) * 100);

            // Check for Key Errors to flag for Admin
            const hasKeyError = report.suggestions.some(s => s.isKeyError === true);

            await db.updateQuizAttempt(attempt.id, {
                correct: finalCorrect,
                score: finalScore,
                passed: finalScore >= 70,
                metadata: { 
                    ...attempt.metadata, 
                    ai_evaluated: true, 
                    ai_report: report, 
                    model_used: selectedModel,
                    overrides: newOverrides,
                    has_key_error: hasKeyError 
                }
            });
        } catch (error) {
            // SILENCE AbortError: Don't show alert if user cancelled
            if (error.name === 'AbortError' || error.message?.includes('cancelled') || error.message?.includes('AbortError')) {
                return;
            }
            console.error('AI Eval Error:', error);
            alert('❌ AI Review Failed: ' + (error.message.includes('not configured') ? 'Please check your API keys in Settings.' : error.message));
        } finally {
            setEvaluating(false);
            setEvalAbortController(null);
            setEvalStatus('');
        }
    };

    const handleAbortEvaluation = () => {
        if (evalAbortController) {
            evalAbortController.abort();
            setEvaluating(false);
            setEvalAbortController(null);
            setEvalStatus('');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!attempt) return <div>Attempt not found</div>;
    if (!attempt.quiz) {
        return (
            <div className="animate-fade-in">
                <div className="flex items-center gap-md mb-lg">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h2 style={{ margin: 0 }}>Quiz Deleted</h2>
                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                            Original quiz: {attempt.quizzes?.title || 'Unknown'}
                        </p>
                    </div>
                </div>

                <Card style={{ padding: 'var(--space-xl)' }}>
                    <div className="empty-state">
                        <div className="empty-state-icon" style={{ color: 'var(--warning-500)', fontSize: '2rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
                        <h3>Quiz has been deleted</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            The quiz associated with this attempt has been deleted. The questions and correct answers are no longer available for review.
                        </p>

                        {/* Show basic attempt info */}
                        <Card variant="secondary" style={{ marginBottom: 'var(--space-lg)', textAlign: 'left' }}>
                            <h4 style={{ marginBottom: 'var(--space-md)' }}>Attempt Information</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                <div>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 4px' }}>Student</p>
                                    <p style={{ fontWeight: 600, margin: 0 }}>{attempt.profiles?.name || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 4px' }}>Score</p>
                                    <p style={{ fontWeight: 600, margin: 0 }}>{attempt.score}%</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 4px' }}>Status</p>
                                    <Badge variant={attempt.passed ? 'success' : 'error'}>
                                        {attempt.passed ? 'Passed' : 'Failed'}
                                    </Badge>
                                </div>
                                <div>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 4px' }}>Completed</p>
                                    <p style={{ fontWeight: 600, margin: 0 }}>{formatDate(attempt.completed_at)}</p>
                                </div>
                            </div>
                        </Card>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
                            <Button variant="secondary" onClick={onBack}>
                                Back to Evaluations
                            </Button>
                            {attempt.metadata?.finalized && (
                                <Button 
                                    variant="ghost" 
                                    icon={Download}
                                    onClick={() => {
                                        // Even without quiz questions, we can export what we have
                                        alert('Cannot export: Quiz questions are no longer available. Only basic attempt data exists.');
                                    }}
                                    disabled
                                >
                                    Export Unavailable
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between gap-md mb-lg">
                <div className="flex items-center gap-md">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h2 style={{ margin: 0 }}>Quiz Results Review</h2>
                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                            {attempt.quiz?.title}
                        </p>
                    </div>
                </div>
                
                {/* Quick Model Selector & Export */}
                <div className="flex items-center gap-sm">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={Download}
                        onClick={() => {
                            exportQuizToCSV(attempt, attempt.quiz, attempt.profiles?.name || 'Unknown');
                        }}
                    >
                        CSV
                    </Button>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Model:</span>
                    <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{ 
                            padding: '4px 8px', 
                            fontSize: 'var(--text-xs)', 
                            background: 'var(--surface)', 
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text)'
                        }}
                    >
                        {availableModels.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}: {model.name}
                            </option>
                        ))}
                        {availableModels.length === 0 && <option value="">No models configured</option>}
                    </select>
                </div>
            </div>

            <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-lg)', 
                alignItems: 'start' 
            }}>
                {/* Summary Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <Card>
                        <div className="flex justify-between items-center mb-lg">
                            <div className="flex items-center gap-md">
                                <Avatar name={attempt.profiles?.name} image={attempt.profiles?.avatar_url} size="lg" />
                                <div>
                                    <h4 style={{ margin: 0 }}>{attempt.profiles?.name}</h4>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                        {attempt.profiles?.email}
                                    </p>
                                </div>
                            </div>
                            {evaluating ? (
                                <div className="flex flex-col gap-sm">
                                    <Button 
                                        variant="warning" 
                                        size="sm"
                                        loading={true}
                                    >
                                        {evalStatus || 'AI is Reviewing...'}
                                    </Button>
                                    {evalStatus.includes('busy') && (
                                        <p style={{ fontSize: '10px', color: 'var(--warning-500)', margin: 0, textAlign: 'center', fontWeight: 600 }}>
                                            ⚠️ AI Provider is busy. Retrying...
                                        </p>
                                    )}
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={handleAbortEvaluation}
                                        style={{ color: 'var(--error-500)' }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Button 
                                    size="sm" 
                                    variant={attempt.metadata?.has_key_error ? "danger" : "warning"} 
                                    icon={RefreshCw}
                                    onClick={handleAiEvaluation}
                                    className={attempt.metadata?.has_key_error ? "animate-pulse" : ""}
                                    disabled={attempt.metadata?.finalized}
                                >
                                    {attempt.metadata?.has_key_error ? "🚨 Intercept & Resolve Flagged" : "Intercept & Re-evaluate All"}
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-sm mb-lg">
                            <div style={{ padding: 'var(--space-md)', background: 'var(--card)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0, color: attempt.passed ? 'var(--success-500)' : 'var(--error-500)' }}>
                                    {Math.round((attempt.quiz.questions.reduce((acc, q, idx) => {
                                        const userAnswer = attempt.answers[idx];
                                        const override = overrides[idx];
                                        
                                        if (q.type === 'short') {
                                            const isCorrect = override !== undefined ? override : false;
                                            return acc + (isCorrect ? 1 : 0);
                                        }
                                        // For MCQ/Boolean, overrides can still happen but usually we use userAnswer
                                        const isCorrect = override !== undefined ? override : (userAnswer === q.correctAnswer);
                                        return acc + (isCorrect ? 1 : 0);
                                    }, 0) / attempt.total) * 100)}%
                                </p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Score</p>
                            </div>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--card)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>
                                    {attempt.quiz.questions.reduce((acc, q, idx) => {
                                        const userAnswer = attempt.answers[idx];
                                        const override = overrides[idx];
                                        
                                        if (q.type === 'short') {
                                            const isCorrect = override !== undefined ? override : false;
                                            return acc + (isCorrect ? 1 : 0);
                                        }
                                        const isCorrect = override !== undefined ? override : (userAnswer === q.correctAnswer);
                                        return acc + (isCorrect ? 1 : 0);
                                    }, 0)}/{attempt.total}
                                </p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Correct</p>
                            </div>
                        </div>

                        {!attempt.metadata?.finalized ? (
                            <>
                                <Button 
                                    variant="success" 
                                    style={{ width: '100%' }} 
                                    loading={saving}
                                    onClick={async () => {
                                        setSaving(true);
                                        try {
                                            const finalCorrect = attempt.quiz.questions.reduce((acc, q, idx) => {
                                                const userAnswer = attempt.answers[idx];
                                                const override = overrides[idx];
                                                
                                                if (q.type === 'short') {
                                                    const isCorrect = override !== undefined ? override : false;
                                                    return acc + (isCorrect ? 1 : 0);
                                                }
                                                const isCorrect = override !== undefined ? override : (userAnswer === q.correctAnswer);
                                                return acc + (isCorrect ? 1 : 0);
                                            }, 0);
                                            const finalScore = Math.round((finalCorrect / attempt.total) * 100);
                                            const xpToAward = Math.round((finalCorrect / attempt.total) * (attempt.quizzes?.points || 100));

                                            // Update the saved attempt with Manual results
                                            await db.updateQuizAttempt(attempt.id, {
                                                correct: finalCorrect,
                                                score: finalScore,
                                                passed: finalScore >= 70,
                                                metadata: {
                                                    ...attempt.metadata,
                                                    manually_evaluated: true,
                                                    overrides,
                                                    manual_feedback: manualFeedback,
                                                    finalized: false,
                                                    xp_earned: xpToAward
                                                }
                                            });

                                            setSuccess(true);
                                            if (onUpdate) onUpdate(); // Real-time update parent list
                                            setTimeout(() => setSuccess(false), 3000);
                                            loadAttempt();
                                        } catch (e) {
                                            console.error('Save Error:', e);
                                            alert('Failed to save evaluation');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                >
                                    {success ? '✓ Saved Successfully!' : '💾 Save Changes (Draft)'}
                                </Button>
                                
                                <Button 
                                    variant="primary" 
                                    style={{ width: '100%' }} 
                                    loading={saving}
                                    onClick={async () => {
                                        if (!window.confirm('Finalize this evaluation? The student will be able to see their final score and this cannot be undone.')) {
                                            return;
                                        }
                                        
                                        setSaving(true);
                                        try {
                                            const finalCorrect = attempt.quiz.questions.reduce((acc, q, idx) => {
                                                const userAnswer = attempt.answers[idx];
                                                const override = overrides[idx];
                                                
                                                if (q.type === 'short') {
                                                    const isCorrect = override !== undefined ? override : false;
                                                    return acc + (isCorrect ? 1 : 0);
                                                }
                                                
                                                // Standardize for boolean and multiple choice
                                                const isCorrect = override !== undefined 
                                                    ? override 
                                                    : (q.type === 'boolean' 
                                                        ? String(userAnswer) === String(q.correctAnswer)
                                                        : userAnswer === q.correctAnswer);
                                                        
                                                return acc + (isCorrect ? 1 : 0);
                                            }, 0);
                                            const finalScore = Math.round((finalCorrect / attempt.total) * 100);
                                            const xpToAward = Math.round((finalCorrect / attempt.total) * (attempt.quizzes?.points || 100));
                                            
                                            // Update the saved attempt with Manual results AND finalize
                                            await db.updateQuizAttempt(attempt.id, {
                                                correct: finalCorrect,
                                                score: finalScore,
                                                passed: finalScore >= 70,
                                                metadata: { 
                                                    ...attempt.metadata, 
                                                    manually_evaluated: true, 
                                                    overrides, 
                                                    manual_feedback: manualFeedback,
                                                    finalized: true,
                                                    xp_earned: xpToAward
                                                }
                                            });

                                            // Update the user's profile XP
                                            await db.updateProfile(attempt.user_id, {
                                                xp: (attempt.profiles?.xp || 0) + xpToAward
                                            });

                                            // --- NOTIFY STUDENT ---
                                            await db.createNotification({
                                                user_id: attempt.user_id,
                                                title: '✅ Quiz Finalized!',
                                                message: `Your quiz "${attempt.quizzes?.title}" has been finalized! Final Score: ${finalScore}% (+${xpToAward} XP). You can now view your detailed results.`,
                                                type: 'success',
                                                link: `/quizzes/${attempt.quiz_id}`,
                                                is_read: false,
                                                created_at: new Date().toISOString()
                                            });

                                            setSuccess(true);
                                            if (onUpdate) onUpdate(); // Real-time update parent list
                                            setTimeout(() => {
                                                setSuccess(false);
                                                onBack(); // Return to list after finalization
                                            }, 2000);
                                            loadAttempt();
                                        } catch (e) {
                                            console.error('Finalize Error:', e);
                                            alert('Failed to finalize evaluation');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                >
                                    {success ? '✓ Finalized!' : '🎯 Finalize & Release to Student'}
                                </Button>
                            </>
                        ) : (
                            <div style={{ 
                                padding: 'var(--space-md)', 
                                background: 'rgba(34, 197, 94, 0.1)', 
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                textAlign: 'center',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--success-600)',
                                fontWeight: 600
                            }}>
                                ✓ This evaluation has been finalized. Student can view their results.
                            </div>
                        )}


                    </Card>

                    {aiReport && (
                        <Card style={{ border: '1px solid #a78bfa', background: 'rgba(167, 139, 250, 0.05)' }}>
                            <div className="flex items-center gap-sm mb-md">
                                <Brain size={20} color="#8b5cf6" />
                                <h4 style={{ margin: 0, color: '#7c3aed' }}>AI Mentor Report</h4>
                                <Badge style={{ marginLeft: 'auto', background: '#7c3aed' }}>Grade: {aiReport.overallGrade}</Badge>
                            </div>
                            <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
                                {aiReport.summary}
                            </p>
                            <div style={{ padding: 'var(--space-sm)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed #a78bfa' }}>
                                <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: '#7c3aed', marginBottom: '4px' }}>MENTOR NOTE:</p>
                                <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>{aiReport.mentorNote}</p>
                            </div>
                        </Card>
                    )}

                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>
                            <MessageSquare size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Your Manual Feedback
                        </h4>
                        <Input
                            type="textarea"
                            placeholder="Add your own assessment or notes for the student..."
                            value={manualFeedback}
                            onChange={(e) => setManualFeedback(e.target.value)}
                            style={{ minHeight: '120px' }}
                            disabled={attempt.metadata?.finalized}
                        />
                    </Card>
                </div>

                {/* Answers Review */}
                <Card>
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <h4 style={{ marginBottom: 'var(--space-sm)' }}>Question Review</h4>
                        <div style={{ 
                            display: 'flex', 
                            gap: 'var(--space-md)', 
                            fontSize: 'var(--text-xs)', 
                            color: 'var(--text-muted)',
                            padding: 'var(--space-sm)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '12px', height: '12px', background: 'var(--success-500)', borderRadius: '2px' }}></div>
                                Correct
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '12px', height: '12px', background: 'var(--error-500)', borderRadius: '2px' }}></div>
                                Wrong
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div>
                                AI Suggestion
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        {attempt.quiz?.questions.map((q, index) => {
                            const userAnswer = attempt.answers[index];
                            // Check manual override first, then AI suggestion, then basic match
                            const isCorrect = overrides[index] !== undefined 
                                ? overrides[index] 
                                : (q.type === 'short' ? false : (q.type === 'boolean' ? String(userAnswer) === String(q.correctAnswer) : userAnswer === q.correctAnswer));
                            
                            const aiSuggestion = aiReport?.suggestions?.find(s => Number(s.questionIndex) === Number(index));
                            
                            return (
                                <div key={index} style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--card)',
                                    borderRadius: 'var(--radius-lg)',
                                    borderLeft: `4px solid ${
                                        aiSuggestion && overrides[index] !== undefined 
                                            ? '#3b82f6' // Blue for AI-suggested changes
                                            : isCorrect ? 'var(--success-500)' : 'var(--error-500)'
                                    }`
                                }}>
                                    {aiSuggestion?.isKeyError && (
                                        <div style={{ 
                                            padding: 'var(--space-sm)', 
                                            background: 'var(--error-50)', 
                                            border: '1px solid var(--error-200)', 
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: 'var(--space-sm)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                                        }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <AlertTriangle size={18} color="var(--error-500)" />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error-700)', fontWeight: 700 }}>
                                                            AI ALERT: This Question Key may be wrong!
                                                        </span>
                                                        {aiSuggestion.isCorrect && (
                                                            <span style={{ 
                                                                fontSize: '10px', 
                                                                background: 'var(--success-500)', 
                                                                color: 'white', 
                                                                padding: '2px 8px', 
                                                                borderRadius: '999px',
                                                                fontWeight: 800,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                                            }}>
                                                                Student Deserves Points! 🏆
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'var(--error-600)' }}>
                                                        {aiSuggestion.feedback}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button 
                                                size="xs" 
                                                variant="success" 
                                                icon={CheckCircle}
                                                className="animate-bounce-subtle"
                                                onClick={() => {
                                                    const newValue = aiSuggestion.isCorrect !== undefined ? aiSuggestion.isCorrect : true;
                                                    setOverrides(prev => ({ 
                                                        ...prev, 
                                                        [index]: newValue 
                                                    }));
                                                }}
                                                disabled={attempt.metadata?.finalized}
                                            >
                                                {aiSuggestion.isCorrect ? "Apply AI Fix & Award Point" : "Apply AI Fix"}
                                            </Button>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start" style={{ marginBottom: 'var(--space-md)' }}>
                                        <p style={{ fontWeight: 600, margin: 0, flex: 1 }}>
                                            {index + 1}. {q.question}
                                        </p>
                                        <div style={{ 
                                            marginLeft: 'var(--space-md)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: '4px'
                                        }}>
                                            {(() => {
                                                const originalCorrect = q.type === 'short' 
                                                    ? false 
                                                    : (q.type === 'boolean' 
                                                        ? String(attempt.answers[index]) === String(q.correctAnswer)
                                                        : attempt.answers[index] === q.correctAnswer);
                                                const currentCorrect = overrides[index] !== undefined ? overrides[index] : originalCorrect;
                                                const hasChange = originalCorrect !== currentCorrect;

                                                return (
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        padding: '6px 12px',
                                                        background: 'var(--surface)',
                                                        borderRadius: 'var(--radius-lg)',
                                                        border: '1px solid var(--border)'
                                                    }}>
                                                        {/* Original */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Org</span>
                                                            <span style={{ 
                                                                color: originalCorrect ? 'var(--success-500)' : 'var(--error-500)', 
                                                                fontWeight: 800,
                                                                fontSize: 'var(--text-lg)'
                                                            }}>
                                                                {originalCorrect ? '+1' : '-1'}
                                                            </span>
                                                        </div>

                                                        {hasChange && (
                                                            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                                <ChevronRight size={16} />
                                                            </div>
                                                        )}

                                                        {/* Current/AI */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>New</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                {aiSuggestion && !hasChange && (
                                                                    <Brain size={12} color="#3b82f6" />
                                                                )}
                                                                <span style={{ 
                                                                    color: currentCorrect ? 'var(--success-500)' : 'var(--error-500)', 
                                                                    fontWeight: 800,
                                                                    fontSize: 'var(--text-lg)'
                                                                }}>
                                                                    {currentCorrect ? '+1' : '-1'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            
                                            {/* Manual Override Buttons */}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <Button 
                                                    size="xs" 
                                                    variant={overrides[index] === true ? "success" : "ghost"}
                                                    onClick={() => setOverrides(prev => ({ ...prev, [index]: true }))}
                                                    title="Manually Award Point"
                                                    disabled={attempt.metadata?.finalized}
                                                >
                                                    <Check size={14} />
                                                </Button>
                                                <Button 
                                                    size="xs" 
                                                    variant={overrides[index] === false ? "danger" : "ghost"}
                                                    onClick={() => setOverrides(prev => ({ ...prev, [index]: false }))}
                                                    title="Manually Deduct Point"
                                                    disabled={attempt.metadata?.finalized}
                                                >
                                                    <X size={14} />
                                                </Button>
                                                {overrides[index] !== undefined && (
                                                    <Button 
                                                        size="xs" 
                                                        variant="ghost"
                                                        onClick={() => {
                                                            const newOverrides = { ...overrides };
                                                            delete newOverrides[index];
                                                            setOverrides(newOverrides);
                                                        }}
                                                        title="Reset to Original"
                                                        disabled={attempt.metadata?.finalized}
                                                    >
                                                        <RefreshCw size={12} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                        {q.type === 'multiple' ? (
                                            q.options.map((opt, optIndex) => {
                                                // State variables for clarity
                                                const isCorrectKey = q.type === 'boolean' 
                                                    ? String(optIndex) === String(q.correctAnswer)
                                                    : optIndex === q.correctAnswer;
                                                const isStudentChoice = q.type === 'boolean'
                                                    ? String(optIndex) === String(userAnswer)
                                                    : optIndex === userAnswer;
                                                const aiRecommendsCorrect = aiSuggestion?.isCorrect && isStudentChoice;
                                                
                                                return (
                                                    <div key={optIndex} style={{
                                                        fontSize: 'var(--text-sm)',
                                                        padding: '6px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        marginBottom: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        background: isStudentChoice ? 'var(--surface)' : 'transparent',
                                                        border: isStudentChoice ? '1px solid var(--border)' : '1px solid transparent'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', minWidth: '80px', gap: '4px' }}>
                                                            {isCorrectKey && (
                                                                <Badge size="xs" variant="success" style={{ fontSize: '8px' }}>KEY</Badge>
                                                            )}
                                                            {isStudentChoice && (
                                                                <Badge size="xs" variant="primary" style={{ fontSize: '8px' }}>CHOICE</Badge>
                                                            )}
                                                        </div>

                                                        <span style={{ 
                                                            flex: 1,
                                                            color: isCorrectKey ? 'var(--success-500)' : (isStudentChoice && !aiRecommendsCorrect ? 'var(--error-500)' : 'var(--text-main)'),
                                                            fontWeight: (isCorrectKey || isStudentChoice) ? 600 : 400
                                                        }}>
                                                            {opt}
                                                        </span>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {/* Original System Status */}
                                                            <div style={{ display: 'flex', alignItems: 'center', color: isCorrectKey ? 'var(--success-500)' : (isStudentChoice ? 'var(--error-500)' : 'var(--text-muted)') }}>
                                                                {isCorrectKey ? <Check size={14} /> : (isStudentChoice ? <X size={14} /> : null)}
                                                            </div>

                                                            {/* AI Transition */}
                                                            {aiRecommendsCorrect && (
                                                                <>
                                                                    <div style={{ color: 'var(--text-muted)' }}>➔</div>
                                                                    <div style={{ 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        gap: '4px', 
                                                                        color: '#3b82f6',
                                                                        fontWeight: 700,
                                                                        padding: '2px 8px',
                                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                                        borderRadius: '4px'
                                                                    }}>
                                                                        <Check size={14} />
                                                                        <span style={{ fontSize: '10px' }}>AI VALIDATED</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : q.type === 'boolean' ? (
                                            <div style={{ fontSize: 'var(--text-sm)' }}>
                                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {q.correctAnswer === true && <Badge size="xs" variant="success" style={{ fontSize: '8px' }}>KEY</Badge>}
                                                        <span style={{ color: q.correctAnswer === true ? 'var(--success-500)' : 'var(--text-muted)', fontWeight: q.correctAnswer === true ? 600 : 400 }}>True</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {q.correctAnswer === false && <Badge size="xs" variant="success" style={{ fontSize: '8px' }}>KEY</Badge>}
                                                        <span style={{ color: q.correctAnswer === false ? 'var(--success-500)' : 'var(--text-muted)', fontWeight: q.correctAnswer === false ? 600 : 400 }}>False</span>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ 
                                                    padding: '12px', 
                                                    background: 'var(--surface)', 
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Badge size="xs" variant="primary">STUDENT CHOICE</Badge>
                                                        <span style={{ fontWeight: 600 }}>{userAnswer === true ? 'True' : 'False'}</span>
                                                        {isCorrect ? <Check size={16} color="var(--success-500)" /> : <X size={16} color="var(--error-500)" />}
                                                    </div>

                                                    {aiSuggestion?.isCorrect && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ color: 'var(--text-muted)' }}>➔</div>
                                                            <div style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '6px',
                                                                color: '#3b82f6',
                                                                fontWeight: 700,
                                                                padding: '4px 10px',
                                                                background: 'rgba(59, 130, 246, 0.1)',
                                                                borderRadius: '6px'
                                                            }}>
                                                                <Brain size={14} />
                                                                <span>AI CORRECTED</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 'var(--text-sm)' }}>
                                                <div style={{ padding: 'var(--space-sm)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 'var(--space-sm)' }}>
                                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Expected Answer:</p>
                                                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--success-500)' }}>{q.correctAnswer}</p>
                                                </div>
                                                <div style={{ padding: 'var(--space-sm)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: `1px solid ${isCorrect ? 'var(--success-500)' : 'var(--error-500)'}` }}>
                                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Student Answer:</p>
                                                    <p style={{ margin: 0, fontWeight: 600 }}>{userAnswer || '(No answer)'}</p>
                                                </div>
                                                
                                                    {/* AI Badge & Glow logic */}
                                                    {(() => {
                                                        const suggestion = aiReport?.suggestions?.find(s => Number(s.questionIndex) === Number(index));
                                                        const aiIsCorrect = suggestion?.isCorrect;
                                                        
                                                        return (
                                                            <div className="flex flex-mobile-col gap-sm mt-md w-full">
                                                                <div className="flex gap-sm w-full">
                                                                    <Button 
                                                                        size="md" 
                                                                        variant={
                                                                            (overrides[index] === true || overrides[index.toString()] === true) 
                                                                                ? (aiIsCorrect === true ? 'primary' : 'success')
                                                                                : 'secondary'
                                                                        }
                                                                        style={{ 
                                                                            flex: 1,
                                                                            minHeight: '48px',
                                                                            background: (overrides[index] === true || overrides[index.toString()] === true) 
                                                                                ? (aiIsCorrect === true ? '#3b82f6' : 'var(--success-500)')
                                                                                : '',
                                                                            color: (overrides[index] === true || overrides[index.toString()] === true) ? 'white' : ''
                                                                        }}
                                                                        onClick={() => setOverrides(prev => ({ ...prev, [index]: true }))}
                                                                        icon={Check}
                                                                    >
                                                                        Correct {aiIsCorrect === true && '(AI)'}
                                                                    </Button>
                                                                    <Button 
                                                                        size="md" 
                                                                        variant={
                                                                            (overrides[index] === false || overrides[index.toString()] === false) 
                                                                                ? (aiIsCorrect === false ? 'primary' : 'danger')
                                                                                : 'secondary'
                                                                        }
                                                                        style={{ 
                                                                            flex: 1,
                                                                            minHeight: '48px',
                                                                            background: (overrides[index] === false || overrides[index.toString()] === false) 
                                                                                ? (aiIsCorrect === false ? '#3b82f6' : 'var(--error-500)')
                                                                                : '',
                                                                            color: (overrides[index] === false || overrides[index.toString()] === false) ? 'white' : ''
                                                                        }}
                                                                        onClick={() => setOverrides(prev => ({ ...prev, [index]: false }))}
                                                                        icon={X}
                                                                    >
                                                                        Wrong {aiIsCorrect === false && '(AI)'}
                                                                    </Button>
                                                                </div>

                                                                {suggestion && (
                                                                    <Badge 
                                                                        variant="outline"
                                                                        style={{ 
                                                                            borderColor: '#3b82f6',
                                                                            color: '#3b82f6',
                                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '4px 8px',
                                                                            fontWeight: 600
                                                                        }}
                                                                    >
                                                                        <Brain size={12} />
                                                                        AI: {aiIsCorrect ? '✓ Correct' : '✗ Wrong'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                {aiReport && aiReport.suggestions.find(s => Number(s.questionIndex) === Number(index)) && (
                                                    <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'rgba(167, 139, 250, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                                                        <div className="flex items-center gap-xs mb-xs">
                                                            <Brain size={12} color="#8b5cf6" />
                                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#7c3aed' }}>AI SUGGESTION</span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-main)' }}>
                                                            {aiReport.suggestions.find(s => Number(s.questionIndex) === Number(index)).feedback}
                                                        </p>
                                                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                            Tip: {aiReport.suggestions.find(s => Number(s.questionIndex) === Number(index)).improvementTip}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default EvaluationCenter;
