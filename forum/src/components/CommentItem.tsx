import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Comment } from "../types";
import NewCommentForm from "./NewCommentForm";
import VoteButtons from "./VoteButtons";
import Avatar from "./Avatar";

interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
  onVoteUpdate: (
    commentId: string,
    newVoteCount: number,
    newUserVote: number | null,
  ) => void;
  onCommentUpdate?: () => void;
}

export default function CommentItem({
  comment,
  onReply,
  onVoteUpdate,
  onCommentUpdate,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user?.id || null);
    };

    getCurrentUser();
  }, []);

  const handleEditComment = () => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;

    const { error } = await supabase
      .from("comments")
      .update({
        content: editContent.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", comment.id);

    if (error) {
      console.error("Error updating comment:", error);
      alert("Failed to update comment");
    } else {
      setIsEditing(false);
      if (onCommentUpdate) onCommentUpdate();
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const handleDeleteComment = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id);

    if (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment");
    } else {
      if (onCommentUpdate) onCommentUpdate();
    }
  };

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
          {isEditing ? (
            <div className="edit-form">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="edit-content-input"
                placeholder="Comment content"
                rows={3}
              />
              <div className="edit-actions">
                <button
                  onClick={handleSaveEdit}
                  className="btn btn-primary btn-sm"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="comment-text">{comment.content}</div>
              <div className="comment-meta">
                <Avatar
                  username={comment.profiles?.username || ""}
                  avatarUrl={comment.profiles?.avatar_url}
                  size="sm"
                />
                By{" "}
                <Link
                  to={`/user/${comment.profiles?.username}`}
                  className="author-link"
                >
                  {comment.profiles?.username}
                </Link>{" "}
                on {new Date(comment.created_at).toLocaleDateString()}
                {comment.edited_at && (
                  <span className="edited-indicator">
                    {" "}
                    • Edited {new Date(comment.edited_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="comment-actions">
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="btn btn-outline btn-sm"
                >
                  {showReplyForm ? "Cancel Reply" : "Reply"}
                </button>
                {currentUser === comment.user_id && (
                  <>
                    <button
                      onClick={handleEditComment}
                      className="btn btn-outline btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteComment}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
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
