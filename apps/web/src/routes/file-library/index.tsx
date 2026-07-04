import { useCallback, useEffect, useRef, useState } from 'react';
import { useBooks, type BookSummary } from '@/hooks/use-books';
import {
  useDeleteFile,
  useDeleteUnassociatedFile,
  useFileLibrary,
  useMatchFileToBook,
  useUploadUnassociatedFile,
  type BookFileItem,
} from '@/hooks/use-files';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { ProtectedShell } from '@/components/protected-shell';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { BookDetailSheet } from '@/components/book-detail-sheet';
import { formatSize, formatTotalSize, buildCandidate, extractSearchSeed, type MatchCandidate, type MatchMode } from './match-utils';
import { FileLibraryStats, FileLibraryToolbar, FilesTable, MatchDialog, UnlinkedWarning } from './components';

export function FileLibraryPage() {
  const sidebarStats = useSidebarStats();
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [associatedFilter, setAssociatedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [matchDialog, setMatchDialog] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<BookFileItem | null>(null);
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const deleteFile = useDeleteFile();
  const bookSearch = useBooks({ q: searchQuery, page_size: 20 });

  const handleMatch = useCallback(async (fileId: number, bookId: number) => {
    try {
      await matchFile.mutateAsync({ fileId, bookId });
      setMatchDialog(null);
      setSelectedBookId(null);
    } catch {
      // mutation handles error
    }
  }, [matchFile]);

  const handleConfirmDeleteFile = useCallback(async () => {
    const target = pendingDeleteFile;
    if (!target) return;
    setPendingDeleteFile(null);
    try {
      if (target.book_id != null) {
        await deleteFile.mutateAsync({ bookId: target.book_id, fileId: target.id });
      } else {
        await deleteUnassociated.mutateAsync(target.id);
      }
    } catch {
      // mutation handles error
    }
  }, [deleteFile, deleteUnassociated, pendingDeleteFile]);

  const handleUploadUnassociated = useCallback(async (file: File) => {
    try {
      await uploadUnassociated.mutateAsync(file);
    } catch {
      // mutation handles error
    }
  }, [uploadUnassociated]);

  const allFiles: BookFileItem[] = files.data?.data ?? [];
  const pagination = files.data?.pagination ?? { page: 1, page_size: 50, total: 0 };
  const totalCount = pagination.total;
  const linkedCount = files.data?.summary?.linked ?? allFiles.filter((file) => file.book_id != null).length;
  const unlinkedCount = files.data?.summary?.unlinked ?? allFiles.filter((file) => file.book_id == null).length;
  const totalSize = files.data?.summary?.total_size ?? allFiles.reduce((sum, file) => sum + (file.file_size ?? 0), 0);
  const currentMatchFile = matchDialog == null ? null : allFiles.find((file) => file.id === matchDialog) ?? null;

  const preliminaryCandidates = (bookSearch.data?.data ?? [])
    .map((book: BookSummary) => ({
      book,
      preview: buildCandidate(currentMatchFile?.original_filename, book, matchMode, 0),
    }))
    .sort((left, right) => right.preview.score - left.preview.score);

  const candidates: MatchCandidate[] = preliminaryCandidates.map((entry, index) =>
    buildCandidate(currentMatchFile?.original_filename, entry.book, matchMode, preliminaryCandidates[index + 1]?.preview.score ?? 0),
  );

  const recommendedCandidate = candidates[0] ?? null;

  useEffect(() => {
    if (!currentMatchFile) return;
    setSearchQuery(extractSearchSeed(currentMatchFile.original_filename));
    setSelectedBookId(null);
  }, [currentMatchFile]);

  useEffect(() => {
    if (!recommendedCandidate || recommendedCandidate.level !== 'high') return;
    setSelectedBookId((current) => current ?? recommendedCandidate.id);
  }, [recommendedCandidate]);

  return (
    <ProtectedShell activeKey="files" stats={sidebarStats} mainClassName="min-w-0 flex-1 overflow-y-auto px-8 py-7">
      <div className="mb-6">
        <h1 className="font-display text-[26px] font-semibold text-foreground">书库文件</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">管理所有导入的电子书文件，共 {totalCount} 个文件</p>
      </div>

      <FileLibraryStats totalCount={totalCount} linkedCount={linkedCount} unlinkedCount={unlinkedCount} totalSize={formatTotalSize(totalSize)} />
      <UnlinkedWarning unlinkedCount={unlinkedCount} onShowUnlinked={() => setAssociatedFilter('false')} />

      <div className="rounded-xl border border-border bg-card">
        <FileLibraryToolbar
          formatFilter={formatFilter}
          onFormatChange={(value) => {
            setFormatFilter(value);
            setPage(1);
          }}
          associatedFilter={associatedFilter}
          onAssociatedChange={(value) => {
            setAssociatedFilter(value);
            setPage(1);
          }}
          fileInputRef={fileInputRef}
          onFileSelected={(file) => {
            void handleUploadUnassociated(file);
          }}
        />

        <FilesTable
          files={allFiles}
          page={page}
          pageSize={pagination.page_size}
          total={pagination.total}
          onOpenBook={setDetailBookId}
          onOpenMatch={setMatchDialog}
          onDelete={setPendingDeleteFile}
          onPrevPage={() => setPage((current) => current - 1)}
          onNextPage={() => setPage((current) => current + 1)}
        />
      </div>

      <MatchDialog
        open={matchDialog != null}
        currentFilename={currentMatchFile?.original_filename}
        matchMode={matchMode}
        onMatchModeChange={setMatchMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResetQuery={() => setSearchQuery(extractSearchSeed(currentMatchFile?.original_filename))}
        recommendedCandidate={recommendedCandidate}
        candidates={candidates}
        selectedBookId={selectedBookId}
        onSelectBook={setSelectedBookId}
        onAdoptRecommended={() => {
          if (matchDialog != null && recommendedCandidate) {
            void handleMatch(matchDialog, recommendedCandidate.id);
          }
        }}
        onConfirm={() => {
          if (matchDialog != null && selectedBookId != null) {
            void handleMatch(matchDialog, selectedBookId);
          }
        }}
        onCancel={() => {
          setMatchDialog(null);
          setSelectedBookId(null);
        }}
        pending={matchFile.isPending}
      />

      <ConfirmDialog
        open={pendingDeleteFile !== null}
        destructive
        title="删除此文件？"
        description={
          pendingDeleteFile ? (
            <div className="space-y-1">
              <p>将永久删除该文件及其存储对象。</p>
              <p className="text-xs text-muted-foreground">
                {pendingDeleteFile.original_filename ?? '未命名文件'}
                {pendingDeleteFile.file_size != null ? ` (${formatSize(pendingDeleteFile.file_size)})` : ''}
              </p>
            </div>
          ) : null
        }
        confirmLabel="删除文件"
        cancelLabel="取消"
        confirmDisabled={deleteFile.isPending || deleteUnassociated.isPending}
        onConfirm={() => void handleConfirmDeleteFile()}
        onCancel={() => setPendingDeleteFile(null)}
      />

      <BookDetailSheet bookId={detailBookId} open={detailBookId !== null} onClose={() => setDetailBookId(null)} variant="dialog" />
    </ProtectedShell>
  );
}
