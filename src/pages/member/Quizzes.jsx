import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Modal } from '../../components/common';
import {
    Search,
    Clock,
    Award,
    HelpCircle,
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    XCircle,
    Timer,
    Trophy
} from 'lucide-react';
import * as db from '../../services/database';
import { evaluateQuizAttempt, getSelectedModel, isAPIKeyConfigured } from '../../services/aiService';
import {
    getDifficultyColor,
    DIFFICULTY_LEVELS
} from '../../utils/constants';

const Quizzes = () => {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            const [allQuizzes, myAttempts] = await Promise.all([
                db.getQuizzes(),
                db.getQuizAttemptsByUser(user.id)
            ]);

            setQuizzes(allQuizzes);
            setAttempts(myAttempts);
        } catch (error) {
            console.error('Error loading quizzes:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getQuizStatus = (quizId) => {
        const attempt = attempts.find(a => a.quiz_id === quizId);
        return attempt ? 'completed' : 'pending';
    };

    const getQuizScore = (quizId) => {
        const attempt = attempts.find(a => a.quiz_id === quizId);
        return attempt?.score || null;
    };

    const filteredQuizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Separate pending and completed
    const pendingQuizzes = filteredQuizzes.filter(q => getQuizStatus(q.id) === 'pending');
    const completedQuizzes = filteredQuizzes.filter(q => getQuizStatus(q.id) === 'completed');

    if (quizId) {
        return <TakeQuiz quizId={quizId} onBack={() => navigate('/quizzes')} onComplete={loadData} />;
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
            {/* Search */}
            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <div className="flex items-center gap-sm" style={{
                    background: 'var(--card)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0 var(--space-md)',
                    border: '1px solid var(--border)'
                }}>
                    <Search size={18} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search quizzes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            padding: 'var(--space-md) 0',
                            color: 'var(--text)',
                            outline: 'none',
                            fontSize: 'var(--text-base)'
                        }}
                    />
                </div>
            </Card>

            {/* Pending Quizzes */}
            {pendingQuizzes.length > 0 && (
                <>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>
                        <HelpCircle size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Pending Quizzes ({pendingQuizzes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md mb-xl">
                        {pendingQuizzes.map(quiz => (
                            <Link key={quiz.id} to={`/quizzes/${quiz.id}`} style={{ textDecoration: 'none' }}>
                                <Card style={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)'
                                }}>
                                    <div className="flex justify-between items-start">
                                        <Badge variant={getDifficultyColor(quiz.difficulty)}>
                                            {quiz.difficulty}
                                        </Badge>
                                        <Badge variant="primary">{quiz.category}</Badge>
                                    </div>

                                    <div style={{ flex: 1 }}>
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

                                    <div className="flex justify-between items-center" style={{
                                        paddingTop: 'var(--space-md)',
                                        borderTop: '1px solid var(--border)'
                                    }}>
                                        <div className="flex gap-md" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            <span className="flex items-center gap-xs">
                                                <HelpCircle size={14} /> {quiz.questions?.length} Q
                                            </span>
                                            <span className="flex items-center gap-xs">
                                                <Clock size={14} /> {quiz.time_limit} min
                                            </span>
                                        </div>
                                        <Badge variant="accent">
                                            <Award size={12} /> +{quiz.points} XP
                                        </Badge>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {/* Completed Quizzes */}
            {completedQuizzes.length > 0 && (
                <>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>
                        <CheckCircle size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Completed Quizzes ({completedQuizzes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                        {completedQuizzes.map(quiz => {
                            const attempt = attempts.find(a => a.quiz_id === quiz.id);
                            const isFinalized = attempt?.metadata?.finalized === true;
                            const score = attempt?.score || 0;
                            const passed = score >= 70;

                            return (
                                <Card key={quiz.id} style={{
                                    opacity: 0.9,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)'
                                }}>
                                    <div className="flex justify-between items-start">
                                        <Badge variant={getDifficultyColor(quiz.difficulty)}>
                                            {quiz.difficulty}
                                        </Badge>
                                        <Badge variant={!isFinalized ? 'warning' : (passed ? 'success' : 'error')}>
                                            {!isFinalized ? '⏳ Under Review' : (passed ? '✓ Passed' : '✗ Failed')}
                                        </Badge>
                                    </div>

                                    <div>
                                        <h4 style={{ marginBottom: '4px' }}>{quiz.title}</h4>
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            {quiz.category}
                                        </p>
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-md)',
                                        background: !isFinalized ? 'var(--surface)' : (passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                                        borderRadius: 'var(--radius-md)',
                                        textAlign: 'center',
                                        border: !isFinalized ? '1px dashed var(--border)' : 'none'
                                    }}>
                                        <p style={{
                                            fontSize: !isFinalized ? 'var(--text-sm)' : 'var(--text-2xl)',
                                            fontWeight: 700,
                                            margin: 0,
                                            color: !isFinalized ? 'var(--text-muted)' : (passed ? 'var(--success-500)' : 'var(--error-500)')
                                        }}>
                                            {!isFinalized ? '🔍 Evaluation in Progress...' : `${score}%`}
                                        </p>
                                        {!isFinalized && (
                                            <p style={{ 
                                                fontSize: 'var(--text-xs)', 
                                                color: 'var(--text-muted)', 
                                                margin: '4px 0 0',
                                                fontStyle: 'italic'
                                            }}>
                                                Your instructor is reviewing your answers
                                            </p>
                                        )}
                                    </div>
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        icon={!isFinalized ? Clock : Search}
                                        onClick={() => isFinalized && navigate(`/quizzes/${quiz.id}`)}
                                        style={{ width: '100%', opacity: !isFinalized ? 0.6 : 1, cursor: !isFinalized ? 'default' : 'pointer' }}
                                        disabled={!isFinalized}
                                    >
                                        {!isFinalized ? 'Waiting for Finalization' : 'View Detailed Results'}
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}

            {filteredQuizzes.length === 0 && (
                <Card>
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <HelpCircle size={32} />
                        </div>
                        <h3>No quizzes assigned</h3>
                        <p>Quizzes assigned to you will appear here.</p>
                    </div>
                </Card>
            )}


        </div>
    );
};

// Take Quiz Component
const TakeQuiz = ({ quizId, onBack, onComplete }) => {
    const { user, addXP, addBadge } = useAuth();
    const [quiz, setQuiz] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [results, setResults] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [quizStarted, setQuizStarted] = useState(false);
    const [submissionError, setSubmissionError] = useState(null);

    const loadQuiz = useCallback(async () => {
        try {
            setLoading(true);
            const [q, atts] = await Promise.all([
                db.getQuizById(quizId),
                db.getQuizAttemptsByUser(user.id)
            ]);

            if (q) {
                setQuiz(q);
                setTimeLeft(q.time_limit * 60);

                // Check if this quiz was already completed
                const existingAttempt = atts.find(a => a.quiz_id === quizId);
                if (existingAttempt) {
                    setAnswers(existingAttempt.answers || {});
                    setResults({
                        score: existingAttempt.score,
                        correct: existingAttempt.correct,
                        total: existingAttempt.total,
                        passed: existingAttempt.passed,
                        xpEarned: 0,
                        manually_evaluated: existingAttempt.metadata?.manually_evaluated,
                        finalized: existingAttempt.metadata?.finalized,
                        aiReport: existingAttempt.metadata?.ai_report
                    });
                    setIsComplete(true);
                    setShowReview(existingAttempt.metadata?.finalized === true);
                }
                // Load from localStorage if available
                try {
                    const savedAnswers = localStorage.getItem(`quiz_answers_${quizId}`);
                    if (savedAnswers) {
                        setAnswers(JSON.parse(savedAnswers));
                    }
                } catch (e) {
                    console.error('Error loading saved answers:', e);
                }
            }
        } catch (error) {
            console.error('Error loading quiz:', error);
        } finally {
            setLoading(false);
        }
    }, [quizId, user.id]);

    // Save answers to localStorage as student works
    useEffect(() => {
        if (!quiz || isComplete) return;
        localStorage.setItem(`quiz_answers_${quizId}`, JSON.stringify(answers));
    }, [answers, quizId, quiz, isComplete]);

    useEffect(() => {
        loadQuiz();
    }, [loadQuiz]);

    // Timer
    const handleSubmit = useCallback(async () => {
        if (!quiz || submitting) return;
        setSubmitting(true);

        // Calculate score
        let correct = 0;
        quiz.questions.forEach((q, index) => {
            if (q.type === 'boolean') {
                if (answers[index] === q.correctAnswer) correct++;
            } else if (q.type === 'multiple') {
                if (answers[index] === q.correctAnswer) correct++;
            }
        });

        const score = Math.round((correct / quiz.questions.length) * 100);
        const passThreshold = quiz.passing_score || 70;
        const passed = score >= passThreshold;

        try {
            setSubmitting(true);
            // 1. SAVE IMMEDIATELY - This is the most important part to prevent "retakes"
            // Use a small timeout or just immediate return if possible, but we need the ID for AI
            const { data: attempt, error: dbError } = await db.supabase
                .from('quiz_attempts')
                .insert({
                    quiz_id: quiz.id,
                    user_id: user.id,
                    answers,
                    score,
                    correct,
                    total: quiz.questions.length,
                    passed,
                    completed_at: new Date().toISOString(),
                    metadata: { ai_evaluated: false, status: 'submitted' }
                })
                .select('id')
                .single();

            if (dbError) throw dbError;

            const attemptId = attempt.id;

            // 2. SHOW SUCCESS UI IMMEDIATELY
            setSubmitting(false);
            setResults({ loading: false, score, total: quiz.questions.length, manually_evaluated: false });
            setIsComplete(true);
            onComplete();

            // 3. RUN AI EVALUATION IN THE BACKGROUND
            const runBackgroundAi = async (id) => {
                console.log('--- STARTING BACKGROUND AI EVALUATION ---');
                console.log('Attempt ID:', id);
                
                const hasAI = isAPIKeyConfigured('sambanova') || isAPIKeyConfigured('google') || isAPIKeyConfigured('openai');
                if (!hasAI) {
                    console.log('AI NOT CONFIGURED. Skipping background evaluation.');
                    return;
                }

                try {
                    let modelToUse = getSelectedModel();
                    if (isAPIKeyConfigured('sambanova')) modelToUse = 'Meta-Llama-3.3-70B-Instruct';
                    
                    console.log('Using Model:', modelToUse);

                    const report = await evaluateQuizAttempt(quiz, answers, modelToUse);
                    console.log('AI Evaluation Report received:', report ? 'YES' : 'NO');
                    
                    if (report) {
                        let finalCorrect = 0;
                        const autoOverrides = {};
                        
                        quiz.questions.forEach((q, idx) => {
                            const aiSuggestion = report.suggestions.find(s => Number(s.questionIndex) === Number(idx));
                            const isLocallyCorrect = q.type !== 'short' && answers[idx] === q.correctAnswer;

                            if (q.type === 'short') {
                                // SHORT ANSWER: AI evaluates and applies to score
                                if (aiSuggestion?.isCorrect) {
                                    finalCorrect++;
                                    autoOverrides[Number(idx)] = true;
                                } else {
                                    autoOverrides[Number(idx)] = false;
                                }
                            } else {
                                // MCQ/TRUE-FALSE: Use original quiz key, AI only flags issues
                                if (isLocallyCorrect) {
                                    finalCorrect++;
                                }
                                // Don't apply AI suggestions to score yet, just store them for flagging
                                // Admin will use "Intercept & Re-evaluate All" to apply them
                            }
                        });

                        const aiScore = Math.round((finalCorrect / quiz.questions.length) * 100);
                        console.log('Calculated AI Score (SHORT ANSWER only):', aiScore);
                        
                        // Check for Key Errors to flag for Admin
                        const hasKeyError = report.suggestions.some(s => s.isKeyError === true);
                        if (hasKeyError) console.log('⚠️ AI DETECTED POTENTIAL QUIZ KEY ERROR!');

                        const { error: updateError } = await db.supabase
                            .from('quiz_attempts')
                            .update({
                                correct: finalCorrect,
                                score: aiScore,
                                passed: aiScore >= passThreshold,
                                metadata: { 
                                    ...attempt.metadata, // Keep original metadata
                                    ai_evaluated: true, 
                                    ai_report: report, 
                                    model_used: modelToUse,
                                    overrides: autoOverrides, // Only SHORT ANSWER overrides applied
                                    status: 'ai_reviewed',
                                    has_key_error: hasKeyError // FLAG FOR ADMIN
                                }
                            })
                            .eq('id', id);

                        if (updateError) throw updateError;
                        console.log('Database updated with AI results successfully.');
                    }
                } catch (e) {
                    console.error('CRITICAL: Background AI Eval Failed:', e);
                } finally {
                    console.log('--- BACKGROUND AI EVALUATION FINISHED ---');
                }
            };

            runBackgroundAi(attemptId);

            // 4. CLEANUP BACKUP
            localStorage.removeItem(`quiz_answers_${quizId}`);

        } catch (error) {
            console.error('Error submitting quiz:', error);
            const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown database error');
            setSubmissionError(`Submission failed: ${errorMessage}. Please try again or contact support.`);
        } finally {
            setSubmitting(false);
        }
    }, [quiz, submitting, answers, user.id, addXP, addBadge, onComplete, quizId]);

    const handleExit = async () => {
        if (!quiz || submitting) return;
        
        // Lock the quiz by creating a failed attempt
        try {
            setSubmitting(true);
            await db.createQuizAttempt({
                quiz_id: quiz.id,
                user_id: user.id,
                answers,
                score: 0,
                correct: 0,
                total: quiz.questions.length,
                passed: false,
                metadata: { exited: true }
            });
            onBack();
            onComplete();
        } catch (error) {
            console.error('Error locking quiz on exit:', error);
            onBack();
        } finally {
                        setSubmitting(false);
        }
    };

    useEffect(() => {
        if (!quiz || isComplete || !quizStarted) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [quiz, isComplete, quizStarted]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswer = (value) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion]: value
        }));
    };

    if (loading || !quiz) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    const question = quiz.questions[currentQuestion];
    const isFirstQuestion = currentQuestion === 0;
    const isLastQuestion = currentQuestion === quiz.questions.length - 1;
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    // Result screen
    if (isComplete && results) {
        const isFinalized = results.manually_evaluated === true || results.finalized === true;

        return (
            <div className="quiz-container animate-fade-in" style={{ width: '100%' }}>
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        margin: '0 auto var(--space-lg)',
                        borderRadius: '50%',
                        background: !isFinalized 
                            ? 'rgba(167, 139, 250, 0.1)' 
                            : (results.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {!isFinalized ? (
                            <Clock size={48} style={{ color: 'var(--primary-500)' }} />
                        ) : results.passed ? (
                            <Trophy size={48} style={{ color: 'var(--success-500)' }} />
                        ) : (
                            <XCircle size={48} style={{ color: 'var(--error-500)' }} />
                        )}
                    </div>

                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>
                        {!isFinalized ? 'Quiz Submitted Successfully! 📄' : (results.passed ? 'Congratulations! 🎉' : 'Keep Practicing!')}
                    </h2>
                    
                    {!isFinalized ? (
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)', fontSize: 'var(--text-lg)' }}>
                            Your quiz is currently **under review** by your instructor. 
                            <br />
                            You will receive a notification when your final grade is ready.
                            <br /><br />
                            <span style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                                💡 AI has provided an initial evaluation, but your instructor will finalize your grade.
                            </span>
                        </p>
                    ) : (
                        <>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                                {results.passed ? 'You passed the quiz!' : 'You need 70% to pass. Try again!'}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 grid-3-mobile-1 gap-md mb-xl">
                                <Card variant="secondary" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: results.passed ? 'var(--success-500)' : 'var(--error-500)' }}>
                                        {results.score}%
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Score</div>
                                </Card>
                                <Card variant="secondary" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                                        {results.correct}/{results.total}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Correct</div>
                                </Card>
                                <Card variant="secondary" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--primary-500)' }}>
                                        +{results.xpEarned || 0}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>XP Earned</div>
                                </Card>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: '300px', margin: '0 auto' }}>
                        {isFinalized && (
                            <Button variant="secondary" icon={Search} onClick={() => setShowReview(true)}>
                                Review My Answers
                            </Button>
                        )}
                        <Button onClick={onBack}>
                            {isFinalized ? 'Back to Dashboard' : 'Done for Now'}
                        </Button>
                    </div>

                    {showReview && (
                        <div style={{ marginTop: 'var(--space-2xl)', textAlign: 'left' }}>
                            <h3 style={{ marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-sm)' }}>
                                Detailed Review
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                                {quiz.questions.map((q, qIndex) => {
                                    const userAnswer = answers[qIndex];
                                    const isCorrect = q.type === 'boolean' 
                                        ? userAnswer === q.correctAnswer 
                                        : userAnswer === q.correctAnswer;
                                    
                                    return (
                                        <Card key={qIndex} style={{ 
                                            background: 'var(--surface)',
                                            borderLeft: `4px solid ${isCorrect ? 'var(--success-500)' : 'var(--error-500)'}`
                                        }}>
                                            <div className="flex justify-between items-start mb-sm">
                                                <Badge variant="secondary">Question {qIndex + 1}</Badge>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {isCorrect ? (
                                                        <>
                                                            <div style={{
                                                                padding: '4px 10px',
                                                                borderRadius: 'var(--radius-sm)',
                                                                background: 'rgba(34, 197, 94, 0.15)',
                                                                border: '2px solid var(--success-500)',
                                                                fontWeight: 700,
                                                                fontSize: 'var(--text-base)',
                                                                color: 'var(--success-600)'
                                                            }}>
                                                                +1
                                                            </div>
                                                            <Badge variant="success">Correct</Badge>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{
                                                                padding: '4px 10px',
                                                                borderRadius: 'var(--radius-sm)',
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                border: '2px solid var(--error-500)',
                                                                fontWeight: 700,
                                                                fontSize: 'var(--text-base)',
                                                                color: 'var(--error-600)'
                                                            }}>
                                                                -1
                                                            </div>
                                                            <Badge variant="danger">Incorrect</Badge>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p style={{ fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text)' }}>
                                                {q.question}
                                            </p>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                                {q.type === 'multiple' ? (
                                                    q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} style={{
                                                            padding: 'var(--space-sm) var(--space-md)',
                                                            borderRadius: 'var(--radius-md)',
                                                            background: oIdx === q.correctAnswer 
                                                                ? 'rgba(16, 185, 129, 0.1)' 
                                                                : (oIdx === userAnswer ? 'rgba(239, 68, 68, 0.1)' : 'transparent'),
                                                            border: `1px solid ${oIdx === q.correctAnswer 
                                                                ? 'var(--success-500)' 
                                                                : (oIdx === userAnswer ? 'var(--error-500)' : 'var(--border)')}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 'var(--space-sm)',
                                                            fontSize: 'var(--text-sm)'
                                                        }}>
                                                            <div style={{
                                                                width: '8px',
                                                                height: '8px',
                                                                borderRadius: '50%',
                                                                background: oIdx === q.correctAnswer ? 'var(--success-500)' : 'var(--text-muted)'
                                                            }} />
                                                            {opt}
                                                            {oIdx === q.correctAnswer && <Badge variant="success" size="xs" style={{ marginLeft: 'auto' }}>Correct Answer</Badge>}
                                                            {oIdx === userAnswer && oIdx !== q.correctAnswer && <Badge variant="danger" size="xs" style={{ marginLeft: 'auto' }}>Your Answer</Badge>}
                                                        </div>
                                                    ))
                                                ) : q.type === 'boolean' ? (
                                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                                        {[true, false].map((val) => (
                                                            <div key={val.toString()} style={{
                                                                flex: 1,
                                                                padding: 'var(--space-sm)',
                                                                textAlign: 'center',
                                                                borderRadius: 'var(--radius-md)',
                                                                background: val === q.correctAnswer 
                                                                    ? 'rgba(16, 185, 129, 0.1)' 
                                                                    : (val === userAnswer ? 'rgba(239, 68, 68, 0.1)' : 'transparent'),
                                                                border: `1px solid ${val === q.correctAnswer 
                                                                    ? 'var(--success-500)' 
                                                                    : (val === userAnswer ? 'var(--error-500)' : 'var(--border)')}`,
                                                                fontSize: 'var(--text-sm)',
                                                                color: val === q.correctAnswer ? 'var(--success-500)' : 'var(--text-muted)'
                                                            }}>
                                                                {val ? 'True' : 'False'}
                                                                {val === q.correctAnswer && ' (Correct)'}
                                                                {val === userAnswer && val !== q.correctAnswer && ' (You)'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: 'var(--space-md)', background: 'var(--card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                                                            <strong style={{ color: 'var(--success-500)' }}>Correct Answer:</strong> {q.correctAnswer}
                                                        </p>
                                                        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)' }}>
                                                            <strong style={{ color: isCorrect ? 'var(--success-500)' : 'var(--error-500)' }}>Your Answer:</strong> {userAnswer || '(No answer)'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* AI Feedback */}
                                            {results.aiReport && (
                                                <div style={{ 
                                                    marginTop: 'var(--space-md)',
                                                    padding: 'var(--space-md)',
                                                    background: 'rgba(99, 102, 241, 0.05)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid rgba(99, 102, 241, 0.1)'
                                                }}>
                                                    <div className="flex items-center gap-xs mb-xs">
                                                        <Badge variant="primary" size="xs">🤖 AI Feedback</Badge>
                                                        {results.aiReport.suggestions?.find(s => Number(s.questionIndex) === qIndex)?.isKeyError && (
                                                            <Badge variant="warning" size="xs">🚩 Key Error Detected</Badge>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                                        {results.aiReport.suggestions?.find(s => Number(s.questionIndex) === qIndex)?.feedback || 'No specific feedback for this question.'}
                                                    </p>
                                                    {results.aiReport.suggestions?.find(s => Number(s.questionIndex) === qIndex)?.improvementTip && (
                                                        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--primary-400)', fontWeight: 500 }}>
                                                            💡 Tip: {results.aiReport.suggestions.find(s => Number(s.questionIndex) === qIndex).improvementTip}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                            <Button variant="secondary" onClick={() => {
                                setShowReview(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} style={{ marginTop: 'var(--space-xl)', width: '100%' }}>
                                Back to Top
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    // Briefing screen
    if (!quizStarted && !isComplete) {
        return (
            <div className="quiz-container animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <Card style={{ padding: 'var(--space-2xl)' }}>
                    <div className="flex flex-col items-center text-center">
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'rgba(167, 139, 250, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 'var(--space-lg)'
                        }}>
                            <Timer size={40} style={{ color: 'var(--primary-500)' }} />
                        </div>
                        
                        <h2 style={{ marginBottom: 'var(--space-sm)' }}>{quiz.title}</h2>
                        <Badge variant={getDifficultyColor(quiz.difficulty)} style={{ marginBottom: 'var(--space-xl)' }}>
                            {quiz.difficulty}
                        </Badge>

                        <div style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-xl)', border: '1px solid var(--border)' }}>
                            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--text)' }}>Quiz Rules:</h4>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', paddingLeft: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                                <li>Time Limit: <strong>{quiz.time_limit} minutes</strong></li>
                                <li>Total Questions: <strong>{quiz.questions?.length}</strong></li>
                                <li>Passing Score: <strong>70%</strong></li>
                                <li>Potential XP: <strong>+{quiz.points} XP</strong></li>
                                <li style={{ color: 'var(--error-500)' }}>Once you start, the timer cannot be paused.</li>
                                <li style={{ color: 'var(--error-500)' }}>AI will evaluate your answers after submission.</li>
                            </ul>
                        </div>

                        <div className="flex gap-md w-full">
                            <Button variant="secondary" onClick={onBack} style={{ flex: 1 }}>
                                Not Now
                            </Button>
                            <Button onClick={() => setQuizStarted(true)} style={{ flex: 2 }}>
                                Start Quiz
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="quiz-container animate-fade-in">
            {/* Submission Overlay */}
            {submitting && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    color: 'white',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="loading-spinner" style={{ marginBottom: 'var(--space-md)', width: '60px', height: '60px', borderTopColor: 'white' }} />
                    <h3 style={{ color: 'white', marginBottom: 'var(--space-xs)' }}>Saving Your Answers...</h3>
                    <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please don't refresh the page.</p>
                </div>
            )}

            {/* Header */}
            <div className="quiz-header">
                <div className="flex items-center gap-md">
                    <Button variant="ghost" size="icon" onClick={() => setShowConfirm(true)}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{quiz.title}</h2>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            Question {currentQuestion + 1} of {quiz.questions.length}
                        </p>
                    </div>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.1)' : 'var(--card)',
                    borderRadius: 'var(--radius-lg)',
                    color: timeLeft < 60 ? 'var(--error-500)' : 'var(--text)'
                }}>
                    <Timer size={18} />
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatTime(timeLeft)}
                    </span>
                </div>
                <Button 
                    variant="success" 
                    size="sm" 
                    onClick={handleSubmit}
                    disabled={submitting}
                    loading={submitting}
                >
                    Submit Quiz
                </Button>
            </div>

            {/* Progress Bar */}
            <div style={{
                height: '4px',
                background: 'var(--border)',
                borderRadius: 'var(--radius-full)',
                marginBottom: 'var(--space-xl)',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'var(--gradient-primary)',
                    transition: 'width 0.3s ease'
                }} />
            </div>

            {/* Question Card */}
            <Card style={{
                maxWidth: '800px',
                margin: '0 auto',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 'var(--space-xl)', fontSize: 'var(--text-xl)' }}>
                        {question.question}
                    </h3>

                    {/* Multiple Choice */}
                    {question.type === 'multiple' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {question.options.map((option, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleAnswer(index)}
                                    className={`quiz-option ${answers[currentQuestion] === index ? 'selected' : ''}`}
                                >
                                    <div className="quiz-radio" />
                                    <span>{option}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Boolean */}
                    {question.type === 'boolean' && (
                        <div className="flex gap-md">
                            {[true, false].map(value => (
                                <div
                                    key={value.toString()}
                                    onClick={() => handleAnswer(value)}
                                    className={`quiz-option ${answers[currentQuestion] === value ? 'selected' : ''}`}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                >
                                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>
                                        {value ? 'True' : 'False'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Short Answer */}
                    {question.type === 'short' && (
                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <textarea
                                className="input"
                                placeholder="Type your answer here..."
                                value={answers[currentQuestion] || ''}
                                onChange={(e) => handleAnswer(e.target.value)}
                                style={{ 
                                    minHeight: '120px', 
                                    fontSize: 'var(--text-lg)',
                                    resize: 'none',
                                    background: 'var(--surface)',
                                    padding: 'var(--space-md)'
                                }}
                                autoFocus
                            />
                            <p style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Tip: Be clear and concise. Your answer will be reviewed by an admin.
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center" style={{
                    paddingTop: 'var(--space-lg)',
                    borderTop: '1px solid var(--border)',
                    marginTop: 'var(--space-lg)'
                }}>
                    <Button
                        variant="secondary"
                        icon={ArrowLeft}
                        onClick={() => setCurrentQuestion(prev => prev - 1)}
                        disabled={isFirstQuestion}
                    >
                        Previous
                    </Button>

                    <div className="flex gap-xs">
                        {quiz.questions.map((_, index) => (
                            <div
                                key={index}
                                onClick={() => setCurrentQuestion(index)}
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: answers[index] !== undefined
                                        ? 'var(--primary-500)'
                                        : 'var(--border)',
                                    border: currentQuestion === index ? '2px solid var(--primary-400)' : 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        ))}
                    </div>

                    {isLastQuestion ? (
                        <Button
                            variant="success"
                            icon={CheckCircle}
                            onClick={handleSubmit}
                            disabled={Object.keys(answers).length < quiz.questions.length || submitting}
                            loading={submitting}
                        >
                            Submit Quiz
                        </Button>
                    ) : (
                        <Button
                            icon={ArrowRight}
                            iconPosition="right"
                            onClick={() => setCurrentQuestion(prev => prev + 1)}
                        >
                            Next
                        </Button>
                    )}
                </div>
            </Card>

            {/* Exit Confirmation Modal */}
            <Modal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                title="Exit Quiz?"
                size="sm"
            >
                <p style={{ marginBottom: 'var(--space-lg)' }}>
                    Are you sure you want to exit? <strong>This will count as a failed attempt and the quiz will be locked.</strong>
                </p>
                <div className="flex justify-end gap-md">
                    <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                        Continue Quiz
                    </Button>
                    <Button variant="danger" onClick={handleExit} loading={submitting}>
                        Exit & Lock Quiz
                    </Button>
                </div>
            </Modal>

            {submissionError && (
                <Modal
                    isOpen={true}
                    onClose={() => setSubmissionError(null)}
                    title="Submission Failed"
                >
                    <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
                        <XCircle size={48} style={{ color: 'var(--error-500)', marginBottom: 'var(--space-md)' }} />
                        <p style={{ marginBottom: 'var(--space-lg)' }}>{submissionError}</p>
                        <div className="flex gap-md justify-center">
                            <Button variant="secondary" onClick={() => setSubmissionError(null)}>
                                Close
                            </Button>
                            <Button onClick={handleSubmit}>
                                Try Again
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}


        </div>
    );
};

export default Quizzes;
