# Supabase Setup Guide - Step by Step

This guide will walk you through setting up Supabase for authentication, user profiles, and report tracking.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up using:
   - GitHub (recommended)
   - Email
   - Google account
4. Verify your email if required

## Step 2: Create a New Project

1. Once logged in, click **"New Project"**
2. Fill in the project details:
   - **Name**: `blog-space` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Select **Free** (for development)
3. Click **"Create new project"**
4. Wait 2-3 minutes for the project to be set up

## Step 3: Get Your API Keys

1. In your project dashboard, click on the **Settings** icon (gear icon) in the left sidebar
2. Click on **"API"** in the settings menu
3. You'll see two important values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
4. Copy both values - you'll need them in Step 5

## Step 4: Set Up Database Tables

### 4.1 Create the `profiles` Table

1. In your Supabase dashboard, click on **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy and paste the following SQL:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  report_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

### 4.2 Create the `reports` Table

1. In the SQL Editor, click **"New query"** again
2. Copy and paste the following SQL:

```sql
-- Create reports table
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id TEXT,
  post_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(reported_user_id, reporter_id)
);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view all reports
CREATE POLICY "Reports are viewable by everyone"
  ON reports FOR SELECT
  USING (true);

-- Create policy: Users can insert their own reports
CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Create index for faster queries
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
```

3. Click **"Run"**
4. You should see "Success. No rows returned"

### 4.3 Create the `posts` Table

1. In the SQL Editor, click **"New query"** again
2. Copy and paste the following SQL:

```sql
-- Create posts table for blog posts
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy: Everyone can view all posts
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

-- Create policy: Only authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Create policy: Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id);

-- Create policy: Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = author_id);

-- Create index for faster queries
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

3. Click **"Run"**
4. You should see "Success. No rows returned"

### 4.4 Create the `comments` Table

1. In the SQL Editor, click **"New query"** again
2. Copy and paste the following SQL:

```sql
-- Create comments table with enhanced moderation fields
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  toxicity_score NUMERIC(5, 4),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  categories TEXT[], -- Array of category strings
  moderation_source TEXT, -- 'openai' or 'keyword'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policy: Everyone can view non-flagged comments
-- Authors can view all comments (including flagged ones)
CREATE POLICY "Non-flagged comments are viewable by everyone"
  ON comments FOR SELECT
  USING (
    is_flagged = false OR
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = comments.post_id
      AND posts.author_id = auth.uid()
    )
  );

-- Create policy: Only authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Create policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_flagged ON comments(is_flagged);
CREATE INDEX idx_comments_created ON comments(created_at DESC);
```

3. Click **"Run"**
4. You should see "Success. No rows returned"

### 4.5 Update the `reports` Table to Reference Comments and Posts

Now that we have the `posts` and `comments` tables, we need to update the `reports` table to properly reference them with foreign keys.

1. In the SQL Editor, click **"New query"** again
2. Copy and paste the following SQL to update the reports table:

```sql
-- Update reports table to properly reference comments and posts
-- Drop the old columns (they were created without foreign key constraints)
ALTER TABLE reports
  DROP COLUMN IF EXISTS comment_id,
  DROP COLUMN IF EXISTS post_id;

-- Add new columns with proper foreign key references
ALTER TABLE reports
  ADD COLUMN comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  ADD COLUMN post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE;
```

3. Click **"Run"**
4. You should see "Success. No rows returned"

**Note**: This step updates the reports table to have proper relationships with posts and comments. The columns are recreated with foreign key constraints for data integrity.

### 4.6 Verify Tables Were Created

1. Click on **"Table Editor"** in the left sidebar
2. You should see four tables:
   - `profiles`
   - `reports`
   - `posts`
   - `comments`
3. Click on each table to verify the columns are correct

## Step 5: Configure Your React App

1. In your project root directory, create a `.env` file (if it doesn't exist)
2. Add the following lines (replace with your actual values):

```env
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_OPENAI_API_KEY=sk-your-openai-key-here
```

3. Replace:

   - `https://xxxxx.supabase.co` with your **Project URL** from Step 3
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` with your **anon public** key from Step 3
   - `sk-your-openai-key-here` with your OpenAI API key (if you have one)

4. **Important**: Make sure `.env` is in your `.gitignore` file (it should already be there)

## Step 6: Install Dependencies

In your terminal, run:

```bash
npm install
```

This will install the `@supabase/supabase-js` package.

## Step 7: Test the Setup

1. Start your development server:

   ```bash
   npm start
   ```

2. Open your browser to `http://localhost:3000`

3. Click **"Login / Sign Up"** in the header

4. Try creating a new account:

   - Enter your name
   - Enter your email
   - Enter a password (at least 6 characters)
   - Click **"Sign Up"**

5. Check your email for a verification link (if email confirmation is enabled)

6. After logging in, you should see your name in the header

## Step 8: Configure Email Settings (Optional)

By default, Supabase requires email verification. To disable it for development:

1. In Supabase dashboard, go to **Settings** → **Authentication**
2. Scroll down to **"Email Auth"**
3. Toggle off **"Confirm email"** (for development only)
4. Click **"Save"**

**Note**: Keep email confirmation enabled in production!

## Step 9: Test Report Functionality

1. Create a blog post (you need to be logged in)
2. Add a comment with toxic content (it will be flagged)
3. As the post author, toggle **"Author View"**
4. You should see the flagged comment
5. Click **"🚨 Report User"**
6. The user's report count should increment in the database

## Troubleshooting

### Issue: "Invalid API key" error

- **Solution**: Double-check your `.env` file has the correct values
- Make sure there are no extra spaces or quotes
- Restart your dev server after changing `.env`

### Issue: "relation does not exist" error

- **Solution**: Make sure you ran all the SQL queries in Step 4
- Check the Table Editor to verify tables exist

### Issue: Can't sign up

- **Solution**: Check if email confirmation is required
- Check your Supabase dashboard for any errors
- Verify your email settings in Supabase

### Issue: Profile not created automatically

- **Solution**: The trigger should create it automatically
- You can manually create a profile in the Table Editor if needed

## Database Schema Overview

### `profiles` Table

- `id` (UUID, Primary Key) - References auth.users
- `name` (TEXT) - User's display name
- `email` (TEXT) - User's email
- `report_count` (INTEGER) - Number of times user has been reported
- `created_at` (TIMESTAMP) - When profile was created
- `updated_at` (TIMESTAMP) - When profile was last updated

### `posts` Table

- `id` (SERIAL, Primary Key) - Unique post ID
- `title` (TEXT) - Post title
- `content` (TEXT) - Full post content
- `excerpt` (TEXT) - Short excerpt/summary (optional)
- `author_id` (UUID) - References profiles(id) - Post author
- `created_at` (TIMESTAMP) - When post was created
- `updated_at` (TIMESTAMP) - When post was last updated

### `comments` Table

- `id` (SERIAL, Primary Key) - Unique comment ID
- `post_id` (INTEGER) - References posts(id) - Post this comment belongs to
- `user_id` (UUID) - References profiles(id) - Comment author
- `content` (TEXT) - Comment content
- `is_flagged` (BOOLEAN) - Whether comment was flagged as inappropriate
- `toxicity_score` (NUMERIC) - Moderation API toxicity score (0-1)
- `created_at` (TIMESTAMP) - When comment was created
- `updated_at` (TIMESTAMP) - When comment was last updated

### `reports` Table

- `id` (UUID, Primary Key) - Unique report ID
- `reported_user_id` (UUID) - References profiles(id) - User who was reported
- `reporter_id` (UUID) - References auth.users(id) - User who made the report
- `comment_id` (INTEGER) - References comments(id) - Comment that triggered the report
- `post_id` (INTEGER) - References posts(id) - Post where the report occurred
- `created_at` (TIMESTAMP) - When report was created

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Users can only update their own profiles
- Users can only create reports (not delete them)
- All profiles are viewable by everyone (for display purposes)
- Reports are viewable by everyone (for transparency)
- Posts are viewable by everyone, but only authenticated users can create them
- Users can only update/delete their own posts
- Comments are viewable by everyone (except flagged ones, which only post authors can see)
- Users can only create/update/delete their own comments
- Only authenticated users can create posts and comments

## Next Steps

After setup is complete:

1. Test authentication flow
2. Test creating posts (requires login) - posts will be saved to database
3. Test commenting (requires login) - comments will be saved to database
4. Test reporting users
5. Verify report counts increment correctly
6. Check the Table Editor to see your posts and comments in the database

## Database Relationships

The tables are connected as follows:

```
auth.users
  └── profiles (1:1 relationship)
      ├── posts (1:many - one user can have many posts)
      ├── comments (1:many - one user can have many comments)
      └── reports (1:many - one user can report many others)

posts
  └── comments (1:many - one post can have many comments)
      └── reports (1:many - one comment can have many reports)
```

Your Supabase setup is now complete! 🎉

All blog posts and comments will now be stored in the database and persist across sessions.

## Troubleshooting: RLS Policy Errors

If you get a **403 Forbidden** or **"new row violates row-level security policy"** error when posting comments:

1. Go to Supabase SQL Editor
2. Run the SQL from `FIX_RLS_POLICY.sql` file (or copy the SQL below):

```sql
-- Fix RLS Policy for Comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );
```

3. Click **"Run"**
4. Try posting a comment again

This ensures the policy correctly checks that the authenticated user's ID matches the user_id in the comment.

## Quick Reference: Table Creation Order

If you need to recreate the tables, follow this order:

1. **profiles** (Step 4.1) - Must be created first as other tables reference it
2. **reports** (Step 4.2) - References profiles
3. **posts** (Step 4.3) - References profiles
4. **comments** (Step 4.4) - References posts and profiles
5. **Update reports** (Step 4.5) - Adds foreign keys to posts and comments

This order ensures all foreign key dependencies are satisfied.
