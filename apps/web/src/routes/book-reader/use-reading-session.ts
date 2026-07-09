import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '@/lib/api';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface UseReadingSessionParams {
  bookId: number;
  enabled: boolean;
}

interface UseReadingSessionReturn {
  sessionDuration: number;
  close: () => void;
}

export function useReadingSession({ bookId, enabled }: UseReadingSessionParams): UseReadingSessionReturn {
  const [sessionDuration, setSessionDuration] = useState(0);

  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookIdRef = useRef(bookId);
  const closedRef = useRef(false);

  bookIdRef.current = bookId;

  const sendHeartbeat = useCallback(() => {
    if (closedRef.current) return;
    fetch(`${API_BASE}/reading-sessions/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ book_id: bookIdRef.current }),
    }).catch(() => {});
  }, []);

  const stopTimers = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (durationTimerRef.current !== null) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    stopTimers();
    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    durationTimerRef.current = setInterval(() => {
      setSessionDuration((prev) => prev + 1);
    }, 1000);
  }, [sendHeartbeat, stopTimers]);

  const sendClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;

    const url = `${API_BASE}/reading-sessions/close`;
    const body = JSON.stringify({ book_id: bookIdRef.current });
    const blob = new Blob([body], { type: 'application/json' });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  const close = useCallback(() => {
    stopTimers();
    sendClose();
  }, [stopTimers, sendClose]);

  useEffect(() => {
    if (!enabled || bookId <= 0) return;

    closedRef.current = false;
    setSessionDuration(0);

    sendHeartbeat();
    startTimers();

    const onVisibilityChange = () => {
      if (closedRef.current) return;
      if (document.visibilityState === 'hidden') {
        stopTimers();
      } else {
        sendHeartbeat();
        startTimers();
      }
    };

    const onBeforeUnload = () => {
      sendClose();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      stopTimers();
      sendClose();
    };
  }, [bookId, enabled, sendHeartbeat, startTimers, stopTimers, sendClose]);

  return { sessionDuration, close };
}
