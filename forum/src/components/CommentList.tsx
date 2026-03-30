import type { Comment } from "../types";
import CommentItem from "./CommentItem";

interface CommentListProps {
  comments: Comment[];
  onReply: () => void;
}

export default function CommentList({ comments, onReply }: CommentListProps) {
  return (
    <div>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} onReply={onReply} />
      ))}
    </div>
  );
}
