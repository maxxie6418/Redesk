import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import {
  Monitor,
  Shield,
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
  List,
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
  Ban,
  CheckCircle,
  Image,
  LogOut,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import {
  useUserList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
  useToggleActive,
  type UserAdminSummary,
} from '@/hooks/use-users-admin';
import { useSystemStats, useSystemStorage, useBackup, useFtsRebuild, useClearCache } from '@/hooks/use-system';
import {
  useStorageStatus,
  useStorageSettings,
  useUpdateStorageSettings,
  useTestStorage,
  type StorageMode,
} from '@/hooks/use-storage-config';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, type CategoryItem } from '@/hooks/use-categories';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, type TagItem } from '@/hooks/use-tags';
import { useBackupList, triggerAutoBackup, triggerFullBackup, type BackupItem } from '@/hooks/use-export';
import { Select } from '@/components/ui/select';
import { api, API_BASE, type AuthUser } from '@/lib/api';
import {
  useQuickLinks,
  useAddQuickLink,
  useUpdateQuickLink,
  useDeleteQuickLink,
  useReorderQuickLink,
  type QuickLink,
} from '@/hooks/use-quick-links';
import type { DirInfo } from '@/hooks/use-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSidebar } from '@/components/app-sidebar';
import { useShellUser } from '@/components/shell-user-context';
import { useChangePassword, useLogout } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type Tab = 'general' | 'ai' | 'login' | 'properties' | 'backup' | 'storage' | 'system';

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

type ToastType = 'info' | 'warning' | 'error';
type StatusMessage = { type: ToastType; text: string } | null;

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  info: <Check className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <X className="h-4 w-4" />,
};

function StatusToast({ message, onClose, className }: { message: StatusMessage; onClose: () => void; className?: string }) {
  if (!message) return null;
  const typeStyles: Record<ToastType, string> = {
    info: 'border-primary/15 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10',
    warning: 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
    error: 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15',
  };
  const iconColors: Record<ToastType, string> = {
    info: 'text-primary',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-destructive',
  };
  return (
    <div className={cn('pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200', className)}>
      <div className={cn('flex items-center gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur-sm', typeStyles[message.type])}>
        <span className={cn('shrink-0', iconColors[message.type])}>{TOAST_ICONS[message.type]}</span>
        <span className="text-sm font-medium">{message.text}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useShellUser();

  if (isAdminUser(user)) {
    return <AdminSettingsPage />;
  }
  return <SimpleSettingsPage user={user} />;
}

function isAdminUser(user: { is_admin: boolean }): boolean {
  return user.is_admin === true;
}

function AdminSettingsPage() {
  const user = useShellUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [toast, setToast] = useState<StatusMessage>(null);
  const settings = useSettings();
  const mcp = user.must_change_password === true;

  const showToast = useCallback((message: StatusMessage) => {
    setToast(message);
    if (message) {
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: '通用', icon: <Monitor className="h-4 w-4" /> },
    { key: 'ai', label: 'AI 配置', icon: <Sparkles className="h-4 w-4" /> },
    { key: 'login', label: '登录管理', icon: <Shield className="h-4 w-4" /> },
    { key: 'properties', label: '属性设置', icon: <List className="h-4 w-4" /> },
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
    <>
      {mcp && (
        <div className="border-b border-amber-200/60 bg-amber-50/95 px-6 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                你正在使用初始口令。请先设置一个新口令后再继续。
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/change-password?return=/settings')}
              className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
            >
              立即设置
            </Button>
          </div>
        </div>
      )}
      <div className="flex min-h-screen flex-1 bg-background">
        <AppSidebar activeKey="settings" user={user} />
      <StatusToast message={toast} onClose={() => setToast(null)} />

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
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
        {activeTab === 'login' && <LoginManagementTab />}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'backup' && (
          <BackupTab settings={settings.data ?? {}} onToast={showToast} />
        )}
        {activeTab === 'storage' && <StorageTab onToast={showToast} />}
        {activeTab === 'system' && <SystemTab onToast={showToast} />}
        </div>
      </main>
    </div>
    </>
  );
}

function GeneralTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const updateSettings = useUpdateSettings();
  const logout = useLogout();
  const navigate = useNavigate();

  const [recycleDays, setRecycleDays] = useState(settings.recycle_retention_days ?? '30');

  const handleSave = useCallback(async () => {
    try {
      await updateSettings.mutateAsync({ recycle_retention_days: recycleDays });
      onToast({ type: 'info', text: '设置已保存' });
    } catch {
      onToast({ type: 'error', text: '保存失败' });
    }
  }, [recycleDays, updateSettings, onToast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">回收站</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-popover px-4 py-3">
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

      <QuickLinksSection onToast={onToast} />
      <BatchUploadCard onToast={onToast} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">账号</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-popover px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">退出当前账号</p>
              <p className="text-xs text-muted-foreground">退出后需重新登录</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await logout.mutateAsync();
                  navigate('/login', { replace: true });
                } catch {
                  onToast({ type: 'error', text: '退出失败' });
                }
              }}
              disabled={logout.isPending}
            >
              {logout.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogOut className="mr-1 h-4 w-4" />}
              退出账号
            </Button>
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

function QuickLinksSection({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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
      onToast({ type: 'info', text: '快捷链接已添加' });
      setShowCreate(false);
      setNewName('');
      setNewUrl('');
    } catch { onToast({ type: 'error', text: '添加失败' }); }
  }, [newName, newUrl, addLink, onToast]);

  const handleUpdate = useCallback(async (id: number) => {
    if (!editingName.trim() || !editingUrl.trim()) return;
    try {
      await updateLink.mutateAsync({ id, name: editingName.trim(), url: editingUrl.trim() });
      onToast({ type: 'info', text: '已更新' });
      setEditingId(null);
    } catch { onToast({ type: 'error', text: '更新失败' }); }
  }, [editingName, editingUrl, updateLink, onToast]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteLink.mutateAsync(id);
      onToast({ type: 'info', text: '已删除' });
    } catch { onToast({ type: 'error', text: '删除失败' }); }
  }, [deleteLink, onToast]);

  return (
    <Card>
      <CardHeader className="pb-4 flex-row items-center justify-between">
        <CardTitle className="text-base">快捷链接</CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" />添加链接
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!links && <p className="text-sm text-muted-foreground">加载中…</p>}
        {links && links.length === 0 && !showCreate && (
          <p className="text-sm text-muted-foreground">还没有快捷链接</p>
        )}
        {links?.map((link: QuickLink, index: number) => (
          <div key={link.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            {editingId === link.id ? (
              <div className="flex flex-1 items-center gap-2">
                <Input className="h-8 flex-1 text-sm" value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="名称" />
                <Input className="h-8 flex-1 text-sm" value={editingUrl} onChange={(e) => setEditingUrl(e.target.value)} placeholder="URL" />
                <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdate(link.id)}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{link.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reorder.moveUp(link.id)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reorder.moveDown(link.id)} disabled={index === links.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(link.id); setEditingName(link.name); setEditingUrl(link.url); }}>
                    <Pencil className="mr-1 h-3 w-3" />编辑
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(link.id)}>
                    <Trash2 className="mr-1 h-3 w-3" />删除
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {showCreate && (
          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
            <Input className="h-8 flex-1 text-sm" placeholder="链接名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input className="h-8 flex-1 text-sm" placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
            <Button size="sm" className="h-8" onClick={handleCreate} disabled={addLink.isPending}>创建</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>取消</Button>
          </div>
        )}
      </CardContent>
    </Card>
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
      onToast({ type: 'info', text: 'AI 配置已保存' });
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

function LoginManagementTab() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const users = useUserList();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();
  const toggleActive = useToggleActive();

  const [multiUser, setMultiUser] = useState(false);
  const [bfWindow, setBfWindow] = useState('10');
  const [bfMaxAttempts, setBfMaxAttempts] = useState('5');
  const [bfLock, setBfLock] = useState('60');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !settings.data) return;
    const s = settings.data;
    setMultiUser(s.auth_mode === 'multi_token');
    setBfWindow(s.brute_force_window_minutes ?? '10');
    setBfMaxAttempts(s.brute_force_max_attempts ?? '5');
    setBfLock(s.brute_force_lock_minutes ?? '60');
    setHydrated(true);
  }, [settings.data, hydrated]);

  const [toast, setToast] = useState<StatusMessage>(null);
  const showToast = useCallback((m: StatusMessage) => { setToast(m); if (m) setTimeout(() => setToast(null), 3000); }, []);

  const handleSave = useCallback(async () => {
    try {
      await updateSettings.mutateAsync({
        auth_mode: multiUser ? 'multi_token' : 'single_token',
        multi_user: multiUser ? 'true' : 'false',
        brute_force_window_minutes: bfWindow,
        brute_force_max_attempts: bfMaxAttempts,
        brute_force_lock_minutes: bfLock,
      });
      showToast({ type: 'info', text: '登录管理设置已保存' });
    } catch { showToast({ type: 'error', text: '保存失败' }); }
  }, [multiUser, bfWindow, bfMaxAttempts, bfLock, updateSettings, showToast]);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const handleCreate = useCallback(async () => {
    try {
      await createUser.mutateAsync({ password: newPassword, display_name: newDisplayName || undefined });
      showToast({ type: 'info', text: '用户已创建' });
      setShowCreate(false); setNewPassword(''); setNewDisplayName('');
    } catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [newPassword, newDisplayName, createUser, showToast]);

  const handleUpdate = useCallback(async (id: number) => {
    try {
      await updateUser.mutateAsync({ id, display_name: editingName || null });
      showToast({ type: 'info', text: '已更新' });
      setEditingId(null);
    } catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [editingName, updateUser, showToast]);

  const handleDelete = useCallback(async (id: number) => {
    try { await deleteUser.mutateAsync(id); showToast({ type: 'info', text: '用户已删除' }); }
    catch { showToast({ type: 'error', text: '删除失败' }); }
  }, [deleteUser, showToast]);

  const handleResetPassword = useCallback(async (id: number) => {
    try {
      await resetPassword.mutateAsync({ id, password: resetPwd });
      showToast({ type: 'info', text: '口令已重置' });
      setResetId(null); setResetPwd('');
    } catch { showToast({ type: 'error', text: '重置失败' }); }
  }, [resetPwd, resetPassword, showToast]);

  const handleToggleActive = useCallback(async (u: UserAdminSummary) => {
    try {
      await toggleActive.mutateAsync(u.id);
      showToast({ type: 'info', text: u.is_active ? '用户已停用' : '用户已启用' });
    } catch { showToast({ type: 'error', text: '操作失败' }); }
  }, [toggleActive, showToast]);

  const displayNameOf = (u: UserAdminSummary) => u.display_name || `用户 ${u.id}`;

  return (
    <div className="space-y-6">
      <StatusToast message={toast} onClose={() => setToast(null)} className="absolute left-1/2 top-0 -translate-x-1/2" />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">多用户模式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">模式</p>
              <p className="text-xs text-muted-foreground">关闭时仅管理员口令可用；开启后可创建普通口令</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-popover p-0.5">
              {([false, true] as const).map((value) => (
                <button key={String(value)} type="button" className={cn('rounded-md px-3 py-1.5 text-sm transition-colors', multiUser === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')} onClick={() => setMultiUser(value)}>
                  {value ? '开启' : '关闭'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">会话状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">当前固定为长期保持</p>
              <p className="text-xs text-muted-foreground">只要不主动退出，登录状态就会持续保留。后续版本再开放默认天数和管理员设置。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {multiUser && (
        <Card>
          <CardHeader className="pb-4 flex-row items-center justify-between">
            <CardTitle className="text-base">普通口令管理</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus className="mr-1.5 h-4 w-4" />添加口令</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.isError && <p className="text-sm text-muted-foreground">加载用户列表失败</p>}
            {users.data?.filter((u) => !u.is_admin).map((u: UserAdminSummary) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium', u.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                  {displayNameOf(u)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{displayNameOf(u)}</p>
                  <p className="truncate text-xs text-muted-foreground">普通用户{!u.is_active && <span className="ml-1.5 rounded bg-destructive/10 px-1 py-0.5 text-[10px] text-destructive">已停用</span>}</p>
                </div>
                {editingId === u.id ? (
                  <div className="flex items-center gap-2">
                    <Input className="h-8 w-32 text-xs" value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="昵称" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(u.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(u.id); setEditingName(u.display_name ?? ''); }}>编辑</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetId(resetId === u.id ? null : u.id)}><Key className="mr-1 h-3 w-3" />重置口令</Button>
                    <Button size="sm" variant="ghost" className={cn('h-7 text-xs', u.is_active ? 'text-muted-foreground' : 'text-primary')} onClick={() => handleToggleActive(u)}>
                      {u.is_active ? <Ban className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}{u.is_active ? '停用' : '启用'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="mr-1 h-3 w-3" />删除</Button>
                  </div>
                )}
              </div>
            ))}
            {resetId && users.data?.find((u: UserAdminSummary) => u.id === resetId) && (
              <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
                <Input type="password" className="h-8 flex-1 text-xs" placeholder="新口令（至少 5 位）" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
                <Button size="sm" className="h-8" onClick={() => handleResetPassword(resetId)}>确认</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setResetId(null)}>取消</Button>
              </div>
            )}
            {showCreate && (
              <div className="space-y-2 rounded-lg border border-border px-4 py-4">
                <Input type="password" className="h-9 text-sm" placeholder="口令（至少 5 位）" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Input className="h-9 text-sm" placeholder="昵称（可选）" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
                  <Button onClick={handleCreate} disabled={createUser.isPending}>{createUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}创建</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">暴力破解防护</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">时间窗口（分钟）</p>
              <p className="text-xs text-muted-foreground">在此时间范围内累计失败次数</p>
            </div>
            <Input type="number" min={1} max={60} className="w-24" value={bfWindow} onChange={(e) => setBfWindow(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">最大尝试次数</p>
              <p className="text-xs text-muted-foreground">超过此次数将触发锁定</p>
            </div>
            <Input type="number" min={1} max={20} className="w-24" value={bfMaxAttempts} onChange={(e) => setBfMaxAttempts(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">锁定时长（分钟）</p>
              <p className="text-xs text-muted-foreground">锁定期间拒绝所有登录请求</p>
            </div>
            <Input type="number" min={1} max={1440} className="w-24" value={bfLock} onChange={(e) => setBfLock(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}保存设置
        </Button>
      </div>
    </div>
  );
}

function BackupTab({ settings: _settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const backupList = useBackupList();

  const handleAutoBackup = useCallback(async () => {
    try {
      await triggerAutoBackup();
      onToast({ type: 'info', text: '自动备份完成' });
      backupList.refetch();
    } catch {
      onToast({ type: 'error', text: '备份失败' });
    }
  }, [backupList, onToast]);

  const handleExportJson = useCallback(() => {
    window.open(`${API_BASE}/export/books?format=json`, '_self');
  }, []);

  const handleExportCsv = useCallback(() => {
    window.open(`${API_BASE}/export/books?format=csv`, '_self');
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
      onToast({ type: 'info', text: '全量备份已下载' });
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
                {backupList.data.slice(0, 5).map((b: BackupItem) => (
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

      <CloudStorageCard onToast={onToast} />
    </div>
  );
}

function PropertiesTab() {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const tags = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [catShow, setCatShow] = useState(false);
  const [catName, setCatName] = useState('');
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catEditName, setCatEditName] = useState('');

  const [tagShow, setTagShow] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagEditId, setTagEditId] = useState<number | null>(null);
  const [tagEditName, setTagEditName] = useState('');

  const [toast, setToast] = useState<StatusMessage>(null);
  const showToast = useCallback((m: StatusMessage) => { setToast(m); if (m) setTimeout(() => setToast(null), 3000); }, []);

  const handleCreateCat = useCallback(async () => {
    try { await createCategory.mutateAsync({ name: catName }); showToast({ type: 'info', text: '分类已创建' }); setCatShow(false); setCatName(''); }
    catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [catName, createCategory, showToast]);

  const handleUpdateCat = useCallback(async (id: number) => {
    try { await updateCategory.mutateAsync({ id, name: catEditName }); showToast({ type: 'info', text: '已更新' }); setCatEditId(null); }
    catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [catEditName, updateCategory, showToast]);

  const handleDeleteCat = useCallback(async (id: number) => {
    try { await deleteCategory.mutateAsync(id); showToast({ type: 'info', text: '分类已删除' }); }
    catch { showToast({ type: 'error', text: '删除失败' }); }
  }, [deleteCategory, showToast]);

  const handleCreateTag = useCallback(async () => {
    try { await createTag.mutateAsync({ name: tagName }); showToast({ type: 'info', text: '标签已创建' }); setTagShow(false); setTagName(''); }
    catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [tagName, createTag, showToast]);

  const handleUpdateTag = useCallback(async (id: number) => {
    try { await updateTag.mutateAsync({ id, name: tagEditName }); showToast({ type: 'info', text: '已更新' }); setTagEditId(null); }
    catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [tagEditName, updateTag, showToast]);

  const handleDeleteTag = useCallback(async (id: number) => {
    try { await deleteTag.mutateAsync(id); showToast({ type: 'info', text: '标签已删除' }); }
    catch { showToast({ type: 'error', text: '删除失败' }); }
  }, [deleteTag, showToast]);

  return (
    <div className="space-y-8">
      <StatusToast message={toast} onClose={() => setToast(null)} className="absolute left-1/2 top-0 -translate-x-1/2" />

      <Card>
        <CardHeader className="pb-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">分类</CardTitle>
            <p className="text-xs text-muted-foreground">管理书籍分类，一书一分类</p>
          </div>
          <Button size="sm" onClick={() => setCatShow(true)}><Plus className="mr-1.5 h-4 w-4" />新建</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.isError && <p className="text-sm text-muted-foreground">加载失败</p>}
          {categories.data && categories.data.length === 0 && !catShow && (
            <p className="text-sm text-muted-foreground">还没有分类</p>
          )}
          {categories.data?.map((cat: CategoryItem) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                {catEditId === cat.id ? (
                  <div className="flex items-center gap-2">
                    <Input className="h-8 flex-1 text-sm" value={catEditName} onChange={(e) => setCatEditName(e.target.value)} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateCat(cat.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCatEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground">{cat.name}</p>
                )}
                <p className="text-xs text-muted-foreground">{cat.book_count} 本书</p>
              </div>
              {catEditId !== cat.id && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCatEditId(cat.id); setCatEditName(cat.name); }}><Pencil className="mr-1 h-3 w-3" />编辑</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteCat(cat.id)}><Trash2 className="mr-1 h-3 w-3" />删除</Button>
                </div>
              )}
            </div>
          ))}
          {catShow && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              <Input className="h-8 flex-1 text-sm" placeholder="分类名称" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <Button size="sm" className="h-8" onClick={handleCreateCat} disabled={createCategory.isPending}>创建</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setCatShow(false)}>取消</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">标签</CardTitle>
            <p className="text-xs text-muted-foreground">管理书籍标签，一书本可多标签</p>
          </div>
          <Button size="sm" onClick={() => setTagShow(true)}><Plus className="mr-1.5 h-4 w-4" />新建</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {tags.isError && <p className="text-sm text-muted-foreground">加载失败</p>}
          {tags.data && tags.data.length === 0 && !tagShow && (
            <p className="text-sm text-muted-foreground">还没有标签</p>
          )}
          {tags.data?.map((tag: TagItem) => (
            <div key={tag.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                {tagEditId === tag.id ? (
                  <div className="flex items-center gap-2">
                    <Input className="h-8 flex-1 text-sm" value={tagEditName} onChange={(e) => setTagEditName(e.target.value)} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateTag(tag.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTagEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground">#{tag.name}</p>
                )}
                <p className="text-xs text-muted-foreground">{tag.book_count} 本书</p>
              </div>
              {tagEditId !== tag.id && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setTagEditId(tag.id); setTagEditName(tag.name); }}><Pencil className="mr-1 h-3 w-3" />编辑</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteTag(tag.id)}><Trash2 className="mr-1 h-3 w-3" />删除</Button>
                </div>
              )}
            </div>
          ))}
          {tagShow && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              <Input className="h-8 flex-1 text-sm" placeholder="标签名称" value={tagName} onChange={(e) => setTagName(e.target.value)} />
              <Button size="sm" className="h-8" onClick={handleCreateTag} disabled={createTag.isPending}>创建</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setTagShow(false)}>取消</Button>
            </div>
          )}
        </CardContent>
      </Card>
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
                {(Object.entries(storage.data.breakdown) as [string, DirInfo][]).map(([key, info]) => {
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
                            style={{ width: `${Math.max(Number(percentage), 1)}%` } as CSSProperties}
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

function BatchUploadCard({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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
        const res = await api.post<{ data: { id: number } }>('/files/unassociated', form);
        results.push({ ...item, status: 'success', resultId: res.data.id, error: null });
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
                          onChange={(e) => updateItemMode(index, e.target.value as StorageMode)}
                          className="w-40"
                        >
                          <option value="local_only">{STORAGE_MODE_LABELS.local_only}</option>
                          <option value="cloud_only" disabled={!cloudAvailable}>{STORAGE_MODE_LABELS.cloud_only}</option>
                          <option value="dual" disabled={!cloudAvailable}>{STORAGE_MODE_LABELS.dual}</option>
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

function CloudStorageCard({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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
        access_key: accessKey || null,
        secret_key: secretKey || null,
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

function SystemTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const stats = useSystemStats();
  const backup = useBackup();
  const ftsRebuild = useFtsRebuild();
  const clearCache = useClearCache();

  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleReset = async () => {
    if (!resetPassword) return;
    setResetLoading(true);
    try {
      await api.post('/system/reset', { password: resetPassword });
      onToast({ type: 'info', text: '应用已重置，即将刷新页面...' });
      setTimeout(() => window.location.href = '/', 1500);
    } catch (err) {
      onToast({ type: 'error', text: err instanceof Error ? err.message : '重置失败' });
    } finally {
      setResetLoading(false);
    }
  };

  if (stats.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stats.isError) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/30">
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">系统信息加载失败</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.error instanceof Error ? stats.error.message : '未知错误'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => stats.refetch()}>
                <RotateCw className="mr-1 h-4 w-4" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats.data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">应用信息</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">数据概览</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">存储概况</CardTitle>
        </CardHeader>
        <CardContent>
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
                  onToast({ type: 'info', text: `备份完成：${r.path}` });
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
                  onToast({ type: 'info', text: '索引重建完成' });
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
                    type: 'info',
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

      <Card className="border-destructive/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-destructive">重置应用</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">重置将清空所有数据并恢复为首次部署状态，此操作不可撤销。需要输入管理员口令进行二次验证。</p>
          {!resetConfirm ? (
            <Button variant="destructive" size="sm" onClick={() => setResetConfirm(true)}>开始重置</Button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-foreground">管理员口令</p>
                <Input type="password" className="h-9" placeholder="输入当前管理员口令以确认" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={resetLoading || !resetPassword}>
                  {resetLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                  确认重置
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setResetConfirm(false); setResetPassword(''); }}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleSettingsPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppSidebar activeKey="settings" user={user} />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">个人设置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              管理你的账户信息和偏好
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">账户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">身份</span>
                <span className="font-medium text-foreground">{user.is_admin ? '管理员' : '普通用户'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">显示名</span>
                <span className="font-medium text-foreground">
                  {user.display_name || '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">安全</CardTitle>
            </CardHeader>
            <CardContent>
              {!showChangePwd ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowChangePwd(true)}
                >
                  <Key className="mr-2 h-4 w-4" />
                  修改口令
                </Button>
              ) : (
                <SimpleChangePassword onClose={() => setShowChangePwd(false)} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">会话</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive"
                onClick={() => {
                  logout.mutateAsync().then(() => {
                    navigate('/login', { replace: true });
                  }).catch(() => {
                    // ignore
                  });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function SimpleChangePassword({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (newPwd !== confirmPwd) {
      setError('两次输入不一致');
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: current, new_password: newPwd });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">当前口令</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">新口令</Label>
        <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">确认新口令</Label>
        <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={changePassword.isPending}>
          {changePassword.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          确认修改
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>取消</Button>
      </div>
    </div>
  );
}
