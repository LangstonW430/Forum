import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../contexts/UserContext";
import Avatar from "../components/Avatar";
import type { Notification } from "../types";

export default function NotificationsPage() {
  const { userId, loading: authLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);

  // Track in-flight mark-as-read calls so rapid clicks on different
  // notifications don't fire duplicate DB requests for the same ID.
  const processingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      navigate("/login");
      return;
    }
    loadNotifications(userId);
  }, [userId, authLoading]);

  // Fetch only unread notifications — read ones are already "done" and
  // don't belong in the feed.
  const loadNotifications = async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select(
        `id, type, read, created_at, actor_id, post_id, comment_id, conversation_id,
         actor:profiles!actor_id(username, avatar_url),
         post:posts(id, title)`,
      )
      .eq("user_id", uid)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data as unknown as Notification[]) ?? []);
    setLoading(false);
  };

  // Clicking a notification:
  //   1. Immediately remove it from local state (optimistic — zero lag).
  //   2. Mark it as read in the DB in the background.
  //   3. Navigate to the relevant content.
  // The processingIds ref prevents a second DB call if the user somehow
  // triggers the handler twice before React re-renders.
  const handleClick = (n: Notification) => {
    if (processingIds.current.has(n.id)) return;
    processingIds.current.add(n.id);

    // Optimistic update — remove immediately
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));

    // Background DB write — doesn't block navigation
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", n.id)
      .then(() => {
        processingIds.current.delete(n.id);
      });

    navigate(getLink(n));
  };

  // Clear All:
  //   - We DELETE rather than mark-as-read because deleting keeps the table
  //     lean and is semantically correct ("I'm dismissing all of these").
  //     Marking as read would preserve history but accumulate rows forever.
  //   - Optimistic clear happens first so the UI empties instantly.
  const handleClearAll = async () => {
    if (clearingAll || !userId) return;
    setClearingAll(true);

    // Optimistic update — clear feed immediately
    setNotifications([]);

    await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("read", false);

    setClearingAll(false);
  };

  const getLink = (n: Notification): string => {
    if (n.type === "message" && n.conversation_id)
      return `/messages/${n.conversation_id}`;
    if (n.post_id) return `/post/${n.post_id}`;
    return "/";
  };

  const getText = (n: Notification): string => {
    const name = n.actor?.username ?? "Someone";
    const postTitle = n.post?.title ? ` "${n.post.title}"` : "";
    if (n.type === "comment") return `${name} commented on your post${postTitle}`;
    if (n.type === "reply")   return `${name} replied to your comment${postTitle}`;
    if (n.type === "message") return `${name} sent you a message`;
    return "New notification";
  };

  const formatTime = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000)        return "just now";
    if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  if (loading) return <div className="loading">Loading notifications...</div>;

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1 className="page-title">Notifications</h1>
        {notifications.length > 0 && (
          <button
            className="btn btn-outline btn-sm notifications-clear-btn"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? "Clearing…" : "Clear All"}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <h3>You're all caught up</h3>
          <p>New comments, replies, and messages will appear here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => (
            // Use a div + onClick instead of Link so we can intercept
            // the click, update state/DB, then navigate imperatively.
            <div
              key={n.id}
              role="link"
              tabIndex={0}
              className="notification-item notification-item--unread"
              onClick={() => handleClick(n)}
              onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
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
              <span className="notification-dot" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
