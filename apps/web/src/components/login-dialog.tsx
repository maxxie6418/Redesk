import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useLogin } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const navigate = useNavigate();
  const login = useLogin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

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
    <div className="fixed inset-0 z-[200] flex items-end justify-start" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <Card
        className="relative ml-4 mb-4 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-sidebar-border bg-sidebar shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <CardHeader className="px-4 pb-1 pt-4">
          <CardTitle className="text-sm font-medium">输入口令</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-2">
          <form onSubmit={onSubmit} className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="dialog-password" className="text-xs text-sidebar-foreground/70">口令</Label>
              <Input
                ref={inputRef}
                id="dialog-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                required
                className="h-9 text-sm"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1 h-9 text-sm" disabled={login.isPending}>
                {login.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                登录
              </Button>
              <Button type="button" variant="ghost" className="h-9 text-sm px-3" onClick={() => { setPassword(''); setError(null); onClose(); }}>
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
