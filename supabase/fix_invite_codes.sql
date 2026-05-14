-- Ensure invite_codes table exists and has correct columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_codes') THEN
        CREATE TABLE public.invite_codes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code TEXT UNIQUE NOT NULL,
            classroom_id UUID REFERENCES public.classrooms(id),
            created_by UUID REFERENCES auth.users(id),
            is_used BOOLEAN DEFAULT FALSE,
            used_by UUID REFERENCES auth.users(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Add created_by if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invite_codes' AND column_name='created_by') THEN
        ALTER TABLE public.invite_codes ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add is_used if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invite_codes' AND column_name='is_used') THEN
        ALTER TABLE public.invite_codes ADD COLUMN is_used BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can manage invite codes" ON public.invite_codes;
CREATE POLICY "Admins can manage invite codes" ON public.invite_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Anyone can view available codes for their classroom" ON public.invite_codes;
CREATE POLICY "Anyone can view available codes for their classroom" ON public.invite_codes
    FOR SELECT USING (
        classroom_id IS NULL OR 
        classroom_id IN (SELECT classroom_id FROM public.profiles WHERE id = auth.uid())
    );
