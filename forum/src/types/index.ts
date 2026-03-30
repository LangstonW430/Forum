export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: Profile; // For joined queries
}

export interface Comment {
  id: string;
  content: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  created_at: string;
  profiles?: Profile; // For joined queries
  replies?: Comment[]; // For nested comments
}

export interface NewPost {
  title: string;
  content: string;
}

export interface NewComment {
  content: string;
  post_id: string;
  parent_comment_id?: string;
}