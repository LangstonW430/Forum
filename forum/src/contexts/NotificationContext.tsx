import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "./UserContext";

interface NotificationContextType {
  unreadCount: number;
  // Called by NotificationsPage when a single notification is dismissed
  decrementCount: (by?: number) => void;
  // Called by NotificationsPage when Clear All removes everything
  resetCount: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  decrementCount: () => {},
  resetCount: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useCurrentUser();
  const userId = user?.id;

  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    fetchUnread();

    // Only subscribe to INSERT events here — new notifications arriving from
    // other users. UPDATE and DELETE are handled via decrementCount/resetCount
    // directly from NotificationsPage, so no Realtime dependency for those.
    const channel = supabase
      .channel(`notification-count:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount((prev) => prev + 1),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnread]);

  const decrementCount = useCallback((by = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - by));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, decrementCount, resetCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
