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
    Brain
} from 'lucide-react';
import * as db from '../../services/database';
import { evaluateQuizAttempt } from '../../services/aiService';
import { formatDate, formatRelativeTime, getStatusColor, EVALUATION_CRITERIA } from '../../utils/constants';

const EvaluationCenter = () => {
    const { type, submissionId } = useParams();
    const navigate = useNavigate();
    const [mode, setMode] = useState(type || 'tasks'); // 'tasks' or 'quizzes'
    const [submissions, setSubmissions] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('Admin Fetching Evaluation Data...');
            const [subs, atts] = await Promise.all([
                db.getSubmissions(),
                db.getQuizAttempts()
            ]);
            
            console.log('Submissions found:', subs?.length);
            console.log('Quiz attempts found:', atts?.length);
            
            setSubmissions(subs || []);
            setQuizAttempts(atts || []);
        } catch (error) {
            console.error('CRITICAL: Evaluation Data Load Failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
            const userName = att.profiles?.name || '';
            const quizTitle = att.quizzes?.title || '';
            const matchesSearch = searchQuery === '' ||
                userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                quizTitle.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
        .sort((a, b) => new Date(b.created_at || b.completed_at) - new Date(a.created_at || a.completed_at));

    console.log('Evaluation Data:', { mode, submissions: submissions.length, quizAttempts: quizAttempts.length });

    if (mode === 'tasks' && submissionId) {
        return <EvaluationDetail submissionId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }

    if (mode === 'quizzes' && submissionId) {
        return <QuizReviewDetail attemptId={submissionId} onBack={() => navigate('/admin/evaluations')} />;
    }

    // Handle legacy URLs or automatic routing based on type param
    if (type === 'tasks' && submissionId) {
        return <EvaluationDetail submissionId={submissionId} onBack={() => navigate('/admin/evaluations')} onUpdate={loadData} />;
    }
    if (type === 'quizzes' && submissionId) {
        return <QuizReviewDetail attemptId={submissionId} onBack={() => navigate('/admin/evaluations')} />;
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
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h2 style={{ margin: 0 }}>Evaluation Center</h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Review and evaluate team progress
                    </p>
                </div>
                <div className="flex gap-sm">
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
                <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
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
                                <Card style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-lg)',
                                    padding: 'var(--space-lg)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)'
                                }}>
                                    <Avatar name={sub.profiles?.name} size="lg" />

                                    <div style={{ flex: 1, minWidth: 0 }}>
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

                                    <div style={{ textAlign: 'right' }}>
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
                                <Card style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-lg)',
                                    padding: 'var(--space-lg)',
                                    cursor: 'pointer'
                                }}>
                                    <Avatar name={att.profiles?.name} size="lg" />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="flex items-center gap-sm mb-xs">
                                            <h4 style={{ margin: 0 }}>{att.profiles?.name}</h4>
                                            <Badge variant={att.passed ? 'success' : 'error'}>
                                                {att.passed ? 'Passed' : 'Failed'}
                                            </Badge>
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            color: 'var(--text-muted)',
                                            fontSize: 'var(--text-sm)'
                                        }}>
                                            {att.quizzes?.title}
                                        </p>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
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

                                    <ExternalLink size={20} style={{ color: 'var(--text-muted)' }} />
                                </Card>
                            </Link>
                        ))}
                    </div>
                )
            )}

            <style>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
      `}</style>
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

    const loadSubmission = useCallback(async () => {
        try {
            setLoading(true);
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

            // Award XP to user
            if (submission.profiles?.id) {
                const xpEarned = Math.round((scoreNum / 100) * (submission.tasks?.points || 100));
                const currentXP = submission.profiles.xp || 0;
                await db.updateProfile(submission.profiles.id, { xp: currentXP + xpEarned });

                // Notify User
                await db.createNotification({
                    user_id: submission.profiles.id,
                    classroom_id: submission.tasks?.classroom_id,
                    title: 'Task Approved! \u0026 XP Awarded',
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

            // Notify User
            if (submission.profiles?.id) {
                let msg = `Reviewer requested a revision for "${submission.tasks?.title}". Check feedback for details.`;
                if (revisionDeadline) {
                    msg += ` New deadline: ${new Date(revisionDeadline).toLocaleDateString()}`;
                }

                await db.createNotification({
                    user_id: submission.profiles.id,
                    classroom_id: submission.tasks?.classroom_id,
                    title: 'Revision Requested',
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
            <div className="flex items-center gap-md mb-lg">
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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-lg)' }}>
                {/* Left Column - Submission Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Submitter Info */}
                    <Card>
                        <div className="flex items-center gap-md">
                            <Avatar name={submission.profiles?.name} size="lg" />
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

            <style>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 2fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </div>
    );
};

// Detailed Quiz review view
const QuizReviewDetail = ({ attemptId, onBack }) => {
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [overrides, setOverrides] = useState({}); // { questionIndex: boolean }
    const [saving, setSaving] = useState(false);
    const [aiReport, setAiReport] = useState(null);
    const [evaluating, setEvaluating] = useState(false);
    const [selectedModel, setSelectedModel] = useState('');
    const [availableModels, setAvailableModels] = useState([]);

    const loadAttempt = useCallback(async () => {
        try {
            setLoading(true);
            const data = await db.getQuizAttempts();
            const att = data.find(a => a.id === attemptId);
            if (att) {
                // Fetch the actual quiz questions for reference
                const quiz = await db.getQuizById(att.quiz_id);
                setAttempt({ ...att, quiz });
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
            setSelectedModel(getSelectedModel());
        };
        loadModels();
    }, [loadAttempt]);

    // Update local aiReport if one exists in metadata
    useEffect(() => {
        if (attempt?.metadata?.ai_report && !aiReport) {
            setAiReport(attempt.metadata.ai_report);
            if (attempt.metadata.overrides) {
                // Ensure keys are numbers for consistency
                const typedOverrides = {};
                Object.entries(attempt.metadata.overrides).forEach(([k, v]) => {
                    typedOverrides[Number(k)] = v;
                });
                setOverrides(typedOverrides);
            }
        }
    }, [attempt, aiReport]);

    const handleAiEvaluation = async () => {
        if (!attempt) return;
        
        if (!selectedModel) {
            alert('Please select an AI model first.');
            return;
        }

        setEvaluating(true);
        try {
            const report = await evaluateQuizAttempt(attempt.quiz, attempt.answers, selectedModel);
            setAiReport(report);
            
            // Auto-apply suggestions with 'Safety Net' logic and 0/1 base handling
            const newOverrides = { ...overrides };
            report.suggestions.forEach(s => {
                let qIndex = Number(s.questionIndex);
                
                // If AI used 1-based indexing (Common LLM quirk), adjust to 0-based
                // We check if qIndex exists in attempt.quiz.questions. 
                // If qIndex is 1 and questions[1] doesn't exist but questions[0] does, it's likely 1-based.
                // Or simply, if qIndex > 0 and qIndex === attempt.quiz.questions.length, it's 1-based.
                if (qIndex > 0 && qIndex >= attempt.quiz.questions.length) {
                    qIndex -= 1;
                }

                const q = attempt.quiz.questions[qIndex];
                const userAnswer = attempt.answers[qIndex];
                
                if (q) {
                    if (q.type === 'short') {
                        newOverrides[qIndex] = s.isCorrect;
                    } else {
                        const isLocallyCorrect = userAnswer === q.correctAnswer;
                        if (!isLocallyCorrect) {
                            newOverrides[qIndex] = s.isCorrect;
                        }
                    }
                }
            });
            
            console.log('Final Overrides to set:', newOverrides);
            setOverrides(prev => ({ ...prev, ...newOverrides }));

            // PERSIST to Database immediately so it's not lost
            const finalCorrect = attempt.quiz.questions.reduce((acc, q, idx) => {
                const userAnswer = attempt.answers[idx];
                const override = newOverrides[idx];
                
                if (q.type === 'short') {
                    const isCorrect = override !== undefined ? override : false;
                    return acc + (isCorrect ? 1 : 0);
                }
                // MCQ/Boolean: AI suggestions are ignored for the final mark calculation
                // but admins can still manually override if they REALLY want to via the UI
                const isCorrect = override !== undefined ? override : (userAnswer === q.correctAnswer);
                return acc + (isCorrect ? 1 : 0);
            }, 0);
            const finalScore = Math.round((finalCorrect / attempt.total) * 100);

            await db.updateQuizAttempt(attempt.id, {
                correct: finalCorrect,
                score: finalScore,
                passed: finalScore >= 70,
                metadata: { 
                    ...attempt.metadata, 
                    ai_evaluated: true, 
                    ai_report: report, 
                    model_used: selectedModel,
                    overrides: newOverrides 
                }
            });
        } catch (error) {
            console.error('AI Eval Error:', error);
            alert('❌ AI Review Failed: ' + (error.message.includes('not configured') ? 'Please check your API keys in Settings.' : error.message));
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

    if (!attempt) return <div>Attempt not found</div>;

    return (
        <div className="animate-fade-in">
            <div className="flex items-center gap-md mb-lg">
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-lg)' }}>
                {/* Summary Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    <Card>
                        <div className="flex items-center gap-md mb-lg">
                            <Avatar name={attempt.profiles?.name} size="lg" />
                            <div>
                                <h4 style={{ margin: 0 }}>{attempt.profiles?.name}</h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                    {attempt.profiles?.email}
                                </p>
                            </div>
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

                        {Object.keys(overrides).length > 0 && (
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
                                        
                                        await db.updateQuizAttempt(attempt.id, {
                                            correct: finalCorrect,
                                            score: finalScore,
                                            passed: finalScore >= 70,
                                            metadata: { ...attempt.metadata, manually_evaluated: true, overrides }
                                        });
                                        alert('Evaluation saved! Score updated.');
                                        onBack();
                                    } catch (e) {
                                        alert('Error saving evaluation: ' + e.message);
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Save Manual Evaluation
                            </Button>
                        )}

                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Select AI Evaluator
                                </label>
                                <select 
                                    value={selectedModel} 
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface)',
                                        color: 'var(--text-main)',
                                        fontSize: 'var(--text-sm)',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="" disabled>Select a model...</option>
                                    {availableModels.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                                    {availableModels.length === 0 && (
                                        <option value="" disabled>No AI configured (Check Settings)</option>
                                    )}
                                </select>
                            </div>

                            <Button
                                variant="primary"
                                style={{ width: '100%', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', borderColor: 'transparent' }}
                                onClick={handleAiEvaluation}
                                loading={evaluating}
                                icon={Brain}
                                disabled={availableModels.length === 0}
                            >
                                {aiReport ? 'Re-run AI Review' : 'Run Smart AI Review'}
                            </Button>
                        </div>
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
                </div>

                {/* Answers Review */}
                <Card>
                    <h4 style={{ marginBottom: 'var(--space-lg)' }}>Question Review</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        {attempt.quiz?.questions.map((q, index) => {
                            const userAnswer = attempt.answers[index];
                            const isCorrect = q.type === 'boolean' 
                                ? userAnswer === q.correctAnswer
                                : userAnswer === q.correctAnswer;
                            
                            return (
                                <div key={index} style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--card)',
                                    borderRadius: 'var(--radius-lg)',
                                    borderLeft: `4px solid ${isCorrect ? 'var(--success-500)' : 'var(--error-500)'}`
                                }}>
                                    <p style={{ fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                                        {index + 1}. {q.question}
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                        {q.type === 'multiple' ? (
                                            q.options.map((opt, optIndex) => (
                                                <div key={optIndex} style={{
                                                    fontSize: 'var(--text-sm)',
                                                    color: optIndex === q.correctAnswer ? 'var(--success-500)' : optIndex === userAnswer ? 'var(--error-500)' : 'var(--text-muted)',
                                                    fontWeight: (optIndex === q.correctAnswer || optIndex === userAnswer) ? 600 : 400,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}>
                                                    {optIndex === q.correctAnswer && <Check size={14} />}
                                                    {optIndex === userAnswer && !isCorrect && <X size={14} />}
                                                    {opt}
                                                </div>
                                            ))
                                        ) : q.type === 'boolean' ? (
                                            <div style={{ fontSize: 'var(--text-sm)' }}>
                                                <span style={{ color: q.correctAnswer === true ? 'var(--success-500)' : 'var(--text-muted)' }}>True</span> / 
                                                <span style={{ color: q.correctAnswer === false ? 'var(--success-500)' : 'var(--text-muted)' }}> False</span>
                                                <p style={{ marginTop: '8px', color: isCorrect ? 'var(--success-500)' : 'var(--error-500)', fontWeight: 600 }}>
                                                    Student Choice: {userAnswer === true ? 'True' : userAnswer === false ? 'False' : 'No Answer'}
                                                </p>
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
                                                            <div className="flex items-center gap-sm mt-md w-full">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={(overrides[index] === true || overrides[index.toString()] === true) ? 'success' : 'secondary'}
                                                                    style={{ 
                                                                        flex: 1,
                                                                        background: (overrides[index] === true || overrides[index.toString()] === true) ? 'var(--success-500)' : '',
                                                                        color: (overrides[index] === true || overrides[index.toString()] === true) ? 'white' : ''
                                                                    }}
                                                                    onClick={() => setOverrides(prev => ({ ...prev, [index]: true }))}
                                                                    icon={Check}
                                                                >
                                                                    Mark Correct
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={(overrides[index] === false || overrides[index.toString()] === false) ? 'danger' : 'secondary'}
                                                                    style={{ 
                                                                        flex: 1,
                                                                        background: (overrides[index] === false || overrides[index.toString()] === false) ? 'var(--error-500)' : '',
                                                                        color: (overrides[index] === false || overrides[index.toString()] === false) ? 'white' : ''
                                                                    }}
                                                                    onClick={() => setOverrides(prev => ({ ...prev, [index]: false }))}
                                                                    icon={X}
                                                                >
                                                                    Mark Wrong
                                                                </Button>

                                                                {suggestion && (
                                                                    <Badge 
                                                                        variant="outline"
                                                                        style={{ 
                                                                            borderColor: aiIsCorrect ? 'var(--success-500)' : 'var(--error-500)',
                                                                            color: aiIsCorrect ? 'var(--success-600)' : 'var(--error-600)',
                                                                            background: aiIsCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '4px 8px'
                                                                        }}
                                                                    >
                                                                        <Brain size={12} />
                                                                        AI Suggests {aiIsCorrect ? 'Correct' : 'Wrong'}
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
