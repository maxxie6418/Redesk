import { FileText, Highlighter, Lightbulb, NotebookPen, StickyNote } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useShellUser } from '@/components/shell-user-context';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';

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
  const sidebarStats = useSidebarStats();

  return (
    <AppShell
      activeKey="reading-notes"
      user={user}
      stats={sidebarStats}
      mainClassName="flex min-w-0 flex-1 items-center justify-center px-8 py-7"
    >
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
            <NotebookPen className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            M2 阶段
          </div>
          <h1 className="mt-3 font-display text-[26px] font-semibold text-foreground">读书笔记</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            统一管理所有阅读笔记、划线与标注。跨书籍聚合，按标签索引，支持 Markdown 一键导出。
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  {feature.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground">{feature.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </AppShell>
  );
}
