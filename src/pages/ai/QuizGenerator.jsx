import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../../components/common';
import {
    HelpCircle,
    Sparkles,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Trophy,
    ArrowRight,
    BookOpen,
    Trash2
} from 'lucide-react';
import * as aiService from '../../services/aiService';

const DIFFICULTY_LEVELS = [
    { value: 'easy', label: 'Easy', color: 'var(--success-500)' },
    { value: 'medium', label: 'Medium', color: 'var(--warning-500)' },
    { value: 'hard', label: 'Hard', color: 'var(--error-500)' }
];

const SUGGESTED_TOPICS = [
    'JavaScript Fundamentals',
    'React Components',
    'CSS Layouts',
    'HTML Semantics',
    'Node.js Basics',
    'SQL Queries',
    'Git Commands',
    'REST API Design'
];

const QuizGenerator = () => {
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('medium');
    const [questionCount, setQuestionCount] = useState(5);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [quizComplete, setQuizComplete] = useState(false);
    const [answers, setAnswers] = useState([]);

    // History state
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);



    useEffect(() => {
        const loadInitData = async () => {
            // Load History
            await loadHistory();

            // Load models? (Quiz doesn't use model selector explicitly in UI currently but service supports it.
            // I'll add model selection since I'm here, or just stick to default.
            // The original code didn't exhibit model selection for Quiz, but `generateQuiz` supports it.
            // I'll leave model selection out to minimize changes unless requested, but sticking to history is key.
        };
        loadInitData();
    }, []);

    const loadHistory = async () => {
        setHistoryLoading(true);
        const data = await aiService.getHistory('quiz');
        setHistory(data || []);
        setHistoryLoading(false);
    };

    const loadQuizItem = (item) => {
        if (item.content) {
            setTopic(item.content.topic || '');
            setDifficulty(item.content.difficulty || 'medium');
            setQuestions(item.content.questions || []);
            setQuestionCount(item.content.questions?.length || 5);

            // Reset state
            setCurrentQuestion(0);
            setSelectedAnswer(null);
            setShowResult(false);
            setScore(0);
            setQuizComplete(false);
            setAnswers([]);
        }
    };

    const deleteQuizItem = async (e, id) => {
        e.stopPropagation();
        if (confirm('Delete this quiz?')) {
            await aiService.deleteHistoryItem(id);
            loadHistory();
        }
    };

    const handleGenerate = async () => {
        if (!topic.trim()) return;

        if (!aiService.isAnyAPIKeyConfigured()) {
            alert('Please configure an AI provider (Gemini, OpenAI, etc.) in Settings > AI Settings.');
            return;
        }

        setLoading(true);
        setQuestions([]);
        setCurrentQuestion(0);
        setScore(0);
        setQuizComplete(false);
        setAnswers([]);

        try {
            const generatedQuestions = await aiService.generateQuiz(topic, difficulty, questionCount);
            setQuestions(generatedQuestions);

            // Save to history
            const title = `Quiz: ${topic} (${difficulty})`;
            await aiService.saveHistory('quiz', {
                questions: generatedQuestions,
                topic,
                difficulty
            }, title);
            loadHistory();

        } catch (error) {
            alert(`Failed to generate quiz: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (answerIndex) => {
        setSelectedAnswer(answerIndex);
        setShowResult(true);

        const isCorrect = answerIndex === questions[currentQuestion].correctAnswer;
        if (isCorrect) {
            setScore(score + 1);
        }

        setAnswers([...answers, {
            question: questions[currentQuestion].question,
            selected: answerIndex,
            correct: questions[currentQuestion].correctAnswer,
            isCorrect
        }]);
    };

    const nextQuestion = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        } else {
            setQuizComplete(true);
        }
    };

    const resetQuiz = () => {
        setQuestions([]);
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setScore(0);
        setQuizComplete(false);
        setAnswers([]);
    };

    const getScoreMessage = () => {
        const percentage = (score / questions.length) * 100;
        if (percentage === 100) return { text: 'Perfect Score! 🎉', color: 'var(--success-500)' };
        if (percentage >= 80) return { text: 'Excellent! 🌟', color: 'var(--success-500)' };
        if (percentage >= 60) return { text: 'Good Job! 👍', color: 'var(--warning-500)' };
        if (percentage >= 40) return { text: 'Keep Practicing! 📚', color: 'var(--warning-500)' };
        return { text: 'Need More Study! 💪', color: 'var(--error-500)' };
    };

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 'var(--space-md)' }}>

            {/* History Sidebar */}
            <Card style={{ width: '260px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Button onClick={resetQuiz} style={{ width: '100%' }}>
                        <RefreshCw size={16} />
                        <span style={{ marginLeft: '8px' }}>New Quiz</span>
                    </Button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No past quizzes
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {history.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => loadQuizItem(item)}
                                    className="history-item"
                                    style={{
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        fontSize: 'var(--text-sm)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        color: 'var(--text-main)'
                                    }}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString()}</div>
                                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                                    </div>
                                    <Trash2
                                        size={14}
                                        className="delete-icon"
                                        style={{ opacity: 0.5 }}
                                        onClick={(e) => deleteQuizItem(e, item.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Main Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-lg">
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <HelpCircle className="text-primary" />
                            AI Quiz Generator
                        </h2>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                            Generate custom quizzes on any topic to test your knowledge
                        </p>
                    </div>
                </div>

                {questions.length === 0 && !loading && (
                    <Card>
                        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Create Your Quiz</h3>

                        <Input
                            label="Quiz Topic"
                            placeholder="e.g., JavaScript Array Methods"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />

                        {/* Suggested Topics */}
                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <label className="input-label">Quick Select</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                {SUGGESTED_TOPICS.map(t => (
                                    <Badge
                                        key={t}
                                        style={{
                                            cursor: 'pointer',
                                            padding: 'var(--space-xs) var(--space-sm)',
                                            background: topic === t ? 'var(--primary-500)' : undefined,
                                            color: topic === t ? 'white' : undefined
                                        }}
                                        onClick={() => setTopic(t)}
                                    >
                                        {t}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className="input-group" style={{ marginTop: 'var(--space-lg)' }}>
                            <label className="input-label">Difficulty Level</label>
                            <div className="flex gap-sm">
                                {DIFFICULTY_LEVELS.map(level => (
                                    <button
                                        key={level.value}
                                        onClick={() => setDifficulty(level.value)}
                                        className={`btn ${difficulty === level.value ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{
                                            flex: 1,
                                            borderColor: difficulty === level.value ? level.color : undefined,
                                            background: difficulty === level.value ? level.color : undefined
                                        }}
                                    >
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Question Count */}
                        <div className="input-group" style={{ marginTop: 'var(--space-lg)' }}>
                            <label className="input-label">Number of Questions: {questionCount}</label>
                            <input
                                type="range"
                                min="3"
                                max="10"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={!topic.trim()}
                            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                        >
                            <Sparkles size={18} />
                            <span style={{ marginLeft: '8px' }}>Generate Quiz</span>
                        </Button>
                    </Card>
                )}

                {/* Loading */}
                {loading && (
                    <Card style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary-500)', marginBottom: 'var(--space-md)' }} />
                        <h3>Generating Your Quiz...</h3>
                        <p style={{ color: 'var(--text-muted)' }}>
                            AI is creating {questionCount} questions about "{topic}"
                        </p>
                    </Card>
                )}

                {/* Quiz Questions */}
                {questions.length > 0 && !quizComplete && (
                    <Card>
                        {/* Progress */}
                        <div className="flex justify-between items-center mb-md">
                            <Badge>Question {currentQuestion + 1} of {questions.length}</Badge>
                            <Badge variant="primary">Score: {score}/{currentQuestion + (showResult ? 1 : 0)}</Badge>
                        </div>
                        <div style={{
                            height: '4px',
                            background: 'var(--border)',
                            borderRadius: '2px',
                            marginBottom: 'var(--space-lg)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${((currentQuestion + (showResult ? 1 : 0)) / questions.length) * 100}%`,
                                height: '100%',
                                background: 'var(--primary-500)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        {/* Question */}
                        <h3 style={{ marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
                            {questions[currentQuestion].question}
                        </h3>

                        {/* Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {questions[currentQuestion].options.map((option, index) => {
                                const isSelected = selectedAnswer === index;
                                const isCorrect = index === questions[currentQuestion].correctAnswer;

                                let bgColor = 'var(--surface)';
                                let borderColor = 'var(--border)';

                                if (showResult) {
                                    if (isCorrect) {
                                        bgColor = 'rgba(16, 185, 129, 0.1)';
                                        borderColor = 'var(--success-500)';
                                    } else if (isSelected && !isCorrect) {
                                        bgColor = 'rgba(239, 68, 68, 0.1)';
                                        borderColor = 'var(--error-500)';
                                    }
                                } else if (isSelected) {
                                    bgColor = 'rgba(99, 102, 241, 0.1)';
                                    borderColor = 'var(--primary-500)';
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => !showResult && handleAnswer(index)}
                                        disabled={showResult}
                                        style={{
                                            padding: 'var(--space-md)',
                                            background: bgColor,
                                            border: `2px solid ${borderColor}`,
                                            borderRadius: 'var(--radius-md)',
                                            textAlign: 'left',
                                            cursor: showResult ? 'default' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <span style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: showResult && isCorrect ? 'var(--success-500)' :
                                                showResult && isSelected && !isCorrect ? 'var(--error-500)' :
                                                    'var(--border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: showResult ? 'white' : 'var(--text-muted)',
                                            fontSize: 'var(--text-sm)',
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            {showResult && isCorrect ? <CheckCircle size={14} /> :
                                                showResult && isSelected && !isCorrect ? <XCircle size={14} /> :
                                                    String.fromCharCode(65 + index)}
                                        </span>
                                        <span>{option}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation */}
                        {showResult && questions[currentQuestion].explanation && (
                            <div style={{
                                marginTop: 'var(--space-lg)',
                                padding: 'var(--space-md)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--primary-500)'
                            }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
                                    <BookOpen size={16} /> Explanation
                                </strong>
                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                    {questions[currentQuestion].explanation}
                                </p>
                            </div>
                        )}

                        {/* Next Button */}
                        {showResult && (
                            <Button
                                onClick={nextQuestion}
                                style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                            >
                                {currentQuestion < questions.length - 1 ? (
                                    <>
                                        Next Question
                                        <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                                    </>
                                ) : (
                                    <>
                                        See Results
                                        <Trophy size={18} style={{ marginLeft: '8px' }} />
                                    </>
                                )}
                            </Button>
                        )}
                    </Card>
                )}

                {/* Quiz Complete */}
                {quizComplete && (
                    <Card style={{ textAlign: 'center' }}>
                        <Trophy size={64} style={{ color: getScoreMessage().color, marginBottom: 'var(--space-md)' }} />
                        <h2 style={{ color: getScoreMessage().color, marginBottom: 'var(--space-sm)' }}>
                            {getScoreMessage().text}
                        </h2>
                        <p style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-lg)' }}>
                            You scored <strong>{score}</strong> out of <strong>{questions.length}</strong>
                        </p>

                        {/* Review Answers */}
                        <div style={{ textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
                            <h4 style={{ marginBottom: 'var(--space-md)' }}>Review Your Answers</h4>
                            {answers.map((answer, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: 'var(--space-sm)',
                                        marginBottom: 'var(--space-xs)',
                                        background: answer.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)'
                                    }}
                                >
                                    {answer.isCorrect ? (
                                        <CheckCircle size={16} style={{ color: 'var(--success-500)', flexShrink: 0 }} />
                                    ) : (
                                        <XCircle size={16} style={{ color: 'var(--error-500)', flexShrink: 0 }} />
                                    )}
                                    <span style={{ fontSize: 'var(--text-sm)' }}>
                                        Q{index + 1}: {answer.question.substring(0, 50)}...
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-md justify-center">
                            <Button variant="secondary" onClick={resetQuiz}>
                                <RefreshCw size={18} />
                                <span style={{ marginLeft: '8px' }}>New Quiz</span>
                            </Button>
                            <Button onClick={() => { resetQuiz(); handleGenerate(); }}>
                                <Sparkles size={18} />
                                <span style={{ marginLeft: '8px' }}>Try Again</span>
                            </Button>
                        </div>
                    </Card>
                )}
            </div>

            <style>{`
                .btn { padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); font-weight: 500; transition: all var(--transition-fast); cursor: pointer; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; }
                .btn-primary { background: var(--primary-500); color: white; }
                .btn-secondary { background: var(--card); border-color: var(--border); color: var(--text-main); }
                .btn:hover { opacity: 0.9; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .history-item:hover { background: var(--surface-hover/50) !important; }
                .history-item:hover .delete-icon { opacity: 1 !important; color: var(--error-500); }
            `}</style>
        </div>
    );
};

export default QuizGenerator;
