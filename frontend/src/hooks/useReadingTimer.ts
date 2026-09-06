import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';

interface HeartbeatResponse {
  amount_awarded: string;
  pending_total: string;
  stale: boolean;
}

interface ReadingSessionResponse {
  id: string;
  reading_policy?: {
    heartbeat_interval_seconds?: number;
    idle_timeout_seconds?: number;
  };
}

interface ReadingSessionDetails {
  id: string;
  heartbeatIntervalSeconds: number;
  idleTimeoutSeconds: number;
}

interface KeyedValue<T> {
  key: string;
  value: T;
}

export function useReadingTimer(
  storyId: string,
  partId: string,
  isEndOfChapter: boolean = false,
  enabled: boolean = true,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const readingKey = `${userId ?? ''}:${storyId}:${partId}`;
  const [pendingState, setPendingState] = useState<KeyedValue<number>>({ key: readingKey, value: 0 });
  const [pausedState, setPausedState] = useState<KeyedValue<boolean>>({ key: readingKey, value: false });
  const [sessionState, setSessionState] = useState<KeyedValue<ReadingSessionDetails | null>>({
    key: readingKey,
    value: null,
  });
  const [errorState, setErrorState] = useState<KeyedValue<string | null>>({ key: readingKey, value: null });
  const [progressState, setProgressState] = useState<KeyedValue<number>>({ key: readingKey, value: 0 });
  const [confirmingState, setConfirmingState] = useState<KeyedValue<boolean>>({ key: readingKey, value: false });
  const [latestAwardState, setLatestAwardState] = useState<KeyedValue<number | null>>({
    key: readingKey,
    value: null,
  });

  const lastActivity = useRef(0);
  const activeSeconds = useRef(0);
  const awardTimer = useRef<number | null>(null);
  const errorTimer = useRef<number | null>(null);

  const pendingEarned = pendingState.key === readingKey ? pendingState.value : 0;
  const isPaused = pausedState.key === readingKey ? pausedState.value : false;
  const session = sessionState.key === readingKey ? sessionState.value : null;
  const error = errorState.key === readingKey ? errorState.value : null;
  const progress = progressState.key === readingKey ? progressState.value : 0;
  const isConfirming = confirmingState.key === readingKey ? confirmingState.value : false;
  const latestAward = latestAwardState.key === readingKey ? latestAwardState.value : null;

  // Lifecycle: start and stop reading session
  useEffect(() => {
    if (!userId || !enabled) return;

    let activeSessionId: string | null = null;
    let disposed = false;
    lastActivity.current = Date.now();
    activeSeconds.current = 0;

    http.post<ReadingSessionResponse>('/reading/start', { storyId, partId })
      .then((response) => {
        activeSessionId = response.data.id;
        if (!disposed) {
          const heartbeatIntervalSeconds = Math.max(
            1,
            Number(response.data.reading_policy?.heartbeat_interval_seconds) || 60,
          );
          const idleTimeoutSeconds = Math.max(
            1,
            Number(response.data.reading_policy?.idle_timeout_seconds) || 120,
          );
          setSessionState({
            key: readingKey,
            value: { id: activeSessionId, heartbeatIntervalSeconds, idleTimeoutSeconds },
          });
          setErrorState({ key: readingKey, value: null });
        } else {
          void http.post('/reading/stop', { sessionId: activeSessionId }).catch(() => undefined);
        }
      })
      .catch(() => {
        if (!disposed) setErrorState({ key: readingKey, value: 'Reading income tracking could not be started.' });
      });

    const resetActivity = () => {
      lastActivity.current = Date.now();
      setPausedState(previous => previous.key === readingKey && !previous.value
        ? previous
        : { key: readingKey, value: false });
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
  }, [userId, storyId, partId, readingKey, enabled]);

  // Active reading ticker: increments progress per second, handles idle & heartbeat
  useEffect(() => {
    if (!session) return;

    if (isEndOfChapter) {
      void http.post('/reading/stop', { sessionId: session.id }).catch(() => undefined);
      return;
    }

    let disposed = false;
    let inFlight = false;

    const ticker = window.setInterval(() => {
      if (disposed || inFlight) return;

      const isIdle = (Date.now() - lastActivity.current > session.idleTimeoutSeconds * 1000) || document.hidden;
      if (isIdle) {
        setPausedState(previous => previous.key === readingKey && previous.value
          ? previous
          : { key: readingKey, value: true });
        return;
      }

      // Resume from paused if active
      setPausedState(previous => previous.key === readingKey && !previous.value
        ? previous
        : { key: readingKey, value: false });

      // Advance active reading seconds
      activeSeconds.current += 1;
      const progressFraction = Math.min(1, activeSeconds.current / session.heartbeatIntervalSeconds);
      setProgressState({ key: readingKey, value: progressFraction });

      // Confirm each completed reading interval with the authoritative server.
      if (activeSeconds.current >= session.heartbeatIntervalSeconds) {
        inFlight = true;
        setConfirmingState({ key: readingKey, value: true });
        const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

        void (async () => {
          const MAX_RETRIES = 2;
          const RETRY_DELAYS = [3000, 6000];
          let succeeded = false;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (disposed) break;

            try {
              const response = await http.post<HeartbeatResponse>('/reading/heartbeat', { sessionId: session.id });
              if (disposed) break;

              succeeded = true;

              const awarded = Number(response.data.amount_awarded);
              const pendingTotal = Number(response.data.pending_total);
              if (Number.isFinite(pendingTotal)) {
                setPendingState({ key: readingKey, value: pendingTotal });
              }
              if (awarded > 0) {
                setLatestAwardState({ key: readingKey, value: awarded });

                if (awardTimer.current) window.clearTimeout(awardTimer.current);
                awardTimer.current = window.setTimeout(() => {
                  setLatestAwardState({ key: readingKey, value: null });
                }, 3200);

                void queryClient.invalidateQueries({ queryKey: ['earnings', 'income'] });
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
            setErrorState({ key: readingKey, value: 'Reading income tracking is temporarily unavailable.' });

            if (errorTimer.current) window.clearTimeout(errorTimer.current);
            errorTimer.current = window.setTimeout(() => {
              setErrorState({ key: readingKey, value: null });
            }, 8000);
          }

          activeSeconds.current = 0;
          if (!disposed) {
            setProgressState({ key: readingKey, value: 0 });
            setConfirmingState({ key: readingKey, value: false });
          }
          inFlight = false;
        })();
      }
    }, 1000);

    return () => {
      disposed = true;
      window.clearInterval(ticker);
      setConfirmingState(previous => previous.key === readingKey && !previous.value
        ? previous
        : { key: readingKey, value: false });
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, [session, isEndOfChapter, queryClient, readingKey]);

  return { pendingEarned, isPaused, isConfirming, progress, latestAward, error };
}
