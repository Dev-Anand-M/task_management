-- Create sprint_vault table for sprint-specific week resources
-- This is SEPARATE from knowledge_base (study materials)

CREATE TABLE IF NOT EXISTS sprint_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT, -- 'pdf', 'doc', 'video', 'link', etc.
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT sprint_vault_week_check CHECK (week_number >= 1 AND week_number <= 20)
);

-- Index for faster queries
CREATE INDEX idx_sprint_vault_classroom ON sprint_vault(classroom_id);
CREATE INDEX idx_sprint_vault_week ON sprint_vault(week_number);
CREATE INDEX idx_sprint_vault_classroom_week ON sprint_vault(classroom_id, week_number);

-- Enable RLS
ALTER TABLE sprint_vault ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sprint vault docs from their classroom
CREATE POLICY "Users can view sprint vault from their classroom"
    ON sprint_vault FOR SELECT
    USING (
        classroom_id IN (
            SELECT classroom_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Admins can insert sprint vault docs
CREATE POLICY "Admins can insert sprint vault docs"
    ON sprint_vault FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND classroom_id = sprint_vault.classroom_id
        )
    );

-- Policy: Admins can update sprint vault docs
CREATE POLICY "Admins can update sprint vault docs"
    ON sprint_vault FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND classroom_id = sprint_vault.classroom_id
        )
    );

-- Policy: Admins can delete sprint vault docs
CREATE POLICY "Admins can delete sprint vault docs"
    ON sprint_vault FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND classroom_id = sprint_vault.classroom_id
        )
    );

COMMENT ON TABLE sprint_vault IS 'Sprint-specific weekly resources (separate from general knowledge_base/study materials)';
COMMENT ON COLUMN sprint_vault.week_number IS 'Sprint week number (1-20)';
COMMENT ON COLUMN sprint_vault.file_url IS 'URL to the resource file or external link';
COMMENT ON COLUMN sprint_vault.file_type IS 'Type of resource: pdf, doc, video, link, etc.';
