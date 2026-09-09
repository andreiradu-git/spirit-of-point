-- Public read policies (e.g. "public read published pages") are evaluated as the
-- anon role and call public.has_role(). Without EXECUTE, policy evaluation aborts
-- with "permission denied for function has_role" instead of returning false.
-- The function stays SECURITY DEFINER with a fixed search_path and only reads
-- public.user_roles, so granting EXECUTE cannot leak or bypass anything.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;