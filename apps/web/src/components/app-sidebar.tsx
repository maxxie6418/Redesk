import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Archive,
  BookOpen,
  ExternalLink,
  FolderOpen,
  Grid3X3,
  KeyRound,
  LogIn,
  Moon,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LoginDialog } from '@/components/login-dialog';
import { useTheme } from '@/components/use-theme';
import type { QuickLink } from '@/hooks/use-quick-links';
import { cn } from '@/lib/utils';

export type AppSidebarKey =
  | 'overview'
  | 'bookshelf'
  | 'files'
  | 'reading-notes'
  | 'reading-topics'
  | 'trash'
  | 'settings'
  | 'login';

export interface AppSidebarStat {
  label: string;
  value: number;
  valueClass?: string;
}

export interface AppSidebarAuthViewModel {
  loggedIn: boolean;
  initial: boolean;
  displayName: string;
  userLabel: '\u7ba1\u7406\u5458' | '\u666e\u901a\u7528\u6237' | null;
  canOpenSettings: boolean;
}

interface AppSidebarProps {
  activeKey: AppSidebarKey;
  authViewModel: AppSidebarAuthViewModel;
  quickLinks: QuickLink[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
}

export function AppSidebar({
  activeKey,
  authViewModel,
  quickLinks,
  searchValue = '',
  onSearchChange,
  stats,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const firstRunShown = useRef(false);
  const { loggedIn, initial, canOpenSettings } = authViewModel;

  useEffect(() => {
    if (initial && !loggedIn && !firstRunShown.current) {
      firstRunShown.current = true;
      const timer = setTimeout(() => {
        setLoginOpen(true);
        toast.info('\u9996\u6b21\u90e8\u7f72\uff0c\u8bf7\u4f7f\u7528\u9ed8\u8ba4\u53e3\u4ee4 admin \u767b\u5f55\u5e76\u8bbe\u7f6e\u65b0\u53e3\u4ee4\u3002');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initial, loggedIn]);

  const authLabel = loggedIn
    ? '\u8bbe\u7f6e'
    : initial
      ? '\u8bbe\u7f6e\u7ba1\u7406\u53e3\u4ee4'
      : '\u767b\u5f55';
  const AuthIcon = loggedIn ? Settings : initial ? KeyRound : LogIn;

  return (
    <aside className="flex h-screen w-[clamp(220px,18vw,256px)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5">
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-semibold text-primary-foreground">
            R
          </div>
          <div className="font-display text-xl font-medium text-sidebar-foreground">Redesk</div>
          <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground/50">v{__APP_VERSION__}</span>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 rounded-full border-sidebar-border bg-background pl-9 text-sm"
            placeholder={'\u641c\u7d22\u4e66\u540d\u3001\u4f5c\u8005\u3001\u6807\u7b7e'}
            value={searchValue}
            readOnly={!onSearchChange}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </div>
      </div>

      <nav className="mt-5 space-y-0.5">
        <SidebarItem active={activeKey === 'bookshelf'} icon={<BookOpen className="h-4 w-4" />} label={'\u4e66\u67b6'} onClick={() => navigate('/')} />
        <SidebarItem active={activeKey === 'overview'} icon={<Archive className="h-4 w-4" />} label={'\u6863\u6848'} disabled={!loggedIn} onClick={() => (loggedIn ? navigate('/overview') : toast('\u672a\u767b\u5f55\u65e0\u6cd5\u64cd\u4f5c'))} />
        <SidebarItem active={activeKey === 'files'} icon={<FolderOpen className="h-4 w-4" />} label={'\u4e66\u5e93\u6587\u4ef6'} disabled={!loggedIn} onClick={() => (loggedIn ? navigate('/files') : toast('\u672a\u767b\u5f55\u65e0\u6cd5\u64cd\u4f5c'))} />
        <SidebarItem active={activeKey === 'reading-notes'} icon={<NotebookPen className="h-4 w-4" />} label={'\u8bfb\u4e66\u7b14\u8bb0'} disabled={!loggedIn} onClick={() => (loggedIn ? navigate('/reading-notes') : toast('\u672a\u767b\u5f55\u65e0\u6cd5\u64cd\u4f5c'))} />
        <SidebarItem active={activeKey === 'reading-topics'} icon={<Grid3X3 className="h-4 w-4" />} label={'\u9605\u8bfb\u8bdd\u9898'} disabled={!loggedIn} onClick={() => (loggedIn ? navigate('/reading-topics') : toast('\u672a\u767b\u5f55\u65e0\u6cd5\u64cd\u4f5c'))} />
        <SidebarItem active={activeKey === 'trash'} icon={<Trash2 className="h-4 w-4" />} label={'\u56de\u6536\u7ad9'} disabled={!loggedIn} onClick={() => (loggedIn ? navigate('/trash') : toast('\u672a\u767b\u5f55\u65e0\u6cd5\u64cd\u4f5c'))} />
      </nav>

      <div className="min-h-20 flex-1" />

      {stats && stats.length > 0 && (
        <div className="mb-4 px-1">
          <div className="grid grid-cols-2 gap-2">
            {stats.map((item) => (
              <StatCell key={item.label} {...item} />
            ))}
          </div>
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="mb-4 space-y-0.5 border-t border-sidebar-border px-1 pt-4">
          <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {'\u5feb\u6377\u94fe\u63a5'}
          </div>
          {quickLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="truncate">{link.name}</span>
            </a>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-sidebar-border px-1 pt-4">
        <SidebarItem icon={<Sparkles className="h-4 w-4" />} label={'AI \u52a9\u624b'} badge="M3" disabled />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            title={theme === 'dark' ? '\u5207\u6362\u5230\u6d45\u8272\u4e3b\u9898' : '\u5207\u6362\u5230\u6df1\u8272\u4e3b\u9898'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="relative min-w-0 flex-1">
            <SidebarItem
              active={activeKey === 'settings' || activeKey === 'login'}
              icon={<AuthIcon className="h-4 w-4 shrink-0" />}
              label={authLabel}
              onClick={() => {
                if (canOpenSettings) {
                  navigate('/settings');
                } else {
                  setLoginOpen((prev) => !prev);
                }
              }}
            />
            {loginOpen && (
              <div className="absolute bottom-full left-0 right-0 z-[60] mb-2">
                <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
  disabled,
  badge,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
        active && 'bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary',
        disabled && 'cursor-not-allowed text-muted-foreground/45 hover:bg-transparent',
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
      {badge && <span className={cn('ml-auto text-[10px]', active ? 'text-sidebar-primary-foreground/60' : 'text-muted-foreground/35')}>{badge}</span>}
    </button>
  );
}

function StatCell({ label, value, valueClass }: AppSidebarStat) {
  return (
    <div className="rounded-[10px] border border-sidebar-border bg-background px-2.5 py-3 text-center">
      <div className={cn('text-xl font-semibold leading-none tabular-nums', valueClass)}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
