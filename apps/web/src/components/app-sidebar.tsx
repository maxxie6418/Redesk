import { NavLink } from 'react-router-dom';
import { Library, BarChart3, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/lib/api';

interface AppSidebarProps {
  user: AuthUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { theme, toggle } = useTheme();
  const initial = (user.display_name ?? user.username).slice(0, 1).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-7">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-medium text-primary-foreground">
          R
        </div>
        <span className="font-display text-xl text-sidebar-foreground">Redesk</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          浏览
        </p>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            )
          }
        >
          <Library className="h-[18px] w-[18px]" />
          书架
        </NavLink>
        <div className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium text-muted-foreground/50">
          <BarChart3 className="h-[18px] w-[18px]" />
          阅读档案
        </div>
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 pb-5 pt-3">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
        <div className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground/50">
          <Settings className="h-[18px] w-[18px]" />
          设置
        </div>
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-muted text-xs font-semibold text-muted-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-sidebar-foreground">
              {user.display_name ?? user.username}
            </div>
            <div className="text-[11px] text-muted-foreground">个人空间</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
