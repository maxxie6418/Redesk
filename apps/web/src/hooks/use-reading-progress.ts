import { useQuery } from '@tanstack/react-query';
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

export function useReadingProgress(bookId: number) {
  return useQuery({
    queryKey: ['reading-progress', bookId],
    queryFn: () => api.get<ReadingProgressData | null>(`/books/${bookId}/reading-progress`),
    enabled: bookId > 0,
  });
}