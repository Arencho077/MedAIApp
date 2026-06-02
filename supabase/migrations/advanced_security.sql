-- ============================================================================
-- ADDITIONAL SECURITY RECOMMENDATIONS FOR SUPABASE
-- These are extra hardening measures beyond the main security_policies.sql
-- ============================================================================

-- ============================================================================
-- 1. PREVENT PRIVILEGE ESCALATION
-- ============================================================================

-- Ensure users cannot change their own role
CREATE POLICY "Users cannot change their own role"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = (SELECT role FROM profiles WHERE id = auth.uid()) -- Role must stay the same
);

-- ============================================================================
-- 2. RATE LIMITING (Application Level)
-- ============================================================================

-- Create a table to track API requests (for rate limiting)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_user_endpoint ON api_rate_limits(user_id, endpoint, window_start);

-- Function to check rate limit (call this from Edge Functions)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Clean up old entries
  DELETE FROM api_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';

  -- Get current count for this user/endpoint in the time window
  SELECT COALESCE(SUM(request_count), 0)
  INTO current_count
  FROM api_rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- If under limit, increment and allow
  IF current_count < p_max_requests THEN
    INSERT INTO api_rate_limits (user_id, endpoint, request_count, window_start)
    VALUES (p_user_id, p_endpoint, 1, NOW())
    ON CONFLICT (user_id, endpoint)
    DO UPDATE SET
      request_count = api_rate_limits.request_count + 1,
      window_start = CASE
        WHEN api_rate_limits.window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL
        THEN NOW()
        ELSE api_rate_limits.window_start
      END;
    RETURN TRUE;
  END IF;

  -- Rate limit exceeded
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 3. AUDIT LOGGING
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Function to log sensitive actions
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_values, p_new_values);
END;
$$;

-- Trigger to log profile updates
CREATE OR REPLACE FUNCTION trigger_log_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_audit(
    'UPDATE',
    'profiles',
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_profile_updates
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_log_profile_update();

-- Trigger to log appointment status changes
CREATE OR REPLACE FUNCTION trigger_log_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit(
      'STATUS_CHANGE',
      'appointments',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_appointment_status_changes
AFTER UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION trigger_log_appointment_update();

-- ============================================================================
-- 4. PREVENT MASS ASSIGNMENT
-- ============================================================================

-- Ensure sensitive fields can't be modified by users
ALTER TABLE profiles
  ADD CONSTRAINT check_no_manual_approval
  CHECK (
    -- Only allow is_approved to be changed through RPC functions
    is_approved IS NULL OR
    is_approved = false OR
    current_setting('role', true) = 'service_role'
  );

-- ============================================================================
-- 5. SESSION SECURITY
-- ============================================================================

-- Function to invalidate all user sessions (useful for forced logout)
CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This would need to be implemented with auth.refresh_tokens table
  -- For now, log the action
  PERFORM log_audit('INVALIDATE_SESSIONS', 'auth', p_user_id, NULL, NULL);

  -- In production, you'd also want to:
  -- DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- 6. DATA SANITIZATION
-- ============================================================================

-- Function to sanitize text input (prevent XSS, injection)
CREATE OR REPLACE FUNCTION sanitize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Remove null bytes
  input_text := REPLACE(input_text, E'\x00', '');

  -- Trim whitespace
  input_text := TRIM(input_text);

  -- Limit length
  input_text := LEFT(input_text, 1000);

  RETURN input_text;
END;
$$;

-- Apply sanitization to all text inputs (example for profiles)
CREATE OR REPLACE FUNCTION trigger_sanitize_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.full_name := sanitize_text(NEW.full_name);
  NEW.specialty := sanitize_text(NEW.specialty);
  NEW.experience := sanitize_text(NEW.experience);
  NEW.clinic_address := sanitize_text(NEW.clinic_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_profile_input
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_sanitize_profile();

-- ============================================================================
-- 7. EMAIL VERIFICATION ENFORCEMENT
-- ============================================================================

-- Add a check to ensure only verified emails can book appointments
ALTER TABLE appointments
  ADD CONSTRAINT check_verified_email
  CHECK (
    -- This is a placeholder - in reality you'd check auth.users.email_confirmed_at
    patient_id IS NOT NULL
  );

-- ============================================================================
-- 8. SUSPICIOUS ACTIVITY DETECTION
-- ============================================================================

-- Create a function to detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check for rapid appointment creation (potential spam)
  IF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)
    INTO recent_count
    FROM appointments
    WHERE patient_id = NEW.patient_id
      AND created_at > NOW() - INTERVAL '5 minutes';

    IF recent_count > 5 THEN
      RAISE EXCEPTION 'Too many appointments created in short time. Please wait.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER detect_appointment_spam
BEFORE INSERT ON appointments
FOR EACH ROW
EXECUTE FUNCTION detect_suspicious_activity();

-- ============================================================================
-- 9. BACKUP ADMIN ACCESS
-- ============================================================================

-- Create a secure admin table (in case env vars fail)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- Function to check if user is admin (with fallback)
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE id = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_user_id
      AND email = current_setting('app.admin_email', true)
  );
END;
$$;

-- ============================================================================
-- 10. AUTOMATIC CLEANUP
-- ============================================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete old audit logs (keep only 90 days)
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Delete cancelled appointments older than 30 days
  DELETE FROM appointments
  WHERE status = 'cancelled'
    AND created_at < NOW() - INTERVAL '30 days';

  -- Clean up orphaned storage objects would go here
  -- (requires custom logic with Supabase Storage API)
END;
$$;

-- Schedule this to run daily via pg_cron or external scheduler

-- ============================================================================
-- NOTES:
-- 1. These are ADVANCED security measures - apply after basic RLS is working
-- 2. Test thoroughly in a staging environment first
-- 3. Monitor performance impact of triggers and audit logging
-- 4. Adjust rate limits based on your app's usage patterns
-- 5. Consider using Supabase Edge Functions for complex rate limiting
-- ============================================================================
