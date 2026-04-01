import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";

interface ProfileResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface PostResult {
  id: string;
  title: string;
  content: string;
  profiles: { username: string } | null;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setProfiles([]);
      setPosts([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const [{ data: profileData }, { data: postData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `%${q}%`)
          .limit(4),
        supabase
          .from("posts")
          .select("id, title, content, profiles(username)")
          .ilike("title", `%${q}%`)
          .limit(5),
      ]);
      setProfiles(profileData ?? []);
      setPosts(postData as PostResult[] ?? []);
      setOpen(true);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (path: string) => {
    setQuery("");
    setOpen(false);
    navigate(path);
  };

  const hasResults = profiles.length > 0 || posts.length > 0;

  return (
    <div className="search-bar" ref={containerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">⌕</span>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search posts & users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          autoComplete="off"
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(""); setOpen(false); }} aria-label="Clear">
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="search-dropdown">
          {loading && <div className="search-status">Searching…</div>}

          {!loading && !hasResults && (
            <div className="search-status">No results for "{query.trim()}"</div>
          )}

          {profiles.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">People</div>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className="search-result"
                  onClick={() => handleSelect(`/user/${p.username}`)}
                >
                  <Avatar username={p.username} avatarUrl={p.avatar_url} size="sm" />
                  <span className="search-result-title">{p.username}</span>
                </button>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">Posts</div>
              {posts.map((p) => (
                <button
                  key={p.id}
                  className="search-result"
                  onClick={() => handleSelect(`/post/${p.id}`)}
                >
                  <span className="search-result-post-icon">📄</span>
                  <div className="search-result-body">
                    <span className="search-result-title">{p.title}</span>
                    <span className="search-result-sub">
                      by {p.profiles?.username ?? "Unknown"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
