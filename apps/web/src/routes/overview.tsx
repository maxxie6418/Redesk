import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BookPlus,
  Clock,
  Download,
  FileUp,
  Grid3X3,
  Import,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { BOOK_STATUS } from '@redesk/shared';
import { useOverview } from '@/hooks/use-overview';
import type { OverviewData } from '@/hooks/use-overview';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { useCategories } from '@/hooks/use-categories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedShell } from '@/components/protected-shell';
import { cn } from '@/lib/utils';
import type { CategoryItem } from '@/hooks/use-categories';

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatActivityDate(value: string) {
  const d = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `今天 ${formatTime(value)}`;
  if (diffDays === 1) return `昨天 ${formatTime(value)}`;
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(d);
}

function ActivityItem({
  dotClass,
  time,
  children,
}: {
  dotClass: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pb-4 last:pb-0">
      <div className={cn('absolute left-[-15px] top-[5px] h-2.5 w-2.5 rounded-full border-2 border-card', dotClass)} />
      <div className="mb-1 text-[11px] text-muted-foreground">{time}</div>
      <div className="text-[13px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all hover:border-primary hover:bg-primary/5"
      onClick={onClick}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const overview = useOverview();
  const sidebarStats = useSidebarStats();
  const categories = useCategories('PERSONAL');

  const total = overview.data?.total ?? 0;
  const counts = overview.data?.status_counts ?? {};

  const recentAdded = useMemo(() => overview.data?.recent_added ?? [], [overview.data?.recent_added]);
  const recentReading = useMemo(() => overview.data?.recent_reading ?? [], [overview.data?.recent_reading]);

  const favoriteCount = overview.data?.favorite_count ?? 0;
  const readingCount = counts[BOOK_STATUS.READING] ?? 0;
  const plannedCount = counts[BOOK_STATUS.PLANNED] ?? 0;
  const storedCount = counts[BOOK_STATUS.STORED] ?? 0;

  const categoryItems = useMemo(() => {
    const items = (categories.data ?? [])
      .filter((c: CategoryItem) => c.book_count > 0)
      .sort((a: CategoryItem, b: CategoryItem) => b.book_count - a.book_count)
      .slice(0, 6);
    if (items.length === 0 && total > 0) {
      return [{ name: '未分类', book_count: total, id: 0 }];
    }
    return items;
  }, [categories.data, total]);

  const timeline = useMemo(() => {
    return recentAdded.slice(0, 6).map((b: OverviewData['recent_added'][number]) => ({
      type: 'add' as const,
      id: b.id,
      time: b.created_at,
      title: b.title,
    }));
  }, [recentAdded]);

  if (overview.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ProtectedShell
      activeKey="overview"
      stats={sidebarStats}
      mainClassName="px-8 py-7"
    >
        <div className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground">档案</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">你的阅读资产全景</p>
        </div>

        <div className="mb-5 grid grid-cols-5 gap-3">
          <KpiCard label="书籍总数" value={total} colorClass="total" />
          <KpiCard label="正在阅读" value={readingCount} colorClass="reading" />
          <KpiCard label="计划阅读" value={plannedCount} colorClass="planned" />
          <KpiCard label="已存档" value={storedCount} colorClass="stored" />
          <KpiCard label="收藏" value={favoriteCount} colorClass="fav" />
        </div>

        <div className="mb-5 grid grid-cols-4 gap-3">
          <QuickAction icon={<BookPlus className="h-[18px] w-[18px]" />} title="添加书籍" subtitle="手动录入或从链接获取" onClick={() => navigate('/?create=1')} />
          <QuickAction icon={<Import className="h-[18px] w-[18px]" />} title="导入笔记" subtitle="进入读书笔记页查看规划" onClick={() => navigate('/reading-notes')} />
          <QuickAction icon={<FileUp className="h-[18px] w-[18px]" />} title="上传文件" subtitle="EPUB / PDF / MOBI 等" onClick={() => navigate('/?import=1')} />
          <QuickAction icon={<Download className="h-[18px] w-[18px]" />} title="导出数据" subtitle="元数据 / 笔记 / 备份" onClick={() => navigate('/settings')} />
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-5">
          <div className="space-y-4">
            {timeline.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border px-[18px] py-3.5">
                  <CardTitle className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    最近动态
                  </CardTitle>
                  <Link to="/" className="text-xs font-medium text-primary hover:underline">
                    查看全部
                  </Link>
                </CardHeader>
                <CardContent className="px-[18px] py-3.5">
                  <div className="relative pl-5">
                    <div className="absolute bottom-1 left-[4px] top-1 w-[2px] rounded-sm bg-border" />
                    {timeline.map((item: { type: 'add'; id: number; time: string; title: string }) => (
                      <ActivityItem key={item.id} dotClass="bg-success" time={formatActivityDate(item.time)}>
                        <span className="cursor-pointer font-medium text-foreground transition-colors hover:text-primary" onClick={() => navigate(`/books/${item.id}`)}>
                          {item.title}
                        </span>
                        <span className="text-muted-foreground"> 被添加到书架</span>
                      </ActivityItem>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {recentReading.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border px-[18px] py-3.5">
                  <CardTitle className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    最近在读
                  </CardTitle>
                  <Link to="/" className="text-xs font-medium text-primary hover:underline">
                    进入书架
                  </Link>
                </CardHeader>
                <CardContent className="px-[18px] py-3.5">
                  <div className="flex flex-col gap-2">
                    {recentReading.map((b: OverviewData['recent_reading'][number], i: number) => (
                      <Link key={b.id} to={`/books/${b.id}`} className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-border hover:bg-muted/30">
                        <div className={cn('flex h-[50px] w-9 shrink-0 items-center justify-center rounded font-display text-sm font-semibold', COVER_TONES[i % COVER_TONES.length])}>
                          {b.title.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-foreground">{b.title}</div>
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{b.author ?? '未知作者'}</div>
                        </div>
                        <span className="shrink-0 rounded bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">在读</span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {categoryItems.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border px-[18px] py-3.5">
                  <CardTitle className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                    分类分布
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-[18px] py-3.5">
                  <div className="flex flex-col gap-2.5">
                    {categoryItems.map((cat: CategoryItem | { name: string; book_count: number; id: number }) => {
                      const pct = total > 0 ? (cat.book_count / total) * 100 : 0;
                      return (
                        <div key={cat.id} className="flex items-center gap-2.5">
                          <span className="min-w-[52px] text-[12.5px] text-foreground">{cat.name}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                            <div className="h-full rounded-sm bg-primary transition-all duration-300" style={{ width: `${pct}%` } as React.CSSProperties} />
                          </div>
                          <span className="min-w-[24px] text-right text-xs tabular-nums text-muted-foreground">{cat.book_count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border px-[18px] py-3.5">
                <CardTitle className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  最近新增
                </CardTitle>
              </CardHeader>
              <CardContent className="px-[18px] py-3.5">
                {recentAdded.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentAdded.slice(0, 4).map((b: OverviewData['recent_added'][number], i: number) => (
                      <Link key={b.id} to={`/books/${b.id}`} className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-border hover:bg-muted/30">
                        <div className={cn('flex h-[50px] w-9 shrink-0 items-center justify-center rounded font-display text-sm font-semibold', COVER_TONES[(i + 3) % COVER_TONES.length])}>
                          {b.title.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-foreground">{b.title}</div>
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {formatShortDate(b.created_at)}
                            {b.author ? ` · ${b.author}` : ''}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-border bg-muted/30 px-[18px] py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-[22px] w-[22px]" />
            </div>
            <div>
              <h4 className="text-[13.5px] font-medium text-foreground">AI 智能助手</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">推荐书单、自动归类、阅读摘要</p>
              <span className="mt-1.5 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">M3 阶段</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-border bg-muted/30 px-[18px] py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <Grid3X3 className="h-[22px] w-[22px]" />
            </div>
            <div>
              <h4 className="text-[13.5px] font-medium text-foreground">阅读话题</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">跨书籍组织深度阅读与知识网络</p>
              <span className="mt-1.5 inline-block rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">M4 阶段</span>
            </div>
          </div>
        </div>
    </ProtectedShell>
  );
}

function KpiCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  const valueColors: Record<string, string> = {
    total: 'text-foreground',
    reading: 'text-success',
    planned: 'text-primary',
    stored: 'text-muted-foreground',
    fav: 'text-amber-500',
  };

  const stripColors: Record<string, string> = {
    total: 'bg-foreground',
    reading: 'bg-success',
    planned: 'bg-primary',
    stored: 'bg-muted-foreground',
    fav: 'bg-amber-500',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-4">
      <div className={cn('absolute left-0 right-0 top-0 h-[3px]', stripColors[colorClass])} />
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('text-[28px] font-bold leading-none tabular-nums', valueColors[colorClass])}>{value}</div>
    </div>
  );
}
