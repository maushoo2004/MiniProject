# Blog Post Image Upload Implementation Guide

## Overview

This guide will help you add image upload functionality to your BlogX platform, storing images in Supabase Storage buckets.

---

## Step 1: Set Up Supabase Storage Bucket

### 1.1 Create Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"Create a new bucket"**
5. Configure the bucket:
   - **Name**: `blog-images`
   - **Public bucket**: ✅ **Enable** (so images can be publicly accessed)
   - **File size limit**: 5 MB (or your preferred size)
   - **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`
6. Click **"Create bucket"**

### 1.2 Set Up Storage Policies

1. In the Storage section, click on your `blog-images` bucket
2. Go to **"Policies"** tab
3. Create the following policies:

#### Policy 1: Allow Public Read Access

```sql
-- Policy Name: Public Access
-- Allowed operation: SELECT
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'blog-images');
```

#### Policy 2: Allow Authenticated Users to Upload

```sql
-- Policy Name: Authenticated users can upload
-- Allowed operation: INSERT
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-images');
```

#### Policy 3: Allow Users to Delete Their Own Images

```sql
-- Policy Name: Users can delete own images
-- Allowed operation: DELETE
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Step 2: Update Database Schema

### 2.1 Add Image Column to Posts Table

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this SQL command:

```sql
-- Add image_url column to posts table
ALTER TABLE posts
ADD COLUMN image_url TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN posts.image_url IS 'URL of the blog post cover image stored in Supabase Storage';
```

---

## Step 3: Code Implementation (Already Done)

### 3.1 Updated Files

The following files have been automatically updated:

1. **`src/lib/supabase.js`** - Added image upload utility functions
2. **`src/components/CreateBlogPost.js`** - Added image upload UI and logic
3. **`src/components/CreateBlogPost.css`** - Added styling for image upload
4. **`src/components/BlogPost.js`** - Display uploaded images
5. **`src/components/Home.js`** - Show images in blog cards

### 3.2 New Features Added

- ✅ Image file picker with preview
- ✅ Drag-and-drop support
- ✅ File size validation (max 5MB)
- ✅ File type validation (only images)
- ✅ Image preview before upload
- ✅ Upload progress indicator
- ✅ Remove/change image option
- ✅ Automatic image optimization
- ✅ Secure storage in Supabase bucket

---

## Step 4: Environment Variables

Make sure your `.env` file has the Supabase credentials:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Step 5: Testing

### 5.1 Test Image Upload

1. Start your app: `npm run dev`
2. Login to your account
3. Navigate to **"Create Post"**
4. Click on the **"Choose Image"** button or drag an image
5. Preview should appear
6. Fill in title and content
7. Click **"Create Post"**
8. Verify image appears in:
   - Blog post detail page
   - Home page blog cards

### 5.2 Test Validations

- ✅ Try uploading file > 5MB (should be rejected)
- ✅ Try uploading non-image file (should be rejected)
- ✅ Try removing image after preview
- ✅ Try changing image before submission

### 5.3 Verify Storage

1. Go to Supabase Dashboard → Storage → `blog-images`
2. Check that images are being uploaded with correct structure:
   ```
   blog-images/
   └── {user-id}/
       └── {timestamp}-{filename}
   ```

---

## Step 6: Optional Enhancements

### 6.1 Image Compression (Future)

Consider adding image compression library:

```bash
npm install browser-image-compression
```

### 6.2 Multiple Images (Future)

Extend to support image galleries in posts

### 6.3 Image Editing (Future)

Add basic editing features (crop, rotate, filters)

---

## Troubleshooting

### Issue: Images not uploading

- Check Supabase Storage policies are correctly set
- Verify bucket is public
- Check browser console for errors
- Ensure user is authenticated

### Issue: Images not displaying

- Verify `image_url` column exists in database
- Check the URL format in database
- Ensure bucket is public
- Check CORS settings in Supabase

### Issue: "Policy violation" error

- Review storage policies
- Ensure authenticated user has INSERT permission
- Check bucket_id in policies matches your bucket name

---

## Security Notes

1. **File Size Limit**: Currently set to 5MB, adjust as needed
2. **File Types**: Only allows image types (JPEG, PNG, GIF, WebP)
3. **User-based Folders**: Images are organized by user ID
4. **Public Access**: Images are publicly readable (needed for blog display)
5. **Authenticated Upload**: Only logged-in users can upload

---

## Summary

✅ Supabase Storage bucket created
✅ Storage policies configured
✅ Database schema updated
✅ Code implementation complete
✅ Image upload UI added
✅ Image preview functionality
✅ Validation and error handling
✅ Responsive design

Your BlogX platform now supports image uploads! Users can add cover images to their blog posts, making the platform more visually engaging.
