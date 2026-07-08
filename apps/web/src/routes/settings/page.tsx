import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Cloud, Database, Download, HardDrive, Key, List, Loader2, LogOut, Monitor, Server, Shield, Sparkles, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedShell } from '@/components/protected-shell';
import { useShellUser } from '@/components/shell-user-context';
import { useLogout } from '@/hooks/use-auth';
import { API_BASE } from '@/lib/api';
import type { AuthUser } from '@/lib/api';
import { useBackupList, triggerAutoBackup } from '@/hooks/use-export';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { useSettings } from '@/hooks/use-settings';
import { useSystemStats } from '@/hooks/use-system';
import { cn } from '@/lib/utils';
import { SimpleChangePassword } from './simple-change-password';
import type { StatusMessage, Tab } from './types';

const AiTab = lazy(() => import('./ai-tab').then((module) => ({ default: module.AiTab })));
const BatchTab = lazy(() => import('./batch-tab').then((module) => ({ default: module.BatchTab })));
const BackupTab = lazy(() => import('./backup-tab').then((module) => ({ default: module.BackupTab })));
const GeneralTab = lazy(() => import('./general-tab').then((module) => ({ default: module.GeneralTab })));
const LoginManagementTab = lazy(() => import('./login-management-tab').then((module) => ({ default: module.LoginManagementTab })));
const MaintenanceTab = lazy(() => import('./maintenance-tab').then((module) => ({ default: module.MaintenanceTab })));
const PropertiesTab = lazy(() => import('./properties-tab').then((module) => ({ default: module.PropertiesTab })));
const StorageTab = lazy(() => import('./storage-tab').then((module) => ({ default: module.StorageTab })));
const SystemTab = lazy(() => import('./system-tab').then((module) => ({ default: module.SystemTab })));

const VALID_TABS: Tab[] = ['general', 'batch', 'maintenance', 'ai', 'login', 'properties', 'backup', 'storage', 'system'];

function isValidTab(value: string | null): value is Tab {
  return value != null && VALID_TABS.includes(value as Tab);
}

export function SettingsPage() {
  const user = useShellUser();
  const isMobileLayout = useMobileLayout();
  const [searchParams] = useSearchParams();

  if (isMobileLayout && searchParams.get('mobile') === 'backup') {
    return <MobileBackupPage />;
  }

  if (isMobileLayout && user.is_admin) {
    return <MobileAdminSettingsPage user={user} />;
  }

  return user.is_admin ? <AdminSettingsPage /> : <SimpleSettingsPage user={user} />;
}

function TabFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
      页面加载中...
    </div>
  );
}

function AdminSettingsPage() {
  const user = useShellUser();
  const navigate = useNavigate();
  const isMobileLayout = useMobileLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTabFromQuery: Tab = isValidTab(tabParam) ? tabParam : 'general';
  const [activeTab, setActiveTab] = useState<Tab>(activeTabFromQuery);
  const settings = useSettings();

  useEffect(() => {
    setActiveTab(activeTabFromQuery);
  }, [activeTabFromQuery]);

  const showToast = useCallback((message: StatusMessage) => {
    if (!message) return;
    if (message.type === 'error') {
      toast.error(message.text);
    } else if (message.type === 'warning') {
      toast.warning(message.text);
    } else {
      toast.success(message.text);
    }
  }, []);

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'general', label: '通用', icon: <Monitor className="h-4 w-4" /> },
    { key: 'batch', label: '书籍管理', icon: <Upload className="h-4 w-4" /> },
    { key: 'maintenance', label: '数据维护', icon: <Database className="h-4 w-4" /> },
    { key: 'ai', label: 'AI', icon: <Sparkles className="h-4 w-4" /> },
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
      {user.must_change_password === true ? (
        <div className="border-b border-amber-200/60 bg-amber-50/95 px-6 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>你正在使用初始口令，请先修改后再继续。</span>
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
      ) : null}

      <ProtectedShell
        activeKey="settings"
        mobileNavKey="settings"
        mainClassName={isMobileLayout ? 'overflow-y-auto px-0 py-0' : 'overflow-y-auto px-6 py-6'}
      >
        <div className={cn('mx-auto max-w-7xl', isMobileLayout ? 'space-y-4 px-4 py-4' : '')}>
          <div className={cn(isMobileLayout ? 'space-y-1' : 'mb-5')}>
            <h1 className="text-xl font-semibold text-foreground">设置</h1>
            {isMobileLayout ? (
              <p className="text-sm text-muted-foreground">管理账号、批量任务、存储、备份与系统参数</p>
            ) : null}
          </div>

          <nav
            className={cn(
              'mb-6',
              isMobileLayout
                ? 'grid grid-cols-2 gap-2'
                : 'flex gap-1 rounded-lg border border-border bg-popover p-1',
            )}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  'min-w-0 text-sm font-medium transition-colors',
                  isMobileLayout
                    ? 'flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-[0_10px_24px_rgba(64,47,31,0.06)]'
                    : 'flex items-center gap-2 rounded-md px-4 py-2',
                  activeTab === tab.key
                    ? isMobileLayout
                      ? 'border-primary/30 bg-primary/12 text-primary'
                      : 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setActiveTab(tab.key);
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('tab', tab.key);
                  if (tab.key !== 'batch') {
                    nextParams.delete('books');
                  }
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>

          <Suspense fallback={<TabFallback />}>
            {activeTab === 'general' ? <GeneralTab settings={settings.data ?? {}} onToast={showToast} /> : null}
            {activeTab === 'batch' ? (
              <BatchTab settings={settings.data ?? {}} onToast={showToast} />
            ) : null}
            {activeTab === 'maintenance' ? <MaintenanceTab /> : null}
            {activeTab === 'ai' ? <AiTab settings={settings.data ?? {}} onToast={showToast} /> : null}
            {activeTab === 'login' ? <LoginManagementTab /> : null}
            {activeTab === 'properties' ? <PropertiesTab /> : null}
            {activeTab === 'backup' ? <BackupTab settings={settings.data ?? {}} onToast={showToast} /> : null}
            {activeTab === 'storage' ? <StorageTab onToast={showToast} /> : null}
            {activeTab === 'system' ? <SystemTab onToast={showToast} /> : null}
          </Suspense>
        </div>
      </ProtectedShell>
    </>
  );
}

function SimpleSettingsPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <ProtectedShell activeKey="settings" mobileNavKey="settings" mainClassName="overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">个人设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理你的账号信息和偏好。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">身份</span>
              <span className="font-medium text-foreground">{user.is_admin ? '管理员' : '普通用户'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">显示名</span>
              <span className="font-medium text-foreground">{user.display_name || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">安全</CardTitle>
          </CardHeader>
          <CardContent>
            {!showChangePwd ? (
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowChangePwd(true)}>
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
    </ProtectedShell>
  );
}

function MobileBackupPage() {
  const navigate = useNavigate();
  const backups = useBackupList();
  const systemStats = useSystemStats();
  const latestBackup = backups.data?.[0] ?? null;
  const [backupPending, setBackupPending] = useState(false);

  const handleTriggerBackup = async () => {
    try {
      setBackupPending(true);
      await triggerAutoBackup();
      await backups.refetch();
    } finally {
      setBackupPending(false);
    }
  };

  return (
    <ProtectedShell activeKey="settings" mobileNavKey="backup" mainClassName="px-0 py-0">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-foreground font-display text-lg font-semibold text-background">R</div>
          <div>
            <div className="text-lg font-bold tracking-[-0.04em] text-foreground">备份与导出</div>
            <div className="text-[11px] text-muted-foreground">数据主权优先</div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-border bg-card text-foreground shadow-sm"
          onClick={() => navigate('/settings')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <section className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm text-foreground">导出内容</strong>
          <span className="text-[11px] text-muted-foreground">优先通用格式</span>
        </div>
        <div className="space-y-2">
          <MobileActionRow
            title="书籍元数据"
            subtitle={`当前共 ${systemStats.data?.book_count ?? 0} 本书，可导出 JSON`}
            actionLabel="JSON"
            onClick={() => window.open(`${API_BASE}/export/books?format=json`, '_blank', 'noopener')}
          />
          <MobileActionRow
            title="书架清单"
            subtitle="导出 CSV，便于表格处理和备份留档。"
            actionLabel="CSV"
            onClick={() => window.open(`${API_BASE}/export/books?format=csv`, '_blank', 'noopener')}
          />
          <MobileActionRow
            title="完整备份包"
            subtitle="下载数据库、存储文件和 Markdown 导出。"
            actionLabel="ZIP"
            onClick={() => window.open(`${API_BASE}/backup/full`, '_blank', 'noopener')}
          />
        </div>
      </section>

      <section className="mt-3 rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm text-foreground">备份状态</strong>
          <span className="text-[11px] text-muted-foreground">简化显示</span>
        </div>
        <div className="space-y-2">
          <MobileActionRow
            title="最近一次本地备份"
            subtitle={latestBackup ? new Date(latestBackup.created_at).toLocaleString('zh-CN') : '还没有备份记录。'}
            actionLabel={backupPending ? '处理中' : '立即备份'}
            onClick={handleTriggerBackup}
            disabled={backupPending}
          />
          <MobileActionRow
            title="对象存储与高级配置"
            subtitle="复杂存储策略仍建议在桌面端完成。"
            actionLabel="设置"
            onClick={() => navigate('/settings')}
          />
        </div>
      </section>

      <section className="mt-3 rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
        <div className="mb-3 text-sm font-semibold text-foreground">更多入口</div>
        <div className="space-y-2">
          <MobileActionRow
            title="进入完整设置"
            subtitle="继续管理批量任务、登录、属性、存储与系统。"
            actionLabel="打开"
            onClick={() => navigate('/settings')}
          />
          <MobileActionRow
            title="返回轻管理"
            subtitle="回到添加、上传、导入和概览入口。"
            actionLabel="前往"
            onClick={() => navigate('/overview')}
          />
        </div>
      </section>
    </ProtectedShell>
  );
}

function MobileAdminSettingsPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const systemStats = useSystemStats();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <ProtectedShell activeKey="settings" mobileNavKey="settings" mainClassName="px-0 py-0">
      <div className="space-y-3">
        <section className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">设置</h1>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">移动端保留高频操作，复杂管理仍建议在桌面端完成。</p>
            </div>
            <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-[16px] bg-foreground px-3 text-sm font-semibold text-background">
              {user.display_name?.slice(0, 1) || 'R'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileActionRow
              title="备份与导出"
              subtitle="查看最近备份并导出 JSON、CSV、ZIP。"
              actionLabel="打开"
              onClick={() => navigate('/settings?mobile=backup')}
            />
            <MobileActionRow
              title="轻管理"
              subtitle="回到上传、导入和概览入口。"
              actionLabel="前往"
              onClick={() => navigate('/overview')}
            />
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <strong className="text-sm text-foreground">账号与安全</strong>
            <span className="text-[11px] text-muted-foreground">{user.is_admin ? '管理员' : '普通用户'}</span>
          </div>

          {!showChangePwd ? (
            <div className="space-y-2">
              <MobileActionRow
                title="修改口令"
                subtitle="更新当前账号口令。"
                actionLabel="打开"
                onClick={() => setShowChangePwd(true)}
              />
              <MobileActionRow
                title="退出登录"
                subtitle="退出后需要重新登录。"
                actionLabel="退出"
                onClick={() => {
                  logout.mutateAsync().then(() => {
                    navigate('/login', { replace: true });
                  }).catch(() => {
                    // ignore
                  });
                }}
                disabled={logout.isPending}
              />
            </div>
          ) : (
            <div className="rounded-[18px] border border-border px-3 py-3">
              <SimpleChangePassword onClose={() => setShowChangePwd(false)} />
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <strong className="text-sm text-foreground">系统概览</strong>
            <span className="text-[11px] text-muted-foreground">只读摘要</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileStatCard label="书籍" value={systemStats.data?.book_count ?? '--'} />
            <MobileStatCard label="文件" value={systemStats.data?.file_count ?? '--'} />
            <MobileStatCard label="分类" value={systemStats.data?.category_count ?? '--'} />
            <MobileStatCard label="标签" value={systemStats.data?.tag_count ?? '--'} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[18px] bg-muted px-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">桌面端完整设置</div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">书籍管理、AI、存储、登录管理、属性设置等高级功能仍建议在桌面端完成。</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}

function MobileStatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[18px] bg-muted px-3 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MobileActionRow({
  title,
  subtitle,
  actionLabel,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[18px] border border-border bg-[rgba(255,253,248,0.92)] px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
        <Download className="h-3 w-3" />
        {actionLabel}
      </span>
    </button>
  );
}
