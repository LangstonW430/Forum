import { useState } from "react";
import type { Comment } from "../types";
import NewCommentForm from "./NewCommentForm";
import VoteButtons from "./VoteButtons";

interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
  onVoteUpdate: (commentId: string, newVoteCount: number, newUserVote: number | null) => void;
}

export default function CommentItem({ comment, onReply, onVoteUpdate }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div
      className={`comment ${comment.parent_comment_id ? "comment-reply" : ""}`}
    >
      <div className="comment-content-wrapper">
        <VoteButtons
          itemId={comment.id}
          itemType="comment"
          voteCount={comment.vote_count || 0}
          userVote={comment.user_vote || null}
          onVoteUpdate={(newVoteCount, newUserVote) =>
            onVoteUpdate(comment.id, newVoteCount, newUserVote)
          }
        />
        <div className="comment-content">
          <div className="comment-text">{comment.content}</div>
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
        </div>
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
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onVoteUpdate={onVoteUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
