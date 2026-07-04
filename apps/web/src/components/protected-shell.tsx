import type { ReactNode } from 'react';
import { useAuthInit, useCurrentUser } from '@/hooks/use-auth';
import { useQuickLinks } from '@/hooks/use-quick-links';
import { AppShell, type AuthViewModel } from '@/components/app-shell';
import { ShellUserContext } from '@/components/shell-user-context';
import type { AppSidebarKey, AppSidebarStat } from '@/components/app-sidebar';
import type { MobileNavKey } from '@/components/mobile-app-shell';
import { LOCAL_AUTH_USER } from '@/lib/auth-mode';

export interface ProtectedShellProps {
  activeKey: AppSidebarKey;
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
  mainClassName?: string;
  mobileNavKey?: MobileNavKey;
}

export function ProtectedShell(props: ProtectedShellProps) {
  const currentUser = useCurrentUser();
  const authInit = useAuthInit();
  const { data: quickLinks } = useQuickLinks();

  const user = currentUser.data ?? LOCAL_AUTH_USER;
  const loggedIn = Boolean(currentUser.data);
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
        activeKey={props.activeKey}
        authViewModel={authViewModel}
        quickLinks={quickLinks ?? []}
        searchValue={props.searchValue}
        onSearchChange={props.onSearchChange}
        stats={props.stats}
        mainClassName={props.mainClassName}
        mobileNavKey={props.mobileNavKey}
      >
        {props.children}
      </AppShell>
    </ShellUserContext.Provider>
  );
}
