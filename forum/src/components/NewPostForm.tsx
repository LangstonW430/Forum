import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { NewPost } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useCurrentUser } from "../contexts/UserContext";

export default function NewPostForm() {
  const [form, setForm] = useState<NewPost>({ title: "", content: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useCurrentUser();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const combined = [...files, ...selected].slice(0, 5);
    setFiles(combined);

    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(combined.map((f) => URL.createObjectURL(f)));

    // Reset input so same file can be re-added after removal
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        toast.info("You must be logged in to create a post");
        return;
      }

      // Check if user has a profile
      const { error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profileError?.code === "PGRST116") {
        const username =
          user.user_metadata?.username ||
          (user.email ? user.email.split("@")[0] : "user");
        const { error: createProfileError } = await supabase
          .from("profiles")
          .insert([{ id: user.id, username }]);

        if (createProfileError) {
          toast.error(`Failed to create user profile: ${createProfileError.message}`);
          return;
        }
      } else if (profileError) {
        toast.error(`Profile error: ${profileError.message}`);
        return;
      }

      // Upload media files to Supabase Storage
      const mediaUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(path);

        mediaUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("posts").insert([
        {
          title: form.title,
          content: form.content,
          user_id: user.id,
          ...(mediaUrls.length > 0 ? { media_urls: mediaUrls } : {}),
        },
      ]);

      if (error) {
        toast.error(`Error creating post: ${error.message}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      toast.error(`Unexpected error: ${err}`);
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
      <div className="form-group">
        <label className="form-label">
          Media{" "}
          <span className="form-label-hint">(optional · up to 5 files)</span>
        </label>
        <div
          className="file-upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="file-upload-icon">+</span>
          <span className="file-upload-text">Click to add images or videos</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {previews.length > 0 && (
          <div className="media-preview-grid">
            {previews.map((src, i) => (
              <div key={i} className="media-preview-item">
                {files[i].type.startsWith("video/") ? (
                  <video src={src} className="media-preview-media" />
                ) : (
                  <img src={src} alt="" className="media-preview-media" />
                )}
                <button
                  type="button"
                  className="media-preview-remove"
                  onClick={() => removeFile(i)}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading
          ? files.length > 0
            ? "Uploading..."
            : "Creating..."
          : "Create Post"}
      </button>
    </form>
  );
}
