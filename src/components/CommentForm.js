import React, { useState } from "react";
import {
  moderateContentEnhanced,
  getAISuggestion,
} from "../services/enhancedModerationService";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import "./CommentForm.css";

const CommentForm = ({ postId, onAddComment, showToast, user }) => {
  const { isBlocked, userReportCount } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [isCheckingModeration, setIsCheckingModeration] = useState(false);
  const [moderationResult, setModerationResult] = useState(null);

  // Reset suggestion when content changes
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Reset moderation state when content changes
    if (showSuggestion) {
      setShowSuggestion(false);
      setAiSuggestion(null);
      setModerationResult(null);
    }
  };

  // Use the suggested rephrasing
  const handleUseSuggestion = async () => {
    if (aiSuggestion) {
      setContent(aiSuggestion);
      setShowSuggestion(false);
      setAiSuggestion(null);
      setModerationResult(null);
      showToast("Suggestion applied. Please review and submit.", "info");
    }
  };

  // Dismiss suggestion and keep original comment
  const handleDismissSuggestion = () => {
    setShowSuggestion(false);
    setAiSuggestion(null);
    setModerationResult(null);
  };

  // Post the original comment anyway (after seeing warning)
  // This now automatically reports the user and blocks the comment from the author
  const handlePostAnyway = async () => {
    if (!moderationResult || !content.trim() || !user) {
      return;
    }

    setIsSubmitting(true);
    setShowSuggestion(false);

    try {
      // Automatically report the user for posting toxic content
      console.log(
        "⚠️ User is posting toxic content anyway - auto-reporting..."
      );

      // First, create the comment in the database (marked as flagged)
      const commentData = {
        content: content,
        isFlagged: true,
        toxicityScore: moderationResult.score || null,
        severity: moderationResult.severity || "high",
        categories: moderationResult.categories || [],
        source: moderationResult.source || "keyword",
      };

      // Post the comment (flagged, so hidden from public but visible to post author)
      const postedComment = await onAddComment(commentData);
      console.log("💬 Toxic comment posted (flagged):", postedComment);

      // Create report in the reports table with the comment ID
      const { error: reportError } = await supabase.from("reports").insert([
        {
          reported_user_id: user.id,
          reporter_id: user.id, // Self-report by system
          comment_id: postedComment?.id || null,
          post_id: postId,
          reason: "Posted toxic content after moderation warning",
          created_at: new Date().toISOString(),
        },
      ]);

      if (reportError && reportError.code !== "23505") {
        console.error("Error creating auto-report:", reportError);
      }

      // Increment report count
      try {
        const { error: rpcError } = await supabase.rpc(
          "increment_user_report_count",
          { target_user_id: user.id }
        );

        if (rpcError) {
          // Fallback to direct update
          const { data: profile } = await supabase
            .from("profiles")
            .select("report_count")
            .eq("id", user.id)
            .single();

          const currentCount = profile?.report_count || 0;
          await supabase
            .from("profiles")
            .update({ report_count: currentCount + 1 })
            .eq("id", user.id);
        }
      } catch (error) {
        console.error("Error incrementing report count:", error);
      }

      // Show severe warning with longer duration (15 seconds)
      showToast(
        `⚠️ WARNING: Your comment has been BLOCKED and your account has been reported for posting inappropriate content after being warned. Continued violations will result in permanent suspension. Current toxicity score: ${(
          moderationResult.score * 100
        ).toFixed(1)}%`,
        "error",
        15000 // 15 seconds duration
      );

      // Reset form
      setContent("");
      setAiSuggestion(null);
      setShowSuggestion(false);
      setModerationResult(null);

      // Refresh auth context to update report count after toast is shown
      if (window.location) {
        setTimeout(() => {
          window.location.reload();
        }, 16000); // Reload after 16 seconds (after the 15-second toast)
      }
    } catch (error) {
      console.error("Error handling toxic comment:", error);
      showToast("Error processing your request. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      showToast("Please enter a comment", "error");
      return;
    }

    if (!user) {
      showToast("Please login to comment", "error");
      return;
    }

    // If already showing suggestion/warning, don't check again
    if (showSuggestion) {
      return;
    }

    setIsCheckingModeration(true);

    try {
      console.log("🔍 Checking content for moderation:", content);

      // First, check moderation
      const modResult = await moderateContentEnhanced(content);
      setModerationResult(modResult);

      console.log("📊 Moderation result:", modResult);

      // If content is toxic, get AI suggestion and show warning
      if (modResult.isToxic) {
        console.log("⚠️ Content is toxic, getting AI suggestion...");

        try {
          const suggestion = await getAISuggestion(content);
          if (suggestion && suggestion.trim().length > 0) {
            setAiSuggestion(suggestion);
            setShowSuggestion(true);
            console.log("💡 Showing suggestion to user");
            showToast(
              "Please review the suggestion or choose to post anyway",
              "warning"
            );
            return; // Stop here - don't submit yet
          }
        } catch (error) {
          console.warn("Could not get AI suggestion:", error);
        }

        // If no suggestion available, still show warning
        setShowSuggestion(true);
        showToast(
          "Your comment may be inappropriate. Review or post anyway.",
          "warning"
        );
        return; // Stop here - don't submit yet
      }

      // Content is clean, proceed with submission
      console.log("✅ Content is clean, submitting...");

      const commentData = {
        content: content,
        isFlagged: false,
        toxicityScore: modResult.score || null,
        severity: null,
        categories: [],
        source: modResult.source || "keyword",
      };

      await onAddComment(commentData);
      showToast("Comment posted successfully!", "success");

      // Reset form
      setContent("");
      setModerationResult(null);
    } catch (error) {
      console.error("Error submitting comment:", error);
      showToast("Error posting comment. Please try again.", "error");
    } finally {
      setIsCheckingModeration(false);
    }
  };

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="content">Your Comment</label>
        <textarea
          id="content"
          value={content}
          onChange={handleContentChange}
          placeholder={
            isBlocked
              ? "You are blocked from commenting due to multiple reports."
              : "Share your thoughts... (Supports Hindi and English)"
          }
          rows="4"
          disabled={isSubmitting || isBlocked}
        />
        {isBlocked && (
          <p
            className="blocked-message"
            style={{ color: "#fca5a5", marginTop: "8px", fontWeight: "600" }}
          >
            ⚠️ You cannot comment because your account has been reported{" "}
            {userReportCount} times (limit: 3).
          </p>
        )}
      </div>

      {/* AI Suggestion Box - Appears below comment box */}
      {showSuggestion && (
        <div className="ai-suggestion-box">
          <div className="suggestion-header">
            <span className="suggestion-icon">⚠️</span>
            <strong>Content Warning</strong>
            <button
              className="suggestion-close"
              onClick={handleDismissSuggestion}
              aria-label="Close suggestion"
              type="button"
            >
              ×
            </button>
          </div>
          {aiSuggestion ? (
            <>
              <p className="suggestion-text">{aiSuggestion}</p>
              <div className="suggestion-actions">
                <button
                  type="button"
                  className="use-suggestion-btn"
                  onClick={handleUseSuggestion}
                  disabled={isSubmitting}
                >
                  Use This Suggestion
                </button>
                <button
                  type="button"
                  className="post-anyway-btn"
                  onClick={handlePostAnyway}
                  disabled={isSubmitting}
                >
                  Post Original Anyway
                </button>
                <button
                  type="button"
                  className="dismiss-suggestion-btn"
                  onClick={handleDismissSuggestion}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
              <p className="suggestion-note">
                ⚠️ <strong>WARNING:</strong> Your comment was flagged as
                inappropriate. If you post it anyway, your account will be{" "}
                <strong>automatically reported</strong> and the comment will be{" "}
                <strong>BLOCKED from the author</strong>. Use the polite
                suggestion to avoid penalties.
              </p>
            </>
          ) : (
            <>
              <p className="suggestion-text">
                Your comment may contain inappropriate content. Please review
                your comment before posting.
              </p>
              <div className="suggestion-actions">
                <button
                  type="button"
                  className="post-anyway-btn"
                  onClick={handlePostAnyway}
                  disabled={isSubmitting}
                >
                  Post Anyway
                </button>
                <button
                  type="button"
                  className="dismiss-suggestion-btn"
                  onClick={handleDismissSuggestion}
                  disabled={isSubmitting}
                >
                  Cancel & Edit
                </button>
              </div>
              <p className="suggestion-note">
                ⚠️ <strong>SEVERE WARNING:</strong> Posting this comment will
                result in <strong>automatic account reporting</strong> and the
                comment will be <strong>BLOCKED</strong>. Your account may be
                suspended after multiple violations. Please edit your comment.
              </p>
            </>
          )}
        </div>
      )}

      <div className="form-actions-wrapper">
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting || isCheckingModeration || isBlocked}
        >
          {isSubmitting
            ? "Posting..."
            : isCheckingModeration
            ? "Checking..."
            : "Post Comment"}
        </button>
        {isCheckingModeration && (
          <span className="checking-indicator">🔍 Checking content...</span>
        )}
      </div>
    </form>
  );
};

export default CommentForm;
