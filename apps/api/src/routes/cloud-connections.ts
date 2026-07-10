import type { FastifyInstance } from 'fastify';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { bookCovers, bookFiles, books, cloudConnections, cloudNoteSnapshots, cloudUsageAssignments, CLOUD_USAGES, notes, type CloudConnectionType } from '@redesk/db';
import { createCloudConnectionSchema, updateCloudAssignmentsSchema, updateCloudConnectionSchema } from '@redesk/shared';
import { getDb } from '../db';
import { getSqlite } from '../db';
import { requireAdmin, requireUserId } from '../lib/auth';
import { AppError, businessError, notFound } from '../lib/errors';
import { validate } from '../lib/zod';
import { S3Storage } from '../lib/s3-storage';
import { WebDavStorage } from '../lib/webdav-storage';
import { randomStorageToken } from '../lib/storage-debug';
import { refreshStorage } from '../lib/storage-factory';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config';

const SINGLE_TARGET_USAGES = new Set(['book_files', 'covers', 'notes']);

function now(): string { return new Date().toISOString(); }

function parseConfig(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function redactConfig(type: CloudConnectionType, raw: string): Record<string, unknown> {
  const config = parseConfig(raw);
  if (type === 's3') return { ...config, access_key: config.access_key ? '已保存' : null, secret_key: config.secret_key ? '已保存' : null };
  return { ...config, password: config.password ? '已保存' : null };
}

function serializeConnection(row: typeof cloudConnections.$inferSelect) {
  return { ...row, config: redactConfig(row.type, row.config) };
}

function createStorage(type: CloudConnectionType, config: Record<string, unknown>) {
  if (type === 's3') {
    return new S3Storage({
      endpoint: String(config.endpoint ?? ''), region: String(config.region ?? 'auto'), bucket: String(config.bucket ?? ''),
      accessKeyId: String(config.access_key ?? ''), secretAccessKey: String(config.secret_key ?? ''),
      publicUrlBase: typeof config.public_url === 'string' && config.public_url ? config.public_url : undefined, forcePathStyle: true,
    });
  }
  return new WebDavStorage({ url: String(config.url ?? ''), username: typeof config.username === 'string' ? config.username : null, password: String(config.password ?? ''), basePath: typeof config.base_path === 'string' ? config.base_path : null });
}

function getOwnedConnection(id: number, ownerId: number) {
  const row = getDb().select().from(cloudConnections).where(and(eq(cloudConnections.id, id), eq(cloudConnections.owner_id, ownerId))).get();
  if (!row) throw notFound('云连接不存在');
  return row;
}

export async function cloudConnectionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cloud-connections', async (req) => {
    const ownerId = requireUserId(req);
    const rows = getDb().select().from(cloudConnections).where(eq(cloudConnections.owner_id, ownerId)).orderBy(asc(cloudConnections.created_at)).all();
    return { data: rows.map(serializeConnection), limit: 5 };
  });

  app.post('/cloud-connections', async (req) => {
    const ownerId = requireUserId(req);
    const input = validate(createCloudConnectionSchema, req.body);
    const db = getDb();
    const count = db.select({ id: cloudConnections.id }).from(cloudConnections).where(eq(cloudConnections.owner_id, ownerId)).all().length;
    if (count >= 5) throw businessError('最多只能保存 5 个云连接');
    const timestamp = now();
    const created = db.insert(cloudConnections).values({ owner_id: ownerId, name: input.name, type: input.type, config: JSON.stringify(input.config), is_active: true, created_at: timestamp, updated_at: timestamp }).returning().get();
    refreshStorage();
    return { data: serializeConnection(created) };
  });

  app.patch('/cloud-connections/:id', async (req) => {
    const ownerId = requireUserId(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', '无效的云连接 ID');
    const input = validate(updateCloudConnectionSchema, req.body);
    const current = getOwnedConnection(id, ownerId);
    if (input.config && current.type === 's3' && !('endpoint' in input.config && 'bucket' in input.config && 'access_key' in input.config && 'secret_key' in input.config)) throw businessError('S3 连接配置不完整');
    if (input.config && current.type === 'webdav' && !('url' in input.config && 'password' in input.config)) throw businessError('WebDAV 连接配置不完整');
    const updated = getDb().update(cloudConnections).set({ name: input.name, is_active: input.is_active, config: input.config ? JSON.stringify(input.config) : undefined, updated_at: now() }).where(eq(cloudConnections.id, id)).returning().get();
    refreshStorage();
    return { data: serializeConnection(updated) };
  });

  app.post('/cloud-connections/:id/test', async (req) => {
    const ownerId = requireUserId(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', '无效的云连接 ID');
    const connection = getOwnedConnection(id, ownerId);
    const storage = createStorage(connection.type, parseConfig(connection.config));
    const key = `__redesk_probe__/${Date.now()}_${randomStorageToken()}.txt`;
    const body = Buffer.from(`redesk-cloud-probe-${Date.now()}`);
    try {
      await storage.putBytes(key, body, { contentType: 'text/plain' });
      const readBack = await storage.getBytes(key);
      if (!readBack.equals(body)) throw businessError('云连接回读校验失败');
      await storage.delete(key);
      const testedAt = now();
      getDb().update(cloudConnections).set({ tested_at: testedAt, updated_at: testedAt }).where(eq(cloudConnections.id, id)).run();
      return { data: { ok: true, tested_at: testedAt } };
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      throw businessError(error instanceof Error ? `连接测试失败：${error.message}` : '连接测试失败');
    }
  });

  app.post('/cloud-connections/:id/toggle', async (req) => {
    const ownerId = requireUserId(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', '无效的云连接 ID');
    const current = getOwnedConnection(id, ownerId);
    const updated = getDb().update(cloudConnections).set({ is_active: !current.is_active, updated_at: now() }).where(eq(cloudConnections.id, id)).returning().get();
    refreshStorage();
    return { data: serializeConnection(updated) };
  });

  app.delete('/cloud-connections/:id', async (req) => {
    const ownerId = requireUserId(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new AppError('VALIDATION_ERROR', '无效的云连接 ID');
    getOwnedConnection(id, ownerId);
    const assigned = getDb().select({ id: cloudUsageAssignments.id }).from(cloudUsageAssignments).where(and(eq(cloudUsageAssignments.owner_id, ownerId), eq(cloudUsageAssignments.connection_id, id))).get();
    const file = getDb().select({ id: bookFiles.id }).from(bookFiles).where(and(eq(bookFiles.owner_id, ownerId), eq(bookFiles.connection_id, id))).get();
    const cover = getDb().select({ id: bookCovers.id }).from(bookCovers).where(and(eq(bookCovers.owner_id, ownerId), eq(bookCovers.connection_id, id))).get();
    const snapshot = getDb().select({ id: cloudNoteSnapshots.id }).from(cloudNoteSnapshots).where(and(eq(cloudNoteSnapshots.owner_id, ownerId), eq(cloudNoteSnapshots.connection_id, id))).get();
    if (assigned || file || cover || snapshot) throw businessError('该连接仍被数据路由或文件引用，请先迁移或解除引用后再删除');
    getDb().delete(cloudConnections).where(eq(cloudConnections.id, id)).run();
    refreshStorage();
    return { data: { id, deleted: true } };
  });

  app.get('/cloud-assignments', async (req) => {
    const ownerId = requireUserId(req);
    const rows = getDb().select().from(cloudUsageAssignments).where(eq(cloudUsageAssignments.owner_id, ownerId)).orderBy(asc(cloudUsageAssignments.usage), asc(cloudUsageAssignments.priority)).all();
    return { data: rows };
  });

  app.put('/cloud-assignments', async (req) => {
    const ownerId = requireUserId(req);
    const input = validate(updateCloudAssignmentsSchema, req.body);
    const ids = input.assignments.flatMap((assignment) => assignment.connection_ids);
    const active = ids.length === 0 ? [] : getDb().select({ id: cloudConnections.id }).from(cloudConnections).where(and(eq(cloudConnections.owner_id, ownerId), eq(cloudConnections.is_active, true), inArray(cloudConnections.id, ids))).all();
    if (active.length !== new Set(ids).size) throw businessError('用途只能分配给当前用户已启用的云连接');
    for (const assignment of input.assignments) if (SINGLE_TARGET_USAGES.has(assignment.usage) && assignment.connection_ids.length > 1) throw businessError(`${assignment.usage} 当前只支持一个目标连接`);
    const db = getDb();
    db.transaction((tx) => {
      tx.delete(cloudUsageAssignments).where(eq(cloudUsageAssignments.owner_id, ownerId)).run();
      for (const assignment of input.assignments) assignment.connection_ids.forEach((connectionId, priority) => tx.insert(cloudUsageAssignments).values({ owner_id: ownerId, usage: assignment.usage, connection_id: connectionId, priority, created_at: now() }).run());
    });
    refreshStorage();
    return { data: CLOUD_USAGES.map((usage) => ({ usage, connection_ids: input.assignments.find((item) => item.usage === usage)?.connection_ids ?? [] })) };
  });

  app.post('/cloud-sync/notes/snapshot', async (req) => {
    const ownerId = requireUserId(req);
    const assignments = getDb().select({ connection_id: cloudUsageAssignments.connection_id, type: cloudConnections.type, config: cloudConnections.config })
      .from(cloudUsageAssignments)
      .innerJoin(cloudConnections, eq(cloudUsageAssignments.connection_id, cloudConnections.id))
      .where(and(eq(cloudUsageAssignments.owner_id, ownerId), eq(cloudUsageAssignments.usage, 'notes'), eq(cloudConnections.is_active, true)))
      .orderBy(asc(cloudUsageAssignments.priority)).all();
    const target = assignments[0];
    if (!target) throw businessError('请先在存储页面为笔记快照分配一个已启用的云连接');

    const rows = getDb().select({ id: notes.id, book_id: notes.book_id, title: notes.title, content_markdown: notes.content_markdown, content_html: notes.content_html, cfi: notes.cfi, mark_type: notes.mark_type, created_at: notes.created_at, updated_at: notes.updated_at, book_title: books.title, book_author: books.author })
      .from(notes).innerJoin(books, eq(notes.book_id, books.id))
      .where(and(eq(notes.owner_id, ownerId), eq(books.owner_id, ownerId), isNull(notes.deleted_at), isNull(books.deleted_at))).all();
    const exportedAt = now();
    const payload = { format_version: 1, exported_at: exportedAt, note_count: rows.length, notes: rows };
    const markdown = rows.map((note) => [
      `# ${note.title || note.book_title || '未命名笔记'}`,
      '',
      `- 书籍：${note.book_title}${note.book_author ? ` / ${note.book_author}` : ''}`,
      `- 更新时间：${note.updated_at}`,
      note.cfi ? `- 阅读位置：${note.cfi}` : '',
      '',
      note.content_markdown || note.content_html || '',
      '',
    ].filter(Boolean).join('\n')).join('\n---\n\n');
    const storage = createStorage(target.type, parseConfig(target.config));
    const assets = [
      { format: 'json' as const, key: 'notes/snapshots/redesk-notes.json', body: Buffer.from(JSON.stringify(payload, null, 2)), contentType: 'application/json' },
      { format: 'markdown' as const, key: 'notes/snapshots/redesk-notes.md', body: Buffer.from(markdown), contentType: 'text/markdown; charset=utf-8' },
    ];
    for (const asset of assets) {
      await storage.putBytes(asset.key, asset.body, { contentType: asset.contentType });
      const checksum = createHash('sha256').update(asset.body).digest('hex');
      const existing = getDb().select({ id: cloudNoteSnapshots.id }).from(cloudNoteSnapshots).where(and(eq(cloudNoteSnapshots.owner_id, ownerId), eq(cloudNoteSnapshots.connection_id, target.connection_id), eq(cloudNoteSnapshots.format, asset.format))).get();
      const values = { remote_key: asset.key, checksum, note_count: rows.length, generated_at: exportedAt, sync_status: 'synced' as const, error_message: null };
      if (existing) getDb().update(cloudNoteSnapshots).set(values).where(eq(cloudNoteSnapshots.id, existing.id)).run();
      else getDb().insert(cloudNoteSnapshots).values({ owner_id: ownerId, connection_id: target.connection_id, format: asset.format, ...values }).run();
    }
    return { data: { connection_id: target.connection_id, exported_at: exportedAt, note_count: rows.length, formats: assets.map((asset) => ({ format: asset.format, remote_key: asset.key })) } };
  });

  app.post('/cloud-backup/database', async (req) => {
    const ownerId = requireAdmin(req);
    const targets = getDb().select({ connection_id: cloudUsageAssignments.connection_id, type: cloudConnections.type, config: cloudConnections.config, name: cloudConnections.name })
      .from(cloudUsageAssignments).innerJoin(cloudConnections, eq(cloudUsageAssignments.connection_id, cloudConnections.id))
      .where(and(eq(cloudUsageAssignments.owner_id, ownerId), eq(cloudUsageAssignments.usage, 'backup_db'), eq(cloudConnections.is_active, true)))
      .orderBy(asc(cloudUsageAssignments.priority)).all();
    if (targets.length === 0) throw businessError('请先在存储页面为数据库备份分配至少一个已启用的云连接');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = join(config.storageDir, 'tmp');
    const localPath = join(dir, `cloud-backup-${stamp}.db`);
    await mkdir(dir, { recursive: true });
    const escaped = localPath.replace(/\\/g, '/').replace(/'/g, "''");
    try {
      getSqlite().exec(`VACUUM INTO '${escaped}'`);
      const bytes = await readFile(localPath);
      const key = `backups/database/redesk-${stamp}.db`;
      const completed: Array<{ connection_id: number; connection_name: string; remote_key: string }> = [];
      const failed: Array<{ connection_id: number; connection_name: string; message: string }> = [];
      for (const target of targets) {
        try {
          await createStorage(target.type, parseConfig(target.config)).putBytes(key, bytes, { contentType: 'application/vnd.sqlite3' });
          completed.push({ connection_id: target.connection_id, connection_name: target.name, remote_key: key });
        } catch (error) { failed.push({ connection_id: target.connection_id, connection_name: target.name, message: error instanceof Error ? error.message : '上传失败' }); }
      }
      return { data: { size_bytes: bytes.length, completed, failed } };
    } finally { await rm(localPath, { force: true }); }
  });
}
