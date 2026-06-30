import { ERROR_CODE } from '@redesk/shared';
import { AppError } from './errors';

export interface LinkMetadata {
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function pickMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return undefined;
}

function pickDoubanInfo(html: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(
      `<span[^>]+class=["'][^"']*\\bpl\\b[^"']*["'][^>]*>\\s*${escaped}:?\\s*</span>\\s*([\\s\\S]*?)(?=<br\\s*/?>|<span[^>]+class=["'][^"']*\\bpl\\b[^"']*["']|</div>)`,
      'i',
    ),
  );
  if (!match?.[1]) return undefined;
  return stripHtml(match[1]);
}

function pickDoubanCover(html: string): string | undefined {
  const metaCover = pickMeta(html, 'og:image');
  if (metaCover) return metaCover;
  const mainPic = html.match(/<div[^>]+id=["']mainpic["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (mainPic) return decodeHtmlEntities(mainPic.trim());
  return html.match(/<img[^>]+rel=["']v:photo["'][^>]+src=["']([^"']+)["']/i)?.[1];
}

function pickDoubanRating(html: string): number | undefined {
  const raw =
    html.match(/<strong[^>]+class=["'][^"']*rating_num[^"']*["'][^>]*>\s*([\d.]+)\s*<\/strong>/i)?.[1] ??
    html.match(/property=["']v:average["'][^>]*>\s*([\d.]+)\s*</i)?.[1];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseJsonLdObjects(html: string): unknown[] {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const result: unknown[] = [];
  for (const match of matches) {
    try {
      result.push(JSON.parse(decodeHtmlEntities(match[1].trim())) as unknown);
    } catch {
      // ignore invalid structured data
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string') return stripHtml(value);
  const record = asRecord(value);
  const name = record?.name;
  return typeof name === 'string' ? stripHtml(name) : undefined;
}

function readPersonList(value: unknown): string | undefined {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const names = items.map(readText).filter((item): item is string => Boolean(item));
  return names.length > 0 ? names.join(' / ') : undefined;
}

function pickNeoDBField(html: string, labelPattern: string): string | undefined {
  const match = html.match(new RegExp(`${labelPattern}:\\s*([\\s\\S]*?)(?=<\\/div>|<br\\s*/?>)`, 'i'));
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

function pickNeoDBRating(html: string): number | undefined {
  if (/璇勫垎浜烘暟涓嶈冻/.test(html)) return undefined;
  const ratingBlock = html.match(/<div[^>]+class=["'][^"']*\brating\b[^"']*["'][\s\S]*?<h3[^>]*>\s*([\d.]+)\s*<small>\s*\/\s*10/i)?.[1];
  if (!ratingBlock) return undefined;
  const value = Number(ratingBlock);
  return Number.isFinite(value) ? value : undefined;
}

function parseNeoDBHtml(html: string, sourceUrl: string): LinkMetadata {
  const jsonLd = parseJsonLdObjects(html)
    .map(asRecord)
    .find((item) => item?.['@type'] === 'Book');
  const publisher = asRecord(jsonLd?.publisher);
  const publishDate = readText(jsonLd?.datePublished) ?? pickNeoDBField(html, '\u53d1\u884c\u65f6\u95f4');
  const pageCountRaw = jsonLd?.numberOfPages ?? pickNeoDBField(html, '\u9875\u6570');
  const pageCount = typeof pageCountRaw === 'number' ? pageCountRaw : String(pageCountRaw ?? '').match(/\d+/)?.[0];
  const rating = pickNeoDBRating(html);

  return {
    title: readText(jsonLd?.name) ?? pickMeta(html, 'og:title') ?? undefined,
    author: readPersonList(jsonLd?.author) ?? pickNeoDBField(html, '\u4f5c\u8005'),
    translator: pickNeoDBField(html, '\u8bd1\u8005'),
    publisher: readText(publisher?.name) ?? pickNeoDBField(html, '(?:publishing house|\u51fa\u7248\u793e)'),
    publish_year: publishDate?.match(/\d{4}/) ? Number(publishDate.match(/\d{4}/)?.[0]) : undefined,
    isbn: readText(jsonLd?.isbn)?.replace(/[^\dXx]/g, '') ?? pickNeoDBField(html, 'ISBN')?.replace(/[^\dXx]/g, ''),
    page_count: pageCount ? Number(pageCount) : undefined,
    original_title: readText(jsonLd?.alternateName),
    description: readText(jsonLd?.description) ?? pickMeta(html, 'og:description'),
    cover_url: readText(jsonLd?.image) ?? pickMeta(html, 'og:image'),
    douban_rating: rating,
    source_url: sourceUrl,
    metadata_source: 'neodb',
  };
}

function parseDoubanHtml(html: string, sourceUrl: string): LinkMetadata {
  const title =
    pickMeta(html, 'og:title') ??
    stripHtml(html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? '').replace(/\(璞嗙摚\)$/, '').trim();

  const author = pickDoubanInfo(html, '\u4f5c\u8005');
  const publisher = pickDoubanInfo(html, '\u51fa\u7248\u793e');
  const publishDate = pickDoubanInfo(html, '\u51fa\u7248\u5e74');
  const isbn = pickDoubanInfo(html, 'ISBN')?.replace(/[^\dXx]/g, '');
  const pageCountText = pickDoubanInfo(html, '\u9875\u6570');
  const translator = pickDoubanInfo(html, '\u8bd1\u8005');
  const originalTitle = pickDoubanInfo(html, '\u539f\u4f5c\u540d');
  const description =
    pickMeta(html, 'og:description') ??
    stripHtml(html.match(/<div[^>]+class=["'][^"']*intro[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
  const coverUrl = pickDoubanCover(html);
  const doubanRating = pickDoubanRating(html);
  const publishYear = publishDate?.match(/\d{4}/)?.[0];
  const pageCount = pageCountText?.match(/\d+/)?.[0];

  return {
    title: title || undefined,
    author,
    translator,
    publisher,
    publish_year: publishYear ? Number(publishYear) : undefined,
    isbn,
    page_count: pageCount ? Number(pageCount) : undefined,
    original_title: originalTitle,
    description,
    cover_url: coverUrl,
    douban_rating: doubanRating,
    source_url: sourceUrl,
    metadata_source: 'douban',
  };
}

export async function fetchBookMetadataFromUrl(sourceUrl: string): Promise<LinkMetadata> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍链接');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '只支持 http 或 https 链接');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 Redesk/0.1 book metadata fetcher',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, `获取链接失败：HTTP ${res.status}`);
    }
    const html = await res.text();
    if (url.hostname.includes('douban.com')) {
      return parseDoubanHtml(html, url.toString());
    }
    if (url.hostname.includes('neodb.social')) {
      return parseNeoDBHtml(html, url.toString());
    }
    return {
      title: pickMeta(html, 'og:title') ?? stripHtml(html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? ''),
      description: pickMeta(html, 'og:description'),
      cover_url: pickMeta(html, 'og:image'),
      source_url: url.toString(),
      metadata_source: 'manual',
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ERROR_CODE.BUSINESS_ERROR, '获取链接失败，请稍后重试');
  } finally {
    clearTimeout(timeout);
  }
}
