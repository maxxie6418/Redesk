import { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle,
  Key,
  Loader2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useCreateUser,
  useDeleteUser,
  useResetPassword,
  useToggleActive,
  useUpdateUser,
  useUserList,
  type UserAdminSummary,
} from '@/hooks/use-users-admin';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import type { StatusMessage } from './types';

export function LoginManagementTab() {
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

  const showToast = useCallback((m: StatusMessage) => {
    if (!m) return;
    if (m.type === 'error') {
      toast.error(m.text);
    } else if (m.type === 'warning') {
      toast.warning(m.text);
    } else {
      toast.success(m.text);
    }
  }, []);

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
  const [editingPermission, setEditingPermission] = useState('');
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPermission, setNewPermission] = useState('use');

  const handleCreate = useCallback(async () => {
    try {
      await createUser.mutateAsync({
        password: newPassword,
        display_name: newDisplayName || undefined,
        permission_level: newPermission,
      });
      showToast({ type: 'info', text: '用户已创建' });
      setShowCreate(false); setNewPassword(''); setNewDisplayName(''); setNewPermission('use');
    } catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [newPassword, newDisplayName, newPermission, createUser, showToast]);

  const handleUpdate = useCallback(async (id: number) => {
    try {
      await updateUser.mutateAsync({
        id,
        display_name: editingName || null,
        permission_level: editingPermission,
      });
      showToast({ type: 'info', text: '已更新' });
      setEditingId(null);
    } catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [editingName, editingPermission, updateUser, showToast]);

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

  const permissionLabelOf = (level: string) => {
    if (level === 'view') return '浏览';
    if (level === 'read') return '阅读';
    return '使用';
  };

  return (
    <div className="space-y-6">
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
                  <p className="truncate text-xs text-muted-foreground">
                    普通用户
                    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">{permissionLabelOf(u.permission_level)}</span>
                    {!u.is_active && <span className="ml-1.5 rounded bg-destructive/10 px-1 py-0.5 text-[10px] text-destructive">已停用</span>}
                  </p>
                </div>
                {editingId === u.id ? (
                  <div className="flex items-center gap-2">
                    <Input className="h-8 w-32 text-xs" value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="昵称" />
                    <select
                      className="h-8 w-20 text-xs rounded border border-border px-2"
                      value={editingPermission}
                      onChange={(e) => setEditingPermission(e.target.value)}
                    >
                      <option value="view">浏览</option>
                      <option value="read">阅读</option>
                      <option value="use">使用</option>
                    </select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(u.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                      setEditingId(u.id);
                      setEditingName(u.display_name ?? '');
                      setEditingPermission(u.permission_level);
                    }}>编辑</Button>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">权限级别：</span>
                  <select
                    className="h-9 text-sm rounded border border-border px-2"
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value)}
                  >
                    <option value="view">浏览</option>
                    <option value="read">阅读</option>
                    <option value="use">使用（默认）</option>
                  </select>
                </div>
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
