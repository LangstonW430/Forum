import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Post } from "../types";

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time updates for posts
    const channel = supabase
      .channel("posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        profiles (
          username
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading">Loading posts...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Forum Posts</h1>
        <p className="page-subtitle">
          Join the discussion and share your thoughts
        </p>
        <Link to="/new-post" className="btn btn-primary">
          Create New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
          <p>Be the first to start a discussion!</p>
          <Link to="/new-post" className="btn btn-primary">
            Create First Post
          </Link>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map((post) => (
            <div key={post.id} className="card post-card">
              <h2 className="post-title">
                <Link to={`/post/${post.id}`}>{post.title}</Link>
              </h2>
              <p className="post-content">
                {post.content.length > 200
                  ? `${post.content.substring(0, 200)}...`
                  : post.content}
              </p>
              <div className="post-meta">
                By {post.profiles?.username} on{" "}
                {new Date(post.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
