import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../contexts/UserContext";
import Avatar from "../components/Avatar";
import AvatarCropModal from "../components/AvatarCropModal";
import { getCroppedBlob } from "../utils/cropImage";
import type { Area } from "react-easy-crop";

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [value, setValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, bio, avatar_url, value")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUsername(profile.username || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || null);
        setValue(profile.value ?? 0);
      }
      setLoading(false);
    };

    loadProfile();
  }, [user]);

  // When user picks a file, open the crop modal instead of uploading directly
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    e.target.value = "";
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropSave = async (croppedAreaPixels: Area) => {
    if (!cropSrc || !user) return;
    setAvatarUploading(true);
    setMessage(null);

    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        setMessage({ type: "error", text: `Upload failed: ${uploadError.message}` });
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      // Cache-bust so the updated image loads immediately
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        setMessage({ type: "error", text: `Failed to save avatar: ${updateError.message}` });
      } else {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
        setAvatarUrl(publicUrl);
        setMessage({ type: "success", text: "Profile picture updated!" });
      }
    } finally {
      setAvatarUploading(false);
    }
  };

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
    <>
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
          saving={avatarUploading}
        />
      )}

      <div className="profile-container">
        <div className="profile-header">
          <h1 className="page-title">Your Profile</h1>
          <p className="page-subtitle">Manage your username and bio</p>
        </div>

        <div className="profile-card">
          <div
            className="profile-avatar-wrapper"
            onClick={() => avatarInputRef.current?.click()}
            title="Click to change profile picture"
          >
            <Avatar username={username} avatarUrl={avatarUrl} size="lg" />
            <div className="profile-avatar-overlay">Change</div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />

          <div className="profile-value-display">
            <span className="profile-value-label">Your Value</span>
            <span className="profile-value-score">{value}</span>
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
    </>
  );
}
