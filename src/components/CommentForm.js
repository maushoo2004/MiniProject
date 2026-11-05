import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import {
  getCategoryDisplayName,
  getCategoryColor,
  getSeverityColor,
  formatScore,
  getSourceLabel,
} from "../utils/moderationLabels";
import LiveMeter from "./LiveMeter";
import "./CommentForm.css";

const MAX_LENGTH = 2000;

const CommentForm = ({ postId, onCommentPosted, showToast }) => {
  const { isBlocked, userReportCount, blockThreshold, refreshProfile } = useAuth();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null); // { moderation, suggestion } when flagged
  const [supportMessage, setSupportMessage] = useState(null);

  const reset = () => {
    setContent("");
    setReview(null);
  };

  const submit = async (text, acknowledgeWarning = false) => {
    setBusy(true);
    try {
      const res = await api("/api/comments", {
        method: "POST",
        body: { postId, content: text, acknowledgeWarning },
      });

      if (res.supportMessage) setSupportMessage(res.supportMessage);

      if (res.moderation.isToxic) {
        showToast(
          res.blocked
            ? `Your comment was hidden and reported. You now have ${res.reportCount} reports and can no longer comment.`
            : `Your comment was hidden from others and your account was reported (${res.reportCount}/${blockThreshold}). Repeated violations will block commenting.`,
          "error",
          9000
        );
      } else {
        showToast("Comment posted!", "success");
      }
      reset();
      onCommentPosted?.();
    } catch (err) {
      if (err.status === 422 && err.data?.code === "needs_review") {
        setReview({ moderation: err.data.moderation, suggestion: err.data.suggestion });
      } else if (err.status === 403 && err.data?.code === "blocked") {
        showToast(err.message, "error", 6000);
        refreshProfile();
      } else {
        showToast(err.message, "error", 6000);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return showToast("Please write something first", "error");
    if (review) return;
    submit(content.trim());
  };

  const useSuggestion = () => {
    setContent(review.suggestion.text);
    setReview(null);
    showToast("Suggestion applied — review it and post when ready.", "info");
  };

  const m = review?.moderation;

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="comment-content">Your Comment</label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (review) setReview(null);
          }}
          placeholder={
            isBlocked
              ? "You are blocked from commenting due to multiple reports."
              : "Share your thoughts... (English, Hindi, Hinglish, Kannada)"
          }
          rows="4"
          maxLength={MAX_LENGTH}
          disabled={busy || isBlocked}
        />
        <div className="comment-form-meta">
          <span className="char-count">
            {content.length}/{MAX_LENGTH}
          </span>
        </div>
        <LiveMeter text={content} disabled={busy || isBlocked || Boolean(review)} />
        {isBlocked && (
          <p className="blocked-message">
            ⚠️ You can't comment because your account has been reported {userReportCount} times
            (limit: {blockThreshold}). Contact an admin if you think this is a mistake.
          </p>
        )}
      </div>

      {supportMessage && (
        <div className="support-box" role="status">
          <span>💙</span>
          <p>{supportMessage}</p>
          <button type="button" className="suggestion-close" onClick={() => setSupportMessage(null)}>
            ×
          </button>
        </div>
      )}

      {review && (
        <div className="ai-suggestion-box">
          <div className="suggestion-header">
            <span className="suggestion-icon">⚠️</span>
            <strong>ToxiFilter flagged this comment</strong>
            <button
              className="suggestion-close"
              onClick={() => setReview(null)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
          </div>

          <div className="review-details">
            <span className="severity-pill" style={{ backgroundColor: getSeverityColor(m.severity) }}>
              {m.severity} severity
            </span>
            <span className="score-pill">Toxicity {formatScore(m.score)}</span>
            {m.categories
              .filter((c) => c !== "self_harm")
              .map((c) => (
                <span key={c} className="category-pill" style={{ backgroundColor: getCategoryColor(c) }}>
                  {getCategoryDisplayName(c)}
                </span>
              ))}
          </div>
          {m.matchedTerms?.length > 0 && (
            <p className="matched-terms">
              Problem words: {m.matchedTerms.map((t) => `“${t}”`).join(", ")}
            </p>
          )}
          <p className="detected-by">Detected by: {getSourceLabel(m.source)}</p>

          {review.suggestion?.text && (
            <>
              <p className="suggestion-label">
                {review.suggestion.source === "groq" ? "✨ AI-suggested rewrite:" : "💡 Suggested rewrite:"}
              </p>
              <p className="suggestion-text">{review.suggestion.text}</p>
            </>
          )}

          <div className="suggestion-actions">
            {review.suggestion?.text && (
              <button type="button" className="use-suggestion-btn" onClick={useSuggestion} disabled={busy}>
                Use This Suggestion
              </button>
            )}
            <button type="button" className="dismiss-suggestion-btn" onClick={() => setReview(null)} disabled={busy}>
              Edit My Comment
            </button>
            <button
              type="button"
              className="post-anyway-btn"
              onClick={() => submit(content.trim(), true)}
              disabled={busy}
            >
              Post Original Anyway
            </button>
          </div>
          <p className="suggestion-note">
            ⚠️ If you post the original, it will be <strong>hidden from other readers</strong> and your
            account will be <strong>automatically reported</strong> ({userReportCount}/{blockThreshold} so
            far). At {blockThreshold} reports you can no longer comment.
          </p>
        </div>
      )}

      <div className="form-actions-wrapper">
        <button type="submit" className="submit-button" disabled={busy || isBlocked || Boolean(review)}>
          {busy ? "Checking..." : "Post Comment"}
        </button>
        {busy && <span className="checking-indicator">🛡️ ToxiFilter is checking your comment...</span>}
      </div>
    </form>
  );
};

export default CommentForm;
