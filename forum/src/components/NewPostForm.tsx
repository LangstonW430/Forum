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

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Auth error:", userError);
        alert(`Authentication error: ${userError.message}`);
        setLoading(false);
        return;
      }

      if (!user) {
        alert("You must be logged in to create a post");
        setLoading(false);
        return;
      }

      console.log("Creating post for user:", user.id);

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Profile check error:", profileError);
        if (profileError.code === "PGRST116") {
          // Profile doesn't exist, try to create it
          console.log("Profile not found, creating one...");
          const username =
            user.user_metadata?.username ||
            (user.email ? user.email.split("@")[0] : "user");
          const { error: createProfileError } = await supabase
            .from("profiles")
            .insert([{ id: user.id, username }]);

          if (createProfileError) {
            console.error("Error creating profile:", createProfileError);
            alert(
              `Failed to create user profile: ${createProfileError.message}`,
            );
            setLoading(false);
            return;
          }
        } else {
          alert(`Profile error: ${profileError.message}`);
          setLoading(false);
          return;
        }
      }

      console.log("Profile found:", profile);

      const { error } = await supabase
        .from("posts")
        .insert([{ ...form, user_id: user.id }]);

      if (error) {
        console.error("Error creating post:", error);
        alert(
          `Error creating post: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`,
        );
      } else {
        console.log("Post created successfully");
        navigate("/");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert(`Unexpected error: ${err}`);
    } finally {
      setLoading(false);
    }
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
