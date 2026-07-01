import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
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
import type { AuthUser } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthInit, useCurrentUser } from '@/hooks/use-auth';
import { useQuickLinks, type QuickLink } from '@/hooks/use-quick-links';
import { useTheme } from '@/components/theme-provider';
import { LoginDialog } from '@/components/login-dialog';

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

interface AppSidebarProps {
  activeKey: AppSidebarKey;
  user: AuthUser;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  stats?: AppSidebarStat[];
}

export function AppSidebar({ activeKey, user: _user, searchValue = '', onSearchChange, stats }: AppSidebarProps) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const authInit = useAuthInit();
  const { theme, setTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const loggedIn = !!currentUser.data;
  const initial = authInit.data?.initial === true;
  const authLabel = loggedIn ? '设置' : initial ? '设置管理口令' : '登录';
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
            placeholder="搜索书名、作者、标签"
            value={searchValue}
            readOnly={!onSearchChange}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </div>
      </div>

      <nav className="mt-5 space-y-0.5">
        <SidebarItem active={activeKey === 'bookshelf'} icon={<BookOpen className="h-4 w-4" />} label="书架" onClick={() => navigate('/')} />
        <SidebarItem active={activeKey === 'overview'} icon={<Archive className="h-4 w-4" />} label="档案" onClick={() => navigate('/overview')} />
        <SidebarItem active={activeKey === 'files'} icon={<FolderOpen className="h-4 w-4" />} label="书库文件" onClick={() => navigate('/files')} />
        <SidebarItem active={activeKey === 'reading-notes'} icon={<NotebookPen className="h-4 w-4" />} label="读书笔记" onClick={() => navigate('/reading-notes')} />
        <SidebarItem active={activeKey === 'reading-topics'} icon={<Grid3X3 className="h-4 w-4" />} label="阅读话题" onClick={() => navigate('/reading-topics')} />
        <SidebarItem active={activeKey === 'trash'} icon={<Trash2 className="h-4 w-4" />} label="回收站" onClick={() => navigate('/trash')} />
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

      <QuickLinksSection />

      <div className="space-y-1 border-t border-sidebar-border px-1 pt-4">
        <SidebarItem icon={<Sparkles className="h-4 w-4" />} label="AI 助手" badge="M3" disabled />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="relative flex-1 min-w-0">
            <SidebarItem
              active={activeKey === 'settings' || activeKey === 'login'}
              icon={<AuthIcon className="h-4 w-4 shrink-0" />}
              label={authLabel}
              onClick={() => {
                if (loggedIn) {
                  navigate('/settings');
                } else {
                  setLoginOpen((prev) => !prev);
                }
              }}
            />
            {loginOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 z-[60]">
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

function QuickLinksSection() {
  const { data: links } = useQuickLinks();

  if (!links || links.length === 0) return null;

  return (
    <div className="mb-4 space-y-0.5 border-t border-sidebar-border px-1 pt-4">
      <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        快捷链接
      </div>
      {links.map((link: QuickLink) => (
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
  );
}
