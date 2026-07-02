import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileWarning,
  Files,
  HardDrive,
  Link,
  Search,
  Trash2,
  Upload,
  Cloud,
} from 'lucide-react';
import {
  useDeleteUnassociatedFile,
  useFileLibrary,
  useMatchFileToBook,
  useUploadUnassociatedFile,
  type BookFileItem,
} from '@/hooks/use-files';
import { useBooks, type BookSummary } from '@/hooks/use-books';
import { ProtectedShell } from '@/components/protected-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { cn } from '@/lib/utils';

const FORMAT_OPTIONS = ['ALL', 'EPUB', 'PDF', 'MOBI', 'TXT', 'AZW3', 'DJVU', 'DOCX', 'FB2'];

const MATCH_MODE_OPTIONS = [
  { value: 'conservative', label: '保守', desc: '只默认采用高确定性结果' },
  { value: 'balanced', label: '平衡', desc: '大致匹配且没有歧义时默认命中' },
  { value: 'loose', label: '宽松', desc: '优先提高命中率，用醒目提醒标出风险' },
] as const;

type MatchMode = (typeof MATCH_MODE_OPTIONS)[number]['value'];
type MatchLevel = 'high' | 'medium' | 'low';

type MatchCandidate = {
  id: number;
  title: string;
  author: string | null;
  score: number;
  level: MatchLevel;
  ambiguous: boolean;
  reason: string;
};

const MATCH_MODE_CONFIG: Record<MatchMode, { accept: number; review: number; gap: number }> = {
  conservative: { accept: 0.9, review: 0.75, gap: 0.08 },
  balanced: { accept: 0.78, review: 0.58, gap: 0.06 },
  loose: { accept: 0.68, review: 0.48, gap: 0.04 },
};

const FILENAME_NOISE = [
  'epub',
  'pdf',
  'mobi',
  'txt',
  'azw3',
  'azw',
  'djvu',
  'docx',
  'fb2',
  'ebook',
  'zlib',
  '完整版',
  '扫描版',
  '文字版',
  '校对版',
  '插图版',
  '精校',
  '全集',
  'volume',
  'vol',
];

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STORAGE_MODE_LABELS: Record<BookFileItem['storage_mode'], string> = {
  local_only: '本地',
  cloud_only: '云端',
  dual: '本地 + 云端',
};

function StorageStatusBadge({ file }: { file: BookFileItem }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Cloud className="h-3 w-3" />
      {file.sync_status === 'pending' ? (
        <span>同步中</span>
      ) : file.sync_status === 'partial_failed' || file.sync_status === 'failed' ? (
        <span className="text-destructive">同步失败</span>
      ) : (
        <span>{STORAGE_MODE_LABELS[file.storage_mode]}</span>
      )}
    </span>
  );
}

function formatTotalSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function normalizeMatchText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripExtension(value)
    .toLowerCase()
    .replace(/[[（【(][^)\]）】]*[\]）】)]/g, ' ')
    .replace(/[_\-+]+/g, ' ')
    .replace(/[·.，,、/\\]/g, ' ')
    .replace(/\b(v|vol|volume)\s*\d+\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const noise of FILENAME_NOISE) {
    text = text.replace(new RegExp(`\\b${noise}\\b`, 'g'), ' ');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function compactMatchText(value: string): string {
  return value.replace(/\s+/g, '');
}

function splitTokens(value: string): string[] {
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildBigrams(value: string): Set<string> {
  if (!value) return new Set();
  if (value.length === 1) return new Set([value]);
  const grams = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) {
    grams.add(value.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = buildBigrams(left);
  const rightGrams = buildBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) overlap += 1;
  }

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

function extractSearchSeed(filename: string | null | undefined): string {
  const normalized = normalizeMatchText(filename);
  if (!normalized) return '';
  const tokens = splitTokens(normalized);
  if (tokens.length === 0) return normalized;
  return tokens.slice(0, 6).join(' ');
}

function buildCandidate(filename: string | null | undefined, book: BookSummary, mode: MatchMode, secondScore: number): MatchCandidate {
  const fileNormalized = normalizeMatchText(filename);
  const fileCompact = compactMatchText(fileNormalized);
  const titleNormalized = normalizeMatchText(book.title);
  const titleCompact = compactMatchText(titleNormalized);
  const authorNormalized = normalizeMatchText(book.author);
  const authorCompact = compactMatchText(authorNormalized);

  const titleScore = diceCoefficient(fileCompact, titleCompact);
  const authorScore = authorCompact ? diceCoefficient(fileCompact, authorCompact) : 0;
  const containsTitle = titleCompact.length >= 2 && (fileCompact.includes(titleCompact) || titleCompact.includes(fileCompact));
  const containsAuthor = authorCompact.length >= 2 && fileCompact.includes(authorCompact);
  const titleTokens = splitTokens(titleNormalized);
  const tokenHits = titleTokens.filter((token) => fileNormalized.includes(token)).length;
  const tokenScore = titleTokens.length > 0 ? tokenHits / titleTokens.length : 0;

  const score = Math.min(
    1,
    titleScore * 0.72 +
      tokenScore * 0.18 +
      authorScore * 0.06 +
      (containsTitle ? 0.08 : 0) +
      (containsAuthor ? 0.04 : 0),
  );

  const config = MATCH_MODE_CONFIG[mode];
  const ambiguous = score >= config.review && Math.abs(score - secondScore) < config.gap;

  let level: MatchLevel = 'low';
  if (score >= config.accept && !ambiguous) level = 'high';
  else if (score >= config.review) level = 'medium';

  let reason = containsTitle ? '书名主体已命中' : '按文件名近似度匹配';
  if (containsAuthor) reason += '，作者也命中';
  else if (authorScore >= 0.45) reason += '，作者较接近';
  if (ambiguous) reason += '，但有接近候选';

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    score,
    level,
    ambiguous,
    reason,
  };
}

function levelLabel(level: MatchLevel): string {
  if (level === 'high') return '默认命中';
  if (level === 'medium') return '需要关注';
  return '低置信';
}

function levelClassName(level: MatchLevel): string {
  if (level === 'high') return 'border-primary/20 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10';
  if (level === 'medium') return 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200';
  return 'border-muted bg-muted/60 text-muted-foreground';
}

export function FileLibraryPage() {
  const navigate = useNavigate();
  const sidebarStats = useSidebarStats();
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [associatedFilter, setAssociatedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [matchDialog, setMatchDialog] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  const fileParams = {
    page,
    page_size: 50,
    format: formatFilter !== 'ALL' ? formatFilter : undefined,
    associated: associatedFilter !== 'all' ? associatedFilter : undefined,
  };

  const files = useFileLibrary(fileParams);
  const uploadUnassociated = useUploadUnassociatedFile();
  const matchFile = useMatchFileToBook();
  const deleteUnassociated = useDeleteUnassociatedFile();
  const bookSearch = useBooks({ q: searchQuery, page_size: 20 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMatch = useCallback(
    async (fileId: number, bookId: number) => {
      try {
        await matchFile.mutateAsync({ fileId, bookId });
        setMatchDialog(null);
        setSelectedBookId(null);
      } catch {
        // ignore
      }
    },
    [matchFile],
  );

  const handleDeleteUnassociated = useCallback(
    async (fileId: number) => {
      try {
        await deleteUnassociated.mutateAsync(fileId);
      } catch {
        // ignore
      }
    },
    [deleteUnassociated],
  );

  const handleUploadUnassociated = useCallback(
    async (file: File) => {
      try {
        await uploadUnassociated.mutateAsync(file);
      } catch {
        // ignore
      }
    },
    [uploadUnassociated],
  );

  const allFiles: BookFileItem[] = files.data?.data ?? [];
  const pagination = files.data?.pagination ?? { page: 1, page_size: 50, total: 0 };
  const totalCount = pagination.total;
  const linkedCount = files.data?.summary?.linked ?? allFiles.filter((file: BookFileItem) => file.book_id != null).length;
  const unlinkedCount = files.data?.summary?.unlinked ?? allFiles.filter((file: BookFileItem) => file.book_id == null).length;
  const totalSize = files.data?.summary?.total_size ?? allFiles.reduce((sum: number, file: BookFileItem) => sum + (file.file_size ?? 0), 0);
  const currentMatchFile = matchDialog == null ? null : allFiles.find((file: BookFileItem) => file.id === matchDialog) ?? null;

  const preliminaryCandidates = (bookSearch.data?.data ?? [])
    .map((book: BookSummary) => ({
      book,
      preview: buildCandidate(currentMatchFile?.original_filename, book, matchMode, 0),
    }))
    .sort((left: { book: BookSummary; preview: MatchCandidate }, right: { book: BookSummary; preview: MatchCandidate }) => right.preview.score - left.preview.score);

  const candidates = preliminaryCandidates.map((entry: { book: BookSummary; preview: MatchCandidate }, index: number) =>
    buildCandidate(
      currentMatchFile?.original_filename,
      entry.book,
      matchMode,
      preliminaryCandidates[index + 1]?.preview.score ?? 0,
    ),
  );

  const recommendedCandidate = candidates[0] ?? null;

  useEffect(() => {
    if (!currentMatchFile) return;
    setSearchQuery(extractSearchSeed(currentMatchFile.original_filename));
    setSelectedBookId(null);
  }, [currentMatchFile]);

  useEffect(() => {
    if (!recommendedCandidate) return;
    if (recommendedCandidate.level !== 'high') return;
    setSelectedBookId((current) => current ?? recommendedCandidate.id);
  }, [recommendedCandidate]);

  return (
    <ProtectedShell
      activeKey="files"
      stats={sidebarStats}
      mainClassName="min-w-0 flex-1 overflow-y-auto px-8 py-7"
    >
      <div className="mb-6">
        <h1 className="font-display text-[26px] font-semibold text-foreground">书库文件</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">管理所有导入的电子书文件，共 {totalCount} 个文件</p>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Files className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">文件总数</span>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-foreground">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">已关联</span>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-success">{linkedCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <FileWarning className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">未关联</span>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-amber-600 dark:text-amber-400">{unlinkedCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">占用空间</span>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-foreground">{formatTotalSize(totalSize)}</div>
        </div>
      </div>

      {unlinkedCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-amber-700 dark:text-amber-300">{unlinkedCount} 个文件尚未关联书籍</span>
            <span className="ml-2 text-[12px] text-amber-600/70 dark:text-amber-400/70">建议尽快匹配，未关联文件不会出现在书架中</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
            onClick={() => setAssociatedFilter('false')}
          >
            只看未关联
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          {FORMAT_OPTIONS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => {
                setFormatFilter(fmt);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                formatFilter === fmt ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {fmt === 'ALL' ? '全部格式' : fmt}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => {
              setAssociatedFilter('all');
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              associatedFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
            )}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => {
              setAssociatedFilter('true');
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              associatedFilter === 'true' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
            )}
          >
            已关联
          </button>
          <button
            type="button"
            onClick={() => {
              setAssociatedFilter('false');
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              associatedFilter === 'false' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
            )}
          >
            未关联
          </button>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              上传文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadUnassociated(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-muted-foreground">
              <th className="py-2.5 pl-5 pr-3 text-left font-medium">文件名</th>
              <th className="py-2.5 pr-3 text-left font-medium">格式</th>
              <th className="py-2.5 pr-3 text-left font-medium">大小</th>
              <th className="py-2.5 pr-3 text-left font-medium">存储位置</th>
              <th className="py-2.5 pr-3 text-left font-medium">关联书籍</th>
              <th className="py-2.5 pr-3 text-left font-medium">上传时间</th>
              <th className="py-2.5 pr-5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {allFiles.map((file: BookFileItem) => (
              <tr key={file.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 pl-5 pr-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[220px] truncate">{file.original_filename ?? '未知文件'}</span>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{file.file_format}</span>
                </td>
                <td className="py-3 pr-3 text-muted-foreground">{formatSize(file.file_size)}</td>
                <td className="py-3 pr-3">
                  <StorageStatusBadge file={file} />
                </td>
                <td className="py-3 pr-3">
                  {file.book_id && file.book_title ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => navigate(`/books/${file.book_id}`)}
                    >
                      {file.book_title}
                    </button>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">未关联</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-xs text-muted-foreground">{file.created_at.slice(0, 10)}</td>
                <td className="py-3 pr-5 text-right">
                  {file.book_id == null ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => setMatchDialog(file.id)}>
                        <Link className="mr-1 h-3.5 w-3.5" />
                        匹配书籍
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void handleDeleteUnassociated(file.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {allFiles.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  暂无文件
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pagination.total > pagination.page_size && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-sm text-muted-foreground">共 {pagination.total} 个文件</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pagination.page_size >= pagination.total}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>

      {matchDialog != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-[640px] max-h-[85vh] overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">匹配书籍</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentMatchFile && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">当前文件</div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">{currentMatchFile.original_filename ?? '未知文件'}</div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">匹配分级</div>
                <div className="grid grid-cols-3 gap-2">
                  {MATCH_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMatchMode(option.value)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left transition-colors',
                        matchMode === option.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="默认已带入文件关键词，可直接改"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button size="sm" onClick={() => setSearchQuery(extractSearchSeed(currentMatchFile?.original_filename))}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {recommendedCandidate && (
                <div
                  className={cn(
                    'rounded-lg border px-3 py-3',
                    recommendedCandidate.level === 'high'
                      ? 'border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10'
                      : recommendedCandidate.level === 'medium'
                        ? 'border-amber-200/60 bg-amber-50/95 dark:border-amber-800/60 dark:bg-amber-950/30'
                        : 'border-border bg-muted/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground">推荐结果</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{recommendedCandidate.title}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', levelClassName(recommendedCandidate.level))}>
                          {levelLabel(recommendedCandidate.level)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        相似度 {Math.round(recommendedCandidate.score * 100)}% · {recommendedCandidate.reason}
                      </div>
                      {recommendedCandidate.author && (
                        <div className="mt-1 text-xs text-muted-foreground">作者：{recommendedCandidate.author}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleMatch(matchDialog, recommendedCandidate.id)}
                      disabled={matchFile.isPending || recommendedCandidate.level === 'low'}
                    >
                      采用结果
                    </Button>
                  </div>
                  {recommendedCandidate.ambiguous && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      存在多个接近候选，请重点检查下方列表。
                    </div>
                  )}
                </div>
              )}

              {candidates.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">候选书籍</div>
                    <div className="text-xs text-muted-foreground">已默认带入关键词，无需重新输入</div>
                  </div>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto">
                    {candidates.map((candidate: MatchCandidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60',
                          selectedBookId === candidate.id ? 'border-primary bg-primary/5' : 'border-border',
                          candidate.level === 'medium' && 'border-amber-200 dark:border-amber-900',
                        )}
                        onClick={() => setSelectedBookId(candidate.id)}
                        disabled={matchFile.isPending}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{candidate.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {candidate.author ? `${candidate.author} · ` : ''}相似度 {Math.round(candidate.score * 100)}%
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{candidate.reason}</div>
                          </div>
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', levelClassName(candidate.level))}>
                            {levelLabel(candidate.level)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  暂未找到候选书籍。可以微调关键词，或切到更宽松的匹配分级。
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => selectedBookId != null && handleMatch(matchDialog, selectedBookId)}
                  disabled={selectedBookId == null || matchFile.isPending}
                >
                  确认匹配
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMatchDialog(null);
                    setSelectedBookId(null);
                  }}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ProtectedShell>
  );
}
