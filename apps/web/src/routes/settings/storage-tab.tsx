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
  Plus,
  Send,
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
import { useCloudAssignments, useCloudConnections, useCreateCloudConnection, useDeleteCloudConnection, useSaveCloudAssignments, useSnapshotNotes, useTestCloudConnection, useTestCloudConfig, useToggleCloudConnection, type CloudConnectionType, type CloudUsage } from '@/hooks/use-cloud-connections';
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

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(Object.entries(storage.data.breakdown) as [string, DirInfo][]).map(([key, info]) => {
                  const percentage = totalSize > 0 ? ((info.size_bytes / totalSize) * 100).toFixed(1) : '0';
                  const dir = dirLabels[key] ?? { label: key, icon: <FolderTree className="h-3.5 w-3.5" /> };
                  return (
                    <div key={key} className="rounded-lg border border-border px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-muted-foreground">{dir.icon}</span>
                          <p className="truncate text-sm font-medium text-foreground">{dir.label}</p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">{percentage}%</p>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatBytes(info.size_bytes)}</span>
                        <span>{info.file_count} 个</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
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
      <CloudConnectionManager onToast={onToast} />
    </div>
  );
}

const CLOUD_USAGE_LABELS: Record<CloudUsage, string> = {
  book_files: '书籍文件', covers: '封面图片', notes: '笔记快照（Markdown / JSON）', backup_db: '数据库备份', backup_full: '完整备份',
};

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: number; label: string }[];
  selected: number[];
  onChange: (values: number[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (value: number) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className={cn(
          'flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer',
          open && 'ring-1 ring-ring',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder ?? '请选择…'}</span>
        ) : (
          selected.map((value) => {
            const option = options.find((o) => o.value === value);
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {option?.label ?? value}
                <button
                  type="button"
                  className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(value);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
          <div className="max-h-60 overflow-auto p-1">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">无可用的活跃连接</p>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => toggle(option.value)}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CloudConnectionManager({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const connections = useCloudConnections();
  const assignments = useCloudAssignments();
  const create = useCreateCloudConnection();
  const test = useTestCloudConnection();
  const testConfig = useTestCloudConfig();
  const toggle = useToggleCloudConnection();
  const remove = useDeleteCloudConnection();
  const saveAssignments = useSaveCloudAssignments();
  const snapshotNotes = useSnapshotNotes();
  const [type, setType] = useState<CloudConnectionType>('s3');
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({ region: 'auto' });
  const [routing, setRouting] = useState<Record<CloudUsage, number[]>>({
    book_files: [],
    covers: [],
    notes: [],
    backup_db: [],
    backup_full: [],
  });

  useEffect(() => {
    if (!assignments.data) return;
    const next: Record<CloudUsage, number[]> = {
      book_files: [],
      covers: [],
      notes: [],
      backup_db: [],
      backup_full: [],
    };
    assignments.data.forEach((item) => next[item.usage].push(item.connection_id));
    setRouting(next);
  }, [assignments.data]);

  const buildConfig = () =>
    type === 's3'
      ? {
          provider: fields.provider || null,
          endpoint: fields.endpoint,
          bucket: fields.bucket,
          region: fields.region || 'auto',
          access_key: fields.access_key,
          secret_key: fields.secret_key,
          public_url: fields.public_url || null,
          prefix: fields.prefix || null,
        }
      : {
          url: fields.url,
          username: fields.username || null,
          password: fields.password,
          base_path: fields.base_path || null,
        };

  const handleCreate = async () => {
    try {
      await create.mutateAsync({ name, type, config: buildConfig() });
      setName('');
      setFields({ region: 'auto' });
      onToast({ type: 'info', text: '云连接已保存' });
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    }
  };

  const handleTest = async () => {
    if (!name) {
      onToast({ type: 'error', text: '请填写连接名称' });
      return;
    }
    if (type === 's3' && (!fields.endpoint || !fields.bucket || !fields.access_key || !fields.secret_key)) {
      onToast({ type: 'error', text: '请填写必要的 S3 连接信息（服务端点、存储桶、访问密钥、私有密钥）' });
      return;
    }
    if (type === 'webdav' && (!fields.url || !fields.password)) {
      onToast({ type: 'error', text: '请填写必要的 WebDAV 连接信息（服务器 URL、密码 / Token）' });
      return;
    }
    try {
      await testConfig.mutateAsync({ type, config: buildConfig() });
      onToast({ type: 'info', text: '连接测试成功' });
    } catch (error) {
      onToast({ type: 'error', text: error instanceof Error ? error.message : '测试失败' });
    }
  };

  const activeConnections = (connections.data ?? []).filter((connection) => connection.is_active);

  const updateRoute = (usage: CloudUsage, values: number[]) =>
    setRouting((current) => ({ ...current, [usage]: values }));

  const routingSummary = () => {
    const mapped = (Object.entries(routing) as [CloudUsage, number[]][]).filter(([_, ids]) => ids.length > 0);
    if (mapped.length === 0) return '当前未配置任何数据路由';
    const connNames = new Map(connections.data?.map((c) => [c.id, c.name]));
    const parts = mapped.map(([usage, ids]) => {
      const targets = ids.map((id) => connNames.get(id) ?? `#${id}`).join('、');
      return `${CLOUD_USAGE_LABELS[usage]} → ${targets}`;
    });
    return parts.join('；');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">云连接配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 新建连接 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">新建连接</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                名称 <span className="text-red-500">*</span>{' '}
                <span className="text-[10px] text-muted-foreground/60">Name</span>
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：家庭 NAS" />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('s3');
                  setFields({ region: 'auto' });
                }}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  type === 's3'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card hover:bg-accent',
                )}
              >
                S3 兼容（OSS / R2）
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('webdav');
                  setFields({ region: 'auto' });
                }}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  type === 'webdav'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card hover:bg-accent',
                )}
              >
                WebDAV
              </button>
            </div>

            {type === 's3' ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">连接信息</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        服务端点 <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Endpoint</span>
                      </label>
                      <Input
                        value={fields.endpoint ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, endpoint: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        存储桶 <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Bucket</span>
                      </label>
                      <Input
                        value={fields.bucket ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, bucket: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        区域 <span className="text-[10px] text-muted-foreground/60">Region</span>
                      </label>
                      <Input
                        value={fields.region ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, region: e.target.value }))}
                        placeholder="auto"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        服务商 <span className="text-[10px] text-muted-foreground/60">Provider</span>
                      </label>
                      <Input
                        value={fields.provider ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, provider: e.target.value }))}
                        placeholder="r2 / s3 / minio"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">认证信息</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        访问密钥 <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Access Key</span>
                      </label>
                      <Input
                        type="password"
                        value={fields.access_key ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, access_key: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        私有密钥 <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Secret Key</span>
                      </label>
                      <Input
                        type="password"
                        value={fields.secret_key ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, secret_key: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">可选配置</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">
                        公开访问地址 <span className="text-[10px] text-muted-foreground/60">Public URL</span>
                      </label>
                      <Input
                        value={fields.public_url ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, public_url: e.target.value }))}
                        placeholder="https://cdn.example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        前缀 <span className="text-[10px] text-muted-foreground/60">Prefix</span>
                      </label>
                      <Input
                        value={fields.prefix ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, prefix: e.target.value }))}
                        placeholder="redesk/"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">连接信息</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">
                        服务器地址 <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Server URL</span>
                      </label>
                      <Input
                        value={fields.url ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, url: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        基础路径 <span className="text-[10px] text-muted-foreground/60">Base Path</span>
                      </label>
                      <Input
                        value={fields.base_path ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, base_path: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        用户名 <span className="text-[10px] text-muted-foreground/60">Username</span>
                      </label>
                      <Input
                        value={fields.username ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, username: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">认证信息</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        密码 / Token <span className="text-red-500">*</span>{' '}
                        <span className="text-[10px] text-muted-foreground/60">Password / Token</span>
                      </label>
                      <Input
                        type="password"
                        value={fields.password ?? ''}
                        onChange={(e) => setFields((c) => ({ ...c, password: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => void handleTest()}
                disabled={create.isPending || test.isPending || !name}
              >
                {test.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                测试连接
              </Button>
              <Button onClick={() => void handleCreate()} disabled={create.isPending || !name}>
                <Plus className="mr-1 h-4 w-4" />
                保存连接
              </Button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* 已有连接 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">已有连接</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {(connections.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未保存云连接。最多可保存 5 条。</p>
            ) : (
              <div className="space-y-2">
                {(connections.data ?? []).map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          connection.is_active ? 'bg-emerald-400' : 'bg-muted-foreground',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{connection.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {connection.type === 's3' ? 'S3 兼容对象存储' : 'WebDAV'} ·{' '}
                          {connection.is_active ? '已启用' : '已停用'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          最后测试：
                          {connection.tested_at ? new Date(connection.tested_at).toLocaleString() : '尚未测试'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void test
                            .mutateAsync(connection.id)
                            .then(() => onToast({ type: 'info', text: '连接测试成功' }))
                            .catch((error: unknown) =>
                              onToast({ type: 'error', text: error instanceof Error ? error.message : '测试失败' }),
                            )
                        }
                      >
                        测试
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void toggle.mutateAsync(connection.id)}>
                        {connection.is_active ? '停用' : '启用'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => void remove.mutateAsync(connection.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">数据路由</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 路由摘要 */}
          <p className="text-sm text-muted-foreground truncate" title={routingSummary()}>
            {routingSummary()}
          </p>

          {(Object.keys(CLOUD_USAGE_LABELS) as CloudUsage[]).map((usage) => {
            const isMulti = usage.startsWith('backup');
            return (
              <div key={usage} className="flex items-start gap-4 rounded-lg border border-border p-3">
                <div className="w-44 shrink-0 pt-0.5">
                  <p className="text-sm font-medium">{CLOUD_USAGE_LABELS[usage]}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMulti ? '可多选，按顺序冗余发送' : '当前选择一个目标连接'}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {isMulti ? (
                    <MultiSelect
                      options={activeConnections.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` }))}
                      selected={routing[usage]}
                      onChange={(values) => updateRoute(usage, values)}
                      placeholder="选择备份目标…"
                    />
                  ) : (
                    <Select
                      value={routing[usage].length > 0 ? String(routing[usage][0]) : ''}
                      onValueChange={(value) => updateRoute(usage, value === '' ? [] : [Number(value)])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="不发送到云端" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不发送到云端</SelectItem>
                        {activeConnections.map((connection) => (
                          <SelectItem key={connection.id} value={String(connection.id)}>
                            {connection.name}（{connection.type}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <Button
              onClick={() =>
                void saveAssignments
                  .mutateAsync(
                    Object.entries(routing).map(([usage, connection_ids]) => ({
                      usage: usage as CloudUsage,
                      connection_ids,
                    })),
                  )
                  .then(() => onToast({ type: 'info', text: '数据路由已保存' }))
                  .catch((error: unknown) =>
                    onToast({ type: 'error', text: error instanceof Error ? error.message : '保存失败' }),
                  )
              }
              disabled={saveAssignments.isPending}
            >
              {saveAssignments.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              保存数据路由
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void snapshotNotes
                  .mutateAsync()
                  .then((result) =>
                    onToast({ type: 'info', text: `已发送 ${result.note_count} 条笔记的 Markdown / JSON 快照` }),
                  )
                  .catch((error: unknown) =>
                    onToast({ type: 'error', text: error instanceof Error ? error.message : '发送失败' }),
                  )
              }
              disabled={snapshotNotes.isPending || routing.notes.length === 0}
            >
              <Send className="mr-1 h-4 w-4" />
              发送笔记快照
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
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
