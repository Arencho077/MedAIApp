-- ============================================================================
-- FIX: Auto-create profiles with trigger (fixes foreign key constraint error)
-- ============================================================================
-- Problem: Manual INSERT into profiles fails because of timing/RLS issues
-- Solution: Use a database trigger to auto-create profiles on auth.users insert
-- ============================================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
SET search_path = public
AS $$
BEGIN
  -- Create profile with data from user_metadata
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    birth_year,
    social_link,
    diploma_url,
    approved
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'birth_year',
    NEW.raw_user_meta_data->>'social_link',
    NEW.raw_user_meta_data->>'diploma_url',
    -- Auto-approve patients, doctors need manual approval
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'doctor' THEN false
      ELSE true
    END
  );
  RETURN NEW;
END;
$$;

-- Create trigger that fires after user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'on_auth_user_created'
    )
    THEN '✅ Trigger created successfully'
    ELSE '❌ Trigger creation failed'
  END AS trigger_status;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'handle_new_user'
    )
    THEN '✅ Function created successfully'
    ELSE '❌ Function creation failed'
  END AS function_status;

-- ============================================================================
-- ✅ DONE! Now profiles will be auto-created on signup
-- ============================================================================
-- Next step: Remove manual INSERT from login.tsx (lines 153-166)
-- The trigger will handle profile creation automatically
-- ============================================================================
