-- Migration: Allow Admins to Delete Members
-- This enables the "Remove Member" feature in Team Management

-- 1. Add RLS policy to allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete member profiles" ON profiles;
CREATE POLICY "Admins can delete member profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );

-- 2. Create RPC function to delete both auth user and profile
-- This is the COMPLETE solution that removes login access
CREATE OR REPLACE FUNCTION admin_delete_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role TEXT;
BEGIN
  -- Check if calling user is admin
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();

  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete from profiles first (CASCADE will handle related data)
  DELETE FROM profiles WHERE id = user_id;
  
  -- Delete from auth.users to revoke login access
  -- This requires SECURITY DEFINER to bypass RLS
  DELETE FROM auth.users WHERE id = user_id;
  
  RAISE NOTICE 'User % and all related data deleted successfully', user_id;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION admin_delete_user IS 'Allows admins to completely delete users including auth access and all related data via CASCADE';

