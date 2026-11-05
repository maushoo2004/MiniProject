import React from "react";
import { getCategoryDisplayName, getCategoryColor } from "../utils/moderationLabels";
import "./CommentItem.css";

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const CommentItem = ({ comment, canReport, canDelete, onReportUser, onDelete }) => {
  const { isFlagged } = comment;

  return (
    <div className={`comment-item ${isFlagged ? "flagged" : ""}`}>
      <div className="comment-header">
        <div className="comment-author-info">
          <span className="comment-author">
            {comment.author}
            {comment.isOwn && <span className="you-tag">you</span>}
          </span>
          <span className="comment-date">{formatDate(comment.date)}</span>
        </div>
        {isFlagged && <span className="flagged-badge">⚠️ Hidden from others</span>}
      </div>

      <div className="comment-content">{comment.content}</div>

      {isFlagged && comment.isOwn && (
        <div className="comment-moderation-details">
          <p className="own-flag-note">
            ToxiFilter flagged this comment, so only you and the post author can see it.
          </p>
          {comment.categories.length > 0 && (
            <div className="category-tags">
              {comment.categories.map((category) => (
                <span
                  key={category}
                  className="category-tag"
                  style={{ backgroundColor: getCategoryColor(category) }}
                >
                  {getCategoryDisplayName(category)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(canReport || canDelete) && (
        <div className="comment-actions">
          {canReport &&
            (comment.isReported ? (
              <span className="reported-tag">✔ Reported</span>
            ) : (
              <button className="report-button" onClick={() => onReportUser(comment.id)}>
                🚨 Report
              </button>
            ))}
          {canDelete && (
            <button className="delete-comment-button" onClick={() => onDelete(comment.id)}>
              🗑️ Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
