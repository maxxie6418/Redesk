export const now = (): string => new Date().toISOString();

export const MIME_TYPES: Record<string, string> = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.mobi': 'application/x-mobipocket-ebook',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.azw3': 'application/vnd.amazon.mobi8-ebook',
  '.azw': 'application/vnd.amazon.mobi8-ebook',
  '.djvu': 'image/vnd.djvu',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.fb2': 'application/x-fictionbook+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export const EXTENSION_FORMATS: Record<string, string> = {
  '.epub': 'EPUB',
  '.pdf': 'PDF',
  '.mobi': 'MOBI',
  '.txt': 'TXT',
  '.md': 'MD',
  '.markdown': 'MARKDOWN',
  '.azw3': 'AZW3',
  '.azw': 'AZW3',
  '.djvu': 'DJVU',
  '.docx': 'DOCX',
  '.fb2': 'FB2',
  '.jpg': 'JPG',
  '.jpeg': 'JPEG',
  '.png': 'PNG',
};

export const READABLE_FILE_FORMATS = ['EPUB', 'PDF', 'MD', 'MARKDOWN', 'TXT', 'JPG', 'JPEG', 'PNG'] as const;
export type ReadableFileFormat = (typeof READABLE_FILE_FORMATS)[number];

const READABLE_FILE_FORMAT_SET = new Set<string>(READABLE_FILE_FORMATS);
const READABLE_FILE_FORMAT_PRIORITY = new Map<string, number>(
  READABLE_FILE_FORMATS.map((format, index) => [format, index]),
);

export interface ReadableFileCandidate {
  id: number;
  is_primary: number;
  file_format: string;
}

export function normalizeFileFormat(format: string | null | undefined): string {
  return String(format ?? '').trim().toUpperCase();
}

export function isReadableFileFormat(format: string | null | undefined): format is ReadableFileFormat {
  return READABLE_FILE_FORMAT_SET.has(normalizeFileFormat(format));
}

export function selectReadableFile<T extends ReadableFileCandidate>(files: readonly T[] | null | undefined): T | null {
  const candidates = (files ?? []).filter((file) => isReadableFileFormat(file.file_format));
  if (candidates.length === 0) return null;

  const primary = candidates.find((file) => file.is_primary === 1);
  if (primary) return primary;

  return [...candidates].sort((left, right) => {
    const leftPriority = READABLE_FILE_FORMAT_PRIORITY.get(normalizeFileFormat(left.file_format)) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = READABLE_FILE_FORMAT_PRIORITY.get(normalizeFileFormat(right.file_format)) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.id - right.id;
  })[0] ?? null;
}
