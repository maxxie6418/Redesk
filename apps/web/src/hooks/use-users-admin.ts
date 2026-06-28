import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserAdminSummary {
  id: number;
  username: string;
  display_name: string | null;
  created_at: string;
}

export function useUserList() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<UserAdminSummary[]>('/users'),
    retry: false,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password: string; display_name?: string }) =>
      api.post<UserAdminSummary>('/users', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; display_name?: string | null }) =>
      api.patch<UserAdminSummary>(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ id: number; deleted: boolean }>(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post<{ id: number; reset: boolean }>(`/users/${id}/reset-password`, { password }),
  });
}
