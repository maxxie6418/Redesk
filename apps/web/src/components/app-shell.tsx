import type { ReactNode } from 'react';
import type { QuickLink } from '@/hooks/use-quick-links';
import { AppSidebar, type AppSidebarKey, type AppSidebarStat } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';

export interface AuthViewModel {
  loggedIn: boolean;
  initial: boolean;
  displayName: string;
  userLabel: '管理员' | '普通用户' | null;
  canOpenSettings: boolean;
}

interface AppShellProps {
  activeKey: AppSidebarKey;
  authViewModel: AuthViewModel;
  quickLinks: QuickLink[];
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
  mainClassName?: string;
}

/**
 * 应用主壳层：纯展示。所有数据由 ProtectedShell 注入。
 */
export function AppShell({
  activeKey,
  authViewModel,
  quickLinks,
  children,
  searchValue,
  onSearchChange,
  stats,
  mainClassName,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 self-start">
        <AppSidebar
          activeKey={activeKey}
          authViewModel={authViewModel}
          quickLinks={quickLinks}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          stats={stats}
        />
      </div>
      <main className={cn('min-w-0 flex-1', mainClassName)}>{children}</main>
    </div>
  );
}
