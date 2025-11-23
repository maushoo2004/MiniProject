import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, uploadImage } from "../lib/supabase";
import "./CreateBlogPost.css";

const CreateBlogPost = ({ onAddPost, showToast, user, userProfile }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    handleImageFile(file);
  };

  const handleImageFile = (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size must be less than 5MB", "error");
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    handleImageFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (!user || !userProfile) {
      showToast("Please login to create a post", "error");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        setUploadProgress(50);
        const { url, error: uploadError } = await uploadImage(
          imageFile,
          user.id
        );

        if (uploadError) {
          throw new Error("Failed to upload image");
        }

        imageUrl = url;
        setUploadProgress(75);
      }

      // Generate excerpt if not provided
      const excerpt =
        formData.excerpt.trim() ||
        formData.content.substring(0, 150) +
          (formData.content.length > 150 ? "..." : "");

      // Save to Supabase
      const { data, error } = await supabase
        .from("posts")
        .insert([
          {
            title: formData.title,
            content: formData.content,
            excerpt: excerpt,
            image_url: imageUrl,
            author_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setUploadProgress(100);
      showToast("Blog post created successfully!", "success");

      // Refresh posts and navigate to the new post
      onAddPost();
      navigate(`/post/${data.id}`);
    } catch (error) {
      console.error("Error creating post:", error);
      showToast("Error creating post. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="create-blog-post">
      <div className="create-post-header">
        <h2>Create New Blog Post</h2>
        <p>Share your thoughts with the community</p>
      </div>

      <form className="create-post-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter blog post title"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="excerpt">Excerpt (Optional)</label>
          <textarea
            id="excerpt"
            name="excerpt"
            value={formData.excerpt}
            onChange={handleChange}
            placeholder="Brief summary of your post (will be auto-generated if left empty)"
            rows="3"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content *</label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            placeholder="Write your blog post here... (Supports both English and Hindi)"
            rows="12"
            disabled={isSubmitting}
            required
          />
          <small className="form-hint">
            You can write in English, Hindi, or mix both languages
          </small>
        </div>

        <div className="form-group image-upload-section">
          <label>Cover Image (Optional)</label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageFile}
            style={{ display: "none" }}
          />

          {!imagePreview ? (
            <div
              className="image-drop-zone"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                className="upload-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>
                Drag and drop an image here or{" "}
                <span className="browse-text">click to browse</span>
              </p>
              <p className="file-info">
                Maximum file size: 5MB | Supported: JPG, PNG, GIF, WebP
              </p>
            </div>
          ) : (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                type="button"
                className="remove-image-btn"
                onClick={removeImage}
                title="Remove image"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div
                className="upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate("/")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBlogPost;
