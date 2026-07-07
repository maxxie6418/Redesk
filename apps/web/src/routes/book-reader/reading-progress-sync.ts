import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  INITIAL_READING_PROGRESS_SYNC_STATUS,
  createReadingProgressSyncTracker,
  getReadingProgressSyncMessage,
  shouldShowReadingProgressSyncWarning,
  type ReadingProgressSyncStatus,
} from './reading-progress-sync-core';

export {
  createReadingProgressSyncTracker,
  getReadingProgressSyncMessage,
  shouldShowReadingProgressSyncWarning,
  type ReadingProgressSyncStatus,
};

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

interface UseReadingProgressSyncOptions {
  bookId: number;
  fileId?: number;
}

export function useReadingProgressSync({ bookId, fileId }: UseReadingProgressSyncOptions) {
  const trackerRef = useRef(createReadingProgressSyncTracker());
  const [status, setStatus] = useState<ReadingProgressSyncStatus>(INITIAL_READING_PROGRESS_SYNC_STATUS);

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
