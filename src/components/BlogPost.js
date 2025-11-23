import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Comments from './Comments';
import './BlogPost.css';

const BlogPost = ({ showToast, user }) => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id, user]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            id,
            name,
            email
          )
        `)
        .eq('id', parseInt(id))
        .single();

      if (error) throw error;

      if (data) {
        const transformedPost = {
          id: data.id,
          title: data.title,
          content: data.content,
          excerpt: data.excerpt || data.content.substring(0, 150) + '...',
          author: data.profiles?.name || 'Unknown',
          authorId: data.author_id,
          date: data.created_at.split('T')[0],
          created_at: data.created_at
        };

        setBlog(transformedPost);
        // Check if current user is the author
        setIsAuthor(user?.id === data.author_id);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      showToast('Error loading post', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="blog-post">
        <div className="loading-state">
          <p>Loading post...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="blog-post">
        <div className="not-found">
          <h2>Blog post not found</h2>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-post">
      <Link to="/" className="back-link">← Back to Home</Link>
      
      <article className="post-content">
        <header className="post-header">
          <h1>{blog.title}</h1>
          <div className="post-meta">
            <span className="post-author">By {blog.author}</span>
            <span className="post-date">{new Date(blog.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
        </header>
        
        <div className="post-body">
          <p>{blog.content}</p>
        </div>
      </article>

      <Comments 
        postId={parseInt(id)} 
        isAuthor={isAuthor}
        showToast={showToast}
        user={user}
      />
    </div>
  );
};

export default BlogPost;

