import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useCurrentUser } from "../contexts/UserContext";
import type { Post, Comment, VoteRecord } from "../types";
import CommentList from "./CommentList";
import NewCommentForm from "./NewCommentForm";
import VoteButtons from "./VoteButtons";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";

type SortOrder = "newest" | "oldest" | "top" | "bottom";

function sortCommentTree(comments: Comment[], order: SortOrder): Comment[] {
  const sorted = [...comments].sort((a, b) => {
    if (order === "newest")
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (order === "oldest")
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (order === "top")
      return (b.vote_count ?? 0) - (a.vote_count ?? 0);
    // bottom
    return (a.vote_count ?? 0) - (b.vote_count ?? 0);
  });
  return sorted.map((c) => ({
    ...c,
    replies: c.replies ? sortCommentTree(c.replies, order) : [],
  }));
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMediaUrls, setEditMediaUrls] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const toast = useToast();
  const { userId } = useCurrentUser();
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const handlePostVote = (newVoteCount: number, newUserVote: number | null) => {
    if (post) {
      setPost({
        ...post,
        vote_count: newVoteCount,
        user_vote: newUserVote,
      });
    }
  };

  const handleCommentVote = (
    commentId: string,
    newVoteCount: number,
    newUserVote: number | null,
  ) => {
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

  const handleEditPost = () => {
    if (post) {
      setEditTitle(post.title);
      setEditContent(post.content);
      setEditMediaUrls(post.media_urls ?? []);
      setEditNewFiles([]);
      setEditNewPreviews([]);
      setIsEditing(true);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const combined = [...editNewFiles, ...selected].slice(
      0,
      Math.max(0, 5 - editMediaUrls.length),
    );
    editNewPreviews.forEach((p) => URL.revokeObjectURL(p));
    setEditNewFiles(combined);
    setEditNewPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const handleSaveEdit = async () => {
    if (!post || !editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);

    try {
      // Upload any new files
      const uploadedUrls: string[] = [];
      for (const file of editNewFiles) {
        const ext = file.name.split(".").pop();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) {
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          return;
        }
        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      const finalMediaUrls = [...editMediaUrls, ...uploadedUrls];

      const { error } = await supabase
        .from("posts")
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          media_urls: finalMediaUrls.length > 0 ? finalMediaUrls : null,
          edited_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (error) {
        toast.error(`Failed to update post: ${error.message}`);
      } else {
        editNewPreviews.forEach((p) => URL.revokeObjectURL(p));
        setPost({
          ...post,
          title: editTitle.trim(),
          content: editContent.trim(),
          media_urls: finalMediaUrls.length > 0 ? finalMediaUrls : null,
          edited_at: new Date().toISOString(),
        });
        setIsEditing(false);
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    editNewPreviews.forEach((p) => URL.revokeObjectURL(p));
    setIsEditing(false);
    setEditTitle("");
    setEditContent("");
    setEditMediaUrls([]);
    setEditNewFiles([]);
    setEditNewPreviews([]);
  };

  const handleDeletePost = async () => {
    if (!post || !confirm("Are you sure you want to delete this post?")) return;

    const { error } = await supabase.from("posts").delete().eq("id", post.id);

    if (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } else {
      navigate("/");
    }
  };

  const fetchPost = async () => {
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
      const voteCount = votes.reduce(
        (sum: number, vote: VoteRecord) => sum + vote.vote_type,
        0,
      );
      const userVote = userIdRef.current
        ? votes.find((vote: VoteRecord) => vote.user_id === userIdRef.current)?.vote_type || null
        : null;

      if (mountedRef.current) {
        setPost({
          ...data,
          vote_count: voteCount,
          user_vote: userVote,
        });
      }
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        profiles (
          username,
          avatar_url
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
      const flat = (data || []).map((comment) => {
        const votes = comment.comment_votes || [];
        const voteCount = votes.reduce(
          (sum: number, vote: VoteRecord) => sum + vote.vote_type,
          0,
        );
        const userVote = userIdRef.current
          ? votes.find((vote: VoteRecord) => vote.user_id === userIdRef.current)?.vote_type || null
          : null;

        return {
          ...comment,
          vote_count: voteCount,
          user_vote: userVote,
          replies: [] as Comment[],
        };
      });

      // Build tree: nest replies under their parent comment
      const map = new Map<string, Comment>();
      flat.forEach((c) => map.set(c.id, c));

      const roots: Comment[] = [];
      flat.forEach((c) => {
        if (c.parent_comment_id && map.has(c.parent_comment_id)) {
          map.get(c.parent_comment_id)!.replies!.push(c);
        } else {
          roots.push(c);
        }
      });

      if (mountedRef.current) setComments(roots);
    }
    if (mountedRef.current) setLoading(false);
  };

  useEffect(() => {
    mountedRef.current = true;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (id) {
      fetchPost();
      fetchComments();

      // Use id-scoped channel names to prevent conflicts across post navigations
      const commentsChannel = supabase
        .channel(`comments-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comments",
            filter: `post_id=eq.${id}`,
          },
          () => fetchComments(),
        )
        .subscribe();

      const commentVotesChannel = supabase
        .channel(`comment_votes-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comment_votes",
          },
          () => fetchComments(),
        )
        .subscribe();

      const postVotesChannel = supabase
        .channel(`post_votes-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "post_votes",
          },
          () => fetchPost(),
        )
        .subscribe();

      channels.push(commentsChannel, commentVotesChannel, postVotesChannel);
    }

    return () => {
      mountedRef.current = false;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [id]);

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
            {isEditing ? (
              <div className="edit-form">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="edit-title-input"
                  placeholder="Post title"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="edit-content-input"
                  placeholder="Post content"
                  rows={6}
                />
                {/* Existing media */}
                {editMediaUrls.length > 0 && (
                  <div className="media-preview-grid">
                    {editMediaUrls.map((url, i) => (
                      <div key={url} className="media-preview-item">
                        {/\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url) ? (
                          <video src={url} className="media-preview-media" />
                        ) : (
                          <img src={url} alt="" className="media-preview-media" />
                        )}
                        <button
                          type="button"
                          className="media-preview-remove"
                          onClick={() =>
                            setEditMediaUrls(editMediaUrls.filter((_, j) => j !== i))
                          }
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* New file previews */}
                {editNewPreviews.length > 0 && (
                  <div className="media-preview-grid">
                    {editNewPreviews.map((src, i) => (
                      <div key={i} className="media-preview-item">
                        {editNewFiles[i].type.startsWith("video/") ? (
                          <video src={src} className="media-preview-media" />
                        ) : (
                          <img src={src} alt="" className="media-preview-media" />
                        )}
                        <button
                          type="button"
                          className="media-preview-remove"
                          onClick={() => {
                            URL.revokeObjectURL(src);
                            setEditNewFiles(editNewFiles.filter((_, j) => j !== i));
                            setEditNewPreviews(editNewPreviews.filter((_, j) => j !== i));
                          }}
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add more media */}
                {editMediaUrls.length + editNewFiles.length < 5 && (
                  <>
                    <div
                      className="file-upload-area file-upload-area--compact"
                      onClick={() => editFileInputRef.current?.click()}
                    >
                      <span className="file-upload-icon">+</span>
                      <span className="file-upload-text">Add images or videos</span>
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleEditFileChange}
                      style={{ display: "none" }}
                    />
                  </>
                )}
                <div className="edit-actions">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="btn btn-primary btn-sm"
                  >
                    {editSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={editSaving}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="post-title">{post.title}</h1>
                <p className="post-content">{post.content}</p>
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="post-media-gallery">
                    {post.media_urls.map((url, i) =>
                      /\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url) ? (
                        <video
                          key={i}
                          src={url}
                          controls
                          className="post-media-item"
                        />
                      ) : (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="post-media-item"
                          style={{ cursor: "zoom-in" }}
                          onClick={() => setLightboxSrc(url)}
                        />
                      )
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
                </div>
                {userId === post.user_id && (
                  <div className="post-actions">
                    <button
                      onClick={handleEditPost}
                      className="btn btn-outline btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeletePost}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="comments-section">
        <div className="comments-header">
          <h2 className="section-title">Comments</h2>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="comments-sort-select"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="top">Most Upvoted</option>
            <option value="bottom">Least Upvoted</option>
          </select>
        </div>
        <div className="comment-form">
          <NewCommentForm postId={id!} onCommentAdded={fetchComments} />
        </div>
        <CommentList
          comments={sortCommentTree(comments, sortOrder)}
          onReply={fetchComments}
          onVoteUpdate={handleCommentVote}
          onCommentUpdate={fetchComments}
        />
      </div>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
