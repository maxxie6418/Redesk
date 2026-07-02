import { useCallback, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Cloud,
  HardDrive,
  Key,
  List,
  Loader2,
  LogOut,
  Monitor,
  Server,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedShell } from '@/components/protected-shell';
import { useShellUser } from '@/components/shell-user-context';
import { useLogout } from '@/hooks/use-auth';
import { useSettings } from '@/hooks/use-settings';
import type { AuthUser } from '@/lib/api';
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

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
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
      <ProtectedShell activeKey="settings" mainClassName="overflow-y-auto px-6 py-6">
        <StatusToast message={toast} onClose={() => setToast(null)} />
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
      </ProtectedShell>
    </>
  );
}

function SimpleSettingsPage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <ProtectedShell activeKey="settings" mainClassName="overflow-y-auto px-6 py-6">
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
    </ProtectedShell>
  );
}
