import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RelationEntry {
  id: number;
  source_book_id: number;
  target_book_id: number;
  relation_type: string | null;
  note: string | null;
  created_at: string;
  target_title?: string;
  target_author?: string;
  source_title?: string;
  source_author?: string;
}

export interface BookRelations {
  outgoing: RelationEntry[];
  incoming: RelationEntry[];
}

export function useBookRelations(bookId: number) {
  return useQuery({
    queryKey: ['books', bookId, 'relations'],
    queryFn: () => api.get<BookRelations>(`/books/${bookId}/relations`),
    enabled: bookId > 0,
  });
}

export function useCreateRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, ...input }: { bookId: number; target_book_id: number; relation_type?: string; note?: string }) =>
      api.post(`/books/${bookId}/relations`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'relations'] });
    },
  });
}

export function useDeleteRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, relationId }: { bookId: number; relationId: number }) =>
      api.delete(`/books/${bookId}/relations/${relationId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'relations'] });
    },
  });
}
