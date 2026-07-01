import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-auth';
import { ForcedPasswordChange } from '@/components/forced-password-change';
import { ShellUserContext } from '@/components/shell-user-context';
import { AUTH_DISABLED } from '@/lib/auth-mode';

export function ChangePasswordRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentUser = useCurrentUser();
  const target = params.get('return') || '/';

  useEffect(() => {
    const previous = document.title;
    document.title = '设置管理口令 · Redesk';
    return () => {
      document.title = previous;
    };
  }, []);

  if (AUTH_DISABLED) return <Navigate to={target} replace />;

  if (currentUser.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser.data || !currentUser.data.must_change_password) {
    return <Navigate to={target} replace />;
  }

  return (
    <ShellUserContext.Provider value={currentUser.data}>
      <ForcedPasswordChange
        onComplete={() => {
          navigate(target, { replace: true });
        }}
      />
    </ShellUserContext.Provider>
  );
}
