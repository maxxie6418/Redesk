import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangePassword } from '@/hooks/use-auth';

export function SimpleChangePassword({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (newPwd !== confirmPwd) {
      setError('两次输入不一致');
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: current, new_password: newPwd });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">当前口令</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">新口令</Label>
        <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">确认新口令</Label>
        <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={changePassword.isPending}>
          {changePassword.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          确认修改
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>取消</Button>
      </div>
    </div>
  );
}
