-- ============================================================
-- Zenith OS: Sprint Templates Table
-- Run this in: Supabase Dashboard -> SQL Editor
-- Safe to re-run: all statements are idempotent
-- ============================================================

-- Step 1: Create table (skipped if already exists)
CREATE TABLE IF NOT EXISTS sprint_templates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id  UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  week_number   INT  NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  is_showcase   BOOLEAN DEFAULT FALSE,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(classroom_id, week_number)
);

-- Step 2: Add new columns if they don't exist yet (safe if already added)
ALTER TABLE sprint_templates ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE sprint_templates ADD COLUMN IF NOT EXISTS end_date   DATE;
ALTER TABLE sprint_templates ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE sprint_templates ADD COLUMN IF NOT EXISTS resource_label TEXT;

-- Step 3: Enable RLS (safe to re-run)
ALTER TABLE sprint_templates ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop and recreate policies (ensures latest version is applied)
DROP POLICY IF EXISTS "Authenticated users can read sprint templates" ON sprint_templates;
DROP POLICY IF EXISTS "Admins can manage sprint templates" ON sprint_templates;

CREATE POLICY "Authenticated users can read sprint templates"
  ON sprint_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sprint templates"
  ON sprint_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
