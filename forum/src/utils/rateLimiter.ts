import { supabase } from "../lib/supabase";

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function checkPostRateLimit(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();

  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return null; // fail open — server RLS will catch it
  if (count !== null && count >= 10) {
    return "You've reached the limit of 10 posts per hour. Please try again later.";
  }
  return null;
}

export async function checkCommentRateLimit(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();

  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return null; // fail open — server RLS will catch it
  if (count !== null && count >= 50) {
    return "You've reached the limit of 50 comments per hour. Please try again later.";
  }
  return null;
}
