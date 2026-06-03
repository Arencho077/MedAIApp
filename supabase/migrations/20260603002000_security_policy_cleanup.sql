-- Tighten overly broad policies created during early development.
-- This migration preserves the app's current user flows while removing
-- public write access to sensitive system tables and duplicate permissive
-- policies that made reasoning about RLS difficult.

-- ---------------------------------------------------------------------------
-- Helper: central admin check.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = check_user_id
      AND lower(u.email) = lower(COALESCE(
        (SELECT value FROM public.app_settings WHERE key = 'admin_email'),
        'sargsyanaren218@gmail.com'
      ))
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.id = check_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Sensitive support tables.
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can read app settings" ON public.app_settings;
CREATE POLICY "Admins can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "System can write audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only admins can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "System can manage rate limits" ON public.api_rate_limits;
DROP POLICY IF EXISTS "Users can read own rate limits" ON public.api_rate_limits;
DROP POLICY IF EXISTS "Users can read own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can read own rate limits"
  ON public.api_rate_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;
CREATE POLICY "Admins can manage admin users"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles: remove duplicate and unsafe policies, keep intended access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow signup profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot change their own role" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read approved doctors" ON public.profiles;
DROP POLICY IF EXISTS "Approved doctors can be viewed publicly" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Approved doctors are public"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (role = 'doctor' AND is_approved = true);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Appointments: remove duplicates, keep patient/doctor access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can read own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can read their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can cancel own appointments" ON public.appointments;

CREATE POLICY "Patients can create appointments"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Participants can read appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id OR public.is_admin());

CREATE POLICY "Doctors can update their appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = doctor_id OR public.is_admin())
  WITH CHECK (auth.uid() = doctor_id OR public.is_admin());

CREATE POLICY "Patients can cancel pending appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id AND status = 'pending')
  WITH CHECK (auth.uid() = patient_id AND status = 'cancelled');

-- ---------------------------------------------------------------------------
-- Storage: remove duplicate broad public policies and align path checks.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Doctors can upload own diploma" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can read own diploma" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own diplomas" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own diplomas" ON storage.objects;

CREATE POLICY "Anyone can read avatars"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can update own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can upload own diplomas"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can read own diplomas"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Admins can read diplomas"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND public.is_admin()
  );

CREATE POLICY "Users can update own diplomas"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can delete own diplomas"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

