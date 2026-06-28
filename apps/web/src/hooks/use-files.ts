import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BookFileItem {
  id: number;
  book_id: number;
  file_path: string;
  original_filename: string | null;
  file_format: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export function useBookFiles(bookId: number) {
  return useQuery({
    queryKey: ['books', bookId, 'files'],
    queryFn: () => api.get<BookFileItem[]>(`/books/${bookId}/files`),
    enabled: bookId > 0,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, file, isPrimary }: { bookId: number; file: File; isPrimary?: boolean }) => {
      const form = new FormData();
      form.append('file', file);
      if (isPrimary) form.append('is_primary', 'true');

      const res = await fetch(`/api/v1/books/${bookId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '上传失败');
      }

      return (await res.json()) as { data: { id: number; file_format: string } };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useReplaceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, fileId, file }: { bookId: number; fileId: number; file: File }) => {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`/api/v1/books/${bookId}/files/${fileId}/replace`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '替换失败');
      }

      return (await res.json()) as { data: { id: number; file_format: string } };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useUpdateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, fileId, ...input }: { bookId: number; fileId: number; is_primary?: boolean; original_filename?: string }) =>
      api.patch<BookFileItem>(`/books/${bookId}/files/${fileId}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, fileId }: { bookId: number; fileId: number }) =>
      api.delete<{ id: number; deleted: boolean }>(`/books/${bookId}/files/${fileId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
