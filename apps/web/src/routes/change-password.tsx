import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-auth';
import { ForcedPasswordChange } from '@/components/forced-password-change';
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

  if (currentUser.isLoading) return null;

  if (!currentUser.data || !currentUser.data.must_change_password) {
    return <Navigate to={target} replace />;
  }

  return (
    <ForcedPasswordChange
      onComplete={() => {
        navigate(target, { replace: true });
      }}
    />
  );
}
