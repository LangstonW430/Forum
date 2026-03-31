import type { Comment } from "../types";
import CommentItem from "./CommentItem";

interface CommentListProps {
  comments: Comment[];
  onReply: () => void;
  onVoteUpdate: (
    commentId: string,
    newVoteCount: number,
    newUserVote: number | null,
  ) => void;
  onCommentUpdate?: () => void;
}

export default function CommentList({
  comments,
  onReply,
  onVoteUpdate,
  onCommentUpdate,
}: CommentListProps) {
  return (
    <div>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReply={onReply}
          onVoteUpdate={onVoteUpdate}
          onCommentUpdate={onCommentUpdate}
        />
      ))}
    </div>
  );
}
