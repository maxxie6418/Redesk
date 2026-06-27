import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';
import type { AuthUser } from '@/lib/api';

interface ShellLayoutProps {
  user: AuthUser;
  children: ReactNode;
}

export function ShellLayout({ user, children }: ShellLayoutProps) {
  return (
    <div className="min-h-screen">
      <AppSidebar user={user} />
      <main className="ml-64 min-h-screen px-10 py-8">{children}</main>
    </div>
  );
}
