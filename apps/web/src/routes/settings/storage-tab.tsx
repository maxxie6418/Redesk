import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Database,
  FolderTree,
  Image,
  Link,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useStorageSettings,
  useStorageStatus,
  useTestStorage,
  useUpdateStorageSettings,
  type StorageMode,
} from '@/hooks/use-storage-config';
import { useSystemStorage, useClearCache, type DirInfo } from '@/hooks/use-system';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatBytes, type StatusMessage } from './types';

const STORAGE_MODE_LABELS: Record<StorageMode, string> = {
  local_only: '仅保存在当前设备',
  cloud_only: '仅保存在云端',
  dual: '本地和云端都保留',
};

const MODE_DESCRIPTIONS: Record<StorageMode, string> = {
  local_only: '文件只写入本地存储，不占用云端空间，换设备时无法直接访问。',
  cloud_only: '文件只写入云端对象存储，本地不保留副本，便于多设备访问。',
  dual: '文件先写入主端，另一端标记为待同步；后续会自动补齐双端副本。',
};

export function StorageTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const storage = useSystemStorage();
  const clearCache = useClearCache();

  const dirLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    books: { label: '书籍文件', icon: <FolderTree className="h-4 w-4" /> },
    covers: { label: '封面图片', icon: <Image className="h-4 w-4" /> },
    backups: { label: '备份文件', icon: <Database className="h-4 w-4" /> },
    tmp: { label: '临时文件', icon: <Clock className="h-4 w-4" /> },
    unassociated: { label: '未关联文件', icon: <Link className="h-4 w-4" /> },
  };

  const totalSize = storage.data?.total_size_bytes ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">本地存储概况</CardTitle>
        </CardHeader>
        <CardContent>
          {storage.isLoading && <p className="text-sm text-muted-foreground">扫描中…</p>}
          {storage.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-popover px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">总占用</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">{formatBytes(totalSize)}</p>
                  <p className="text-[11px] text-muted-foreground">{storage.data.total_files} 个文件</p>
                </div>
                <div className="rounded-lg border border-border bg-popover px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">书籍文件</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {formatBytes(storage.data.breakdown.books?.size_bytes ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {storage.data.breakdown.books?.file_count ?? 0} 个
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-popover px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">封面图片</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {formatBytes(storage.data.breakdown.covers?.size_bytes ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {storage.data.breakdown.covers?.file_count ?? 0} 个
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-popover px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">数据库</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {formatBytes(storage.data.db_size_bytes)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">SQLite</p>
                </div>
              </div>

              <div className="space-y-2">
                {(Object.entries(storage.data.breakdown) as [string, DirInfo][]).map(([key, info]) => {
                  const percentage = totalSize > 0 ? ((info.size_bytes / totalSize) * 100).toFixed(1) : '0';
                  const dir = dirLabels[key] ?? { label: key, icon: <FolderTree className="h-3.5 w-3.5" /> };
                  return (
                    <div key={key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <span className="text-muted-foreground">{dir.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{dir.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(info.size_bytes)} ({percentage}%)
                          </p>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              key === 'tmp'
                                ? 'bg-orange-400'
                                : key === 'backups'
                                  ? 'bg-blue-400'
                                  : 'bg-emerald-400',
                            )}
                            style={{ width: `${Math.max(Number(percentage), 1)}%` } as CSSProperties}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">缓存清理</CardTitle>
        </CardHeader>
        <CardContent>
          {storage.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">临时文件</p>
                  <p className="text-xs text-muted-foreground">
                    占用 {formatBytes(storage.data.breakdown.tmp?.size_bytes ?? 0)}
                    ，{storage.data.breakdown.tmp?.file_count ?? 0} 个文件
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await clearCache.mutateAsync();
                      onToast({
                        type: 'info',
                        text: `已清理 ${formatBytes(result.freed_bytes)}（${result.removed_files} 个文件）`,
                      });
                    } catch {
                      onToast({ type: 'error', text: '清理失败' });
                    }
                  }}
                  disabled={clearCache.isPending || (storage.data.breakdown.tmp?.size_bytes ?? 0) === 0}
                >
                  {clearCache.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  清空临时文件
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </CardContent>
      </Card>

      <DefaultStorageCard onToast={onToast} />
    </div>
  );
}

function DefaultStorageCard({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const status = useStorageStatus();
  const settings = useStorageSettings();
  const update = useUpdateStorageSettings();
  const [mode, setMode] = useState<StorageMode>('local_only');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !settings.data) return;
    const raw = settings.data.default_storage_mode;
    setMode(raw === 'cloud_only' || raw === 'dual' ? raw : 'local_only');
    setHydrated(true);
  }, [settings.data, hydrated]);

  const cloudAvailable = status.data?.cloudAvailable ?? false;

  const handleSave = async () => {
    if (!cloudAvailable && mode !== 'local_only') {
      onToast({ type: 'error', text: '云存储未配置，无法选择云端相关模式' });
      return;
    }
    try {
      await update.mutateAsync({ default_storage_mode: mode });
      onToast({ type: 'info', text: '默认存储方式已保存' });
    } catch (err) {
      onToast({ type: 'error', text: err instanceof Error ? err.message : '保存失败' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">默认存储方式</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(['local_only', 'cloud_only', 'dual'] as StorageMode[]).map((m) => {
              const disabled = !cloudAvailable && m !== 'local_only';
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors',
                    mode === m
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-accent',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <div className="text-sm font-medium text-foreground">{STORAGE_MODE_LABELS[m]}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{MODE_DESCRIPTIONS[m]}</p>
                </button>
              );
            })}
          </div>
          {!cloudAvailable && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200/50 bg-amber-50/95 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>云存储未配置，仅「仅保存在当前设备」可选；配置后可在下方「云存储配置」中启用。</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              保存默认方式
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BatchFileItem {
  file: File;
  mode: StorageMode;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error: string | null;
  resultId: number | null;
}

export function BatchUploadCard({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const status = useStorageStatus();
  const [items, setItems] = useState<BatchFileItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultMode = status.data?.defaultStorageMode ?? 'local_only';
  const cloudAvailable = status.data?.cloudAvailable ?? false;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      return ['.epub', '.pdf', '.mobi', '.txt', '.azw3', '.azw', '.djvu', '.docx', '.fb2'].includes(ext);
    });
    if (accepted.length === 0) {
      onToast({ type: 'error', text: '未识别到支持的电子书格式' });
      return;
    }
    setItems((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        file,
        mode: defaultMode,
        status: 'pending' as const,
        error: null,
        resultId: null,
      })),
    ]);
    setOpen(true);
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateItemMode = (index: number, mode: StorageMode) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, mode } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (items.length === 0) return;
    setIsUploading(true);
    setItems((prev) => prev.map((item) => (item.status === 'pending' ? { ...item, status: 'uploading' } : item)));
    const results: BatchFileItem[] = [];

    for (const item of items) {
      if (!cloudAvailable && item.mode !== 'local_only') {
        results.push({ ...item, status: 'error', error: '云存储未配置，无法使用云端模式' });
        continue;
      }
      const form = new FormData();
      form.append('file', item.file);
      form.append('storage_mode', item.mode);
      try {
        const res = await api.postForm<{ id: number }>('/files/unassociated', form);
        results.push({ ...item, status: 'success', resultId: res.id, error: null });
      } catch (err) {
        results.push({ ...item, status: 'error', error: err instanceof Error ? err.message : '上传失败' });
      }
    }

    setItems(results);
    setIsUploading(false);
    const success = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    if (failed === 0) {
      onToast({ type: 'info', text: `全部上传成功：${success} 个文件` });
    } else {
      onToast({ type: 'error', text: `上传完成：成功 ${success} 个，失败 ${failed} 个` });
    }
  };

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
            accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            选择文件批量上传
          </Button>

          {open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="max-h-[80vh] w-full max-w-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">批量上传</CardTitle>
                  <p className="text-xs text-muted-foreground">共 {items.length} 个文件；系统默认方式：{STORAGE_MODE_LABELS[defaultMode]}</p>
                </CardHeader>
                <CardContent className="max-h-[50vh] overflow-auto">
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                        </div>
                        <Select
                          value={item.mode}
                          disabled={isUploading}
                          onValueChange={(value) => updateItemMode(index, value as StorageMode)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local_only">{STORAGE_MODE_LABELS.local_only}</SelectItem>
                            <SelectItem value="cloud_only" disabled={!cloudAvailable}>{STORAGE_MODE_LABELS.cloud_only}</SelectItem>
                            <SelectItem value="dual" disabled={!cloudAvailable}>{STORAGE_MODE_LABELS.dual}</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="w-16 text-right">
                          {item.status === 'success' && <span className="text-xs text-emerald-600">成功</span>}
                          {item.status === 'error' && <span className="text-xs text-destructive" title={item.error ?? ''}>失败</span>}
                          {item.status === 'uploading' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                          {item.status === 'pending' && <span className="text-xs text-muted-foreground">待上传</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isUploading}
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <div className="flex items-center justify-end gap-2 border-t border-border p-4">
                  <Button variant="outline" onClick={() => { setOpen(false); setItems([]); }} disabled={isUploading}>
                    关闭
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading || items.length === 0}>
                    {isUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    开始上传
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CloudStorageCard({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const status = useStorageStatus();
  const settings = useStorageSettings();
  const update = useUpdateStorageSettings();
  const test = useTestStorage();

  const [driver, setDriver] = useState<'local' | 's3'>('local');
  const [provider, setProvider] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [bucket, setBucket] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [region, setRegion] = useState('auto');
  const [publicUrl, setPublicUrl] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !settings.data) return;
    const map = settings.data;
    setDriver(((map.storage_driver as 'local' | 's3') || 'local'));
    setProvider(map.oss_provider ?? '');
    setEndpoint(map.oss_endpoint ?? '');
    setBucket(map.oss_bucket ?? '');
    setRegion(map.oss_region ?? 'auto');
    setPublicUrl(map.oss_public_url ?? '');
    setHydrated(true);
  }, [settings.data, hydrated]);

  const handleSave = useCallback(async () => {
    try {
      await update.mutateAsync({
        driver,
        provider: provider || null,
        endpoint: endpoint || null,
        bucket: bucket || null,
        access_key: accessKey || undefined,
        secret_key: secretKey || undefined,
        region: region || null,
        public_url: publicUrl || null,
      });
      setAccessKey('');
      setSecretKey('');
      onToast({ type: 'info', text: '云存储配置已保存' });
    } catch (err) {
      onToast({ type: 'error', text: `保存失败: ${err instanceof Error ? err.message : '未知错误'}` });
    }
  }, [driver, provider, endpoint, bucket, accessKey, secretKey, region, publicUrl, update, onToast]);

  const handleTest = useCallback(async () => {
    try {
      const res = await test.mutateAsync({
        driver,
        provider: provider || undefined,
        endpoint: endpoint || undefined,
        bucket: bucket || undefined,
        access_key: accessKey || undefined,
        secret_key: secretKey || undefined,
        region: region || undefined,
        public_url: publicUrl || undefined,
      });
      if (res.ok) {
        onToast({ type: 'info', text: res.message });
      } else {
        onToast({ type: 'error', text: res.message });
      }
    } catch (err) {
      onToast({ type: 'error', text: `测试失败: ${err instanceof Error ? err.message : '未知错误'}` });
    }
  }, [driver, provider, endpoint, bucket, accessKey, secretKey, region, publicUrl, test, onToast]);

  const defaultStorageMode = status.data?.defaultStorageMode ?? 'local_only';
  const configured = status.data?.configured ?? false;
  const reason = status.data?.reason ?? null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">云存储配置</CardTitle>
          {status.data && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">默认存储方式:</span>
              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                {STORAGE_MODE_LABELS[defaultStorageMode]}
              </span>
              {configured ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">已配置</span>
              ) : (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">未配置</span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reason && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200/50 bg-amber-50/95 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reason}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">存储后端</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={driver === 'local' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDriver('local')}
              >
                本地存储
              </Button>
              <Button
                type="button"
                variant={driver === 's3' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDriver('s3')}
              >
                S3 兼容（含 R2）
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              选择 R2 时填写下方各项。Cloudflare R2 走 S3 兼容协议，endpoint 形如
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">https://&lt;account_id&gt;.r2.cloudflarestorage.com</code>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Provider 标识</label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="r2 / s3 / minio / aliyun"
                disabled={driver === 'local'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Region</label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="auto"
                disabled={driver === 'local'}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Endpoint</label>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://<account_id>.r2.cloudflarestorage.com"
                disabled={driver === 'local'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Bucket 名称</label>
              <Input
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                placeholder="redesk-books"
                disabled={driver === 'local'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">公开访问 URL（可选）</label>
              <Input
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="https://cdn.example.com"
                disabled={driver === 'local'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Access Key ID</label>
              <Input
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder={settings.data?.oss_access_key ?? '留空则保留现有值'}
                disabled={driver === 'local'}
                autoComplete="off"
              />
              {settings.data?.oss_access_key && (
                <p className="text-xs text-muted-foreground">当前: {settings.data.oss_access_key}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Secret Access Key</label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={settings.data?.oss_secret_key ?? '留空则保留现有值'}
                disabled={driver === 'local'}
                autoComplete="new-password"
              />
              {settings.data?.oss_secret_key && (
                <p className="text-xs text-muted-foreground">当前: {settings.data.oss_secret_key}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={driver === 'local' || test.isPending}
            >
              {test.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              测试连接
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={update.isPending}
            >
              {update.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              保存配置
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
