import type { AuthUser } from '@/lib/api';

function isAuthDisabled(): boolean {
  const configured = import.meta.env.VITE_AUTH_DISABLED;
  const fallback = import.meta.env.DEV ? 'true' : 'false';
  return String(configured ?? fallback).toLowerCase() === 'true';
}

export const AUTH_DISABLED = isAuthDisabled();

export const LOCAL_AUTH_USER: AuthUser = {
  id: 1,
  username: 'local',
  display_name: '未登录',
  is_active: true,
  session_expires_days: 30,
};
