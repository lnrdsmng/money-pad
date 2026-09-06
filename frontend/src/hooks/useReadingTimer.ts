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

export function useReadingTimer(
  storyId: string,
  partId: string,
  isEndOfChapter: boolean = false
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const readingKey = `${userId ?? ''}:${storyId}:${partId}`;
  const [pendingState, setPendingState] = useState<KeyedValue<number>>({ key: readingKey, value: 0 });
  const [pausedState, setPausedState] = useState<KeyedValue<boolean>>({ key: readingKey, value: false });
  const [sessionState, setSessionState] = useState<KeyedValue<string | null>>({ key: readingKey, value: null });
  const [errorState, setErrorState] = useState<KeyedValue<string | null>>({ key: readingKey, value: null });
  const [progressState, setProgressState] = useState<KeyedValue<number>>({ key: readingKey, value: 0 });
  const [latestAward, setLatestAward] = useState<number | null>(null);

  const lastActivity = useRef(0);
  const activeSeconds = useRef(0);
  const awardTimer = useRef<number | null>(null);
  const errorTimer = useRef<number | null>(null);
  const consecutiveFailures = useRef(0);

  const pendingEarned = pendingState.key === readingKey ? pendingState.value : 0;
  const isPaused = pausedState.key === readingKey ? pausedState.value : false;
  const sessionId = sessionState.key === readingKey ? sessionState.value : null;
  const error = errorState.key === readingKey ? errorState.value : null;
  const progress = progressState.key === readingKey ? progressState.value : 0;

  // Lifecycle: start and stop reading session
  useEffect(() => {
    if (!userId) return;

    let activeSessionId: string | null = null;
    let disposed = false;
    lastActivity.current = Date.now();
    activeSeconds.current = 0;
    consecutiveFailures.current = 0;

    http.post('/reading/start', { storyId, partId })
      .then((response) => {
        activeSessionId = response.data.id;
        if (!disposed) setSessionState({ key: readingKey, value: activeSessionId });
        else void http.post('/reading/stop', { sessionId: activeSessionId }).catch(() => undefined);
      })
      .catch(() => {
        if (!disposed) setErrorState({ key: readingKey, value: 'Reading income tracking could not be started.' });
      });

    const resetActivity = () => {
      lastActivity.current = Date.now();
      if (!isEndOfChapter) {
        setPausedState(previous => previous.key === readingKey && !previous.value ? previous : { key: readingKey, value: false });
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        setPausedState({ key: readingKey, value: true });
      } else {
        resetActivity();
      }
    };

    window.addEventListener('scroll', resetActivity, { passive: true });
    window.addEventListener('mousemove', resetActivity, { passive: true });
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('touchstart', resetActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.removeEventListener('scroll', resetActivity);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('touchstart', resetActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (activeSessionId) void http.post('/reading/stop', { sessionId: activeSessionId }).catch(() => undefined);
      if (awardTimer.current) window.clearTimeout(awardTimer.current);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, [userId, storyId, partId, readingKey, isEndOfChapter]);

  // Active reading ticker: increments progress per second, handles idle & heartbeat
  useEffect(() => {
    if (!sessionId || isEndOfChapter) return;

    let disposed = false;
    let inFlight = false;

    const ticker = window.setInterval(async () => {
      if (disposed) return;

      // Inactivity threshold: 40 seconds without user interaction or tab hidden
      const isIdle = (Date.now() - lastActivity.current > 40_000) || document.hidden;
      if (isIdle) {
        setPausedState(previous => previous.key === readingKey && previous.value ? previous : { key: readingKey, value: true });
        return;
      }

      // Resume from paused if active
      setPausedState(previous => previous.key === readingKey && !previous.value ? previous : { key: readingKey, value: false });

      // Advance active reading seconds
      activeSeconds.current += 1;
      const currentCycleSec = activeSeconds.current % 60;
      const progressFraction = (currentCycleSec === 0 ? 60 : currentCycleSec) / 60;
      setProgressState({ key: readingKey, value: progressFraction });

      // Every 60 active seconds: fire heartbeat
      if (activeSeconds.current >= 60) {
        activeSeconds.current = 0;
        if (inFlight) return;

        inFlight = true;
        const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

        void (async () => {
          const MAX_RETRIES = 2;
          const RETRY_DELAYS = [3000, 6000];
          let succeeded = false;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (disposed) break;

            try {
              const response = await http.post<HeartbeatResponse>('/reading/heartbeat', { sessionId });
              if (disposed) break;

              succeeded = true;
              consecutiveFailures.current = 0;

              const awarded = Number(response.data.amount_awarded);
              if (awarded > 0) {
                setPendingState(previous => ({
                  key: readingKey,
                  value: (previous.key === readingKey ? previous.value : 0) + awarded,
                }));
                setLatestAward(awarded);

                if (awardTimer.current) window.clearTimeout(awardTimer.current);
                awardTimer.current = window.setTimeout(() => {
                  setLatestAward(null);
                }, 3200);

                await queryClient.invalidateQueries({ queryKey: ['earnings', 'income'] });
              }
              setErrorState({ key: readingKey, value: null });
              break;
            } catch {
              if (disposed) break;

              // Backoff delay if retries remain
              if (attempt < MAX_RETRIES) {
                await delay(RETRY_DELAYS[attempt]);
              }
            }
          }

          if (!succeeded && !disposed) {
            consecutiveFailures.current += 1;
            // Only show error message after consecutive failures (e.g. 2+ failed cycles)
            if (consecutiveFailures.current >= 2) {
              setErrorState({ key: readingKey, value: 'Reading income tracking is temporarily unavailable.' });

              if (errorTimer.current) window.clearTimeout(errorTimer.current);
              errorTimer.current = window.setTimeout(() => {
                setErrorState({ key: readingKey, value: null });
              }, 8000);
            }
          }

          inFlight = false;
        })();
      }
    }, 1000);

    return () => {
      disposed = true;
      window.clearInterval(ticker);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, [sessionId, isEndOfChapter, queryClient, readingKey]);

  return { pendingEarned, isPaused, progress, latestAward, error };
}
