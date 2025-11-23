-- Update comments table to add enhanced moderation fields
-- Run this in Supabase SQL Editor

-- Add new columns for enhanced moderation
ALTER TABLE comments 
  ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS categories TEXT[],
  ADD COLUMN IF NOT EXISTS moderation_source TEXT;

-- Update the SELECT policy to ensure flagged comments are hidden from non-authors
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

-- Update existing comments to have default values
UPDATE comments 
SET 
  severity = CASE 
    WHEN toxicity_score >= 0.8 THEN 'high'
    WHEN toxicity_score >= 0.5 THEN 'medium'
    WHEN toxicity_score > 0 THEN 'low'
    ELSE NULL
  END,
  categories = ARRAY[]::TEXT[],
  moderation_source = 'keyword'
WHERE severity IS NULL;

-- Verify the changes
SELECT 
  id, 
  is_flagged, 
  toxicity_score, 
  severity, 
  categories, 
  moderation_source 
FROM comments 
LIMIT 5;

