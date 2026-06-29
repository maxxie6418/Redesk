import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  FolderOpen,
  Grid3X3,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Trash2,
  StickyNote,
  Highlighter,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useShellUser } from '@/components/shell-user-context';

const FEATURES = [
  {
    icon: <Highlighter className="h-5 w-5" />,
    title: '划线管理',
    desc: '跨书籍统一查看、搜索和管理所有划线',
  },
  {
    icon: <StickyNote className="h-5 w-5" />,
    title: '笔记聚合',
    desc: '按书、按日期、按标签聚合所有阅读笔记',
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: 'Markdown 导出',
    desc: '一键导出为结构化 Markdown，资产可带走',
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: '关联话题',
    desc: '笔记与阅读话题双向关联，形成知识网络',
  },
];

export function ReadingNotesPage() {
  const user = useShellUser();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-[256px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-medium text-primary-foreground">
              R
            </div>
            <div className="font-display text-xl text-sidebar-foreground">Redesk</div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground/50">
              v{__APP_VERSION__}
            </span>
          </div>

          <div className="relative mt-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full border-sidebar-border bg-background pl-9 text-sm"
              placeholder="搜索书名、作者、标签"
              value=""
              readOnly
            />
          </div>

          <nav className="mt-5 space-y-0.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/overview')}
            >
              <Archive className="h-4 w-4" />
              档案
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/')}
            >
              <BookOpen className="h-4 w-4" />
              书架
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/files')}
            >
              <FolderOpen className="h-4 w-4" />
              书库文件
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground"
            >
              <NotebookPen className="h-4 w-4" />
              读书笔记
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/reading-topics')}
            >
              <Grid3X3 className="h-4 w-4" />
              阅读话题
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/?trash=1')}
            >
              <Trash2 className="h-4 w-4" />
              回收站
            </button>
          </nav>
        </div>

        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
            disabled
          >
            <Sparkles className="h-4 w-4" />
            AI 助手
            <span className="ml-auto text-[10px] text-muted-foreground/30">M3</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              {(user?.display_name ?? user?.username ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {user?.display_name ?? user?.username ?? 'Maxxie'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center px-8 py-7">
        <div className="text-center max-w-lg">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
            <NotebookPen className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            M2 阶段
          </div>
          <h1 className="mt-3 font-display text-[26px] font-semibold text-foreground">读书笔记</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            统一管理所有阅读笔记、划线与标注。跨书籍聚合，按标签索引，支持
            Markdown 一键导出。
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground">{f.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs text-muted-foreground/50">
            此功能将在 M2「阅读与笔记」阶段实现
          </p>
        </div>
      </main>
    </div>
  );
}
