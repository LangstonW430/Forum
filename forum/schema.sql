-- ============================================================
--  Full database schema — run this on a fresh Supabase project
--  or use it as the authoritative reference for the live DB.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  bio        TEXT,
  avatar_url TEXT,
  value      INTEGER NOT NULL DEFAULT 0,  -- karma-like score
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  media_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS comments (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content           TEXT NOT NULL,
  post_id           UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  edited_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_votes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type  INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_votes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type  INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

-- Conversations (DMs and group chats)
-- created_by references auth.users (not profiles) so users without a profile
-- row can still create conversations.
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name            TEXT,
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications: comment, reply, and message events for each user.
-- Triggers handle inserts; users can read, update (mark read), and delete
-- their own rows.
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('comment', 'reply', 'message')),
  actor_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id      UUID REFERENCES comments(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversation_members_user  ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_convo ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation      ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user         ON notifications(user_id, created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles"        ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can view all profiles"        ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- posts (rate-limited insert)
DROP POLICY IF EXISTS "Anyone can view posts"                          ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts"           ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts"               ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts with rate limit" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts"               ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts"               ON posts;
CREATE POLICY "Anyone can view posts"        ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts"       ON posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.posts_rate_limit_ok(auth.uid()));
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- comments (rate-limited insert)
DROP POLICY IF EXISTS "Anyone can view comments"                           ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments"            ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments"                ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments with rate limit" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments"                ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments"                ON comments;
CREATE POLICY "Anyone can view comments"         ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments"        ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.comments_rate_limit_ok(auth.uid()));
CREATE POLICY "Users can update their own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- post_votes
DROP POLICY IF EXISTS "Anyone can view post votes"            ON post_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on posts" ON post_votes;
DROP POLICY IF EXISTS "Users can update their own post votes" ON post_votes;
DROP POLICY IF EXISTS "Users can delete their own post votes" ON post_votes;
CREATE POLICY "Anyone can view post votes"            ON post_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on posts" ON post_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own post votes" ON post_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own post votes" ON post_votes FOR DELETE USING (auth.uid() = user_id);

-- comment_votes
DROP POLICY IF EXISTS "Anyone can view comment votes"               ON comment_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on comments"    ON comment_votes;
DROP POLICY IF EXISTS "Users can update their own comment votes"    ON comment_votes;
DROP POLICY IF EXISTS "Users can delete their own comment votes"    ON comment_votes;
CREATE POLICY "Anyone can view comment votes"               ON comment_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on comments"    ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comment votes"    ON comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comment votes"    ON comment_votes FOR DELETE USING (auth.uid() = user_id);

-- conversations
DROP POLICY IF EXISTS "Members can view conversations"      ON conversations;
DROP POLICY IF EXISTS "Auth users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Members can update conversations"    ON conversations;
CREATE POLICY "Members can view conversations"   ON conversations
  FOR SELECT USING (public.is_conversation_member(id));
CREATE POLICY "Auth users can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );
CREATE POLICY "Members can update conversations" ON conversations
  FOR UPDATE USING (public.is_conversation_member(id));

-- conversation_members
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
DROP POLICY IF EXISTS "Members can add to conversations"      ON conversation_members;
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY "Members can add to conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_conversation_member(conversation_id)
  );

-- messages
DROP POLICY IF EXISTS "Members can view messages" ON messages;
DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can view messages" ON messages
  FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY "Members can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_conversation_member(conversation_id)
  );

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications"   ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"   ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_username TEXT;
BEGIN
  user_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  INSERT INTO public.profiles (id, username) VALUES (new.id, user_username);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the calling user has a profile row (called by frontend before any
-- operation that requires one). Creates a minimal profile from the email
-- prefix if none exists; appends a numeric suffix to avoid name collisions.
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS void AS $$
DECLARE
  base_name  TEXT;
  final_name TEXT;
  suffix     INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    RETURN;
  END IF;

  SELECT regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')
  INTO base_name
  FROM auth.users WHERE id = auth.uid();

  IF base_name IS NULL OR base_name = '' THEN base_name := 'user'; END IF;
  final_name := base_name;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_name) LOOP
    suffix := suffix + 1;
    final_name := base_name || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (auth.uid(), final_name)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Rate limiting: max 10 posts per user per hour.
CREATE OR REPLACE FUNCTION public.posts_rate_limit_ok(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COUNT(*) < 10
  FROM public.posts
  WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '1 hour';
$$;

-- Rate limiting: max 50 comments per user per hour.
CREATE OR REPLACE FUNCTION public.comments_rate_limit_ok(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COUNT(*) < 50
  FROM public.comments
  WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '1 hour';
$$;

GRANT EXECUTE ON FUNCTION public.posts_rate_limit_ok(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.comments_rate_limit_ok(uuid) TO authenticated;

-- Membership check used by conversation RLS policies. SECURITY DEFINER avoids
-- infinite recursion when conversation_members policies call back into itself.
CREATE OR REPLACE FUNCTION public.is_conversation_member(convo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = convo_id AND user_id = auth.uid()
  );
$$;

-- ── Value (karma) system ──────────────────────────────────────────────────────
-- Upvotes/downvotes from others change value. Comments from others add +1.
-- Self-votes and self-comments have no effect.

CREATE OR REPLACE FUNCTION public.update_post_author_value()
RETURNS TRIGGER AS $$
DECLARE author_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO author_id FROM posts WHERE id = OLD.post_id;
    IF author_id = OLD.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value - OLD.vote_type WHERE id = author_id;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT user_id INTO author_id FROM posts WHERE id = NEW.post_id;
    IF author_id = NEW.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value + NEW.vote_type WHERE id = author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT user_id INTO author_id FROM posts WHERE id = NEW.post_id;
    IF author_id = NEW.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value + (NEW.vote_type - OLD.vote_type) WHERE id = author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_comment_author_value()
RETURNS TRIGGER AS $$
DECLARE author_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO author_id FROM comments WHERE id = OLD.comment_id;
    IF author_id = OLD.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value - OLD.vote_type WHERE id = author_id;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT user_id INTO author_id FROM comments WHERE id = NEW.comment_id;
    IF author_id = NEW.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value + NEW.vote_type WHERE id = author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT user_id INTO author_id FROM comments WHERE id = NEW.comment_id;
    IF author_id = NEW.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value + (NEW.vote_type - OLD.vote_type) WHERE id = author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_value_on_comment()
RETURNS TRIGGER AS $$
DECLARE content_author_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_comment_id IS NULL THEN
      SELECT user_id INTO content_author_id FROM posts WHERE id = NEW.post_id;
    ELSE
      SELECT user_id INTO content_author_id FROM comments WHERE id = NEW.parent_comment_id;
    END IF;
    IF content_author_id = NEW.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value + 1 WHERE id = content_author_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_comment_id IS NULL THEN
      SELECT user_id INTO content_author_id FROM posts WHERE id = OLD.post_id;
    ELSE
      SELECT user_id INTO content_author_id FROM comments WHERE id = OLD.parent_comment_id;
    END IF;
    IF content_author_id = OLD.user_id THEN RETURN NULL; END IF;
    UPDATE profiles SET value = value - 1 WHERE id = content_author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Notification functions ────────────────────────────────────────────────────

-- Notify post/comment author when someone else comments or replies.
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE recipient_id UUID;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    SELECT user_id INTO recipient_id FROM posts WHERE id = NEW.post_id;
  ELSE
    SELECT user_id INTO recipient_id FROM comments WHERE id = NEW.parent_comment_id;
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.user_id THEN RETURN NULL; END IF;

  INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id)
  VALUES (
    recipient_id,
    CASE WHEN NEW.parent_comment_id IS NULL THEN 'comment' ELSE 'reply' END,
    NEW.user_id, NEW.post_id, NEW.id
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify all conversation members when a new message is sent.
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE member RECORD;
BEGIN
  FOR member IN
    SELECT user_id FROM conversation_members
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, actor_id, conversation_id)
    VALUES (member.user_id, 'message', NEW.user_id, NEW.conversation_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created   ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_post_vote_change ON post_votes;
CREATE TRIGGER on_post_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON post_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_author_value();

DROP TRIGGER IF EXISTS on_comment_vote_change ON comment_votes;
CREATE TRIGGER on_comment_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_author_value();

DROP TRIGGER IF EXISTS on_comment_change ON comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION public.update_value_on_comment();

DROP TRIGGER IF EXISTS on_comment_notify ON comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS on_message_notify ON messages;
CREATE TRIGGER on_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ── Storage policies ──────────────────────────────────────────────────────────
-- Run AFTER creating the "post-media" and "avatars" buckets in Supabase
-- Storage (set both to Public).

DROP POLICY IF EXISTS "Public read post-media"     ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload post-media" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own post-media" ON storage.objects;
CREATE POLICY "Public read post-media"      ON storage.objects FOR SELECT USING (bucket_id = 'post-media');
CREATE POLICY "Auth users upload post-media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own post-media" ON storage.objects FOR DELETE
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public read avatars"    ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Public read avatars"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
