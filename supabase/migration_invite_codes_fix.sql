-- Relax invite_codes management policy to allow admins to manage codes in their classroom 
-- OR codes that have no classroom assigned.
DROP POLICY IF EXISTS "Admins can manage classroom invite codes" ON invite_codes;
CREATE POLICY "Admins can manage classroom invite codes" ON invite_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND (
        classroom_id = invite_codes.classroom_id OR 
        invite_codes.classroom_id IS NULL
      )
    )
  );

-- Also ensure creation policy is relaxed if we want to allow creating global codes
DROP POLICY IF EXISTS "Admins can create classroom invite codes" ON invite_codes;
CREATE POLICY "Admins can create classroom invite codes" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND (
        classroom_id = invite_codes.classroom_id OR 
        invite_codes.classroom_id IS NULL
      )
    )
  );
