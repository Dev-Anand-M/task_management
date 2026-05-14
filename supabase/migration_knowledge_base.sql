-- Add subject column to knowledge_base if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='knowledge_base' AND column_name='subject') THEN
        ALTER TABLE public.knowledge_base ADD COLUMN subject TEXT;
    END IF;
END $$;

-- Update RLS policies to ensure students can read all knowledge snippets for their classroom or global
DROP POLICY IF EXISTS "Anyone can view classroom knowledge" ON public.knowledge_base;
CREATE POLICY "Anyone can view classroom knowledge" ON public.knowledge_base
    FOR SELECT USING (
        classroom_id IS NULL OR 
        classroom_id IN (
            SELECT classroom_id FROM public.profiles WHERE id = auth.uid()
        )
    );
