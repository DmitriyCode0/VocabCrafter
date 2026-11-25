REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_approved_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;
