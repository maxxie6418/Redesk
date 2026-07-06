import { useEffect, useMemo, useState } from 'react';
import { Check, CloudUpload, Loader2, RefreshCcw, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BatchImportPanel } from '@/components/batch-import-panel';
import { useBatchBooks, useBooks, type BookSummary } from '@/hooks/use-books';
import { useBatchSendFilesToCloud, useFileLibrary, type BookFileItem } from '@/hooks/use-files';
import { BatchUploadMatchCard } from './batch-upload-card';
import type { StatusMessage } from './types';

function BatchBookActionsCard({
  initialBookIds,
  onToast,
}: {
  initialBookIds: number[];
  onToast: (msg: StatusMessage) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const booksQuery = useBooks({ q: search.trim() || undefined, page_size: 120, sort: '-updated_at' });
  const batchBooks = useBatchBooks();

  useEffect(() => {
    if (initialBookIds.length === 0) return;
    setSelectedIds((current) => [...new Set([...current, ...initialBookIds])]);
  }, [initialBookIds]);

  const books = booksQuery.data?.data ?? [];

  const toggleBook = (bookId: number) => {
    setSelectedIds((current) => (current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]));
  };

  const selectVisible = () => {
    setSelectedIds((current) => [...new Set([...current, ...books.map((book) => book.id)])]);
  };

  const clearSelected = () => {
    setSelectedIds([]);
  };

  const runAction = async (action: 'fetch_metadata' | 'fetch_cover') => {
    if (selectedIds.length === 0) {
      onToast({ type: 'warning', text: '请先选择要处理的书籍' });
      return;
    }

    try {
      await batchBooks.mutateAsync({ ids: selectedIds, action });
      onToast({ type: 'info', text: action === 'fetch_metadata' ? '已提交批量抓取信息' : '已提交批量更新封面' });
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '批量处理失败' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">批量更新与抓取</CardTitle>
        <CardDescription>集中处理书籍信息抓取、封面更新等系统级批量操作。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索要批量处理的书籍" className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={selectVisible} disabled={books.length === 0}>
            选择当前结果
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelected} disabled={selectedIds.length === 0}>
            清空选择
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
          <span className="text-sm text-muted-foreground">已选 {selectedIds.length} 本书</span>
          <Button variant="outline" size="sm" onClick={() => void runAction('fetch_metadata')} disabled={batchBooks.isPending || selectedIds.length === 0}>
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            抓取信息
          </Button>
          <Button variant="outline" size="sm" onClick={() => void runAction('fetch_cover')} disabled={batchBooks.isPending || selectedIds.length === 0}>
            <Upload className="mr-1.5 h-4 w-4" />
            更新封面
          </Button>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
          {booksQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">正在加载书籍…</div>
          ) : books.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">当前没有可处理的书籍。</div>
          ) : (
            books.map((book: BookSummary) => {
              const selected = selectedIds.includes(book.id);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => toggleBook(book.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{book.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[book.author, book.category_name, book.source_url ? '有来源链接' : '无来源链接'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BatchCloudSyncCard({
  cloudAvailable,
  onToast,
}: {
  cloudAvailable: boolean;
  onToast: (msg: StatusMessage) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const filesQuery = useFileLibrary({ page: 1, page_size: 200 });
  const sendToCloud = useBatchSendFilesToCloud();

  const candidates = useMemo(() => {
    const items = filesQuery.data?.data ?? [];
    return items.filter((file: BookFileItem) => file.local_path && (file.storage_mode === 'local_only' || file.sync_status !== 'synced'));
  }, [filesQuery.data]);

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
          {filesQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">正在扫描文件…</div>
          ) : candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">当前没有需要补发到云端的文件。</div>
          ) : (
            candidates.map((file) => {
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
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BatchTab({
  settings,
  initialBookIds,
  onToast,
}: {
  settings: Record<string, string>;
  initialBookIds: number[];
  onToast: (msg: StatusMessage) => void;
}) {
  const defaultMode = (settings.default_storage_mode as 'local_only' | 'cloud_only' | 'dual') || 'local_only';
  const cloudAvailable = settings.storage_driver === 's3' || Boolean(settings.oss_bucket);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">批量管理</CardTitle>
          <CardDescription>管理员专用。集中承接批量上传、批量导入、批量更新、批量抓取和发送到对象存储等操作。</CardDescription>
        </CardHeader>
      </Card>

      <BatchUploadMatchCard defaultMode={defaultMode} cloudAvailable={cloudAvailable} onToast={onToast} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">批量导入书籍</CardTitle>
          <CardDescription>通过 CSV 批量创建书籍，仅写入元数据，不包含文件内容。</CardDescription>
        </CardHeader>
        <CardContent>
          <BatchImportPanel variant="embedded" />
        </CardContent>
      </Card>

      <BatchBookActionsCard initialBookIds={initialBookIds} onToast={onToast} />
      <BatchCloudSyncCard cloudAvailable={cloudAvailable} onToast={onToast} />
    </div>
  );
}
