import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, FileText, FileWarning, Files, HardDrive, Link, Search, Trash2, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/page-ui/stat-card';
import { SegmentedToggle } from '@/components/page-ui/segmented-toggle';
import { cn } from '@/lib/utils';
import type { BookSummary } from '@/hooks/use-books';
import type { BookFileItem, FileMatchCandidate, FileMatchItem, MatchMode } from '@/hooks/use-files';
import { FORMAT_OPTIONS, MATCH_MODE_OPTIONS, buildDerivedSummary, confidenceClassName, confidenceLabel, formatSize, storageModeLabel } from './match-utils';

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

export function StorageStatusBadge({ file }: { file: BookFileItem }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Cloud className="h-3 w-3" />
      {file.sync_status === 'pending' ? (
        <span>同步中</span>
      ) : file.sync_status === 'partial_failed' || file.sync_status === 'failed' ? (
        <span className="text-destructive">同步失败</span>
      ) : (
        <span>{storageModeLabel(file.storage_mode)}</span>
      )}
    </span>
  );
}

export function FileLibraryStats({
  totalCount,
  linkedCount,
  unlinkedCount,
  totalSize,
}: {
  totalCount: number;
  linkedCount: number;
  unlinkedCount: number;
  totalSize: string;
}) {
  return (
    <div className="mb-5 grid grid-cols-4 gap-3">
      <StatCard label="文件总数" value={totalCount} icon={<Files className="h-3.5 w-3.5" />} iconClassName="bg-primary/10 text-primary" />
      <StatCard label="已关联" value={linkedCount} icon={<CheckCircle2 className="h-3.5 w-3.5" />} iconClassName="bg-success/10 text-success" valueClassName="text-success" />
      <StatCard
        label="未关联"
        value={unlinkedCount}
        icon={<FileWarning className="h-3.5 w-3.5" />}
        iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        valueClassName="text-amber-600 dark:text-amber-400"
      />
      <StatCard label="占用空间" value={totalSize} icon={<HardDrive className="h-3.5 w-3.5" />} />
    </div>
  );
}

export function UnlinkedWarning({
  unlinkedCount,
  onShowUnlinked,
  onBatchMatch,
}: {
  unlinkedCount: number;
  onShowUnlinked: () => void;
  onBatchMatch: () => void;
}) {
  if (unlinkedCount <= 0) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-amber-700 dark:text-amber-300">{unlinkedCount} 个文件尚未关联书籍</span>
        <span className="ml-2 text-[12px] text-amber-600/70 dark:text-amber-400/70">可以稍后处理，也可以一次性批量完成匹配。</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300" onClick={onShowUnlinked}>
          只看未关联
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onBatchMatch}>
          <Wand2 className="h-3.5 w-3.5" />
          批量匹配
        </Button>
      </div>
    </div>
  );
}

export function FileLibraryToolbar({
  formatFilter,
  onFormatChange,
  associatedFilter,
  onAssociatedChange,
  fileInputRef,
  onFileSelected,
  onBatchMatch,
  batchMatchDisabled,
}: {
  formatFilter: string;
  onFormatChange: (value: string) => void;
  associatedFilter: 'all' | 'true' | 'false';
  onAssociatedChange: (value: 'all' | 'true' | 'false') => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileSelected: (file: File) => void;
  onBatchMatch: () => void;
  batchMatchDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3">
      {FORMAT_OPTIONS.map((format) => (
        <button
          key={format}
          type="button"
          onClick={() => onFormatChange(format)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            formatFilter === format ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {format === 'ALL' ? '全部格式' : format}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" />
      {[
        { value: 'all', label: '全部' },
        { value: 'true', label: '已关联' },
        { value: 'false', label: '未关联' },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onAssociatedChange(option.value as 'all' | 'true' | 'false')}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            associatedFilter === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onBatchMatch} disabled={batchMatchDisabled}>
          <Wand2 className="mr-1.5 h-4 w-4" />
          批量匹配
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          上传文件
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelected(file);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function FilesTable({
  files,
  page,
  pageSize,
  total,
  onOpenBook,
  onOpenMatch,
  onDelete,
  onPrevPage,
  onNextPage,
}: {
  files: BookFileItem[];
  page: number;
  pageSize: number;
  total: number;
  onOpenBook: (bookId: number | null) => void;
  onOpenMatch: (fileId: number) => void;
  onDelete: (file: BookFileItem) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <>
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
          {files.map((file) => (
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
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => onOpenBook(file.book_id ?? null)}>
                    {file.book_title}
                  </button>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">未关联</span>
                )}
              </td>
              <td className="py-3 pr-3 text-xs text-muted-foreground">{file.created_at.slice(0, 10)}</td>
              <td className="py-3 pr-5 text-right">
                <div className="flex justify-end gap-1">
                  {file.book_id == null ? (
                    <Button variant="outline" size="sm" onClick={() => onOpenMatch(file.id)}>
                      <Link className="mr-1 h-3.5 w-3.5" />
                      精调匹配
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(file)} title="删除文件">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {files.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                暂无文件
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {total > pageSize ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-sm text-muted-foreground">共 {total} 个文件</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrevPage}>
              上一页
            </Button>
            <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={onNextPage}>
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MatchModeSwitcher({
  matchMode,
  onMatchModeChange,
}: {
  matchMode: MatchMode;
  onMatchModeChange: (mode: MatchMode) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">匹配分级</div>
      <SegmentedToggle className="grid grid-cols-3 gap-2 border-0 bg-transparent p-0">
        {MATCH_MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onMatchModeChange(option.value)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left transition-colors',
              matchMode === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted/50',
            )}
          >
            <div className="text-sm font-medium">{option.label}</div>
            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{option.desc}</div>
          </button>
        ))}
      </SegmentedToggle>
    </div>
  );
}

export function MatchDialog({
  open,
  file,
  matchMode,
  onMatchModeChange,
  recommendedCandidate,
  candidates,
  manualResults,
  searchQuery,
  onSearchQueryChange,
  selectedBookId,
  onSelectBook,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  file: FileMatchItem | null;
  matchMode: MatchMode;
  onMatchModeChange: (mode: MatchMode) => void;
  recommendedCandidate: FileMatchCandidate | null;
  candidates: FileMatchCandidate[];
  manualResults: BookSummary[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedBookId: number | null;
  onSelectBook: (bookId: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  useBodyScrollLock(open);

  if (!open || !file) return null;

  const manualOnly = manualResults.filter((book) => !candidates.some((candidate) => candidate.book_id === book.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="flex max-h-[85vh] w-[720px] flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">匹配书籍</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">当前文件</div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{file.original_filename ?? '未知文件'}</div>
            <div className="mt-1 text-xs text-muted-foreground">{buildDerivedSummary(file.derived)}</div>
          </div>

          <MatchModeSwitcher matchMode={matchMode} onMatchModeChange={onMatchModeChange} />

          {recommendedCandidate ? (
            <div className={cn('rounded-lg border px-3 py-3', confidenceClassName(recommendedCandidate.confidence))}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">推荐结果</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{recommendedCandidate.title}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', confidenceClassName(recommendedCandidate.confidence))}>
                      {confidenceLabel(recommendedCandidate.confidence)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">相似度 {Math.round(recommendedCandidate.score * 100)}% · {recommendedCandidate.reason}</div>
                </div>
                <Button size="sm" onClick={() => onSelectBook(recommendedCandidate.book_id)} disabled={pending}>
                  采用推荐
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">当前没有足够可靠的默认推荐，可以从下方候选或手动搜索中选择。</div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">候选书籍</div>
            <div className="space-y-2">
              {candidates.length > 0 ? (
                candidates.map((candidate) => (
                  <button
                    key={candidate.book_id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60',
                      selectedBookId === candidate.book_id ? 'border-primary bg-primary/5' : 'border-border',
                    )}
                    onClick={() => onSelectBook(candidate.book_id)}
                    disabled={pending}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{candidate.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{candidate.author ? `${candidate.author} · ` : ''}相似度 {Math.round(candidate.score * 100)}%</div>
                        <div className="mt-1 text-xs text-muted-foreground">{candidate.reason}</div>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', confidenceClassName(candidate.confidence))}>
                        {confidenceLabel(candidate.confidence)}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">当前没有返回匹配候选。</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input placeholder="手动搜索其他书籍" value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} />
              <div className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
            </div>
            {manualOnly.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
                {manualOnly.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                      selectedBookId === book.id ? 'border-primary bg-primary/5' : 'border-border bg-background',
                    )}
                    onClick={() => onSelectBook(book.id)}
                    disabled={pending}
                  >
                    <div className="font-medium text-foreground">{book.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{book.author ?? '作者未填写'}</div>
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">未找到额外搜索结果。</div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" onClick={onConfirm} disabled={selectedBookId == null || pending}>
              确认匹配
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BatchMatchDialog({
  open,
  title,
  description,
  items,
  matchMode,
  onMatchModeChange,
  selections,
  onSelectBook,
  onAdoptAllHighConfidence,
  onOpenSingleAdjust,
  onConfirm,
  onCancel,
  loading,
  submitting,
}: {
  open: boolean;
  title: string;
  description: string;
  items: FileMatchItem[];
  matchMode: MatchMode;
  onMatchModeChange: (mode: MatchMode) => void;
  selections: Record<number, number | null>;
  onSelectBook: (fileId: number, bookId: number | null) => void;
  onAdoptAllHighConfidence: () => void;
  onOpenSingleAdjust: (fileId: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  submitting: boolean;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  const selectedCount = Object.values(selections).filter((value) => value != null).length;
  const highConfidenceCount = items.filter((item) => item.confidence === 'high' && item.recommended_book_id != null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          <MatchModeSwitcher matchMode={matchMode} onMatchModeChange={onMatchModeChange} />

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-3">
            <div className="text-sm text-muted-foreground">已选 {selectedCount} 项，可一键采用 {highConfidenceCount} 项高置信推荐。</div>
            <Button variant="outline" size="sm" onClick={onAdoptAllHighConfidence} disabled={loading || submitting || highConfidenceCount === 0}>
              一键采用高置信
            </Button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">正在分析文件并生成候选…</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">当前没有可批量匹配的未关联文件。</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const selected = selections[item.file_id] ?? null;
                return (
                  <div key={item.file_id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{item.original_filename ?? '未知文件'}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{buildDerivedSummary(item.derived)}</div>
                        {item.reason ? <div className="mt-2 text-xs text-muted-foreground">推荐依据：{item.reason}</div> : null}
                      </div>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', confidenceClassName(item.confidence))}>
                        {confidenceLabel(item.confidence)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          selected == null ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
                        )}
                        onClick={() => onSelectBook(item.file_id, null)}
                        disabled={submitting}
                      >
                        暂不匹配
                      </button>
                      {item.candidates.map((candidate) => (
                        <button
                          key={candidate.book_id}
                          type="button"
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            selected === candidate.book_id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                          )}
                          onClick={() => onSelectBook(item.file_id, candidate.book_id)}
                          disabled={submitting}
                        >
                          {candidate.title}
                        </button>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => onOpenSingleAdjust(item.file_id)} disabled={submitting}>
                        精调
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" onClick={onConfirm} disabled={submitting || selectedCount === 0}>
              {submitting ? '提交中…' : `应用 ${selectedCount} 项匹配`}
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
              稍后处理
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
