import type { ReactNode } from 'react';
import type { AuthUser } from '@/lib/api';
import { AppSidebar, type AppSidebarKey, type AppSidebarStat } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  activeKey: AppSidebarKey;
  user: AuthUser;
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
  mainClassName?: string;
}

export function AppShell({
  activeKey,
  user,
  children,
  searchValue,
  onSearchChange,
  stats,
  mainClassName,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 self-start">
        <AppSidebar activeKey={activeKey} user={user} searchValue={searchValue} onSearchChange={onSearchChange} stats={stats} />
      </div>
      <main className={cn('min-w-0 flex-1', mainClassName)}>{children}</main>
    </div>
  );
}
