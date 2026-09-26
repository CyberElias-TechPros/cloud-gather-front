import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listNotifications, markAllRead, markRead, unreadCount } from "@/services/notifications";

/** Poll the unread badge while the user is signed in. */
export function useUnreadNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => (await unreadCount()).unread,
    enabled: Boolean(user),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(limit = 20) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", "list", limit],
    queryFn: () => listNotifications({ limit }),
    enabled: Boolean(user),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const read = useMutation({ mutationFn: markRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllRead, onSuccess: invalidate });

  return { ...query, markRead: read, markAllRead: readAll };
}
