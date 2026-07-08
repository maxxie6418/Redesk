import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, RotateCcw, SkipForward, X } from 'lucide-react';
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
  onFetchInfo?: (ids: number[]) => void | Promise<void>;
  isFetching?: boolean;
  onDownloadFailed?: () => void;
  hideDownloadFailed?: boolean;
}

function Field({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className="truncate" title={value}>{value}</span>;
}

const STATUS_TEXT: Record<BatchResultRow['status'], React.ReactNode> = {
  success: <span className="text-emerald-600">成功</span>,
  skipped: <span className="text-amber-600">跳过</span>,
  failed: <span className="text-destructive">失败</span>,
};

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
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(selectableKeys));
    }
  };

  const handleClear = () => setSelectedKeys(new Set());

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
    if (selectedIds.length === 0 || !onFetchInfo) return;
    void onFetchInfo(selectedIds);
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

        {onFetchInfo ? (
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
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {rows.filter((r) => r.status === 'success').length}
              </span>
              <span className="flex items-center gap-1">
                <SkipForward className="h-3.5 w-3.5 text-amber-600" /> {rows.filter((r) => r.status === 'skipped').length}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {rows.filter((r) => r.status === 'failed').length}
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs font-medium text-muted-foreground">
              <tr>
                {onFetchInfo ? (
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleAll}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </th>
                ) : null}
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
                  {onFetchInfo ? (
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
                  ) : null}
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
                  <td className="px-3 py-2.5 text-xs">{STATUS_TEXT[row.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {onFetchInfo ? (
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
        ) : (
          <div className="flex items-center justify-end border-t border-border px-5 py-4">
            {!hideDownloadFailed && onDownloadFailed ? (
              <Button type="button" variant="outline" size="sm" onClick={onDownloadFailed} className="mr-2 rounded-lg">
                <Download className="mr-1 h-3.5 w-3.5" />
                下载失败记录
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-lg">
              关闭
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type FetchPhase = 'idle' | 'fetching' | 'preview' | 'applying' | 'done';

interface FetchRowState {
  status: 'pending' | 'fetching' | 'fetched' | 'error' | 'skipped' | 'applied' | 'unapplied';
  error?: string;
  willFill?: string[];
  filled?: string[];
}

export interface FetchPreviewRow {
  book_id: number;
  title: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  will_fill: string[];
  existing: string[];
}

export interface FetchApplyRow {
  book_id: number;
  success: boolean;
  error?: string;
  filled_fields: string[];
}

export interface BatchFetchResultDialogProps {
  title: string;
  subtitle: string;
  rows: BatchResultRow[];
  onClose: () => void;
  onPreview: (ids: number[]) => Promise<FetchPreviewRow[]>;
  onApply: (ids: number[]) => Promise<FetchApplyRow[]>;
}

const FIELD_LABELS: Record<string, string> = {
  title: '标题', author: '作者', subtitle: '副标题', isbn: 'ISBN',
  publisher: '出版社', publish_year: '出版年份', description: '描述',
  language: '语言', translator: '译者', original_title: '原书名', page_count: '页数',
};

function willFillText(willFill: string[]): string {
  if (willFill.length === 0) return '无新字段';
  return `将填充: ${willFill.map((f) => FIELD_LABELS[f] ?? f).join('、')}`;
}

export function BatchFetchResultDialog({
  title,
  subtitle,
  rows,
  onClose,
  onPreview,
  onApply,
}: BatchFetchResultDialogProps) {
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.id != null && r.status !== 'failed').map((r) => r.key)),
  );
  const [fetchStates, setFetchStates] = useState<Map<string, FetchRowState>>(new Map());
  const [aborted, setAborted] = useState(false);

  const selectableKeys = useMemo(
    () => rows.filter((row) => row.id != null && row.status !== 'failed').map((row) => row.key),
    [rows],
  );
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selectedKeys.has(key));

  const handleToggleAll = () => {
    if (allSelected) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(selectableKeys));
  };

  const handleToggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClear = () => setSelectedKeys(new Set());

  const handleStartFetch = async () => {
    const ids = rows.filter((r) => selectedKeys.has(r.key) && r.id != null).map((r) => r.id as number);
    if (ids.length === 0) return;

    setPhase('fetching');
    setAborted(false);
    const initialStates = new Map<string, FetchRowState>();
    for (const row of rows) {
      if (selectedKeys.has(row.key) && row.id != null) {
        initialStates.set(row.key, { status: 'pending' });
      }
    }
    setFetchStates(initialStates);

    const result = await onPreview(ids);
    if (aborted) return;

    const newStates = new Map<string, FetchRowState>();
    for (const item of result) {
      const rowKey = rows.find((r) => r.id === item.book_id)?.key;
      if (!rowKey) continue;
      if (item.skipped) {
        newStates.set(rowKey, { status: 'skipped', error: item.reason });
      } else if (!item.success) {
        newStates.set(rowKey, { status: 'error', error: item.error });
      } else {
        newStates.set(rowKey, { status: 'fetched', willFill: item.will_fill });
      }
    }
    setFetchStates(newStates);
    setPhase('preview');
  };

  const handleCancelFetch = () => {
    setAborted(true);
    setPhase('preview');
  };

  const previewableKeys = useMemo(() => {
    const keys: string[] = [];
    for (const [key, state] of fetchStates) {
      if (state.status === 'fetched' && (state.willFill ?? []).length > 0) {
        keys.push(key);
      }
    }
    return keys;
  }, [fetchStates]);

  const handleApplySelectAll = () => {
    setSelectedKeys(new Set(previewableKeys));
  };

  const handleApply = async () => {
    const ids = rows.filter((r) => selectedKeys.has(r.key) && r.id != null).map((r) => r.id as number);
    if (ids.length === 0) return;

    setPhase('applying');
    const newStates = new Map(fetchStates);
    for (const id of ids) {
      const key = rows.find((r) => r.id === id)?.key;
      if (key) {
        newStates.set(key, { ...newStates.get(key)!, status: 'fetched' });
      }
    }
    setFetchStates(newStates);

    const result = await onApply(ids);
    const appliedStates = new Map(fetchStates);
    for (const item of result) {
      const key = rows.find((r) => r.id === item.book_id)?.key;
      if (!key) continue;
      if (item.success) {
        appliedStates.set(key, { status: 'applied', filled: item.filled_fields });
      } else {
        appliedStates.set(key, { status: 'error', error: item.error });
      }
    }
    setFetchStates(appliedStates);
    setPhase('done');
  };

  const handleRetryFailed = () => {
    const failedKeys = new Set<string>();
    for (const [key, state] of fetchStates) {
      if (state.status === 'error') failedKeys.add(key);
    }
    setSelectedKeys(failedKeys);
    setPhase('idle');
    void handleStartFetch();
  };

  const successCount = useMemo(() => {
    let n = 0;
    for (const s of fetchStates.values()) if (s.status === 'fetched' || s.status === 'applied') n++;
    return n;
  }, [fetchStates]);
  const errorCount = useMemo(() => {
    let n = 0;
    for (const s of fetchStates.values()) if (s.status === 'error') n++;
    return n;
  }, [fetchStates]);
  const skippedCount = useMemo(() => {
    let n = 0;
    for (const s of fetchStates.values()) if (s.status === 'skipped') n++;
    return n;
  }, [fetchStates]);

  const totalToProcess = useMemo(() => {
    let n = 0;
    for (const row of rows) if (row.id != null && selectedKeys.has(row.key)) n++;
    return n;
  }, [rows, selectedKeys]);
  const processedCount = useMemo(() => {
    let n = 0;
    for (const s of fetchStates.values()) {
      if (s.status !== 'pending' && s.status !== 'fetching') n++;
    }
    return n;
  }, [fetchStates]);
  const progressPercent = totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  const headerTitle = useMemo(() => {
    if (phase === 'fetching') return '正在抓取信息…';
    if (phase === 'preview') return '抓取完成 - 确认更新';
    if (phase === 'applying') return '正在应用…';
    if (phase === 'done') return '已应用';
    return title;
  }, [phase, title]);

  const headerSubtitle = useMemo(() => {
    if (phase === 'fetching') {
      return `进度 ${processedCount}/${totalToProcess}`;
    }
    if (phase === 'preview') {
      return `成功 ${successCount}，失败 ${errorCount}，跳过 ${skippedCount}。勾选要更新的书后点确认。`;
    }
    if (phase === 'done') {
      return `已应用 ${rows.filter((r) => fetchStates.get(r.key)?.status === 'applied').length} 本。`;
    }
    return subtitle;
  }, [phase, processedCount, totalToProcess, successCount, errorCount, skippedCount, rows, fetchStates, subtitle]);

  const getRowDisplay = (row: BatchResultRow): { icon: React.ReactNode; text: React.ReactNode; checkable: boolean; checked: boolean } => {
    const state = fetchStates.get(row.key);
    const checked = selectedKeys.has(row.key);

    if (state?.status === 'applied') {
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        text: (state.filled ?? []).length > 0 ? `已更新 ${state.filled!.length} 个字段` : '无新字段',
        checkable: false,
        checked: false,
      };
    }
    if (state?.status === 'error') {
      return { icon: <AlertTriangle className="h-4 w-4 text-destructive" />, text: state.error ?? '抓取失败', checkable: false, checked: false };
    }
    if (state?.status === 'skipped') {
      return { icon: <SkipForward className="h-4 w-4 text-amber-600" />, text: state.error ?? '跳过', checkable: false, checked: false };
    }

    if (phase === 'idle') {
      if (row.status === 'failed') return { icon: <AlertTriangle className="h-4 w-4 text-destructive" />, text: '失败', checkable: false, checked: false };
      return { icon: null, text: '—', checkable: true, checked };
    }
    if (phase === 'fetching') {
      if (!state) return { icon: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />, text: '等待中', checkable: false, checked: false };
      if (state.status === 'pending') return { icon: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />, text: '等待中', checkable: false, checked: false };
      if (state.status === 'fetching') return { icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />, text: '抓取中', checkable: false, checked: false };
    }
    if (state?.status === 'fetched') {
      return { icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, text: willFillText(state.willFill ?? []), checkable: (state.willFill ?? []).length > 0, checked };
    }
    return { icon: null, text: '—', checkable: false, checked: false };
  };

  const footerPrimary = useMemo(() => {
    if (phase === 'idle') {
      const selectedIds = rows.filter((r) => selectedKeys.has(r.key) && r.id != null).length;
      return {
        text: selectedIds > 0 ? `开始抓取 (${selectedIds})` : '请先选择要抓取的书',
        disabled: selectedIds === 0,
        onClick: () => void handleStartFetch(),
      };
    }
    if (phase === 'fetching') {
      return { text: '取消', disabled: false, onClick: handleCancelFetch };
    }
    if (phase === 'preview') {
      const selectedIds = rows.filter((r) => selectedKeys.has(r.key) && r.id != null).length;
      return {
        text: selectedIds > 0 ? `确认更新 (${selectedIds})` : '请勾选要更新的书',
        disabled: selectedIds === 0,
        onClick: () => void handleApply(),
      };
    }
    if (phase === 'done') {
      return { text: '完成', disabled: false, onClick: onClose };
    }
    return { text: '处理中…', disabled: true, onClick: () => {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedKeys, rows, onClose]);

  const showRetry = phase === 'done' && errorCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-10"
      onClick={phase === 'fetching' || phase === 'applying' ? () => {} : onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-medium text-foreground">{headerTitle}</h3>
            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>
          {phase !== 'fetching' && phase !== 'applying' ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {phase === 'fetching' || phase === 'applying' ? (
          <div className="border-b border-border bg-muted/50 px-5 py-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{processedCount} / {totalToProcess}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {successCount}
                </span>
                {errorCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {errorCount}
                  </span>
                ) : null}
                {skippedCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <SkipForward className="h-3.5 w-3.5 text-amber-600" /> {skippedCount}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              disabled={phase === 'done'}
            />
            <span className="text-sm">全选</span>
            {phase === 'preview' ? (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplySelectAll}>
                选所有可更新
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleClear} disabled={phase === 'done'}>
              清空选择
            </Button>
            <div className="flex-1" />
            {successCount + errorCount + skippedCount > 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {successCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {successCount}
                  </span>
                ) : null}
                {errorCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {errorCount}
                  </span>
                ) : null}
                {skippedCount > 0 ? (
                  <span className="flex items-center gap-1">
                    <SkipForward className="h-3.5 w-3.5 text-amber-600" /> {skippedCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

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
                    disabled={phase === 'fetching' || phase === 'applying' || phase === 'done'}
                  />
                </th>
                <th className="px-3 py-2 text-left">书名</th>
                <th className="px-3 py-2 text-left">作者</th>
                <th className="px-3 py-2 text-left">来源链接</th>
                <th className="px-3 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const display = getRowDisplay(row);
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      'border-b border-border transition-colors',
                      display.checkable && 'hover:bg-muted/30',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      {display.checkable ? (
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.key)}
                          onChange={() => handleToggleRow(row.key)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      ) : null}
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 font-medium">
                      <span className="line-clamp-1" title={row.title ?? ''}>{row.title ?? '—'}</span>
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5">
                      <span className="truncate text-muted-foreground">{row.author ?? '—'}</span>
                    </td>
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
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        {display.icon}
                        <span>{display.text}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          {showRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={handleRetryFailed}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重新抓取失败项
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2.5">
            {phase !== 'fetching' && phase !== 'applying' ? (
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-lg">
                {phase === 'done' ? '关闭' : '取消'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={footerPrimary.disabled}
              onClick={footerPrimary.onClick}
              className="rounded-lg"
            >
              {(phase === 'fetching' || phase === 'applying') ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {footerPrimary.text}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
