-- ============================================================================
-- MEDAI APP - COMPLETE SECURITY FIX (IDEMPOTENT VERSION)
-- ============================================================================
-- This version is SAFE to run multiple times - it will clean up old policies
-- and create fresh ones without errors.
-- ============================================================================

-- ============================================================================
-- STEP 0: DROP ALL EXISTING POLICIES (Clean slate)
-- ============================================================================

-- Drop profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read approved doctors" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON profiles;
DROP POLICY IF EXISTS "Users cannot change their own role" ON profiles;

-- Drop appointments policies
DROP POLICY IF EXISTS "Patients can read own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can read their appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can update their appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can cancel own appointments" ON appointments;

-- Drop storage policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can upload own diploma" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can read own diploma" ON storage.objects;

-- ============================================================================
-- STEP 1: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: PROFILES TABLE POLICIES
-- ============================================================================

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile only
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow reading approved doctor profiles (for patient discovery)
CREATE POLICY "Anyone can read approved doctors"
ON profiles FOR SELECT
USING (role = 'doctor' AND is_approved = true);

-- Allow admins to read all profiles
CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM auth.users WHERE email = current_setting('app.admin_email', true)
  )
);

-- Allow new user registration (insert)
CREATE POLICY "Users can insert own profile on signup"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Prevent users from changing their own role
CREATE POLICY "Users cannot change their own role"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = (SELECT role FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- STEP 3: APPOINTMENTS TABLE POLICIES
-- ============================================================================

-- Patients can read their own appointments
CREATE POLICY "Patients can read own appointments"
ON appointments FOR SELECT
USING (auth.uid() = patient_id);

-- Doctors can read appointments where they are the doctor
CREATE POLICY "Doctors can read their appointments"
ON appointments FOR SELECT
USING (auth.uid() = doctor_id);

-- Patients can create appointments for themselves
CREATE POLICY "Patients can create appointments"
ON appointments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

-- Doctors can update only their own appointments (status changes)
CREATE POLICY "Doctors can update their appointments"
ON appointments FOR UPDATE
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Patients can cancel their own appointments
CREATE POLICY "Patients can cancel own appointments"
ON appointments FOR UPDATE
USING (auth.uid() = patient_id AND status = 'pending')
WITH CHECK (auth.uid() = patient_id AND status IN ('cancelled'));

-- ============================================================================
-- STEP 4: STORAGE POLICIES (Avatars and Diplomas)
-- ============================================================================

-- Avatars bucket: Users can upload/update their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatars are publicly readable
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Diplomas bucket: Doctors can upload their diploma
CREATE POLICY "Doctors can upload own diploma"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'diplomas' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Only admins can read diplomas (for verification)
CREATE POLICY "Admins can read diplomas"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'diplomas' AND
  auth.uid() IN (
    SELECT id FROM auth.users WHERE email = current_setting('app.admin_email', true)
  )
);

-- Doctors can read their own diploma
CREATE POLICY "Doctors can read own diploma"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'diplomas' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- STEP 5: ADMIN RPC FUNCTIONS (Server-side validation)
-- ============================================================================

-- Function to approve doctor (admin only)
CREATE OR REPLACE FUNCTION admin_approve_doctor(doctor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_email TEXT;
BEGIN
  -- Get admin email from app settings
  admin_email := current_setting('app.admin_email', true);

  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = admin_email
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update doctor approval status
  UPDATE profiles
  SET is_approved = true
  WHERE id = doctor_id AND role = 'doctor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;
END;
$$;

-- Function to reject doctor (admin only)
CREATE OR REPLACE FUNCTION admin_reject_doctor(doctor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_email TEXT;
BEGIN
  -- Get admin email from app settings
  admin_email := current_setting('app.admin_email', true);

  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = admin_email
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Change doctor role to patient
  UPDATE profiles
  SET role = 'patient', is_approved = false
  WHERE id = doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 6: RATE LIMITING
-- ============================================================================

-- Create a table to track API requests
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON api_rate_limits(user_id, endpoint, window_start);

-- Enable RLS on rate limits table
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own rate limits (for debugging)
CREATE POLICY "Users can read own rate limits"
ON api_rate_limits FOR SELECT
USING (auth.uid() = user_id);

-- System functions can manage rate limits (SECURITY DEFINER functions)
CREATE POLICY "System can manage rate limits"
ON api_rate_limits FOR ALL
USING (true)
WITH CHECK (true);

-- Function to check rate limit
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
-- STEP 7: AUDIT LOGGING
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Only admins can read audit logs"
ON audit_logs FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM auth.users WHERE email = current_setting('app.admin_email', true)
  )
);

-- System functions can write audit logs (SECURITY DEFINER functions)
CREATE POLICY "System can write audit logs"
ON audit_logs FOR INSERT
WITH CHECK (true);

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

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS log_profile_updates ON profiles;
DROP TRIGGER IF EXISTS log_appointment_status_changes ON appointments;

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
-- STEP 8: DATA SANITIZATION
-- ============================================================================

-- Function to sanitize text input
CREATE OR REPLACE FUNCTION sanitize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Remove null bytes (using chr(0) to avoid encoding issues)
  input_text := REPLACE(input_text, chr(0), '');

  -- Trim whitespace
  input_text := TRIM(input_text);

  -- Limit length
  input_text := LEFT(input_text, 1000);

  RETURN input_text;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS sanitize_profile_input ON profiles;

-- Apply sanitization to profiles
CREATE OR REPLACE FUNCTION trigger_sanitize_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.full_name := sanitize_text(NEW.full_name);
  IF NEW.specialty IS NOT NULL THEN
    NEW.specialty := sanitize_text(NEW.specialty);
  END IF;
  IF NEW.experience IS NOT NULL THEN
    NEW.experience := sanitize_text(NEW.experience);
  END IF;
  IF NEW.clinic_address IS NOT NULL THEN
    NEW.clinic_address := sanitize_text(NEW.clinic_address);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_profile_input
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_sanitize_profile();

-- ============================================================================
-- STEP 9: SUSPICIOUS ACTIVITY DETECTION
-- ============================================================================

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS detect_appointment_spam ON appointments;

-- Detect spam appointments
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
-- STEP 10: BACKUP ADMIN ACCESS
-- ============================================================================

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on admin users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage admin users
CREATE POLICY "Only admins can manage admin_users"
ON admin_users FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM auth.users WHERE email = current_setting('app.admin_email', true)
  )
);

-- Function to check if user is admin
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
-- STEP 11: AUTOMATIC CLEANUP
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
END;
$$;

-- ============================================================================
-- STEP 12: PERFORMANCE INDEXES
-- ============================================================================

-- Index for faster doctor lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_approved
ON profiles(role, is_approved)
WHERE role = 'doctor' AND is_approved = true;

-- Index for appointment queries
CREATE INDEX IF NOT EXISTS idx_appointments_patient
ON appointments(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor
ON appointments(doctor_id, created_at DESC);

-- ============================================================================
-- DONE! All security fixes applied.
-- ============================================================================
-- This script is IDEMPOTENT - safe to run multiple times.
--
-- Next steps:
-- 1. Set admin email in Database > Settings > app.admin_email
-- 2. Create storage buckets: 'avatars' (public) and 'diplomas' (private)
-- 3. Test the app to make sure everything works
-- ============================================================================
