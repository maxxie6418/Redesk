import { useState, type ReactNode } from 'react';
import { AlertTriangle, Download, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useBackup, useClearCache, useFtsRebuild, useSystemStats } from '@/hooks/use-system';
import { formatBytes, formatUptime, type StatusMessage } from './types';

export function SystemTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
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
      onToast({ type: 'info', text: 'App reset complete. Refreshing...' });
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err) {
      onToast({ type: 'error', text: err instanceof Error ? err.message : 'Reset failed' });
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
      <Card className="border-destructive/30">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">{'\u7cfb\u7edf\u4fe1\u606f\u52a0\u8f7d\u5931\u8d25'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.error instanceof Error ? stats.error.message : '\u672a\u77e5\u9519\u8bef'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => stats.refetch()}>
              <RotateCw className="mr-1 h-4 w-4" />
              {'\u91cd\u8bd5'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats.data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'\u5e94\u7528\u4fe1\u606f'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'\u7248\u672c'} value={`v${stats.data.version}`} />
            <InfoCell label={'\u8fd0\u884c\u73af\u5883'} value={stats.data.node_env === 'production' ? '\u751f\u4ea7' : '\u5f00\u53d1'} />
            <InfoCell label={'\u8fd0\u884c\u65f6\u957f'} value={formatUptime(stats.data.uptime_seconds)} />
            <InfoCell label="Node.js" value={stats.data.node_version} />
            <InfoCell label="SQLite" value={stats.data.sqlite_version} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'\u6570\u636e\u6982\u89c8'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'\u4e66\u7c4d\u603b\u6570'} value={stats.data.book_count} large />
            <InfoCell label={'\u6587\u4ef6\u6570'} value={stats.data.file_count} large />
            <InfoCell label={'\u5206\u7c7b'} value={stats.data.category_count} large />
            <InfoCell label={'\u6807\u7b7e'} value={stats.data.tag_count} large />
            {stats.data.user_count != null && <InfoCell label={'\u7528\u6237'} value={stats.data.user_count} large />}
            <InfoCell label={'\u56de\u6536\u7ad9'} value={stats.data.trash_count} large />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'\u5b58\u50a8\u6982\u51b5'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'\u6570\u636e\u5e93\u5927\u5c0f'} value={formatBytes(stats.data.db_size_bytes)} large />
            <InfoCell label={'\u6587\u4ef6\u5b58\u50a8'} value={formatBytes(stats.data.storage_size_bytes)} large />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'\u7ef4\u62a4\u64cd\u4f5c'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionRow
            title={'\u624b\u52a8\u5907\u4efd'}
            description={'\u5bfc\u51fa SQLite \u6570\u636e\u5e93\u5230\u5907\u4efd\u76ee\u5f55'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await backup.mutateAsync();
                    onToast({ type: 'info', text: `\u5907\u4efd\u5b8c\u6210\uff1a${result.path}` });
                  } catch {
                    onToast({ type: 'error', text: '\u5907\u4efd\u5931\u8d25' });
                  }
                }}
                disabled={backup.isPending}
              >
                {backup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            }
          />

          <ActionRow
            title={'\u91cd\u5efa\u5168\u6587\u7d22\u5f15'}
            description={'\u641c\u7d22\u5f02\u5e38\u65f6\u53ef\u7528\u6b64\u64cd\u4f5c\u4fee\u590d'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await ftsRebuild.mutateAsync();
                    onToast({ type: 'info', text: '\u7d22\u5f15\u91cd\u5efa\u5b8c\u6210' });
                  } catch {
                    onToast({ type: 'error', text: '\u91cd\u5efa\u5931\u8d25' });
                  }
                }}
                disabled={ftsRebuild.isPending}
              >
                {ftsRebuild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              </Button>
            }
          />

          <ActionRow
            title={'\u6e05\u7406\u7f13\u5b58'}
            description={'\u6e05\u9664\u8fd0\u884c\u65f6\u4e34\u65f6\u6587\u4ef6'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await clearCache.mutateAsync();
                    onToast({ type: 'info', text: `\u5df2\u6e05\u7406 ${formatBytes(result.freed_bytes)}\uff08${result.removed_files} \u4e2a\u6587\u4ef6\uff09` });
                  } catch {
                    onToast({ type: 'error', text: '\u6e05\u7406\u5931\u8d25' });
                  }
                }}
                disabled={clearCache.isPending}
              >
                {clearCache.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-destructive">{'\u91cd\u7f6e\u5e94\u7528'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {'\u91cd\u7f6e\u5c06\u6e05\u7a7a\u6240\u6709\u6570\u636e\u5e76\u6062\u590d\u4e3a\u9996\u6b21\u90e8\u7f72\u72b6\u6001\uff0c\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002'}
          </p>
          {!resetConfirm ? (
            <Button variant="destructive" size="sm" onClick={() => setResetConfirm(true)}>
              {'\u5f00\u59cb\u91cd\u7f6e'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-foreground">{'\u7ba1\u7406\u5458\u53e3\u4ee4'}</p>
                <Input
                  type="password"
                  className="h-9"
                  placeholder={'\u8f93\u5165\u5f53\u524d\u7ba1\u7406\u5458\u53e3\u4ee4\u4ee5\u786e\u8ba4'}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={resetLoading || !resetPassword}>
                  {resetLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                  {'\u786e\u8ba4\u91cd\u7f6e'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetConfirm(false);
                    setResetPassword('');
                  }}
                >
                  {'\u53d6\u6d88'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCell({ label, value, large = false }: { label: string; value: string | number; large?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-popover p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold text-foreground ${large ? 'text-lg' : 'text-sm'}`}>{value}</p>
    </div>
  );
}

function ActionRow({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
