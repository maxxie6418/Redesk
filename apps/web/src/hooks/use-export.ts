import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/api';

export interface BackupItem {
  name: string;
  size_bytes: number;
  created_at: string;
}

export function useBackupList() {
  return useQuery({
    queryKey: ['backup', 'list'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/backup/list`, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return (json?.data ?? []) as BackupItem[];
    },
  });
}

export function triggerAutoBackup() {
  return fetch(`${API_BASE}/backup/trigger`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
}

export function triggerFullBackup() {
  return fetch(`${API_BASE}/backup/full`, { method: 'POST', credentials: 'include' });
}
