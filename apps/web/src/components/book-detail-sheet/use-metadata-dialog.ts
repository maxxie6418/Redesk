import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/api';
import type {
  BookDetail,
  LinkMetadata,
  useApplyBookMetadata,
  useFetchBookMetadata,
} from '@/hooks/use-books';

const METADATA_FIELDS = [
  'title',
  'author',
  'subtitle',
  'isbn',
  'publisher',
  'publish_year',
  'description',
  'language',
  'translator',
  'original_title',
  'page_count',
] as const;

interface UseMetadataDialogParams {
  bookId: number | null;
  book: BookDetail | undefined;
  fetchMetadata: ReturnType<typeof useFetchBookMetadata>;
  applyMetadata: ReturnType<typeof useApplyBookMetadata>;
  info: (text: string) => void;
  error: (text: string) => void;
}

function hasNonEmptyValue(value: unknown): boolean {
  return value != null && String(value).trim() !== '';
}

export function useMetadataDialog({
  bookId,
  book,
  fetchMetadata,
  applyMetadata,
  info,
  error,
}: UseMetadataDialogParams) {
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [metadataResult, setMetadataResult] = useState<LinkMetadata | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [fetchCoverChecked, setFetchCoverChecked] = useState(false);

  const openDialog = useCallback(async () => {
    const current = book;
    if (!current?.source_url) {
      error('请先填写介绍页链接');
      return;
    }
    try {
      const result = await fetchMetadata.mutateAsync(current.source_url);
      setMetadataResult(result);
      const initialSelected: Record<string, boolean> = {};
      for (const key of METADATA_FIELDS) {
        const value = result[key as keyof LinkMetadata];
        const currentValue = current[key as keyof BookDetail];
        if (!hasNonEmptyValue(value)) continue;
        if (!hasNonEmptyValue(currentValue)) {
          initialSelected[key] = true;
        } else {
          initialSelected[key] = false;
        }
      }
      setSelectedFields(initialSelected);
      setFetchCoverChecked(Boolean(result.cover_url) && !current.cover_path);
      setShowMetadataDialog(true);
    } catch (err) {
      error(err instanceof ApiError ? err.message : '抓取元数据失败');
    }
  }, [book, fetchMetadata, error]);

  const closeDialog = useCallback(() => {
    setShowMetadataDialog(false);
    setMetadataResult(null);
  }, []);

  const applyDialog = useCallback(async () => {
    if (!metadataResult || !bookId) return;
    const fields: Record<string, unknown> = {};
    for (const [key, checked] of Object.entries(selectedFields)) {
      if (!checked) continue;
      const value = metadataResult[key as keyof LinkMetadata];
      if (value != null) fields[key] = value;
    }
    try {
      await applyMetadata.mutateAsync({ bookId, fields, fetchCover: fetchCoverChecked });
      info('元数据已更新');
      setShowMetadataDialog(false);
      setMetadataResult(null);
    } catch (err) {
      error(err instanceof ApiError ? err.message : '更新元数据失败');
    }
  }, [bookId, metadataResult, selectedFields, fetchCoverChecked, applyMetadata, info, error]);

  return {
    showMetadataDialog,
    metadataResult,
    selectedFields,
    setSelectedFields,
    fetchCoverChecked,
    setFetchCoverChecked,
    openDialog,
    closeDialog,
    applyDialog,
  };
}
