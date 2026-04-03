-- Rate limiting functions (SECURITY DEFINER so they can read the tables
-- even when called from within a RLS policy context)

CREATE OR REPLACE FUNCTION public.posts_rate_limit_ok(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < 10
  FROM public.posts
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour';
$$;

CREATE OR REPLACE FUNCTION public.comments_rate_limit_ok(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*) < 50
  FROM public.comments
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour';
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.posts_rate_limit_ok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comments_rate_limit_ok(uuid) TO authenticated;

-- RLS policies for posts (add to existing RLS — drop first if a generic insert policy exists)
-- If you have an existing "Users can insert their own posts" policy, replace it:
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;

CREATE POLICY "Users can insert their own posts with rate limit"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.posts_rate_limit_ok(auth.uid())
  );

-- RLS policies for comments
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;

CREATE POLICY "Users can insert their own comments with rate limit"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.comments_rate_limit_ok(auth.uid())
  );
