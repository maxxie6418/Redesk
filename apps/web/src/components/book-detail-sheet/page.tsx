import { useMemo, useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { selectReadableFile } from '@redesk/shared';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useBook,
  useBookReview,
  useUpdateBook,
  useDeleteBook,
  useBookCovers,
  useFetchBookCover,
  useActivateBookCover,
  useDeleteBookCover,
  useUploadBookCover,
  useFetchBookMetadata,
  useApplyBookMetadata,
  useFavoriteBook,
  useUnfavoriteBook,
  type BookCoverItem,
} from '@/hooks/use-books';
import { useBookFiles, useDeleteFile, type BookFileItem } from '@/hooks/use-files';
import { useReadingProgress } from '@/hooks/use-reading-progress';
import { useNotes, useHighlights, type NoteItem, type HighlightItem } from '@/hooks/use-notes';
import { useAddTopicBook } from '@/hooks/use-topics';
import { useCategories } from '@/hooks/use-categories';
import { useTags } from '@/hooks/use-tags';
import { API_BASE } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { BookAiTab, BookArchiveTab, BookCoverManager, BookCoverSection, BookDetailFrameHeader, BookFilesList, BookPrimaryActions, BookTimeline, BookTopicsTab, BookTracesTab, ReadingProgressBlock, StatusToast, type BookRecentMarkItem, type BookTraceItem, type CoverGroups } from './components';
import { BookDetailTabs } from './book-detail-tabs';
import { MetadataDialog } from './metadata-dialog';
import { useDetailMessages } from './use-detail-messages';
import { useReaderNavigation } from './use-reader-navigation';
import { useMetadataDialog } from './use-metadata-dialog';
import { type DetailTab, COVER_TONES, formatFileSize } from './types';

const COVER_URL_BASE = API_BASE;

export function BookDetailSheet({ bookId, open, onClose, variant = 'sheet' }: { bookId: number | null; open: boolean; onClose: () => void; variant?: 'sheet' | 'dialog' }) {
  const book = useBook(bookId ?? 0);
  const review = useBookReview(bookId ?? 0);
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();
  const files = useBookFiles(bookId ?? 0);
  const progress = useReadingProgress(bookId ?? 0);
  const hasActiveBook = open && typeof bookId === 'number' && bookId > 0;
  const bookNotes = useNotes(bookId ?? 0, { enabled: hasActiveBook });
  const bookHighlights = useHighlights(bookId ?? 0, { enabled: hasActiveBook });
  const addTopicBook = useAddTopicBook();
  const covers = useBookCovers(bookId ?? 0);
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tagsQuery = useTags();
  const fetchCover = useFetchBookCover();
  const activateCover = useActivateBookCover();
  const deleteCover = useDeleteBookCover();
  const uploadCover = useUploadBookCover();
  const fetchMetadata = useFetchBookMetadata();
  const applyMetadataMutation = useApplyBookMetadata();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();
  const deleteFile = useDeleteFile();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [pendingBookDelete, setPendingBookDelete] = useState(false);
  const [pendingBookDeleteFiles, setPendingBookDeleteFiles] = useState(false);
  const [pendingFileDelete, setPendingFileDelete] = useState<BookFileItem | null>(null);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);

  const { message, info, error, clear } = useDetailMessages();
  const { openMarkInReader, openTraceInReader, openReader } = useReaderNavigation(bookId);
  const {
    showMetadataDialog,
    metadataResult,
    selectedFields,
    setSelectedFields,
    fetchCoverChecked,
    setFetchCoverChecked,
    openDialog: openMetadataDialog,
    closeDialog: closeMetadataDialog,
    applyDialog: applyMetadata,
  } = useMetadataDialog({
    bookId,
    book: book.data,
    fetchMetadata,
    applyMetadata: applyMetadataMutation,
    info,
    error,
  });
  const [showCoverPanel, setShowCoverPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('archive');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setEditMode(false);
    setShowCoverPanel(false);
    closeMetadataDialog();
    clear();
    setActiveTab('archive');
  }, [bookId, open, clear, closeMetadataDialog]);

  const categories = personalCategories;

  const handleUpdate = useCallback(async (_field: string, payload: Record<string, unknown>) => {
    if (!bookId) return;
    await updateBook.mutateAsync({ id: bookId, ...payload });
    info('已更新');
  }, [bookId, updateBook, info]);

  const saveText = useCallback(async (field: string, value: string, options?: { required?: boolean }) => {
    if (options?.required && !value.trim()) throw new Error('不能为空');
    await handleUpdate(field, { [field]: value || null });
  }, [handleUpdate]);

  const saveNumber = useCallback(async (field: string, value: number | null) => {
    await handleUpdate(field, { [field]: value });
  }, [handleUpdate]);

  const saveDate = useCallback(async (field: string, value: string | null) => {
    await handleUpdate(field, { [field]: value });
  }, [handleUpdate]);

  const saveSelect = useCallback(async (field: string, value: string, options?: { numberTransform?: boolean }) => {
    if (options?.numberTransform) {
      await handleUpdate(field, { [field]: value ? Number(value) : null });
    } else {
      await handleUpdate(field, { [field]: value });
    }
  }, [handleUpdate]);

  const saveTags = useCallback(async (tagIds: number[]) => {
    await handleUpdate('tag_ids', { tag_ids: tagIds });
  }, [handleUpdate]);

  const saveJson = useCallback(async (field: string, value: Record<string, unknown> | null) => {
    await handleUpdate(field, { [field]: value });
  }, [handleUpdate]);

  const handleFavorite = useCallback(async () => {
    if (!book.data || !bookId) return;
    try {
      if (book.data.favorited_at) {
        await unfavoriteBook.mutateAsync(bookId);
      } else {
        await favoriteBook.mutateAsync(bookId);
      }
    } catch {
      // ignore
    }
  }, [book.data, bookId, favoriteBook, unfavoriteBook]);

  const handleFetchCover = useCallback(async () => {
    if (!bookId) return;
    try {
      await fetchCover.mutateAsync({ bookId });
      info('封面已下载');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '封面下载失败');
    }
  }, [bookId, fetchCover, info, error]);

  const handleActivateCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await activateCover.mutateAsync({ bookId, coverId });
      info('已切换当前封面');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '切换封面失败');
    }
  }, [activateCover, bookId, info, error]);

  const handleDeleteCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await deleteCover.mutateAsync({ bookId, coverId });
      info('封面已删除');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除封面失败');
    }
  }, [bookId, deleteCover, info, error]);

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !bookId) return;
      try {
        await uploadCover.mutateAsync({ bookId, file });
        info('封面已上传');
      } catch (err) {
        error(err instanceof ApiError ? err.message : '上传封面失败');
      }
      if (coverInputRef.current) coverInputRef.current.value = '';
    },
    [bookId, uploadCover, info, error],
  );

  const handleRequestBookDelete = useCallback(() => {
    setPendingBookDeleteFiles(false);
    setPendingBookDelete(true);
  }, []);

  const handleConfirmBookDelete = useCallback(async () => {
    if (!bookId) return;
    try {
      await deleteBook.mutateAsync({ id: bookId, deleteFiles: pendingBookDeleteFiles });
      setPendingBookDelete(false);
      onClose();
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除失败');
      setPendingBookDelete(false);
    }
  }, [bookId, deleteBook, pendingBookDeleteFiles, onClose, error]);

  const handleRequestFileDelete = useCallback((file: BookFileItem) => {
    setPendingFileDelete(file);
  }, []);

  const handleConfirmFileDelete = useCallback(async () => {
    if (!bookId || !pendingFileDelete) return;
    const target = pendingFileDelete;
    setPendingFileDelete(null);
    try {
      await deleteFile.mutateAsync({ bookId, fileId: target.id });
      info('文件已删除');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除失败');
    }
  }, [bookId, pendingFileDelete, deleteFile, info, error]);

  const b = book.data;
  const progressPercent = progress.data?.percentage ?? 0;
  const readableFile = selectReadableFile<BookFileItem>(files.data);

  const reviewSummary = review.data;
  const recentMarks = (reviewSummary?.recent_marks ?? []) as BookRecentMarkItem[];
  const notes = useMemo(() => (bookNotes.data ?? []) as NoteItem[], [bookNotes.data]);
  const highlights = useMemo(() => (bookHighlights.data ?? []) as HighlightItem[], [bookHighlights.data]);
  const traces = useMemo<BookTraceItem[]>(() => {
    return [
      ...notes.map((n) => ({
        id: `n-${n.id}`,
        type: '笔记' as const,
        title: n.title ?? '无标题',
        cfi: n.cfi,
        createdAt: n.created_at,
      })),
      ...highlights.map((h) => ({
        id: `h-${h.id}`,
        type: '高亮' as const,
        title: h.text.slice(0, 80),
        cfi: h.cfi_start,
        createdAt: h.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, highlights]);
  const traceCounts = {
    highlights: reviewSummary?.counts.highlights ?? highlights.length,
    notes: reviewSummary?.counts.notes ?? notes.length,
    bookmarks: reviewSummary?.counts.bookmarks ?? 0,
  };
  const traceProgressPercent = reviewSummary?.reading_progress
    ? Math.round(reviewSummary.reading_progress.percentage * 100)
    : progress.data
      ? Math.round(progress.data.percentage)
      : 0;
  const coverGroups = useMemo<CoverGroups | null>(() => {
    if (!covers.data) return null;
    const groups: Record<string, { label: string; items: BookCoverItem[] }> = {
      EPUB_EXTRACTED: { label: 'EPUB 抽取', items: [] },
      REMOTE_FETCHED: { label: '介绍页抓取', items: [] },
      MANUAL_UPLOAD: { label: '用户上传', items: [] },
    };
    for (const cover of covers.data) {
      const g = groups[cover.source_type];
      if (g) g.items.push(cover);
      else groups[cover.source_type] = { label: cover.source_type, items: [cover] };
    }
    return Object.entries(groups).filter(([, { items }]: [string, { label: string; items: BookCoverItem[] }]) => items.length > 0);
  }, [covers.data]);

  const isDialog = variant === 'dialog';

  if (!open) return null;

  return (
    <>
    <button
      type="button"
      aria-label="关闭书籍详情"
      className={cn(
        'fixed inset-0 cursor-default bg-black/10',
        isDialog ? 'z-40 bg-black/40' : 'z-30',
      )}
      onClick={onClose}
    />
    <div
      className={cn(
        'fixed right-0 z-40 flex flex-col overflow-hidden border-l border-border bg-background shadow-2xl',
        isDialog
          ? 'inset-0 z-50 flex items-center justify-center bg-transparent p-3 shadow-none border-none sm:p-4'
          : 'inset-y-0 w-[min(1000px,calc(100vw-160px))] min-w-[720px]',
      )}
      onClick={isDialog ? onClose : undefined}
    >
      <div
        className={cn(
          'flex flex-col overflow-hidden bg-background shadow-2xl',
          isDialog
            ? 'h-full max-h-full w-full max-w-[1180px] rounded-xl border border-border'
            : 'h-full w-full',
        )}
        onClick={isDialog ? (e) => e.stopPropagation() : undefined}
      >
      <BookDetailFrameHeader isDialog={isDialog} onClose={onClose} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {book.isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {book.isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载失败</div>
        )}

        {b && (
          <div className="flex h-full">
            {/* Left Column */}
            <div className="relative w-[300px] shrink-0 border-r border-border bg-muted/30">
              <div className="h-full overflow-y-auto px-6 py-6 pr-9">
              <StatusToast message={message} />

              <BookCoverSection book={b} bookId={bookId} coverUrlBase={COVER_URL_BASE} coverTones={COVER_TONES} />
              <ReadingProgressBlock progressPercent={progressPercent} />
              <BookTimeline book={b} />
              <BookPrimaryActions
                readableFile={readableFile ?? undefined}
                favorited={Boolean(b.favorited_at)}
                editMode={editMode}
                onRead={() => {
                  if (!bookId || !readableFile) return;
                  openReader();
                }}
                onToggleCoverPanel={() => setShowCoverPanel(!showCoverPanel)}
                onToggleEditMode={() => setEditMode(!editMode)}
                onFavorite={handleFavorite}
                onDelete={handleRequestBookDelete}
              />
              {showCoverPanel && (
                <BookCoverManager
                  book={b}
                  bookId={bookId}
                  coverUrlBase={COVER_URL_BASE}
                  coverGroups={coverGroups}
                  coverInputRef={coverInputRef}
                  fetchCoverPending={fetchCover.isPending}
                  onUploadCover={handleCoverUpload}
                  onActivateCover={handleActivateCover}
                  onDeleteCover={handleDeleteCover}
                  onFetchCover={handleFetchCover}
                />
              )}
              <BookFilesList files={files.data} onDeleteFile={handleRequestFileDelete} />
              </div>

              <BookDetailTabs activeTab={activeTab} editMode={editMode} onChange={setActiveTab} onEditModeChange={setEditMode} />
            </div>

            {/* Right Column */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-8">
              {activeTab === 'archive' && (
                <BookArchiveTab
                  book={b}
                  editMode={editMode}
                  categories={categories.data}
                  genreCategories={genreCategories.data}
                  tags={tagsQuery.data}
                  fetchMetadataPending={fetchMetadata.isPending}
                  onSaveText={saveText}
                  onSaveNumber={saveNumber}
                  onSaveSelect={saveSelect}
                  onSaveDate={saveDate}
                  onSaveJson={saveJson}
                  onSaveTags={saveTags}
                  onOpenMetadataDialog={openMetadataDialog}
                />
              )}

              {activeTab === 'traces' && (
                <BookTracesTab
                  progressPercent={traceProgressPercent}
                  counts={traceCounts}
                  recentMarks={recentMarks}
                  traces={traces}
                  onOpenMark={openMarkInReader}
                  onOpenTrace={openTraceInReader}
                />
              )}

              {activeTab === 'topics' && (
                <BookTopicsTab bookId={bookId} onOpenTopicDialog={() => setTopicDialogOpen(true)} />
              )}

              {activeTab === 'ai' && <BookAiTab />}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>

    <AddToTopicDialog
      open={topicDialogOpen}
      title="将书籍加入话题"
      description="选择一个主题阅读话题，或新建话题后自动关联当前书。"
      loading={addTopicBook.isPending}
      onCancel={() => setTopicDialogOpen(false)}
      onConfirm={async (topicId: number) => {
        if (!bookId) return;
        await addTopicBook.mutateAsync({ topicId, bookId });
        info('已加入话题');
        setTopicDialogOpen(false);
      }}
    />

    {/* Metadata Dialog */}
    {showMetadataDialog && metadataResult && b && (
      <MetadataDialog
        book={b}
        metadataResult={metadataResult}
        selectedFields={selectedFields}
        setSelectedFields={setSelectedFields}
        fetchCoverChecked={fetchCoverChecked}
        setFetchCoverChecked={setFetchCoverChecked}
        isPending={applyMetadataMutation.isPending}
        onClose={closeMetadataDialog}
        onApply={applyMetadata}
      />
    )}

    <ConfirmDialog
      open={pendingBookDelete}
      destructive
      title="删除此书？"
      description={
        <div className="space-y-3">
          <p>此书将移入回收站，后续可从回收站恢复。</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pendingBookDeleteFiles}
              onChange={(e) => setPendingBookDeleteFiles(e.target.checked)}
              className="h-4 w-4 rounded border-border text-destructive focus:ring-destructive"
            />
            <span>同时删除关联的文件与封面（不可恢复）</span>
          </label>
        </div>
      }
      confirmLabel="移入回收站"
      cancelLabel="取消"
      confirmDisabled={deleteBook.isPending}
      onConfirm={handleConfirmBookDelete}
      onCancel={() => setPendingBookDelete(false)}
    />

    <ConfirmDialog
      open={pendingFileDelete !== null}
      destructive
      title="删除此文件？"
      description={
        pendingFileDelete ? (
          <div className="space-y-1">
            <p>将永久删除该文件及其存储对象。</p>
            <p className="text-xs text-muted-foreground">
              {pendingFileDelete.original_filename ?? '未命名文件'}
              {pendingFileDelete.file_size != null
                ? ` (${formatFileSize(pendingFileDelete.file_size)})`
                : ''}
            </p>
          </div>
        ) : null
      }
      confirmLabel="删除文件"
      cancelLabel="取消"
      confirmDisabled={deleteFile.isPending}
      onConfirm={handleConfirmFileDelete}
      onCancel={() => setPendingFileDelete(null)}
    />
    </>
  );
}
