-- ROBUST ANNOUNCEMENTS MIGRATION
-- This script ensures the table exists and policies are correctly applied.

-- 1. Create table if missing
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 3. DROP EXISTING POLICIES (to prevent "already exists" errors)
DROP POLICY IF EXISTS "Anyone can view classroom announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage classroom announcements" ON announcements;

-- 4. CREATE POLICIES
-- Anyone can view classroom announcements (if they are in the classroom or an admin)
CREATE POLICY "Anyone can view classroom announcements" ON announcements
  FOR SELECT USING (
    classroom_id = (SELECT classroom_id FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can manage classroom announcements
CREATE POLICY "Admins can manage classroom announcements" ON announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. REFRESH SCHEMA CACHE (Optional but helpful for PostgREST)
-- NOTIFY pgrst, 'reload schema';
