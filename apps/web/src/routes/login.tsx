import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStatus, useLogin } from '@/hooks/use-auth';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { AUTH_DISABLED } from '@/lib/auth-mode';

export function LoginRoute() {
  const navigate = useNavigate();
  const status = useAuthStatus();
  const login = useLogin();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (AUTH_DISABLED) return <Navigate to="/" replace />;
  if (status.isLoading) return <FullScreenLoader />;
  if (status.data?.needs_setup) return <Navigate to="/setup" replace />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ username, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-xl font-medium text-primary-foreground">
            R
          </div>
          <CardTitle>回到你的书库</CardTitle>
          <CardDescription>登录 Redesk 继续阅读管理</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
