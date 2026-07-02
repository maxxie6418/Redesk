import { useState } from 'react';
import {
  AlertTriangle,
  Download,
  Loader2,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useSystemStats,
  useBackup,
  useFtsRebuild,
  useClearCache,
} from '@/hooks/use-system';
import { api } from '@/lib/api';
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
