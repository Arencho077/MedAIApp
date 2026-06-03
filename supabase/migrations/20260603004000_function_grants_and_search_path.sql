-- Reduce exposed RPC surface and set stable search_path on helper functions.

ALTER FUNCTION public.get_admin_email() SET search_path = public;
ALTER FUNCTION public.sanitize_text(text) SET search_path = public;
ALTER FUNCTION public.clean_and_protect_appointments() SET search_path = public;
ALTER FUNCTION public.trigger_log_profile_update() SET search_path = public;
ALTER FUNCTION public.check_rate_limit(uuid, text, integer, integer) SET search_path = public;
ALTER FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public.trigger_log_appointment_update() SET search_path = public;
ALTER FUNCTION public.trigger_sanitize_profile() SET search_path = public;
ALTER FUNCTION public.detect_suspicious_activity() SET search_path = public;
ALTER FUNCTION public.cleanup_old_data() SET search_path = public;

-- Trigger/internal helpers should not be callable through PostgREST RPC.
REVOKE ALL ON FUNCTION public.clean_and_protect_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.clean_and_protect_appointments() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_log_profile_update() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_log_appointment_update() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_sanitize_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_suspicious_activity() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM anon, authenticated;

-- Admin RPCs are callable only by signed-in users; the function itself still
-- enforces public.is_admin() before changing data.
REVOKE ALL ON FUNCTION public.admin_approve_doctor(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reject_doctor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_doctor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_doctor(uuid) TO authenticated;

