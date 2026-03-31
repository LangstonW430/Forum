export interface Profile {
  id: string;
  username: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  edited_at?: string | null;
  media_urls?: string[] | null;
  profiles?: Profile; // For joined queries
  vote_count?: number; // Total upvotes minus downvotes
  user_vote?: number | null; // User's vote: 1 (up), -1 (down), or null (no vote)
  comment_count?: number;
}

export interface Comment {
  id: string;
  content: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  created_at: string;
  edited_at?: string | null;
  profiles?: Profile; // For joined queries
  replies?: Comment[]; // For nested comments
  vote_count?: number; // Total upvotes minus downvotes
  user_vote?: number | null; // User's vote: 1 (up), -1 (down), or null (no vote)
}

export interface PostVote {
  id: string;
  post_id: string;
  user_id: string;
  vote_type: number; // 1 for upvote, -1 for downvote
  created_at: string;
}

export interface CommentVote {
  id: string;
  comment_id: string;
  user_id: string;
  vote_type: number; // 1 for upvote, -1 for downvote
  created_at: string;
}

export interface NewPost {
  title: string;
  content: string;
  media_urls?: string[];
}

export interface NewComment {
  content: string;
  post_id: string;
  parent_comment_id?: string;
}