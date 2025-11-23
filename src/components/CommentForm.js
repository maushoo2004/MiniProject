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
  const [isCheckingSuggestion, setIsCheckingSuggestion] = useState(false);

  // Reset suggestion when content changes significantly
  const handleContentChange = async (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Hide suggestion if content changes significantly
    if (newContent.length < content.length - 10 || newContent !== content) {
      setShowSuggestion(false);
      setAiSuggestion(null);
    }
  };

  // Check for AI suggestion when user clicks post button (non-blocking)
  const handlePostClick = () => {
    // Check for suggestion in the background (don't block form submission)
    // Only check if we haven't already shown a suggestion for this content
    if (content.trim().length > 3 && !isCheckingSuggestion && !showSuggestion) {
      setIsCheckingSuggestion(true);
      console.log(
        "🔍 Checking for AI suggestion for:",
        content.substring(0, 50)
      );

      // Check if content is potentially flaggable and get suggestion
      // This runs asynchronously and doesn't block form submission
      getAISuggestion(content)
        .then((suggestion) => {
          console.log("💡 AI Suggestion received:", suggestion);
          if (suggestion && suggestion.trim().length > 0) {
            setAiSuggestion(suggestion);
            setShowSuggestion(true);
            console.log("✅ Showing suggestion to user");
          } else {
            console.log(
              "⚠️ No suggestion returned (content may not be toxic enough)"
            );
          }
        })
        .catch((error) => {
          console.warn("❌ Could not get AI suggestion:", error);
        })
        .finally(() => {
          setIsCheckingSuggestion(false);
        });
    }
  };

  // Use the suggested rephrasing
  const handleUseSuggestion = () => {
    if (aiSuggestion) {
      setContent(aiSuggestion);
      setShowSuggestion(false);
      setAiSuggestion(null);
      // Auto-submit after using suggestion
      setTimeout(() => {
        const form = document.querySelector(".comment-form");
        if (form) {
          const submitEvent = new Event("submit", {
            bubbles: true,
            cancelable: true,
          });
          form.dispatchEvent(submitEvent);
        }
      }, 100);
    }
  };

  // Post the original comment anyway (ignore suggestion)
  const handlePostAnyway = async () => {
    setShowSuggestion(false);
    setAiSuggestion(null);

    // Manually trigger form submission
    if (!content.trim()) {
      showToast("Please enter a comment", "error");
      return;
    }

    if (!user) {
      showToast("Please login to comment", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const moderationResult = await moderateContentEnhanced(content);
      const commentData = {
        content: content,
        isFlagged: moderationResult.isToxic,
        toxicityScore: moderationResult.score || null,
        severity: moderationResult.severity || null,
        categories: moderationResult.categories || [],
        source: moderationResult.source || "keyword",
      };

      onAddComment(commentData);

      if (moderationResult.isToxic) {
        showToast(
          `Your comment has been flagged as inappropriate (Score: ${(
            moderationResult.score * 100
          ).toFixed(1)}%) and will not be displayed publicly.`,
          "warning"
        );
      } else {
        showToast("Comment posted successfully!", "success");
      }

      setContent("");
      setIsCheckingSuggestion(false);
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

    // If suggestion is showing and this is first click, just show suggestion
    // If they click Post again, proceed with submission
    if (showSuggestion && aiSuggestion && !isSubmitting) {
      // User clicked Post again - they want to post anyway
      // Hide suggestion and proceed
      setShowSuggestion(false);
      setAiSuggestion(null);
    }

    setIsSubmitting(true);

    try {
      console.log(
        "🔍 Starting enhanced moderation check for comment:",
        content
      );

      // Check content moderation with enhanced service
      const moderationResult = await moderateContentEnhanced(content);

      console.log("📊 Enhanced moderation result received:", {
        isToxic: moderationResult.isToxic,
        score: moderationResult.score,
        severity: moderationResult.severity,
        categories: moderationResult.categories,
        source: moderationResult.source,
      });

      // Pass enhanced moderation data to parent for database save
      const commentData = {
        content: content,
        isFlagged: moderationResult.isToxic,
        toxicityScore: moderationResult.score || null,
        severity: moderationResult.severity || null,
        categories: moderationResult.categories || [],
        source: moderationResult.source || "keyword",
      };

      console.log("💾 Saving comment with data:", commentData);

      onAddComment(commentData);

      if (moderationResult.isToxic) {
        showToast(
          `Your comment has been flagged as inappropriate (Score: ${(
            moderationResult.score * 100
          ).toFixed(1)}%) and will not be displayed publicly.`,
          "warning"
        );
      } else {
        showToast("Comment posted successfully!", "success");
      }

      // Reset form and suggestion state
      setContent("");
      setAiSuggestion(null);
      setShowSuggestion(false);
      setIsCheckingSuggestion(false);
    } catch (error) {
      console.error("Error submitting comment:", error);
      showToast("Error posting comment. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
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
      {showSuggestion && aiSuggestion && (
        <div className="ai-suggestion-box">
          <div className="suggestion-header">
            <span className="suggestion-icon">💡</span>
            <strong>Polite Alternative Suggestion:</strong>
            <button
              className="suggestion-close"
              onClick={() => setShowSuggestion(false)}
              aria-label="Close suggestion"
            >
              ×
            </button>
          </div>
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
              Post Anyway
            </button>
            <button
              type="button"
              className="dismiss-suggestion-btn"
              onClick={() => setShowSuggestion(false)}
              disabled={isSubmitting}
            >
              Dismiss
            </button>
          </div>
          <p className="suggestion-note">
            💬 Your comment may be flagged. Consider using the suggestion above,
            or post your original comment.
          </p>
        </div>
      )}

      <div className="form-actions-wrapper">
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
          onClick={handlePostClick}
        >
          {isSubmitting
            ? "Posting..."
            : showSuggestion && aiSuggestion
            ? "Post Comment Anyway"
            : "Post Comment"}
        </button>
        {isCheckingSuggestion && !showSuggestion && (
          <span className="checking-indicator">
            💭 Checking for suggestions...
          </span>
        )}
        {showSuggestion && aiSuggestion && (
          <span className="suggestion-hint">
            💡 Click "Post Comment Anyway" or use the buttons above
          </span>
        )}
      </div>
    </form>
  );
};

export default CommentForm;
