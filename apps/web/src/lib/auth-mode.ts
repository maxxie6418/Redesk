import type { AuthUser } from '@/lib/api';

function isAuthDisabled(): boolean {
  const configured = import.meta.env.VITE_AUTH_DISABLED;
  const fallback = 'false';
  return String(configured ?? fallback).toLowerCase() === 'true';
}

export const AUTH_DISABLED = isAuthDisabled();

export const LOCAL_AUTH_USER: AuthUser = {
  id: 0,
  username: null,
  display_name: '未登录',
  is_active: true,
  is_admin: false,
  must_change_password: false,
};
