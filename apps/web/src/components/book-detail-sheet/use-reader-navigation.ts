import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookRecentMarkItem, BookTraceItem } from './components';

export function useReaderNavigation(bookId: number | null) {
  const navigate = useNavigate();

  const openReader = useCallback(() => {
    if (!bookId) return;
    navigate(`/books/${bookId}/read`);
  }, [bookId, navigate]);

  const openMarkInReader = useCallback(
    (mark: BookRecentMarkItem) => {
      if (!bookId) return;
      const cfi = mark.cfi ?? mark.cfi_start;
      navigate(cfi ? `/books/${bookId}/read?cfi=${encodeURIComponent(cfi)}` : `/books/${bookId}/read`);
    },
    [bookId, navigate],
  );

  const openTraceInReader = useCallback(
    (trace: BookTraceItem) => {
      if (!bookId) return;
      navigate(trace.cfi ? `/books/${bookId}/read?cfi=${encodeURIComponent(trace.cfi)}` : `/books/${bookId}/read`);
    },
    [bookId, navigate],
  );

  return { openMarkInReader, openTraceInReader, openReader };
}
