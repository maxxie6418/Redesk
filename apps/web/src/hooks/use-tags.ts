import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TagItem {
  id: number;
  owner_id: number;
  name: string;
  created_at: string;
  book_count: number;
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<TagItem[]>('/tags'),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api.post<TagItem>('/tags', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name: string }) =>
      api.patch<TagItem>(`/tags/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
