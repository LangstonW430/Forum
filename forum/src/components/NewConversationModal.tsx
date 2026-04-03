import { useState } from "react";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";
import { useToast } from "../contexts/ToastContext";

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface Props {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function NewConversationModal({
  currentUserId,
  onClose,
  onCreated,
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q.trim()}%`)
      .neq("id", currentUserId)
      .limit(8);
    const matches = data ?? [];
    if (matches.length === 0) {
      toast.error("User doesn't exist");
    }
    setResults(matches.filter((p) => !selected.some((s) => s.id === p.id)));
    setSearching(false);
  };

  const addUser = (profile: Profile) => {
    setSelected((prev) => [...prev, profile]);
    setResults((prev) => prev.filter((p) => p.id !== profile.id));
    setSearch("");
  };

  const removeUser = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreate = async () => {
    if (selected.length === 0 || creating) return;
    setCreating(true);

    const isGroup = selected.length > 1;

    // For DMs: reuse an existing conversation if one already exists
    if (!isGroup) {
      const { data: existingConvos } = await supabase
        .from("conversations")
        .select("id, conversation_members(user_id)")
        .eq("is_group", false);

      const existing = (existingConvos ?? []).find(
        (c: any) =>
          c.conversation_members.length === 2 &&
          c.conversation_members.some((m: any) => m.user_id === selected[0].id),
      );

      if (existing) {
        onCreated(existing.id);
        return;
      }
    }

    // Ensure current user has a profile row (required by conversation_members FK)
    const { error: profileError } = await supabase.rpc("ensure_own_profile");
    if (profileError) {
      toast.error(`Profile setup failed: ${profileError.message}`);
      setCreating(false);
      return;
    }

    // Generate the ID client-side so we don't need to SELECT it back
    // (the SELECT RLS policy requires membership which doesn't exist yet)
    const convoId = crypto.randomUUID();

    const { error: convoError } = await supabase
      .from("conversations")
      .insert({
        id: convoId,
        is_group: isGroup,
        name: isGroup && groupName.trim() ? groupName.trim() : null,
        created_by: currentUserId,
      });

    if (convoError) {
      toast.error(`Failed to create conversation: ${convoError.message}`);
      setCreating(false);
      return;
    }

    // Add self first (satisfies the RLS policy), then add others
    const { error: selfError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: convoId, user_id: currentUserId });

    if (selfError) {
      toast.error(`Failed to join conversation: ${selfError.message}`);
      setCreating(false);
      return;
    }

    const { error: othersError } = await supabase
      .from("conversation_members")
      .insert(selected.map((p) => ({ conversation_id: convoId, user_id: p.id })));

    if (othersError) {
      toast.error(`Failed to add members: ${othersError.message}`);
      setCreating(false);
      return;
    }

    onCreated(convoId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Message</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Selected user chips */}
        {selected.length > 0 && (
          <div className="new-convo-chips">
            {selected.map((p) => (
              <span key={p.id} className="new-convo-chip">
                {p.username}
                <button onClick={() => removeUser(p.id)} aria-label="Remove">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <input
          className="form-input"
          type="text"
          placeholder="Search by username…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />

        {searching && <p className="new-convo-hint">Searching…</p>}

        {results.length > 0 && (
          <div className="new-convo-results">
            {results.map((p) => (
              <div
                key={p.id}
                className="new-convo-result"
                onClick={() => addUser(p)}
              >
                <Avatar username={p.username} avatarUrl={p.avatar_url} size="sm" />
                <span>{p.username}</span>
              </div>
            ))}
          </div>
        )}

        {/* Optional group name when multiple users selected */}
        {selected.length > 1 && (
          <input
            className="form-input"
            type="text"
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={selected.length === 0 || creating}
            onClick={handleCreate}
          >
            {creating
              ? "Creating…"
              : selected.length > 1
                ? "Create Group"
                : "Start Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
