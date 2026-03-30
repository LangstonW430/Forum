import { useState } from "react";
import type { Comment } from "../types";
import NewCommentForm from "./NewCommentForm";

interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
}

export default function CommentItem({ comment, onReply }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div
      className={`comment ${comment.parent_comment_id ? "comment-reply" : ""}`}
    >
      <div className="comment-content">{comment.content}</div>
      <div className="comment-meta">
        By {comment.profiles?.username} on{" "}
        {new Date(comment.created_at).toLocaleDateString()}
      </div>
      <div className="comment-actions">
        <button
          onClick={() => setShowReplyForm(!showReplyForm)}
          className="btn btn-outline btn-sm"
        >
          {showReplyForm ? "Cancel Reply" : "Reply"}
        </button>
      </div>
      {showReplyForm && (
        <div className="comment-reply-form">
          <NewCommentForm
            postId={comment.post_id}
            parentCommentId={comment.id}
            onCommentAdded={() => {
              setShowReplyForm(false);
              onReply();
            }}
          />
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}
