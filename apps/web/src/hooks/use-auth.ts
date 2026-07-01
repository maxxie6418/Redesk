import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AuthStatus, type AuthUser } from '@/lib/api';

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api.get<AuthStatus>('/auth/status'),
  });
}

export function useAuthInit() {
  return useQuery({
    queryKey: ['auth-init'],
    queryFn: () => api.get<{ initial: boolean; has_admin: boolean; multi_user: boolean }>('/auth/init'),
    retry: false,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.get<AuthUser>('/auth/me'),
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string }) => api.post<AuthUser>('/auth/login', input),
    onSuccess: (user: AuthUser) => {
      qc.setQueryData(['current-user'], user);
      qc.invalidateQueries({ queryKey: ['auth-status'] });
    },
  });
}

export function useAuthMode() {
  return useQuery({
    queryKey: ['auth-mode'],
    queryFn: () => api.get<{ mode: string; multi_user: boolean }>('/auth/mode'),
    staleTime: 60_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>('/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(['current-user'], null);
      qc.invalidateQueries({ queryKey: ['auth-status'] });
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { current_password?: string; new_password: string }) =>
      api.post<AuthUser>('/auth/change-password', input),
    onSuccess: (user: AuthUser) => {
      qc.setQueryData(['current-user'], user);
    },
  });
}
