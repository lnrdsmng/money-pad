import { useCallback, useEffect, useRef, useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

interface Progress { last_part_id: string; last_scroll_position: number }
export function useReadingProgress(storyId: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = `${userId ?? ''}:${storyId}`;
  const [state, setState] = useState<{ key: string; progress: Progress | null; loaded: boolean }>({ key, progress: null, loaded: false });
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const revisionAtRequest = saveRevision.current;
    http.get<Progress | null>(`/users/${userId}/reading-progress/${storyId}`, { signal: controller.signal })
      .then(res => {
        if (!controller.signal.aborted && saveRevision.current === revisionAtRequest) {
          setState({ key, progress: res.data, loaded: true });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && saveRevision.current === revisionAtRequest) {
          setState({ key, progress: null, loaded: true });
        }
      });
    return () => controller.abort();
  }, [userId, storyId, key]);

  const saveProgress = useCallback((partId: string, scrollPosition: number) => {
    if (!userId) return Promise.resolve();

    const progress = {
      last_part_id: partId,
      last_scroll_position: Math.min(1, Math.max(0, scrollPosition)),
    };
    saveRevision.current += 1;
    setState({ key, progress, loaded: true });

    const request = saveQueue.current
      .catch(() => undefined)
      .then(() => http.post(`/users/${userId}/reading-progress`, { storyId, ...progress }))
      .then(() => undefined)
      .catch(() => undefined);
    saveQueue.current = request;

    return request;
  }, [userId, storyId, key]);

  const progress = state.key === key ? state.progress : null;
  return { savedPartId: progress?.last_part_id ?? null, savedScrollPosition: progress?.last_scroll_position ?? 0,
    saveProgress, loaded: !userId || (state.key === key && state.loaded) };
}
