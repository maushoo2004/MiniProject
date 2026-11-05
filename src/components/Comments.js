import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";
import "./Comments.css";

const Comments = ({ postId, isAuthor, showToast, user, onAuthClick }) => {
  const [comments, setComments] = useState([]);
  const { refreshProfile, isAdmin } = useAuth();

  const fetchComments = useCallback(async () => {
    // RLS decides what comes back: public comments, plus your own flagged ones,
    // plus (for the post author/admin) flagged comments on this post.
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles:user_id (id, name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    let reportedIds = new Set();
    if (user) {
      const { data: reports } = await supabase
        .from("reports")
        .select("comment_id")
        .eq("reporter_id", user.id)
        .eq("post_id", postId);
      reportedIds = new Set((reports || []).map((r) => r.comment_id));
    }

    const mapped = data
      .map((c) => ({
        id: c.id,
        author: c.profiles?.name || "Unknown",
        content: c.content,
        date: c.created_at,
        isFlagged: c.is_flagged,
        toxicityScore: c.toxicity_score,
        severity: c.severity,
        categories: c.categories || [],
        moderationSource: c.moderation_source,
        userId: c.user_id,
        isOwn: user?.id === c.user_id,
        isReported: reportedIds.has(c.id),
      }))
      // Flagged comments stay off the post page (authors review them in Analytics),
      // except the writer sees their own so they know it was hidden.
      .filter((c) => !c.isFlagged || c.isOwn);

    setComments(mapped);
  }, [postId, user]);

  useEffect(() => {
    fetchComments();
    const channel = supabase
      .channel(`comments_post_${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => fetchComments()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchComments]);

  const handleCommentPosted = () => {
    fetchComments();
    refreshProfile();
  };

  const handleReportUser = async (commentId) => {
    const reason = window.prompt("Why are you reporting this comment? (optional)", "") ?? null;
    if (reason === null) return; // cancelled
    try {
      const { reportCount, blocked } = await api("/api/reports", {
        method: "POST",
        body: { commentId, reason },
      });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, isReported: true } : c)));
      showToast(
        blocked
          ? `User reported. They have ${reportCount} reports and are now blocked from commenting.`
          : `User reported (${reportCount} report${reportCount === 1 ? "" : "s"} so far).`,
        "success",
        5000
      );
    } catch (err) {
      showToast(err.message, err.status === 409 ? "warning" : "error");
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      console.error(error);
      showToast("Couldn't delete the comment.", "error");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    showToast("Comment deleted", "success");
  };

  const visibleCount = comments.filter((c) => !c.isFlagged).length;

  return (
    <div className="comments-section">
      <h2 className="comments-title">
        Comments {visibleCount > 0 && <span className="comment-count">({visibleCount})</span>}
      </h2>

      {user ? (
        <CommentForm postId={postId} onCommentPosted={handleCommentPosted} showToast={showToast} />
      ) : (
        <div className="login-prompt">
          <p>
            <button type="button" className="inline-link" onClick={onAuthClick}>
              Log in
            </button>{" "}
            to join the conversation.
          </p>
        </div>
      )}

      <CommentList
        comments={comments}
        isAuthor={isAuthor}
        canModerate={isAuthor || isAdmin}
        onReportUser={handleReportUser}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Comments;
