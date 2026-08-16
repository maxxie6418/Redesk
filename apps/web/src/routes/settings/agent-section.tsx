import { useCallback, useMemo, useState } from 'react';
import { Bot, Check, Copy, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { AGENT_SCOPES } from '@redesk/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useAgentConnections,
  useCreateAgentConnection,
  useRevokeAgentConnection,
  type CreateAgentConnectionResult,
} from '@/hooks/use-agent-connections';
import { cn } from '@/lib/utils';
import type { StatusMessage } from './types';

const SCOPE_LABELS: Record<string, string> = {
  'books:read': '查看书籍',
  'books:create': '添加书籍',
  'books:update_metadata': '更新书籍元数据',
  'categories:manage': '分类管理',
  'tags:manage': '标签管理',
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'books:read': '检索书库、查看书籍详情、触发元数据预取',
  'books:create': '创建新书（标题必填）',
  'books:update_metadata': '更新书籍属性与来源链接',
  'categories:manage': '查看与新建分类（不能改名/删除）',
  'tags:manage': '查看与新建标签（不能改名/删除）',
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

export function AgentSection({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const connections = useAgentConnections();
  const createConnection = useCreateAgentConnection();
  const revokeConnection = useRevokeAgentConnection();

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['books:read', 'books:create']);
  const [created, setCreated] = useState<CreateAgentConnectionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = useCallback((scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      onToast({ type: 'error', text: '请填写接入名称' });
      return;
    }
    if (scopes.length === 0) {
      onToast({ type: 'error', text: '请至少选择一个能力范围' });
      return;
    }
    try {
      const result = await createConnection.mutateAsync({ name: name.trim(), scopes });
      setCreated(result);
      setName('');
      onToast({ type: 'info', text: '接入链接已生成（10 分钟内有效）' });
    } catch {
      onToast({ type: 'error', text: '生成失败，请检查权限' });
    }
  }, [name, scopes, createConnection, onToast]);

  const handleCopy = useCallback(async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast({ type: 'error', text: '复制失败，请手动复制' });
    }
  }, [created, onToast]);

  const handleRevoke = useCallback(
    async (id: number, connName: string) => {
      if (!window.confirm(`吊销接入「${connName}」？其令牌将立即失效，且无法恢复。`)) return;
      try {
        await revokeConnection.mutateAsync(id);
        onToast({ type: 'info', text: '已吊销' });
      } catch {
        onToast({ type: 'error', text: '吊销失败' });
      }
    },
    [revokeConnection, onToast],
  );

  const list = useMemo(() => connections.data ?? [], [connections.data]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Agent 接入
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs leading-5 text-muted-foreground">
          生成一次性接入链接发给外部 AI（ChatGPT / Claude 等）。AI 读取能力清单后，可在你授予的范围内协助添加与管理书籍。链接 10 分钟内有效，兑换令牌后自动失效。
        </p>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">接入名称</p>
            <Input
              placeholder="例如：我的Claude / 写作助手"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">能力范围</p>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  title={SCOPE_DESCRIPTIONS[scope] ?? scope}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    scopes.includes(scope)
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-popover text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => toggleScope(scope)}
                >
                  {SCOPE_LABELS[scope] ?? scope}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} disabled={createConnection.isPending}>
            {createConnection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            生成接入链接
          </Button>
        </div>

        {created ? (
          <div className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
            <p className="text-sm font-medium text-foreground">接入链接（仅本次显示）</p>
            <div className="flex gap-2">
              <Input readOnly value={created.link} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="复制链接">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              将此链接发给 AI。10 分钟内有效，兑换令牌后自动失效。
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">已创建的接入</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => connections.refetch()}
              disabled={connections.isFetching}
            >
              {connections.isFetching ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              刷新
            </Button>
          </div>

          {connections.isLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-border py-6 text-sm text-muted-foreground">
              加载中...
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">
              还没有创建过 Agent 接入
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{conn.name}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          conn.revoked_at
                            ? 'bg-muted text-muted-foreground'
                            : conn.activated
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {conn.revoked_at ? '已吊销' : conn.activated ? '已激活' : '待激活'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {conn.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {SCOPE_LABELS[scope] ?? scope}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      创建于 {formatDate(conn.created_at)}
                      {conn.last_used_at ? ` · 最近使用 ${formatDate(conn.last_used_at)}` : ''}
                    </p>
                  </div>
                  {conn.revoked_at ? null : (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(conn.id, conn.name)}>
                      <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                      吊销
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}