import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '@/hooks/use-books';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  useApplyFileMatches,
  useDeleteFile,
  useDeleteUnassociatedFile,
  useFileLibrary,
  useFileMatchCandidates,
  useMatchFileToBook,
  useUploadUnassociatedFile,
  type BookFileItem,
  type FileMatchCandidate,
  type FileMatchItem,
  type MatchMode,
} from '@/hooks/use-files';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { ProtectedShell } from '@/components/protected-shell';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { BookDetailSheet } from '@/components/book-detail-sheet';
import { Button } from '@/components/ui/button';
import { useShellUser } from '@/components/shell-user-context';
import { BatchMatchDialog, FileLibraryStats, FileLibraryToolbar, FilesTable, MatchDialog, UnlinkedWarning } from './components';
import { formatSize, formatTotalSize } from './match-utils';

function createFallbackMatchItem(file: BookFileItem): FileMatchItem {
  return {
    file_id: file.id,
    original_filename: file.original_filename,
    file_format: file.file_format,
    derived: {
      filename_title: null,
      filename_author: null,
      normalized_filename: '',
      epub_title: null,
      epub_author: null,
      epub_publisher: null,
      epub_identifier: null,
    },
    recommended_book_id: null,
    confidence: 'low',
    reason: null,
    candidates: [],
  };
}

export function FileLibraryPage() {
  const sidebarStats = useSidebarStats();
  const user = useShellUser();
  const navigate = useNavigate();
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [associatedFilter, setAssociatedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [batchMatchOpen, setBatchMatchOpen] = useState(false);
  const [singleMatchFileId, setSingleMatchFileId] = useState<number | null>(null);
  const [singleSearchQuery, setSingleSearchQuery] = useState('');
  const [singleSelectedBookId, setSingleSelectedBookId] = useState<number | null>(null);
  const [batchSelections, setBatchSelections] = useState<Record<number, number | null>>({});
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
  const applyMatches = useApplyFileMatches();
  const deleteUnassociated = useDeleteUnassociatedFile();
  const deleteFile = useDeleteFile();
  const debouncedSingleSearchQuery = useDebouncedValue(singleSearchQuery.trim());
  const manualBookSearch = useBooks(
    { q: debouncedSingleSearchQuery, page_size: 20 },
    { enabled: singleMatchFileId != null && debouncedSingleSearchQuery.length > 0 },
  );

  const allFiles = useMemo<BookFileItem[]>(() => files.data?.data ?? [], [files.data]);
  const unlinkedFiles = useMemo(() => allFiles.filter((file) => file.book_id == null), [allFiles]);
  const pagination = files.data?.pagination ?? { page: 1, page_size: 50, total: 0 };
  const totalCount = pagination.total;
  const linkedCount = files.data?.summary?.linked ?? allFiles.filter((file) => file.book_id != null).length;
  const unlinkedCount = files.data?.summary?.unlinked ?? unlinkedFiles.length;
  const totalSize = files.data?.summary?.total_size ?? allFiles.reduce((sum, file) => sum + (file.file_size ?? 0), 0);

  const batchCandidates = useFileMatchCandidates(
    unlinkedFiles.map((file) => file.id),
    matchMode,
    batchMatchOpen && unlinkedFiles.length > 0,
  );
  const singleCandidates = useFileMatchCandidates(
    singleMatchFileId != null ? [singleMatchFileId] : [],
    matchMode,
    singleMatchFileId != null,
  );

  const batchItems = useMemo(() => batchCandidates.data ?? [], [batchCandidates.data]);
  const currentSingleMatch = singleCandidates.data?.[0] ?? null;
  const currentSingleFile = singleMatchFileId == null ? null : allFiles.find((file) => file.id === singleMatchFileId) ?? null;

  useEffect(() => {
    if (!batchMatchOpen || batchItems.length === 0) return;
    setBatchSelections((current) => {
      const next = { ...current };
      for (const item of batchItems) {
        if (!(item.file_id in next)) next[item.file_id] = item.recommended_book_id;
      }
      return next;
    });
  }, [batchItems, batchMatchOpen]);

  useEffect(() => {
    if (!currentSingleMatch) return;
    setSingleSelectedBookId((current) => current ?? currentSingleMatch.recommended_book_id ?? null);
  }, [currentSingleMatch]);

  const handleUploadUnassociated = useCallback(
    async (file: File) => {
      try {
        await uploadUnassociated.mutateAsync({ file });
      } catch {
        // mutation handles error
      }
    },
    [uploadUnassociated],
  );

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

  const handleBatchConfirm = useCallback(async () => {
    const items = Object.entries(batchSelections)
      .filter((entry): entry is [string, number] => entry[1] != null)
      .map(([fileId, bookId]) => ({ fileId: Number(fileId), bookId }));

    if (items.length === 0) return;

    try {
      await applyMatches.mutateAsync(items);
      setBatchMatchOpen(false);
      setBatchSelections({});
      setSingleMatchFileId(null);
    } catch {
      // mutation handles error
    }
  }, [applyMatches, batchSelections]);

  const handleSingleConfirm = useCallback(async () => {
    if (singleMatchFileId == null || singleSelectedBookId == null) return;

    try {
      await matchFile.mutateAsync({ fileId: singleMatchFileId, bookId: singleSelectedBookId });
      setSingleMatchFileId(null);
      setSingleSelectedBookId(null);
      setSingleSearchQuery('');
    } catch {
      // mutation handles error
    }
  }, [matchFile, singleMatchFileId, singleSelectedBookId]);

  const recommendedSingleCandidate: FileMatchCandidate | null = currentSingleMatch?.candidates[0] ?? null;

  return (
    <ProtectedShell activeKey="files" stats={sidebarStats} mainClassName="min-w-0 flex-1 overflow-y-auto px-8 py-7">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-foreground">书库文件</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">管理所有导入的电子书文件，共 {totalCount} 个文件。</p>
        </div>
        {user.is_admin ? (
          <Button variant="outline" onClick={() => navigate('/settings?tab=batch')}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            去批量管理
          </Button>
        ) : null}
      </div>

      <FileLibraryStats totalCount={totalCount} linkedCount={linkedCount} unlinkedCount={unlinkedCount} totalSize={formatTotalSize(totalSize)} />

      <UnlinkedWarning
        unlinkedCount={unlinkedCount}
        onShowUnlinked={() => setAssociatedFilter('false')}
        onBatchMatch={() => setBatchMatchOpen(true)}
      />

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
          onBatchMatch={() => setBatchMatchOpen(true)}
          batchMatchDisabled={unlinkedFiles.length === 0}
        />

        <FilesTable
          files={allFiles}
          page={page}
          pageSize={pagination.page_size}
          total={pagination.total}
          onOpenBook={setDetailBookId}
          onOpenMatch={(fileId) => {
            setSingleMatchFileId(fileId);
            setSingleSelectedBookId(null);
            setSingleSearchQuery('');
          }}
          onDelete={setPendingDeleteFile}
          onPrevPage={() => setPage((current) => current - 1)}
          onNextPage={() => setPage((current) => current + 1)}
        />
      </div>

      <BatchMatchDialog
        open={batchMatchOpen}
        title="批量匹配未关联文件"
        description="上传后匹配不是必须动作；如果你现在想一口气处理未关联文件，可以在这里批量完成。"
        items={batchItems}
        matchMode={matchMode}
        onMatchModeChange={(mode) => {
          setMatchMode(mode);
          setBatchSelections({});
          setSingleSelectedBookId(null);
        }}
        selections={batchSelections}
        onSelectBook={(fileId, bookId) => {
          setBatchSelections((current) => ({ ...current, [fileId]: bookId }));
        }}
        onAdoptAllHighConfidence={() => {
          setBatchSelections((current) => {
            const next = { ...current };
            for (const item of batchItems) {
              if (item.confidence === 'high' && item.recommended_book_id != null) {
                next[item.file_id] = item.recommended_book_id;
              }
            }
            return next;
          });
        }}
        onOpenSingleAdjust={(fileId) => {
          setSingleMatchFileId(fileId);
          setSingleSelectedBookId(batchSelections[fileId] ?? null);
          setSingleSearchQuery('');
        }}
        onConfirm={() => void handleBatchConfirm()}
        onCancel={() => {
          setBatchMatchOpen(false);
          setBatchSelections({});
        }}
        loading={batchCandidates.isLoading}
        submitting={applyMatches.isPending}
      />

      <MatchDialog
        open={singleMatchFileId != null}
        file={currentSingleMatch ?? (currentSingleFile ? createFallbackMatchItem(currentSingleFile) : null)}
        matchMode={matchMode}
        onMatchModeChange={setMatchMode}
        recommendedCandidate={recommendedSingleCandidate}
        candidates={currentSingleMatch?.candidates ?? []}
        manualResults={manualBookSearch.data?.data ?? []}
        searchQuery={singleSearchQuery}
        onSearchQueryChange={setSingleSearchQuery}
        selectedBookId={singleSelectedBookId}
        onSelectBook={setSingleSelectedBookId}
        onConfirm={() => void handleSingleConfirm()}
        onCancel={() => {
          setSingleMatchFileId(null);
          setSingleSelectedBookId(null);
          setSingleSearchQuery('');
        }}
        pending={matchFile.isPending || singleCandidates.isLoading}
      />

      <ConfirmDialog
        open={pendingDeleteFile !== null}
        destructive
        title="删除此文件？"
        description={
          pendingDeleteFile ? (
            <div className="space-y-1">
              <p>这会永久删除该文件及其存储对象。</p>
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
