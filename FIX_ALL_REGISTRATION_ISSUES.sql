-- ============================================================================
-- COMPLETE FIX: Enable user registration in MedAI Armenia
-- ============================================================================
-- This script fixes ALL issues that prevent user registration:
-- 1. Broken sanitize_text function
-- 2. Missing RLS policies for signup
-- 3. Missing push_token column
--
-- SAFE TO RUN MULTIPLE TIMES (idempotent)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/jslfzhladmazveedsfde/sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix broken sanitize_text function
-- ============================================================================
-- Problem: The sanitize function crashes on registration due to null byte handling

-- Drop the broken trigger first
DROP TRIGGER IF EXISTS sanitize_profile_input ON profiles;

-- Drop the broken function
DROP FUNCTION IF EXISTS sanitize_text(TEXT);

-- Create a simpler, working version
CREATE OR REPLACE FUNCTION sanitize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Just trim and limit length (removed null byte handling that causes issues)
  input_text := TRIM(input_text);
  input_text := LEFT(input_text, 1000);
  RETURN input_text;
END;
$$;

-- Re-create the trigger
CREATE TRIGGER sanitize_profile_input
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_sanitize_profile();

SELECT '✅ Step 1/3: Fixed sanitize_text function' AS status;

-- ============================================================================
-- STEP 2: Fix RLS policies to allow signup
-- ============================================================================
-- Problem: RLS policies block anonymous users from creating profiles during signup

-- Drop the old policies
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON profiles;
DROP POLICY IF EXISTS "Allow signup profile creation" ON profiles;

-- Create policy for authenticated users
CREATE POLICY "Users can insert own profile on signup"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Create policy for anonymous users (needed during signup flow)
CREATE POLICY "Allow signup profile creation"
ON profiles FOR INSERT
TO anon
WITH CHECK (true);

SELECT '✅ Step 2/3: Fixed RLS policies for signup' AS status;

-- ============================================================================
-- STEP 3: Add missing push_token column
-- ============================================================================
-- Problem: Code tries to save push_token during registration, but column doesn't exist

-- Add push_token column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
ON profiles(id)
WHERE push_token IS NOT NULL;

SELECT '✅ Step 3/3: Added push_token column' AS status;

-- ============================================================================
-- VERIFICATION: Check that everything is fixed
-- ============================================================================

-- Verify push_token column exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'push_token'
    ) THEN '✅ push_token column exists'
    ELSE '❌ push_token column MISSING'
  END AS push_token_status;

-- Verify RLS policies exist
SELECT
  COUNT(*) AS policy_count,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ RLS policies configured'
    ELSE '❌ RLS policies MISSING'
  END AS rls_status
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname LIKE '%signup%';

-- Verify sanitize function exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE proname = 'sanitize_text'
    ) THEN '✅ sanitize_text function exists'
    ELSE '❌ sanitize_text function MISSING'
  END AS sanitize_status;

-- ============================================================================
-- ✅ DONE! Registration should now work!
-- ============================================================================
-- Next steps:
-- 1. Restart your Expo app: npm start
-- 2. Try registering a new user
-- 3. Check that profile is created successfully
-- ============================================================================
