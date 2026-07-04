import { AlertTriangle, CheckCircle2, Cloud, FileText, FileWarning, Files, HardDrive, Link, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/page-ui/stat-card';
import { SegmentedToggle } from '@/components/page-ui/segmented-toggle';
import { cn } from '@/lib/utils';
import type { BookFileItem } from '@/hooks/use-files';
import type { MatchCandidate, MatchMode } from './match-utils';
import { FORMAT_OPTIONS, MATCH_MODE_OPTIONS, formatSize, levelClassName, levelLabel, storageModeLabel } from './match-utils';

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
}: {
  unlinkedCount: number;
  onShowUnlinked: () => void;
}) {
  if (unlinkedCount <= 0) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-amber-700 dark:text-amber-300">{unlinkedCount} 个文件尚未关联书籍</span>
        <span className="ml-2 text-[12px] text-amber-600/70 dark:text-amber-400/70">建议尽快匹配，未关联文件不会出现在书架中</span>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400" onClick={onShowUnlinked}>
        只看未关联
      </Button>
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
}: {
  formatFilter: string;
  onFormatChange: (value: string) => void;
  associatedFilter: 'all' | 'true' | 'false';
  onAssociatedChange: (value: 'all' | 'true' | 'false') => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileSelected: (file: File) => void;
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
                      匹配书籍
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

export function MatchDialog({
  open,
  currentFilename,
  matchMode,
  onMatchModeChange,
  searchQuery,
  onSearchQueryChange,
  onResetQuery,
  recommendedCandidate,
  candidates,
  selectedBookId,
  onSelectBook,
  onAdoptRecommended,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  currentFilename: string | null | undefined;
  matchMode: MatchMode;
  onMatchModeChange: (mode: MatchMode) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onResetQuery: () => void;
  recommendedCandidate: MatchCandidate | null;
  candidates: MatchCandidate[];
  selectedBookId: number | null;
  onSelectBook: (bookId: number) => void;
  onAdoptRecommended: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="max-h-[85vh] w-[640px] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">匹配书籍</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentFilename ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="text-xs text-muted-foreground">当前文件</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">{currentFilename}</div>
            </div>
          ) : null}

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

          <div className="flex gap-2">
            <Input placeholder="默认已带入文件关键词，可直接搜索" value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} />
            <Button size="sm" onClick={onResetQuery}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {recommendedCandidate ? (
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
                  <div className="mt-1 text-xs text-muted-foreground">相似度 {Math.round(recommendedCandidate.score * 100)}% · {recommendedCandidate.reason}</div>
                  {recommendedCandidate.author ? <div className="mt-1 text-xs text-muted-foreground">作者：{recommendedCandidate.author}</div> : null}
                </div>
                <Button size="sm" onClick={onAdoptRecommended} disabled={pending || recommendedCandidate.level === 'low'}>
                  采用结果
                </Button>
              </div>
              {recommendedCandidate.ambiguous ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  存在多个接近候选，请重点检查下方列表。
                </div>
              ) : null}
            </div>
          ) : null}

          {candidates.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">候选书籍</div>
                <div className="text-xs text-muted-foreground">已默认带入关键词，无需重新输入</div>
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60',
                      selectedBookId === candidate.id ? 'border-primary bg-primary/5' : 'border-border',
                      candidate.level === 'medium' && 'border-amber-200 dark:border-amber-900',
                    )}
                    onClick={() => onSelectBook(candidate.id)}
                    disabled={pending}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{candidate.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{candidate.author ? `${candidate.author} · ` : ''}相似度 {Math.round(candidate.score * 100)}%</div>
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
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">暂未找到候选书籍。可以微调关键词，或切到更宽松的匹配分级。</div>
          )}

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
