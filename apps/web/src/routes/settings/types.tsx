import type { ReactNode } from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';

export type Tab = 'general' | 'maintenance' | 'ai' | 'login' | 'properties' | 'backup' | 'storage' | 'system';

export type ToastType = 'info' | 'warning' | 'error';

export type StatusMessage = { type: ToastType; text: string } | null;

export const TOAST_ICONS: Record<ToastType, ReactNode> = {
  info: <Check className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <X className="h-4 w-4" />,
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
}
