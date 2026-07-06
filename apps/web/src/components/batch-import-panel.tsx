import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, X, CheckCircle2, SkipForward } from 'lucide-react';
import { ApiError, api, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';

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
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportBooksResult | null>(null);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const failedRows = result?.rows.filter((row) => !row.success && !row.skipped) ?? [];
  const skippedRows = result?.rows.filter((row) => row.skipped) ?? [];

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

  function RowItem({ row, tone }: { row: ImportBooksResultRow; tone: 'skipped' | 'failed' }) {
    return (
      <div className="border-b border-border px-3 py-2 text-xs last:border-b-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">第 {row.row} 行</span>
          <span className="truncate text-muted-foreground">{row.title ?? '未命名'}</span>
        </div>
        <div className={`mt-1 flex items-center gap-1 ${tone === 'failed' ? 'text-destructive' : 'text-amber-600'}`}>
          {tone === 'failed' ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <SkipForward className="h-3 w-3 shrink-0" />
          )}
          {row.error}
        </div>
      </div>
    );
  }

  const body = (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="text-sm font-medium text-foreground">CSV 模板</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          模板包含书名、作者、ISBN、分类、标签、状态、评分等字段。导入只创建书籍元数据，不包含文件。
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            window.location.href = `${API_BASE}/books/import/template`;
          }}
        >
          下载参考 CSV
        </Button>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-foreground">选择已填写的 CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </label>

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

      {result && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-foreground">
                共处理 {result.total} 行
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {result.dry_run ? '校验通过' : '成功创建'}：{result.dry_run ? result.valid : result.created}
                </span>
                {skippedRows.length > 0 && (
                  <span className="flex items-center gap-1">
                    <SkipForward className="h-3.5 w-3.5 text-amber-600" />
                    跳过（重复）：{skippedRows.length}
                  </span>
                )}
                {failedRows.length > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    失败：{failedRows.length}
                  </span>
                )}
              </div>
            </div>
            {failedRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadFailedCsv}
                className="shrink-0"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                下载失败记录
              </Button>
            )}
          </div>

          {failedRows.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-destructive">失败记录</div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {failedRows.slice(0, 20).map((row) => (
                  <RowItem key={row.row} row={row} tone="failed" />
                ))}
                {failedRows.length > 20 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    还有 {failedRows.length - 20} 条失败记录，可下载完整 CSV 查看
                  </div>
                )}
              </div>
            </div>
          )}

          {skippedRows.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-amber-600">跳过记录（重复）</div>
              <div className="max-h-36 overflow-y-auto rounded-md border border-border">
                {skippedRows.slice(0, 10).map((row) => (
                  <RowItem key={row.row} row={row} tone="skipped" />
                ))}
                {skippedRows.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    还有 {skippedRows.length - 10} 条跳过记录
                  </div>
                )}
              </div>
            </div>
          )}
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

  if (variant === 'embedded') {
    return <div className="rounded-xl border border-border bg-card">{body}</div>;
  }

  return (
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
  );
}
