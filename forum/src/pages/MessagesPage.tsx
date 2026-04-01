import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";
import NewConversationModal from "../components/NewConversationModal";
import { useCurrentUser } from "../contexts/UserContext";

interface ConversationMember {
  user_id: string;
  profiles: { id: string; username: string; avatar_url: string | null };
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message_at: string;
  conversation_members: ConversationMember[];
  last_message?: {
    content: string;
    created_at: string;
    profiles: { username: string } | null;
  } | null;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const navigate = useNavigate();
  const { userId: currentUserId, loading: authLoading } = useCurrentUser();

  useEffect(() => {
    if (authLoading) return;
    if (!currentUserId) {
      navigate("/login");
      return;
    }
    fetchConversations(currentUserId);
  }, [currentUserId, authLoading]);

  const fetchConversations = async (userId?: string) => {
    const resolvedUserId = userId ?? currentUserId;
    const { data: convos, error } = await supabase
      .from("conversations")
      .select(
        `
        id, name, is_group, last_message_at,
        conversation_members (
          user_id,
          profiles (id, username, avatar_url)
        )
      `,
      )
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      setLoading(false);
      return;
    }

    if (!convos || convos.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch latest message per conversation
    const ids = convos.map((c: any) => c.id);
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, profiles(username)")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });

    const latestByConvo = new Map<string, any>();
    for (const msg of msgs || []) {
      if (!latestByConvo.has(msg.conversation_id)) {
        latestByConvo.set(msg.conversation_id, msg);
      }
    }

    setConversations(
      convos.map((c: any) => ({
        ...c,
        last_message: latestByConvo.get(c.id) ?? null,
      })),
    );
    setLoading(false);
  };

  const getDisplay = (convo: Conversation, userId: string | null) => {
    if (convo.is_group) {
      const name =
        convo.name ||
        convo.conversation_members.map((m) => m.profiles.username).join(", ");
      return { name, avatarUrl: null, username: name };
    }
    const other = convo.conversation_members.find(
      (m) => m.user_id !== userId,
    );
    return {
      name: other?.profiles.username ?? "Unknown",
      avatarUrl: other?.profiles.avatar_url ?? null,
      username: other?.profiles.username ?? "",
    };
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return new Date(ts).toLocaleDateString();
  };

  if (loading) return <div className="loading">Loading messages...</div>;

  return (
    <div className="messages-container">
      <div className="messages-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          Messages
        </h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowNewModal(true)}
        >
          New Message
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <h3>No conversations yet</h3>
          <p>Start a new message to connect with other users.</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowNewModal(true)}
          >
            New Message
          </button>
        </div>
      ) : (
        <div className="convo-list">
          {conversations.map((convo) => {
            const display = getDisplay(convo, currentUserId);
            return (
              <Link
                key={convo.id}
                to={`/messages/${convo.id}`}
                className="convo-item"
              >
                <div className="convo-item-avatar">
                  {convo.is_group ? (
                    <div className="avatar avatar--md convo-group-avatar">
                      {(convo.name ?? display.name)[0].toUpperCase()}
                    </div>
                  ) : (
                    <Avatar
                      username={display.username}
                      avatarUrl={display.avatarUrl}
                      size="md"
                    />
                  )}
                </div>
                <div className="convo-item-body">
                  <div className="convo-item-header">
                    <span className="convo-item-name">{display.name}</span>
                    <span className="convo-item-time">
                      {formatTime(convo.last_message_at)}
                    </span>
                  </div>
                  <p className="convo-item-preview">
                    {convo.last_message
                      ? `${convo.last_message.profiles?.username ?? "Someone"}: ${
                          convo.last_message.content.length > 60
                            ? convo.last_message.content.slice(0, 60) + "…"
                            : convo.last_message.content
                        }`
                      : "No messages yet"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewConversationModal
          currentUserId={currentUserId!}
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => {
            setShowNewModal(false);
            navigate(`/messages/${id}`);
          }}
        />
      )}
    </div>
  );
}
