import React from "react";
import CommentItem from "./CommentItem";
import "./CommentList.css";

const CommentList = ({ comments, isAuthor, onReportUser }) => {
  // For authors: show all comments EXCEPT reported flagged ones (they're already handled)
  // For public: only show non-flagged, non-reported comments
  const visibleComments = isAuthor
    ? comments.filter((comment) => {
        // Authors see all comments, but don't show flagged comments that are already reported
        // (reported comments are handled separately)
        if (comment.isFlagged && comment.isReported) {
          return false; // Don't show reported flagged comments in the list
        }
        return true;
      })
    : comments.filter((comment) => !comment.isFlagged && !comment.isReported);

  return (
    <div className="comment-list">
      {visibleComments.length === 0 ? (
        <div className="no-comments">
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        visibleComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            isAuthor={isAuthor}
            isFlagged={comment.isFlagged}
            onReportUser={onReportUser}
          />
        ))
      )}
    </div>
  );
};

export default CommentList;
