import type { FastifyInstance, FastifyReply } from 'fastify';
import { and, eq, inArray, isNull, asc, desc } from 'drizzle-orm';
import { books, notes, highlights, categories } from '@redesk/db';
import { ERROR_CODE, exportQuerySchema, importNotesSchema } from '@redesk/shared';
import { getDb, getSqlite } from '../db';
import { requireAdmin, requirePermission } from '../lib/auth';
import { AppError } from '../lib/errors';
import { validate } from '../lib/zod';
import { config } from '../config';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface ArchiverInstance {
  on(event: string, cb: () => void): void;
  file(path: string, opts: { name: string }): void;
  append(content: string, opts: { name: string }): void;
  finalize(): Promise<void>;
}

function now(): string {
  return new Date().toISOString();
}

async function archiveStream(dbPath: string, storageDir: string, reply: FastifyReply) {
  const archiverModule = await import('archiver');
  const ArchiverCtor = typeof archiverModule === 'function'
    ? archiverModule as unknown as (fmt: string, opts?: Record<string, unknown>) => ArchiverInstance
    : (archiverModule as unknown as { default: (fmt: string, opts?: Record<string, unknown>) => ArchiverInstance }).default;
  const archive = ArchiverCtor('zip', { zlib: { level: 6 } });

  archive.on('error', () => {
    // archive failed, reply already likely sent
  });

  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `attachment; filename="redesk-backup-${Date.now()}.zip"`);
  reply.send(archive);

  archive.file(dbPath, { name: 'redesk.db' });

  addStorageFiles(archive, storageDir, 'storage/');
  addMarkdownExports(archive);

  await archive.finalize();
}

function addStorageFiles(archive: ArchiverInstance, baseDir: string, prefix: string) {
  if (!existsSync(baseDir)) return;
  const walk = (dir: string, arcPath: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const arcName = join(arcPath, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full, arcName);
      } else {
        archive.file(full, { name: arcName });
      }
    }
  };
  // skip backups subdirectory to avoid recursive bloat
  const entries = readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'backups' || entry.name === 'tmp') continue;
    const full = join(baseDir, entry.name);
    const arcName = join(prefix, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      walk(full, arcName);
    } else {
      archive.file(full, { name: arcName });
    }
  }
}

function addMarkdownExports(archive: ArchiverInstance) {
  const db = getDb();
  const all = db
    .select({ title: books.title, author: books.author, description: books.description, reading_purpose: books.reading_purpose, status: books.status, rating: books.rating, created_at: books.created_at })
    .from(books)
    .where(isNull(books.deleted_at))
    .all();

  for (const b of all) {
    const md = [
      `# ${b.title}`,
      '',
      b.author ? `**作者**: ${b.author}` : '',
      b.status ? `**状态**: ${b.status}` : '',
      b.rating ? `**评分**: ${'★'.repeat(b.rating)}` : '',
      b.reading_purpose ? `**阅读目的**: ${b.reading_purpose}` : '',
      b.description ? `\n${b.description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const safeName = b.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) || 'untitled';
    archive.append(md, { name: `books/${safeName}_${b.created_at?.slice(0, 10) ?? 'unknown'}.md` });
  }
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/export/books', async (req, reply) => {
    const userId = requirePermission(req, 'use');
    const input = validate(exportQuerySchema, req.query as Record<string, unknown>);
    const db = getDb();

    const idList = input.ids
      ? input.ids
          .split(',')
          .map((s: string) => parseInt(s.trim(), 10))
          .filter((n: number) => !Number.isNaN(n))
      : null;

    const whereConditions = idList
      ? [and(eq(books.owner_id, userId), isNull(books.deleted_at), inArray(books.id, idList))]
      : [and(eq(books.owner_id, userId), isNull(books.deleted_at))];

    const rows = db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        subtitle: books.subtitle,
        isbn: books.isbn,
        publisher: books.publisher,
        publish_year: books.publish_year,
        description: books.description,
        language: books.language,
        cover_path: books.cover_path,
        status: books.status,
        visibility: books.visibility,
        reading_purpose: books.reading_purpose,
        entry_reason: books.entry_reason,
        rating: books.rating,
        custom_attributes: books.custom_attributes,
        metadata_source: books.metadata_source,
        source_url: books.source_url,
        translator: books.translator,
        original_title: books.original_title,
        page_count: books.page_count,
        category_id: books.category_id,
        category_name: categories.name,
        genre_category_id: books.genre_category_id,
        favorited_at: books.favorited_at,
        started_at: books.started_at,
        finished_at: books.finished_at,
        import_order: books.import_order,
        created_at: books.created_at,
        updated_at: books.updated_at,
      })
      .from(books)
      .leftJoin(categories, eq(books.category_id, categories.id))
      .where(whereConditions.length === 1 ? whereConditions[0] : undefined)
      .orderBy(asc(books.title))
      .all();

    if (input.format === 'csv') {
      const headers = [
        'id', 'title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year',
        'description', 'language', 'cover_path', 'status', 'visibility',
        'reading_purpose', 'entry_reason', 'rating', 'custom_attributes',
        'metadata_source', 'source_url', 'translator', 'original_title',
        'page_count', 'category_id', 'category_name', 'genre_category_id',
        'favorited_at', 'started_at', 'finished_at', 'import_order',
        'created_at', 'updated_at',
      ];
      const csvRows = [headers.join(',')];

      for (const row of rows) {
        const vals = headers.map((h: string) => {
          const v = row[h as keyof typeof row];
          if (v == null) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        });
        csvRows.push(vals.join(','));
      }

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="redesk-books-${Date.now()}.csv"`);
      return reply.send('\uFEFF' + csvRows.join('\n'));
    }

    reply.header('Content-Disposition', `attachment; filename="redesk-books-${Date.now()}.json"`);
    return { data: rows, exported_at: now(), count: rows.length };
  });

  app.get('/export/books/:id/notes', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const db = getDb();
    const rows = db
      .select()
      .from(notes)
      .where(and(eq(notes.book_id, bookId), eq(notes.owner_id, userId), isNull(notes.deleted_at)))
      .orderBy(desc(notes.created_at))
      .all();

    return {
      data: {
        book_id: bookId,
        notes: rows.map((r) => ({
          id: r.id,
          cfi: r.cfi,
          title: r.title,
          content_markdown: r.content_markdown,
          content_html: r.content_html,
          mark_type: r.mark_type,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        count: rows.length,
        exported_at: now(),
      },
    };
  });

  app.get('/export/books/:id/highlights', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const db = getDb();
    const rows = db
      .select()
      .from(highlights)
      .where(and(eq(highlights.book_id, bookId), eq(highlights.owner_id, userId), isNull(highlights.deleted_at)))
      .orderBy(desc(highlights.created_at))
      .all();

    return {
      data: {
        book_id: bookId,
        highlights: rows.map((r) => ({
          id: r.id,
          cfi_start: r.cfi_start,
          cfi_end: r.cfi_end,
          text: r.text,
          type: r.type,
          color: r.color,
          note: r.note,
          mark_type: r.mark_type,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        count: rows.length,
        exported_at: now(),
      },
    };
  });

  app.get('/export/books/:id/marks', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const db = getDb();
    const noteRows = db
      .select()
      .from(notes)
      .where(and(eq(notes.book_id, bookId), eq(notes.owner_id, userId), isNull(notes.deleted_at)))
      .orderBy(desc(notes.created_at))
      .all();

    const highlightRows = db
      .select()
      .from(highlights)
      .where(and(eq(highlights.book_id, bookId), eq(highlights.owner_id, userId), isNull(highlights.deleted_at)))
      .orderBy(desc(highlights.created_at))
      .all();

    return {
      data: {
        book_id: bookId,
        notes: noteRows.map((r) => ({
          id: r.id,
          cfi: r.cfi,
          title: r.title,
          content_markdown: r.content_markdown,
          mark_type: r.mark_type,
          created_at: r.created_at,
        })),
        highlights: highlightRows.map((r) => ({
          id: r.id,
          cfi_start: r.cfi_start,
          cfi_end: r.cfi_end,
          text: r.text,
          type: r.type,
          color: r.color,
          note: r.note,
          mark_type: r.mark_type,
          created_at: r.created_at,
        })),
        count: noteRows.length + highlightRows.length,
        exported_at: now(),
      },
    };
  });

  app.post('/backup/full', async (req, reply) => {
    requireAdmin(req);
    const dbPath = config.databaseUrl;
    if (!existsSync(dbPath)) throw new AppError(ERROR_CODE.INTERNAL_ERROR, '数据库文件不存在');

    await archiveStream(dbPath, config.storageDir, reply);
  });

  app.get('/backup/list', async (req) => {
    requirePermission(req, 'use');
    const dir = join(config.storageDir, 'backups');
    if (!existsSync(dir)) return { data: [] };

    const items = readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const full = join(dir, f);
        const stat = statSync(full);
        return {
          name: f,
          size_bytes: stat.size,
          created_at: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { data: items };
  });

  app.post('/backup/trigger', async (req) => {
    requireAdmin(req);
    const sqlite = getSqlite();
    const dir = join(config.storageDir, 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const backupPath = join(dir, `redesk-auto-${timestamp}.db`);
    const escapedPath = backupPath.replace(/\\/g, '/').replace(/'/g, "''");

    try {
      sqlite.exec(`VACUUM INTO '${escapedPath}'`);

      const items = readdirSync(dir)
        .filter((f) => f.startsWith('redesk-auto-') && f.endsWith('.db'))
        .sort()
        .reverse();

      const keep = 7;
      for (let i = keep; i < items.length; i++) {
        try { unlinkSync(join(dir, items[i])); } catch { /* ignore */ }
      }

      return { data: { path: backupPath, success: true, kept: Math.min(keep, items.length) } };
    } catch (err) {
      throw new AppError(
        ERROR_CODE.INTERNAL_ERROR,
        `备份失败: ${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  });

  app.post('/import/notes', async (req) => {
    const userId = requirePermission(req, 'use');
    const input = validate(importNotesSchema, req.query as Record<string, unknown>);

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      data.file.on('data', (chunk: Buffer) => chunks.push(chunk));
      data.file.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      data.file.on('error', reject);
    });

    const lines = content.split('\n');
    const titleMatch = lines[0].match(/^#\s+(.+)/);
    const bookTitle = titleMatch?.[1]?.trim();
    if (!bookTitle) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无法识别笔记标题（首行应为 # 书名）');

    const db = getDb();
    const matched = db
      .select({ id: books.id, title: books.title })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .all()
      .filter((b) => {
        const a = b.title.toLowerCase().replace(/\s+/g, '');
        const c = bookTitle.toLowerCase().replace(/\s+/g, '');
        return a.includes(c) || c.includes(a) || a === c;
      });

    if (input.dry_run === false && matched.length > 0) {
      return {
        data: {
          matched: true,
          matched_book_id: matched[0].id,
          matched_book_title: matched[0].title,
          note: '导入功能 S2 激活，当前仅识别匹配',
        },
      };
    }

    return {
      data: {
        parsed_title: bookTitle,
        candidates: matched.map((b) => ({ id: b.id, title: b.title })),
        note: input.dry_run ? '试运行完成' : '导入功能 S2 激活',
      },
    };
  });
}
