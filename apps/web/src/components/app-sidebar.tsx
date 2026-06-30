import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Archive,
  BookOpen,
  ExternalLink,
  FolderOpen,
  Grid3X3,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { AuthUser } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuickLinks } from '@/hooks/use-quick-links';

export type AppSidebarKey = 'overview' | 'bookshelf' | 'files' | 'reading-notes' | 'reading-topics' | 'trash' | 'settings';

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

export function AppSidebar({ activeKey, user, searchValue = '', onSearchChange, stats }: AppSidebarProps) {
  const navigate = useNavigate();

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
        <SidebarItem active={activeKey === 'settings'} icon={<Settings className="h-4 w-4" />} label="设置" onClick={() => navigate('/settings')} />
        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{user.display_name ?? user.username}</div>
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
      {links.map((link) => (
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
