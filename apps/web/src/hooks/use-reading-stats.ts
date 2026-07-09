import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/api';

export function useReadingStatsSummary() {
  return useQuery({
    queryKey: ['reading-stats', 'summary'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reading-stats/summary`, { credentials: 'include' });
      if (!res.ok) throw new Error('获取阅读统计失败');
      const json = await res.json();
      return json.data as {
        total_seconds: number;
        today_seconds: number;
        week_seconds: number;
        month_seconds: number;
      };
    },
  });
}

export function useBookReadingStats(bookId: number) {
  return useQuery({
    queryKey: ['reading-stats', 'book', bookId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/books/${bookId}/reading-stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('获取书籍阅读统计失败');
      const json = await res.json();
      return json.data as {
        total_duration: number;
        session_count: number;
        last_session_at: string | null;
      };
    },
    enabled: !!bookId,
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '昨天';
  return `${diffDays} 天前`;
}
