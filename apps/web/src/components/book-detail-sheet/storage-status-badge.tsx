import { Cloud } from 'lucide-react';
import type { BookFileItem } from '@/hooks/use-files';
import { STORAGE_MODE_LABELS } from './types';

export function StorageStatusBadge({ file }: { file: BookFileItem }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Cloud className="h-3 w-3" />
      {file.sync_status === 'pending' ? (
        <span>同步中</span>
      ) : file.sync_status === 'partial_failed' || file.sync_status === 'failed' ? (
        <span className="text-destructive">同步失败</span>
      ) : (
        <span>{STORAGE_MODE_LABELS[file.storage_mode]}</span>
      )}
    </span>
  );
}
