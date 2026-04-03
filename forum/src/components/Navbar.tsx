import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "../contexts/UserContext";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import SearchBar from "./SearchBar";

export default function Navbar() {
  const { user } = useCurrentUser();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
    setAvatarUrl(data?.avatar_url ?? null);
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (userId) {
      fetchProfile(userId);
    } else {
      setUsername(null);
      setAvatarUrl(null);
    }
  }, [userId, fetchProfile]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    };

    fetchUnread();

    const channel = supabase
      .channel(`navbar-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        fetchUnread,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          Exbo
        </Link>

        <SearchBar />

        {/* Desktop links */}
        <div className="navbar-links navbar-links--desktop">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/new-post" className="btn btn-primary btn-sm">
                New Post
              </Link>
              <Link to="/messages" className="btn btn-outline btn-sm">
                Messages
              </Link>
              <Link to="/notifications" className="navbar-notifications-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="navbar-notifications-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/profile" className="navbar-user">
                <Avatar username={username || ""} avatarUrl={avatarUrl} size="sm" />
                {username || user.email}
              </Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile right side: theme toggle + hamburger */}
        <div className="navbar-mobile-right">
          <ThemeToggle />
          <button
            className="navbar-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="navbar-mobile-menu">
          <div className="navbar-mobile-search">
            <SearchBar />
          </div>
          {user ? (
            <>
              <Link to="/profile" className="navbar-mobile-item navbar-user" onClick={closeMenu}>
                <Avatar username={username || ""} avatarUrl={avatarUrl} size="sm" />
                {username || user.email}
              </Link>
              <Link to="/new-post" className="navbar-mobile-item" onClick={closeMenu}>
                New Post
              </Link>
              <Link to="/messages" className="navbar-mobile-item" onClick={closeMenu}>
                Messages
              </Link>
              <Link to="/notifications" className="navbar-mobile-item" onClick={closeMenu}>
                Notifications
                {unreadCount > 0 && (
                  <span className="navbar-notifications-badge navbar-notifications-badge--inline">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <button className="navbar-mobile-item navbar-mobile-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-mobile-item" onClick={closeMenu}>
                Login
              </Link>
              <Link to="/register" className="navbar-mobile-item" onClick={closeMenu}>
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
