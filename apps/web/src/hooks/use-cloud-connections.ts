import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CloudConnectionType = 's3' | 'webdav';
export type CloudUsage = 'book_files' | 'covers' | 'notes' | 'backup_db' | 'backup_full';

export interface CloudConnection {
  id: number;
  name: string;
  type: CloudConnectionType;
  config: Record<string, string | null>;
  is_active: boolean;
  tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudAssignment { id: number; usage: CloudUsage; connection_id: number; priority: number; }

const KEY = ['cloud-connections'];

export function useCloudConnections() { return useQuery({ queryKey: KEY, queryFn: () => api.get<CloudConnection[]>('/cloud-connections') }); }
export function useCloudAssignments() { return useQuery({ queryKey: ['cloud-assignments'], queryFn: () => api.get<CloudAssignment[]>('/cloud-assignments') }); }

export function useCreateCloudConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: unknown) => api.post<CloudConnection>('/cloud-connections', input), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useTestCloudConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api.post<{ ok: boolean; tested_at: string }>(`/cloud-connections/${id}/test`), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export function useTestCloudConfig() {
  return useMutation({ mutationFn: (input: { type: CloudConnectionType; config: Record<string, unknown> }) => api.post<{ ok: boolean }>('/cloud-connections/test-config', input) });
}
export function useToggleCloudConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api.post<CloudConnection>(`/cloud-connections/${id}/toggle`), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export function useDeleteCloudConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api.delete<{ id: number; deleted: boolean }>(`/cloud-connections/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['cloud-assignments'] }); } });
}
export function useSaveCloudAssignments() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (assignments: Array<{ usage: CloudUsage; connection_ids: number[] }>) => api.put('/cloud-assignments', { assignments }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cloud-assignments'] }); qc.invalidateQueries({ queryKey: ['storage'] }); } });
}
export function useSnapshotNotes() { return useMutation({ mutationFn: () => api.post<{ note_count: number }>('/cloud-sync/notes/snapshot') }); }
export function useCloudDatabaseBackup() { return useMutation({ mutationFn: () => api.post<{ completed: unknown[]; failed: unknown[] }>('/cloud-backup/database') }); }
