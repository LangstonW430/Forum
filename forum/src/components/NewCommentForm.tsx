import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { NewComment } from "../types";
import { useToast } from "../contexts/ToastContext";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.info("You must be logged in to comment");
      setLoading(false);
      return;
    }

    const comment: NewComment = {
      content,
      post_id: postId,
      parent_comment_id: parentCommentId,
    };

    const { error } = await supabase
      .from("comments")
      .insert([{ ...comment, user_id: user.id }]);

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
