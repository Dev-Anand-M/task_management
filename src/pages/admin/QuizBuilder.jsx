import { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Avatar } from '../../components/common';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    HelpCircle,
    Clock,
    Award,
    Users,
    GripVertical,
    X,
    Upload
} from 'lucide-react';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import {
    TASK_CATEGORIES,
    DIFFICULTY_LEVELS,
    QUESTION_TYPES,
    getDifficultyColor
} from '../../utils/constants';
import { useMiniReload } from '../../hooks/useMiniReload';

const QuizBuilder = () => {
    const { user } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [members, setMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCSVGuide, setShowCSVGuide] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Frontend',
        difficulty: 'easy',
        time_limit: 10,
        assigned_to: [],
        questions: [],
        is_global: false,
        assignment_type: 'everyone',
        classroom_id: ''
    });
    const [classrooms, setClassrooms] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useMiniReload(() => loadData());

    const loadData = async () => {
        try {
            setLoading(true);
            const [quizzesData, membersData, classroomsData] = await Promise.all([
                db.getQuizzes(),
                db.getMembers(),
                db.getClassrooms()
            ]);
            setQuizzes(quizzesData);
            setMembers(membersData);
            setClassrooms(classroomsData);
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
            category: 'Frontend',
            difficulty: 'easy',
            time_limit: 10,
            assigned_to: [],
            questions: [],
            is_global: false,
            assignment_type: 'everyone',
            classroom_id: '',
            passing_score: 70
        });
    };

    const openCreateModal = () => {
        resetForm();
        setEditingQuiz(null);
        setShowCreateModal(true);
    };

    const openEditModal = (quiz) => {
        setFormData({
            title: quiz.title,
            description: quiz.description || '',
            category: quiz.category,
            difficulty: quiz.difficulty,
            time_limit: quiz.time_limit,
            assigned_to: quiz.assigned_to || [],
            questions: quiz.questions || [],
            is_global: quiz.is_global || false,
            assignment_type: quiz.assignment_type || (quiz.assigned_to?.length > 0 ? 'specific' : 'everyone'),
            classroom_id: quiz.classroom_id || '',
            passing_score: quiz.passing_score || 70
        });
        setEditingQuiz(quiz);
        setShowCreateModal(true);
    };

    const addQuestion = () => {
        const newQuestion = {
            id: Date.now().toString(),
            type: 'multiple',
            question: '',
            options: ['', '', '', ''],
            correctAnswer: 0
        };
        setFormData(prev => ({
            ...prev,
            questions: [...prev.questions, newQuestion]
        }));
    };

    const updateQuestion = (index, updates) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.map((q, i) =>
                i === index ? { ...q, ...updates } : q
            )
        }));
    };

    const removeQuestion = (index) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index)
        }));
    };

    const updateOption = (questionIndex, optionIndex, value) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.map((q, i) => {
                if (i === questionIndex) {
                    const newOptions = [...q.options];
                    newOptions[optionIndex] = value;
                    return { ...q, options: newOptions };
                }
                return q;
            })
        }));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvData = event.target.result;
            parseCSV(csvData);
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    const parseCSV = (csvText) => {
        const lines = [];
        let currentLine = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentLine.push(currentCell.trim());
                currentCell = '';
            } else if (char === '\n' && !inQuotes) {
                currentLine.push(currentCell.trim());
                lines.push(currentLine);
                currentLine = [];
                currentCell = '';
            } else if (char !== '\r') {
                currentCell += char;
            }
        }
        if (currentCell || currentLine.length > 0) {
            currentLine.push(currentCell.trim());
            lines.push(currentLine);
        }

        if (lines.length < 2) {
            alert('CSV is too short. Please provide at least metadata and one question.');
            return;
        }

        // Row 1: Metadata (Title, Description, Category, Difficulty, TimeLimit)
        const metadata = lines[0];
        const newFormData = { ...formData };
        
        if (metadata.length >= 2) {
            newFormData.title = metadata[0] || formData.title;
            newFormData.description = metadata[1] || formData.description;
            if (metadata[2]) newFormData.category = metadata[2];
            
            // Validate difficulty - must be 'easy', 'medium', or 'hard'
            if (metadata[3]) {
                const difficulty = metadata[3].toLowerCase().trim();
                if (['easy', 'medium', 'hard'].includes(difficulty)) {
                    newFormData.difficulty = difficulty;
                } else {
                    console.warn(`Invalid difficulty "${metadata[3]}" - defaulting to "easy"`);
                    newFormData.difficulty = 'easy';
                }
            }
            
            if (metadata[4]) newFormData.time_limit = parseInt(metadata[4]) || 10;
        }

        // Row 2 is usually headers, skip if it looks like one
        const startIndex = lines[1].some(cell => cell.toLowerCase().includes('type') || cell.toLowerCase().includes('question')) ? 2 : 1;
        const dataLines = lines.slice(startIndex);

        const newQuestions = [];
        const errors = [];
        
        dataLines.forEach((row, index) => {
            if (row.length < 2) return;
            
            const type = row[0].toLowerCase().trim();
            const questionText = row[1];
            
            if (type.includes('mcq') || type.includes('multiple')) {
                const options = [row[2], row[3], row[4], row[5]];
                let correctIdx = parseInt(row[6]);
                
                // Standardize to 0-based indexing (0, 1, 2, 3)
                // Platform uses 0-based ONLY - no auto-conversion
                if (!isNaN(correctIdx)) {
                    if (correctIdx >= 0 && correctIdx <= 3) {
                        // Valid 0-based index (0, 1, 2, 3) - use as is
                    } else {
                        errors.push(`Question ${index + 1}: Invalid correct answer index "${row[6]}" - must be 0-3 (0=first option, 1=second, 2=third, 3=fourth)`);
                        correctIdx = 0; // default to first option
                    }
                } else {
                    errors.push(`Question ${index + 1}: Missing or invalid correct answer - defaulting to option 1`);
                    correctIdx = 0;
                }
                
                newQuestions.push({
                    id: `q-${Date.now()}-${index}`,
                    type: 'multiple',
                    question: questionText,
                    options: options,
                    correctAnswer: correctIdx  // 0-based: 0, 1, 2, 3
                });
            } else if (type.includes('bool') || type.includes('true')) {
                // Boolean questions: ONLY simple format supported
                // Format: "boolean","Question","True" or "False"
                
                let answer;
                
                // Try to parse from column 2 (simple format)
                const answerStr = (row[2] || '').toLowerCase().trim();
                
                if (answerStr === 'true' || answerStr === '1' || answerStr === 'yes') {
                    answer = true;
                } else if (answerStr === 'false' || answerStr === '0' || answerStr === 'no') {
                    answer = false;
                } else {
                    errors.push(`Question ${index + 1}: Invalid boolean answer "${row[2]}" - must be True or False`);
                    answer = false; // default to false
                }
                
                
                newQuestions.push({
                    id: `q-${Date.now()}-${index}`,
                    type: 'boolean',
                    question: questionText,
                    options: [],
                    correctAnswer: answer  // Boolean: true or false
                });
            } else if (type.includes('short')) {
                newQuestions.push({
                    id: `q-${Date.now()}-${index}`,
                    type: 'short',
                    question: questionText,
                    options: [],
                    correctAnswer: row[2] || ''
                });
            } else {
                errors.push(`Question ${index + 1}: Unknown question type "${row[0]}"`);
            }
        });

        if (errors.length > 0) {
            alert('Import completed with warnings:\n\n' + errors.join('\n'));
        }

        if (newQuestions.length > 0) {
            setFormData({
                ...newFormData,
                questions: newQuestions
            });
            alert(`Successfully imported Quiz: "${newFormData.title}" with ${newQuestions.length} questions!` + 
                  (errors.length > 0 ? '\n\nPlease review the warnings above.' : ''));
        } else {
            alert('Could not find valid questions. Ensure the Type (mcq/boolean/short) is in the first column.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        const quizData = {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            difficulty: formData.difficulty,
            time_limit: formData.time_limit,
            passing_score: formData.passing_score,
            points: DIFFICULTY_LEVELS.find(d => d.value === formData.difficulty)?.points ?? 30,
            questions: formData.questions,
            assigned_to: formData.assignment_type === 'specific' ? formData.assigned_to : [],
            status: 'active',
            created_by: user?.id,
            classroom_id: formData.is_global ? null : (formData.classroom_id || user?.classroom_id),
            is_global: formData.is_global,
            assignment_type: formData.assignment_type
        };

        try {
            const saveAction = editingQuiz 
                ? db.updateQuiz(editingQuiz.id, quizData) 
                : db.createQuiz(quizData);
                
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Save timeout. The server took too long to respond.')), 10000)
            );

            const result = await Promise.race([saveAction, timeoutPromise]);

            // --- SEND NOTIFICATIONS TO ASSIGNED MEMBERS ---
            if (editingQuiz) {
                try {
                    // Determine who to notify
                    let targetMemberIds = [];
                    if (quizData.assignment_type === 'everyone') {
                        targetMemberIds = members
                            .filter(m => quizData.is_global || m.classroom_id === quizData.classroom_id)
                            .filter(m => m.id !== user?.id) // Exclude admin who created the quiz
                            .map(m => m.id);
                    } else {
                        targetMemberIds = (quizData.assigned_to || []).filter(id => id !== user?.id); // Exclude admin
                    }

                    // Send notifications to each assigned member (excluding the admin who assigned it)
                    const notifyPromises = targetMemberIds.map(async (memberId) => {
                        // 1. Create in-app notification
                        await db.createNotification({
                            user_id: memberId,
                            classroom_id: quizData.classroom_id,
                            title: 'Quiz Updated 📝',
                            message: `${quizData.title} has been updated.`,
                            type: 'quiz',
                            link: `/quizzes`
                        });
                    });

                    await Promise.allSettled(notifyPromises);
                } catch (notifyError) {
                    console.error('Failed to send notifications:', notifyError);
                    // Don't block the main flow if notifications fail
                }
            }
            // -------------------------------

            await loadData();
            setShowCreateModal(false);
            resetForm();
        } catch (error) {
            console.error('Error saving quiz:', error);
            alert(`Failed to save quiz: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (quizId) => {
        try {
            await db.deleteQuiz(quizId);
            await loadData();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting quiz:', error);
        }
    };

    const toggleAssignment = (userId) => {
        setFormData(prev => ({
            ...prev,
            assigned_to: prev.assigned_to.includes(userId)
                ? prev.assigned_to.filter(id => id !== userId)
                : [...prev.assigned_to, userId]
        }));
    };

    const filteredQuizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                <p style={{ color: 'var(--text-muted)' }}>
                    Create and manage quizzes for your team
                </p>
                <Button icon={Plus} onClick={openCreateModal}>
                    Create Quiz
                </Button>
            </div>

            {/* Search */}
            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <Input
                    placeholder="Search quizzes..."
                    icon={Search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Card>

            {/* Quizzes Grid */}
            {filteredQuizzes.length === 0 ? (
                <Card>
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <HelpCircle size={32} />
                        </div>
                        <h3>No quizzes found</h3>
                        <p>Create your first quiz to test your team's knowledge.</p>
                        <Button icon={Plus} onClick={openCreateModal}>
                            Create Quiz
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-3 grid-3-mobile-1">
                    {filteredQuizzes.map(quiz => {
                        const assignedMembers = quiz.assigned_to?.map(id =>
                            members.find(m => m.id === id)
                        ).filter(Boolean) || [];

                        return (
                            <Card
                                key={quiz.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)'
                                }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant={getDifficultyColor(quiz.difficulty)}>
                                            {quiz.difficulty}
                                        </Badge>
                                        <Badge variant="primary" style={{ marginLeft: '8px' }}>
                                            {quiz.category}
                                        </Badge>
                                        {quiz.is_global && (
                                            <Badge variant="accent" style={{ marginLeft: '8px' }}>Global</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-sm" style={{ position: 'relative', zIndex: 10 }}>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(quiz);
                                            }}
                                            style={{ padding: '8px' }}
                                        >
                                            <Edit2 size={16} color="var(--primary-400)" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirm(quiz);
                                            }}
                                            style={{ padding: '8px' }}
                                        >
                                            <Trash2 size={16} color="var(--error-500)" />
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ marginBottom: '4px' }}>{quiz.title}</h4>
                                    <p style={{
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--text-muted)',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {quiz.description}
                                    </p>
                                </div>

                                <div className="flex gap-lg" style={{ fontSize: 'var(--text-sm)' }}>
                                    <div className="flex items-center gap-xs" style={{ color: 'var(--text-muted)' }}>
                                        <HelpCircle size={16} />
                                        {quiz.questions?.length || 0} questions
                                    </div>
                                    <div className="flex items-center gap-xs" style={{ color: 'var(--text-muted)' }}>
                                        <Clock size={16} />
                                        {quiz.time_limit} min
                                    </div>
                                    <div className="flex items-center gap-xs" style={{ color: 'var(--text-muted)' }}>
                                        <Award size={16} />
                                        {quiz.points} pts
                                    </div>
                                </div>

                                <div className="flex items-center" style={{
                                    paddingTop: 'var(--space-md)',
                                    borderTop: '1px solid var(--border)'
                                }}>
                                    <Users size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {quiz.assignment_type === 'everyone' ? (
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
                                    {quiz.assignment_type === 'specific' && (
                                        <span style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)',
                                            marginLeft: '8px'
                                        }}>
                                            {assignedMembers.length} assigned
                                        </span>
                                    )}
                                    {quiz.is_global ? (
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>
                                            (Global)
                                        </span>
                                    ) : (
                                        quiz.classroom_id && (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>
                                                ({classrooms.find(c => c.id === quiz.classroom_id)?.name || 'Unknown Class'})
                                            </span>
                                        )
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
                onClose={() => setShowCreateModal(false)}
                title={editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
                size="xl"
            >
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <Input
                            label="Quiz Title"
                            placeholder="e.g., HTML Fundamentals"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />

                        <Input
                            type="textarea"
                            label="Description"
                            placeholder="Describe what this quiz covers..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />

                        <div className="grid grid-4-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="input-group">
                                <label className="input-label">Category</label>
                                <select
                                    className="input select"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {TASK_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Difficulty</label>
                                <select
                                    className="input select"
                                    value={formData.difficulty}
                                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    {DIFFICULTY_LEVELS.map(level => (
                                        <option key={level.value} value={level.value}>
                                            {level.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Input
                                type="number"
                                label="Time Limit (min)"
                                min="1"
                                max="120"
                                value={formData.time_limit}
                                onChange={(e) => setFormData({ ...formData, time_limit: parseInt(e.target.value) })}
                            />
                            <Input
                                type="number"
                                label="Pass Grade (%)"
                                min="0"
                                max="100"
                                value={formData.passing_score}
                                onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) })}
                            />
                        </div>

                        {/* Assignment Mode */}
                        <div className="input-group">
                            <label className="input-label">Target Audience</label>
                            <div className="flex flex-mobile-col gap-md">
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
                        
                        {!formData.is_global && (
                            <div className="input-group">
                                <label className="input-label">Select Target Classroom</label>
                                <select
                                    className="input select"
                                    value={formData.classroom_id}
                                    onChange={(e) => setFormData({ ...formData, classroom_id: e.target.value })}
                                    required={!formData.is_global}
                                >
                                    <option value="">-- Choose a Classroom --</option>
                                    {classrooms.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="input-group">
                            <label className="input-label">Assignment Type</label>
                            <div className="flex flex-mobile-col gap-md">
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
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 'var(--space-sm)'
                                }}>
                                    {members
                                        .filter(member => {
                                            if (formData.is_global) return true;
                                            return member.classroom_id === formData.classroom_id;
                                        })
                                        .map(member => (
                                            <div
                                                key={member.id}
                                                onClick={() => toggleAssignment(member.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-sm)',
                                                    padding: 'var(--space-xs) var(--space-md)',
                                                    background: formData.assigned_to.includes(member.id)
                                                        ? 'rgba(99, 102, 241, 0.1)'
                                                        : 'var(--card)',
                                                    border: `2px solid ${formData.assigned_to.includes(member.id) ? 'var(--primary-500)' : 'var(--border)'}`,
                                                    borderRadius: 'var(--radius-full)',
                                                    cursor: 'pointer',
                                                    transition: 'all var(--transition-fast)'
                                                }}
                                            >
                                                <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                                <span style={{ fontSize: 'var(--text-sm)' }}>{member.name}</span>
                                            </div>
                                        ))}
                                </div>
                                {members.filter(member => formData.is_global || member.classroom_id === formData.classroom_id).length === 0 && (
                                    <p className="text-xs text-muted italic">No members found in this classroom.</p>
                                )}
                            </div>
                        )}

                        {/* Questions */}
                        <div className="input-group">
                            <div className="flex justify-between items-center mb-xs">
                                <label className="input-label" style={{ margin: 0 }}>Questions</label>
                                <div className="flex gap-sm">
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        id="csv-upload" 
                                        style={{ display: 'none' }} 
                                        onChange={handleFileUpload} 
                                    />
                                    <Button type="button" variant="ghost" size="sm" icon={Upload} onClick={() => document.getElementById('csv-upload').click()}>
                                        Import CSV
                                    </Button>
                                    <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addQuestion}>
                                        Add Question
                                    </Button>
                                </div>
                                <Button type="button" variant="ghost" size="sm" icon={HelpCircle} onClick={() => setShowCSVGuide(!showCSVGuide)}>
                                    {showCSVGuide ? 'Hide Format Guide' : 'Show Format Guide'}
                                </Button>
                            </div>
                            
                            {showCSVGuide && (
                                <div className="text-xs text-muted mb-md p-md bg-surface border border-border rounded-lg animate-fade-in" style={{ opacity: 0.9 }}>
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-sm" style={{ color: 'var(--primary-500)' }}>CSV Import Format Guide</h4>
                                    <p className="mb-sm">To import a quiz, upload a CSV with the following structure:</p>
                                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <li>• <strong>Row 1:</strong> Title, Description, Category, Difficulty (easy/medium/hard), TimeLimit</li>
                                        <li>• <strong>Row 2:</strong> Headers (optional - Type, Question, Options...)</li>
                                        <li>• <strong>MCQ:</strong> "mcq", "Question?", "Option 1", "Option 2", "Option 3", "Option 4", AnswerIndex</li>
                                        <li>• <strong>Boolean:</strong> "boolean", "Question?", "True" or "False"</li>
                                        <li>• <strong>Short Answer:</strong> "short", "Question?", "Expected Answer"</li>
                                    </ul>
                                    <p className="mt-sm mb-xs" style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--warning-400)' }}>
                                        ⚠️ MCQ: Use 0-based indexing (0=first, 1=second, 2=third, 3=fourth)
                                        <br/>
                                        ⚠️ Boolean: Use "True" or "False" directly (NOT 0/1 indices)
                                    </p>
                                    <div className="mt-xs p-xs bg-card rounded border border-border/50 font-mono" style={{ fontSize: '10px', lineHeight: '1.6' }}>
                                        <strong>Example CSV:</strong><br/>
                                        "HTML Basics","Intro to HTML","Frontend","easy",15<br/>
                                        "Type","Question","Opt1","Opt2","Opt3","Opt4","Answer"<br/>
                                        "mcq","What is HTML?","Markup Language","Bird","Car","Plane",0<br/>
                                        "boolean","Is HTML a programming language?","False"<br/>
                                        "short","Explain HTML","Provides structure to web pages"
                                    </div>
                                </div>
                            )}

                            {formData.questions.length === 0 ? (
                                <div style={{
                                    padding: 'var(--space-xl)',
                                    background: 'var(--card)',
                                    borderRadius: 'var(--radius-lg)',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)'
                                }}>
                                    <HelpCircle size={32} style={{ marginBottom: 'var(--space-sm)', opacity: 0.5 }} />
                                    <p style={{ margin: 0 }}>No questions yet. Click "Add Question" to get started.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {formData.questions.map((question, qIndex) => (
                                        <Card key={question.id} style={{ background: 'var(--surface)' }}>
                                            <div className="flex justify-between items-start mb-md">
                                                <div className="flex items-center gap-sm">
                                                    <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
                                                    <Badge variant="primary">Q{qIndex + 1}</Badge>
                                                </div>
                                                <div className="flex items-center gap-sm">
                                                    <select
                                                        className="input select"
                                                        style={{ width: 'auto', padding: '0.5rem' }}
                                                        value={question.type}
                                                        onChange={(e) => updateQuestion(qIndex, {
                                                            type: e.target.value,
                                                            correctAnswer: e.target.value === 'boolean' ? true : 0,
                                                            options: e.target.value === 'boolean' ? [] : ['', '', '', '']
                                                        })}
                                                    >
                                                        {QUESTION_TYPES.map(type => (
                                                            <option key={type.value} value={type.value}>{type.label}</option>
                                                        ))}
                                                    </select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeQuestion(qIndex)}
                                                    >
                                                        <X size={16} />
                                                    </Button>
                                                </div>
                                            </div>

                                            <Input
                                                placeholder="Enter your question..."
                                                value={question.question}
                                                onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                                                wrapperClassName="mb-md"
                                            />

                                            {question.type === 'multiple' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                                    {question.options.map((option, oIndex) => (
                                                        <div
                                                            key={oIndex}
                                                            className="flex items-center gap-sm"
                                                            onClick={() => updateQuestion(qIndex, { correctAnswer: oIndex })}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                border: `2px solid ${question.correctAnswer === oIndex ? 'var(--success-500)' : 'var(--border)'}`,
                                                                background: question.correctAnswer === oIndex ? 'var(--success-500)' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {question.correctAnswer === oIndex && (
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            <Input
                                                                placeholder={`Option ${oIndex + 1}`}
                                                                value={option}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    updateOption(qIndex, oIndex, e.target.value);
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ flex: 1 }}
                                                            />
                                                        </div>
                                                    ))}
                                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                        Click the circle to mark the correct answer
                                                    </p>
                                                </div>
                                            )}

                                            {question.type === 'boolean' && (
                                                <div className="flex gap-md">
                                                    {[{ label: 'True', value: true }, { label: 'False', value: false }].map(opt => (
                                                        <div
                                                            key={opt.label}
                                                            onClick={() => updateQuestion(qIndex, { correctAnswer: opt.value })}
                                                            style={{
                                                                flex: 1,
                                                                padding: 'var(--space-md)',
                                                                background: question.correctAnswer === opt.value
                                                                    ? 'rgba(16, 185, 129, 0.1)'
                                                                    : 'var(--card)',
                                                                border: `2px solid ${question.correctAnswer === opt.value ? 'var(--success-500)' : 'var(--border)'}`,
                                                                borderRadius: 'var(--radius-md)',
                                                                textAlign: 'center',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {opt.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {question.type === 'short' && (
                                                <Input
                                                    placeholder="Expected answer (for grading reference)"
                                                    value={question.correctAnswer || ''}
                                                    onChange={(e) => updateQuestion(qIndex, { correctAnswer: e.target.value })}
                                                />
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={formData.questions.length === 0} loading={saving}>
                            {editingQuiz ? 'Save Changes' : 'Create Quiz'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Delete Quiz"
                size="sm"
            >
                <p style={{ marginBottom: 'var(--space-lg)' }}>
                    Are you sure you want to delete "<strong>{deleteConfirm?.title}</strong>"?
                </p>
                <div className="flex justify-end gap-md">
                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(deleteConfirm.id)}>
                        Delete Quiz
                    </Button>
                </div>
            </Modal>


        </div>
    );
};

export default QuizBuilder;
