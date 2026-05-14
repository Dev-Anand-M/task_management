# Comprehensive Routine/Coursework Tracking System

## Overview
Transform Routines into a powerful coursework consistency tracker with AI scheduling, analytics, and diary features.

## Key Features

### 1. Enhanced Routine Structure
```javascript
{
  id: string,
  title: string, // e.g., "Study DSA"
  time: string, // e.g., "08:00"
  days: number[], // [0-6]
  deadline: string, // Course completion deadline
  alarmEnabled: boolean,
  responseTimeout: number, // minutes (default: 30)
  createdAt: string,
  
  // NEW FIELDS
  category: string, // "coursework" | "habit" | "task"
  estimatedDuration: number, // minutes
  color: string // for visual distinction
}
```

### 2. Session Log Structure
```javascript
{
  routineId: string,
  date: string,
  
  // Response tracking
  alarmTriggered: timestamp,
  responded: boolean,
  respondedAt: timestamp | null,
  status: "completed" | "ignored" | "postponed" | "pending",
  
  // Time tracking
  timeSpent: number, // minutes
  startTime: timestamp,
  endTime: timestamp,
  
  // Learning log
  whatLearned: string,
  notes: string,
  voiceNote: string | null,
  
  // Postpone tracking
  postponedTimes: [{time: timestamp, reason: string}],
  postponedTo: string | null // time in same day
}
```

### 3. Diary & Analytics
- **Diary View**: Calendar-based view showing all sessions
- **Mind Map**: Visual representation of learning progress
- **Analytics Dashboard**:
  - Total time spent
  - Completion rate
  - Streak tracking
  - Response rate (responded vs ignored)
  - Average time per session
  - Learning milestones
  - Progress toward deadline

### 4. AI Weekly Timetable
- User tells AI their preferences
- AI generates full week schedule
- Each task has start time (no end time initially)
- User fills in actual duration
- System logs timing and creates analytics
- Timetable view shows:
  - Planned vs Actual time
  - Completion status
  - Gaps and free time

### 5. Alarm Flow
```
1. Alarm triggers at scheduled time
2. Play sound + show popup
3. User has 3 options:
   a. Start Now → Begin timer
   b. Postpone → Select new time (same day only)
   c. Dismiss → Mark as ignored (after timeout)
4. If no response within timeout → Auto-mark as ignored
5. During session:
   - Timer runs
   - Can pause/resume
   - Can add notes
   - Can record voice notes
6. End session:
   - Enter time spent
   - Enter what learned
   - Save to diary
```

### 6. UI Components

#### Main Routines Page
- Today's schedule (timeline view)
- Quick stats card
- Active routine timer (if any)
- Upcoming alarms

#### Routine Detail Page
- Analytics dashboard
- Diary entries (filterable)
- Mind map visualization
- Edit routine settings

#### Weekly Timetable Page
- AI-generated schedule
- Drag-and-drop to adjust
- Actual vs planned comparison
- Export/share timetable

#### Diary Page
- Calendar view
- Filter by routine
- Search entries
- Export data

## Mobile-First Design
- Swipe gestures for navigation
- Bottom sheet modals
- Large touch targets
- Responsive grid layouts
- Collapsible sections

## Implementation Steps
1. ✅ Basic alarm system
2. ⏳ Enhanced session tracking
3. ⏳ Diary & analytics
4. ⏳ AI timetable generator
5. ⏳ Mind map visualization
6. ⏳ Mobile optimization
