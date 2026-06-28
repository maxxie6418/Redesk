import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DuplicateGroup {
  book_id: number;
  duplicates: number[];
  score: number;
}

export function useDuplicates(threshold?: number) {
  const sp = new URLSearchParams();
  if (threshold != null) sp.set('threshold', String(threshold));
  const qs = sp.toString();

  return useQuery({
    queryKey: ['books', 'duplicates', threshold],
    queryFn: () => api.get<DuplicateGroup[]>(`/books/duplicates${qs ? `?${qs}` : ''}`),
  });
}
