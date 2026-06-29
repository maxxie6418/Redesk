import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CategoryItem {
  id: number;
  owner_id: number;
  name: string;
  type: 'GENRE' | 'PERSONAL';
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  book_count: number;
}

export function useCategories(type?: 'GENRE' | 'PERSONAL') {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: () => {
      const qs = type ? `?type=${type}` : '';
      return api.get<CategoryItem[]>(`/categories${qs}`);
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type?: 'GENRE' | 'PERSONAL'; parent_id?: number | null; sort_order?: number }) =>
      api.post<CategoryItem>('/categories', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; type?: 'GENRE' | 'PERSONAL'; parent_id?: number | null; sort_order?: number }) =>
      api.patch<CategoryItem>(`/categories/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
