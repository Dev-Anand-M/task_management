-- Add avatar_url column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Enable Storage (if not already enabled) is usually handled via dashboard, 
-- but we can try to create a bucket via SQL if the extension is enabled, 
-- or we will just assume the bucket 'avatars' needs to exist.
-- Ideally in Supabase you create buckets via API or Dashboard.
-- We will at least add the column to the database.

-- Note: The user will need to create a public bucket named 'avatars' in their Supabase dashboard
-- Policy for viewing avatars (public)
-- Policy for uploading avatars (authenticated users)

-- Since we can't create buckets easily via pure SQL migration depending on extensions,
-- we will just modify the schema here.

COMMENT ON COLUMN profiles.avatar_url IS 'URL to the user''s profile picture';
