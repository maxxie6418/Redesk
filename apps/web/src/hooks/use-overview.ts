import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OverviewData {
  total: number;
  status_counts: Record<string, number>;
  favorite_count: number;
  recent_added: { id: number; title: string; author: string; status: string; created_at: string }[];
  recent_reading: { id: number; title: string; author: string; status: string; updated_at: string; percentage: number }[];
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get<OverviewData>('/overview'),
  });
}
