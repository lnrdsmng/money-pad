import { useState, useEffect } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

export function useReadingProgress(storyId: string) {
  const { user } = useAuth();
  const [savedPartId, setSavedPartId] = useState<string | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    http.get(`/users/${user.id}/reading-progress/${storyId}`)
      .then(res => {
        if (res.data) {
          setSavedPartId(res.data.last_part_id);
          setSavedScrollPosition(res.data.last_scroll_position);
        }
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [user, storyId]);

  const saveProgress = (partId: string, scrollPosition: number) => {
    if (!user) return;
    http.post(`/users/${user.id}/reading-progress`, {
      storyId,
      last_part_id: partId,
      last_scroll_position: scrollPosition
    }).catch(console.error);
  };

  return { savedPartId, savedScrollPosition, saveProgress, loaded };
}
