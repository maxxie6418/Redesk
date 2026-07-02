import { useCallback, useState, type ReactNode } from 'react';
import { AlertTriangle, Cloud, HardDrive, Key, List, Loader2, LogOut, Monitor, Server, Shield, Sparkles } from 'lucide-react';
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
  return user.is_admin ? <AdminSettingsPage /> : <SimpleSettingsPage user={user} />;
}

function AdminSettingsPage() {
  const user = useShellUser();
  const navigate = useNavigate();
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
      {user.must_change_password === true && (
        <div className="border-b border-amber-200/60 bg-amber-50/95 px-6 py-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{'\u4f60\u6b63\u5728\u4f7f\u7528\u521d\u59cb\u53e3\u4ee4\u3002\u8bf7\u5148\u8bbe\u7f6e\u4e00\u4e2a\u65b0\u53e3\u4ee4\u540e\u518d\u7ee7\u7eed\u3002'}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/change-password?return=/settings')}
              className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
            >
              {'\u7acb\u5373\u8bbe\u7f6e'}
            </Button>
          </div>
        </div>
      )}
      <ProtectedShell activeKey="settings" mainClassName="overflow-y-auto px-6 py-6">
        <StatusToast message={toast} onClose={() => setToast(null)} />
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-5 text-xl font-semibold text-foreground">{'\u8bbe\u7f6e'}</h1>
          <nav className="mb-6 flex gap-1 rounded-lg border border-border bg-popover p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'general' && <GeneralTab settings={settings.data ?? {}} onToast={showToast} />}
          {activeTab === 'ai' && <AiTab settings={settings.data ?? {}} onToast={showToast} />}
          {activeTab === 'login' && <LoginManagementTab />}
          {activeTab === 'properties' && <PropertiesTab />}
          {activeTab === 'backup' && <BackupTab settings={settings.data ?? {}} onToast={showToast} />}
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
          <h1 className="text-2xl font-semibold text-foreground">{'\u4e2a\u4eba\u8bbe\u7f6e'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{'\u7ba1\u7406\u4f60\u7684\u8d26\u6237\u4fe1\u606f\u548c\u504f\u597d'}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'\u8d26\u6237\u4fe1\u606f'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">{'\u8eab\u4efd'}</span>
              <span className="font-medium text-foreground">{user.is_admin ? '\u7ba1\u7406\u5458' : '\u666e\u901a\u7528\u6237'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{'\u663e\u793a\u540d'}</span>
              <span className="font-medium text-foreground">{user.display_name || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'\u5b89\u5168'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!showChangePwd ? (
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowChangePwd(true)}>
                <Key className="mr-2 h-4 w-4" />
                {'\u4fee\u6539\u53e3\u4ee4'}
              </Button>
            ) : (
              <SimpleChangePassword onClose={() => setShowChangePwd(false)} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'\u4f1a\u8bdd'}</CardTitle>
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
              {'\u9000\u51fa\u767b\u5f55'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ProtectedShell>
  );
}
