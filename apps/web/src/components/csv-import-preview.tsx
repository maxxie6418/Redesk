import { AlertTriangle, CheckCircle2, SkipForward, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CsvPreviewRow {
  row: number;
  title: string | null;
  success: boolean;
  skipped: boolean;
  book_id: number | null;
  error: string | null;
  raw_data: Record<string, string>;
}

export interface CsvPreviewSummary {
  total: number;
  valid: number;
  skipped: number;
  failed: number;
}

export interface CsvImportPreviewProps {
  rows: CsvPreviewRow[];
  summary: CsvPreviewSummary;
  onConfirm: () => void;
  onBack: () => void;
  confirming?: boolean;
}

function Field({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className="truncate" title={value}>{value}</span>;
}

export function CsvImportPreview({ rows, summary, onConfirm, onBack, confirming }: CsvImportPreviewProps) {
  const importable = summary.valid;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-display text-lg font-medium text-foreground">导入预览</h3>
          <p className="text-xs text-muted-foreground">
            已解析 {summary.total} 行 · 可导入 {importable} · 跳过 {summary.skipped} · 失败 {summary.failed}
          </p>
        </div>
        <Table2 className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2 text-left">行</th>
              <th className="px-3 py-2 text-left">书名</th>
              <th className="px-3 py-2 text-left">作者</th>
              <th className="px-3 py-2 text-left">ISBN</th>
              <th className="px-3 py-2 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const raw = row.raw_data ?? {};
              const statusLabel = row.success ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />可导入
                </span>
              ) : row.skipped ? (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <SkipForward className="h-3.5 w-3.5" />跳过
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />失败
                </span>
              );
              return (
                <tr
                  key={row.row}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    !row.success && !row.skipped && 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20',
                  )}
                >
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.row}</td>
                  <td className="max-w-[220px] px-3 py-2.5 font-medium">
                    <Field value={row.title ?? raw.title ?? raw['书名'] ?? null} />
                    {row.error ? (
                      <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{row.error}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-[140px] px-3 py-2.5">
                    <Field value={raw.author ?? raw['作者'] ?? null} />
                  </td>
                  <td className="max-w-[130px] px-3 py-2.5">
                    <Field value={raw.isbn ?? raw['ISBN'] ?? null} />
                  </td>
                  <td className="px-3 py-2.5 text-xs">{statusLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-4">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          返回重选
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>确认后开始流式导入，导入过程可随时取消，已处理的行会保留。</span>
          <Button
            type="button"
            size="sm"
            disabled={importable === 0 || confirming}
            onClick={onConfirm}
            className="rounded-lg"
          >
            {confirming ? '准备中…' : `确认导入 ${importable} 本`}
          </Button>
        </div>
      </div>
    </div>
  );
}
