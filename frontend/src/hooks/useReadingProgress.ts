import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

export interface ReadingProgress {
  last_part_id: string;
  last_scroll_position: number;
  updated_at?: string;
}

export interface StoredReadingProgress extends ReadingProgress {
  savedAt: number;
}

const storageKey = (userId: string, storyId: string) => `moneypad:reading-progress:${userId}:${storyId}`;

export function getStoredReadingProgress(userId: string, storyId: string): StoredReadingProgress | null {
  try {
    const stored = window.localStorage.getItem(storageKey(userId, storyId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StoredReadingProgress>;
    if (typeof parsed.last_part_id !== 'string' || typeof parsed.last_scroll_position !== 'number') return null;
    return {
      last_part_id: parsed.last_part_id,
      last_scroll_position: Math.min(1, Math.max(0, parsed.last_scroll_position)),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function storeReadingProgress(
  userId: string,
  storyId: string,
  progress: ReadingProgress,
  savedAt = Date.now(),
) {
  try {
    window.localStorage.setItem(storageKey(userId, storyId), JSON.stringify({ ...progress, savedAt }));
  } catch {
    // The API save remains available when storage is disabled or full.
  }
}

export function useReadingProgress(storyId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const key = `${userId ?? ''}:${storyId}`;
  const currentStoredProgress = userId ? getStoredReadingProgress(userId, storyId) : null;
  const [state, setState] = useState<{ key: string; progress: ReadingProgress | null; loaded: boolean }>({
    key,
    progress: currentStoredProgress,
    loaded: Boolean(currentStoredProgress),
  });
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!userId) return;
    const storedProgress = getStoredReadingProgress(userId, storyId);
    const controller = new AbortController();
    const revisionAtRequest = saveRevision.current;
    http.get<ReadingProgress | null>(`/users/${userId}/reading-progress/${storyId}`, { signal: controller.signal })
      .then(res => {
        if (!controller.signal.aborted && saveRevision.current === revisionAtRequest) {
          const parsedServerSavedAt = res.data?.updated_at ? Date.parse(res.data.updated_at) : 0;
          const serverSavedAt = Number.isFinite(parsedServerSavedAt) ? parsedServerSavedAt : 0;
          const progress = storedProgress && storedProgress.savedAt >= serverSavedAt
            ? storedProgress
            : res.data;
          if (progress === res.data && res.data) {
            storeReadingProgress(userId, storyId, res.data, serverSavedAt);
          }
          setState({ key, progress, loaded: true });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && saveRevision.current === revisionAtRequest) {
          setState({ key, progress: storedProgress, loaded: true });
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
    storeReadingProgress(userId, storyId, progress);
    saveRevision.current += 1;
    setState({ key, progress, loaded: true });

    const request = saveQueue.current
      .catch(() => undefined)
      .then(() => http.post(`/users/${userId}/reading-progress`, { storyId, ...progress }))
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['stories', 'continueReading', userId] });
        void queryClient.invalidateQueries({ queryKey: ['stories', 'readingHistory', userId] });
      })
      .catch(() => undefined);
    saveQueue.current = request;

    return request;
  }, [userId, storyId, key, queryClient]);

  const progress = state.key === key ? state.progress : currentStoredProgress;
  return { savedPartId: progress?.last_part_id ?? null, savedScrollPosition: progress?.last_scroll_position ?? 0,
    saveProgress, loaded: !userId || Boolean(currentStoredProgress) || (state.key === key && state.loaded) };
}
