import { useState, useEffect } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useChangePassword } from '@/hooks/use-auth';
import { useShellUser } from '@/components/shell-user-context';

const MIN_LENGTH = 5;

interface ForcedPasswordChangeProps {
  onComplete?: () => void;
}

export function ForcedPasswordChange({ onComplete }: ForcedPasswordChangeProps = {}) {
  const user = useShellUser();
  const changePassword = useChangePassword();
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [newPwd, confirmPwd]);

  const trimmed = newPwd.trim();
  const longEnough = trimmed.length >= MIN_LENGTH;
  const matches = newPwd === confirmPwd && confirmPwd.length > 0;
  const canSubmit = longEnough && matches && !changePassword.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!longEnough) setError(`口令至少 ${MIN_LENGTH} 位字符`);
      else if (!matches) setError('两次输入的口令不一致');
      return;
    }
    try {
      await changePassword.mutateAsync({ new_password: trimmed });
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败，请重试');
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">请设置新的管理员口令</CardTitle>
          <CardDescription>
            欢迎，<span className="font-medium text-foreground">{user.display_name || '管理员'}</span>。
            这是首次登录，请为账户设置一个新口令。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">新口令</Label>
              <Input
                id="new-password"
                type="password"
                placeholder={`至少 ${MIN_LENGTH} 位字符`}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoFocus
                autoComplete="new-password"
                disabled={changePassword.isPending}
              />
              {newPwd.length > 0 && !longEnough && (
                <p className="text-xs text-destructive">口令至少 {MIN_LENGTH} 位字符</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">确认新口令</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="再次输入"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                disabled={changePassword.isPending}
              />
              {confirmPwd.length > 0 && !matches && (
                <p className="text-xs text-destructive">两次输入不一致</p>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {changePassword.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在保存…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  设置新口令
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              设置完成后才能使用本系统
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
