import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../contexts/UserContext";
import Avatar from "../components/Avatar";
import type { Notification } from "../types";

export default function NotificationsPage() {
  const { userId, loading: authLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      navigate("/login");
      return;
    }
    loadAndMarkRead(userId);
  }, [userId, authLoading]);

  const loadAndMarkRead = async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select(
        `id, type, read, created_at, actor_id, post_id, comment_id, conversation_id,
         actor:profiles!actor_id(username, avatar_url),
         post:posts(id, title)`,
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data as unknown as Notification[]) || []);
    setLoading(false);

    // Mark all unread as read
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", uid)
      .eq("read", false);
  };

  const getLink = (n: Notification) => {
    if (n.type === "message" && n.conversation_id)
      return `/messages/${n.conversation_id}`;
    if (n.post_id) return `/post/${n.post_id}`;
    return "/";
  };

  const getText = (n: Notification) => {
    const name = n.actor?.username ?? "Someone";
    const postTitle = n.post?.title ? ` "${n.post.title}"` : "";
    if (n.type === "comment") return `${name} commented on your post${postTitle}`;
    if (n.type === "reply") return `${name} replied to your comment${postTitle}`;
    if (n.type === "message") return `${name} sent you a message`;
    return "New notification";
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  if (loading) return <div className="loading">Loading notifications...</div>;

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1 className="page-title">Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <h3>No notifications yet</h3>
          <p>You'll see activity on your posts and comments here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => (
            <Link
              key={n.id}
              to={getLink(n)}
              className={`notification-item${n.read ? "" : " notification-item--unread"}`}
            >
              <Avatar
                username={n.actor?.username ?? "?"}
                avatarUrl={n.actor?.avatar_url ?? null}
                size="sm"
              />
              <div className="notification-body">
                <p className="notification-text">{getText(n)}</p>
                <span className="notification-time">{formatTime(n.created_at)}</span>
              </div>
              {!n.read && <span className="notification-dot" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
