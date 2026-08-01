-- Sprint Evaluations Table scoped to specific Classrooms
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sprint_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 8),
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_ownership INT DEFAULT 0 CHECK (task_ownership BETWEEN 0 AND 10),
  code_quality INT DEFAULT 0 CHECK (code_quality BETWEEN 0 AND 10),
  demo_understanding INT DEFAULT 0 CHECK (demo_understanding BETWEEN 0 AND 10),
  autonomy INT DEFAULT 0 CHECK (autonomy BETWEEN 0 AND 10),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (evaluator_id != subject_id)
);

-- Ensure classroom_id column exists if table was created previously without it
ALTER TABLE sprint_evaluations ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE sprint_evaluations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view classroom sprint evaluations" ON sprint_evaluations;
DROP POLICY IF EXISTS "Anyone can view sprint evaluations" ON sprint_evaluations;
DROP POLICY IF EXISTS "Users can insert own evaluations" ON sprint_evaluations;
DROP POLICY IF EXISTS "Users can update own evaluations" ON sprint_evaluations;
DROP POLICY IF EXISTS "Admins can manage all sprint evaluations" ON sprint_evaluations;

-- Re-create policies
CREATE POLICY "Users can view classroom sprint evaluations" ON sprint_evaluations
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own evaluations" ON sprint_evaluations
  FOR INSERT WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Users can update own evaluations" ON sprint_evaluations
  FOR UPDATE USING (auth.uid() = evaluator_id);

CREATE POLICY "Admins can manage all sprint evaluations" ON sprint_evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sprint_eval_classroom ON sprint_evaluations(classroom_id);
CREATE INDEX IF NOT EXISTS idx_sprint_eval_week ON sprint_evaluations(week_number);
CREATE INDEX IF NOT EXISTS idx_sprint_eval_subject ON sprint_evaluations(subject_id);
CREATE INDEX IF NOT EXISTS idx_sprint_eval_evaluator ON sprint_evaluations(evaluator_id);

-- Sprint Locks Table (stores manual lock/unlock overrides per classroom/week)
CREATE TABLE IF NOT EXISTS sprint_locks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 8),
  is_locked BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure classroom_id column exists on sprint_locks if created previously
ALTER TABLE sprint_locks 
ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE sprint_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sprint locks" ON sprint_locks;
DROP POLICY IF EXISTS "Admins can manage sprint locks" ON sprint_locks;

CREATE POLICY "Anyone can view sprint locks" ON sprint_locks
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sprint locks" ON sprint_locks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Sprint Participants Table (Admin adds/removes people to a sprint per classroom)
CREATE TABLE IF NOT EXISTS sprint_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (classroom_id, user_id)
);

ALTER TABLE sprint_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sprint participants" ON sprint_participants;
DROP POLICY IF EXISTS "Admins can manage sprint participants" ON sprint_participants;

CREATE POLICY "Anyone can view sprint participants" ON sprint_participants
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sprint participants" ON sprint_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
