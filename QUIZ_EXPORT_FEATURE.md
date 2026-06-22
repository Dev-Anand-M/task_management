# Quiz Export Feature

## Overview

Added export functionality for quiz attempts in both CSV and XLSX formats.

## Features

### 1. Student Export (After Results Finalized)
**Location**: `/quizzes` → View completed quiz results

**What Students Can Export**:
- Quiz metadata (title, category, difficulty)
- Their score and pass/fail status
- Number of correct answers
- Completion date
- All questions with their answers
- Correct answers for comparison
- Question-by-question results (Correct/Incorrect)

**Formats Available**:
- **CSV**: Simple text format, opens in Excel/Sheets
- **XLSX**: Excel format with multiple sheets (Summary + Questions)

**Restrictions**:
- ✅ Can only export AFTER quiz is finalized by admin
- ❌ Cannot export while quiz is "Under Review"
- ✅ Export buttons appear below "Review My Answers" button

### 2. Admin Export (Bulk Export)
**Location**: Admin → Evaluation Center → Quizzes tab

**What Admins Can Export**:
- All quiz attempts in a single file
- For each attempt:
  - Quiz title
  - Student name
  - Score (%)
  - Pass/Fail status
  - Number correct/total
  - Completion date
  - Finalization status

**Format**: XLSX only (Excel)

**Button Location**: Top right, next to "Refresh Data"

---

## How to Use

### For Students

1. **Complete a quiz** and submit it
2. **Wait for admin** to finalize the results
3. Once finalized, open the quiz results
4. Click "Review My Answers" to see detailed breakdown
5. Click **"CSV"** or **"XLSX"** button to download

### For Admins

1. Go to **Admin → Evaluation Center**
2. Click the **"Quizzes"** tab
3. Click **"Export All"** button (top right)
4. Excel file downloads with all quiz attempts

---

## Export File Structure

### Student Export (CSV)

```
Quiz Export Report

Student Name,John Doe
Quiz Title,HTML Basics Quiz
Quiz Category,Frontend
Difficulty,easy
Score,85%
Status,PASSED
Correct Answers,17/20
Completed At,6/17/2026, 3:45:30 PM
Finalized,Yes

Question #,Question,Question Type,Your Answer,Correct Answer,Result
1,"What is HTML?",multiple,"Markup Language","Markup Language",Correct
2,"Is HTML a programming language?",boolean,"false","false",Correct
3,"Explain HTML",short,"It provides structure","Provides structure to web pages",Correct (Manual)
```

### Student Export (XLSX)

**Sheet 1: Summary**
- Student metadata
- Quiz information
- Score and status

**Sheet 2: Questions & Answers**
- All questions with answers
- Question-by-question breakdown
- Results for each question

### Admin Export (XLSX)

**Single Sheet: All Quiz Attempts**

| Quiz | Student | Score | Status | Correct | Total | Completed At | Finalized |
|------|---------|-------|--------|---------|-------|--------------|-----------|
| HTML Basics | John Doe | 85% | PASSED | 17 | 20 | 6/17/2026... | Yes |
| CSS Fundamentals | Jane Smith | 92% | PASSED | 23 | 25 | 6/17/2026... | Yes |
| JavaScript Quiz | Mike Johnson | 60% | FAILED | 12 | 20 | 6/17/2026... | Yes |

---

## Technical Implementation

### Files Created

1. **`src/utils/exportQuiz.js`**
   - `exportQuizToCSV()` - Student CSV export
   - `exportQuizToXLSX()` - Student Excel export
   - `exportAllQuizAttemptsToXLSX()` - Admin bulk export

### Files Modified

1. **`src/pages/member/Quizzes.jsx`**
   - Added import for export utilities
   - Added CSV and XLSX buttons (only shown when finalized)
   - Buttons appear after "Review My Answers"

2. **`src/pages/admin/EvaluationCenter.jsx`**
   - Added import for bulk export utility
   - Added "Export All" button in Quiz tab header
   - Fetches all quiz and profile data for export

3. **`package.json`**
   - Added `xlsx` dependency for Excel file generation

---

## Dependencies

- **xlsx**: Library for generating Excel files
  - Version: Latest
  - Used for: Creating .xlsx files with multiple sheets

---

## Export Logic

### Question Type Handling

**Multiple Choice (MCQ)**:
- Shows the option text (not just the index)
- Compares student's selection with correct answer
- Result: "Correct" or "Incorrect"

**Boolean (True/False)**:
- Shows "true" or "false" as text
- String comparison for correctness
- Result: "Correct" or "Incorrect"

**Short Answer**:
- Shows student's text response
- Shows expected answer
- If manually evaluated: "Correct (Manual)" or "Incorrect (Manual)"
- If not yet evaluated: "Pending Review"

### CSV Escaping

- Automatically handles commas in questions/answers
- Wraps text with commas in quotes
- Escapes double quotes properly
- Safe for Excel/Google Sheets

---

## Security & Privacy

✅ **Students can only export their own attempts**
- Export functions receive the attempt data that's already filtered by user ID
- No direct database access from export functions

✅ **Students can only export finalized attempts**
- Export buttons hidden until `metadata.finalized === true`
- Cannot see results before admin finalizes

✅ **Admins can export all attempts**
- Uses existing `db.getQuizAttempts()` which already filters by admin permissions
- Respects classroom boundaries

---

## File Naming Convention

**Student Exports**:
```
quiz-{quiz_title}-{student_name}.csv
quiz-{quiz_title}-{student_name}.xlsx
```

Example: `quiz-HTML_Basics-John_Doe.xlsx`

**Admin Exports**:
```
all-quiz-attempts-{date}.xlsx
```

Example: `all-quiz-attempts-2026-06-17.xlsx`

---

## Future Enhancements

Potential improvements (not implemented):

- [ ] Filter admin export by date range
- [ ] Export with AI evaluation comments
- [ ] PDF export option
- [ ] Export individual student's all quizzes
- [ ] Export quiz question bank as template
- [ ] Email export directly to students
- [ ] Schedule automatic exports
- [ ] Export to Google Sheets directly
- [ ] Analytics dashboard export

---

## Testing Checklist

- [x] Student can export finalized quiz (CSV)
- [x] Student can export finalized quiz (XLSX)
- [x] Export buttons hidden when quiz not finalized
- [x] CSV handles special characters (commas, quotes)
- [x] XLSX has correct sheet structure
- [x] Admin can export all quiz attempts
- [x] Admin export includes all attempts
- [x] File names are clean and descriptive
- [x] MCQ questions show option text (not index)
- [x] Boolean questions show true/false
- [x] Short answer shows manual evaluation status
- [x] Download triggers immediately
- [x] Files open correctly in Excel/Sheets

---

## Usage Statistics (To Track)

Monitor these metrics after deployment:
- Number of student exports per week
- CSV vs XLSX preference
- Admin bulk export frequency
- File size distribution
- Error rate (if any)

---

## Support

If students or admins have issues:

1. **Export button not appearing**:
   - Check if quiz is finalized (students)
   - Check if any attempts exist (admin)

2. **File not downloading**:
   - Check browser pop-up blocker
   - Try different browser
   - Check download folder

3. **File won't open**:
   - Ensure Excel/Libre Office installed
   - Try Google Sheets (upload the file)
   - Check file extension (.csv or .xlsx)

4. **Wrong data in export**:
   - Refresh the page
   - Re-export the file
   - Check if quiz was updated after attempt
