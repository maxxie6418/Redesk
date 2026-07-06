import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface ReadingProgressData {
  id: number;
  book_id: number;
  owner_id: number;
  file_id: number;
  cfi: string;
  percentage: number;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgressSyncStatus {
  failedAttempts: number;
  lastErrorAt: string | null;
}

const INITIAL_STATUS: ReadingProgressSyncStatus = {
  failedAttempts: 0,
  lastErrorAt: null,
};

const WARNING_FAILURE_THRESHOLD = 2;

function createProgressKey(cfi: string, percentage: number) {
  return `${cfi}:${percentage}`;
}

export function shouldShowReadingProgressSyncWarning(status: ReadingProgressSyncStatus) {
  return status.failedAttempts >= WARNING_FAILURE_THRESHOLD;
}

export function getReadingProgressSyncMessage(status: ReadingProgressSyncStatus) {
  return shouldShowReadingProgressSyncWarning(status) ? '阅读进度暂未同步' : null;
}

export function createReadingProgressSyncTracker() {
  let lastSuccessfulKey = '';
  let status = INITIAL_STATUS;

  return {
    shouldSave(cfi: string, percentage: number) {
      return createProgressKey(cfi, percentage) !== lastSuccessfulKey;
    },
    markSuccess(cfi: string, percentage: number) {
      lastSuccessfulKey = createProgressKey(cfi, percentage);
      status = INITIAL_STATUS;
      return status;
    },
    markFailure() {
      status = {
        failedAttempts: status.failedAttempts + 1,
        lastErrorAt: new Date().toISOString(),
      };
      return status;
    },
    reset() {
      lastSuccessfulKey = '';
      status = INITIAL_STATUS;
      return status;
    },
    getStatus() {
      return status;
    },
  };
}

interface UseReadingProgressSyncOptions {
  bookId: number;
  fileId?: number;
}

export function useReadingProgressSync({ bookId, fileId }: UseReadingProgressSyncOptions) {
  const trackerRef = useRef(createReadingProgressSyncTracker());
  const [status, setStatus] = useState<ReadingProgressSyncStatus>(INITIAL_STATUS);

  useEffect(() => {
    setStatus(trackerRef.current.reset());
  }, [bookId, fileId]);

  const saveProgress = useCallback(
    async (cfi: string, percentage: number) => {
      if (!bookId || !fileId || !trackerRef.current.shouldSave(cfi, percentage)) return;

      try {
        await api.put<ReadingProgressData>(`/books/${bookId}/reading-progress`, {
          file_id: fileId,
          cfi,
          percentage,
        });
        setStatus(trackerRef.current.markSuccess(cfi, percentage));
      } catch {
        setStatus(trackerRef.current.markFailure());
      }
    },
    [bookId, fileId],
  );

  const message = useMemo(() => getReadingProgressSyncMessage(status), [status]);

  return {
    saveProgress,
    syncStatus: status,
    syncMessage: message,
  };
}
