-- Add preferences column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'preferences') THEN
        ALTER TABLE profiles ADD COLUMN preferences JSONB DEFAULT '{"theme": "dark", "colorScheme": "gold", "notifications": {"email": true, "push": true, "taskReminders": true, "quizResults": true}}';
    END IF;
END $$;

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Enable RLS for invite_codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Policies for invite_codes
-- Anyone can read available codes (needed for registration check)
CREATE POLICY "Anyone can check invite codes" ON invite_codes
  FOR SELECT USING (true);

-- Only admins can create codes
CREATE POLICY "Admins can create invite codes" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- System can update codes (marking as used) - simplified for now, usually requires secure function or careful RLS
-- allowing authenticated users to update 'used_by' if it's currently null
CREATE POLICY "Users can claim invite codes" ON invite_codes
  FOR UPDATE USING (
    is_used = false
  ) WITH CHECK (
    is_used = true AND used_by = auth.uid()
  );

-- Admins can update/delete
CREATE POLICY "Admins can manage invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert some default invite codes if empty
INSERT INTO invite_codes (code, created_at)
SELECT 'FRIEND2024', NOW()
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'FRIEND2024');

INSERT INTO invite_codes (code, created_at)
SELECT 'TEAM2024', NOW()
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'TEAM2024');

INSERT INTO invite_codes (code, created_at)
SELECT 'SKILL24', NOW()
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'SKILL24');

INSERT INTO invite_codes (code, created_at)
SELECT 'QUEST24', NOW()
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'QUEST24');

INSERT INTO invite_codes (code, created_at)
SELECT 'CODING24', NOW()
WHERE NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = 'CODING24');
