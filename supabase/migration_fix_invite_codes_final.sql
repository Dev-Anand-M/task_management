-- Fix invite_codes policy to allow ANY admin to create/manage codes
-- This avoids issues where an admin's assigned classroom doesn't match the invite code's target classroom

DROP POLICY IF EXISTS "Admins can manage classroom invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can create classroom invite codes" ON invite_codes;

-- Allow reading/management for all admins
CREATE POLICY "Admins can manage all invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
