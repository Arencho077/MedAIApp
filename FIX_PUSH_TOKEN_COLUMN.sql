-- ============================================================================
-- FIX: Add push_token column to profiles table
-- ============================================================================
-- This fixes the bug where push notifications fail because the column doesn't exist
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add push_token column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add index for better performance when looking up users by push token
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
ON profiles(id)
WHERE push_token IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'push_token';

-- ============================================================================
-- DONE! Push notifications will now work correctly.
-- ============================================================================
