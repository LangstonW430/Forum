import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { NewPost } from "../types";

export default function NewPostForm() {
  const [form, setForm] = useState<NewPost>({ title: "", content: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to create a post");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("posts")
      .insert([{ ...form, user_id: user.id }]);

    if (error) {
      console.error("Error creating post:", error);
      alert("Error creating post");
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1 className="page-title">Create New Post</h1>
      <div className="form-group">
        <label className="form-label">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="form-input"
          placeholder="Enter your post title"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Content</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
          rows={10}
          className="form-input form-textarea"
          placeholder="Write your post content here..."
        />
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Creating..." : "Create Post"}
      </button>
    </form>
  );
}
