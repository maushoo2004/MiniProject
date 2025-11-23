import React from "react";
import {
  getCategoryDisplayName,
  getSeverityColor,
  SEVERITY_LEVELS,
  MODERATION_CATEGORIES,
} from "../services/enhancedModerationService";
import "./CommentItem.css";

// Get color for each category
const getCategoryColor = (category) => {
  const colors = {
    [MODERATION_CATEGORIES.HATE]: "#dc2626", // Red
    [MODERATION_CATEGORIES.THREAT]: "#b91c1c", // Dark red
    [MODERATION_CATEGORIES.BULLYING]: "#ea580c", // Orange
    [MODERATION_CATEGORIES.DISCRIMINATION]: "#c2410c", // Dark orange
    [MODERATION_CATEGORIES.HARASSMENT]: "#d97706", // Amber
    [MODERATION_CATEGORIES.PROFANITY]: "#f59e0b", // Yellow-orange
    [MODERATION_CATEGORIES.SPAM]: "#84cc16", // Green-yellow
    [MODERATION_CATEGORIES.SELF_HARM]: "#ef4444", // Red
    [MODERATION_CATEGORIES.SEXUAL]: "#ec4899", // Pink
    [MODERATION_CATEGORIES.VIOLENCE]: "#991b1b", // Dark red
  };
  return colors[category] || "#6b7280"; // Default gray
};

const CommentItem = ({ comment, isAuthor, isFlagged, onReportUser }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSeverityLabel = (severity) => {
    if (!severity) return null;
    const labels = {
      [SEVERITY_LEVELS.LOW]: "Low",
      [SEVERITY_LEVELS.MEDIUM]: "Medium",
      [SEVERITY_LEVELS.HIGH]: "High",
    };
    return labels[severity] || severity;
  };

  return (
    <div className={`comment-item ${isFlagged ? "flagged" : ""}`}>
      <div className="comment-header">
        <div className="comment-author-info">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-date">{formatDate(comment.date)}</span>
        </div>
        {isFlagged &&
          isAuthor &&
          comment.categories &&
          comment.categories.length > 0 && (
            <div className="category-badges-header">
              {comment.categories.map((category, index) => (
                <span
                  key={index}
                  className="category-badge-header"
                  style={{
                    backgroundColor: getCategoryColor(category),
                  }}
                >
                  {getCategoryDisplayName(category)}
                </span>
              ))}
            </div>
          )}
        {isFlagged && <span className="flagged-badge">⚠️ Flagged</span>}
      </div>

      <div className="comment-content">{comment.content}</div>

      {isAuthor && isFlagged && (
        <div className="comment-moderation-details">
          {/* Category Tags - Prominently Displayed */}
          {comment.categories && comment.categories.length > 0 && (
            <div className="moderation-categories">
              <strong>⚠️ Flagged Categories:</strong>
              <div className="category-tags">
                {comment.categories.map((category, index) => (
                  <span
                    key={index}
                    className="category-tag"
                    style={{
                      backgroundColor: getCategoryColor(category),
                    }}
                  >
                    {getCategoryDisplayName(category)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="moderation-info">
            {comment.severity && (
              <div
                className="severity-badge"
                style={{ backgroundColor: getSeverityColor(comment.severity) }}
              >
                {getSeverityLabel(comment.severity)} Severity
              </div>
            )}
            {comment.toxicityScore && (
              <span className="toxicity-score">
                Score: {(comment.toxicityScore * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="comment-actions">
            <button
              className="report-button"
              onClick={() => onReportUser(comment.userId, comment.id)}
            >
              🚨 Report User
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentItem;
