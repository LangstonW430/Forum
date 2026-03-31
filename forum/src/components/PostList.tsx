import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VoteButtons from "./VoteButtons";
import type { Post } from "../types";

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Test Supabase connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("Testing Supabase connection...");
        const { error } = await supabase.from("posts").select("count").limit(1);
        if (error) {
          console.error("Supabase connection error:", error);
          alert("Database connection issue. Please check your Supabase setup.");
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
          username
        ),
        post_votes (
          vote_type,
          user_id
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      alert(`Error fetching posts: ${error.message}`);
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

        return {
          ...post,
          vote_count: voteCount,
          user_vote: userVote,
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
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
