-- Add AI settings to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'ai_settings') THEN
        ALTER TABLE profiles ADD COLUMN ai_settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- The ai_settings JSON structure:
-- {
--   "encrypted_api_key": "base64_encrypted_key",
--   "selected_model": "gemini-1.5-flash",
--   "usage": {
--     "requests_today": 0,
--     "last_request_date": "2024-01-01",
--     "total_requests": 0
--   }
-- }

COMMENT ON COLUMN profiles.ai_settings IS 'Stores encrypted AI API key, model preference, and usage tracking';
