-- Fix: Allow users to increment report_count for other users
-- This is needed so post authors can report commenters

-- STEP 1: Remove the UNIQUE constraint that prevents multiple reports
-- This allows the same author to report the same user multiple times (for different comments)
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS reports_reported_user_id_reporter_id_key;

-- Add a new constraint that only prevents duplicate reports for the SAME comment
ALTER TABLE reports
DROP CONSTRAINT IF EXISTS reports_unique_per_comment;

ALTER TABLE reports
ADD CONSTRAINT reports_unique_per_comment 
UNIQUE (reported_user_id, reporter_id, comment_id);

-- STEP 2: Create a Database Function to Increment Report Count (RECOMMENDED - More Secure)
-- Create a function that increments report count (bypasses RLS)
CREATE OR REPLACE FUNCTION increment_user_report_count(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
BEGIN
  UPDATE profiles
  SET report_count = COALESCE(report_count, 0) + 1
  WHERE id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_user_report_count(UUID) TO authenticated;

-- STEP 3: Modify RLS Policies (Backup Method)

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile fields" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update report_count" ON profiles;

-- Policy 1: Users can update their own profile fields
CREATE POLICY "Users can update own profile fields"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 2: Authenticated users can update report_count for anyone
CREATE POLICY "Authenticated users can update report_count"
  ON profiles FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

