import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { NewComment } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useCurrentUser } from "../contexts/UserContext";
import { validateComment } from "../utils/validators";
import { checkCommentRateLimit } from "../utils/rateLimiter";

interface NewCommentFormProps {
  postId: string;
  parentCommentId?: string;
  onCommentAdded: () => void;
}

export default function NewCommentForm({
  postId,
  parentCommentId,
  onCommentAdded,
}: NewCommentFormProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { userId } = useCurrentUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.info("You must be logged in to comment");
      return;
    }

    const commentError = validateComment(content);
    if (commentError) {
      toast.error(commentError);
      return;
    }

    const rateLimitError = await checkCommentRateLimit(userId);
    if (rateLimitError) {
      toast.error(rateLimitError);
      return;
    }

    setLoading(true);

    const comment: NewComment = {
      content,
      post_id: postId,
      parent_comment_id: parentCommentId,
    };

    const { error } = await supabase
      .from("comments")
      .insert([{ ...comment, user_id: userId }]);

    if (error) {
      console.error("Error creating comment:", error);
      toast.error("Error creating comment");
    } else {
      setContent("");
      onCommentAdded();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        required
        rows={3}
        className="form-input"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary btn-sm"
      >
        {loading ? "Posting..." : "Post Comment"}
      </button>
    </form>
  );
}
