import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { extname } from 'node:path';
import { and, eq, isNull, sql, asc } from 'drizzle-orm';
import { books, bookFiles, bookTags, tags } from '@redesk/db';
import { getDb } from '../db';
import { getStorageByDriver } from '../lib/storage-factory';
import { buildContentDisposition } from './files';

interface BookRow {
  id: number;
  title: string;
  author: string | null;
  description: string | null;
  status: string;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
}

interface FileRow {
  id: number;
  mime_type: string | null;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function opdsFeed(id: string, title: string, entries: string, selfHref: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>${escapeXml(id)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${new Date().toISOString()}</updated>
  <link rel="self" href="${escapeXml(selfHref)}" type="application/atom+xml"/>
  <link rel="start" href="/opds/catalog" type="application/atom+xml"/>
${entries}
</feed>`;
}

function opdsEntry(book: BookRow, primaryFile: FileRow | null): string {
  const coverHref = `/api/v1/books/${book.id}/cover`;
  const downloadHref = primaryFile ? `/opds/acquisition/${primaryFile.id}` : '';
  const mime = primaryFile?.mime_type ?? 'application/epub+zip';

  return `  <entry>
    <id>urn:redesk:book:${book.id}</id>
    <title>${escapeXml(book.title)}</title>
    <author><name>${escapeXml(book.author || '未知')}</name></author>
    <updated>${book.updated_at}</updated>
    <published>${book.created_at}</published>
    <summary>${escapeXml(book.description || '')}</summary>
    <link rel="http://opds-spec.org/image" href="${coverHref}" type="image/jpeg"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="${coverHref}" type="image/jpeg"/>
${downloadHref ? `    <link rel="http://opds-spec.org/acquisition" href="${downloadHref}" type="${escapeXml(mime)}"/>` : ''}
    <category term="${escapeXml(book.status)}" label="${escapeXml(book.status)}"/>
  </entry>`;
}

async function opdsAuth(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="Redesk OPDS"');
    reply.code(401).send('Unauthorized');
    return null;
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    reply.code(401).send('Unauthorized');
    return null;
  }

  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  const db = getDb();
  const { users } = await import('@redesk/db');
  const { verifyPassword } = await import('../lib/auth');

  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    reply.code(401).send('Unauthorized');
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    reply.code(401).send('Unauthorized');
    return null;
  }

  return user.id;
}

export async function opdsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/opds/catalog', async (req, reply) => {
    const userId = await opdsAuth(req, reply);
    if (userId === null) return;

    reply.header('Content-Type', 'application/atom+xml; charset=utf-8');

    const navLinks = `
  <link rel="subsection" href="/opds/by-status?status=READING" title="在读" type="application/atom+xml"/>
  <link rel="subsection" href="/opds/by-status?status=PLANNED" title="计划读" type="application/atom+xml"/>
  <link rel="subsection" href="/opds/by-status?status=READ" title="已读" type="application/atom+xml"/>
  <link rel="subsection" href="/opds/by-status?status=COLLECTED" title="存书" type="application/atom+xml"/>
  <link rel="subsection" href="/opds/search" title="搜索" type="application/atom+xml;profile=opds-catalog"/>`;

    return opdsFeed('redesk:catalog', 'Redesk 书架', navLinks, '/opds/catalog');
  });

  app.get('/opds/by-status', async (req, reply) => {
    const userId = await opdsAuth(req, reply);
    if (userId === null) return;

    const { status } = req.query as { status?: string };
    if (!status) {
      reply.code(400).send('Missing status parameter');
      return;
    }

    const db = getDb();
    const bookRows = db
      .select()
      .from(books)
      .where(and(eq(books.owner_id, userId), eq(books.status, status), isNull(books.deleted_at)))
      .orderBy(asc(books.title))
      .all();

    const entries = bookRows.map((b) => {
      const pf = db
        .select()
        .from(bookFiles)
        .where(and(eq(bookFiles.book_id, b.id), eq(bookFiles.is_primary, 1)))
        .get() ?? null;
      return opdsEntry(b, pf);
    });

    reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
    return opdsFeed(`redesk:status:${status}`, `Redesk - ${status}`, entries.join('\n'), `/opds/by-status?status=${status}`);
  });

  app.get('/opds/acquisition/:fileId', async (req, reply) => {
    const userId = await opdsAuth(req, reply);
    if (userId === null) return;

    const { fileId: fileIdParam } = req.params as { fileId: string };
    const fileId = Number(fileIdParam);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      reply.code(400).send('Invalid file id');
      return;
    }

    const db = getDb();
    const row = db
      .select({
        id: bookFiles.id,
        local_path: bookFiles.local_path,
        remote_key: bookFiles.remote_key,
        primary_location: bookFiles.primary_location,
        original_filename: bookFiles.original_filename,
        mime_type: bookFiles.mime_type,
      })
      .from(bookFiles)
      .innerJoin(books, eq(bookFiles.book_id, books.id))
      .where(and(eq(bookFiles.id, fileId), eq(books.owner_id, userId), isNull(books.deleted_at)))
      .get();

    if (!row) {
      reply.code(404).send('File not found');
      return;
    }

    const candidates = row.primary_location === 'cloud'
      ? [
          { driver: 's3' as const, key: row.remote_key },
          { driver: 'local' as const, key: row.local_path },
        ]
      : [
          { driver: 'local' as const, key: row.local_path },
          { driver: 's3' as const, key: row.remote_key },
        ];
    for (const candidate of candidates) {
      if (!candidate.key) continue;
      const storage = getStorageByDriver(candidate.driver);
      const exists = await storage.exists(candidate.key).catch(() => false);
      if (!exists) continue;
      const stream = await storage.getStream(candidate.key);
      return reply
        .header('Content-Type', row.mime_type ?? 'application/octet-stream')
        .header('Content-Disposition', buildContentDisposition(row.original_filename ?? `book${extname(candidate.key)}`))
        .send(stream);
    }

    reply.code(404).send('File not found');
  });

  app.get('/opds/by-tag', async (req, reply) => {
    const userId = await opdsAuth(req, reply);
    if (userId === null) return;

    const { tag } = req.query as { tag?: string };
    if (!tag) {
      reply.code(400).send('Missing tag parameter');
      return;
    }

    const db = getDb();
    const tagRow = db.select().from(tags).where(and(eq(tags.owner_id, userId), eq(tags.name, tag))).get();
    if (!tagRow) {
      reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
      return opdsFeed('redesk:tag:empty', `Redesk - 标签: ${tag}`, '', `/opds/by-tag?tag=${encodeURIComponent(tag)}`);
    }

    const btRows = db.select().from(bookTags).where(eq(bookTags.tag_id, tagRow.id)).all();
    const bookIds = btRows.map((bt) => bt.book_id);

    const bookRows = bookIds.length > 0
      ? db.select().from(books)
          .where(and(eq(books.owner_id, userId), isNull(books.deleted_at), sql`${books.id} IN (${bookIds.join(',')})`))
          .orderBy(asc(books.title))
          .all()
      : [];

    const entries = bookRows.map((b) => {
      const pf = db.select().from(bookFiles).where(and(eq(bookFiles.book_id, b.id), eq(bookFiles.is_primary, 1))).get() ?? null;
      return opdsEntry(b, pf);
    });

    reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
    return opdsFeed(`redesk:tag:${tag}`, `Redesk - 标签: ${tag}`, entries.join('\n'), `/opds/by-tag?tag=${encodeURIComponent(tag)}`);
  });

  app.get('/opds/search', async (req, reply) => {
    const userId = await opdsAuth(req, reply);
    if (userId === null) return;

    const { q } = req.query as { q?: string };

    if (!q) {
      reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
      const openSearch = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Redesk Search</ShortName>
  <Description>Search Redesk bookshelf</Description>
  <Url type="application/atom+xml" template="/opds/search?q={searchTerms}"/>
</OpenSearchDescription>`;
      return openSearch;
    }

    const db = getDb();
    const bookRows = db
      .select()
      .from(books)
      .where(and(
        eq(books.owner_id, userId),
        isNull(books.deleted_at),
        sql`${books.title} LIKE '%' || ${q} || '%' OR ${books.author} LIKE '%' || ${q} || '%'`,
      ))
      .orderBy(asc(books.title))
      .all();

    const entries = bookRows.map((b) => {
      const pf = db.select().from(bookFiles).where(and(eq(bookFiles.book_id, b.id), eq(bookFiles.is_primary, 1))).get() ?? null;
      return opdsEntry(b, pf);
    });

    reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
    return opdsFeed(`redesk:search:${q}`, `Redesk 搜索: ${q}`, entries.join('\n'), `/opds/search?q=${encodeURIComponent(q)}`);
  });
}
