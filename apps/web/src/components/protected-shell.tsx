import type { ReactNode } from 'react';
import { useAuthInit, useCurrentUser } from '@/hooks/use-auth';
import { useQuickLinks } from '@/hooks/use-quick-links';
import { AppShell } from '@/components/app-shell';
import { ShellUserContext } from '@/components/shell-user-context';
import { LOCAL_AUTH_USER } from '@/lib/auth-mode';
import type { AuthViewModel } from '@/components/app-shell';
import type { AppSidebarKey, AppSidebarStat } from '@/components/app-sidebar';

export interface ProtectedShellProps {
  activeKey: AppSidebarKey;
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
  mainClassName?: string;
}

/**
 * 受保护壳层：集中拉取用户态、注入 ShellUserContext、构造 AuthViewModel，
 * 下发给纯展示的 AppShell。仅在已登录或免登录模式下使用；公开页（如登录页）直接渲染即可。
 */
export function ProtectedShell({
  activeKey,
  children,
  searchValue,
  onSearchChange,
  stats,
  mainClassName,
}: ProtectedShellProps) {
  const currentUser = useCurrentUser();
  const authInit = useAuthInit();
  const { data: quickLinks } = useQuickLinks();

  const user = currentUser.data ?? LOCAL_AUTH_USER;
  const loggedIn = !!currentUser.data;
  const initial = authInit.data?.initial === true;

  const authViewModel: AuthViewModel = {
    loggedIn,
    initial,
    displayName: user.display_name ?? user.username ?? '未登录',
    userLabel: !loggedIn ? null : user.is_admin ? '管理员' : '普通用户',
    canOpenSettings: loggedIn,
  };

  return (
    <ShellUserContext.Provider value={user}>
      <AppShell
        activeKey={activeKey}
        authViewModel={authViewModel}
        quickLinks={quickLinks ?? []}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        stats={stats}
        mainClassName={mainClassName}
      >
        {children}
      </AppShell>
    </ShellUserContext.Provider>
  );
}
