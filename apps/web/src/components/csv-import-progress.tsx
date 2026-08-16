import { AlertTriangle, CheckCircle2, Loader2, SkipForward, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CsvImportProgressData } from '@/lib/api';

export interface CsvImportProgressProps {
  progress: CsvImportProgressData;
  created: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  onCancel: () => void;
}

export function CsvImportProgress({ progress, created, skipped, failed, cancelled, onCancel }: CsvImportProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {cancelled ? (
            <span className="text-amber-600">导入已取消</span>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              正在导入…
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {progress.processed} / {progress.total}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full bg-primary transition-[width] duration-300', cancelled && 'bg-amber-500')}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>已完成 {percent}%</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {created}
          </span>
          <span className="flex items-center gap-1">
            <SkipForward className="h-3.5 w-3.5 text-amber-600" /> {skipped}
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {failed}
          </span>
        </div>
      </div>

      {!cancelled ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="truncate text-xs text-muted-foreground">
            {progress.title ? `正在处理：${progress.title}` : '正在解析行数据…'}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="rounded-lg">
            <Square className="mr-1.5 h-3.5 w-3.5" />
            取消导入
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-amber-600">已处理的行会保留，不会回滚；未处理的行已停止导入。</p>
      )}
    </div>
  );
}
