import { useQuery } from '@tanstack/react-query';

export interface BackupItem {
  name: string;
  size_bytes: number;
  created_at: string;
}

export function useBackupList() {
  return useQuery({
    queryKey: ['backup', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/v1/backup/list', { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return (json?.data ?? []) as BackupItem[];
    },
  });
}

export function triggerAutoBackup() {
  return fetch('/api/v1/backup/trigger', { method: 'POST', credentials: 'include' }).then((r) => r.json());
}

export function triggerFullBackup() {
  return fetch('/api/v1/backup/full', { method: 'POST', credentials: 'include' });
}
