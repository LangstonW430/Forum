import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../contexts/UserContext";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import SearchBar from "./SearchBar";

export default function Navbar() {
  const { user } = useCurrentUser();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
    setAvatarUrl(data?.avatar_url ?? null);
  };

  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
    } else {
      setUsername(null);
      setAvatarUrl(null);
    }
  }, [user]);

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
