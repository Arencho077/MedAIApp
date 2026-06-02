-- ============================================================================
-- SECURITY POLICIES FOR MEDAI APP
-- Apply these policies to your Supabase database for proper security
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE POLICIES
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
    SELECT id FROM profiles WHERE email = current_setting('app.admin_email', true)
  )
);

-- Allow new user registration (insert)
CREATE POLICY "Users can insert own profile on signup"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- APPOINTMENTS TABLE POLICIES
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
-- STORAGE POLICIES
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
    SELECT id FROM profiles WHERE email = current_setting('app.admin_email', true)
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
-- ADMIN RPC FUNCTIONS (Server-side validation)
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
    SELECT 1 FROM profiles
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
    SELECT 1 FROM profiles
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
-- INDEXES FOR PERFORMANCE
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

-- Index for push token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
ON profiles(id)
WHERE push_token IS NOT NULL;

-- ============================================================================
-- NOTES:
-- 1. Set admin email in Supabase dashboard: Database > Settings >
--    Custom Postgres Configuration > app.admin_email = 'your@email.com'
-- 2. Create storage buckets: 'avatars' (public) and 'diplomas' (private)
-- 3. These policies prevent IDOR attacks and enforce proper authorization
-- 4. Always validate on the server side, never trust client-side checks
-- ============================================================================
