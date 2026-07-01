import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLogin } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const navigate = useNavigate();
  const login = useLogin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 5) {
      setError('口令至少 5 位字符');
      return;
    }
    try {
      const user = await login.mutateAsync({ password });
      toast.success('登录成功', { description: user.display_name ? `欢迎回来，${user.display_name}` : '欢迎回到 Redesk' });
      setPassword('');
      onClose();
      if (user.must_change_password) {
        navigate('/change-password', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败');
    }
  };

  return (
    <Card className="w-64 shadow-xl border-sidebar-border bg-sidebar">
      <CardHeader className="px-3 pb-0 pt-3">
        <CardTitle className="text-sm font-medium">输入口令</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-2">
        <form onSubmit={onSubmit} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="dialog-password" className="text-xs text-sidebar-foreground/70">口令</Label>
            <Input
              id="dialog-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoComplete="current-password"
              autoFocus
              required
              className="h-8 text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 h-8 text-sm" disabled={login.isPending}>
              {login.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              登录
            </Button>
            <Button type="button" variant="ghost" className="h-8 text-sm px-2" onClick={() => { setPassword(''); setError(null); onClose(); }}>
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
