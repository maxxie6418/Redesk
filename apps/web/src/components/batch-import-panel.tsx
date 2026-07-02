import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import type { ImportBooksResult } from '@redesk/shared';
import { ApiError, api, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';

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
      setError('Please select a CSV file first.');
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
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const problemRows = result?.rows.filter((row) => !row.success) ?? [];

  const body = (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="text-sm font-medium text-foreground">CSV Template</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          The template covers title, author, ISBN, category, tags, status, rating and other fields.
          Only book metadata is imported; files are not included.
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
          Download sample CSV
        </Button>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-foreground">Select a filled CSV</span>
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
        <span>Validate only (preview mode, do not write)</span>
      </label>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive dark:border-destructive/30 dark:bg-destructive/15">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium text-foreground">
            {result.dry_run
              ? `Preview: ${result.valid} valid rows, ${result.skipped} skipped, ${result.failed} failed`
              : `Created ${result.created} books, ${result.skipped} skipped, ${result.failed} failed`}
          </div>
          {problemRows.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border">
              {problemRows.slice(0, 20).map((row) => (
                <div key={row.row} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                  <span className="font-medium text-foreground">Row {row.row}</span>
                  <span className="ml-2 text-muted-foreground">{row.title ?? 'untitled'}</span>
                  <div className="mt-1 flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {row.error}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2.5 border-t border-border pt-5">
        {variant === 'dialog' && onClose ? (
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : null}
        <Button type="button" onClick={importCsv} disabled={submitting}>
          {submitting ? (dryRun ? 'Validating...' : 'Importing...') : dryRun ? 'Validate' : 'Start import'}
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
          <h2 className="font-display text-xl font-medium text-foreground">Batch import books</h2>
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
