import * as XLSX from 'xlsx';

/**
 * Export quiz attempt to CSV format
 */
export const exportQuizToCSV = (attempt, quiz, userName) => {
    const lines = [];
    
    // Header
    lines.push('Quiz Export Report');
    lines.push('');
    
    // Metadata
    lines.push(`Student Name,${userName}`);
    lines.push(`Quiz Title,${quiz.title}`);
    lines.push(`Quiz Category,${quiz.category}`);
    lines.push(`Difficulty,${quiz.difficulty}`);
    lines.push(`Score,${attempt.score}%`);
    lines.push(`Status,${attempt.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Correct Answers,${attempt.correct}/${attempt.total}`);
    lines.push(`Completed At,${new Date(attempt.completed_at).toLocaleString()}`);
    lines.push(`Finalized,${attempt.metadata?.finalized ? 'Yes' : 'No'}`);
    lines.push('');
    
    // Questions and Answers Header
    lines.push('Question #,Question,Question Type,Your Answer,Correct Answer,Result');
    
    // Questions
    quiz.questions.forEach((q, index) => {
        const userAnswer = attempt.answers[index];
        let userAnswerText = '';
        let correctAnswerText = '';
        let result = '';
        
        if (q.type === 'multiple') {
            userAnswerText = q.options[userAnswer] || 'Not answered';
            correctAnswerText = q.options[q.correctAnswer];
            result = userAnswer === q.correctAnswer ? 'Correct' : 'Incorrect';
        } else if (q.type === 'boolean') {
            userAnswerText = String(userAnswer);
            correctAnswerText = String(q.correctAnswer);
            result = String(userAnswer) === String(q.correctAnswer) ? 'Correct' : 'Incorrect';
        } else if (q.type === 'short') {
            userAnswerText = userAnswer || 'Not answered';
            correctAnswerText = q.correctAnswer;
            // Check if manually evaluated
            const override = attempt.metadata?.overrides?.[index];
            result = override !== undefined ? (override ? 'Correct (Manual)' : 'Incorrect (Manual)') : 'Pending Review';
        }
        
        // Escape commas and quotes in text
        const escapeCSV = (text) => {
            if (!text) return '';
            text = String(text);
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };
        
        lines.push([
            index + 1,
            escapeCSV(q.question),
            q.type,
            escapeCSV(userAnswerText),
            escapeCSV(correctAnswerText),
            result
        ].join(','));
    });
    
    // Create blob and download
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz-${quiz.title.replace(/[^a-z0-9]/gi, '_')}-${userName.replace(/[^a-z0-9]/gi, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Export quiz attempt to XLSX format
 */
export const exportQuizToXLSX = (attempt, quiz, userName) => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Summary
    const summaryData = [
        ['Quiz Export Report'],
        [],
        ['Student Name', userName],
        ['Quiz Title', quiz.title],
        ['Quiz Category', quiz.category],
        ['Difficulty', quiz.difficulty],
        ['Score', `${attempt.score}%`],
        ['Status', attempt.passed ? 'PASSED' : 'FAILED'],
        ['Correct Answers', `${attempt.correct}/${attempt.total}`],
        ['Completed At', new Date(attempt.completed_at).toLocaleString()],
        ['Finalized', attempt.metadata?.finalized ? 'Yes' : 'No']
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths
    ws1['!cols'] = [
        { wch: 20 },
        { wch: 40 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    // Sheet 2: Questions and Answers
    const questionsData = [
        ['Question #', 'Question', 'Type', 'Your Answer', 'Correct Answer', 'Result']
    ];
    
    quiz.questions.forEach((q, index) => {
        const userAnswer = attempt.answers[index];
        let userAnswerText = '';
        let correctAnswerText = '';
        let result = '';
        
        if (q.type === 'multiple') {
            userAnswerText = q.options[userAnswer] || 'Not answered';
            correctAnswerText = q.options[q.correctAnswer];
            result = userAnswer === q.correctAnswer ? 'Correct' : 'Incorrect';
        } else if (q.type === 'boolean') {
            userAnswerText = String(userAnswer);
            correctAnswerText = String(q.correctAnswer);
            result = String(userAnswer) === String(q.correctAnswer) ? 'Correct' : 'Incorrect';
        } else if (q.type === 'short') {
            userAnswerText = userAnswer || 'Not answered';
            correctAnswerText = q.correctAnswer;
            const override = attempt.metadata?.overrides?.[index];
            result = override !== undefined ? (override ? 'Correct (Manual)' : 'Incorrect (Manual)') : 'Pending Review';
        }
        
        questionsData.push([
            index + 1,
            q.question,
            q.type,
            userAnswerText,
            correctAnswerText,
            result
        ]);
    });
    
    const ws2 = XLSX.utils.aoa_to_sheet(questionsData);
    
    // Set column widths
    ws2['!cols'] = [
        { wch: 10 },  // Question #
        { wch: 50 },  // Question
        { wch: 15 },  // Type
        { wch: 30 },  // Your Answer
        { wch: 30 },  // Correct Answer
        { wch: 20 }   // Result
    ];
    
    XLSX.utils.book_append_sheet(wb, ws2, 'Questions & Answers');
    
    // Download
    XLSX.writeFile(wb, `quiz-${quiz.title.replace(/[^a-z0-9]/gi, '_')}-${userName.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
};

/**
 * Export multiple quiz attempts (Admin bulk export)
 */
export const exportAllQuizAttemptsToXLSX = (attempts, quizzes, profiles) => {
    const wb = XLSX.utils.book_new();
    
    // Create summary data
    const summaryData = [
        ['Quiz', 'Student', 'Score', 'Status', 'Correct', 'Total', 'Completed At', 'Finalized']
    ];
    
    attempts.forEach(attempt => {
        const quiz = quizzes.find(q => q.id === attempt.quiz_id);
        const profile = profiles.find(p => p.id === attempt.user_id);
        
        if (quiz && profile) {
            summaryData.push([
                quiz.title,
                profile.name,
                `${attempt.score}%`,
                attempt.passed ? 'PASSED' : 'FAILED',
                attempt.correct,
                attempt.total,
                new Date(attempt.completed_at).toLocaleString(),
                attempt.metadata?.finalized ? 'Yes' : 'No'
            ]);
        }
    });
    
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 30 },  // Quiz
        { wch: 20 },  // Student
        { wch: 10 },  // Score
        { wch: 10 },  // Status
        { wch: 10 },  // Correct
        { wch: 10 },  // Total
        { wch: 20 },  // Completed At
        { wch: 12 }   // Finalized
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'All Quiz Attempts');
    
    // Download
    XLSX.writeFile(wb, `all-quiz-attempts-${new Date().toISOString().split('T')[0]}.xlsx`);
};
