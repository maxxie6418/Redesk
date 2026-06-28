import type { FastifyInstance } from 'fastify';
import { and, eq, count, asc } from 'drizzle-orm';
import { bookTags, books, tags } from '@redesk/db';
import { ERROR_CODE, createTagSchema, updateTagSchema } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tags', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const rows = db
      .select()
      .from(tags)
      .where(eq(tags.owner_id, userId))
      .orderBy(asc(tags.name))
      .all();

    const tagIds = rows.map((t) => t.id);
    const bookCounts = new Map<number, number>();

    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        const result = db
          .select({ c: count() })
          .from(bookTags)
          .innerJoin(books, eq(bookTags.book_id, books.id))
          .where(and(eq(books.owner_id, userId), eq(bookTags.tag_id, tagId)))
          .get();
        bookCounts.set(tagId, result?.c ?? 0);
      }
    }

    const data = rows.map((tag) => ({
      ...tag,
      book_count: bookCounts.get(tag.id) ?? 0,
    }));

    return { data };
  });

  app.post('/tags', async (req) => {
    const userId = requireUserId(req);
    const input = validate(createTagSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const existing = db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.owner_id, userId), eq(tags.name, input.name)))
      .get();

    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, `标签 "${input.name}" 已存在`);
    }

    const tag = db
      .insert(tags)
      .values({
        owner_id: userId,
        name: input.name,
        created_at: timestamp,
      })
      .returning()
      .get();

    return { data: { ...tag, book_count: 0 } };
  });

  app.patch('/tags/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const tagId = Number(id);

    if (Number.isNaN(tagId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的标签 ID');
    }

    const input = validate(updateTagSchema, req.body);
    const db = getDb();

    const existing = db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('标签不存在');
    }

    if (input.name !== existing.name) {
      const duplicate = db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.owner_id, userId), eq(tags.name, input.name)))
        .get();

      if (duplicate) {
        throw new AppError(ERROR_CODE.CONFLICT, `标签 "${input.name}" 已存在`);
      }
    }

    db.update(tags).set({ name: input.name }).where(eq(tags.id, tagId)).run();

    const updated = db.select().from(tags).where(eq(tags.id, tagId)).get();
    if (!updated) {
      throw notFound('标签不存在');
    }

    const bookCountResult = db
      .select({ c: count() })
      .from(bookTags)
      .innerJoin(books, eq(bookTags.book_id, books.id))
      .where(and(eq(books.owner_id, userId), eq(bookTags.tag_id, tagId)))
      .get();

    return { data: { ...updated, book_count: bookCountResult?.c ?? 0 } };
  });

  app.delete('/tags/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const tagId = Number(id);

    if (Number.isNaN(tagId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的标签 ID');
    }

    const db = getDb();

    const existing = db
      .select()
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('标签不存在');
    }

    db.delete(bookTags).where(eq(bookTags.tag_id, tagId)).run();
    db.delete(tags).where(eq(tags.id, tagId)).run();

    return { data: { id: tagId, deleted: true } };
  });
}
