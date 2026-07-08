import type { ReactNode } from 'react';
import type { AuthUser } from '@/lib/api';
import { ShellUserContext } from '@/components/shell-user-context';

interface ShellLayoutProps {
  user: AuthUser;
  children: ReactNode;
}

export function ShellLayout({ user, children }: ShellLayoutProps) {
  return (
    <ShellUserContext.Provider value={user}>
      <div className="h-screen overflow-hidden bg-background">{children}</div>
    </ShellUserContext.Provider>
  );
}
