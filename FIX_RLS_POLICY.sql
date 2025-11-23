-- Fix RLS Policy for Comments Table
-- Run this in Supabase SQL Editor if you're getting 403 errors when posting comments

-- First, drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;

-- Create a new, more permissive INSERT policy
-- This allows any authenticated user to insert comments where user_id matches their auth.uid()
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = user_id
  );

-- Also ensure the SELECT policy allows users to see their own comments
DROP POLICY IF EXISTS "Non-flagged comments are viewable by everyone" ON comments;

CREATE POLICY "Non-flagged comments are viewable by everyone"
  ON comments FOR SELECT
  USING (
    is_flagged = false OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = comments.post_id
      AND posts.author_id = auth.uid()
    )
  );

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'comments';

