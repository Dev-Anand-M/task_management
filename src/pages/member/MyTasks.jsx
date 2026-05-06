import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Modal, Input } from '../../components/common';
import {
    Search,
    Filter,
    Clock,
    Award,
    Calendar,
    ExternalLink,
    ArrowLeft,
    Send,
    CheckCircle,
    AlertCircle,
    FileText,
    Upload,
    Globe,
    Palette,
    File
} from 'lucide-react';
import * as db from '../../services/database';
import {
    formatDate,
    getDifficultyColor,
    getStatusColor,
    TASK_CATEGORIES,
    EVALUATION_CRITERIA
} from '../../utils/constants';

const MyTasks = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            const [allTasks, mySubs] = await Promise.all([
                db.getTasks(),
                db.getSubmissionsByUser(user.id)
            ]);

            const myTasks = allTasks.filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
            setTasks(myTasks);
            setSubmissions(mySubs);
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getTaskStatus = (taskId) => {
        const sub = submissions.find(s => s.task_id === taskId);
        if (!sub) return 'not-started';
        return sub.status;
    };

    const filteredTasks = tasks.filter(task => {
        const status = getTaskStatus(task.id);
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'pending' && (status === 'not-started' || status === 'pending')) ||
            (filterStatus === 'completed' && status === 'approved') ||
            (filterStatus === 'rejected' && status === 'rejected');
        return matchesSearch && matchesCategory && matchesStatus;
    });

    if (taskId) {
        return <TaskDetail taskId={taskId} onBack={() => navigate('/tasks')} onUpdate={loadData} />;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Filters */}
            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <Input
                            placeholder="Search tasks..."
                            icon={Search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        className="input select"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{ width: 'auto' }}
                    >
                        <option value="all">All Categories</option>
                        {TASK_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div className="tabs" style={{ width: 'auto' }}>
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'pending', label: 'To Do' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'rejected', label: 'Revise' }
                        ].map(status => (
                            <button
                                key={status.value}
                                className={`tab ${filterStatus === status.value ? 'active' : ''}`}
                                onClick={() => setFilterStatus(status.value)}
                            >
                                {status.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Tasks Grid */}
            {filteredTasks.length === 0 ? (
                <Card>
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <FileText size={32} />
                        </div>
                        <h3>No tasks found</h3>
                        <p>No tasks match your current filters.</p>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-3 grid-3-mobile-1">
                    {filteredTasks.map(task => {
                        const status = getTaskStatus(task.id);
                        const submission = submissions.find(s => s.task_id === task.id);

                        return (
                            <Link
                                key={task.id}
                                to={`/tasks/${task.id}`}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card style={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                    cursor: 'pointer'
                                }}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <Badge variant={getDifficultyColor(task.difficulty)}>
                                                {task.difficulty}
                                            </Badge>
                                            <Badge variant="primary" style={{ marginLeft: '8px' }}>
                                                {task.category}
                                            </Badge>
                                        </div>
                                        <Badge variant={status === 'not-started' ? 'warning' : getStatusColor(status)}>
                                            {status === 'not-started' ? 'To Do' : status}
                                        </Badge>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ marginBottom: '4px' }}>{task.title}</h4>
                                        <p style={{
                                            fontSize: 'var(--text-sm)',
                                            color: 'var(--text-muted)',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {task.description}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center" style={{
                                        paddingTop: 'var(--space-md)',
                                        borderTop: '1px solid var(--border)'
                                    }}>
                                        <div className="flex gap-md" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            <span className="flex items-center gap-xs">
                                                <Award size={14} /> {task.points} pts
                                            </span>
                                            {task.deadline && (
                                                <span className="flex items-center gap-xs">
                                                    <Clock size={14} /> {formatDate(task.deadline)}
                                                </span>
                                            )}
                                        </div>
                                        {submission?.score && (
                                            <span style={{
                                                fontWeight: 600,
                                                color: submission.score >= 80 ? 'var(--success-500)' :
                                                    submission.score >= 50 ? 'var(--warning-500)' : 'var(--error-500)'
                                            }}>
                                                {submission.score}/100
                                            </span>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}

        </div>
    );
};

// Task Detail Component
const TaskDetail = ({ taskId, onBack, onUpdate }) => {
    const { user } = useAuth();
    const [task, setTask] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [repoUrl, setRepoUrl] = useState('');
    const [liveDemoUrl, setLiveDemoUrl] = useState('');
    const [fileUpload, setFileUpload] = useState('');
    const [designFiles, setDesignFiles] = useState('');
    const [documentation, setDocumentation] = useState('');
    const [otherDeliverable, setOtherDeliverable] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const loadTask = useCallback(async () => {
        try {
            setLoading(true);
            const [taskData, submissionsData] = await Promise.all([
                db.getTaskById(taskId),
                db.getSubmissionsByUser(user.id)
            ]);

            setTask(taskData);

            const mySub = submissionsData.find(s => s.task_id === taskId);
            setSubmission(mySub);

            if (mySub) {
                setRepoUrl(mySub.repo_url || '');
                setLiveDemoUrl(mySub.live_demo_url || '');
                setFileUpload(mySub.file_upload || '');
                setDesignFiles(mySub.design_files || '');
                setDocumentation(mySub.documentation || '');
                setNotes(mySub.notes || '');
                // 'otherHelper' isn't saved separately, so we can't easily restore it separate from notes
                // unless we parse it out. For simplicity, we leave it empty on edit, 
                // or assume user updates 'notes'.
            }
        } catch (error) {
            console.error('Error loading task:', error);
        } finally {
            setLoading(false);
        }
    }, [taskId, user.id]);

    useEffect(() => {
        loadTask();
    }, [loadTask]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            // Simulate auto-evaluation
            const autoEval = {};
            task.criteria?.forEach(criteriaId => {
                const criteria = EVALUATION_CRITERIA.find(c => c.id === criteriaId);
                if (criteria?.auto) {
                    autoEval[criteriaId] = Math.random() > 0.3;
                } else {
                    autoEval[criteriaId] = null;
                }
            });

            const passedCount = Object.values(autoEval).filter(v => v === true).length;
            const totalCriteria = Object.keys(autoEval).length;
            const suggestedScore = totalCriteria > 0
                ? Math.round((passedCount / totalCriteria) * 100)
                : 75;

            // Combine notes with other deliverable if present
            let finalNotes = notes;
            if (otherDeliverable) {
                finalNotes = `[Other Deliverable]: ${otherDeliverable}\n\n${notes}`;
            }

            // Build submission data
            const baseData = {
                repo_url: repoUrl,
                live_demo_url: liveDemoUrl,
                file_upload: fileUpload,
                design_files: designFiles,
                documentation: documentation,
                notes: finalNotes,
                status: 'pending',
                auto_evaluation: autoEval,
                suggested_score: suggestedScore,
                submitted_at: new Date().toISOString(),
                is_resubmission: submission?.status === 'rejected' || submission?.is_resubmission === true
            };

            let savedSubmission;
            if (submission) {
                // For updates, we don't include task_id or user_id
                savedSubmission = await db.updateSubmission(submission.id, baseData);
            } else {
                // For new submissions, include FKs
                savedSubmission = await db.createSubmission({
                    ...baseData,
                    task_id: taskId,
                    user_id: user.id
                });
            }

            // Notify Admins
            const targetClassroom = user.classroom_id || task.classroom_id;
            if (targetClassroom) {
                await db.notifyAdmins(targetClassroom, {
                    title: submission?.status === 'rejected' ? 'Task Resubmitted' : 'New Submission',
                    message: `${user.name} submitted "${task.title}" for review.`,
                    type: 'info',
                    link: `/admin/evaluations/${savedSubmission.id}`
                });
            }

            setShowSubmitModal(false);
            onUpdate();
            await loadTask();
        } catch (error) {
            console.error('Error submitting task:', error);
            setError(error.message || 'Failed to submit task');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!task) {
        return <div>Task not found</div>;
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex-mobile-col flex items-center justify-between gap-md mb-lg" style={{ flexWrap: 'wrap' }}>
                <div className="flex items-center gap-md" style={{ minWidth: 0, flex: 1 }}>
                    <Button variant="ghost" size="icon" onClick={onBack} style={{ flexShrink: 0 }}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-sm mb-xs" style={{ flexWrap: 'wrap' }}>
                            <Badge variant={getDifficultyColor(task.difficulty)}>{task.difficulty}</Badge>
                            <Badge variant="primary">{task.category}</Badge>
                            {submission && (
                                <Badge variant={getStatusColor(submission.status)}>
                                    {submission.status === 'pending' && submission.is_resubmission
                                        ? 'Resubmitted'
                                        : submission.status}
                                </Badge>
                            )}
                        </div>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', wordBreak: 'break-word' }}>{task.title}</h2>
                    </div>
                </div>
                {(() => {
                    const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
                    const isRejected = submission?.status === 'rejected';

                    // Check revision deadline if rejected
                    let canSubmit = false;

                    if (isRejected && submission.revision_deadline) {
                        const isRevDeadlinePassed = new Date(submission.revision_deadline) < new Date();
                        // Allow if revision deadline not passed
                        canSubmit = !isRevDeadlinePassed;
                    } else if (isRejected) {
                        // If no specific deadline set for revision, always allow (fallback)
                        canSubmit = true;
                    } else if (!submission) {
                        // First attempt
                        canSubmit = !isDeadlinePassed;
                    } else {
                        // Pending/Approved - standard logic
                        canSubmit = !isDeadlinePassed && submission.status !== 'approved';
                    }

                    if (!canSubmit) return null;

                    return (
                        <div className="mobile-full-width">
                            <Button icon={Send} onClick={() => setShowSubmitModal(true)} style={{ width: '100%' }}>
                                {!submission ? 'Submit Task' : submission.status === 'rejected' ? 'Resubmit' : 'Update Submission'}
                            </Button>
                        </div>
                    );
                })()}
            </div>

            <div className="grid-2-1 dashboard-grid">
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Description */}
                    <Card>
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>Description</h3>
                        <p style={{
                            color: 'var(--text-muted)',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {task.description}
                        </p>
                    </Card>

                    {/* Criteria */}
                    {task.criteria?.length > 0 && (
                        <Card>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>Requirements</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {task.criteria.map(criteriaId => {
                                    const criteriaDef = EVALUATION_CRITERIA.find(c => c.id === criteriaId);
                                    const label = criteriaDef?.label || criteriaId;
                                    const evalResult = submission?.auto_evaluation?.[criteriaId];

                                    return (
                                        <div
                                            key={criteriaId}
                                            className="flex items-center gap-sm"
                                            style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'var(--card)',
                                                borderRadius: 'var(--radius-md)'
                                            }}
                                        >
                                            {evalResult === true ? (
                                                <CheckCircle size={18} style={{ color: 'var(--success-500)' }} />
                                            ) : evalResult === false ? (
                                                <AlertCircle size={18} style={{ color: 'var(--error-500)' }} />
                                            ) : (
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    border: '2px solid var(--border)',
                                                    borderRadius: '50%'
                                                }} />
                                            )}
                                            <span>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Feedback */}
                    {submission?.feedback && (
                        <Card style={{
                            borderLeft: '4px solid var(--primary-500)',
                            background: 'rgba(99, 102, 241, 0.05)'
                        }}>
                            <h3 style={{ marginBottom: 'var(--space-md)' }}>Feedback from Reviewer</h3>
                            <p style={{
                                color: 'var(--text)',
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap'
                            }}>
                                {submission.feedback}
                            </p>
                        </Card>
                    )}
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {/* Task Info */}
                    <Card>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>Task Details</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div className="flex items-center gap-md">
                                <Award size={20} style={{ color: 'var(--primary-400)' }} />
                                <div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        Points
                                    </p>
                                    <p style={{ margin: 0, fontWeight: 600 }}>{task.points} XP</p>
                                </div>
                            </div>
                            {task.deadline && (
                                <div className="flex items-center gap-md">
                                    <Calendar size={20} style={{ color: 'var(--warning-500)' }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            Deadline
                                        </p>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{formatDate(task.deadline)}</p>
                                    </div>
                                </div>
                            )}
                            {submission?.status === 'rejected' && submission.revision_deadline && (
                                <div className="flex items-center gap-md">
                                    <Clock size={20} style={{ color: 'var(--error-500)' }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            Revision Due
                                        </p>
                                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--error-500)' }}>
                                            {formatDate(submission.revision_deadline)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Submission Status */}
                    {submission && (
                        <Card>
                            <h4 style={{ marginBottom: 'var(--space-md)' }}>Your Submission</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                <div>
                                    <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        Repository
                                    </p>
                                    <a
                                        href={submission.repo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-xs"
                                        style={{
                                            color: 'var(--primary-400)',
                                            fontSize: 'var(--text-sm)',
                                            wordBreak: 'break-all'
                                        }}
                                    >
                                        <ExternalLink size={14} />
                                        {submission.repo_url}
                                    </a>
                                </div>
                                {submission.notes && (
                                    <div>
                                        <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            Notes
                                        </p>
                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{submission.notes}</p>
                                    </div>
                                )}
                                {submission.score !== null && (
                                    <div style={{
                                        padding: 'var(--space-md)',
                                        background: submission.status === 'approved'
                                            ? 'rgba(16, 185, 129, 0.1)'
                                            : 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        textAlign: 'center'
                                    }}>
                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            Score
                                        </p>
                                        <p style={{
                                            margin: 0,
                                            fontSize: 'var(--text-2xl)',
                                            fontWeight: 700,
                                            color: submission.status === 'approved' ? 'var(--success-500)' : 'var(--error-500)'
                                        }}>
                                            {submission.score}/100
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Submit Modal */}
            <Modal
                isOpen={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                title={!submission ? 'Submit Task' : submission.status === 'rejected' ? 'Resubmit Task' : 'Edit Submission'}
                size="lg"
            >
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {/* Show deliverable fields based on task requirements */}
                        {task?.deliverable_types?.includes('repo_url') && (
                            <Input
                                label="Repository URL"
                                placeholder="https://github.com/username/repo"
                                icon={ExternalLink}
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                required={task.deliverable_types.includes('repo_url')}
                            />
                        )}

                        {task?.deliverable_types?.includes('live_demo') && (
                            <Input
                                label="Live Demo URL"
                                placeholder="https://your-demo-url.com"
                                icon={Globe}
                                value={liveDemoUrl}
                                onChange={(e) => setLiveDemoUrl(e.target.value)}
                                required={task.deliverable_types.includes('live_demo')}
                            />
                        )}

                        {task?.deliverable_types?.includes('file_upload') && (
                            <Input
                                label="File Upload URL/Link"
                                placeholder="Link to your uploaded files (Google Drive, Dropbox, etc.)"
                                icon={Upload}
                                value={fileUpload}
                                onChange={(e) => setFileUpload(e.target.value)}
                                required={task.deliverable_types.includes('file_upload')}
                            />
                        )}

                        {task?.deliverable_types?.includes('design_file') && (
                            <Input
                                label="Design Files URL"
                                placeholder="Link to design files (Figma, Sketch, etc.)"
                                icon={Palette}
                                value={designFiles}
                                onChange={(e) => setDesignFiles(e.target.value)}
                                required={task.deliverable_types.includes('design_file')}
                            />
                        )}

                        {task?.deliverable_types?.includes('documentation') && (
                            <Input
                                label="Documentation URL"
                                placeholder="Link to documentation (Notion, Google Docs, etc.)"
                                icon={File}
                                value={documentation}
                                onChange={(e) => setDocumentation(e.target.value)}
                                required={task.deliverable_types.includes('documentation')}
                            />
                        )}

                        {task?.deliverable_types?.includes('other') && (
                            <Input
                                label="Other Deliverable"
                                placeholder="Provide the requested deliverable (URL or info)"
                                value={otherDeliverable}
                                onChange={(e) => setOtherDeliverable(e.target.value)}
                                required={task.deliverable_types.includes('other')}
                            />
                        )}

                        <Input
                            type="textarea"
                            label="Additional Notes"
                            placeholder="Any additional notes about your submission..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />

                        {task?.deliverable_types && (
                            <div style={{
                                padding: 'var(--space-sm)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--primary-600)'
                            }}>
                                <strong>Required deliverables:</strong> {task.deliverable_types.map(type => {
                                    const typeMap = {
                                        'repo_url': 'Repository URL',
                                        'live_demo': 'Live Demo',
                                        'file_upload': 'File Upload',
                                        'design_file': 'Design Files',
                                        'documentation': 'Documentation',
                                        'other': 'Other'
                                    };
                                    return typeMap[type] || type;
                                }).join(', ')}
                            </div>
                        )}
                        {error && (
                            <div style={{
                                padding: 'var(--space-sm)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--error-500)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)'
                            }}>
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowSubmitModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={submitting} icon={Send}>
                            {!submission ? 'Submit for Review' : 'Update Submission'}
                        </Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default MyTasks;
