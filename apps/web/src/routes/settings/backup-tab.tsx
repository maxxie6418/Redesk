import { useCallback } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBackupList, triggerAutoBackup, triggerFullBackup, type BackupItem } from '@/hooks/use-export';
import { API_BASE } from '@/lib/api';
import { CloudStorageCard } from './storage-tab';
import type { StatusMessage } from './types';

export function BackupTab({ settings: _settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const backupList = useBackupList();

  const handleAutoBackup = useCallback(async () => {
    try {
      await triggerAutoBackup();
      onToast({ type: 'info', text: '自动备份完成' });
      backupList.refetch();
    } catch {
      onToast({ type: 'error', text: '备份失败' });
    }
  }, [backupList, onToast]);

  const handleExportJson = useCallback(() => {
    window.open(`${API_BASE}/export/books?format=json`, '_self');
  }, []);

  const handleExportCsv = useCallback(() => {
    window.open(`${API_BASE}/export/books?format=csv`, '_self');
  }, []);

  const handleFullBackup = useCallback(async () => {
    try {
      const res = await triggerFullBackup();
      if (!res.ok) throw new Error('备份失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redesk-backup-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onToast({ type: 'info', text: '全量备份已下载' });
    } catch {
      onToast({ type: 'error', text: '全量备份失败' });
    }
  }, [onToast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">元数据导出</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">将全部书籍元数据导出为通用格式文件。</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              导出 JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              导出 CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">本地备份</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">全量备份（ZIP）</p>
            <p className="mb-3 text-sm text-muted-foreground">
              打包数据库 + 全部文件 + Markdown 副本为一键下载的 ZIP。
            </p>
            <Button variant="outline" size="sm" onClick={handleFullBackup}>
              <Download className="mr-2 h-4 w-4" />
              下载全量备份
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1.5 text-sm font-medium text-foreground">自动备份（SQLite VACUUM）</p>
            <p className="mb-3 text-sm text-muted-foreground">
              手动触发一次 SQLite 自动备份，最多保留 7 份。
            </p>
            <Button variant="outline" size="sm" onClick={handleAutoBackup}>
              立即备份
            </Button>
          </div>

          {backupList.data && backupList.data.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                已有 {backupList.data.length} 份备份
              </p>
              <div className="space-y-1">
                {backupList.data.slice(0, 5).map((b: BackupItem) => (
                  <div key={b.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="truncate text-foreground">{b.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(b.size_bytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CloudStorageCard onToast={onToast} />
    </div>
  );
}
