import { useEffect, useMemo, useState } from 'react';
import { Check, CloudUpload, Loader2, Upload, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BatchImportPanel } from '@/components/batch-import-panel';
import { useBatchSendFilesToCloud, useFileLibrary, type BookFileItem } from '@/hooks/use-files';
import { BatchUploadMatchCard } from './batch-upload-card';
import type { StatusMessage } from './types';

const BATCH_PAGE_SIZE = 50;

function BatchCloudSyncCard({
  cloudAvailable,
  onToast,
}: {
  cloudAvailable: boolean;
  onToast: (msg: StatusMessage) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [loadedFiles, setLoadedFiles] = useState<BookFileItem[]>([]);
  const filesQuery = useFileLibrary({ page, page_size: BATCH_PAGE_SIZE });
  const sendToCloud = useBatchSendFilesToCloud();

  useEffect(() => {
    const nextFiles = filesQuery.data?.data;
    if (!nextFiles) return;
    setLoadedFiles((current) => (page === 1 ? nextFiles : [...current, ...nextFiles.filter((file) => !current.some((item) => item.id === file.id))]));
  }, [filesQuery.data?.data, page]);

  const candidates = useMemo(() => {
    return loadedFiles.filter((file: BookFileItem) => file.local_path && (file.storage_mode === 'local_only' || file.sync_status !== 'synced'));
  }, [loadedFiles]);

  const total = filesQuery.data?.pagination.total;
  const hasMore = total != null && loadedFiles.length < total;
  const isFetchingMore = filesQuery.isFetching && page > 1;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => candidates.some((file) => file.id === id)));
  }, [candidates]);

  const toggleFile = (fileId: number) => {
    setSelectedIds((current) => (current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]));
  };

  const selectAll = () => {
    setSelectedIds(candidates.map((file) => file.id));
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      onToast({ type: 'warning', text: '请先选择要发送到云端的文件' });
      return;
    }

    try {
      const result = await sendToCloud.mutateAsync(selectedIds);
      if (result.failed_count > 0) {
        onToast({ type: 'warning', text: `已同步 ${result.success_count} 个文件，另有 ${result.failed_count} 个失败` });
        return;
      }
      onToast({ type: 'info', text: `已同步 ${result.success_count} 个文件到云端` });
      setSelectedIds([]);
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '发送到云端失败' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">发送到 OSS / R2</CardTitle>
        <CardDescription>把已有本地文件补发到云端，用于修复历史未真正写入对象存储的记录。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!cloudAvailable ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            请先在“存储”页完成云端配置，再执行补发。
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
          <span className="text-sm text-muted-foreground">待补发 {candidates.length} 个文件，已选 {selectedIds.length} 个</span>
          <Button variant="outline" size="sm" onClick={selectAll} disabled={candidates.length === 0}>
            全选待补发
          </Button>
          <Button size="sm" onClick={() => void handleSend()} disabled={!cloudAvailable || sendToCloud.isPending || selectedIds.length === 0}>
            {sendToCloud.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-1.5 h-4 w-4" />}
            发送到云端
          </Button>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
          {filesQuery.isLoading && page === 1 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">正在扫描文件…</div>
          ) : candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">当前没有需要补发到云端的文件。</div>
          ) : (
            <>
              {candidates.map((file) => {
                const selected = selectedIds.includes(file.id);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggleFile(file.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{file.original_filename ?? `文件 #${file.id}`}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[file.book_title ?? '未关联书籍', file.storage_mode, file.sync_status].join(' · ')}
                      </div>
                    </div>
                  </button>
                );
              })}
              {hasMore ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setPage((value) => value + 1)} disabled={isFetchingMore}>
                  {isFetchingMore ? '正在加载下一页...' : '加载更多'}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BatchTab({
  settings,
  onToast,
}: {
  settings: Record<string, string>;
  onToast: (msg: StatusMessage) => void;
}) {
  const defaultMode = (settings.default_storage_mode as 'local_only' | 'cloud_only' | 'dual') || 'local_only';
  const cloudAvailable = settings.storage_driver === 's3' || Boolean(settings.oss_bucket);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">批量添加</CardTitle>
          <CardDescription>管理员专用。批量上传文件、CSV批量添加、批量抓取等。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Upload className="h-4 w-4 text-primary" />
                上传书籍文件
              </div>
              <div className="flex-1">
                <BatchUploadMatchCard
                  defaultMode={defaultMode}
                  cloudAvailable={cloudAvailable}
                  onToast={onToast}
                  inline
                />
              </div>
            </div>
            <div className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 pr-32 text-sm font-medium text-foreground">
                <UploadCloud className="h-4 w-4 text-primary" />
                导入 CSV 书单
              </div>
              <div className="flex-1">
                <BatchImportPanel variant="plain" hideFooter />
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <BatchCloudSyncCard cloudAvailable={cloudAvailable} onToast={onToast} />
    </div>
  );
}
