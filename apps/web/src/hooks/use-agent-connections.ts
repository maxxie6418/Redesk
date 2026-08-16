import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AgentConnection {
  id: number;
  name: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  activated: boolean;
  created_at: string;
}

export interface CreateAgentConnectionInput {
  name: string;
  scopes: string[];
}

export interface CreateAgentConnectionResult {
  id: number;
  name: string;
  scopes: string[];
  expires_at: string | null;
  link: string;
  code: string;
  created_at: string;
}

export function useAgentConnections() {
  return useQuery({
    queryKey: ['agent-connections'],
    queryFn: () => api.get<AgentConnection[]>('/agent/connections'),
  });
}

export function useCreateAgentConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentConnectionInput) =>
      api.post<CreateAgentConnectionResult>('/agent/connections', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-connections'] });
    },
  });
}

export function useRevokeAgentConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<{ id: number; revoked_at: string }>(`/agent/connections/${id}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-connections'] });
    },
  });
}