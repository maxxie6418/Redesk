import { useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '@/lib/api';
import type {
  BookDetail,
  useActivateBookCover,
  useDeleteBook,
  useDeleteBookCover,
  useFavoriteBook,
  useFetchBookCover,
  useUnfavoriteBook,
  useUploadBookCover,
} from '@/hooks/use-books';
import type { BookFileItem, useDeleteFile } from '@/hooks/use-files';

export interface BookActionMutations {
  favoriteBook: ReturnType<typeof useFavoriteBook>;
  unfavoriteBook: ReturnType<typeof useUnfavoriteBook>;
  fetchCover: ReturnType<typeof useFetchBookCover>;
  activateCover: ReturnType<typeof useActivateBookCover>;
  deleteCover: ReturnType<typeof useDeleteBookCover>;
  uploadCover: ReturnType<typeof useUploadBookCover>;
  deleteBook: ReturnType<typeof useDeleteBook>;
  deleteFile: ReturnType<typeof useDeleteFile>;
}

export interface UseBookActionsParams {
  bookId: number | null;
  book: BookDetail | undefined;
  mutations: BookActionMutations;
  openMetadataDialog: () => Promise<void> | void;
  applyMetadata: () => Promise<void>;
  setPendingBookDelete: Dispatch<SetStateAction<boolean>>;
  setPendingBookDeleteFiles: Dispatch<SetStateAction<boolean>>;
  setPendingFileDelete: Dispatch<SetStateAction<BookFileItem | null>>;
  pendingBookDeleteFiles: boolean;
  pendingFileDelete: BookFileItem | null;
  setShowCoverPanel: Dispatch<SetStateAction<boolean>>;
  info: (text: string) => void;
  error: (text: string) => void;
  onClose: () => void;
}

export function useBookActions({
  bookId,
  book,
  mutations,
  openMetadataDialog,
  applyMetadata,
  setPendingBookDelete,
  setPendingBookDeleteFiles,
  setPendingFileDelete,
  pendingBookDeleteFiles,
  pendingFileDelete,
  setShowCoverPanel,
  info,
  error,
  onClose,
}: UseBookActionsParams) {
  const handleFavorite = useCallback(async () => {
    if (!book || !bookId) return;
    try {
      if (book.favorited_at) {
        await mutations.unfavoriteBook.mutateAsync(bookId);
      } else {
        await mutations.favoriteBook.mutateAsync(bookId);
      }
    } catch {
      // ignore
    }
  }, [book, bookId, mutations.favoriteBook, mutations.unfavoriteBook]);

  const handleFetchCover = useCallback(async () => {
    if (!bookId) return;
    try {
      await mutations.fetchCover.mutateAsync({ bookId });
      info('封面已下载');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '封面下载失败');
    }
  }, [bookId, mutations.fetchCover, info, error]);

  const handleActivateCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await mutations.activateCover.mutateAsync({ bookId, coverId });
      info('已切换当前封面');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '切换封面失败');
    }
  }, [mutations.activateCover, bookId, info, error]);

  const handleDeleteCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await mutations.deleteCover.mutateAsync({ bookId, coverId });
      info('封面已删除');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除封面失败');
    }
  }, [bookId, mutations.deleteCover, info, error]);

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !bookId) return;
      try {
        await mutations.uploadCover.mutateAsync({ bookId, file });
        info('封面已上传');
      } catch (err) {
        error(err instanceof ApiError ? err.message : '上传封面失败');
      }
      event.target.value = '';
    },
    [bookId, mutations.uploadCover, info, error],
  );

  const handleRequestBookDelete = useCallback(() => {
    setPendingBookDeleteFiles(false);
    setPendingBookDelete(true);
  }, [setPendingBookDelete, setPendingBookDeleteFiles]);

  const handleConfirmBookDelete = useCallback(async () => {
    if (!bookId) return;
    try {
      await mutations.deleteBook.mutateAsync({ id: bookId, deleteFiles: pendingBookDeleteFiles });
      setPendingBookDelete(false);
      onClose();
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除失败');
      setPendingBookDelete(false);
    }
  }, [bookId, mutations.deleteBook, pendingBookDeleteFiles, onClose, error, setPendingBookDelete]);

  const handleRequestFileDelete = useCallback((file: BookFileItem) => {
    setPendingFileDelete(file);
  }, [setPendingFileDelete]);

  const handleConfirmFileDelete = useCallback(async () => {
    if (!bookId || !pendingFileDelete) return;
    const target = pendingFileDelete;
    setPendingFileDelete(null);
    try {
      await mutations.deleteFile.mutateAsync({ bookId, fileId: target.id });
      info('文件已删除');
    } catch (err) {
      error(err instanceof ApiError ? err.message : '删除失败');
    }
  }, [bookId, pendingFileDelete, mutations.deleteFile, info, error, setPendingFileDelete]);

  const handleOpenMetadataDialog = useCallback(() => {
    return openMetadataDialog();
  }, [openMetadataDialog]);

  const handleApplyMetadata = useCallback(async () => {
    await applyMetadata();
  }, [applyMetadata]);

  const handleToggleCoverPanel = useCallback(() => {
    setShowCoverPanel((prev) => !prev);
  }, [setShowCoverPanel]);

  return {
    handleFavorite,
    handleFetchCover,
    handleActivateCover,
    handleDeleteCover,
    handleCoverUpload,
    handleRequestBookDelete,
    handleConfirmBookDelete,
    handleRequestFileDelete,
    handleConfirmFileDelete,
    handleOpenMetadataDialog,
    handleApplyMetadata,
    handleToggleCoverPanel,
  };
}
