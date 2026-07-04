import { BOOK_STATUS } from '@redesk/shared';
import type { BookSummary } from '@/hooks/use-books';
import { BOOK_STATUS_LABELS_LOCAL } from './constants';

export interface ParsedBookMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publishYear?: string;
  isbn?: string;
  pageCount?: string;
  originalTitle?: string;
  description?: string;
  coverUrl?: string;
  doubanRating?: string;
}

export interface LinkBookMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publish_year?: number;
  isbn?: string;
  page_count?: number;
  original_title?: string;
  description?: string;
  cover_url?: string;
  douban_rating?: number;
  source_url: string;
  metadata_source: 'douban' | 'neodb' | 'manual';
}

export function cleanDoubanValue(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/【([^】]+)】/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDoubanMetadata(raw: string): ParsedBookMetadata {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const data: ParsedBookMetadata = {};

  const firstTitle = lines.find((line) => !line.includes(':') && !line.includes('：'));
  if (firstTitle) data.title = cleanDoubanValue(firstTitle);

  for (const line of lines) {
    const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = cleanDoubanValue(match[2]);

    if (key.includes('作者')) data.author = value;
    if (key.includes('译者')) data.translator = value;
    if (key.includes('出版社')) data.publisher = value;
    if (key.includes('出版年')) data.publishYear = value.match(/\d{4}/)?.[0] ?? value;
    if (key.toUpperCase().includes('ISBN')) data.isbn = value.replace(/[^\dXx]/g, '');
    if (key.includes('页数')) data.pageCount = value.match(/\d+/)?.[0] ?? value;
    if (key.includes('原作名')) data.originalTitle = value;
    if (key.includes('豆瓣评分') || key.includes('评分')) data.doubanRating = value.match(/\d+(?:\.\d+)?/)?.[0];
  }

  return data;
}

export function statusLabel(status: string) {
  return BOOK_STATUS_LABELS_LOCAL[status] ?? status;
}

export function statusDotClass(status: string) {
  if (status === BOOK_STATUS.READING) return 'bg-[#2f7af5]';
  if (status === BOOK_STATUS.PLANNED) return 'bg-[#4dabf7]';
  if (status === BOOK_STATUS.READ) return 'bg-[#788c5d]';
  if (status === BOOK_STATUS.STORED) return 'bg-[#bbb]';
  return 'bg-[#bbb]';
}

export function bookProgress(book: BookSummary) {
  if (book.status === BOOK_STATUS.READ) return 100;
  return 0;
}

export function bookMetaLine(book: BookSummary) {
  const parts = [book.publish_year?.toString(), book.category_name].filter(Boolean);
  return parts.join(' · ') || '—';
}

export function bookMeta(book: BookSummary) {
  return [book.author, book.publisher, book.publish_year].filter(Boolean).join(' / ');
}
