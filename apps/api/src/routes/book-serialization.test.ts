import { describe, expect, it } from 'vitest';
import { serializeBookRow } from './book-serialization';

const baseRow = {
  id: 1,
  owner_id: 1,
  category_id: null,
  genre_category_id: null,
  title: '测试书籍',
  author: '作者',
  subtitle: null,
  isbn: null,
  publisher: null,
  publish_year: null,
  description: null,
  language: null,
  cover_path: null,
  status: 'COLLECTED',
  visibility: 'PRIVATE',
  reading_purpose: null,
  entry_reason: null,
  rating: null,
  custom_attributes: null,
  metadata_source: 'manual',
  source_url: null,
  translator: null,
  original_title: null,
  page_count: null,
  favorited_at: null,
  started_at: null,
  finished_at: null,
  import_order: 1,
  deleted_at: null,
  created_at: '2026-07-06T00:00:00.000Z',
  updated_at: '2026-07-06T00:00:00.000Z',
};

describe('serializeBookRow', () => {
  it('parses custom_attributes JSON and appends related metadata', () => {
    const row = {
      ...baseRow,
      custom_attributes: '{"豆瓣评分":8.7,"来源":"手动"}',
    };

    const result = serializeBookRow(row, {
      personalCategory: { name: '个人分类' },
      genreCategory: { name: '常规分类' },
      tags: { tag_ids: [2, 3], tag_names: ['文学', '随笔'] },
      hasFiles: true,
      hasReadableFile: true,
    });

    expect(result.custom_attributes).toEqual({ 豆瓣评分: 8.7, 来源: '手动' });
    expect(result.category_name).toBe('个人分类');
    expect(result.genre_category_name).toBe('常规分类');
    expect(result.tag_ids).toEqual([2, 3]);
    expect(result.tag_names).toEqual(['文学', '随笔']);
    expect(result.has_files).toBe(true);
    expect(result.has_readable_file).toBe(true);
    expect(result.title).toBe('测试书籍');
  });

  it('returns null custom_attributes for invalid or empty JSON', () => {
    expect(serializeBookRow({ ...baseRow, custom_attributes: null }).custom_attributes).toBeNull();
    expect(serializeBookRow({ ...baseRow, custom_attributes: '{bad-json' }).custom_attributes).toBeNull();
  });
});
