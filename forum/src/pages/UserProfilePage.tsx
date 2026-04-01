import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Post, Profile } from "../types";
import Avatar from "../components/Avatar";

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messagingLoading, setMessagingLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, username, bio, avatar_url, created_at")
        .eq("username", username)
        .single();

      if (error || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, title, content, created_at, edited_at")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);
      setLoading(false);
    };

    if (username) loadProfile();
  }, [username]);

  const handleMessage = async () => {
    if (!currentUserId || !profile) {
      navigate("/login");
      return;
    }
    setMessagingLoading(true);

    // Check for existing DM
    const { data: existingConvos } = await supabase
      .from("conversations")
      .select("id, conversation_members(user_id)")
      .eq("is_group", false);

    const existing = (existingConvos ?? []).find(
      (c: any) =>
        c.conversation_members.length === 2 &&
        c.conversation_members.some((m: any) => m.user_id === profile.id),
    );

    if (existing) {
      navigate(`/messages/${existing.id}`);
      return;
    }

    // Create new DM — generate ID client-side to avoid RLS SELECT issue
    const convoId = crypto.randomUUID();

    const { error } = await supabase
      .from("conversations")
      .insert({ id: convoId, is_group: false, created_by: currentUserId });

    if (error) {
      alert(`Failed to start conversation: ${error.message}`);
      setMessagingLoading(false);
      return;
    }

    await supabase
      .from("conversation_members")
      .insert({ conversation_id: convoId, user_id: currentUserId });

    await supabase
      .from("conversation_members")
      .insert({ conversation_id: convoId, user_id: profile.id });

    navigate(`/messages/${convoId}`);
  };

  if (loading) return <div className="loading">Loading profile...</div>;

  if (notFound) {
    return (
      <div className="empty-state">
        <h3>User not found</h3>
        <p>No user with the username "{username}" exists.</p>
        <Link to="/" className="btn btn-primary">
          Back to Forum
        </Link>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <Avatar username={profile!.username} avatarUrl={profile!.avatar_url} size="lg" />

        <div className="user-profile-info">
          <div className="user-profile-name-row">
            <h1 className="user-profile-username">{profile!.username}</h1>
            {currentUserId && currentUserId !== profile!.id && (
              <button
                className="btn btn-outline btn-sm"
                onClick={handleMessage}
                disabled={messagingLoading}
              >
                {messagingLoading ? "Opening…" : "Message"}
              </button>
            )}
          </div>
          <p className="user-profile-joined">
            Member since {new Date(profile!.created_at).toLocaleDateString()}
          </p>
          {profile!.bio ? (
            <p className="user-profile-bio">{profile!.bio}</p>
          ) : (
            <p className="user-profile-bio user-profile-bio--empty">
              This user hasn't written a bio yet.
            </p>
          )}
        </div>
      </div>

      <div className="user-profile-posts">
        <h2 className="section-title">
          Posts by {profile!.username} ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <div className="empty-state">
            <h3>No posts yet</h3>
            <p>{profile!.username} hasn't made any posts.</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="card post-card">
                <div className="post-content">
                  <h2 className="post-title">
                    <Link to={`/post/${post.id}`}>{post.title}</Link>
                  </h2>
                  <p className="post-content-text">
                    {post.content.length > 200
                      ? `${post.content.substring(0, 200)}...`
                      : post.content}
                  </p>
                  <div className="post-meta">
                    {new Date(post.created_at).toLocaleDateString()}
                    {post.edited_at && (
                      <span className="edited-indicator">
                        {" "}
                        • Edited {new Date(post.edited_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
