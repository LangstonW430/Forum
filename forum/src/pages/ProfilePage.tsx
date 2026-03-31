import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, bio")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUsername(profile.username || "");
          setBio(profile.bio || "");
        }
      }
      setLoading(false);
    };

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (username.length < 3) {
      setMessage({
        type: "error",
        text: "Username must be at least 3 characters long",
      });
      setSaving(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setMessage({
        type: "error",
        text: "Username can only contain letters, numbers, and underscores",
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username, bio })
      .eq("id", user!.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Profile updated successfully!" });
    }
    setSaving(false);
  };

  if (loading) return <div className="loading">Loading profile...</div>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1 className="page-title">Your Profile</h1>
        <p className="page-subtitle">Manage your username and bio</p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {username ? username[0].toUpperCase() : "?"}
        </div>

        {message && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        <form onSubmit={handleSave} className="profile-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-input"
              placeholder="Your username"
            />
            <p className="form-hint">
              Displayed on your posts and comments instead of your email.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="form-input form-textarea"
              placeholder="Tell the community a bit about yourself..."
              rows={4}
              maxLength={500}
            />
            <p className="form-hint">{bio.length}/500 characters</p>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="form-input profile-email-input"
            />
            <p className="form-hint">Email cannot be changed.</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary profile-save-btn"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
