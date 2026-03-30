import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Post, Comment } from "../types";
import CommentList from "./CommentList";
import NewCommentForm from "./NewCommentForm";

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPost();
      fetchComments();

      // Subscribe to real-time updates for comments
      const channel = supabase
        .channel("comments")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comments",
            filter: `post_id=eq.${id}`,
          },
          () => {
            fetchComments();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  const fetchPost = async () => {
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
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching post:", error);
    } else {
      setPost(data);
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        profiles (
          username
        )
      `,
      )
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      // Build comment tree
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      (data || []).forEach((comment: Comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      (data || []).forEach((comment: Comment) => {
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies!.push(commentMap.get(comment.id)!);
          }
        } else {
          rootComments.push(commentMap.get(comment.id)!);
        }
      });

      setComments(rootComments);
    }
    setLoading(false);
  };

  if (loading) return <div className="loading">Loading post...</div>;
  if (!post)
    return (
      <div className="empty-state">
        <h3>Post not found</h3>
      </div>
    );

  return (
    <div>
      <div className="card post-detail">
        <h1 className="post-title">{post.title}</h1>
        <p className="post-content">{post.content}</p>
        <div className="post-meta">
          By {post.profiles?.username} on{" "}
          {new Date(post.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="comments-section">
        <h2 className="section-title">Comments</h2>
        <div className="comment-form">
          <NewCommentForm postId={id!} onCommentAdded={fetchComments} />
        </div>
        <CommentList comments={comments} onReply={fetchComments} />
      </div>
    </div>
  );
}
