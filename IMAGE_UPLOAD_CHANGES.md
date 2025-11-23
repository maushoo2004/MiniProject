# Image Upload Implementation - Code Changes Summary

This document summarizes all the code changes made to implement image upload functionality for blog posts in BlogX.

## Overview

The image upload feature allows users to:

- Upload a cover image when creating a blog post
- Preview the image before submission
- Use drag-and-drop or click to browse
- View cover images on blog posts and blog cards
- Images are stored in Supabase Storage buckets

---

## Files Modified

### 1. **CreateBlogPost.js** (`src/components/CreateBlogPost.js`)

**Added Imports:**

```javascript
import { useRef } from "react";
import { uploadImage } from "../lib/supabase";
```

**Added State:**

```javascript
const [imageFile, setImageFile] = useState(null);
const [imagePreview, setImagePreview] = useState(null);
const [uploadProgress, setUploadProgress] = useState(0);
const fileInputRef = useRef(null);
```

**Added Helper Functions:**

- `handleImageSelect(file)` - Validates file type and size (max 5MB)
- `handleImageFile(e)` - Handles file input change event
- `handleDragOver(e)` - Prevents default drag behavior
- `handleDrop(e)` - Handles file drop event
- `removeImage()` - Clears selected image and preview

**Modified handleSubmit:**

- Added image upload before post creation
- Shows upload progress
- Stores image URL in database

```javascript
if (imageFile) {
  setUploadProgress(50);
  const { url, error: uploadError } = await uploadImage(imageFile, user.id);
  if (uploadError) throw new Error("Failed to upload image");
  imageUrl = url;
  setUploadProgress(75);
}
```

**Added JSX for Image Upload UI:**

- Hidden file input with ref
- Drag-and-drop zone with upload icon
- Image preview with remove button
- Upload progress bar

---

### 2. **CreateBlogPost.css** (`src/components/CreateBlogPost.css`)

**Added Styles:**

```css
/* Image Upload Section */
.image-upload-section
  .image-drop-zone
  (with hover effects)
  .upload-icon
  .browse-text
  .file-info
  .image-preview
  .remove-image-btn
  (with hover effects)
  .upload-progress
  .upload-progress-bar
  (with shimmer animation);
```

**Key Features:**

- Purple accent colors matching theme
- Smooth transitions and animations
- Hover effects on drop zone and remove button
- Shimmer effect on progress bar
- Responsive design

---

### 3. **BlogPost.js** (`src/components/BlogPost.js`)

**Modified Data Fetching:**

```javascript
const transformedPost = {
  // ... existing fields
  image_url: data.image_url, // Added
  // ... other fields
};
```

**Added Image Display in JSX:**

```javascript
{
  blog.image_url && (
    <div className="post-cover-image">
      <img src={blog.image_url} alt={blog.title} />
    </div>
  );
}
```

---

### 4. **BlogPost.css** (`src/components/BlogPost.css`)

**Added Styles:**

```css
.post-cover-image {
  margin: 2rem -3rem;
  border-radius: 12px;
  overflow: hidden;
  animation: fadeIn 0.5s ease;
}

.post-cover-image img {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: cover;
  display: block;
}
```

**Responsive Adjustments:**

- Adjusted margins for mobile view
- Reduced max-height for smaller screens

---

### 5. **Home.js** (`src/components/Home.js`)

**Modified Blog Card Rendering:**

```javascript
<Link to={`/post/${blog.id}`} key={blog.id} className="blog-card">
  {blog.image_url && (
    <div className="blog-card-image">
      <img src={blog.image_url} alt={blog.title} />
    </div>
  )}
  <div className="blog-card-content">{/* ... existing content */}</div>
</Link>
```

---

### 6. **Home.css** (`src/components/Home.css`)

**Modified Blog Card Structure:**

```css
.blog-card {
  display: flex; /* Changed from block */
  flex-direction: column; /* Added */
  /* Removed padding: 2rem */
}
```

**Added Image Styles:**

```css
.blog-card-image {
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.blog-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.blog-card:hover .blog-card-image img {
  transform: scale(1.1); /* Zoom effect on hover */
}

.blog-card-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
```

---

### 7. **supabase.js** (`src/lib/supabase.js`)

**Already Added in Previous Step** (from IMAGE_UPLOAD_IMPLEMENTATION.md):

```javascript
export const uploadImage = async (file, userId) => {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("blog-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("blog-images").getPublicUrl(fileName);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { url: null, error };
  }
};

export const deleteImage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from("blog-images")
      .remove([filePath]);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting image:", error);
    return { success: false, error };
  }
};
```

---

## Database Schema Update Required

Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE posts
ADD COLUMN image_url TEXT;
```

---

## Supabase Storage Setup Required

### 1. Create Storage Bucket

- Go to Supabase Dashboard → Storage
- Create new bucket: `blog-images`
- Set to **Public**

### 2. Set Storage Policies

**Policy 1: Public Read Access**

```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'blog-images' );
```

**Policy 2: Authenticated Upload**

```sql
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-images'
  AND auth.role() = 'authenticated'
);
```

**Policy 3: User Delete Own Images**

```sql
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'blog-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Features Implemented

✅ **Image Upload with Validation**

- File type check (images only)
- File size limit (5MB)
- Error handling

✅ **Drag and Drop Support**

- Visual feedback on drag over
- Drop zone click to browse

✅ **Image Preview**

- Real-time preview before upload
- Remove image button
- Upload progress bar

✅ **Cover Image Display**

- Full-width cover image on blog post page
- Thumbnail image on blog cards (home page)
- Zoom effect on hover for blog cards

✅ **Responsive Design**

- Mobile-friendly layouts
- Adjusted image sizes for different screens
- Touch-friendly controls

✅ **Dark Theme Integration**

- Purple accent colors
- Glassmorphism effects
- Smooth animations

---

## User Workflow

1. **Create New Post**

   - Click "Create Post" button
   - Fill in title and content
   - Optionally drag/drop or click to upload cover image
   - See live preview of selected image
   - Click "Publish Post"

2. **Image Upload Process**

   - Image is validated (type and size)
   - Preview is shown immediately
   - On submit, image uploads to Supabase Storage
   - Progress bar shows upload status
   - Image URL is saved with post data

3. **View Posts**
   - Home page shows blog cards with cover images (if available)
   - Blog post page displays full cover image
   - Hover effects add interactivity

---

## Testing Checklist

- [ ] Upload image when creating post
- [ ] Drag and drop image file
- [ ] Click to browse and select image
- [ ] Remove selected image
- [ ] Verify file size validation (try > 5MB)
- [ ] Verify file type validation (try non-image)
- [ ] View uploaded image on blog post page
- [ ] View thumbnail on home page blog cards
- [ ] Test responsive layout on mobile
- [ ] Verify Supabase storage bucket has images

---

## Troubleshooting

### Image not uploading?

1. Check Supabase Storage bucket exists
2. Verify storage policies are set correctly
3. Check browser console for errors
4. Ensure user is authenticated

### Image URL not saving?

1. Verify `image_url` column exists in `posts` table
2. Check database permissions
3. Look for console errors during submission

### Image not displaying?

1. Verify image URL is public
2. Check bucket is set to public
3. Inspect image URL in database
4. Check browser network tab for 404 errors

---

## Next Steps (Optional Enhancements)

- Add image editing (crop, resize)
- Support multiple images per post
- Add image compression before upload
- Implement lazy loading for images
- Add image alt text field for accessibility
- Delete old image when updating post with new image

---

## Summary

All code changes have been successfully implemented. The image upload feature is now fully integrated into the BlogX application with:

- Modern UI/UX with dark theme
- Drag-and-drop functionality
- Image validation and preview
- Progress tracking
- Responsive design
- Full integration with Supabase Storage

**Next:** User needs to complete Supabase setup (bucket + policies + database column) as documented in `IMAGE_UPLOAD_IMPLEMENTATION.md`.
