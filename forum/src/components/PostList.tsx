import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import VoteButtons from "./VoteButtons";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";
import type { Post } from "../types";

type SortOrder = "newest" | "oldest" | "popular" | "trending";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "popular", label: "Popular" },
  { value: "trending", label: "Trending" },
];

function hotScore(post: Post): number {
  const votes = post.vote_count ?? 0;
  const hoursAgo =
    (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
  return votes / Math.pow(hoursAgo + 2, 1.5);
}

function sortPosts(posts: Post[], order: SortOrder): Post[] {
  return [...posts].sort((a, b) => {
    if (order === "newest")
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (order === "oldest")
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (order === "popular")
      return (b.vote_count ?? 0) - (a.vote_count ?? 0);
    // trending
    return hotScore(b) - hotScore(a);
  });
}

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const toast = useToast();

  // Test Supabase connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("Testing Supabase connection...");
        const { error } = await supabase.from("posts").select("count").limit(1);
        if (error) {
          console.error("Supabase connection error:", error);
          toast.error("Database connection issue. Please check your Supabase setup.");
        } else {
          console.log("Supabase connection successful");
        }
      } catch (err) {
        console.error("Connection test failed:", err);
      }
    };

    testConnection();
  }, []);

  const handlePostVote = (
    postId: string,
    newVoteCount: number,
    newUserVote: number | null,
  ) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? { ...post, vote_count: newVoteCount, user_vote: newUserVote }
          : post,
      ),
    );
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time updates for posts and votes
    const postsChannel = supabase
      .channel("posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts();
        },
      )
      .subscribe();

    const votesChannel = supabase
      .channel("post_votes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_votes" },
        () => {
          fetchPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, []);

  const fetchPosts = async () => {
    console.log("Fetching posts...");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("Current user:", user);

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        profiles (
          username,
          avatar_url
        ),
        post_votes (
          vote_type,
          user_id
        ),
        comments (count)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      toast.error(`Error fetching posts: ${error.message}`);
    } else {
      console.log("Posts fetched successfully:", data);
      // Calculate vote counts and user votes for each post
      const postsWithVotes = (data || []).map((post) => {
        const votes = post.post_votes || [];
        const voteCount = votes.reduce(
          (sum: number, vote: any) => sum + vote.vote_type,
          0,
        );
        const userVote = user
          ? votes.find((vote: any) => vote.user_id === user.id)?.vote_type ||
            null
          : null;

        const commentCount = (post.comments as { count: number }[])?.[0]?.count ?? 0;

        return {
          ...post,
          vote_count: voteCount,
          user_vote: userVote,
          comment_count: commentCount,
        };
      });

      console.log("Posts with votes:", postsWithVotes);
      setPosts(postsWithVotes);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading">Loading posts...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Exbo</h1>
        <p className="page-subtitle">
          Join the discussion and share your thoughts
        </p>
        <Link to="/new-post" className="btn btn-primary">
          Create New Post
        </Link>
      </div>

      <div className="sort-tabs">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`sort-tab${sortOrder === opt.value ? " sort-tab--active" : ""}`}
            onClick={() => setSortOrder(opt.value)}
          >
            {opt.label}
          </button>
        ))}
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
          {sortPosts(posts, sortOrder).map((post) => (
            <div key={post.id} className="card post-card">
              <div className="post-content-wrapper">
                <VoteButtons
                  itemId={post.id}
                  itemType="post"
                  voteCount={post.vote_count || 0}
                  userVote={post.user_vote || null}
                  onVoteUpdate={(newVoteCount, newUserVote) =>
                    handlePostVote(post.id, newVoteCount, newUserVote)
                  }
                />
                <div className="post-content">
                  <h2 className="post-title">
                    <Link to={`/post/${post.id}`}>{post.title}</Link>
                  </h2>
                  <p className="post-content-text">
                    {post.content.length > 200
                      ? `${post.content.substring(0, 200)}...`
                      : post.content}
                  </p>
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="post-list-thumbnails">
                      {post.media_urls.slice(0, 3).map((url, i) =>
                        /\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url) ? (
                          <div key={i} className="post-list-thumb post-list-thumb-video">
                            ▶
                          </div>
                        ) : (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="post-list-thumb"
                            style={{ cursor: "zoom-in" }}
                            onClick={(e) => { e.preventDefault(); setLightboxSrc(url); }}
                          />
                        )
                      )}
                      {post.media_urls.length > 3 && (
                        <div className="post-list-thumb post-list-thumb-more">
                          +{post.media_urls.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="post-meta">
                    <Avatar
                      username={post.profiles?.username || ""}
                      avatarUrl={post.profiles?.avatar_url}
                      size="sm"
                    />
                    By{" "}
                    <Link
                      to={`/user/${post.profiles?.username}`}
                      className="author-link"
                    >
                      {post.profiles?.username}
                    </Link>{" "}
                    on {new Date(post.created_at).toLocaleDateString()}
                    {post.edited_at && (
                      <span className="edited-indicator">
                        {" "}
                        • Edited {new Date(post.edited_at).toLocaleDateString()}
                      </span>
                    )}
                    <Link to={`/post/${post.id}`} className="post-comment-count">
                      •{" "}
                      {post.comment_count ?? 0}{" "}
                      {post.comment_count === 1 ? "comment" : "comments"}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
