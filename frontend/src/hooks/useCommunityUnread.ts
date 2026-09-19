import { useQuery } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

export function useCommunityUnread() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['community', 'unread-count', user?.id],
    queryFn: async () => (await http.get('/chat/unread-count')).data,
    enabled: Boolean(user),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  return Math.max(0, Number(query.data?.count ?? 0));
}
