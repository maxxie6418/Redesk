import type { FastifyInstance } from 'fastify';
import { and, eq, count, asc } from 'drizzle-orm';
import { books, categories } from '@redesk/db';
import { ERROR_CODE, createCategorySchema, updateCategorySchema, categoryQuerySchema } from '@redesk/shared';
import type { CategoryQueryInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', async (req) => {
    const userId = requireUserId(req);
    const input = validate(categoryQuerySchema, req.query) as CategoryQueryInput;
    const db = getDb();

    const conditions = [eq(categories.owner_id, userId)];
    if (input.type) {
      conditions.push(eq(categories.type, input.type) as ReturnType<typeof eq>);
    }

    const rows = db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(asc(categories.sort_order), asc(categories.name))
      .all();

    const categoryIds = rows.map((c) => c.id);
    const bookCounts = new Map<number, number>();

    if (categoryIds.length > 0) {
      for (const catId of categoryIds) {
        const personalCount = db
          .select({ c: count() })
          .from(books)
          .where(and(eq(books.owner_id, userId), eq(books.category_id, catId)))
          .get();
        const genreCount = db
          .select({ c: count() })
          .from(books)
          .where(and(eq(books.owner_id, userId), eq(books.genre_category_id, catId)))
          .get();
        bookCounts.set(catId, (personalCount?.c ?? 0) + (genreCount?.c ?? 0));
      }
    }

    const data = rows.map((cat) => ({
      ...cat,
      book_count: bookCounts.get(cat.id) ?? 0,
    }));

    return { data };
  });

  app.post('/categories', async (req) => {
    const userId = requireUserId(req);
    const input = validate(createCategorySchema, req.body);
    const db = getDb();
    const timestamp = now();
    const catType = input.type ?? 'PERSONAL';

    const existing = db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.owner_id, userId), eq(categories.name, input.name), eq(categories.type, catType)))
      .get();

    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, `分类 "${input.name}" 已存在`);
    }

    const category = db
      .insert(categories)
      .values({
        owner_id: userId,
        name: input.name,
        type: catType,
        parent_id: input.parent_id ?? null,
        sort_order: input.sort_order ?? 0,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning()
      .get();

    return { data: { ...category, book_count: 0 } };
  });

  app.patch('/categories/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const categoryId = Number(id);

    if (Number.isNaN(categoryId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的分类 ID');
    }

    const input = validate(updateCategorySchema, req.body);
    const db = getDb();

    const existing = db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('分类不存在');
    }

    if (input.name !== undefined && input.name !== existing.name) {
      const dupConditions = [
        eq(categories.owner_id, userId),
        eq(categories.name, input.name),
      ] as ReturnType<typeof eq>[];
      if (input.type !== undefined) {
        dupConditions.push(eq(categories.type, input.type) as ReturnType<typeof eq>);
      } else {
        dupConditions.push(eq(categories.type, existing.type) as ReturnType<typeof eq>);
      }
      const duplicate = db
        .select({ id: categories.id })
        .from(categories)
        .where(and(...dupConditions))
        .get();

      if (duplicate) {
        throw new AppError(ERROR_CODE.CONFLICT, `分类 "${input.name}" 已存在`);
      }
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

    db.update(categories).set(updateData).where(eq(categories.id, categoryId)).run();

    const updated = db.select().from(categories).where(eq(categories.id, categoryId)).get();
    if (!updated) {
      throw notFound('分类不存在');
    }

    const bookCountResult = db
      .select({ c: count() })
      .from(books)
      .where(and(eq(books.owner_id, userId), eq(books.category_id, categoryId)))
      .get();

    return { data: { ...updated, book_count: bookCountResult?.c ?? 0 } };
  });

  app.delete('/categories/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const categoryId = Number(id);

    if (Number.isNaN(categoryId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的分类 ID');
    }

    const db = getDb();

    const existing = db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('分类不存在');
    }

    db.update(books)
      .set({ category_id: null, updated_at: now() })
      .where(and(eq(books.owner_id, userId), eq(books.category_id, categoryId)))
      .run();

    db.update(books)
      .set({ genre_category_id: null, updated_at: now() })
      .where(and(eq(books.owner_id, userId), eq(books.genre_category_id, categoryId)))
      .run();

    db.delete(categories).where(eq(categories.id, categoryId)).run();

    return { data: { id: categoryId, deleted: true } };
  });
}
