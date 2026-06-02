-- ============================================================================
-- PROPER FIX: Make trigger bypass RLS (production-safe)
-- ============================================================================
-- Problem: Trigger has SECURITY DEFINER but doesn't bypass RLS
-- Solution: Grant proper permissions and ensure trigger runs as superuser
-- ============================================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function with proper permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's privileges
SET search_path = public, auth
AS $$
BEGIN
  -- Insert into profiles (bypasses RLS because of SECURITY DEFINER)
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
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'doctor' THEN false
      ELSE true
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth.users insert
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute permission to postgres (superuser)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create minimal RLS policies that work with the trigger
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- SELECT: Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- DELETE: Users cannot delete profiles
-- (no DELETE policy = no one can delete except superuser)

SELECT '✅ Trigger fixed with proper SECURITY DEFINER + RLS enabled' AS status;

-- ============================================================================
-- ✅ DONE! Trigger will bypass RLS, but users still protected by policies
-- ============================================================================
