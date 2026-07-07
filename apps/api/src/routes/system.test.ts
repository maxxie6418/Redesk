import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyStoragePath, summarizeTrackedStorage } from './system';

describe('classifyStoragePath', () => {
  it('maps known storage prefixes to buckets', () => {
    expect(classifyStoragePath('books/12/main.epub')).toBe('books');
    expect(classifyStoragePath('covers/3/cover.jpg')).toBe('covers');
    expect(classifyStoragePath('tmp/cache.bin')).toBe('tmp');
    expect(classifyStoragePath('unassociated/a.epub')).toBe('unassociated');
  });

  it('returns null for unknown paths', () => {
    expect(classifyStoragePath('misc/file.bin')).toBeNull();
    expect(classifyStoragePath(null)).toBeNull();
  });
});

describe('summarizeTrackedStorage', () => {
  it('counts tracked files by local path bucket and deduplicates repeated paths', () => {
    const storageDir = mkdtempSync(join(tmpdir(), 'redesk-system-test-'));
    try {
      const booksDir = join(storageDir, 'books', '9');
      const coversDir = join(storageDir, 'covers', '9');
      mkdirSync(booksDir, { recursive: true });
      mkdirSync(coversDir, { recursive: true });
      writeFileSync(join(booksDir, 'main.epub'), Buffer.alloc(12));
      writeFileSync(join(coversDir, 'cover.jpg'), Buffer.alloc(7));

      const summary = summarizeTrackedStorage(
        [
          { local_path: 'books/9/main.epub', file_size: 12 },
          { local_path: 'books/9/main.epub', file_size: 999 },
          { local_path: 'covers/9/cover.jpg', file_size: null },
          { local_path: 'tmp/ignored.bin', file_size: 5 },
          { local_path: null, file_size: 100 },
        ],
        storageDir,
      );

      expect(summary.books).toEqual({ file_count: 1, size_bytes: 12 });
      expect(summary.covers).toEqual({ file_count: 1, size_bytes: 7 });
      expect(summary.tmp).toEqual({ file_count: 1, size_bytes: 5 });
      expect(summary.backups).toEqual({ file_count: 0, size_bytes: 0 });
      expect(summary.unassociated).toEqual({ file_count: 0, size_bytes: 0 });
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it('counts associated files under books even when their local path remains in unassociated', () => {
    const storageDir = mkdtempSync(join(tmpdir(), 'redesk-system-test-'));
    try {
      const unassociatedDir = join(storageDir, 'unassociated');
      mkdirSync(unassociatedDir, { recursive: true });
      writeFileSync(join(unassociatedDir, 'linked.epub'), Buffer.alloc(21));

      const summary = summarizeTrackedStorage(
        [{ local_path: 'unassociated/linked.epub', file_size: null, book_id: 3 }],
        storageDir,
      );

      expect(summary.books).toEqual({ file_count: 1, size_bytes: 21 });
      expect(summary.unassociated).toEqual({ file_count: 0, size_bytes: 0 });
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  });
});
