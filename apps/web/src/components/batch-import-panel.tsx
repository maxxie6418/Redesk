import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, UploadCloud, X } from 'lucide-react';
import { ApiError, api, API_BASE, runCsvImportStream, type CsvImportProgressData } from '@/lib/api';
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
import { CsvImportPreview, type CsvPreviewRow, type CsvPreviewSummary } from '@/components/csv-import-preview';
import { CsvImportProgress } from '@/components/csv-import-progress';

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
  variant?: 'embedded' | 'dialog' | 'plain';
  onClose?: () => void;
  hideFooter?: boolean;
}

type ImportStep = 'pick' | 'preview' | 'importing' | 'done';

export function BatchImportPanel({ variant = 'dialog', onClose, hideFooter = false }: BatchImportPanelProps) {
  const qc = useQueryClient();
  const previewMetadata = useBatchPreviewMetadata();
  const applyMetadata = useBatchApplyMetadata();
  const [step, setStep] = useState<ImportStep>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportBooksResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState<CsvImportProgressData | null>(null);
  const [result, setResult] = useState<ImportBooksResult | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [showFetchDialog, setShowFetchDialog] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const progressRowsRef = useRef<Map<number, CsvImportProgressData>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    progressRowsRef.current = new Map();
    setStep('pick');
    setFile(null);
    setPreview(null);
    setProgress(null);
    setResult(null);
    setCancelled(false);
    setError('');
  };

  const runPreview = async (nextFile: File) => {
    setPreviewing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', nextFile);
      const data = await api.postForm<ImportBooksResult>('/books/import?dry_run=true', form);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : '预览失败');
      setStep('pick');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSelectFile = (nextFile: File | null) => {
    if (abortRef.current) return;
    if (!nextFile) return;
    setFile(nextFile);
    progressRowsRef.current = new Map();
    void runPreview(nextFile);
  };

  const buildResultRows = (): ImportBooksResult => {
    const base = preview!;
    const rows = base.rows.map((row) => {
      const prog = progressRowsRef.current.get(row.row);
      if (!prog) return row;
      return {
        ...row,
        success: prog.status === 'created',
        skipped: prog.status === 'skipped',
        book_id: prog.book_id,
        error: prog.error ?? row.error,
      };
    });
    const created = rows.filter((row) => row.success && row.book_id != null).length;
    const skipped = rows.filter((row) => row.skipped).length;
    const failed = rows.filter((row) => !row.success && !row.skipped).length;
    return { dry_run: false, total: base.total, created, valid: created, skipped, failed, rows };
  };

  const handleConfirmImport = async () => {
    if (!file || !preview) return;
    setError('');
    setCancelled(false);
    setStep('importing');
    setProgress({ processed: 0, total: preview.total, row: 0, title: null, status: 'created', error: null, book_id: null });
    progressRowsRef.current = new Map();

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const complete = await runCsvImportStream({
        file,
        signal: abort.signal,
        onProgress: (data) => {
          progressRowsRef.current.set(data.row, data);
          setProgress(data);
        },
      });
      setResult(buildResultRows());
      setCancelled(complete.cancelled);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['tags'] });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setResult(buildResultRows());
        setCancelled(true);
        setStep('done');
        qc.invalidateQueries({ queryKey: ['books'] });
        qc.invalidateQueries({ queryKey: ['categories'] });
        qc.invalidateQueries({ queryKey: ['tags'] });
      } else if (err instanceof ApiError) {
        setError(err.message);
        setStep('preview');
      } else {
        setError(err instanceof Error ? err.message : '导入失败');
        setStep('preview');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancelImport = () => {
    abortRef.current?.abort();
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
    setShowFetchDialog(true);
  };

  const handlePreview = async (ids: number[]): Promise<BatchPreviewRow[]> => {
    const rows = await previewMetadata.mutateAsync(ids);
    return rows;
  };

  const handleApply = async (ids: number[], fields?: string[]): Promise<BatchApplyRow[]> => {
    const rows = await applyMetadata.mutateAsync({ ids, fields });
    qc.invalidateQueries({ queryKey: ['books'] });
    return rows;
  };

  const uploadArea = (
    <label className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/10">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => handleSelectFile(event.target.files?.[0] ?? null)}
      />
      <UploadCloud className="mb-2 h-8 w-8 text-primary" />
      <div className="text-sm font-medium text-primary">{file ? file.name : '点击上传已填写的 CSV'}</div>
      <div className="mt-1 text-xs text-muted-foreground">选择文件后将自动预览导入内容</div>
    </label>
  );

  const pickContent = (
    <>
      {variant === 'plain' ? uploadArea : (
        <div className="rounded-lg border border-border bg-card p-4">
          {uploadArea}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive dark:border-destructive/30 dark:bg-destructive/15">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {previewing && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          正在解析并预览…
        </div>
      )}

      {variant === 'plain' ? (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = `${API_BASE}/books/import/template`; }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            下载模板
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetAll} disabled={!file}>
            清除选择
          </Button>
        </div>
      ) : null}

      {!hideFooter && variant !== 'plain' ? (
        <div className="flex justify-end gap-2.5 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => { window.location.href = `${API_BASE}/books/import/template`; }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            下载 CSV 模板
          </Button>
          {variant === 'dialog' && onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const previewSummary: CsvPreviewSummary | null = preview
    ? { total: preview.total, valid: preview.valid, skipped: preview.skipped, failed: preview.failed }
    : null;

  const previewRows: CsvPreviewRow[] = preview?.rows ?? [];

  const innerContent = (
    <>
      {step === 'pick' ? pickContent : null}

      {step === 'preview' && preview ? (
        <CsvImportPreview
          rows={previewRows}
          summary={previewSummary!}
          onConfirm={() => void handleConfirmImport()}
          onBack={() => {
            setPreview(null);
            setError('');
            setStep('pick');
          }}
        />
      ) : null}

      {step === 'importing' && progress ? (
        <CsvImportProgress
          progress={progress}
          created={Array.from(progressRowsRef.current.values()).filter((p) => p.status === 'created').length}
          skipped={Array.from(progressRowsRef.current.values()).filter((p) => p.status === 'skipped').length}
          failed={Array.from(progressRowsRef.current.values()).filter((p) => p.status === 'failed').length}
          cancelled={cancelled}
          onCancel={handleCancelImport}
        />
      ) : null}
    </>
  );

  const body = hideFooter ? innerContent : <div className="space-y-5 px-6 py-5">{innerContent}</div>;

  const panel = variant === 'embedded' ? <div className="rounded-xl border border-border bg-card">{body}</div> : variant === 'plain' ? <div className="space-y-3">{body}</div> : null;

  const dialog = variant === 'dialog' ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
      onClick={step === 'importing' ? undefined : onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">批量添加</h2>
          {step === 'importing' ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={handleCancelImport}
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {body}
      </div>
    </div>
  ) : null;

  return (
    <>
      {panel}
      {dialog}
      {step === 'done' && result && !showFetchDialog ? (
        <BatchResultDialog
          title={cancelled ? '导入已取消' : '导入结果'}
          subtitle={
            cancelled
              ? `已取消：已处理 ${result.created + result.skipped + result.failed} 行保留，未处理行已停止。成功 ${result.created} · 跳过 ${result.skipped} · 失败 ${result.failed}`
              : `共 ${result.total} 行 · 成功 ${result.created || result.valid} · 跳过 ${result.skipped} · 失败 ${result.failed}`
          }
          rows={dialogRows}
          mode="import"
          onClose={() => {
            setShowFetchDialog(false);
            resetAll();
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
            resetAll();
          }}
          onPreview={handlePreview}
          onApply={handleApply}
        />
      ) : null}
    </>
  );
}
