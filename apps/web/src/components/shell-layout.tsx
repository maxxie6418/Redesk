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
      <main className="ml-60 min-h-screen px-5 py-5 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
