-- Add unique constraint to ai_history to support per-material chat persistence in the Study Lab
ALTER TABLE public.ai_history 
ADD CONSTRAINT unique_user_tool_title UNIQUE (user_id, tool, title);
