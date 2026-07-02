import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAddQuickLink, useDeleteQuickLink, useQuickLinks, useReorderQuickLink, useUpdateQuickLink, type QuickLink } from '@/hooks/use-quick-links';
import { useUpdateSettings } from '@/hooks/use-settings';
import { useLogout } from '@/hooks/use-auth';
import { BatchImportPanel } from '@/components/batch-import-panel';
import { BatchUploadCard } from './storage-tab';
import type { StatusMessage } from './types';

export function GeneralTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
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
          <CardTitle className="text-base">批量导入书籍</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            通过 CSV 文件批量创建书籍。仅写入元数据，不包含文件；重复条目按 ISBN / 标题 + 作者去重。
          </p>
          <BatchImportPanel variant="embedded" />
        </CardContent>
      </Card>

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
