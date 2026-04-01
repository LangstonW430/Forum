import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

interface Member {
  user_id: string;
  profiles: { username: string; avatar_url: string | null };
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  conversation_members: Member[];
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setCurrentUserId(user.id);
      await Promise.all([fetchConversation(), fetchMessages()]);
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => fetchMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversation = async () => {
    const { data } = await supabase
      .from("conversations")
      .select(
        `
        id, name, is_group,
        conversation_members (
          user_id,
          profiles (username, avatar_url)
        )
      `,
      )
      .eq("id", id)
      .single();
    if (data) setConversation(data as any);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, user_id, profiles(username, avatar_url)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as any);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !currentUserId || sending) return;

    setSending(true);
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      user_id: currentUserId,
      content,
    });

    if (!error) {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);
    } else {
      setNewMessage(content); // restore on error
    }
    setSending(false);
  };

  const getHeaderTitle = () => {
    if (!conversation) return "";
    if (conversation.is_group) {
      return (
        conversation.name ||
        conversation.conversation_members.map((m) => m.profiles.username).join(", ")
      );
    }
    const other = conversation.conversation_members.find(
      (m) => m.user_id !== currentUserId,
    );
    return other?.profiles.username ?? "Direct Message";
  };

  const getOtherMember = () => {
    if (!conversation || conversation.is_group) return null;
    return (
      conversation.conversation_members.find((m) => m.user_id !== currentUserId) ?? null
    );
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  if (loading) return <div className="loading">Loading...</div>;
  if (!conversation)
    return (
      <div className="empty-state">
        <h3>Conversation not found</h3>
        <Link to="/messages" className="btn btn-primary">
          Back to Messages
        </Link>
      </div>
    );

  const other = getOtherMember();

  return (
    <div className="conversation-container">
      {/* Header */}
      <div className="conversation-header">
        <Link to="/messages" className="conversation-back" title="Back">
          ←
        </Link>
        {conversation.is_group ? (
          <div className="avatar avatar--md convo-group-avatar">
            {(conversation.name ?? getHeaderTitle())[0].toUpperCase()}
          </div>
        ) : (
          <Avatar
            username={other?.profiles.username ?? ""}
            avatarUrl={other?.profiles.avatar_url}
            size="md"
          />
        )}
        <div className="conversation-header-info">
          <span className="conversation-header-name">{getHeaderTitle()}</span>
          {!conversation.is_group && other && (
            <Link
              to={`/user/${other.profiles.username}`}
              className="conversation-header-sub author-link"
            >
              View profile
            </Link>
          )}
          {conversation.is_group && (
            <span className="conversation-header-sub">
              {conversation.conversation_members.length} members
            </span>
          )}
        </div>
      </div>

      {/* Messages feed */}
      <div className="messages-feed" ref={feedRef}>
        {messages.length === 0 ? (
          <p className="messages-empty">Send a message to start the conversation.</p>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.user_id === currentUserId;
            const prevMsg = messages[i - 1];
            const nextMsg = messages[i + 1];

            const showDate =
              i === 0 ||
              formatDate(prevMsg.created_at) !== formatDate(msg.created_at);

            // Show avatar on the last consecutive message from this sender
            const isLastInGroup =
              !nextMsg || nextMsg.user_id !== msg.user_id;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="message-date-divider">
                    {formatDate(msg.created_at)}
                  </div>
                )}
                <div className={`message-row${isOwn ? " message-row--own" : ""}`}>
                  {!isOwn && (
                    <div className="message-avatar-slot">
                      {isLastInGroup && (
                        <Avatar
                          username={msg.profiles?.username ?? ""}
                          avatarUrl={msg.profiles?.avatar_url}
                          size="sm"
                        />
                      )}
                    </div>
                  )}
                  <div className="message-bubble-group">
                    {!isOwn && isLastInGroup && (
                      <span className="message-sender">{msg.profiles?.username}</span>
                    )}
                    <div
                      className={`message-bubble${isOwn ? " message-bubble--own" : ""}`}
                    >
                      {msg.content}
                    </div>
                    {isLastInGroup && (
                      <span className="message-time">{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="message-input-bar" onSubmit={sendMessage}>
        <input
          className="form-input message-input"
          type="text"
          placeholder="Type a message…"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!newMessage.trim() || sending}
        >
          Send
        </button>
      </form>
    </div>
  );
}
