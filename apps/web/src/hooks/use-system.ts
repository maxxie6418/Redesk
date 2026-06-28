import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SystemStats {
  db_size_bytes: number;
  storage_size_bytes: number;
  book_count: number;
  file_count: number;
}

export function useSystemStats() {
  return useQuery({
    queryKey: ['system', 'stats'],
    queryFn: () => api.get<SystemStats>('/system/stats'),
  });
}

export function useBackup() {
  return useMutation({
    mutationFn: () => api.post<{ path: string; success: boolean }>('/system/backup'),
  });
}

export function useFtsRebuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>('/system/fts-rebuild'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useClearCache() {
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>('/system/clear-cache'),
  });
}
