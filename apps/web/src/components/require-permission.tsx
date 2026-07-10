import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-auth';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { checkPermission } from '@/lib/permissions';
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

  return children ?? <Outlet />;
}

interface OptionalAuthProps {
  children: ReactNode;
}

export function OptionalAuth({ children }: OptionalAuthProps) {
  return children;
}