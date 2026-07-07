import type { ChangeEvent, CSSProperties, RefObject } from 'react';
import { AlertTriangle, ArrowUpFromLine, BookOpen, Check, Cloud, Heart, ImageDown, Pencil, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookCoverItem } from '@/hooks/use-books';
import type { BookFileItem } from '@/hooks/use-files';
import type { StatusMessage } from './types';

interface BookDetailFrameHeaderProps {
  isDialog: boolean;
  onClose: () => void;
}

export function BookDetailFrameHeader({ isDialog, onClose }: BookDetailFrameHeaderProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-5">
      {!isDialog && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="返回"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
      )}
      <span className="font-display text-[15px] font-medium text-foreground">书籍详情</span>
      {isDialog && <div className="flex-1" />}
      <div className="flex items-center gap-2">
        {isDialog && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface StatusToastProps {
  message: StatusMessage | null;
}

export function StatusToast({ message }: StatusToastProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all duration-300',
        message.type === 'info'
          ? 'border-primary/15 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10'
          : message.type === 'warning'
            ? 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
            : 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15',
      )}
    >
      <span className="flex items-center gap-2">
        {message.type === 'info' ? <Check className="h-4 w-4 text-primary" /> : message.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <X className="h-4 w-4 text-destructive" />}
        <span className="font-medium">{message.text}</span>
      </span>
    </div>
  );
}

interface SidebarBook {
  title: string;
  cover_path?: string | null;
  updated_at: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  source_url?: string | null;
  favorited_at?: string | null;
}

interface BookCoverSectionProps {
  book: SidebarBook;
  bookId: number | null;
  coverUrlBase: string;
  coverTones: string[];
}

export function BookCoverSection({ book, bookId, coverUrlBase, coverTones }: BookCoverSectionProps) {
  if (book.cover_path) {
    return (
      <div className="mb-6">
        <img
          src={`${coverUrlBase}/books/${bookId}/cover?v=${encodeURIComponent(book.cover_path ?? book.updated_at)}`}
          alt={book.title}
          className="w-full rounded-xl object-cover shadow-lg aspect-[2/3]"
        />
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className={cn('flex w-full aspect-[2/3] items-center justify-center rounded-xl shadow-lg font-display text-5xl font-bold', coverTones[(bookId ?? 0) % coverTones.length])}>
        {book.title.slice(0, 1)}
      </div>
    </div>
  );
}

interface ReadingProgressBlockProps {
  progressPercent: number;
}

export function ReadingProgressBlock({ progressPercent }: ReadingProgressBlockProps) {
  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">阅读进度</span>
        <span className="font-semibold text-foreground">{progressPercent}%</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` } as CSSProperties} />
      </div>
    </div>
  );
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

interface BookTimelineProps {
  book: SidebarBook;
}

export function BookTimeline({ book }: BookTimelineProps) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">时间</div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            录入
          </span>
          <span className="font-medium text-foreground">{formatTimelineDate(book.created_at)}</span>
        </div>
        {book.started_at && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              开始阅读
            </span>
            <span className="font-medium text-foreground">{formatTimelineDate(book.started_at)}</span>
          </div>
        )}
        {book.finished_at && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              阅读完成
            </span>
            <span className="font-medium text-foreground">{formatTimelineDate(book.finished_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface BookPrimaryActionsProps {
  readableFile: BookFileItem | undefined;
  favorited: boolean;
  editMode: boolean;
  onRead: () => void;
  onToggleCoverPanel: () => void;
  onToggleEditMode: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}

export function BookPrimaryActions({ readableFile, favorited, editMode, onRead, onToggleCoverPanel, onToggleEditMode, onFavorite, onDelete }: BookPrimaryActionsProps) {
  return (
    <div className="mb-6 space-y-2.5">
      <button
        type="button"
        disabled={!readableFile}
        title={readableFile ? '打开阅读/预览' : '请先上传可预览文件'}
        onClick={onRead}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,119,87,0.25)] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BookOpen className="h-4 w-4" />
        打开阅读/预览
      </button>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">EPUB 保留阅读留痕能力，PDF、Markdown、TXT 和图片先支持在线预览</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToggleCoverPanel}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground shadow-sm transition-all hover:-translate-y-px"
        >
          <ArrowUpFromLine className="h-3.5 w-3.5" />
          选择封面
        </button>
        <button
          type="button"
          onClick={onToggleEditMode}
          className={cn(
            'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card text-xs font-medium text-foreground shadow-sm transition-all hover:-translate-y-px',
            editMode ? 'border-primary bg-primary/10 text-primary' : 'border-border',
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          {editMode ? '完成编辑' : '编辑信息'}
        </button>
      </div>
      <button
        type="button"
        onClick={onFavorite}
        className={cn(
          'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border bg-card text-xs font-medium shadow-sm transition-all hover:-translate-y-px',
          favorited ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground',
        )}
        title={favorited ? '取消收藏' : '加入收藏'}
      >
        <Heart className={cn('h-3.5 w-3.5', favorited ? 'fill-current' : '')} />
        {favorited ? '已收藏' : '收藏'}
      </button>
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
          title="将此书移入回收站"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除此书
        </button>
      </div>
    </div>
  );
}

export type CoverGroups = [string, { label: string; items: BookCoverItem[] }][] | null;

interface BookCoverManagerProps {
  book: SidebarBook;
  bookId: number | null;
  coverUrlBase: string;
  coverGroups: CoverGroups;
  coverInputRef: RefObject<HTMLInputElement>;
  fetchCoverPending: boolean;
  onUploadCover: (event: ChangeEvent<HTMLInputElement>) => void;
  onActivateCover: (coverId: number) => void;
  onDeleteCover: (coverId: number) => void;
  onFetchCover: () => void;
}

export function BookCoverManager({ book, bookId, coverUrlBase, coverGroups, coverInputRef, fetchCoverPending, onUploadCover, onActivateCover, onDeleteCover, onFetchCover }: BookCoverManagerProps) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">封面管理</span>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted/70">
          <Upload className="h-3 w-3" />
          上传
          <input ref={coverInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.gif,.bmp" onChange={onUploadCover} />
        </label>
      </div>
      {coverGroups && coverGroups.length > 0 ? (
        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
          {coverGroups.map(([type, { label, items }]) => (
            <div key={type}>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
              <div className="space-y-2">
                {items.map((cover) => (
                  <div key={cover.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2">
                    <img
                      src={`${coverUrlBase}/books/${bookId}/covers/${cover.id}/file?ts=${encodeURIComponent(cover.updated_at)}`}
                      alt={book.title}
                      className="h-12 w-9 rounded object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      {cover.is_active === 1 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">当前</span>}
                      {cover.source_label && <p className="truncate text-[10px] text-muted-foreground">{cover.source_label}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {cover.is_active !== 1 && (
                        <button type="button" onClick={() => onActivateCover(cover.id)} className="text-[10px] text-primary hover:underline">
                          设为当前
                        </button>
                      )}
                      <button type="button" onClick={() => onDeleteCover(cover.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <ImageDown className="h-5 w-5 text-muted-foreground/30" />
          <p className="mt-2 text-[12px] text-muted-foreground">暂无封面</p>
          <p className="mt-1 text-[10px] text-muted-foreground/50">上传或从介绍页下载</p>
        </div>
      )}
      {book.source_url && (
        <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
          <button type="button" onClick={onFetchCover} disabled={fetchCoverPending} className="text-xs text-primary hover:underline disabled:opacity-50">
            {fetchCoverPending ? '下载中...' : '下载封面'}
          </button>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return '';
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

interface BookFilesListProps {
  files: BookFileItem[] | undefined;
  onDeleteFile: (file: BookFileItem) => void;
}

export function BookFilesList({ files, onDeleteFile }: BookFilesListProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">文件</div>
      {files && files.length > 0 ? (
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="group flex items-center gap-2 py-1.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', file.is_primary === 1 ? 'bg-primary' : 'bg-muted-foreground/40')} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{file.original_filename ?? '未知文件'}</span>
              <StorageStatusBadge file={file} />
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatFileSize(file.file_size)}</span>
              <button
                type="button"
                onClick={() => onDeleteFile(file)}
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                title="删除文件"
                aria-label={`删除 ${file.original_filename ?? '文件'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-[12px] text-muted-foreground/60">暂无文件</div>
      )}
    </div>
  );
}
