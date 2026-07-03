import { useCallback, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Cloud, Download, HardDrive, Key, List, Loader2, LogOut, Monitor, Server, Shield, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { AiTab } from './ai-tab';
import { BackupTab } from './backup-tab';
import { GeneralTab } from './general-tab';
import { LoginManagementTab } from './login-management-tab';
import { PropertiesTab } from './properties-tab';
import { SimpleChangePassword } from './simple-change-password';
import { StatusToast } from './status-toast';
import { StorageTab } from './storage-tab';
import { SystemTab } from './system-tab';
import type { StatusMessage, Tab } from './types';

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

function AdminSettingsPage() {
  const user = useShellUser();
  const navigate = useNavigate();
  const isMobileLayout = useMobileLayout();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [toast, setToast] = useState<StatusMessage>(null);
  const settings = useSettings();

  const showToast = useCallback((message: StatusMessage) => {
    setToast(message);
    if (message) {
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'general', label: '\u901a\u7528', icon: <Monitor className="h-4 w-4" /> },
    { key: 'ai', label: 'AI', icon: <Sparkles className="h-4 w-4" /> },
    { key: 'login', label: '\u767b\u5f55\u7ba1\u7406', icon: <Shield className="h-4 w-4" /> },
    { key: 'properties', label: '\u5c5e\u6027\u8bbe\u7f6e', icon: <List className="h-4 w-4" /> },
    { key: 'backup', label: '\u4e91\u5907\u4efd', icon: <Cloud className="h-4 w-4" /> },
    { key: 'storage', label: '\u5b58\u50a8', icon: <HardDrive className="h-4 w-4" /> },
    { key: 'system', label: '\u7cfb\u7edf', icon: <Server className="h-4 w-4" /> },
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
              <span>\u4f60\u6b63\u5728\u4f7f\u7528\u521d\u59cb\u53e3\u4ee4\uff0c\u8bf7\u5148\u4fee\u6539\u540e\u518d\u7ee7\u7eed\u3002</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/change-password?return=/settings')}
              className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
            >
              \u7acb\u5373\u8bbe\u7f6e
            </Button>
          </div>
        </div>
      ) : null}

      <ProtectedShell
        activeKey="settings"
        mobileNavKey="settings"
        mainClassName={isMobileLayout ? 'overflow-y-auto px-0 py-0' : 'overflow-y-auto px-6 py-6'}
      >
        <StatusToast message={toast} onClose={() => setToast(null)} />
        <div className={cn('mx-auto max-w-5xl', isMobileLayout ? 'space-y-4 px-4 py-4' : '')}>
          <div className={cn(isMobileLayout ? 'space-y-1' : 'mb-5')}>
            <h1 className="text-xl font-semibold text-foreground">\u8bbe\u7f6e</h1>
            {isMobileLayout ? (
              <p className="text-sm text-muted-foreground">\u7ba1\u7406\u8d26\u6237\u3001\u5b58\u50a8\u3001\u5907\u4efd\u4e0e\u7cfb\u7edf\u53c2\u6570</p>
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
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>

          {activeTab === 'general' ? <GeneralTab settings={settings.data ?? {}} onToast={showToast} /> : null}
          {activeTab === 'ai' ? <AiTab settings={settings.data ?? {}} onToast={showToast} /> : null}
          {activeTab === 'login' ? <LoginManagementTab /> : null}
          {activeTab === 'properties' ? <PropertiesTab /> : null}
          {activeTab === 'backup' ? <BackupTab settings={settings.data ?? {}} onToast={showToast} /> : null}
          {activeTab === 'storage' ? <StorageTab onToast={showToast} /> : null}
          {activeTab === 'system' ? <SystemTab onToast={showToast} /> : null}
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
          <h1 className="text-2xl font-semibold text-foreground">\u4e2a\u4eba\u8bbe\u7f6e</h1>
          <p className="mt-1 text-sm text-muted-foreground">\u7ba1\u7406\u4f60\u7684\u8d26\u6237\u4fe1\u606f\u548c\u504f\u597d</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">\u8d26\u6237\u4fe1\u606f</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">\u8eab\u4efd</span>
              <span className="font-medium text-foreground">{user.is_admin ? '\u7ba1\u7406\u5458' : '\u666e\u901a\u7528\u6237'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">\u663e\u793a\u540d</span>
              <span className="font-medium text-foreground">{user.display_name || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">\u5b89\u5168</CardTitle>
          </CardHeader>
          <CardContent>
            {!showChangePwd ? (
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowChangePwd(true)}>
                <Key className="mr-2 h-4 w-4" />
                \u4fee\u6539\u53e3\u4ee4
              </Button>
            ) : (
              <SimpleChangePassword onClose={() => setShowChangePwd(false)} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">\u4f1a\u8bdd</CardTitle>
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
              \u9000\u51fa\u767b\u5f55
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
            <div className="text-lg font-bold tracking-[-0.04em] text-foreground">\u5907\u4efd\u4e0e\u5bfc\u51fa</div>
            <div className="text-[11px] text-muted-foreground">\u6570\u636e\u4e3b\u6743\u4f18\u5148</div>
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
          <strong className="text-sm text-foreground">\u5bfc\u51fa\u5185\u5bb9</strong>
          <span className="text-[11px] text-muted-foreground">\u4f18\u5148\u901a\u7528\u683c\u5f0f</span>
        </div>
        <div className="space-y-2">
          <MobileActionRow
            title="\u4e66\u7c4d\u5143\u6570\u636e"
            subtitle={`\u5f53\u524d\u5171 ${systemStats.data?.book_count ?? 0} \u672c\u4e66\uff0c\u53ef\u5bfc\u51fa JSON`}
            actionLabel="JSON"
            onClick={() => window.open(`${API_BASE}/export/books?format=json`, '_blank', 'noopener')}
          />
          <MobileActionRow
            title="\u4e66\u67b6\u6e05\u5355"
            subtitle="\u5bfc\u51fa CSV\uff0c\u4fbf\u4e8e\u8868\u683c\u5904\u7406\u548c\u5907\u4efd\u7559\u6863"
            actionLabel="CSV"
            onClick={() => window.open(`${API_BASE}/export/books?format=csv`, '_blank', 'noopener')}
          />
          <MobileActionRow
            title="\u5b8c\u6574\u5907\u4efd\u5305"
            subtitle="\u4e0b\u8f7d\u6570\u636e\u5e93\u3001\u5b58\u50a8\u6587\u4ef6\u548c Markdown \u5bfc\u51fa"
            actionLabel="ZIP"
            onClick={() => window.open(`${API_BASE}/backup/full`, '_blank', 'noopener')}
          />
        </div>
      </section>

      <section className="mt-3 rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm text-foreground">\u5907\u4efd\u72b6\u6001</strong>
          <span className="text-[11px] text-muted-foreground">\u7b80\u5316\u663e\u793a</span>
        </div>
        <div className="space-y-2">
          <MobileActionRow
            title="\u6700\u8fd1\u4e00\u6b21\u672c\u5730\u5907\u4efd"
            subtitle={latestBackup ? new Date(latestBackup.created_at).toLocaleString('zh-CN') : '\u8fd8\u6ca1\u6709\u5907\u4efd\u8bb0\u5f55'}
            actionLabel={backupPending ? '\u5904\u7406\u4e2d' : '\u7acb\u5373\u5907\u4efd'}
            onClick={handleTriggerBackup}
            disabled={backupPending}
          />
          <MobileActionRow
            title="\u5bf9\u8c61\u5b58\u50a8\u4e0e\u9ad8\u7ea7\u914d\u7f6e"
            subtitle="\u590d\u6742\u5b58\u50a8\u7b56\u7565\u4ecd\u5efa\u8bae\u5728\u684c\u9762\u7aef\u5b8c\u6210"
            actionLabel="\u8bbe\u7f6e"
            onClick={() => navigate('/settings')}
          />
        </div>
      </section>

      <section className="mt-3 rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(64,47,31,0.06)]">
        <div className="mb-3 text-sm font-semibold text-foreground">\u66f4\u591a\u5165\u53e3</div>
        <div className="space-y-2">
          <MobileActionRow
            title="\u8fdb\u5165\u5b8c\u6574\u8bbe\u7f6e"
            subtitle="\u7ee7\u7eed\u7ba1\u7406\u767b\u5f55\u3001\u5c5e\u6027\u3001\u5b58\u50a8\u4e0e\u7cfb\u7edf"
            actionLabel="\u6253\u5f00"
            onClick={() => navigate('/settings')}
          />
          <MobileActionRow
            title="\u8fd4\u56de\u8f7b\u7ba1\u7406"
            subtitle="\u56de\u5230\u6dfb\u52a0\u3001\u4e0a\u4f20\u3001\u5907\u4efd\u5165\u53e3\u4e2d\u5fc3"
            actionLabel="\u524d\u5f80"
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
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">移动端保留高频操作，复杂管理建议在桌面端完成。</p>
            </div>
            <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-[16px] bg-foreground px-3 text-sm font-semibold text-background">
              {user.display_name?.slice(0, 1) || 'R'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileActionRow
              title="备份与导出"
              subtitle="查看最近备份并导出 JSON、CSV、ZIP"
              actionLabel="打开"
              onClick={() => navigate('/settings?mobile=backup')}
            />
            <MobileActionRow
              title="轻管理"
              subtitle="回到上传、导入和概览入口"
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
                subtitle="更新当前账户口令"
                actionLabel="打开"
                onClick={() => setShowChangePwd(true)}
              />
              <MobileActionRow
                title="退出登录"
                subtitle="退出后需要重新登录"
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
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">AI、存储、登录管理、属性设置等高级功能仍建议在桌面端完成。</div>
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
