import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, mapPost, POST_SELECT, deleteImage, storagePathFromUrl } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import Comments from "./Comments";
import EmptyState from "./EmptyState";
import { PostSkeleton } from "./Skeleton";
import "./BlogPost.css";

const BlogPost = ({ showToast, user, onAuthClick, onPostDeleted }) => {
  const { id } = useParams();
  const postId = parseInt(id, 10);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!Number.isInteger(postId)) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("id", postId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching post:", error);
      showToast("Error loading post", "error");
    }
    setBlog(data ? mapPost(data) : null);
    setLoading(false);
  }, [postId, showToast]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const isAuthor = Boolean(user && blog && user.id === blog.authorId);

  const handleDelete = async () => {
    if (!window.confirm("Delete this post and all of its comments? This can't be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      console.error(error);
      showToast("Couldn't delete the post.", "error");
      setDeleting(false);
      return;
    }
    if (isAuthor) await deleteImage(storagePathFromUrl(blog.image_url));
    showToast("Post deleted", "success");
    onPostDeleted?.();
    navigate("/");
  };

  if (loading) return <PostSkeleton />;

  if (!blog) {
    return (
      <div className="blog-post">
        <EmptyState
          icon="🔍"
          title="Post not found"
          action={
            <Link to="/" className="btn btn-primary btn-sm">
              ← Back to Home
            </Link>
          }
        >
          This post may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  const edited =
    blog.updated_at && new Date(blog.updated_at) - new Date(blog.created_at) > 60 * 1000;

  return (
    <div className="blog-post">
      <div className="post-toolbar">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>
        {(isAuthor || isAdmin) && (
          <div className="post-owner-actions">
            {isAuthor && (
              <button className="post-action-btn" onClick={() => navigate(`/edit/${blog.id}`)}>
                ✏️ Edit
              </button>
            )}
            <button
              className="post-action-btn danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "🗑️ Delete"}
            </button>
          </div>
        )}
      </div>

      <article className="post-content">
        <header className="post-header">
          <h1>{blog.title}</h1>
          <div className="post-meta">
            <span className="post-author">By {blog.author}</span>
            <span className="post-date">
              {new Date(blog.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {edited && " · edited"}
            </span>
          </div>
        </header>

        {blog.image_url && (
          <div className="post-cover-image">
            <img src={blog.image_url} alt={blog.title} />
          </div>
        )}

        <div className="post-body">
          <p style={{ whiteSpace: "pre-wrap" }}>{blog.content}</p>
        </div>
      </article>

      <Comments
        postId={postId}
        isAuthor={isAuthor}
        showToast={showToast}
        user={user}
        onAuthClick={onAuthClick}
      />
    </div>
  );
};

export default BlogPost;
