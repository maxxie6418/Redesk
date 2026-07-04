import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useBooks } from '@/hooks/use-books';
import {
  useApplyFileMatches,
  useFileMatchCandidates,
  useMatchFileToBook,
  useUploadUnassociatedFile,
  type BookFileItem,
  type FileMatchItem,
  type MatchMode,
  type StorageMode,
} from '@/hooks/use-files';
import { BatchMatchDialog, MatchDialog } from '@/routes/file-library/components';
import type { StatusMessage } from './types';

const STORAGE_MODE_LABELS: Record<StorageMode, string> = {
  local_only: '仅保存在当前设备',
  cloud_only: '仅保存在云端',
  dual: '本地和云端都保留',
};

const ACCEPTED_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.txt', '.azw3', '.azw', '.djvu', '.docx', '.fb2'];

interface BatchFileItem {
  file: File;
  mode: StorageMode;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error: string | null;
  uploadedFile: BookFileItem | null;
}

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

export function BatchUploadMatchCard({
  defaultMode,
  cloudAvailable,
  onToast,
}: {
  defaultMode: StorageMode;
  cloudAvailable: boolean;
  onToast: (msg: StatusMessage) => void;
}) {
  const uploadUnassociated = useUploadUnassociatedFile();
  const applyMatches = useApplyFileMatches();
  const matchFile = useMatchFileToBook();
  const [items, setItems] = useState<BatchFileItem[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [batchMatchOpen, setBatchMatchOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [matchSelections, setMatchSelections] = useState<Record<number, number | null>>({});
  const [singleMatchFileId, setSingleMatchFileId] = useState<number | null>(null);
  const [singleSelectedBookId, setSingleSelectedBookId] = useState<number | null>(null);
  const [singleSearchQuery, setSingleSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedFiles = items.flatMap((item) => (item.status === 'success' && item.uploadedFile ? [item.uploadedFile] : []));
  const batchCandidates = useFileMatchCandidates(uploadedFiles.map((file) => file.id), matchMode, batchMatchOpen && uploadedFiles.length > 0);
  const singleCandidates = useFileMatchCandidates(singleMatchFileId != null ? [singleMatchFileId] : [], matchMode, singleMatchFileId != null);
  const manualBookSearch = useBooks({ q: singleSearchQuery, page_size: 20 });

  useEffect(() => {
    if (!batchMatchOpen || !batchCandidates.data) return;
    setMatchSelections((current) => {
      const next = { ...current };
      for (const item of batchCandidates.data) {
        if (!(item.file_id in next)) next[item.file_id] = item.recommended_book_id;
      }
      return next;
    });
  }, [batchCandidates.data, batchMatchOpen]);

  useEffect(() => {
    const current = singleCandidates.data?.[0];
    if (!current) return;
    setSingleSelectedBookId((selected) => selected ?? current.recommended_book_id ?? null);
  }, [singleCandidates.data]);

  function handleFiles(files: FileList | null) {
    if (!files) return;

    const accepted = Array.from(files).filter((file) => {
      const dotIndex = file.name.lastIndexOf('.');
      const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
      return ACCEPTED_EXTENSIONS.includes(ext);
    });

    if (accepted.length === 0) {
      onToast({ type: 'error', text: '未识别到支持的电子书格式。' });
      return;
    }

    setItems(
      accepted.map((file) => ({
        file,
        mode: defaultMode,
        status: 'pending',
        error: null,
        uploadedFile: null,
      })),
    );
    setUploadDialogOpen(true);
    if (inputRef.current) inputRef.current.value = '';
  }

  function closeAll() {
    setUploadDialogOpen(false);
    setBatchMatchOpen(false);
    setItems([]);
    setMatchSelections({});
    setSingleMatchFileId(null);
    setSingleSelectedBookId(null);
    setSingleSearchQuery('');
  }

  async function handleUpload() {
    if (items.length === 0) return;

    setIsUploading(true);
    setItems((current) => current.map((item) => (item.status === 'pending' ? { ...item, status: 'uploading' } : item)));

    const results: BatchFileItem[] = [];
    for (const item of items) {
      if (!cloudAvailable && item.mode !== 'local_only') {
        results.push({
          ...item,
          status: 'error',
          error: '云存储尚未配置，当前只能上传到本地。',
          uploadedFile: null,
        });
        continue;
      }

      try {
        const uploadedFile = await uploadUnassociated.mutateAsync({ file: item.file, storageMode: item.mode });
        results.push({ ...item, status: 'success', error: null, uploadedFile });
      } catch (error) {
        results.push({
          ...item,
          status: 'error',
          error: error instanceof Error ? error.message : '上传失败',
          uploadedFile: null,
        });
      }
    }

    setItems(results);
    setIsUploading(false);

    const successCount = results.filter((item) => item.status === 'success').length;
    const failedCount = results.filter((item) => item.status === 'error').length;
    if (failedCount === 0) {
      onToast({ type: 'info', text: `全部上传成功，共 ${successCount} 个文件。` });
      return;
    }

    onToast({ type: 'error', text: `上传完成：成功 ${successCount} 个，失败 ${failedCount} 个。` });
  }

  async function handleBatchConfirm() {
    const payload = Object.entries(matchSelections)
      .filter((entry): entry is [string, number] => entry[1] != null)
      .map(([fileId, bookId]) => ({ fileId: Number(fileId), bookId }));

    if (payload.length === 0) {
      onToast({ type: 'error', text: '请至少选择一个要匹配的文件。' });
      return;
    }

    try {
      const result = await applyMatches.mutateAsync(payload);
      if (result.failed_count > 0) {
        onToast({ type: 'error', text: `已匹配 ${result.success_count} 个文件，另有 ${result.failed_count} 个失败。` });
        setBatchMatchOpen(false);
        return;
      }

      onToast({ type: 'info', text: `已完成 ${result.success_count} 个文件的匹配。` });
      closeAll();
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '批量匹配失败' });
    }
  }

  async function handleSingleConfirm() {
    if (singleMatchFileId == null || singleSelectedBookId == null) return;

    try {
      await matchFile.mutateAsync({ fileId: singleMatchFileId, bookId: singleSelectedBookId });
      setMatchSelections((current) => ({ ...current, [singleMatchFileId]: singleSelectedBookId }));
      setSingleMatchFileId(null);
      setSingleSelectedBookId(null);
      setSingleSearchQuery('');
      onToast({ type: 'info', text: '文件已匹配到书籍。' });
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '匹配失败' });
    }
  }

  const currentSingleMatch = singleCandidates.data?.[0] ?? null;
  const fallbackSingleFile = uploadedFiles.find((file) => file.id === singleMatchFileId) ?? null;
  const batchItems = batchCandidates.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">批量上传</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />

          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            选择文件批量上传
          </Button>

          {uploadDialogOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="max-h-[80vh] w-full max-w-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">批量上传</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    共 {items.length} 个文件，默认保存方式：{STORAGE_MODE_LABELS[defaultMode]}
                  </p>
                </CardHeader>

                <CardContent className="max-h-[50vh] overflow-auto">
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(item.file.size / 1024))} KB</p>
                          {item.error ? <p className="mt-1 text-xs text-destructive">{item.error}</p> : null}
                        </div>

                        <Select
                          value={item.mode}
                          disabled={isUploading}
                          onChange={(event) => {
                            const mode = event.target.value as StorageMode;
                            setItems((current) => current.map((entry, currentIndex) => (currentIndex === index ? { ...entry, mode } : entry)));
                          }}
                          className="w-40"
                        >
                          <option value="local_only">{STORAGE_MODE_LABELS.local_only}</option>
                          <option value="cloud_only" disabled={!cloudAvailable}>
                            {STORAGE_MODE_LABELS.cloud_only}
                          </option>
                          <option value="dual" disabled={!cloudAvailable}>
                            {STORAGE_MODE_LABELS.dual}
                          </option>
                        </Select>

                        <div className="w-16 text-right text-xs">
                          {item.status === 'success' ? <span className="text-emerald-600">成功</span> : null}
                          {item.status === 'error' ? <span className="text-destructive">失败</span> : null}
                          {item.status === 'uploading' ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : null}
                          {item.status === 'pending' ? <span className="text-muted-foreground">待上传</span> : null}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isUploading}
                          onClick={() => setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <div className="flex items-center justify-end gap-2 border-t border-border p-4">
                  {uploadedFiles.length > 0 ? (
                    <Button variant="outline" onClick={() => setBatchMatchOpen(true)} disabled={isUploading}>
                      继续匹配 {uploadedFiles.length} 个成功文件
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={closeAll} disabled={isUploading}>
                    暂时完成
                  </Button>
                  <Button onClick={() => void handleUpload()} disabled={isUploading || items.length === 0}>
                    {isUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    开始上传
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}

          <BatchMatchDialog
            open={batchMatchOpen}
            title="批量匹配刚上传的文件"
            description="上传后的匹配是可选动作。如果你现在想顺手完成关联，可以在这里批量应用推荐。"
            items={batchItems}
            matchMode={matchMode}
            onMatchModeChange={(mode) => {
              setMatchMode(mode);
              setMatchSelections({});
            }}
            selections={matchSelections}
            onSelectBook={(fileId, bookId) => {
              setMatchSelections((current) => ({ ...current, [fileId]: bookId }));
            }}
            onAdoptAllHighConfidence={() => {
              setMatchSelections((current) => {
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
              setSingleSelectedBookId(matchSelections[fileId] ?? null);
              setSingleSearchQuery('');
            }}
            onConfirm={() => void handleBatchConfirm()}
            onCancel={() => setBatchMatchOpen(false)}
            loading={batchCandidates.isLoading}
            submitting={applyMatches.isPending}
          />

          <MatchDialog
            open={singleMatchFileId != null}
            file={currentSingleMatch ?? (fallbackSingleFile ? createFallbackMatchItem(fallbackSingleFile) : null)}
            matchMode={matchMode}
            onMatchModeChange={setMatchMode}
            recommendedCandidate={currentSingleMatch?.candidates[0] ?? null}
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
        </div>
      </CardContent>
    </Card>
  );
}
