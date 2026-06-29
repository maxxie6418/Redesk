import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Loader2,
  Settings,
  Clock,
  Library,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS } from '@redesk/shared';
import { useOverview } from '@/hooks/use-overview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  [BOOK_STATUS.READING]: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', icon: '📖' },
  [BOOK_STATUS.PLANNED]: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', icon: '📋' },
  [BOOK_STATUS.READ]: { bg: 'bg-[#e8f0e0] dark:bg-[#1a2415]', text: 'text-[#536843] dark:text-[#8fa878]', icon: '✅' },
  [BOOK_STATUS.STORED]: { bg: 'bg-muted', text: 'text-muted-foreground', icon: '📚' },
};

export function OverviewPage() {
  const overview = useOverview();
  const navigate = useNavigate();

  const total = overview.data?.total ?? 0;
  const counts = overview.data?.status_counts ?? {};
  const recentAdded = overview.data?.recent_added ?? [];
  const recentReading = overview.data?.recent_reading ?? [];

  if (overview.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Library className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Redesk</h1>
        <span className="text-xs font-medium tabular-nums text-muted-foreground/50">v{__APP_VERSION__}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(STATUS_STYLES).map(([status, style]) => {
            const count = counts[status] ?? 0;
            return (
              <Link
                key={status}
                to={`/?status=${status}`}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-foreground/20',
                  style.bg,
                )}
              >
                <span className="text-2xl">{style.icon}</span>
                <div>
                  <p className={cn('text-sm font-medium', style.text)}>
                    {BOOK_STATUS_LABELS[status as keyof typeof BOOK_STATUS_LABELS] ?? status}
                  </p>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">书架总览</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-4xl font-bold text-foreground">{total}</p>
            <p className="text-sm text-muted-foreground mt-1">本书</p>
            <Link to="/">
              <Button variant="outline" size="sm" className="mt-3">
                查看全部书架
              </Button>
            </Link>
          </CardContent>
        </Card>

        {recentReading.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-600" />
                最近在读
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentReading.map((b) => (
                <Link
                  key={b.id}
                  to={`/books/${b.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-foreground/20"
                >
                  <span className="text-sm font-medium text-foreground truncate">{b.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{b.author}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {recentAdded.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                最近新增
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentAdded.map((b) => (
                <Link
                  key={b.id}
                  to={`/books/${b.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-foreground/20"
                >
                  <span className="text-sm font-medium text-foreground truncate">{b.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(b.created_at)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardContent className="py-6 text-center space-y-3">
            <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">AI 智能助手</p>
            <p className="text-xs text-muted-foreground/70">推荐书单、自动归类、阅读摘要 — 即将上线</p>
            <Button variant="ghost" size="sm" disabled>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              即将推出
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="py-6 text-center space-y-3">
            <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">阅读话题</p>
            <p className="text-xs text-muted-foreground/70">围绕一个话题组织多本书的深度阅读 — 即将上线</p>
            <Button variant="ghost" size="sm" disabled>
              <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
              即将推出
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
