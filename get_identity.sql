-- Setup an RPC to read the raw identities data for the working account
CREATE OR REPLACE FUNCTION public.admin_get_working_identity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(i.*) INTO result 
  FROM auth.identities i 
  WHERE i.email = 'aprovero@latnovva.com' 
  LIMIT 1;
  RETURN result;
END;
$$;
