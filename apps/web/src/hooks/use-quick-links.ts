import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface QuickLink {
  id: number;
  name: string;
  url: string;
}

const SETTINGS_KEY = 'quick_links';

function parseQuickLinks(value: string | undefined): QuickLink[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is QuickLink =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'number' &&
          typeof item.name === 'string' &&
          typeof item.url === 'string',
      );
    }
    return [];
  } catch {
    return [];
  }
}

export function useQuickLinks() {
  return useQuery({
    queryKey: ['quickLinks'],
    queryFn: async () => {
      const data = await api.get<Record<string, string>>('/settings');
      return parseQuickLinks(data[SETTINGS_KEY]);
    },
  });
}

export function useUpdateQuickLinks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (links: QuickLink[]) => {
      const value = JSON.stringify(links);
      await api.patch<Record<string, string>>('/settings', { [SETTINGS_KEY]: value });
      return links;
    },
    onSuccess: (data: QuickLink[]) => {
      qc.setQueryData(['quickLinks'], data);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useAddQuickLink() {
  const query = useQuickLinks();
  const update = useUpdateQuickLinks();

  return useMutation({
    mutationFn: async (link: Omit<QuickLink, 'id'>) => {
      const current = query.data ?? [];
      const newId = current.length > 0 ? Math.max(...current.map((link: QuickLink) => link.id)) + 1 : 1;
      const newLink: QuickLink = { ...link, id: newId };
      const next = [...current, newLink];
      await update.mutateAsync(next);
      return newLink;
    },
  });
}

export function useUpdateQuickLink() {
  const query = useQuickLinks();
  const update = useUpdateQuickLinks();

  return useMutation({
    mutationFn: async (link: QuickLink) => {
      const current = query.data ?? [];
      const next = current.map((item: QuickLink) => (item.id === link.id ? link : item));
      await update.mutateAsync(next);
      return link;
    },
  });
}

export function useDeleteQuickLink() {
  const query = useQuickLinks();
  const update = useUpdateQuickLinks();

  return useMutation({
    mutationFn: async (id: number) => {
      const current = query.data ?? [];
      const next = current.filter((item: QuickLink) => item.id !== id);
      await update.mutateAsync(next);
    },
  });
}

export function useReorderQuickLink() {
  const query = useQuickLinks();
  const update = useUpdateQuickLinks();

  const move = async (id: number, direction: 'up' | 'down') => {
    const current = query.data ?? [];
    const index = current.findIndex((item: QuickLink) => item.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === current.length - 1) return;

    const next = [...current];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await update.mutateAsync(next);
  };

  return {
    moveUp: (id: number) => move(id, 'up'),
    moveDown: (id: number) => move(id, 'down'),
  };
}
