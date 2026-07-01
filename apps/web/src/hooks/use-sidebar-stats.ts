import { useMemo } from 'react';
import { BOOK_STATUS } from '@redesk/shared';
import { useOverview } from '@/hooks/use-overview';
import type { AppSidebarStat } from '@/components/app-sidebar';

export function useSidebarStats(): AppSidebarStat[] {
  const overview = useOverview();

  return useMemo(() => {
    const counts = overview.data?.status_counts ?? {};
    const total = overview.data?.total ?? 0;
    const favoriteCount = overview.data?.favorite_count ?? 0;

    return [
      { label: '总数', value: total, valueClass: 'text-foreground' },
      { label: '在读', value: counts[BOOK_STATUS.READING] ?? 0, valueClass: 'text-success' },
      { label: '收藏', value: favoriteCount, valueClass: 'text-amber-500' },
      { label: '已读', value: counts[BOOK_STATUS.READ] ?? 0, valueClass: 'text-primary' },
    ];
  }, [overview.data]);
}
