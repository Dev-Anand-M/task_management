# SkillQuest Setup Instructions

## Quick Start (Mock Backend - No Database Required!)

The application now uses a **localStorage-based mock backend** for immediate testing without any database setup.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Registration

The app uses an **invite code system** for registration. Only users with valid invite codes can register.

**Admin Setup:**
1. Login as admin (you'll need to create the first admin account)
2. Go to Admin Panel → Invite Codes
3. Create invite codes for your friends
4. Share the codes with them

**User Registration:**
1. Go to the registration page
2. Enter the invite code provided by your admin
3. Complete the registration form

### Features Available

✅ **Authentication** - Login, Register, Logout with invite codes
✅ **Member Dashboard** - View tasks, quizzes, and progress
✅ **Admin Dashboard** - Manage tasks, quizzes, and team members
✅ **Task Management** - Create, assign, and evaluate tasks
✅ **Quiz System** - Create quizzes and track attempts
✅ **Leaderboard** - View member rankings by XP
✅ **Profile Management** - Update user profiles
✅ **XP & Badges** - Gamification system
✅ **Invite Code System** - Restrict registration to authorized users

### Getting Started

1. **Start the app:** `npm run dev`
2. **Create your admin account** through registration (first user becomes admin)
3. **Create invite codes** in Admin Panel → Invite Codes
4. **Share codes** with your friends to let them register

### Data Persistence

All data is stored in browser localStorage and persists across sessions. To clear all data:
1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Clear localStorage items starting with `skillquest_`
4. Refresh the page

---

## Switching to Supabase (Optional)

If you want to use a real Supabase database instead of localStorage:

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create a new project
- Run the SQL schema from `supabase/schema.sql`

### 2. Configure Environment Variables
Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Update Code to Use Supabase

In `src/context/AuthContext.jsx`:
```javascript
// Change from:
import { mockAuth, mockDb } from '../services/mockAuth';

// To:
import { supabase } from '../lib/supabase';
import * as db from '../services/database';
```

In `src/services/database.js`:
```javascript
// Change from:
import { mockDb } from './mockAuth';

// To:
import { supabase } from '../lib/supabase';
```

Then restore the original Supabase implementation in both files.

---

## Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components
│   └── layout/          # Layout components (Header, Layout)
├── context/
│   ├── AuthContext.jsx  # Authentication state (now using mockAuth)
│   └── ThemeContext.jsx # Theme management
├── pages/
│   ├── admin/           # Admin dashboard pages
│   ├── auth/            # Login & Register
│   └── member/          # Member dashboard pages
├── services/
│   ├── mockAuth.js      # Mock authentication & database (NEW)
│   ├── database.js      # Database service layer
│   └── storage.js       # localStorage utilities
└── lib/
    └── supabase.js      # Supabase client (not used with mock backend)
```

---

## Development Notes

- The app uses **React Router** for navigation
- **Lucide React** for icons
- Custom CSS with CSS variables for theming
- Dark mode by default (toggle in header)
- Responsive design for mobile/tablet/desktop

## Troubleshooting

**Issue: Login keeps loading**
- This was fixed by switching to mock backend
- Check browser console for errors

**Issue: Blank screen after login**
- Clear localStorage and refresh
- Check that demo data initialized (see console logs)

**Issue: Changes not persisting**
- Data is stored in localStorage
- Check browser storage quota
- Try incognito mode to test fresh state

---

## Next Steps

1. ✅ Login with demo credentials
2. ✅ Explore member dashboard
3. ✅ Try admin features (task/quiz creation)
4. ✅ Test submission evaluation
5. ✅ Check leaderboard rankings

Enjoy using SkillQuest! 🚀
