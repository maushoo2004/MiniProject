import React from "react";
import CommentItem from "./CommentItem";
import EmptyState from "./EmptyState";
import "./CommentList.css";

const CommentList = ({ comments, isAuthor, canModerate, onReportUser, onDelete }) => {
  // Readers don't see comments they've already reported
  const visible = comments.filter((c) => isAuthor || !c.isReported);

  return (
    <div className="comment-list">
      {visible.length === 0 ? (
        <EmptyState compact icon="💬" title="No comments yet">
          Be the first to share your thoughts. Comments are checked by ToxiFilter before they are saved.
        </EmptyState>
      ) : (
        visible.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canReport={canModerate && !comment.isOwn}
            canDelete={comment.isOwn || canModerate}
            onReportUser={onReportUser}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

export default CommentList;
