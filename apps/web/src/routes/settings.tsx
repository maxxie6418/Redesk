import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Monitor,
  Moon,
  Sun,
  UserCog,
  Cloud,
  Server,
  Trash2,
  RotateCw,
  Download,
  UserPlus,
  Key,
  Check,
  X,
  Loader2,
  FolderTree,
  Tags,
  Pencil,
  Plus,
} from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { useTheme } from '@/components/theme-provider';
import {
  useUserList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
} from '@/hooks/use-users-admin';
import { useSystemStats, useBackup, useFtsRebuild, useClearCache } from '@/hooks/use-system';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/use-tags';
import { useBackupList, triggerAutoBackup, triggerFullBackup } from '@/hooks/use-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tab = 'general' | 'users' | 'categories' | 'tags' | 'backup' | 'system';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

function StatusBanner({ message }: { message: StatusMessage }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'mb-4 rounded-md px-4 py-2.5 text-sm',
        message.type === 'success'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      )}
    >
      {message.text}
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const settings = useSettings();

  const isMultiUser = settings.data?.multi_user === 'true';

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: '通用', icon: <Monitor className="h-4 w-4" /> },
    { key: 'categories', label: '分类', icon: <FolderTree className="h-4 w-4" /> },
    { key: 'tags', label: '标签', icon: <Tags className="h-4 w-4" /> },
    ...(isMultiUser
      ? [{ key: 'users' as Tab, label: '用户管理', icon: <UserCog className="h-4 w-4" /> }]
      : []),
    { key: 'backup', label: '云备份', icon: <Cloud className="h-4 w-4" /> },
    { key: 'system', label: '系统', icon: <Server className="h-4 w-4" /> },
  ];

  if (settings.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">设置</h1>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <nav className="mb-6 flex gap-1 rounded-lg border border-border bg-popover p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'general' && (
          <GeneralTab settings={settings.data ?? {}} />
        )}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'users' && isMultiUser && <UsersTab />}
        {activeTab === 'backup' && (
          <BackupTab settings={settings.data ?? {}} />
        )}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

function GeneralTab({ settings }: { settings: Record<string, string> }) {
  const updateSettings = useUpdateSettings();
  const themeCtx = useTheme();
  const [recycleDays, setRecycleDays] = useState(settings.recycle_retention_days ?? '30');
  const [multiUser, setMultiUser] = useState(settings.multi_user === 'true');
  const [message, setMessage] = useState<StatusMessage>(null);

  const handleThemeChange = useCallback((value: string) => {
    if (value === 'dark') themeCtx.setTheme('dark');
    else if (value === 'light') themeCtx.setTheme('light');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeCtx.setTheme(prefersDark ? 'dark' : 'light');
    }
  }, [themeCtx]);

  const theme = themeCtx.theme === 'dark' ? 'dark' : 'light';

  const handleSave = useCallback(async () => {
    try {
      await updateSettings.mutateAsync({
        recycle_retention_days: recycleDays,
        multi_user: multiUser ? 'true' : 'false',
      });
      setMessage({ type: 'success', text: '设置已保存' });
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    }
  }, [recycleDays, multiUser, updateSettings]);

  return (
    <div className="space-y-6">
      <StatusBanner message={message} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">回收站</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">保留天数</p>
              <p className="text-xs text-muted-foreground">超过该天数的回收站书籍将被自动清除</p>
            </div>
            <Input
              type="number"
              min={1}
              max={365}
              className="w-24"
              value={recycleDays}
              onChange={(e) => setRecycleDays(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">界面</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">主题</p>
              <p className="text-xs text-muted-foreground">选择界面配色方案</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-popover p-0.5">
              {([
                ['light', <Sun className="h-4 w-4" />, '浅色'],
                ['dark', <Moon className="h-4 w-4" />, '深色'],
                ['system', <Monitor className="h-4 w-4" />, '跟随系统'],
              ] as const).map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    (value === 'system' || theme === value)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => handleThemeChange(value)}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">多用户模式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">启用多用户</p>
              <p className="text-xs text-muted-foreground">
                开启后需要密码登录，关闭后为单用户免登录模式
              </p>
            </div>
            <button
              type="button"
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                multiUser ? 'bg-primary' : 'bg-muted',
              )}
              onClick={() => setMultiUser(!multiUser)}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  multiUser ? 'translate-x-5' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存设置
        </Button>
      </div>
    </div>
  );
}

function UsersTab() {
  const users = useUserList();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [message, setMessage] = useState<StatusMessage>(null);

  const handleCreate = useCallback(async () => {
    try {
      await createUser.mutateAsync({
        username: newUsername,
        password: newPassword,
        display_name: newDisplayName || undefined,
      });
      setMessage({ type: 'success', text: '用户已创建' });
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
    } catch {
      setMessage({ type: 'error', text: '创建失败' });
    }
  }, [newUsername, newPassword, newDisplayName, createUser]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateUser.mutateAsync({ id, display_name: editingName || null });
        setMessage({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        setMessage({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateUser],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteUser.mutateAsync(id);
        setMessage({ type: 'success', text: '用户已删除' });
      } catch {
        setMessage({ type: 'error', text: '删除失败' });
      }
    },
    [deleteUser],
  );

  const handleResetPassword = useCallback(
    async (id: number) => {
      try {
        await resetPassword.mutateAsync({ id, password: resetPwd });
        setMessage({ type: 'success', text: '密码已重置' });
        setResetId(null);
        setResetPwd('');
      } catch {
        setMessage({ type: 'error', text: '重置失败' });
      }
    },
    [resetPwd, resetPassword],
  );

  return (
    <div className="space-y-4">
      <StatusBanner message={message} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.data ? `${users.data.length} 位用户` : '加载中…'}
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          添加用户
        </Button>
      </div>

      {users.isError && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-8 text-center text-sm text-muted-foreground">
          加载用户列表失败
        </div>
      )}

      {users.data?.map((u) => (
        <Card key={u.id}>
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
              {(u.display_name || u.username)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {u.display_name || u.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
            </div>

            {editingId === u.id ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-32 text-xs"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="昵称"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(u.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingId(u.id);
                    setEditingName(u.display_name ?? '');
                  }}
                >
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setResetId(resetId === u.id ? null : u.id)}
                >
                  <Key className="mr-1 h-3 w-3" />
                  重置密码
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(u.id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  删除
                </Button>
              </div>
            )}
          </CardContent>

          {resetId === u.id && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <Input
                type="password"
                className="h-8 flex-1 text-xs"
                placeholder="新密码（至少 6 位）"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
              />
              <Button size="sm" className="h-8" onClick={() => handleResetPassword(u.id)}>
                确认
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setResetId(null)}>
                取消
              </Button>
            </div>
          )}
        </Card>
      ))}

      {showCreate && (
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <Input
              className="h-9 text-sm"
              placeholder="用户名"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <Input
              type="password"
              className="h-9 text-sm"
              placeholder="密码（至少 6 位）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              className="h-9 text-sm"
              placeholder="昵称（可选）"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createUser.isPending}>
                {createUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                创建
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BackupTab({ settings }: { settings: Record<string, string> }) {
  const updateSettings = useUpdateSettings();
  const [provider, setProvider] = useState(settings.oss_provider ?? '');
  const [endpoint, setEndpoint] = useState(settings.oss_endpoint ?? '');
  const [bucket, setBucket] = useState(settings.oss_bucket ?? '');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [message, setMessage] = useState<StatusMessage>(null);

  const backupList = useBackupList();
  const [backupMsg, setBackupMsg] = useState<StatusMessage>(null);

  const hasExistingKey = Boolean(
    settings.oss_access_key && settings.oss_access_key.includes('****'),
  );

  const handleSave = useCallback(async () => {
    try {
      const data: Record<string, string> = {
        oss_provider: provider,
        oss_endpoint: endpoint,
        oss_bucket: bucket,
      };
      if (accessKey) data.oss_access_key = accessKey;
      if (secretKey) data.oss_secret_key = secretKey;
      await updateSettings.mutateAsync(data);
      setAccessKey('');
      setSecretKey('');
      setMessage({ type: 'success', text: '云备份配置已保存' });
    } catch {
      setMessage({ type: 'error', text: '保存失败' });
    }
  }, [provider, endpoint, bucket, accessKey, secretKey, updateSettings]);

  const handleAutoBackup = useCallback(async () => {
    try {
      await triggerAutoBackup();
      setBackupMsg({ type: 'success', text: '自动备份完成' });
      backupList.refetch();
    } catch {
      setBackupMsg({ type: 'error', text: '备份失败' });
    }
  }, [backupList]);

  const handleExportJson = useCallback(() => {
    window.open('/api/v1/export/books?format=json', '_self');
  }, []);

  const handleExportCsv = useCallback(() => {
    window.open('/api/v1/export/books?format=csv', '_self');
  }, []);

  const handleFullBackup = useCallback(async () => {
    try {
      const res = await triggerFullBackup();
      if (!res.ok) throw new Error('备份失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redesk-backup-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg({ type: 'success', text: '全量备份已下载' });
    } catch {
      setBackupMsg({ type: 'error', text: '全量备份失败' });
    }
  }, []);

  return (
    <div className="space-y-6">
      <StatusBanner message={message} />
      <StatusBanner message={backupMsg} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">元数据导出</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">将全部书籍元数据导出为通用格式文件。</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              导出 JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              导出 CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">本地备份</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">全量备份（ZIP）</p>
            <p className="mb-3 text-sm text-muted-foreground">
              打包数据库 + 全部文件 + Markdown 副本为一键下载的 ZIP。
            </p>
            <Button variant="outline" size="sm" onClick={handleFullBackup}>
              <Download className="mr-2 h-4 w-4" />
              下载全量备份
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1.5 text-sm font-medium text-foreground">自动备份（SQLite VACUUM）</p>
            <p className="mb-3 text-sm text-muted-foreground">
              手动触发一次 SQLite 自动备份，最多保留 7 份。
            </p>
            <Button variant="outline" size="sm" onClick={handleAutoBackup}>
              立即备份
            </Button>
          </div>

          {backupList.data && backupList.data.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                已有 {backupList.data.length} 份备份
              </p>
              <div className="space-y-1">
                {backupList.data.slice(0, 5).map((b) => (
                  <div key={b.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="truncate text-foreground">{b.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(b.size_bytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">对象存储配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">提供商</p>
            <div className="flex gap-1 rounded-lg border border-border bg-popover p-0.5">
              {(['', 'aliyun', 's3', 'minio'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    provider === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setProvider(v)}
                >
                  {v === '' ? '关闭' : v === 'aliyun' ? '阿里云 OSS' : v === 's3' ? 'S3 兼容' : 'MinIO'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Endpoint</p>
            <Input
              placeholder="https://oss-cn-hangzhou.aliyuncs.com"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Bucket</p>
            <Input placeholder="my-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Access Key</p>
            <Input
              placeholder={hasExistingKey ? '已配置（留空不修改）' : 'Access Key ID'}
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Secret Key</p>
            <Input
              type="password"
              placeholder={hasExistingKey ? '已配置（留空不修改）' : 'Secret Access Key'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled>
          测试连接
        </Button>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存配置
        </Button>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState<StatusMessage>(null);

  const handleCreate = useCallback(async () => {
    try {
      await createCategory.mutateAsync({ name: newName });
      setMessage({ type: 'success', text: '分类已创建' });
      setShowCreate(false);
      setNewName('');
    } catch {
      setMessage({ type: 'error', text: '创建失败' });
    }
  }, [newName, createCategory]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateCategory.mutateAsync({ id, name: editingName });
        setMessage({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        setMessage({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateCategory],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteCategory.mutateAsync(id);
        setMessage({ type: 'success', text: '分类已删除，相关书籍的分类已清空' });
      } catch {
        setMessage({ type: 'error', text: '删除失败' });
      }
    },
    [deleteCategory],
  );

  return (
    <div className="space-y-4">
      <StatusBanner message={message} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.data ? `${categories.data.length} 个分类` : '加载中…'}
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建分类
        </Button>
      </div>

      {categories.isError && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-8 text-center text-sm text-muted-foreground">
          加载分类失败
        </div>
      )}

      {categories.data?.map((cat) => (
        <Card key={cat.id}>
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground">
              <FolderTree className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              {editingId === cat.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 flex-1 text-sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(cat.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">{cat.name}</p>
              )}
              <p className="text-xs text-muted-foreground">{cat.book_count} 本书</p>
            </div>

            {editingId !== cat.id && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingId(cat.id);
                    setEditingName(cat.name);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(cat.id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  删除
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {showCreate && (
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <Input
              className="h-9 text-sm"
              placeholder="分类名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createCategory.isPending}>
                {createCategory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                创建
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TagsTab() {
  const tags = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState<StatusMessage>(null);

  const handleCreate = useCallback(async () => {
    try {
      await createTag.mutateAsync({ name: newName });
      setMessage({ type: 'success', text: '标签已创建' });
      setShowCreate(false);
      setNewName('');
    } catch {
      setMessage({ type: 'error', text: '创建失败' });
    }
  }, [newName, createTag]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateTag.mutateAsync({ id, name: editingName });
        setMessage({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        setMessage({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateTag],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteTag.mutateAsync(id);
        setMessage({ type: 'success', text: '标签已删除' });
      } catch {
        setMessage({ type: 'error', text: '删除失败' });
      }
    },
    [deleteTag],
  );

  return (
    <div className="space-y-4">
      <StatusBanner message={message} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tags.data ? `${tags.data.length} 个标签` : '加载中…'}
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建标签
        </Button>
      </div>

      {tags.isError && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-8 text-center text-sm text-muted-foreground">
          加载标签失败
        </div>
      )}

      {tags.data?.map((tag) => (
        <Card key={tag.id}>
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground">
              <Tags className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              {editingId === tag.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 flex-1 text-sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(tag.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">#{tag.name}</p>
              )}
              <p className="text-xs text-muted-foreground">{tag.book_count} 本书</p>
            </div>

            {editingId !== tag.id && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(tag.id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  删除
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {showCreate && (
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <Input
              className="h-9 text-sm"
              placeholder="标签名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createTag.isPending}>
                {createTag.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                创建
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SystemTab() {
  const stats = useSystemStats();
  const backup = useBackup();
  const ftsRebuild = useFtsRebuild();
  const clearCache = useClearCache();
  const [message, setMessage] = useState<StatusMessage>(null);

  return (
    <div className="space-y-6">
      <StatusBanner message={message} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">系统概况</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
          {stats.data && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">数据库大小</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatBytes(stats.data.db_size_bytes)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">文件存储</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatBytes(stats.data.storage_size_bytes)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">书籍总数</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.book_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">文件数</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.file_count}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">维护操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">手动备份</p>
              <p className="text-xs text-muted-foreground">导出 SQLite 数据库到备份目录</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const r = await backup.mutateAsync();
                  setMessage({ type: 'success', text: `备份完成：${r.path}` });
                } catch {
                  setMessage({ type: 'error', text: '备份失败' });
                }
              }}
              disabled={backup.isPending}
            >
              {backup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">重建全文索引</p>
              <p className="text-xs text-muted-foreground">搜索异常时可用此操作修复</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await ftsRebuild.mutateAsync();
                  setMessage({ type: 'success', text: '索引重建完成' });
                } catch {
                  setMessage({ type: 'error', text: '重建失败' });
                }
              }}
              disabled={ftsRebuild.isPending}
            >
              {ftsRebuild.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">清理缓存</p>
              <p className="text-xs text-muted-foreground">清除运行时临时文件</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await clearCache.mutateAsync();
                  setMessage({ type: 'success', text: '缓存已清理' });
                } catch {
                  setMessage({ type: 'error', text: '清理失败' });
                }
              }}
              disabled={clearCache.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
