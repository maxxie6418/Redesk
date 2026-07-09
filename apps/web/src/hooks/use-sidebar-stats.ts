import { useMemo } from 'react';
import { BOOK_STATUS } from '@redesk/shared';
import { useOverview } from '@/hooks/use-overview';
import { useReadingStatsSummary, formatDuration } from '@/hooks/use-reading-stats';
import type { AppSidebarStat } from '@/components/app-sidebar';

export function useSidebarStats(): AppSidebarStat[] {
  const overview = useOverview();
  const readingStats = useReadingStatsSummary();

  return useMemo(() => {
    const counts = overview.data?.status_counts ?? {};
    const total = overview.data?.total ?? 0;
    const favoriteCount = overview.data?.favorite_count ?? 0;
    const todaySeconds = readingStats.data?.today_seconds ?? 0;

    return [
      { label: '总数', value: total, valueClass: 'text-foreground' },
      { label: '在读', value: counts[BOOK_STATUS.READING] ?? 0, valueClass: 'text-success' },
      { label: '收藏', value: favoriteCount, valueClass: 'text-amber-500' },
      { label: '已读', value: counts[BOOK_STATUS.READ] ?? 0, valueClass: 'text-primary' },
      { label: '今日阅读', value: todaySeconds > 0 ? formatDuration(todaySeconds) : '—', valueClass: 'text-sky-500' },
    ];
  }, [overview.data, readingStats.data]);
}
