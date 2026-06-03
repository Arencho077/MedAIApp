-- PostgreSQL grants EXECUTE on functions to PUBLIC by default. Revoke that
-- broad grant for internal/security-definer helpers so they cannot be called
-- directly through PostgREST RPC.

REVOKE ALL ON FUNCTION public.clean_and_protect_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clean_and_protect_appointments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_log_profile_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_log_appointment_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_sanitize_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_suspicious_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_approve_doctor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reject_doctor(uuid) FROM PUBLIC;

-- Keep the app's admin actions available to signed-in users. The functions
-- enforce public.is_admin() before mutating profiles.
GRANT EXECUTE ON FUNCTION public.admin_approve_doctor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_doctor(uuid) TO authenticated;

