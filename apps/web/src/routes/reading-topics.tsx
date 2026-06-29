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
  Network,
  Hash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useShellUser } from '@/components/shell-user-context';

const TOPIC_TAGS = [
  { label: '认知科学', size: 'lg' },
  { label: '效率方法', size: 'md' },
  { label: '投资理财', size: 'sm' },
  { label: '写作', size: 'md' },
  { label: '心理学', size: 'lg' },
  { label: '历史', size: 'sm' },
  { label: '产品设计', size: 'md' },
  { label: '哲学', size: 'xs' },
  { label: '传记', size: 'sm' },
  { label: '科学', size: 'xs' },
  { label: '商业', size: 'md' },
  { label: '技术', size: 'sm' },
];

const SIZE_MAP: Record<string, string> = {
  lg: 'text-[15px] px-3 py-1.5',
  md: 'text-[13px] px-2.5 py-1',
  sm: 'text-xs px-2 py-0.5',
  xs: 'text-[11px] px-1.5 py-0.5',
};

export function ReadingTopicsPage() {
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/reading-notes')}
            >
              <NotebookPen className="h-4 w-4" />
              读书笔记
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground"
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
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-success/10">
            <Network className="h-10 w-10 text-success/40" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            M4 阶段
          </div>
          <h1 className="mt-3 font-display text-[26px] font-semibold text-foreground">阅读话题</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            以一个话题为纽带，将多本书籍的笔记、划线和思考串联起来，
            构建跨书籍的知识网络。
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {TOPIC_TAGS.map((tag) => (
              <span
                key={tag.label}
                className={`inline-flex items-center gap-1 rounded-full border border-border bg-card text-muted-foreground transition-colors ${SIZE_MAP[tag.size]}`}
              >
                <Hash className="h-3 w-3" />
                {tag.label}
              </span>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Network className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">多书关联</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">一个话题绑定多本书的笔记和划线</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Hash className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">标签聚合</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">自动聚合话题下所有内容</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">AI 综述</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">AI 生成话题知识综述</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">相关性推荐</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">根据话题推荐相关书籍</div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-muted-foreground/50">
            此功能将在 M4「话题与深度阅读」阶段实现
          </p>
        </div>
      </main>
    </div>
  );
}
