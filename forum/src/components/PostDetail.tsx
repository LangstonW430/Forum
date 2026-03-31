import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Post, Comment } from "../types";
import CommentList from "./CommentList";
import NewCommentForm from "./NewCommentForm";
import VoteButtons from "./VoteButtons";

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const handlePostVote = (newVoteCount: number, newUserVote: number | null) => {
    if (post) {
      setPost({
        ...post,
        vote_count: newVoteCount,
        user_vote: newUserVote,
      });
    }
  };

  const handleCommentVote = (commentId: string, newVoteCount: number, newUserVote: number | null) => {
    const updateCommentVotes = (comments: Comment[]): Comment[] => {
      return comments.map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            vote_count: newVoteCount,
            user_vote: newUserVote,
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: updateCommentVotes(comment.replies),
          };
        }
        return comment;
      });
    };

    setComments(updateCommentVotes);
  };

  useEffect(() => {
    if (id) {
      fetchPost();
      fetchComments();

      // Subscribe to real-time updates for comments and votes
      const commentsChannel = supabase
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

      const commentVotesChannel = supabase
        .channel("comment_votes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comment_votes",
          },
          () => {
            fetchComments();
          },
        )
        .subscribe();

      const postVotesChannel = supabase
        .channel("post_votes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "post_votes",
          },
          () => {
            fetchPost();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(commentsChannel);
        supabase.removeChannel(commentVotesChannel);
        supabase.removeChannel(postVotesChannel);
      };
    }
  }, [id]);

  const fetchPost = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching post:", error);
    } else {
      // Calculate vote count and user vote
      const votes = data.post_votes || [];
      const voteCount = votes.reduce((sum: number, vote: any) => sum + vote.vote_type, 0);
      const userVote = user
        ? votes.find((vote: any) => vote.user_id === user.id)?.vote_type || null
        : null;

      setPost({
        ...data,
        vote_count: voteCount,
        user_vote: userVote,
      });
    }
  };

  const fetchComments = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        profiles (
          username
        ),
        comment_votes (
          vote_type,
          user_id
        )
      `,
      )
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      // Calculate vote counts and user votes for each comment
      const commentsWithVotes = (data || []).map((comment) => {
        const votes = comment.comment_votes || [];
        const voteCount = votes.reduce((sum: number, vote: any) => sum + vote.vote_type, 0);
        const userVote = user
          ? votes.find((vote: any) => vote.user_id === user.id)?.vote_type || null
          : null;

        return {
          ...comment,
          vote_count: voteCount,
          user_vote: userVote,
        };
      });

      // Build comment tree
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      commentsWithVotes.forEach((comment: Comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      commentsWithVotes.forEach((comment: Comment) => {
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
        <div className="post-content-wrapper">
          <VoteButtons
            itemId={post.id}
            itemType="post"
            voteCount={post.vote_count || 0}
            userVote={post.user_vote || null}
            onVoteUpdate={handlePostVote}
          />
          <div className="post-content">
            <h1 className="post-title">{post.title}</h1>
            <p className="post-content">{post.content}</p>
            <div className="post-meta">
              By {post.profiles?.username} on{" "}
              {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="comments-section">
        <h2 className="section-title">Comments</h2>
        <div className="comment-form">
          <NewCommentForm postId={id!} onCommentAdded={fetchComments} />
        </div>
        <CommentList
          comments={comments}
          onReply={fetchComments}
          onVoteUpdate={handleCommentVote}
        />
      </div>
    </div>
  );
}
