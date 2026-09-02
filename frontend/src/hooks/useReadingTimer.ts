import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

interface HeartbeatResponse {
  amount_awarded: string;
}

interface KeyedValue<T> {
  key: string;
  value: T;
}

export function useReadingTimer(storyId: string, partId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const readingKey = `${storyId}:${partId}`;
  const [pendingState, setPendingState] = useState<KeyedValue<number>>({ key: readingKey, value: 0 });
  const [pausedState, setPausedState] = useState<KeyedValue<boolean>>({ key: readingKey, value: false });
  const [sessionState, setSessionState] = useState<KeyedValue<string | null>>({ key: readingKey, value: null });
  const [errorState, setErrorState] = useState<KeyedValue<string | null>>({ key: readingKey, value: null });
  const lastActivity = useRef(0);
  const pendingEarned = pendingState.key === readingKey ? pendingState.value : 0;
  const isPaused = pausedState.key === readingKey ? pausedState.value : false;
  const sessionId = sessionState.key === readingKey ? sessionState.value : null;
  const error = errorState.key === readingKey ? errorState.value : null;

  useEffect(() => {
    if (!user) return;

    let activeSessionId: string | null = null;
    let disposed = false;
    lastActivity.current = Date.now();

    http.post('/reading/start', { storyId, partId })
      .then((response) => {
        activeSessionId = response.data.id;
        if (!disposed) setSessionState({ key: readingKey, value: activeSessionId });
      })
      .catch(() => {
        if (!disposed) setErrorState({ key: readingKey, value: 'Reading income tracking could not be started.' });
      });

    const resetActivity = () => {
      lastActivity.current = Date.now();
      setPausedState({ key: readingKey, value: false });
    };
    const handleVisibility = () => document.hidden
      ? setPausedState({ key: readingKey, value: true })
      : resetActivity();

    window.addEventListener('scroll', resetActivity, { passive: true });
    window.addEventListener('mousemove', resetActivity, { passive: true });
    window.addEventListener('keydown', resetActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.removeEventListener('scroll', resetActivity);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (activeSessionId) void http.post('/reading/stop', { sessionId: activeSessionId }).catch(() => undefined);
    };
  }, [user, storyId, partId, readingKey]);

  useEffect(() => {
    if (!sessionId || isPaused) return;

    const heartbeat = async () => {
      if (Date.now() - lastActivity.current > 120_000 || document.hidden) {
        setPausedState({ key: readingKey, value: true });
        return;
      }

      try {
        const response = await http.post<HeartbeatResponse>('/reading/heartbeat', { sessionId });
        const awarded = Number(response.data.amount_awarded);
        if (awarded > 0) {
          setPendingState((previous) => ({
            key: readingKey,
            value: (previous.key === readingKey ? previous.value : 0) + awarded,
          }));
          await queryClient.invalidateQueries({ queryKey: ['earnings', 'income'] });
        }
        setErrorState({ key: readingKey, value: null });
      } catch {
        setErrorState({ key: readingKey, value: 'Reading income tracking is temporarily unavailable.' });
      }
    };

    const heartbeatInterval = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(heartbeatInterval);
  }, [sessionId, isPaused, queryClient, readingKey]);

  return { pendingEarned, isPaused, error };
}
