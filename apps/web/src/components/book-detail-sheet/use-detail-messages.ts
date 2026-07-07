import { useCallback, useEffect, useRef, useState } from 'react';
import type { StatusMessage, ToastType } from './types';

const MESSAGE_CLEAR_DELAY = 2000;

export function useDetailMessages() {
  const [message, setMessage] = useState<StatusMessage>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setMessage(null);
  }, [clearTimer]);

  const show = useCallback((text: string, type: ToastType) => {
    clearTimer();
    setMessage({ type, text });
    clearTimerRef.current = setTimeout(() => {
      setMessage(null);
      clearTimerRef.current = null;
    }, MESSAGE_CLEAR_DELAY);
  }, [clearTimer]);

  const info = useCallback((text: string) => show(text, 'info'), [show]);
  const warning = useCallback((text: string) => show(text, 'warning'), [show]);
  const error = useCallback((text: string) => show(text, 'error'), [show]);

  useEffect(() => clearTimer, [clearTimer]);

  return { message, info, warning, error, clear };
}
