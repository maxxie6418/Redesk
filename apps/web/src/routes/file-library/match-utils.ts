import type { BookSummary } from '@/hooks/use-books';
import type { BookFileItem } from '@/hooks/use-files';

export const FORMAT_OPTIONS = ['ALL', 'EPUB', 'PDF', 'MOBI', 'TXT', 'AZW3', 'DJVU', 'DOCX', 'FB2'];

export const MATCH_MODE_OPTIONS = [
  { value: 'conservative', label: '保守', desc: '只默认采用高确定性结果' },
  { value: 'balanced', label: '平衡', desc: '大致匹配且没有歧义时默认命中' },
  { value: 'loose', label: '宽松', desc: '优先提高命中率，用醒目提示标出风险' },
] as const;

export type MatchMode = (typeof MATCH_MODE_OPTIONS)[number]['value'];
export type MatchLevel = 'high' | 'medium' | 'low';

export interface MatchCandidate {
  id: number;
  title: string;
  author: string | null;
  score: number;
  level: MatchLevel;
  ambiguous: boolean;
  reason: string;
}

const MATCH_MODE_CONFIG: Record<MatchMode, { accept: number; review: number; gap: number }> = {
  conservative: { accept: 0.9, review: 0.75, gap: 0.08 },
  balanced: { accept: 0.78, review: 0.58, gap: 0.06 },
  loose: { accept: 0.68, review: 0.48, gap: 0.04 },
};

const FILENAME_NOISE = [
  'epub',
  'pdf',
  'mobi',
  'txt',
  'azw3',
  'azw',
  'djvu',
  'docx',
  'fb2',
  'ebook',
  'zlib',
  '完整版',
  '扫描版',
  '文字版',
  '校对版',
  '插图版',
  '精校',
  '全集',
  'volume',
  'vol',
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
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTotalSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function normalizeMatchText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripExtension(value)
    .toLowerCase()
    .replace(/[[（【][^)\]】）]*[\]】）]/g, ' ')
    .replace(/[_\-+]+/g, ' ')
    .replace(/[·.，、\\]/g, ' ')
    .replace(/\b(v|vol|volume)\s*\d+\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const noise of FILENAME_NOISE) {
    text = text.replace(new RegExp(`\\b${noise}\\b`, 'g'), ' ');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function compactMatchText(value: string): string {
  return value.replace(/\s+/g, '');
}

function splitTokens(value: string): string[] {
  return value
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildBigrams(value: string): Set<string> {
  if (!value) return new Set();
  if (value.length === 1) return new Set([value]);
  const grams = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) {
    grams.add(value.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = buildBigrams(left);
  const rightGrams = buildBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) overlap += 1;
  }

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

export function extractSearchSeed(filename: string | null | undefined): string {
  const normalized = normalizeMatchText(filename);
  if (!normalized) return '';
  const tokens = splitTokens(normalized);
  if (tokens.length === 0) return normalized;
  return tokens.slice(0, 6).join(' ');
}

export function buildCandidate(filename: string | null | undefined, book: BookSummary, mode: MatchMode, secondScore: number): MatchCandidate {
  const fileNormalized = normalizeMatchText(filename);
  const fileCompact = compactMatchText(fileNormalized);
  const titleNormalized = normalizeMatchText(book.title);
  const titleCompact = compactMatchText(titleNormalized);
  const authorNormalized = normalizeMatchText(book.author);
  const authorCompact = compactMatchText(authorNormalized);

  const titleScore = diceCoefficient(fileCompact, titleCompact);
  const authorScore = authorCompact ? diceCoefficient(fileCompact, authorCompact) : 0;
  const containsTitle = titleCompact.length >= 2 && (fileCompact.includes(titleCompact) || titleCompact.includes(fileCompact));
  const containsAuthor = authorCompact.length >= 2 && fileCompact.includes(authorCompact);
  const titleTokens = splitTokens(titleNormalized);
  const tokenHits = titleTokens.filter((token) => fileNormalized.includes(token)).length;
  const tokenScore = titleTokens.length > 0 ? tokenHits / titleTokens.length : 0;

  const score = Math.min(
    1,
    titleScore * 0.72 + tokenScore * 0.18 + authorScore * 0.06 + (containsTitle ? 0.08 : 0) + (containsAuthor ? 0.04 : 0),
  );

  const config = MATCH_MODE_CONFIG[mode];
  const ambiguous = score >= config.review && Math.abs(score - secondScore) < config.gap;

  let level: MatchLevel = 'low';
  if (score >= config.accept && !ambiguous) level = 'high';
  else if (score >= config.review) level = 'medium';

  let reason = containsTitle ? '书名主体已命中' : '按文件名近似度匹配';
  if (containsAuthor) reason += '，作者也命中';
  else if (authorScore >= 0.45) reason += '，作者较接近';
  if (ambiguous) reason += '，但存在接近候选';

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    score,
    level,
    ambiguous,
    reason,
  };
}

export function levelLabel(level: MatchLevel): string {
  if (level === 'high') return '默认命中';
  if (level === 'medium') return '需要关注';
  return '低置信';
}

export function levelClassName(level: MatchLevel): string {
  if (level === 'high') return 'border-primary/20 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10';
  if (level === 'medium') return 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200';
  return 'border-muted bg-muted/60 text-muted-foreground';
}
