# How to Fix Your CSV File

## The Problem

Your boolean questions are using the WRONG format:

❌ **WRONG** (MCQ-style):
```csv
"boolean","Question?","True","False",,,,1
```

✅ **CORRECT** (Simple):
```csv
"boolean","Question?","False"
```

## Quick Fix Instructions

For every boolean question in your CSV:

### If the answer should be TRUE:
```csv
"boolean","Your question here","True"
```

### If the answer should be FALSE:
```csv
"boolean","Your question here","False"
```

## Your Specific Question

**Question**: "The project stores passwords in plain text"
**Correct Answer**: False (good security practice!)

**Change this line**:
```csv
"boolean","The project stores passwords in plain text","True","False",,,,1
```

**To this**:
```csv
"boolean","The project stores passwords in plain text","False"
```

## Complete Format Reference

### Row 1: Metadata
```csv
"Quiz Title","Description","Category","Difficulty","TimeLimit"
```

### Row 2: Headers (optional)
```csv
"Type","Question","Opt1","Opt2","Opt3","Opt4","Answer"
```

### MCQ Questions
```csv
"mcq","Question?","Option 1","Option 2","Option 3","Option 4",INDEX
```
- INDEX must be 0, 1, 2, or 3
- 0 = first option, 1 = second, 2 = third, 3 = fourth

**Example**:
```csv
"mcq","What database?","MySQL","MongoDB","Supabase","Oracle",2
```
This selects "Supabase" (third option, index 2)

### Boolean Questions
```csv
"boolean","Question?","True"
```
or
```csv
"boolean","Question?","False"
```

**DO NOT use indices (0/1) for boolean!**

**Examples**:
```csv
"boolean","Is this correct?","True"
"boolean","Is this wrong?","False"
"boolean","Another true","true"
"boolean","Another false","false"
```

### Short Answer Questions
```csv
"short","Question?","Expected answer text"
```

**Example**:
```csv
"short","What is HTML?","Hypertext Markup Language"
```

---

## Step-by-Step: How to Fix All Boolean Questions

1. **Find all boolean lines** in your CSV
2. **Look at the current format**:
   - If it has `"True","False",,,,0` → Answer is True
   - If it has `"True","False",,,,1` → Answer is False
3. **Replace with simple format**:
   - If answer was index 0 → Change to `"True"`
   - If answer was index 1 → Change to `"False"`

### Example Conversions

**Before**:
```csv
"boolean","Question 1","True","False",,,,0
"boolean","Question 2","True","False",,,,1
"boolean","Question 3","True","False",,,,0
```

**After**:
```csv
"boolean","Question 1","True"
"boolean","Question 2","False"
"boolean","Question 3","True"
```

---

## Valid Boolean Values

All of these work:
- `True`, `true`, `TRUE`
- `False`, `false`, `FALSE`
- `1` (converts to True)
- `0` (converts to False)
- `yes` (converts to True)
- `no` (converts to False)

**Recommended**: Use `True` or `False` (capital T/F) for clarity

---

## Test Your Fix

After fixing your CSV:

1. Save the file
2. Go to Admin → Quiz Builder
3. Click "Import CSV"
4. Upload your fixed file
5. Check the imported questions

If boolean questions still show wrong answers, check:
- ✅ No extra columns after the answer
- ✅ Answer is literally "True" or "False"
- ✅ No trailing commas

---

## Need a Reference?

See **`CORRECT_FORMAT_EXAMPLE.csv`** for a complete working example with:
- 2 MCQ questions (with 0-based indexing)
- 4 Boolean questions (with simple format)
- 1 Short answer question

Import this file first to verify the format works!
