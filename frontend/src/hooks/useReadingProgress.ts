import { useCallback, useEffect, useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

interface Progress { last_part_id: string; last_scroll_position: number }
export function useReadingProgress(storyId: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = `${userId ?? ''}:${storyId}`;
  const [state, setState] = useState<{ key: string; progress: Progress | null; loaded: boolean }>({ key, progress: null, loaded: false });

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    http.get<Progress | null>(`/users/${userId}/reading-progress/${storyId}`, { signal: controller.signal })
      .then(res => setState({ key, progress: res.data, loaded: true }))
      .catch(() => { if (!controller.signal.aborted) setState({ key, progress: null, loaded: true }); });
    return () => controller.abort();
  }, [userId, storyId, key]);

  const saveProgress = useCallback((partId: string, scrollPosition: number) => {
    if (!userId) return;
    void http.post(`/users/${userId}/reading-progress`, {
      storyId, last_part_id: partId, last_scroll_position: Math.min(1, Math.max(0, scrollPosition)),
    }).catch(() => undefined);
  }, [userId, storyId]);

  const progress = state.key === key ? state.progress : null;
  return { savedPartId: progress?.last_part_id ?? null, savedScrollPosition: progress?.last_scroll_position ?? 0,
    saveProgress, loaded: !userId || (state.key === key && state.loaded) };
}
