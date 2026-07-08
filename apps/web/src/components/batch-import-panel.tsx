import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, UploadCloud, X } from 'lucide-react';
import { ApiError, api, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  useBatchPreviewMetadata,
  useBatchApplyMetadata,
  type BatchPreviewRow,
  type BatchApplyRow,
} from '@/hooks/use-books';
import {
  BatchResultDialog,
  BatchFetchResultDialog,
  type BatchResultRow,
} from '@/components/batch-result-dialog';

interface ImportBooksResultRow {
  row: number;
  title: string | null;
  success: boolean;
  skipped: boolean;
  book_id: number | null;
  error: string | null;
  raw_data: Record<string, string>;
}

interface ImportBooksResult {
  dry_run: boolean;
  total: number;
  created: number;
  valid: number;
  skipped: number;
  failed: number;
  rows: ImportBooksResultRow[];
}

export interface BatchImportPanelProps {
  variant?: 'embedded' | 'dialog';
  onClose?: () => void;
}

export function BatchImportPanel({ variant = 'dialog', onClose }: BatchImportPanelProps) {
  const qc = useQueryClient();
  const previewMetadata = useBatchPreviewMetadata();
  const applyMetadata = useBatchApplyMetadata();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportBooksResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFetchDialog, setShowFetchDialog] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  const importCsv = async () => {
    if (!file) {
      setError('请先选择 CSV 文件');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api.postForm<ImportBooksResult>(`/books/import${dryRun ? '?dry_run=true' : ''}`, form);
      setResult(data);
      if (!dryRun) {
        qc.invalidateQueries({ queryKey: ['books'] });
        qc.invalidateQueries({ queryKey: ['categories'] });
        qc.invalidateQueries({ queryKey: ['tags'] });
      }
      setShowImportDialog(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const failedRows = result?.rows.filter((row) => !row.success && !row.skipped) ?? [];

  function csvEscape(value: unknown): string {
    if (value == null) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadFailedCsv() {
    if (!result || failedRows.length === 0) return;
    const sampleRow = failedRows.find((r) => r.raw_data && Object.keys(r.raw_data).length > 0);
    const headers = sampleRow?.raw_data ? Object.keys(sampleRow.raw_data) : ['title', 'error'];
    const errorHeader = 'import_error';
    const allHeaders = [...headers, errorHeader];
    const lines = [allHeaders.join(',')];
    for (const row of failedRows) {
      const values = headers.map((h) => csvEscape(row.raw_data?.[h] ?? ''));
      values.push(csvEscape(row.error));
      lines.push(values.join(','));
    }
    const csv = `\uFEFF${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redesk-import-failed-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const dialogRows: BatchResultRow[] =
    result?.rows.map((row) => {
      const raw = row.raw_data ?? {};
      const status = row.success ? 'success' : row.skipped ? 'skipped' : 'failed';
      return {
        key: `${row.row}`,
        id: row.book_id ?? undefined,
        title: row.title ?? raw.title ?? raw['书名'] ?? null,
        author: raw.author ?? raw['作者'] ?? null,
        publisher: raw.publisher ?? raw['出版社'] ?? null,
        isbn: raw.isbn ?? raw['ISBN'] ?? null,
        sourceUrl: raw.source_url ?? raw['来源链接'] ?? raw['豆瓣链接'] ?? null,
        status,
        error: row.error,
        rawData: raw,
      };
    }) ?? [];

  const handleTransitionToFetch = () => {
    setShowImportDialog(false);
    setShowFetchDialog(true);
  };

  const handlePreview = async (ids: number[]): Promise<BatchPreviewRow[]> => {
    const rows = await previewMetadata.mutateAsync(ids);
    return rows;
  };

  const handleApply = async (ids: number[]): Promise<BatchApplyRow[]> => {
    const rows = await applyMetadata.mutateAsync(ids);
    qc.invalidateQueries({ queryKey: ['books'] });
    return rows;
  };

  const uploadArea = (
    <label className="group flex flex-1 min-w-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/10">
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <UploadCloud className="mb-2 h-8 w-8 text-primary" />
      <div className="text-sm font-medium text-primary">{file ? file.name : '点击上传已填写的 CSV'}</div>
      <div className="mt-1 text-xs text-muted-foreground">支持 .csv 格式</div>
    </label>
  );

  const templateArea = (
    <div className="flex flex-[0.85] min-w-[220px] flex-col justify-between rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <div className="text-sm font-medium text-foreground">CSV 模板</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          包含书名、作者、ISBN、分类、标签、状态、评分等字段。导入只创建元数据，不包含文件。
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => {
          window.location.href = `${API_BASE}/books/import/template`;
        }}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        下载参考 CSV
      </Button>
    </div>
  );

  const body = (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-stretch gap-4">
          {uploadArea}
          {templateArea}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span>仅校验不导入（预览模式）</span>
      </label>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive dark:border-destructive/30 dark:bg-destructive/15">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2.5 border-t border-border pt-5">
        {variant === 'dialog' && onClose ? (
          <Button type="button" variant="outline" onClick={onClose}>
            关闭
          </Button>
        ) : null}
        <Button type="button" onClick={importCsv} disabled={submitting}>
          {submitting ? (dryRun ? '校验中...' : '导入中...') : dryRun ? '开始校验' : '开始导入'}
        </Button>
      </div>
    </div>
  );

  const panel = variant === 'embedded' ? <div className="rounded-xl border border-border bg-card">{body}</div> : null;

  const dialog = variant === 'dialog' ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">批量导入书籍</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {body}
      </div>
    </div>
  ) : null;

  return (
    <>
      {panel}
      {dialog}
      {showImportDialog && result ? (
        <BatchResultDialog
          title={dryRun ? '校验结果' : '导入结果'}
          subtitle={`共 ${result.total} 行 · 成功 ${result.created || result.valid} · 跳过 ${result.skipped} · 失败 ${result.failed}`}
          rows={dialogRows}
          mode="import"
          onClose={() => {
            setShowImportDialog(false);
            setResult(null);
            setFile(null);
          }}
          onFetchInfo={() => {
            handleTransitionToFetch();
          }}
          isFetching={false}
          onDownloadFailed={failedRows.length > 0 ? downloadFailedCsv : undefined}
        />
      ) : null}
      {showFetchDialog && result ? (
        <BatchFetchResultDialog
          title="抓取书籍信息"
          subtitle="抓取后请勾选要更新的书并确认。"
          rows={dialogRows}
          onClose={() => {
            setShowFetchDialog(false);
            setResult(null);
            setFile(null);
          }}
          onPreview={handlePreview}
          onApply={handleApply}
        />
      ) : null}
    </>
  );
}
