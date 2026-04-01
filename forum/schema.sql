-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add edited_at columns to existing tables (run these if tables already exist)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Add media_urls column for image/video uploads
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls TEXT[];

-- Add avatar_url column for profile pictures
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add bio column if upgrading an existing database
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Post votes table
CREATE TABLE IF NOT EXISTS post_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)), -- -1 for downvote, 1 for upvote
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id) -- One vote per user per post
);

-- Comment votes table
CREATE TABLE IF NOT EXISTS comment_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)), -- -1 for downvote, 1 for upvote
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id) -- One vote per user per comment
);

-- Enable Row Level Security (safe to run multiple times)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Drop existing policies for posts
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- Policies for posts
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies for comments
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

-- Policies for comments
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies for post votes
DROP POLICY IF EXISTS "Anyone can view post votes" ON post_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on posts" ON post_votes;
DROP POLICY IF EXISTS "Users can update their own post votes" ON post_votes;
DROP POLICY IF EXISTS "Users can delete their own post votes" ON post_votes;

-- Policies for post votes
CREATE POLICY "Anyone can view post votes" ON post_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on posts" ON post_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own post votes" ON post_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own post votes" ON post_votes FOR DELETE USING (auth.uid() = user_id);

-- Drop existing policies for comment votes
DROP POLICY IF EXISTS "Anyone can view comment votes" ON comment_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on comments" ON comment_votes;
DROP POLICY IF EXISTS "Users can update their own comment votes" ON comment_votes;
DROP POLICY IF EXISTS "Users can delete their own comment votes" ON comment_votes;

-- Policies for comment votes
CREATE POLICY "Anyone can view comment votes" ON comment_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on comments" ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comment votes" ON comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comment votes" ON comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Function to handle new user signup (CREATE OR REPLACE is already used)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
BEGIN
  -- Check if username was provided in metadata, otherwise use email prefix
  user_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, user_username);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Storage: post-media bucket ──────────────────────────────────────────────
-- Run this in the Supabase SQL editor AFTER creating the "post-media" bucket
-- in Storage → New bucket (set to Public).

-- Allow anyone to read files from the bucket
DROP POLICY IF EXISTS "Public read post-media" ON storage.objects;
CREATE POLICY "Public read post-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-media');

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Auth users upload post-media" ON storage.objects;
CREATE POLICY "Auth users upload post-media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-media' AND auth.role() = 'authenticated'
  );

-- Allow users to delete their own uploads (path starts with their user id)
DROP POLICY IF EXISTS "Users delete own post-media" ON storage.objects;
CREATE POLICY "Users delete own post-media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Storage: avatars bucket ─────────────────────────────────────────────────
-- Run AFTER creating the "avatars" bucket in Storage → New bucket (Public).

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Messaging ────────────────────────────────────────────────────────────────

-- Conversations (DMs and group chats)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT,                                          -- NULL for DMs, optional for groups
  is_group BOOLEAN DEFAULT FALSE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Who belongs to each conversation
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_convo ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Security-definer helper: checks membership WITHOUT triggering RLS
-- (avoids infinite recursion in self-referential conversation_members policies)
CREATE OR REPLACE FUNCTION public.is_conversation_member(convo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = convo_id
      AND user_id = auth.uid()
  );
$$;

-- Conversations
DROP POLICY IF EXISTS "Members can view conversations" ON conversations;
CREATE POLICY "Members can view conversations" ON conversations
  FOR SELECT USING (public.is_conversation_member(id));

DROP POLICY IF EXISTS "Auth users can create conversations" ON conversations;
CREATE POLICY "Auth users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Members can update conversations" ON conversations;
CREATE POLICY "Members can update conversations" ON conversations
  FOR UPDATE USING (public.is_conversation_member(id));

-- Conversation members
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can add to conversations" ON conversation_members;
CREATE POLICY "Members can add to conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_conversation_member(conversation_id)
  );

-- Messages
DROP POLICY IF EXISTS "Members can view messages" ON messages;
CREATE POLICY "Members can view messages" ON messages
  FOR SELECT USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_conversation_member(conversation_id)
  );