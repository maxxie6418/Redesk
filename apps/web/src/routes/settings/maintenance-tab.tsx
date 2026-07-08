import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, CircleDot, Database, Download, FileSpreadsheet, Image, Loader2, Pencil, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_BASE } from '@/lib/api';
import {
  useMaintenanceStats,
  useMaintenanceList,
  useUpdateBookField,
  useBatchPreviewMetadata,
  useBatchApplyMetadata,
  useBatchFetchCovers,
  type MaintenanceBookRow,
  type MaintenanceListParams,
  type BatchFetchCoversResult,
} from '@/hooks/use-maintenance';
import { BatchResultDialog, BatchFetchResultDialog, type BatchResultRow, type FetchPreviewRow, type FetchApplyRow } from '@/components/batch-result-dialog';

const MISSING_CHIPS: { key: string; label: string; field: string }[] = [
  { key: 'author', label: '缺少作者', field: 'author' },
  { key: 'isbn', label: '缺少 ISBN', field: 'isbn' },
  { key: 'publisher', label: '缺少出版社', field: 'publisher' },
  { key: 'publish_year', label: '缺少出版年', field: 'publish_year' },
  { key: 'description', label: '缺少描述', field: 'description' },
  { key: 'translator', label: '缺少译者', field: 'translator' },
];

const ALL_COLUMNS = [
  { key: 'title', label: '书名', required: true },
  { key: 'cover', label: '封面', required: false },
  { key: 'author', label: '作者', required: false },
  { key: 'isbn', label: 'ISBN', required: false },
  { key: 'publisher', label: '出版社', required: false },
  { key: 'publish_year', label: '出版年', required: false },
  { key: 'source_url', label: '来源链接', required: false },
  { key: 'status', label: '状态', required: false },
  { key: 'category_id', label: '分类', required: false },
  { key: 'tags', label: '标签', required: false },
  { key: 'metadata_source', label: '来源', required: false },
  { key: 'subtitle', label: '副标题', required: false },
  { key: 'translator', label: '译者', required: false },
  { key: 'original_title', label: '原书名', required: false },
  { key: 'page_count', label: '页数', required: false },
  { key: 'description', label: '描述', required: false },
  { key: 'language', label: '语言', required: false },
  { key: 'rating', label: '评分', required: false },
] as const;

const DEFAULT_VISIBLE = new Set([
  'title', 'cover', 'author', 'isbn', 'publisher', 'publish_year',
  'source_url', 'status', 'category_id', 'metadata_source',
]);

const TEXT_EDITABLE = new Set([
  'author', 'isbn', 'publisher', 'publish_year', 'translator',
  'original_title', 'subtitle', 'page_count', 'source_url',
]);

const STATUS_LABEL: Record<string, string> = {
  stored: '收录',
  plan_to_read: '计划读',
  want_to_read: '想读',
  reading: '在读',
  finished: '已读',
  archived: '存档',
};

const STATUS_BADGE: Record<string, string> = {
  stored: 'bg-muted text-muted-foreground',
  plan_to_read: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  want_to_read: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  reading: 'bg-primary/10 text-primary',
  finished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-muted text-muted-foreground',
};

const SOURCE_BADGE: Record<string, string> = {
  manual: 'bg-muted text-muted-foreground',
  douban: 'bg-primary/10 text-primary',
  neodb: 'bg-primary/10 text-primary',
  openlibrary: 'bg-primary/10 text-primary',
};

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  douban: '豆瓣',
  neodb: 'NeoDB',
  openlibrary: 'OpenLibrary',
};

function isEmpty(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

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

export function MaintenanceTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sort, setSort] = useState('-updated_at');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeMissing, setActiveMissing] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('maintenance_visible_cols');
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        return new Set(arr);
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_VISIBLE);
  });
  const [editingCell, setEditingCell] = useState<{ bookId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState<ImportBooksResult | null>(null);
  const [importingBookIds, setImportingBookIds] = useState<string | undefined>(undefined);
  const [showFetchDialog, setShowFetchDialog] = useState(false);

  const importResultRows: BatchResultRow[] = useMemo(() => {
    if (!importResult) return [];
    return importResult.rows.map((r) => ({
      key: String(r.row),
      id: r.book_id ?? undefined,
      title: r.title ?? r.raw_data?.title ?? null,
      author: r.raw_data?.author ?? null,
      publisher: r.raw_data?.publisher ?? null,
      isbn: r.raw_data?.isbn ?? null,
      sourceUrl: r.raw_data?.source_url ?? null,
      status: r.success ? 'success' : r.skipped ? 'skipped' : 'failed',
      error: r.error,
      rawData: r.raw_data,
    }));
  }, [importResult]);

  const stats = useMaintenanceStats();
  const updateField = useUpdateBookField();
  const batchPreview = useBatchPreviewMetadata();
  const batchApply = useBatchApplyMetadata();

  const batchFetchCovers = useBatchFetchCovers();

  const params: MaintenanceListParams = useMemo(() => {
    const missingKeys = Array.from(activeMissing).filter(
      (k) => !k.startsWith('__'),
    );
    return {
      page,
      page_size: pageSize,
      sort,
      q: debouncedQuery || undefined,
      missing: missingKeys.length > 0 ? missingKeys.join(',') : undefined,
      no_source_url: activeMissing.has('__no_source_url') || undefined,
      has_source_url_not_fetched: activeMissing.has('__has_source_not_fetched') || undefined,
      no_cover: activeMissing.has('__no_cover') || undefined,
      book_ids: importingBookIds,
    };
  }, [page, pageSize, sort, debouncedQuery, activeMissing, importingBookIds]);

  const list = useMaintenanceList(params);

  const books = useMemo(() => list.data?.data ?? [], [list.data]);
  const pagination = list.data?.pagination;
  const totalPages = useMemo(() => pagination ? Math.ceil(pagination.total / pageSize) : 1, [pagination, pageSize]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('maintenance_visible_cols', JSON.stringify(Array.from(visibleCols)));
  }, [visibleCols]);

  const toggleMissing = useCallback((field: string) => {
    setActiveMissing((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
    setPage(1);
  }, []);

  const toggleCol = useCallback((key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev === field) return `-${field}`;
      if (prev === `-${field}`) return field;
      return field;
    });
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === books.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(books.map((b) => b.id)));
    }
  }, [books, selected.size]);

  const selectMissing = useCallback(() => {
    const missingIds = books.filter((b) =>
      ['author', 'isbn', 'publisher', 'publish_year', 'description'].some((f) => isEmpty(b[f as keyof MaintenanceBookRow])),
    ).map((b) => b.id);
    setSelected(new Set(missingIds));
  }, [books]);

  const selectWithSource = useCallback(() => {
    const ids = books.filter((b) => !isEmpty(b.source_url)).map((b) => b.id);
    setSelected(new Set(ids));
  }, [books]);

  const startEdit = useCallback((bookId: number, field: string, currentValue: unknown) => {
    setEditingCell({ bookId, field });
    setEditValue(currentValue == null ? '' : String(currentValue));
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell) return;
    const { bookId, field } = editingCell;
    const value = editValue.trim() === '' ? null : editValue.trim();
    updateField.mutate(
      { bookId, field, value },
      {
        onSuccess: () => {
          setEditingCell(null);
          toast.success('已保存');
        },
        onError: () => {
          toast.error('保存失败');
        },
      },
    );
  }, [editingCell, editValue, updateField]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleCsvImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${API_BASE}/books/import`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || '导入失败');
        const result = json.data as ImportBooksResult;
        setImportResult(result);
        setShowImportResult(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '导入失败');
      }
    };
    input.click();
  }, []);

  const clearBookIdsFilter = useCallback(() => {
    setImportingBookIds(undefined);
    setPage(1);
  }, []);

  const handleBatchFetch = useCallback(() => {
    if (selected.size === 0) return;
    setShowFetchDialog(true);
  }, [selected]);

  const fetchDialogRows: BatchResultRow[] = useMemo(() => {
    return books
      .filter((b) => selected.has(b.id))
      .map((b) => ({
        key: String(b.id),
        id: b.id,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        isbn: b.isbn,
        sourceUrl: b.source_url,
        status: (isEmpty(b.source_url) ? 'skipped' : 'success') as BatchResultRow['status'],
      }));
  }, [books, selected]);

  const handlePreview = useCallback(async (ids: number[]): Promise<FetchPreviewRow[]> => {
    const result = await batchPreview.mutateAsync(ids);
    return result as FetchPreviewRow[];
  }, [batchPreview]);

  const handleApply = useCallback(async (ids: number[], fields?: string[]): Promise<FetchApplyRow[]> => {
    const result = await batchApply.mutateAsync({ ids, fields });
    stats.refetch();
    return result as FetchApplyRow[];
  }, [batchApply, stats]);

  const handleBatchFetchCovers = useCallback(() => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    batchFetchCovers.mutate(ids, {
      onSuccess: (result) => {
        const data = result as BatchFetchCoversResult;
        toast.success(`封面抓取完成：成功 ${data.success}，失败 ${data.failed}`);
        stats.refetch();
      },
      onError: () => {
        toast.error('批量抓取封面失败');
      },
    });
  }, [selected, batchFetchCovers, stats]);

  const renderCellValue = useCallback((book: MaintenanceBookRow, col: string) => {
    const value = book[col as keyof MaintenanceBookRow];
    const isEditing = editingCell?.bookId === book.id && editingCell?.field === col;

    if (col === 'cover') {
      if (book.has_cover || book.cover_path) {
        return (
          <img
            src={`/api/v1/books/${book.id}/cover?v=${encodeURIComponent(book.updated_at)}`}
            alt={book.title}
            className="h-10 w-7 rounded object-cover shadow-sm"
            loading="lazy"
          />
        );
      }
      return (
        <div className="flex h-10 w-7 items-center justify-center rounded border border-dashed border-muted-foreground/30 bg-muted/50">
          <Image className="h-3 w-3 text-muted-foreground/40" />
        </div>
      );
    }

    if (col === 'status') {
      const s = String(value ?? 'stored');
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s] ?? STATUS_BADGE.stored}`}>
          {STATUS_LABEL[s] ?? s}
        </span>
      );
    }

    if (col === 'category_id') {
      const name = book.category_name ?? (value ? `分类 #${value}` : null);
      if (!name) return <span className="text-xs text-muted-foreground/50">未分类</span>;
      return <span className="text-xs">{name}</span>;
    }

    if (col === 'tags') {
      const tags = book.tags ?? [];
      if (tags.length === 0) return <span className="text-xs text-muted-foreground/50">无标签</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t}</span>
          ))}
        </div>
      );
    }

    if (col === 'metadata_source') {
      const src = String(value ?? 'manual');
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[src] ?? SOURCE_BADGE.manual}`}>
          {SOURCE_LABEL[src] ?? src}
        </span>
      );
    }

    if (col === 'source_url') {
      if (isEditing) {
        return (
          <Input
            className="h-7 text-xs"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            onBlur={saveEdit}
            placeholder="粘贴豆瓣/NeoDB链接..."
            autoFocus
          />
        );
      }
      if (isEmpty(value)) {
        return (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            onClick={() => startEdit(book.id, col, value)}
          >
            <CircleDot className="h-3 w-3" />
            补充链接
          </button>
        );
      }
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-primary underline-offset-2 hover:underline"
          title={String(value)}
          onClick={(e) => e.stopPropagation()}
        >
          {String(value).replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}
        </a>
      );
    }

    if (col === 'description') {
      if (isEditing) {
        return (
          <Input
            className="h-7 text-xs"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            onBlur={saveEdit}
            autoFocus
          />
        );
      }
      if (isEmpty(value)) {
        return (
          <button type="button" className="text-xs text-muted-foreground/50 hover:text-foreground" onClick={() => startEdit(book.id, col, value)}>
            点击补充...
          </button>
        );
      }
      return (
        <span className="block max-w-[200px] truncate text-xs" title={String(value)}>
          {String(value)}
        </span>
      );
    }

    if (isEditing) {
      return (
        <Input
          className="h-7 text-xs"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
          onBlur={saveEdit}
          autoFocus
        />
      );
    }

    if (TEXT_EDITABLE.has(col)) {
      if (isEmpty(value)) {
        return (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-amber-600/60 hover:text-amber-600 dark:text-amber-400/60 dark:hover:text-amber-400"
            onClick={() => startEdit(book.id, col, value)}
          >
            <CircleDot className="h-3 w-3" />
            补充
          </button>
        );
      }
      return (
        <span
          className="cursor-pointer text-xs hover:underline"
          onClick={() => startEdit(book.id, col, value)}
          title="点击编辑"
        >
          {String(value)}
        </span>
      );
    }

    return <span className="text-xs">{value == null ? '' : String(value)}</span>;
  }, [editingCell, editValue, startEdit, saveEdit, cancelEdit]);

  const handleExportCsv = useCallback(() => {
    window.open(`${API_BASE}/export/books?format=csv`, '_blank', 'noopener');
  }, []);

  const statsData = stats.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">数据维护</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCsvImport}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                导入 CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出 CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">快速筛选</span>
            {MISSING_CHIPS.map((chip) => {
              const count = statsData?.missing_fields[chip.field] ?? 0;
              const active = activeMissing.has(chip.field);
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                  onClick={() => toggleMissing(chip.field)}
                >
                  {chip.label}
                  <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                    active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeMissing.has('__no_source_url')
                  ? 'border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'border-border bg-card text-muted-foreground hover:border-amber-300 hover:text-foreground'
              }`}
              onClick={() => toggleMissing('__no_source_url')}
            >
              缺少来源链接
              <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                activeMissing.has('__no_source_url') ? 'bg-amber-200/50 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'
              }`}>
                {statsData?.no_source_url ?? 0}
              </span>
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeMissing.has('__has_source_not_fetched')
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
              onClick={() => toggleMissing('__has_source_not_fetched')}
            >
              有链接未抓取
              <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                activeMissing.has('__has_source_not_fetched') ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {statsData?.has_source_url_not_fetched ?? 0}
              </span>
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeMissing.has('__no_cover')
                  ? 'border-rose-400/40 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'border-border bg-card text-muted-foreground hover:border-rose-300 hover:text-foreground'
              }`}
              onClick={() => toggleMissing('__no_cover')}
            >
              <Image className="h-3 w-3" />
              缺少封面
              <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                activeMissing.has('__no_cover') ? 'bg-rose-200/50 text-rose-700 dark:text-rose-300' : 'bg-muted text-muted-foreground'
              }`}>
                {statsData?.no_cover ?? 0}
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-56 pl-8 text-xs"
                  placeholder="搜索书名、作者、ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground/70">显示列</span>
            {ALL_COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                disabled={col.required}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  visibleCols.has(col.key)
                    ? 'border border-emerald-300/60 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'border border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                } ${col.required ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
                onClick={() => !col.required && toggleCol(col.key)}
              >
                {col.label}
              </button>
            ))}
          </div>

          {statsData && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>共 {statsData.total} 本</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                完整 {statsData.complete}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                缺失 {statsData.missing_any}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                无链接 {statsData.no_source_url}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                无封面 {statsData.no_cover}
              </span>
              {selected.size > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  选中 {selected.size}
                </span>
              )}
            </div>
          )}

          {importingBookIds && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary">正在查看 CSV 导入的书籍</span>
              <button
                type="button"
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={clearBookIdsFilter}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <span className="text-sm font-medium text-primary">已选 {selected.size} 本</span>
            <div className="h-4 w-px bg-primary/20" />
            <Button variant="outline" size="sm" className="text-xs" onClick={handleBatchFetch}>
              <Pencil className="mr-1.5 h-3 w-3" />
              批量抓取信息
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={batchFetchCovers.isPending}
              onClick={handleBatchFetchCovers}
            >
              {batchFetchCovers.isPending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Image className="mr-1.5 h-3 w-3" />
              )}
              批量抓取封面
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              设置分类
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              设置标签
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              设置状态
            </Button>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
                取消选择
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <button type="button" className="flex h-4 w-4 items-center justify-center" onClick={selectAll}>
                <div className={`h-4 w-4 rounded border ${
                  selected.size === books.length && books.length > 0
                    ? 'border-primary bg-primary'
                    : selected.size > 0
                      ? 'border-primary bg-primary/30'
                      : 'border-muted-foreground/30'
                } flex items-center justify-center`}>
                  {(selected.size === books.length && books.length > 0) || selected.size > 0 ? (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  ) : null}
                </div>
              </button>
              <span className="text-xs text-muted-foreground">全选</span>
              <span className="text-xs text-muted-foreground/30">|</span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={selectMissing}>只选缺失项</button>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={selectWithSource}>只选有链接</button>
            </div>
            {pagination && (
              <span className="text-xs text-muted-foreground">
                显示 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, pagination.total)} / 共 {pagination.total} 本
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-2 text-left">
                    <div className="flex h-4 w-4 items-center justify-center rounded border border-muted-foreground/30">
                      {selected.size === books.length && books.length > 0 ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : null}
                    </div>
                  </th>
                  {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => {
                    const isActive = sort === col.key || sort === `-${col.key}`;
                    const isDesc = sort === `-${col.key}`;
                    return (
                      <th
                        key={col.key}
                        className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {isActive ? (
                            isDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {list.isLoading ? (
                  <tr>
                    <td colSpan={visibleCols.size + 1} className="px-3 py-12 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : books.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.size + 1} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      {debouncedQuery || activeMissing.size > 0 ? '没有匹配的书籍' : '书库为空'}
                    </td>
                  </tr>
                ) : (
                  books.map((book) => {
                    const hasMissing = ['author', 'isbn', 'publisher', 'publish_year', 'description'].some(
                      (f) => isEmpty(book[f as keyof MaintenanceBookRow]),
                    );
                    return (
                      <tr
                        key={book.id}
                        className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                          selected.has(book.id) ? 'bg-primary/5' : ''
                        } ${hasMissing ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="flex h-4 w-4 items-center justify-center"
                            onClick={() => toggleSelect(book.id)}
                          >
                            <div className={`h-4 w-4 rounded border ${
                              selected.has(book.id)
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/30'
                            } flex items-center justify-center`}>
                              {selected.has(book.id) ? (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              ) : null}
                            </div>
                          </button>
                        </td>
                        {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => (
                          <td key={col.key} className="px-3 py-2">
                            {renderCellValue(book, col.key)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2">
              <span className="text-xs text-muted-foreground">
                第 {page} / {totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 min-w-7 px-2 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showImportResult && importResult ? (
        <BatchResultDialog
          title="导入结果"
          subtitle={`共 ${importResult.total} 行，成功 ${importResult.created}，跳过 ${importResult.skipped}，失败 ${importResult.failed}`}
          rows={importResultRows}
          mode="import"
          onClose={() => setShowImportResult(false)}
          onFetchInfo={(ids) => {
            setShowImportResult(false);
            setImportingBookIds(ids.join(','));
            setPage(1);
            setActiveMissing(new Set());
            stats.refetch();
            setImportResult(null);
          }}
        />
      ) : null}

      {showFetchDialog ? (
        <BatchFetchResultDialog
          title="批量抓取信息"
          subtitle={`已选 ${selected.size} 本书，将从来源链接抓取缺失的书籍信息`}
          rows={fetchDialogRows}
          onClose={() => setShowFetchDialog(false)}
          onPreview={handlePreview}
          onApply={handleApply}
        />
      ) : null}
    </div>
  );
}
