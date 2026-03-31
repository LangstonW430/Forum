import { useState } from "react";
import { supabase } from "../lib/supabase";

interface VoteButtonsProps {
  itemId: string;
  itemType: "post" | "comment";
  voteCount: number;
  userVote: number | null;
  onVoteUpdate: (newVoteCount: number, newUserVote: number | null) => void;
}

export default function VoteButtons({
  itemId,
  itemType,
  voteCount,
  userVote,
  onVoteUpdate,
}: VoteButtonsProps) {
  const [loading, setLoading] = useState(false);

  const handleVote = async (voteType: number) => {
    if (loading) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in to vote");
        setLoading(false);
        return;
      }

      const tableName = itemType === "post" ? "post_votes" : "comment_votes";
      const itemIdField = itemType === "post" ? "post_id" : "comment_id";

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from(tableName)
        .select("*")
        .eq(itemIdField, itemId)
        .eq("user_id", user.id)
        .single();

      let newVoteCount = voteCount;
      let newUserVote: number | null = voteType;

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // User is removing their vote (clicking same button again)
          await supabase
            .from(tableName)
            .delete()
            .eq(itemIdField, itemId)
            .eq("user_id", user.id);
          newVoteCount = voteCount - voteType;
          newUserVote = null;
        } else {
          // User is changing their vote
          await supabase
            .from(tableName)
            .update({ vote_type: voteType })
            .eq(itemIdField, itemId)
            .eq("user_id", user.id);
          newVoteCount = voteCount - existingVote.vote_type + voteType;
        }
      } else {
        // User is voting for the first time
        await supabase.from(tableName).insert({
          [itemIdField]: itemId,
          user_id: user.id,
          vote_type: voteType,
        });
        newVoteCount = voteCount + voteType;
      }

      onVoteUpdate(newVoteCount, newUserVote);
    } catch (error) {
      console.error("Error voting:", error);
      alert("Error voting. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vote-buttons">
      <button
        onClick={() => handleVote(1)}
        className={`vote-btn upvote ${userVote === 1 ? "active" : ""}`}
        disabled={loading}
        title="Upvote"
      >
        ▲
      </button>
      <span className="vote-count">{voteCount}</span>
      <button
        onClick={() => handleVote(-1)}
        className={`vote-btn downvote ${userVote === -1 ? "active" : ""}`}
        disabled={loading}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
