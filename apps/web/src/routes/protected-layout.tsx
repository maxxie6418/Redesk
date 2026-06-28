import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/use-auth';
import { ShellLayout } from '@/components/shell-layout';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { AUTH_DISABLED, LOCAL_AUTH_USER } from '@/lib/auth-mode';
import { api } from '@/lib/api';

export function RequireAuth() {
  return AUTH_DISABLED ? <BypassAuth /> : <RequireSession />;
}

function BypassAuth() {
  const health = useQuery({
    queryKey: ['backend-status'],
    queryFn: () => api.get<{ needs_setup: boolean }>('/auth/status'),
    retry: 3,
    retryDelay: 1000,
  });

  if (health.isLoading) {
    return <FullScreenLoader label="正在连接服务…" />;
  }

  if (health.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="text-lg font-medium text-foreground">无法连接到服务</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          请确保后端 API 已启动（pnpm dev:api），然后刷新页面。
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => health.refetch()}
        >
          重新连接
        </button>
      </div>
    );
  }

  return (
    <ShellLayout user={LOCAL_AUTH_USER}>
      <Outlet />
    </ShellLayout>
  );
}

function RequireSession() {
  const currentUser = useCurrentUser();

  if (currentUser.isLoading) return <FullScreenLoader label="正在验证身份…" />;
  if (currentUser.isError || !currentUser.data) return <Navigate to="/login" replace />;

  return (
    <ShellLayout user={currentUser.data}>
      <Outlet />
    </ShellLayout>
  );
}
