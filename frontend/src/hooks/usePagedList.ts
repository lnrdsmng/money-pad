import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import http from '../api/http';

export function usePagedList<T>(queryKey: QueryKey, url: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam, signal }) => {
      const response = await http.get<T[]>(url, { params: { page: pageParam }, signal });
      const next = Number(response.headers['x-next-page']);
      return { items: response.data, next: next > pageParam ? next : undefined };
    },
    getNextPageParam: page => page.next,
  });
  return { ...query, data: query.data?.pages.flatMap(page => page.items) ?? [] };
}
