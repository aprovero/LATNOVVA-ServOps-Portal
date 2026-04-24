-- Create a secure RPC to fetch the raw data of auth.users to see EXACTLY what is corrupted
CREATE OR REPLACE FUNCTION public.admin_get_raw_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(u)) INTO result FROM auth.users u;
  RETURN result;
END;
$$;
