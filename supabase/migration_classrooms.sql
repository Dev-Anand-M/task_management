-- Create classrooms table
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;

-- Insert Default Classroom for migration
DO $$
DECLARE
  default_classroom_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM classrooms WHERE name = 'General Classroom') THEN
    INSERT INTO classrooms (name, description) VALUES ('General Classroom', 'Default classroom for existing users') RETURNING id INTO default_classroom_id;
  ELSE
    SELECT id INTO default_classroom_id FROM classrooms WHERE name = 'General Classroom';
  END IF;

  -- Add classroom_id to profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'classroom_id') THEN
    ALTER TABLE profiles ADD COLUMN classroom_id UUID REFERENCES classrooms(id);
    -- Migrate existing profiles
    UPDATE profiles SET classroom_id = default_classroom_id WHERE classroom_id IS NULL;
  END IF;

  -- Add classroom_id to tasks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'classroom_id') THEN
    ALTER TABLE tasks ADD COLUMN classroom_id UUID REFERENCES classrooms(id);
    UPDATE tasks SET classroom_id = default_classroom_id WHERE classroom_id IS NULL;
  END IF;

  -- Add classroom_id to quizzes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'classroom_id') THEN
    ALTER TABLE quizzes ADD COLUMN classroom_id UUID REFERENCES classrooms(id);
    UPDATE quizzes SET classroom_id = default_classroom_id WHERE classroom_id IS NULL;
  END IF;

  -- Add classroom_id to invite_codes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_codes' AND column_name = 'classroom_id') THEN
    ALTER TABLE invite_codes ADD COLUMN classroom_id UUID REFERENCES classrooms(id);
    UPDATE invite_codes SET classroom_id = default_classroom_id WHERE classroom_id IS NULL;
  END IF;
  
  -- Add foreign key constraint if missing (redundant check but safe)
  -- Skipped for brevity, defined in ADD COLUMN
END $$;

-- Update handle_new_user to include classroom_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, classroom_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    (NEW.raw_user_meta_data->>'classroom_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update RLS Policies to enforce Classroom Isolation

-- Helper function to get current user's classroom_id
CREATE OR REPLACE FUNCTION get_my_classroom_id()
RETURNS UUID AS $$
  SELECT classroom_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Users can view profiles in their classroom
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view classroom profiles" ON profiles
  FOR SELECT USING (
    classroom_id = get_my_classroom_id() OR 
    auth.uid() = id -- Always see self
  );

-- Tasks: View tasks in classroom
DROP POLICY IF EXISTS "Anyone can view tasks" ON tasks;
CREATE POLICY "Users can view classroom tasks" ON tasks
  FOR SELECT USING (
    classroom_id = get_my_classroom_id()
  );

-- Tasks: Admins manage tasks in their classroom
DROP POLICY IF EXISTS "Admins can insert tasks" ON tasks;
CREATE POLICY "Admins can insert classroom tasks" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = tasks.classroom_id)
  );
  
DROP POLICY IF EXISTS "Admins can update tasks" ON tasks;
CREATE POLICY "Admins can update classroom tasks" ON tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = tasks.classroom_id)
  );

DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
CREATE POLICY "Admins can delete classroom tasks" ON tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = tasks.classroom_id)
  );

-- Invite Codes: View/Use codes
-- Limitation: A new user doesn't have a classroom_id yet. So they can't use get_my_classroom_id().
-- Invite codes must be publicly readable (or at least checkable) by anon or authenticated users without a classroom.
-- We previously had "Anyone can check invite codes". We'll keep that.
-- But Admins should only see/manage THEIR classroom's codes.

DROP POLICY IF EXISTS "Admins can manage invite codes" ON invite_codes;
CREATE POLICY "Admins can manage classroom invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = invite_codes.classroom_id)
  );
  
DROP POLICY IF EXISTS "Admins can create invite codes" ON invite_codes;
CREATE POLICY "Admins can create classroom invite codes" ON invite_codes
  FOR INSERT WITH CHECK (
    -- Ensure the admin is creating a code for their own classroom
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = invite_codes.classroom_id)
  );

-- Quizzes: Similar to tasks
DROP POLICY IF EXISTS "Anyone can view quizzes" ON quizzes;
CREATE POLICY "Users can view classroom quizzes" ON quizzes
  FOR SELECT USING (
    classroom_id = get_my_classroom_id()
  );

DROP POLICY IF EXISTS "Admins can manage quizzes" ON quizzes;
CREATE POLICY "Admins can manage classroom quizzes" ON quizzes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND classroom_id = quizzes.classroom_id)
  );

-- Classrooms Table Policies
-- Users can view their own classroom
CREATE POLICY "Users can view own classroom" ON classrooms
  FOR SELECT USING (
    id = get_my_classroom_id()
  );
  
-- Admins? Maybe super admins can create? For now assume only database/seed creation or initial setup.
-- If we want admins to "Edit" their classroom (name, desc):
CREATE POLICY "Admins can update own classroom" ON classrooms
  FOR UPDATE USING (
    id = get_my_classroom_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
