import { useState, useEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Avatar } from '../../components/common';
import {
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    Users,
    Calendar,
    Award,
    MoreVertical,
    Eye,
    Key,
    Clock
} from 'lucide-react';
import * as db from '../../services/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    formatDate,
    TASK_CATEGORIES,
    DIFFICULTY_LEVELS,
    EVALUATION_CRITERIA,
    getDifficultyColor
} from '../../utils/constants';

const TaskManager = () => {
    const { user } = useAuth();
    const location = useLocation();
    const { taskId } = useParams(); // If configured in routes as /tasks/:taskId
    const navigate = useNavigate();

    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        categories: ['Frontend'],
        difficulty: 'medium',
        points: 100,
        start_date: '',
        deadline: '',
        assigned_to: [],
        criteria: [],
        deliverable_types: ['repo_url'],
        is_global: false,
        assignment_type: 'everyone'
    });

    const [currentUserProfile, setCurrentUserProfile] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    // Effect to handle URL-based modal opening
    useEffect(() => {
        if (!loading && tasks.length > 0) {
            if (location.pathname.endsWith('/new')) {
                openCreateModal();
            } else if (taskId) {
                const taskToEdit = tasks.find(t => t.id == taskId);
                if (taskToEdit) {
                    openEditModal(taskToEdit);
                }
            }
        } else if (!loading && location.pathname.endsWith('/new')) {
            // Even if no tasks exist, we should allow creating new one
            openCreateModal();
        }
    }, [location.pathname, taskId, loading, tasks]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch everything independently to avoid one failure blocking all
            const [tasksResult, membersResult, submissionsResult] = await Promise.allSettled([
                db.getTasks(),
                db.getMembers(),
                db.getSubmissions()
            ]);

            // Get current user profile for filtering
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setCurrentUserProfile(profile);
            }

            if (tasksResult.status === 'fulfilled') {
                setTasks(tasksResult.value);
            } else {
                console.error('Failed to load tasks:', tasksResult.reason);
                alert('Error loading tasks: ' + (tasksResult.reason?.message || 'Unknown error'));
            }

            if (membersResult.status === 'fulfilled') {
                setMembers(membersResult.value);
            } else {
                console.error('Failed to load members:', membersResult.reason);
            }

            if (submissionsResult.status === 'fulfilled') {
                setSubmissions(submissionsResult.value);
            } else {
                console.error('Failed to load submissions:', submissionsResult.reason);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            categories: ['Frontend'],
            difficulty: 'medium',
            points: 100,
            start_date: '',
            deadline: '',
            assigned_to: [],
            criteria: [],
            deliverable_types: ['repo_url'],
            is_global: false,
            assignment_type: 'everyone'
        });
    };

    const openCreateModal = () => {
        resetForm();
        setEditingTask(null);
        setShowCreateModal(true);
    };

    const openEditModal = (task) => {
        setFormData({
            title: task.title,
            description: task.description || '',
            categories: task.categories && task.categories.length > 0
                ? task.categories
                : (Array.isArray(task.category) ? task.category : [task.category || 'Frontend']),
            difficulty: task.difficulty,
            points: task.points,
            start_date: task.start_date?.split('T')[0] || '',
            deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
            assigned_to: task.assigned_to || [],
            criteria: task.criteria || [],
            deliverable_types: task.deliverable_types || ['repo_url'],
            is_global: task.is_global || false,
            assignment_type: task.assignment_type || (task.assigned_to?.length > 0 ? 'specific' : 'everyone')
        });
        setEditingTask(task);
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingTask(null);
        resetForm();
        navigate('/admin/tasks');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        const taskData = {
            title: formData.title,
            description: formData.description,
            categories: formData.categories,
            category: formData.categories[0] || 'General',
            difficulty: formData.difficulty,
            points: DIFFICULTY_LEVELS.find(d => d.value === formData.difficulty)?.points || 100,
            start_date: formData.start_date ? new Date(formData.start_date).toISOString() : new Date().toISOString(),
            deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
            assigned_to: formData.assignment_type === 'specific' ? formData.assigned_to : [],
            criteria: formData.criteria,
            deliverable_types: formData.deliverable_types,
            status: 'active',
            created_by: user?.id,
            classroom_id: formData.is_global ? null : user?.classroom_id,
            is_global: formData.is_global,
            assignment_type: formData.assignment_type
        };

        try {
            let result;
            if (editingTask) {
                result = await db.updateTask(editingTask.id, taskData);
            } else {
                result = await db.createTask(taskData);
            }

            // --- ONE SIGNAL NOTIFICATION + IN-APP NOTIFICATION ---
            try {
                // Determine who to notify
                let targetMemberIds = [];
                if (taskData.assignment_type === 'everyone') {
                    targetMemberIds = members
                        .filter(m => taskData.is_global || m.classroom_id === taskData.classroom_id)
                        .filter(m => m.id !== user?.id) // Exclude admin who created the task
                        .map(m => m.id);
                } else {
                    targetMemberIds = (taskData.assigned_to || []).filter(id => id !== user?.id); // Exclude admin
                }

                // Send notifications to each assigned member (excluding the admin who assigned it)
                const notifyPromises = targetMemberIds.map(async (memberId) => {
                    // 1. Create in-app notification
                    await db.createNotification({
                        user_id: memberId,
                        classroom_id: taskData.classroom_id,
                        title: editingTask ? 'Task Updated 📝' : 'New Task Assigned 🚀',
                        message: `${taskData.title} has been ${editingTask ? 'updated' : 'assigned to you'}.`,
                        type: 'task',
                        link: `/tasks/${editingTask ? editingTask.id : (result?.[0]?.id || '')}`
                    });
                });

                await Promise.allSettled(notifyPromises);
            } catch (notifyError) {
                console.error('Failed to send notifications:', notifyError);
                // Don't block the main flow if notifications fail
            }
            // -------------------------------
            await loadData();
            closeModal();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Failed to save task: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (taskId) => {
        try {
            await db.deleteTask(taskId);
            await loadData();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting task:', error);
            alert(`Failed to delete task: ${error.message}`);
        }
    };

    const handlePostpone = async (e, task) => {
        e.stopPropagation();
        const days = prompt('How many days do you want to start extending the deadline by?', '3');
        if (!days || isNaN(days)) return;

        setSaving(true); // Re-using saving state for loading indication
        try {
            const currentDeadline = task.deadline ? new Date(task.deadline) : new Date();
            const newDeadline = new Date(currentDeadline);
            newDeadline.setDate(newDeadline.getDate() + parseInt(days));

            const taskData = {
                deadline: newDeadline.toISOString()
            };

            await db.updateTask(task.id, taskData);
            await loadData();
            alert(`Task deadline extended by ${days} days.`);
        } catch (error) {
            console.error('Error postponing task:', error);
            alert('Failed to postpone task: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleCategory = (category) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.includes(category)
                ? prev.categories.filter(c => c !== category)
                : [...prev.categories, category]
        }));
    };

    const toggleDeliverableType = (type) => {
        setFormData(prev => ({
            ...prev,
            deliverable_types: prev.deliverable_types.includes(type)
                ? prev.deliverable_types.filter(t => t !== type)
                : [...prev.deliverable_types, type]
        }));
    };

    const toggleAssignment = (userId) => {
        setFormData(prev => ({
            ...prev,
            assigned_to: prev.assigned_to.includes(userId)
                ? prev.assigned_to.filter(id => id !== userId)
                : [...prev.assigned_to, userId]
        }));
    };

    const toggleCriteria = (criteriaId) => {
        setFormData(prev => ({
            ...prev,
            criteria: prev.criteria.includes(criteriaId)
                ? prev.criteria.filter(id => id !== criteriaId)
                : [...prev.criteria, criteriaId]
        }));
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' ||
            (task.categories ? task.categories.includes(filterCategory) : task.category === filterCategory);
        return matchesSearch && matchesCategory;
    });

    if (loading) {
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
                    <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Manage and assign tasks to your team
                    </p>
                </div>
                <Button icon={Plus} onClick={() => navigate('/admin/tasks/new')}>
                    Create Task
                </Button>
            </div>

            {/* Filters */}
            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <div className="flex flex-mobile-col gap-md items-center" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <Input
                            placeholder="Search tasks..."
                            icon={Search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <Filter size={18} style={{ color: 'var(--text-muted)' }} />
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
                    </div>
                </div>
            </Card>

            {/* Tasks Grid */}
            {filteredTasks.length === 0 ? (
                <Card>
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Plus size={32} />
                        </div>
                        <h3>No tasks found</h3>
                        <p>Create your first task to start assigning work to your team.</p>
                        <Button icon={Plus} onClick={() => navigate('/admin/tasks/new')}>
                            Create Task
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-3 grid-3-mobile-1">
                    {filteredTasks.map(task => {
                        const assignedMembers = task.assigned_to?.map(id =>
                            members.find(m => m.id === id)
                        ).filter(Boolean) || [];
                        const taskSubmissions = submissions.filter(s => s.task_id === task.id);
                        const pendingCount = taskSubmissions.filter(s => s.status === 'pending').length;

                        return (
                            <Card
                                key={task.id}
                                onClick={() => navigate(`/admin/tasks/${task.id}`)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                className="task-card-hover"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant={getDifficultyColor(task.difficulty)}>
                                            {task.difficulty}
                                        </Badge>
                                        {(task.categories || (Array.isArray(task.category) ? task.category : [task.category])).map((cat, index) => (
                                            <Badge key={`${cat}-${index}`} variant="primary" style={{ marginLeft: '4px' }}>
                                                {cat}
                                            </Badge>
                                        ))}
                                        {task.is_global && (
                                            <Badge variant="accent" style={{ marginLeft: '4px' }}>Global</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-xs" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Postpone Deadline"
                                            onClick={(e) => handlePostpone(e, task)}
                                        >
                                            <Clock size={16} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => navigate(`/admin/tasks/${task.id}`)}
                                        >
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteConfirm(task)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Title & Description */}
                                <div>
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

                                {/* Stats */}
                                <div className="flex gap-lg" style={{ fontSize: 'var(--text-sm)' }}>
                                    <div className="flex items-center gap-xs" style={{ color: 'var(--text-muted)' }}>
                                        <Award size={16} />
                                        {task.points} pts
                                    </div>
                                    {task.deadline && (
                                        <div className="flex items-center gap-xs" style={{ color: 'var(--text-muted)' }}>
                                            <Calendar size={16} />
                                            Due: {formatDate(task.deadline)}
                                        </div>
                                    )}
                                </div>

                                {/* Assigned Members */}
                                <div
                                    className="flex justify-between items-center"
                                    style={{
                                        paddingTop: 'var(--space-md)',
                                        borderTop: '1px solid var(--border)'
                                    }}
                                >
                                    <div className="flex items-center">
                                        <div style={{ display: 'flex', marginRight: 'var(--space-sm)' }}>
                                            {task.assignment_type === 'everyone' ? (
                                                <Badge variant="secondary">Everyone</Badge>
                                            ) : (
                                                assignedMembers.slice(0, 3).map((member, i) => (
                                                    <div
                                                        key={member.id}
                                                        style={{
                                                            marginLeft: i > 0 ? '-8px' : 0,
                                                            position: 'relative',
                                                            zIndex: 3 - i
                                                        }}
                                                    >
                                                        <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {task.assignment_type === 'specific' && assignedMembers.length > 3 && (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                +{assignedMembers.length - 3} more
                                            </span>
                                        )}
                                        {task.assignment_type === 'specific' && assignedMembers.length === 0 && (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                Not assigned
                                            </span>
                                        )}
                                    </div>
                                    {pendingCount > 0 && (
                                        <Badge variant="warning">
                                            {pendingCount} pending
                                        </Badge>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={closeModal}
                title={editingTask ? 'Edit Task' : 'Create New Task'}
                size="lg"
            >
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <Input
                            label="Task Title"
                            placeholder="e.g., Create a Responsive Login Page"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />

                        <Input
                            type="textarea"
                            label="Description"
                            placeholder="Describe the task requirements, expectations, and any resources..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />

                        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="input-group">
                                <label className="input-label">Difficulty</label>
                                <select
                                    className="input select"
                                    value={formData.difficulty}
                                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    {DIFFICULTY_LEVELS.map(level => (
                                        <option key={level.value} value={level.value}>
                                            {level.label} ({level.points} pts)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="input-group">
                            <label className="input-label">Categories (select all that apply)</label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                gap: 'var(--space-sm)'
                            }}>
                                {TASK_CATEGORIES.map(category => (
                                    <div
                                        key={category}
                                        onClick={() => toggleCategory(category)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: 'var(--space-sm)',
                                            background: formData.categories.includes(category)
                                                ? 'rgba(99, 102, 241, 0.1)'
                                                : 'var(--card)',
                                            border: `2px solid ${formData.categories.includes(category) ? 'var(--primary-500)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <div className={`checkbox ${formData.categories.includes(category) ? 'checked' : ''}`}>
                                            {formData.categories.includes(category) && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 'var(--text-sm)' }}>{category}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Date Fields */}
                        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <Input
                                type="date"
                                label="Start Date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            />
                            <Input
                                type="datetime-local"
                                label="Deadline"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                        </div>

                        {/* Assignment Mode */}
                        <div className="input-group">
                            <label className="input-label">Target Audience</label>
                            <div className="flex gap-md">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_global: false })}
                                    className={`btn ${!formData.is_global ? 'btn-primary' : 'btn-secondary'} flex-1`}
                                >
                                    Current Classroom
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_global: true })}
                                    className={`btn ${formData.is_global ? 'btn-primary' : 'btn-secondary'} flex-1`}
                                >
                                    All Classrooms (Global)
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Assignment Type</label>
                            <div className="flex gap-md">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, assignment_type: 'everyone' })}
                                    className={`btn ${formData.assignment_type === 'everyone' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                                >
                                    Assign to Everyone
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, assignment_type: 'specific' })}
                                    className={`btn ${formData.assignment_type === 'specific' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                                >
                                    Specific Members
                                </button>
                            </div>
                        </div>

                        {/* Assign Members - only show if specific */}
                        {formData.assignment_type === 'specific' && (
                            <div className="input-group">
                                <label className="input-label">Select Members</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                    gap: 'var(--space-sm)'
                                }}>
                                    {members
                                        .filter(member => {
                                            // If global assignment, show everyone
                                            if (formData.is_global) return true;
                                            // If local assignment, only show members of current user's classroom
                                            return member.classroom_id === currentUserProfile?.classroom_id;
                                        })
                                        .map(member => (
                                            <div
                                                key={member.id}
                                                onClick={() => toggleAssignment(member.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-sm)',
                                                    padding: 'var(--space-sm) var(--space-md)',
                                                    background: formData.assigned_to.includes(member.id)
                                                        ? 'rgba(99, 102, 241, 0.1)'
                                                        : 'var(--card)',
                                                    border: `2px solid ${formData.assigned_to.includes(member.id) ? 'var(--primary-500)' : 'var(--border)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    transition: 'all var(--transition-fast)'
                                                }}
                                            >
                                                <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                                <span style={{ fontSize: 'var(--text-sm)' }}>{member.name}</span>
                                            </div>
                                        ))}
                                </div>
                                {members.filter(member => formData.is_global || member.classroom_id === currentUserProfile?.classroom_id).length === 0 && (
                                    <p className="text-xs text-muted italic">No members found in this classroom.</p>
                                )}
                            </div>
                        )}

                        {/* Deliverables */}
                        <div className="input-group">
                            <label className="input-label">Acceptable Deliverables</label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: 'var(--space-sm)'
                            }}>
                                {[
                                    { id: 'repo_url', label: 'Repository URL', icon: '🔗' },
                                    { id: 'file_upload', label: 'File Upload', icon: '📁' },
                                    { id: 'live_demo', label: 'Live Demo URL', icon: '🌐' },
                                    { id: 'design_file', label: 'Design Files', icon: '🎨' },
                                    { id: 'documentation', label: 'Documentation', icon: '📄' },
                                    { id: 'other', label: 'Other', icon: '📝' }
                                ].map(type => (
                                    <div
                                        key={type.id}
                                        onClick={() => toggleDeliverableType(type.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: formData.deliverable_types.includes(type.id)
                                                ? 'rgba(99, 102, 241, 0.1)'
                                                : 'var(--card)',
                                            border: `2px solid ${formData.deliverable_types.includes(type.id) ? 'var(--primary-500)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <div className={`checkbox ${formData.deliverable_types.includes(type.id) ? 'checked' : ''}`}>
                                            {formData.deliverable_types.includes(type.id) && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 'var(--text-sm)', marginRight: 'auto' }}>{type.label}</span>
                                        <span style={{ fontSize: '16px' }}>{type.icon}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Evaluation Criteria */}
                        <div className="input-group">
                            <label className="input-label">Evaluation Criteria</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                <Input
                                    placeholder="Add custom criteria (e.g. 'Unit tests passing')"
                                    id="custom-criteria-input"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        const input = document.getElementById('custom-criteria-input');
                                        if (input && input.value.trim()) {
                                            const newVal = input.value.trim();
                                            if (!formData.criteria.includes(newVal)) {
                                                setFormData(prev => ({ ...prev, criteria: [...prev.criteria, newVal] }));
                                            }
                                            input.value = '';
                                        }
                                    }}
                                >
                                    Add Custom
                                </Button>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: 'var(--space-sm)'
                            }}>
                                {EVALUATION_CRITERIA.map(criteria => (
                                    <div
                                        key={criteria.id}
                                        onClick={() => toggleCriteria(criteria.id)}
                                        style={{
                                            padding: 'var(--space-sm) var(--space-md)',
                                            background: formData.criteria.includes(criteria.id)
                                                ? 'rgba(99, 102, 241, 0.1)'
                                                : 'var(--card)',
                                            border: `2px solid ${formData.criteria.includes(criteria.id) ? 'var(--primary-500)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)'
                                        }}
                                    >
                                        <div className={`checkbox ${formData.criteria.includes(criteria.id) ? 'checked' : ''}`}>
                                            {formData.criteria.includes(criteria.id) && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 'var(--text-sm)' }}>{criteria.label}</span>
                                        {criteria.auto && (
                                            <Badge variant="accent" style={{ marginLeft: 'auto', fontSize: '10px' }}>
                                                Auto
                                            </Badge>
                                        )}
                                    </div>
                                ))}

                                {formData.criteria
                                    .filter(c => !EVALUATION_CRITERIA.some(ec => ec.id === c))
                                    .map(customCriteria => (
                                        <div
                                            key={customCriteria}
                                            onClick={() => toggleCriteria(customCriteria)}
                                            style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                border: '2px solid var(--primary-500)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)'
                                            }}
                                        >
                                            <div className="checkbox checked">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: 'var(--text-sm)' }}>{customCriteria}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                        <Button type="button" variant="secondary" onClick={closeModal}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                            {editingTask ? 'Save Changes' : 'Create Task'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Delete Task"
                size="sm"
            >
                <p style={{ marginBottom: 'var(--space-lg)' }}>
                    Are you sure you want to delete "<strong>{deleteConfirm?.title}</strong>"?
                    This action cannot be undone.
                </p>
                <div className="flex justify-end gap-md">
                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(deleteConfirm.id)}>
                        Delete Task
                    </Button>
                </div>
            </Modal>


        </div>
    );
};

export default TaskManager;
