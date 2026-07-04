import type { BookFileItem, MatchConfidence, MatchMode } from '@/hooks/use-files';

export const FORMAT_OPTIONS = ['ALL', 'EPUB', 'PDF', 'MOBI', 'TXT', 'AZW3', 'DJVU', 'DOCX', 'FB2'];

export const MATCH_MODE_OPTIONS: Array<{ value: MatchMode; label: string; desc: string }> = [
  { value: 'conservative', label: '保守', desc: '只接受高确定性的推荐结果。' },
  { value: 'balanced', label: '平衡', desc: '默认模式，高置信优先，中低置信保留确认。' },
  { value: 'loose', label: '宽松', desc: '尽量给出候选，但会更频繁出现待确认项。' },
];

const STORAGE_MODE_LABELS: Record<BookFileItem['storage_mode'], string> = {
  local_only: '本地',
  cloud_only: '云端',
  dual: '本地 + 云端',
};

export function storageModeLabel(mode: BookFileItem['storage_mode']) {
  return STORAGE_MODE_LABELS[mode];
}

export function formatSize(bytes: number | null): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTotalSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function confidenceLabel(confidence: MatchConfidence): string {
  if (confidence === 'high') return '高置信';
  if (confidence === 'medium') return '待确认';
  return '低置信';
}

export function confidenceClassName(confidence: MatchConfidence): string {
  if (confidence === 'high') return 'border-primary/20 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10';
  if (confidence === 'medium') return 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200';
  return 'border-muted bg-muted/60 text-muted-foreground';
}

export function buildDerivedSummary(input: {
  filename_title: string | null;
  filename_author: string | null;
  epub_title: string | null;
  epub_author: string | null;
  epub_identifier: string | null;
}): string {
  const parts: string[] = [];
  if (input.epub_title) parts.push(`EPUB 书名：${input.epub_title}`);
  if (input.epub_author) parts.push(`EPUB 作者：${input.epub_author}`);
  if (input.epub_identifier) parts.push(`标识符：${input.epub_identifier}`);
  if (!input.epub_title && input.filename_title) parts.push(`文件名识别：${input.filename_title}`);
  if (!input.epub_author && input.filename_author) parts.push(`文件名作者：${input.filename_author}`);
  return parts.join(' · ');
}
