import { NavLink } from 'react-router-dom';
import { BarChart3, FolderOpen, Library, Moon, Settings, Sun } from 'lucide-react';
import type { AuthUser } from '@/lib/api';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  user: AuthUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { theme, toggle } = useTheme();
  const initial = (user.display_name ?? user.username).slice(0, 1).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
          R
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Redesk</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[11px] font-medium text-muted-foreground">阅读</p>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
              isActive && 'bg-sidebar-accent font-medium',
            )
          }
        >
          <Library className="h-4 w-4" />
          书架
        </NavLink>
        <NavLink
          to="/files"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
              isActive && 'bg-sidebar-accent font-medium',
            )
          }
        >
          <FolderOpen className="h-4 w-4" />
          书库文件
        </NavLink>
        <div className="mt-1 flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground/50">
          <BarChart3 className="h-4 w-4" />
          阅读档案
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
        <div className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground/50">
          <Settings className="h-4 w-4" />
          设置
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">{user.display_name ?? user.username}</div>
            <div className="text-xs text-muted-foreground">个人空间</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
