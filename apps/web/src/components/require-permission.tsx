import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-auth';
import { ShellUserContext } from '@/components/shell-user-context';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { checkPermission } from '@/lib/permissions';
import { LOCAL_AUTH_USER } from '@/lib/auth-mode';
import type { PermissionLevel } from '@redesk/shared';

interface RequirePermissionProps {
  requiredLevel: PermissionLevel;
  children?: ReactNode;
}

export function RequirePermission({ requiredLevel, children }: RequirePermissionProps) {
  const currentUser = useCurrentUser();

  if (currentUser.isLoading) {
    return <FullScreenLoader label="正在验证身份…" />;
  }

  if (currentUser.isError || !currentUser.data) {
    return <Navigate to="/login" replace />;
  }

  const userLevel = currentUser.data.permission_level as PermissionLevel;

  if (!checkPermission(userLevel, requiredLevel)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ShellUserContext.Provider value={currentUser.data}>
      {children ?? <Outlet />}
    </ShellUserContext.Provider>
  );
}

interface OptionalAuthProps {
  children: ReactNode;
}

export function OptionalAuth({ children }: OptionalAuthProps) {
  const currentUser = useCurrentUser();
  const user = currentUser.data ?? LOCAL_AUTH_USER;

  return (
    <ShellUserContext.Provider value={user}>
      {children}
    </ShellUserContext.Provider>
  );
}