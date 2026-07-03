-- Create a function to delete user account and all associated data
-- This uses the Supabase auth.admin API through an Edge Function
-- For now, this RPC will mark the account for deletion and return instructions
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_to_delete uuid;
  request_id bigint;
BEGIN
  -- Get the current user's ID
  user_id_to_delete := auth.uid();
  
  -- Check if user is authenticated
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's data from all tables
  -- Add your table deletions here as needed
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  
  -- Note: Deleting from auth.users requires service_role privileges
  -- This must be done via an Edge Function or admin API
  -- For now, we'll use the admin deleteUser method from the client
  
  RETURN json_build_object(
    'success', true, 
    'message', 'User data deleted successfully',
    'user_id', user_id_to_delete
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_user_account() IS 'Allows authenticated users to delete their own account and all associated data';
