-- Add revision control columns to submissions table
ALTER TABLE submissions
ADD COLUMN revision_deadline TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN is_resubmission BOOLEAN DEFAULT FALSE;
