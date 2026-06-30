import { useState, useCallback } from 'react';
import {
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
  Sparkles,
  Link,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  HardDrive,
  Database,
  Clock,
  AlertTriangle,
  Image,
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
import { useSystemStats, useSystemStorage, useBackup, useFtsRebuild, useClearCache } from '@/hooks/use-system';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-categories';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/use-tags';
import { useBackupList, triggerAutoBackup, triggerFullBackup } from '@/hooks/use-export';
import {
  useQuickLinks,
  useAddQuickLink,
  useUpdateQuickLink,
  useDeleteQuickLink,
  useReorderQuickLink,
} from '@/hooks/use-quick-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSidebar } from '@/components/app-sidebar';
import { useShellUser } from '@/components/shell-user-context';
import { cn } from '@/lib/utils';

type Tab = 'general' | 'ai' | 'users' | 'categories' | 'tags' | 'quick-links' | 'backup' | 'storage' | 'system';

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

function StatusToast({ message, onClose }: { message: StatusMessage; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="pointer-events-auto fixed right-6 top-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg',
          message.type === 'success'
            ? 'border-emerald-200/50 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/95 dark:text-emerald-200'
            : 'border-red-200/50 bg-red-50/95 text-red-800 dark:border-red-800/50 dark:bg-red-950/95 dark:text-red-200',
        )}
      >
        <span className="text-sm font-medium">{message.text}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useShellUser();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [toast, setToast] = useState<StatusMessage>(null);
  const settings = useSettings();

  const showToast = useCallback((message: StatusMessage) => {
    setToast(message);
    if (message) {
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const isMultiUser = settings.data?.multi_user === 'true';

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: '通用', icon: <Monitor className="h-4 w-4" /> },
    { key: 'ai', label: 'AI 配置', icon: <Sparkles className="h-4 w-4" /> },
    { key: 'categories', label: '分类', icon: <FolderTree className="h-4 w-4" /> },
    { key: 'tags', label: '标签', icon: <Tags className="h-4 w-4" /> },
    { key: 'quick-links', label: '快捷链接', icon: <Link className="h-4 w-4" /> },
    ...(isMultiUser
      ? [{ key: 'users' as Tab, label: '用户管理', icon: <UserCog className="h-4 w-4" /> }]
      : []),
    { key: 'backup', label: '云备份', icon: <Cloud className="h-4 w-4" /> },
    { key: 'storage', label: '存储', icon: <HardDrive className="h-4 w-4" /> },
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
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeKey="settings" user={user} />
      <StatusToast message={toast} onClose={() => setToast(null)} />

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-5 text-xl font-semibold text-foreground">设置</h1>
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
          <GeneralTab settings={settings.data ?? {}} onToast={showToast} />
        )}
        {activeTab === 'ai' && <AiTab settings={settings.data ?? {}} onToast={showToast} />}
        {activeTab === 'categories' && <CategoriesTab onToast={showToast} />}
        {activeTab === 'tags' && <TagsTab onToast={showToast} />}
        {activeTab === 'quick-links' && <QuickLinksTab onToast={showToast} />}
        {activeTab === 'users' && isMultiUser && <UsersTab onToast={showToast} />}
        {activeTab === 'backup' && (
          <BackupTab settings={settings.data ?? {}} onToast={showToast} />
        )}
        {activeTab === 'storage' && <StorageTab onToast={showToast} />}
        {activeTab === 'system' && <SystemTab onToast={showToast} />}
        </div>
      </main>
    </div>
  );
}

function GeneralTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const updateSettings = useUpdateSettings();
  const themeCtx = useTheme();
  const [recycleDays, setRecycleDays] = useState(settings.recycle_retention_days ?? '30');
  const [multiUser, setMultiUser] = useState(settings.multi_user === 'true');

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
      onToast({ type: 'success', text: '设置已保存' });
    } catch {
      onToast({ type: 'error', text: '保存失败' });
    }
  }, [recycleDays, multiUser, updateSettings, onToast]);

  return (
    <div className="space-y-6">
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

function AiTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const updateSettings = useUpdateSettings();
  const [provider, setProvider] = useState(settings.llm_provider ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings.llm_model ?? '');
  const [baseUrl, setBaseUrl] = useState(settings.llm_base_url ?? '');

  const hasExistingKey = Boolean(
    settings.llm_api_key && settings.llm_api_key.includes('****'),
  );

  const handleSave = useCallback(async () => {
    try {
      const data: Record<string, string> = {
        llm_provider: provider,
        llm_model: model,
        llm_base_url: baseUrl,
      };
      if (apiKey) data.llm_api_key = apiKey;
      await updateSettings.mutateAsync(data);
      setApiKey('');
      onToast({ type: 'success', text: 'AI 配置已保存' });
    } catch {
      onToast({ type: 'error', text: '保存失败' });
    }
  }, [provider, apiKey, model, baseUrl, updateSettings, onToast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">AI 服务配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">LLM 提供商</p>
            <div className="flex gap-1 rounded-lg border border-border bg-popover p-0.5">
              {(['', 'openai', 'anthropic', 'deepseek', 'ollama'] as const).map((v) => (
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
                  {v === '' ? '关闭' : v === 'openai' ? 'OpenAI' : v === 'anthropic' ? 'Anthropic' : v === 'deepseek' ? 'DeepSeek' : 'Ollama'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">API Key</p>
            <Input
              type="password"
              placeholder={hasExistingKey ? '已配置（留空不修改）' : 'sk-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">模型</p>
            <Input
              placeholder="gpt-4o / claude-3.5-sonnet / deepseek-chat"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Base URL（可选）</p>
            <p className="mb-1.5 text-xs text-muted-foreground">自定义 API 地址，留空使用默认</p>
            <Input
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">功能状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">录入辅助</p>
              <p className="text-xs text-muted-foreground">元数据补全、标签/分类建议、重复发现</p>
            </div>
            <span className="text-xs text-muted-foreground">M3 上线</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">阅读辅助</p>
              <p className="text-xs text-muted-foreground">摘要生成、问题整理、章节总结</p>
            </div>
            <span className="text-xs text-muted-foreground">M3 上线</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">书库问答（RAG）</p>
              <p className="text-xs text-muted-foreground">基于个人书库的语义问答与主题分析</p>
            </div>
            <span className="text-xs text-muted-foreground">M4 上线</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存配置
        </Button>
      </div>
    </div>
  );
}

function UsersTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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

  const handleCreate = useCallback(async () => {
    try {
      await createUser.mutateAsync({
        username: newUsername,
        password: newPassword,
        display_name: newDisplayName || undefined,
      });
      onToast({ type: 'success', text: '用户已创建' });
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
    } catch {
      onToast({ type: 'error', text: '创建失败' });
    }
  }, [newUsername, newPassword, newDisplayName, createUser, onToast]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateUser.mutateAsync({ id, display_name: editingName || null });
        onToast({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        onToast({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateUser, onToast],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteUser.mutateAsync(id);
        onToast({ type: 'success', text: '用户已删除' });
      } catch {
        onToast({ type: 'error', text: '删除失败' });
      }
    },
    [deleteUser, onToast],
  );

  const handleResetPassword = useCallback(
    async (id: number) => {
      try {
        await resetPassword.mutateAsync({ id, password: resetPwd });
        onToast({ type: 'success', text: '密码已重置' });
        setResetId(null);
        setResetPwd('');
      } catch {
        onToast({ type: 'error', text: '重置失败' });
      }
    },
    [resetPwd, resetPassword, onToast],
  );

  return (
    <div className="space-y-4">
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

function BackupTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const updateSettings = useUpdateSettings();
  const [provider, setProvider] = useState(settings.oss_provider ?? '');
  const [endpoint, setEndpoint] = useState(settings.oss_endpoint ?? '');
  const [bucket, setBucket] = useState(settings.oss_bucket ?? '');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  const backupList = useBackupList();

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
      onToast({ type: 'success', text: '云备份配置已保存' });
    } catch {
      onToast({ type: 'error', text: '保存失败' });
    }
  }, [provider, endpoint, bucket, accessKey, secretKey, updateSettings, onToast]);

  const handleAutoBackup = useCallback(async () => {
    try {
      await triggerAutoBackup();
      onToast({ type: 'success', text: '自动备份完成' });
      backupList.refetch();
    } catch {
      onToast({ type: 'error', text: '备份失败' });
    }
  }, [backupList, onToast]);

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
      onToast({ type: 'success', text: '全量备份已下载' });
    } catch {
      onToast({ type: 'error', text: '全量备份失败' });
    }
  }, [onToast]);

  return (
    <div className="space-y-6">
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

function CategoriesTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = useCallback(async () => {
    try {
      await createCategory.mutateAsync({ name: newName });
      onToast({ type: 'success', text: '分类已创建' });
      setShowCreate(false);
      setNewName('');
    } catch {
      onToast({ type: 'error', text: '创建失败' });
    }
  }, [newName, createCategory, onToast]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateCategory.mutateAsync({ id, name: editingName });
        onToast({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        onToast({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateCategory, onToast],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteCategory.mutateAsync(id);
        onToast({ type: 'success', text: '分类已删除，相关书籍的分类已清空' });
      } catch {
        onToast({ type: 'error', text: '删除失败' });
      }
    },
    [deleteCategory, onToast],
  );

  return (
    <div className="space-y-4">
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

function TagsTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const tags = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = useCallback(async () => {
    try {
      await createTag.mutateAsync({ name: newName });
      onToast({ type: 'success', text: '标签已创建' });
      setShowCreate(false);
      setNewName('');
    } catch {
      onToast({ type: 'error', text: '创建失败' });
    }
  }, [newName, createTag, onToast]);

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await updateTag.mutateAsync({ id, name: editingName });
        onToast({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        onToast({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, updateTag, onToast],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteTag.mutateAsync(id);
        onToast({ type: 'success', text: '标签已删除' });
      } catch {
        onToast({ type: 'error', text: '删除失败' });
      }
    },
    [deleteTag, onToast],
  );

  return (
    <div className="space-y-4">
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

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
}

function StorageTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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
        <CardHeader className="pb-4">
          <CardTitle className="text-base">本地存储概况</CardTitle>
        </CardHeader>
        <CardContent>
          {storage.isLoading && <p className="text-sm text-muted-foreground">扫描中…</p>}
          {storage.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-popover p-4">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">总占用</p>
                  <p className="text-xs text-muted-foreground">
                    {storage.data.total_files} 个文件
                  </p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {formatBytes(totalSize)}
                </p>
              </div>

              <div className="space-y-2">
                {Object.entries(storage.data.breakdown).map(([key, info]) => {
                  const percentage = totalSize > 0 ? ((info.size_bytes / totalSize) * 100).toFixed(1) : '0';
                  const dir = dirLabels[key] ?? { label: key, icon: <FolderTree className="h-4 w-4" /> };
                  return (
                    <div key={key} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                      <span className="text-muted-foreground">{dir.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{dir.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(info.size_bytes)} ({percentage}%)
                          </p>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              key === 'tmp'
                                ? 'bg-orange-400'
                                : key === 'backups'
                                  ? 'bg-blue-400'
                                  : 'bg-emerald-400',
                            )}
                            style={{ width: `${Math.max(Number(percentage), 1)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{info.file_count} 个文件</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">数据库</p>
                  <p className="text-xs text-muted-foreground">SQLite 数据文件</p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatBytes(storage.data.db_size_bytes)}
                </p>
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
                        type: 'success',
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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">远程存储</CardTitle>
        </CardHeader>
        <CardContent>
          {storage.data ? (
            storage.data.oss.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200/50 bg-emerald-50/95 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/95">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      对象存储已配置
                    </p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80">
                      {storage.data.oss.provider === 'aliyun'
                        ? '阿里云 OSS'
                        : storage.data.oss.provider === 's3'
                          ? 'S3 兼容'
                          : storage.data.oss.provider === 'minio'
                            ? 'MinIO'
                            : storage.data.oss.provider}
                    </p>
                  </div>
                </div>
                {storage.data.oss.endpoint && (
                  <div className="rounded-lg border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">Endpoint</p>
                    <p className="text-sm font-medium text-foreground">
                      {storage.data.oss.endpoint}
                    </p>
                  </div>
                )}
                {storage.data.oss.bucket && (
                  <div className="rounded-lg border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">Bucket</p>
                    <p className="text-sm font-medium text-foreground">
                      {storage.data.oss.bucket}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">未配置对象存储</p>
                  <p className="text-xs text-muted-foreground">
                    前往「云备份」Tab 配置 S3 兼容的对象存储
                  </p>
                </div>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SystemTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const stats = useSystemStats();
  const backup = useBackup();
  const ftsRebuild = useFtsRebuild();
  const clearCache = useClearCache();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">应用信息</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
          {stats.data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">版本</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  v{stats.data.version}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">运行环境</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.data.node_env === 'production' ? '生产' : '开发'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">运行时长</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatUptime(stats.data.uptime_seconds)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">Node.js</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.data.node_version}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">SQLite</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stats.data.sqlite_version}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">数据库路径</p>
                <p className="mt-1 truncate text-xs font-medium text-foreground">
                  {stats.data.db_path}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">书籍总数</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.book_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">文件数</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.file_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">分类</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.category_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">标签</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.tag_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">用户</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.user_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-popover p-3">
                <p className="text-xs text-muted-foreground">回收站</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.trash_count}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">存储概况</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.data && (
            <div className="grid grid-cols-2 gap-3">
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
                  onToast({ type: 'success', text: `备份完成：${r.path}` });
                } catch {
                  onToast({ type: 'error', text: '备份失败' });
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
                  onToast({ type: 'success', text: '索引重建完成' });
                } catch {
                  onToast({ type: 'error', text: '重建失败' });
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
                  const result = await clearCache.mutateAsync();
                  onToast({
                    type: 'success',
                    text: `已清理 ${formatBytes(result.freed_bytes)}（${result.removed_files} 个文件）`,
                  });
                } catch {
                  onToast({ type: 'error', text: '清理失败' });
                }
              }}
              disabled={clearCache.isPending}
            >
              {clearCache.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLinksTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const { data: links } = useQuickLinks();
  const addLink = useAddQuickLink();
  const updateLink = useUpdateQuickLink();
  const deleteLink = useDeleteQuickLink();
  const reorder = useReorderQuickLink();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingUrl, setEditingUrl] = useState('');

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    try {
      await addLink.mutateAsync({ name: newName.trim(), url: newUrl.trim() });
      onToast({ type: 'success', text: '快捷链接已添加' });
      setShowCreate(false);
      setNewName('');
      setNewUrl('');
    } catch {
      onToast({ type: 'error', text: '添加失败' });
    }
  }, [newName, newUrl, addLink, onToast]);

  const handleUpdate = useCallback(
    async (id: number) => {
      if (!editingName.trim() || !editingUrl.trim()) return;
      try {
        await updateLink.mutateAsync({ id, name: editingName.trim(), url: editingUrl.trim() });
        onToast({ type: 'success', text: '已更新' });
        setEditingId(null);
      } catch {
        onToast({ type: 'error', text: '更新失败' });
      }
    },
    [editingName, editingUrl, updateLink, onToast],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteLink.mutateAsync(id);
        onToast({ type: 'success', text: '已删除' });
      } catch {
        onToast({ type: 'error', text: '删除失败' });
      }
    },
    [deleteLink, onToast],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {links ? `${links.length} 个链接` : '加载中…'}
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          添加链接
        </Button>
      </div>

      {!links && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-8 text-center text-sm text-muted-foreground">
          加载失败
        </div>
      )}

      {links && links.length === 0 && !showCreate && (
        <div className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          还没有快捷链接，点击上方按钮添加
        </div>
      )}

      {links?.map((link, index) => (
        <Card key={link.id}>
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground">
              <ExternalLink className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              {editingId === link.id ? (
                <div className="space-y-2">
                  <Input
                    className="h-8 text-sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="链接名称"
                  />
                  <Input
                    className="h-8 text-sm"
                    value={editingUrl}
                    onChange={(e) => setEditingUrl(e.target.value)}
                    placeholder="URL"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdate(link.id)}>
                      <Check className="mr-1 h-3 w-3" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-medium text-foreground">{link.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                </>
              )}
            </div>

            {editingId !== link.id && (
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => reorder.moveUp(link.id)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => reorder.moveDown(link.id)}
                  disabled={index === links.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingId(link.id);
                    setEditingName(link.name);
                    setEditingUrl(link.url);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(link.id)}
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
              placeholder="链接名称（如：豆瓣读书）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              className="h-9 text-sm"
              placeholder="URL（如：https://book.douban.com）"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={addLink.isPending || !newName.trim() || !newUrl.trim()}>
                {addLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                添加
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
