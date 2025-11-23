import React, { useState } from "react";
import {
  moderateContentEnhanced,
  getAISuggestion,
} from "../services/enhancedModerationService";
import "./CommentForm.css";

const CommentForm = ({ postId, onAddComment, showToast, user }) => {
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
  const handlePostAnyway = async () => {
    if (!moderationResult || !content.trim() || !user) {
      return;
    }

    setIsSubmitting(true);
    setShowSuggestion(false);

    try {
      const commentData = {
        content: content,
        isFlagged: moderationResult.isToxic,
        toxicityScore: moderationResult.score || null,
        severity: moderationResult.severity || null,
        categories: moderationResult.categories || [],
        source: moderationResult.source || "keyword",
      };

      await onAddComment(commentData);

      if (moderationResult.isToxic) {
        showToast(
          `Your comment has been flagged and posted (Score: ${(
            moderationResult.score * 100
          ).toFixed(1)}%). It will be reviewed.`,
          "warning"
        );
      } else {
        showToast("Comment posted successfully!", "success");
      }

      // Reset form
      setContent("");
      setAiSuggestion(null);
      setShowSuggestion(false);
      setModerationResult(null);
    } catch (error) {
      console.error("Error submitting comment:", error);
      showToast("Error posting comment. Please try again.", "error");
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
          placeholder="Share your thoughts... (Supports Hindi and English)"
          rows="4"
          disabled={isSubmitting}
        />
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
                💬 Your comment was flagged as potentially inappropriate. You
                can use the polite suggestion above or post your original
                comment.
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
                ⚠️ Your comment will be flagged and may not be visible to
                everyone.
              </p>
            </>
          )}
        </div>
      )}

      <div className="form-actions-wrapper">
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting || isCheckingModeration}
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
