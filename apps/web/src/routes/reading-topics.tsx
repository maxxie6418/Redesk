import { BookOpen, Hash, Network, Sparkles } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
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
  lg: 'px-3 py-1.5 text-[15px]',
  md: 'px-2.5 py-1 text-[13px]',
  sm: 'px-2 py-0.5 text-xs',
  xs: 'px-1.5 py-0.5 text-[11px]',
};

export function ReadingTopicsPage() {
  const user = useShellUser();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeKey="reading-topics" user={user} />

      <main className="flex min-w-0 flex-1 items-center justify-center px-8 py-7">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-success/10">
            <Network className="h-10 w-10 text-success/40" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            M4 阶段
          </div>
          <h1 className="mt-3 font-display text-[26px] font-semibold text-foreground">阅读话题</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            以一个话题为纽带，将多本书籍的笔记、划线和思考串联起来，构建跨书籍的知识网络。
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
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">关联书籍、笔记、划线和章节片段</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">AI 归纳</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">基于个人书库进行主题分析</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">阅读路径</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">围绕主题组织阅读顺序和问题</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
