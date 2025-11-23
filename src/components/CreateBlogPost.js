import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './CreateBlogPost.css';

const CreateBlogPost = ({ onAddPost, showToast, user, userProfile }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (!user || !userProfile) {
      showToast('Please login to create a post', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate excerpt if not provided
      const excerpt = formData.excerpt.trim() || 
        formData.content.substring(0, 150) + (formData.content.length > 150 ? '...' : '');

      // Save to Supabase
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            title: formData.title,
            content: formData.content,
            excerpt: excerpt,
            author_id: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      showToast('Blog post created successfully!', 'success');
      
      // Refresh posts and navigate to the new post
      onAddPost();
      navigate(`/post/${data.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      showToast('Error creating post. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
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
          <small className="form-hint">You can write in English, Hindi, or mix both languages</small>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate('/')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBlogPost;

