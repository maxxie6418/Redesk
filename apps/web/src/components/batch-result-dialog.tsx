import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BatchResultRow {
  key: string;
  id?: number;
  title: string | null;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  sourceUrl: string | null;
  rating?: number | null;
  status: 'success' | 'skipped' | 'failed';
  error?: string | null;
  rawData?: Record<string, string>;
}

interface BatchResultDialogProps {
  title: string;
  subtitle: string;
  rows: BatchResultRow[];
  mode: 'import' | 'batch';
  onClose: () => void;
  onFetchInfo: (ids: number[]) => void;
  isFetching?: boolean;
  onDownloadFailed?: () => void;
  hideDownloadFailed?: boolean;
}

function Field({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className="truncate" title={value}>{value}</span>;
}

export function BatchResultDialog({
  title,
  subtitle,
  rows,
  mode,
  onClose,
  onFetchInfo,
  isFetching,
  onDownloadFailed,
  hideDownloadFailed,
}: BatchResultDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const selectableKeys = useMemo(
    () => rows.filter((row) => row.status !== 'failed').map((row) => row.key),
    [rows],
  );

  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selectedKeys.has(key));

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const key of selectableKeys) next.delete(key);
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const key of selectableKeys) next.add(key);
        return next;
      });
    }
  };

  const handleClear = () => {
    setSelectedKeys(new Set());
  };

  const handleToggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedIds = useMemo(
    () => rows.filter((row) => selectedKeys.has(row.key) && row.id != null).map((row) => row.id as number),
    [rows, selectedKeys],
  );

  const handleFetch = () => {
    if (selectedIds.length === 0) return;
    onFetchInfo(selectedIds);
  };

  const statusText = (row: BatchResultRow) => {
    if (row.status === 'success') return <span className="text-emerald-600">成功</span>;
    if (row.status === 'skipped') return <span className="text-amber-600">跳过</span>;
    return <span className="text-destructive">失败</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-medium text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm">全选</span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleClear}>
            清空选择
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {rows.filter((r) => r.status === 'success').length}</span>
            <span className="flex items-center gap-1"><SkipForward className="h-3.5 w-3.5 text-amber-600" /> {rows.filter((r) => r.status === 'skipped').length}</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {rows.filter((r) => r.status === 'failed').length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-medium text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-3 py-2 text-left">书名</th>
                <th className="px-3 py-2 text-left">作者</th>
                <th className="px-3 py-2 text-left">出版社</th>
                <th className="px-3 py-2 text-left">ISBN</th>
                {mode === 'batch' ? <th className="px-3 py-2 text-left">评分</th> : null}
                <th className="px-3 py-2 text-left">来源链接</th>
                <th className="px-3 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    row.status === 'failed' && 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20',
                  )}
                >
                  <td className="px-3 py-2.5">
                    {row.status !== 'failed' ? (
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(row.key)}
                        onChange={() => handleToggleRow(row.key)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    ) : null}
                  </td>
                  <td className="max-w-[160px] px-3 py-2.5 font-medium">
                    <Field value={row.title ?? (row.rawData ? '未命名' : null)} />
                    {row.error && row.status === 'failed' ? (
                      <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {row.error}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-[120px] px-3 py-2.5"><Field value={row.author} /></td>
                  <td className="max-w-[120px] px-3 py-2.5"><Field value={row.publisher} /></td>
                  <td className="max-w-[110px] px-3 py-2.5"><Field value={row.isbn} /></td>
                  {mode === 'batch' ? (
                    <td className="px-3 py-2.5">
                      {row.rating ? <span className="text-amber-600">★ {row.rating}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    {row.sourceUrl ? (
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        豆瓣 <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{statusText(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={selectedIds.length === 0 || isFetching}
            onClick={handleFetch}
            className="rounded-lg"
          >
            {isFetching ? '抓取中...' : '抓取信息'}
          </Button>
          <div className="flex items-center gap-2.5">
            {!hideDownloadFailed && onDownloadFailed ? (
              <Button type="button" variant="outline" size="sm" onClick={onDownloadFailed} className="rounded-lg">
                <Download className="mr-1 h-3.5 w-3.5" />
                下载失败记录
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-lg">
              关闭
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
