export interface RawBookRow {
  id: number;
  owner_id: number;
  category_id: number | null;
  genre_category_id: number | null;
  title: string;
  author: string | null;
  subtitle: string | null;
  isbn: string | null;
  publisher: string | null;
  publish_year: number | null;
  description: string | null;
  language: string | null;
  cover_path: string | null;
  status: string;
  visibility: string;
  reading_purpose: string | null;
  entry_reason: string | null;
  rating: number | null;
  custom_attributes: string | null;
  metadata_source: string | null;
  source_url: string | null;
  translator: string | null;
  original_title: string | null;
  page_count: number | null;
  favorited_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  import_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BookCategoryMeta {
  name: string;
}

interface BookTagMeta {
  tag_ids: number[];
  tag_names: string[];
}

interface SerializeBookRowMeta {
  personalCategory?: BookCategoryMeta | null;
  genreCategory?: BookCategoryMeta | null;
  tags?: BookTagMeta;
  hasFiles?: boolean;
  hasReadableFile?: boolean;
}

export function parseCustomAttributes(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function serializeBookRow(row: RawBookRow, meta: SerializeBookRowMeta = {}) {
  const tagMeta = meta.tags ?? { tag_ids: [], tag_names: [] };

  return {
    ...row,
    custom_attributes: parseCustomAttributes(row.custom_attributes),
    category_name: meta.personalCategory?.name ?? null,
    genre_category_name: meta.genreCategory?.name ?? null,
    tag_ids: tagMeta.tag_ids,
    tag_names: tagMeta.tag_names,
    has_files: meta.hasFiles ?? false,
    has_readable_file: meta.hasReadableFile ?? false,
  };
}
