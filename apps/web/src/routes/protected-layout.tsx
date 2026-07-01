import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-auth';
import { ShellLayout } from '@/components/shell-layout';
import { ShellUserContext } from '@/components/shell-user-context';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { LOCAL_AUTH_USER } from '@/lib/auth-mode';

export function PublicShell({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser();
  const user = currentUser.data ?? LOCAL_AUTH_USER;
  return (
    <ShellUserContext.Provider value={user}>
      <ShellLayout user={user}>{children}</ShellLayout>
    </ShellUserContext.Provider>
  );
}

export function RequireAuth() {
  const currentUser = useCurrentUser();
  if (currentUser.isLoading) return <FullScreenLoader label="正在验证身份…" />;
  if (currentUser.isError || !currentUser.data) return <Navigate to="/login" replace />;
  return (
    <ShellUserContext.Provider value={currentUser.data}>
      <ShellLayout user={currentUser.data}>
        <Outlet />
      </ShellLayout>
    </ShellUserContext.Provider>
  );
}
