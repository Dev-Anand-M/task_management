# How to Reset Your Supabase Database

## Quick Reset (Clear All Data)

### Step 1: Run Reset Script
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/reset.sql`
6. Click **Run** or press `Ctrl+Enter`

This will:
- Delete all data from all tables
- Optionally insert demo data (tasks and quizzes)
- Show you a count of records in each table

### Step 2: Delete Auth Users (Important!)
1. Go to **Authentication** → **Users**
2. Delete all existing users (click the trash icon for each)

### Step 3: Create Fresh Auth Users

**Admin Account:**
1. Click **Add User** → **Create new user**
2. Email: `admin@skillquest.com`
3. Password: `admin123`
4. Click **Create user**
5. After creation, go to **SQL Editor** and run:
```sql
UPDATE auth.users 
SET raw_user_meta_data = '{"name": "Admin User", "role": "admin"}'::jsonb
WHERE email = 'admin@skillquest.com';
```

**Member Account:**
1. Click **Add User** → **Create new user**
2. Email: `tester@example.com`
3. Password: `password`
4. Click **Create user**
5. After creation, go to **SQL Editor** and run:
```sql
UPDATE auth.users 
SET raw_user_meta_data = '{"name": "Tester User", "role": "member"}'::jsonb
WHERE email = 'tester@example.com';
```

### Step 4: Verify Profiles Created
Run this in SQL Editor:
```sql
SELECT id, email, name, role, xp FROM profiles;
```

You should see 2 profiles (admin and tester) auto-created by the trigger.

---

## Full Reset (Recreate Everything)

If you want to completely recreate the database schema:

### Step 1: Drop All Tables
```sql
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
```

### Step 2: Recreate Schema
1. Go to **SQL Editor**
2. Copy and paste the entire contents of `supabase/schema.sql`
3. Run it

### Step 3: Follow Steps 2-4 from Quick Reset above

---

## Assign Demo Data to Users

After creating users, you can assign tasks and quizzes to them:

```sql
-- Get user IDs
SELECT id, email, name FROM profiles;

-- Assign tasks to specific users (replace UUIDs with actual IDs)
UPDATE tasks 
SET assigned_to = ARRAY['user-id-1', 'user-id-2']::uuid[]
WHERE title = 'Create a Responsive Login Page';

-- Assign quizzes to users
UPDATE quizzes 
SET assigned_to = ARRAY['user-id-1', 'user-id-2']::uuid[]
WHERE title = 'HTML Fundamentals';
```

---

## Update XP and Badges

Give users some starting XP and badges:

```sql
-- Give tester user some XP and badges
UPDATE profiles 
SET 
  xp = 2450,
  badges = ARRAY['first_task', 'streak_3', 'perfect_score']
WHERE email = 'tester@example.com';

-- Give another user XP
UPDATE profiles 
SET 
  xp = 1890,
  badges = ARRAY['first_task']
WHERE email = 'john@example.com';
```

---

## Verify Everything Works

### Check Tables
```sql
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'quizzes', COUNT(*) FROM quizzes
UNION ALL
SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL
SELECT 'quiz_attempts', COUNT(*) FROM quiz_attempts;
```

### Check Auth Users
```sql
SELECT 
  id,
  email,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
ORDER BY created_at DESC;
```

### Check Profiles Match Auth
```sql
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  p.xp,
  CASE WHEN au.id IS NOT NULL THEN '✅' ELSE '❌' END as has_auth_user
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.created_at DESC;
```

---

## Common Issues

**Issue: Profiles not created after adding auth user**
- Check if the trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
- If missing, run the trigger creation from `supabase/schema.sql`

**Issue: Can't login with created users**
- Make sure email confirmation is disabled:
  - Go to **Authentication** → **Settings** → **Email Auth**
  - Disable "Confirm email"

**Issue: RLS policies blocking access**
- Temporarily disable RLS for testing:
```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
-- etc...
```
- Re-enable after testing:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- etc...
```

---

## Quick Test

After reset, try:
1. Login at http://localhost:5174
2. Use: `tester@example.com` / `password`
3. Check if dashboard loads
4. Try admin login: `admin@skillquest.com` / `admin123`

If everything works, you're all set! 🎉
