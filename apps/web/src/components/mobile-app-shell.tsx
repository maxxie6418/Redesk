import type { ReactNode } from 'react';
import { BookOpen, Download, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/use-theme';
import { cn } from '@/lib/utils';
import type { AuthViewModel } from '@/components/app-shell';

export type MobileNavKey = 'bookshelf' | 'manage' | 'backup' | 'settings';

interface MobileAppShellProps {
  authViewModel: AuthViewModel;
  children: ReactNode;
  mainClassName?: string;
  mobileNavKey?: MobileNavKey;
}

const NAV_ITEMS: Array<{
  key: MobileNavKey;
  label: string;
  icon: typeof BookOpen;
}> = [
  { key: 'bookshelf', label: '书架', icon: BookOpen },
  { key: 'manage', label: '轻管理', icon: Plus },
  { key: 'backup', label: '备份', icon: Download },
  { key: 'settings', label: '设置', icon: Settings },
];

export function MobileAppShell({
  authViewModel,
  children,
  mainClassName,
  mobileNavKey = 'bookshelf',
}: MobileAppShellProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleNav = (key: MobileNavKey) => {
    if (key !== 'bookshelf' && !authViewModel.loggedIn) {
      toast('登录后才能继续操作');
      return;
    }

    if (key === 'bookshelf') {
      navigate('/');
      return;
    }

    if (key === 'manage') {
      navigate('/overview');
      return;
    }

    if (key === 'backup') {
      navigate('/settings?mobile=backup');
      return;
    }

    navigate('/settings');
  };

  const pageClassName = theme === 'dark'
    ? 'bg-[radial-gradient(circle_at_18%_0%,rgba(217,119,87,0.22),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(120,140,93,0.18),transparent_30%),linear-gradient(180deg,#171614_0%,#1d1b18_48%,#23201d_100%)]'
    : 'bg-[radial-gradient(circle_at_14%_0%,rgba(217,119,87,0.18),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(120,140,93,0.16),transparent_30%),linear-gradient(180deg,#f8f1e6_0%,#f3efe8_48%,#eee8dc_100%)]';
  const navClassName = theme === 'dark'
    ? 'border-white/10 bg-[rgba(28,25,22,0.9)]'
    : 'border-white/70 bg-[rgba(255,253,248,0.92)]';

  return (
    <div className={cn('min-h-screen', pageClassName)}>
      <main className={cn('mx-auto min-h-screen w-full max-w-md px-4 pt-4', mainClassName)}>
        <div className="pb-28">{children}</div>
      </main>

      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <div
          className={cn(
            'mx-auto max-w-md rounded-[28px] border p-2 shadow-[0_18px_45px_rgba(64,47,31,0.18)] backdrop-blur-xl',
            navClassName,
          )}
        >
          <div className="grid grid-cols-4 gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = mobileNavKey === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    'flex min-w-0 flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-xs font-semibold transition-colors',
                    active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => handleNav(item.key)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
