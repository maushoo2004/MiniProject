import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import CommentForm from "./CommentForm";
import CommentList from "./CommentList";
import "./Comments.css";

const Comments = ({ postId, isAuthor, showToast, user }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const { getUserProfile, refreshReportCount } = useAuth();

  // Fetch comments from Supabase
  useEffect(() => {
    fetchComments();

    // Subscribe to comment changes
    const channel = supabase
      .channel("comments_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchComments = async () => {
    try {
      // Get comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select(
          `
          *,
          profiles:user_id (
            id,
            name,
            email
          )
        `
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      // Get reported comment IDs for current user
      let reportedCommentIds = [];
      if (user) {
        const { data: reportsData } = await supabase
          .from("reports")
          .select("comment_id")
          .eq("reporter_id", user.id)
          .not("comment_id", "is", null);

        if (reportsData) {
          reportedCommentIds = reportsData
            .map((r) => r.comment_id)
            .filter(Boolean);
        }
      }

      // Transform data and filter out reported comments for non-authors
      const transformedComments = commentsData
        .map((comment) => ({
          id: comment.id,
          author:
            comment.profiles?.name || comment.profiles?.email || "Unknown",
          content: comment.content,
          date: comment.created_at,
          isFlagged: comment.is_flagged,
          toxicityScore: comment.toxicity_score,
          severity: comment.severity,
          categories: comment.categories || [],
          moderationSource: comment.moderation_source,
          userId: comment.user_id,
          isReported: reportedCommentIds.includes(comment.id),
        }))
        .filter((comment) => {
          // Authors see all comments EXCEPT reported ones in flagged list
          if (isAuthor) {
            // If comment is reported, don't show it in the list (it's been handled)
            // But still mark it as reported for UI purposes
            return true; // Authors can see all, but we'll filter reported flagged ones in CommentList
          }
          // Non-authors don't see flagged comments
          if (comment.isFlagged) return false;
          // Non-authors don't see reported comments
          if (comment.isReported) return false;
          return true;
        });

      setComments(transformedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleAddComment = async (commentData) => {
    if (!user) {
      showToast("Please login to comment", "error");
      return;
    }

    setLoading(true);
    try {
      // Verify user is authenticated
      if (!user || !user.id) {
        throw new Error("User not authenticated");
      }

      console.log("💾 Attempting to save comment:", {
        post_id: postId,
        user_id: user.id,
        content: commentData.content.substring(0, 50),
        is_flagged: commentData.isFlagged,
        toxicity_score: commentData.toxicityScore,
      });

      // Save comment to Supabase with enhanced moderation data
      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            content: commentData.content,
            is_flagged: commentData.isFlagged || false,
            toxicity_score: commentData.toxicityScore || null,
            severity: commentData.severity || null,
            categories: commentData.categories || [],
            moderation_source: commentData.source || "keyword",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase insert error:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        throw error;
      }

      console.log("✅ Comment saved successfully:", data);

      // Refresh comments
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      showToast("Error posting comment. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReportUser = async (userId, commentId) => {
    if (!user) {
      showToast("Please login to report users", "error");
      return;
    }

    try {
      // Check if this specific comment has already been reported by this user
      const { data: existingReports, error: checkError } = await supabase
        .from("reports")
        .select("*")
        .eq("reported_user_id", userId)
        .eq("reporter_id", user.id)
        .eq("comment_id", commentId);

      if (checkError) {
        console.warn("Error checking existing reports:", checkError);
      }

      if (existingReports && existingReports.length > 0) {
        showToast("You have already reported this comment", "warning");
        return;
      }

      // Create report (allow same user to be reported multiple times for different comments)
      const { error: reportError } = await supabase.from("reports").insert([
        {
          reported_user_id: userId,
          reporter_id: user.id,
          comment_id: commentId,
          post_id: postId,
          created_at: new Date().toISOString(),
        },
      ]);

      // Handle 409 conflict (duplicate) error
      if (reportError) {
        if (
          reportError.code === "23505" ||
          reportError.code === "PGRST116" ||
          reportError.message?.includes("duplicate") ||
          reportError.message?.includes("409")
        ) {
          showToast("You have already reported this user", "warning");
          return;
        }
        throw reportError;
      }

      // Increment report count for the reported user using database function
      console.log("🔍 Incrementing report count for user:", userId);

      // Use the database function to increment report count (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "increment_user_report_count",
        { target_user_id: userId }
      );

      if (rpcError) {
        console.error("❌ Error calling increment function:", rpcError);
        console.error("Error details:", {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        });

        // Fallback to direct update if function doesn't exist
        console.log("⚠️ Falling back to direct update method...");
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("report_count")
          .eq("id", userId)
          .single();

        if (fetchError) {
          console.error("❌ Error fetching profile:", fetchError);
          throw fetchError;
        }

        console.log("📊 Current profile data:", profile);
        const currentCount = profile?.report_count || 0;
        const newReportCount = currentCount + 1;
        console.log(
          `📈 Incrementing report count: ${currentCount} → ${newReportCount}`
        );

        const { data: updateData, error: updateError } = await supabase
          .from("profiles")
          .update({ report_count: newReportCount })
          .eq("id", userId)
          .select();

        if (updateError) {
          console.error("❌ Error updating profile:", updateError);
          console.error("Error details:", {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
          });
          throw updateError;
        }

        console.log("✅ Profile updated successfully (fallback):", updateData);
      } else {
        console.log("✅ Report count incremented successfully via function");
      }

      // Mark comment as reported in local state immediately
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === commentId ? { ...comment, isReported: true } : comment
        )
      );

      showToast(
        "User reported successfully. The comment has been removed from view.",
        "success"
      );

      // Refresh the reported user's report count in auth context
      // This is important if the reported user is the current logged-in user
      if (refreshReportCount) {
        refreshReportCount();
      }

      // Refresh comments to ensure database state is synced
      // This will also update the reportedCommentIds check
      setTimeout(() => {
        fetchComments();
      }, 500);
    } catch (error) {
      console.error("Error reporting user:", error);
      showToast("Error reporting user. Please try again.", "error");
    }
  };

  if (!user) {
    return (
      <div className="comments-section">
        <h2 className="comments-title">Comments</h2>
        <div className="login-prompt">
          <p>Please login to view and post comments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="comments-section">
      <h2 className="comments-title">Comments</h2>

      <CommentForm
        postId={postId}
        onAddComment={handleAddComment}
        showToast={showToast}
        user={user}
      />

      <CommentList
        comments={comments}
        isAuthor={isAuthor}
        onReportUser={handleReportUser}
      />
    </div>
  );
};

export default Comments;
