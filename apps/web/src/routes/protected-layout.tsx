import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-auth';
import { ShellLayout } from '@/components/shell-layout';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { AUTH_DISABLED, LOCAL_AUTH_USER } from '@/lib/auth-mode';

export function RequireAuth() {
  return AUTH_DISABLED ? <BypassAuth /> : <RequireSession />;
}

function BypassAuth() {
  return (
    <ShellLayout user={LOCAL_AUTH_USER}>
      <Outlet />
    </ShellLayout>
  );
}

function RequireSession() {
  const currentUser = useCurrentUser();

  if (currentUser.isLoading) return <FullScreenLoader />;
  if (currentUser.isError || !currentUser.data) return <Navigate to="/login" replace />;

  return (
    <ShellLayout user={currentUser.data}>
      <Outlet />
    </ShellLayout>
  );
}
