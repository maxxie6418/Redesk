import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DirInfo {
  file_count: number;
  size_bytes: number;
}

export interface OssStorageStatus {
  configured: boolean;
  provider: string;
  endpoint: string;
  bucket: string;
}

export interface SystemStorage {
  db_size_bytes: number;
  total_files: number;
  total_size_bytes: number;
  breakdown: Record<string, DirInfo>;
  oss: OssStorageStatus;
}

export interface SystemStats {
  version: string;
  node_env: string;
  node_version: string;
  sqlite_version: string;
  uptime_seconds: number;
  db_size_bytes: number;
  storage_size_bytes: number;
  book_count: number;
  trash_count: number;
  file_count: number;
  tag_count: number;
  category_count: number;
  user_count?: number;
}

export interface ClearCacheResult {
  success: boolean;
  freed_bytes: number;
  removed_files: number;
}

export function useSystemStats() {
  return useQuery({
    queryKey: ['system', 'stats'],
    queryFn: () => api.get<SystemStats>('/system/stats'),
  });
}

export function useSystemStorage() {
  return useQuery({
    queryKey: ['system', 'storage'],
    queryFn: () => api.get<SystemStorage>('/system/storage'),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ClearCacheResult>('/system/clear-cache'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system', 'storage'] });
    },
  });
}
