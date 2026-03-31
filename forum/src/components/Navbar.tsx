import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import type { User, AuthChangeEvent } from "@supabase/supabase-js";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) fetchProfile(user.id);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setUsername(null);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Exbo
        </Link>
        <div className="navbar-links">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/new-post" className="btn btn-primary btn-sm">
                New Post
              </Link>
              <Link to="/profile" className="navbar-user">
                <Avatar username={username || ""} avatarUrl={avatarUrl} size="sm" />
                {username || user.email}
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
              >
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
      </div>
    </nav>
  );
}
