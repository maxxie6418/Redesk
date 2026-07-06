import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError(null);
    }
  }, [open]);

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[360px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base">输入口令</DialogTitle>
          <DialogDescription className="text-xs">请输入管理口令以访问完整功能</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dialog-password" className="text-xs">口令</Label>
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
              className="h-9 text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="flex-1 h-9 text-sm" disabled={login.isPending}>
              {login.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              登录
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
