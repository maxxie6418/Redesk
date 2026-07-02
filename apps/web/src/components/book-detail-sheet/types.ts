import type { BookSummary } from '@/hooks/use-books';
import type { BookFileItem } from '@/hooks/use-files';
import type { LucideIcon } from 'lucide-react';

export type ToastType = 'info' | 'warning' | 'error';
export type StatusMessage = { type: ToastType; text: string } | null;

export type DetailTab = 'archive' | 'traces' | 'topics' | 'ai';

export interface DetailTabItem {
  id: DetailTab;
  label: string;
  icon: LucideIcon;
  tint: string;
}

export const ATTR_LABELS: Record<string, string> = {
  douban_rating: '豆瓣评分',
  neodb_rating: 'NeoDB 评分',
  douban_id: '豆瓣 ID',
  isbn: 'ISBN',
  asin: 'ASIN',
  series: '丛书',
  edition: '版次',
  language: '语言',
  original_language: '原作语言',
  format: '装帧',
  price: '定价',
  douban_url: '豆瓣链接',
  neodb_url: 'NeoDB 链接',
};

export const STORAGE_MODE_LABELS: Record<BookFileItem['storage_mode'], string> = {
  local_only: '本地',
  cloud_only: '云端',
  dual: '本地 + 云端',
};

export const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

export function bookProgress(book: BookSummary): number {
  return book.status === 'READ' ? 100 : 0;
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
