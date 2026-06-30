import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type StorageDriver = 'local' | 's3';

export interface StorageStatus {
  writeDriver: StorageDriver;
  configured: boolean;
  provider: string | null;
  bucket: string | null;
  endpoint: string | null;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  region: string | null;
  publicUrl: string | null;
  reason: string | null;
}

export type StorageSettingsMap = Record<string, string | null>;

export interface StorageSettingsInput {
  driver: StorageDriver;
  provider?: string | null;
  endpoint?: string | null;
  bucket?: string | null;
  access_key?: string | null;
  secret_key?: string | null;
  region?: string | null;
  public_url?: string | null;
}

export interface StorageTestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export function useStorageStatus() {
  return useQuery({
    queryKey: ['storage', 'status'],
    queryFn: () => api.get<StorageStatus>('/storage/status'),
  });
}

export function useStorageSettings() {
  return useQuery({
    queryKey: ['storage', 'settings'],
    queryFn: () => api.get<StorageSettingsMap>('/storage/settings'),
  });
}

export function useUpdateStorageSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StorageSettingsInput) => api.patch<StorageStatus>('/storage/settings', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage'] });
    },
  });
}

export function useTestStorage() {
  return useMutation({
    mutationFn: (input: Partial<StorageSettingsInput>) => api.post<StorageTestResult>('/storage/test', input),
  });
}

export function useRefreshStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StorageStatus>('/storage/refresh', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage'] });
    },
  });
}
