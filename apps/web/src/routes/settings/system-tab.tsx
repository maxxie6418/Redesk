import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Download, ExternalLink, Loader2, RefreshCcw, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useBackup, useClearCache, useFtsRebuild, useSystemStats, useUpdateCheck } from '@/hooks/use-system';
import { formatBytes, formatUptime, type StatusMessage } from './types';

export function SystemTab({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const stats = useSystemStats();
  const backup = useBackup();
  const ftsRebuild = useFtsRebuild();
  const clearCache = useClearCache();
  const updateCheck = useUpdateCheck();
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
              <p className="text-sm font-medium text-foreground">{'系统信息加载失败'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.error instanceof Error ? stats.error.message : '未知错误'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => stats.refetch()}>
              <RotateCw className="mr-1 h-4 w-4" />
              {'重试'}
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
          <CardTitle className="text-base">{'应用信息'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'版本'} value={`v${stats.data.version}`} />
            <InfoCell label={'运行环境'} value={stats.data.node_env === 'production' ? '生产' : '开发'} />
            <InfoCell label={'运行时长'} value={formatUptime(stats.data.uptime_seconds)} />
            <InfoCell label="Node.js" value={stats.data.node_version} />
            <InfoCell label="SQLite" value={stats.data.sqlite_version} />
          </div>
        </CardContent>
      </Card>

      {/* ── 版本更新 ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'版本更新'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-popover px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{'当前版本'}</span>
                <span className="text-sm font-medium text-foreground">v{stats.data.version}</span>
              </div>
              {updateCheck.data ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{'最新版本'}</span>
                  {updateCheck.data.has_update === null ? (
                    <span className="text-sm text-muted-foreground">{'无法获取'}</span>
                  ) : updateCheck.data.has_update ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      v{updateCheck.data.latest_version}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      {'已是最新'}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateCheck.refetch()}
                disabled={updateCheck.isLoading}
              >
                {updateCheck.isLoading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-1.5 h-4 w-4" />
                )}
                {'检查更新'}
              </Button>
              {updateCheck.data?.has_update ? (
                <>
                  {updateCheck.data.release_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={updateCheck.data.release_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        {'查看 Release'}
                      </a>
                    </Button>
                  )}
                  <Button variant="default" size="sm" asChild>
                    <a href="/api/v1/update-script" download="update.sh">
                      <Download className="mr-1 h-4 w-4" />
                      {'开始更新'}
                    </a>
                  </Button>
                </>
              ) : null}
            </div>

            {updateCheck.data?.has_update && (
              <div className="rounded-lg border border-dashed border-green-200 bg-green-50/50 px-4 py-3 dark:border-green-800/50 dark:bg-green-950/30">
                <p className="text-xs font-medium text-green-800 dark:text-green-200">
                  {'更新方式'}
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  {'下载脚本传到服务器执行：'}
                </p>
                <code className="mt-1.5 block rounded bg-green-100/80 px-2 py-1 text-xs text-green-900 dark:bg-green-900/50 dark:text-green-100">
                  chmod +x update.sh && ./update.sh
                </code>
              </div>
            )}

            {updateCheck.data?.has_update === null && (
              <p className="text-xs text-muted-foreground">
                {'无法连接 GitHub，请检查网络后重试'}
              </p>
            )}

            {updateCheck.isError && (
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{'检查失败'}</p>
                  <p className="text-xs text-muted-foreground">
                    {updateCheck.error instanceof Error ? updateCheck.error.message : '网络连接异常'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => updateCheck.refetch()}>
                  <RotateCw className="mr-1 h-4 w-4" />
                  {'重试'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'数据概览'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'书籍总数'} value={stats.data.book_count} large />
            <InfoCell label={'文件数'} value={stats.data.file_count} large />
            <InfoCell label={'分类'} value={stats.data.category_count} large />
            <InfoCell label={'标签'} value={stats.data.tag_count} large />
            {stats.data.user_count != null && <InfoCell label={'用户'} value={stats.data.user_count} large />}
            <InfoCell label={'回收站'} value={stats.data.trash_count} large />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'存储概况'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label={'数据库大小'} value={formatBytes(stats.data.db_size_bytes)} large />
            <InfoCell label={'文件存储'} value={formatBytes(stats.data.storage_size_bytes)} large />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{'维护操作'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionRow
            title={'手动备份'}
            description={'导出 SQLite 数据库到备份目录'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await backup.mutateAsync();
                    onToast({ type: 'info', text: `备份完成：${result.path}` });
                  } catch {
                    onToast({ type: 'error', text: '备份失败' });
                  }
                }}
                disabled={backup.isPending}
              >
                {backup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            }
          />

          <ActionRow
            title={'重建全文索引'}
            description={'搜索异常时可用此操作修复'}
            action={
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
                {ftsRebuild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              </Button>
            }
          />

          <ActionRow
            title={'清理缓存'}
            description={'清除运行时临时文件'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await clearCache.mutateAsync();
                    onToast({ type: 'info', text: `已清理 ${formatBytes(result.freed_bytes)}（${result.removed_files} 个文件）` });
                  } catch {
                    onToast({ type: 'error', text: '清理失败' });
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
          <CardTitle className="text-base text-destructive">{'重置应用'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {'重置将清空所有数据并恢复为首次部署状态，此操作不可撤销。'}
          </p>
          {!resetConfirm ? (
            <Button variant="destructive" size="sm" onClick={() => setResetConfirm(true)}>
              {'开始重置'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-foreground">{'管理员口令'}</p>
                <Input
                  type="password"
                  className="h-9"
                  placeholder={'输入当前管理员口令以确认'}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleReset} disabled={resetLoading || !resetPassword}>
                  {resetLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                  {'确认重置'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetConfirm(false);
                    setResetPassword('');
                  }}
                >
                  {'取消'}
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
