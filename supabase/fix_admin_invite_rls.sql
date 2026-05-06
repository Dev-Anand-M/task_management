-- RELAX INVITE CODES RLS FOR ADMINS
-- This allows admins to create and manage invite codes for ANY classroom,
-- regardless of whether they are personally assigned to that classroom.

-- 1. DROP EXISTING POLICIES
DROP POLICY IF EXISTS "Admins can manage classroom invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can create classroom invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can manage invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can create invite codes" ON invite_codes;

-- 2. CREATE PERMISSIVE ADMIN POLICIES
-- Creation Policy
CREATE POLICY "Admins can create any invite code" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Management Policy (Read/Update/Delete)
CREATE POLICY "Admins can manage all invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 3. ENSURE PUBLIC SELECT STILL WORKS (for registration)
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;
CREATE POLICY "Anyone can check invite codes" ON invite_codes
  FOR SELECT USING (true);
