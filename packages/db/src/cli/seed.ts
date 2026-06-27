import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { createDatabase } from '../client';
import { bookTags, books, categories, statusHistory, tags, users } from '../schema';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(here, '..', '..', '..', '..');

function readRootEnv(): Record<string, string> {
  const envPath = join(monorepoRoot, '.env');
  if (!existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

function resolvePath(path: string): string {
  return isAbsolute(path) ? path : join(monorepoRoot, path);
}

function now(): string {
  return new Date().toISOString();
}

const rootEnv = readRootEnv();
const databaseUrl = resolvePath(process.env.DATABASE_URL ?? rootEnv.DATABASE_URL ?? './data/redesk.db');
const handle = createDatabase({ url: databaseUrl });
const db = handle.db;

const owner = db.select().from(users).limit(1).get();

if (!owner) {
  console.error('[redesk] 数据库中没有用户，请先完成初始化设置。');
  handle.close();
  process.exit(1);
}

const ownerId = owner.id;
const timestamp = now();
const existingBooks = db.select({ count: sql<number>`count(*)` }).from(books).get()?.count ?? 0;

const categorySeeds = ['工作能力提升', '文学作品', '哲学思想', '科学技术', '历史'];
const tagSeeds = ['方法论', '经典', '入门', '进阶', '必读', '精读', '泛读', '参考'];

function ensureCategory(name: string): number {
  const existing = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.owner_id, ownerId), eq(categories.name, name)))
    .get();

  if (existing) {
    return existing.id;
  }

  return db
    .insert(categories)
    .values({
      owner_id: ownerId,
      name,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning({ id: categories.id })
    .get().id;
}

function ensureTag(name: string): number {
  const existing = db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.owner_id, ownerId), eq(tags.name, name)))
    .get();

  if (existing) {
    return existing.id;
  }

  return db
    .insert(tags)
    .values({
      owner_id: ownerId,
      name,
      created_at: timestamp,
    })
    .returning({ id: tags.id })
    .get().id;
}

const categoryIds = new Map(categorySeeds.map((name) => [name, ensureCategory(name)]));
const tagIds = new Map(tagSeeds.map((name) => [name, ensureTag(name)]));

const sampleBooks = [
  {
    title: '如何阅读一本书',
    author: '莫提默·J. 艾德勒',
    isbn: '9787100040945',
    publisher: '商务印书馆',
    publish_year: 2004,
    description: '阅读方法经典，适合拿来验证评分、状态、标签与公开可见性。',
    language: 'zh',
    status: 'READ',
    visibility: 'PUBLIC',
    reading_purpose: '精读',
    rating: 5,
    category: '工作能力提升',
    tags: ['方法论', '入门', '必读'],
    custom_attributes: {
      shelf_location: 'A1-01',
      source: '线下购入',
      note: '适合作为阅读方法模板书',
    },
  },
  {
    title: '百年孤独',
    author: '加西亚·马尔克斯',
    isbn: '9787544253994',
    publisher: '南海出版公司',
    publish_year: 2011,
    description: '文学类示例，用来验证公共书籍、五星评分和经典标签展示。',
    language: 'zh',
    status: 'READ',
    visibility: 'PUBLIC',
    reading_purpose: '泛读',
    rating: 5,
    category: '文学作品',
    tags: ['经典', '必读'],
    custom_attributes: {
      shelf_location: 'B2-03',
      source: '朋友推荐',
    },
  },
  {
    title: '思考，快与慢',
    author: '丹尼尔·卡尼曼',
    isbn: '9787508633558',
    publisher: '中信出版社',
    publish_year: 2012,
    description: '在读示例，用来观察在读状态、未评分和私有可见性。',
    language: 'zh',
    status: 'READING',
    visibility: 'PRIVATE',
    reading_purpose: '精读',
    rating: null,
    category: '哲学思想',
    tags: ['方法论', '精读'],
    custom_attributes: {
      shelf_location: 'C1-02',
      reading_stage: '第 7 章',
      pace: '每周两章',
    },
  },
  {
    title: '深入理解计算机系统',
    author: 'Randal E. Bryant',
    isbn: '9787111544937',
    publisher: '机械工业出版社',
    publish_year: 2016,
    description: '技术类在读示例，适合测试长标题与英文作者混排。',
    language: 'zh',
    status: 'READING',
    visibility: 'PRIVATE',
    reading_purpose: '参考',
    rating: 4,
    category: '科学技术',
    tags: ['进阶', '参考'],
    custom_attributes: {
      shelf_location: 'D3-06',
      edition: '第三版',
      related_skill: '系统基础',
    },
  },
  {
    title: '万历十五年',
    author: '黄仁宇',
    isbn: '9787108009821',
    publisher: '生活·读书·新知三联书店',
    publish_year: 1997,
    description: '历史类已读示例，用来拉开出版年与书架属性层次。',
    language: 'zh',
    status: 'READ',
    visibility: 'PUBLIC',
    reading_purpose: '泛读',
    rating: 4,
    category: '历史',
    tags: ['经典', '必读'],
    custom_attributes: {
      shelf_location: 'E2-04',
      source: '旧书市场',
    },
  },
  {
    title: '人月神话',
    author: 'Frederick P. Brooks Jr.',
    isbn: '9787302392644',
    publisher: '清华大学出版社',
    publish_year: 2015,
    description: '计划读示例，用来验证待办感和书架概览统计。',
    language: 'zh',
    status: 'PLANNED',
    visibility: 'PRIVATE',
    reading_purpose: '精读',
    rating: null,
    category: '科学技术',
    tags: ['方法论', '经典', '必读'],
    custom_attributes: {
      shelf_location: 'D1-08',
      queue_reason: '准备重构前先复习项目管理经验',
    },
  },
  {
    title: '活着',
    author: '余华',
    isbn: '9787532127377',
    publisher: '上海文艺出版社',
    publish_year: 2004,
    description: '文学类公开示例，用来丰富书架封面首字和状态分布。',
    language: 'zh',
    status: 'READ',
    visibility: 'PUBLIC',
    reading_purpose: '泛读',
    rating: 5,
    category: '文学作品',
    tags: ['经典', '必读', '泛读'],
    custom_attributes: {
      shelf_location: 'B3-01',
    },
  },
  {
    title: '原则',
    author: '瑞·达利欧',
    isbn: '9787508684031',
    publisher: '中信出版社',
    publish_year: 2018,
    description: '收录未读示例，用来测试默认状态与卡片摘要。',
    language: 'zh',
    status: 'COLLECTED',
    visibility: 'PRIVATE',
    reading_purpose: '精读',
    rating: null,
    category: '工作能力提升',
    tags: ['方法论', '入门'],
    custom_attributes: {
      shelf_location: 'A3-02',
      source: '电子书同步',
    },
  },
  {
    title: '苏菲的世界',
    author: '乔斯坦·贾德',
    isbn: '9787506341271',
    publisher: '作家出版社',
    publish_year: 2007,
    description: '存档示例，验证“存”与删除完全不同的展示路径。',
    language: 'zh',
    status: 'STORED',
    visibility: 'PRIVATE',
    reading_purpose: '泛读',
    rating: 3,
    category: '哲学思想',
    tags: ['入门', '泛读'],
    custom_attributes: {
      shelf_location: 'C4-09',
      archived_reason: '读完后保留作复习材料',
    },
  },
  {
    title: '人类简史',
    author: '尤瓦尔·赫拉利',
    isbn: '9787508647357',
    publisher: '中信出版社',
    publish_year: 2014,
    description: '跨学科历史类示例，适合观察多标签和公开书籍混排。',
    language: 'zh',
    status: 'READ',
    visibility: 'PUBLIC',
    reading_purpose: '泛读',
    rating: 4,
    category: '历史',
    tags: ['经典', '必读', '泛读'],
    custom_attributes: {
      shelf_location: 'E1-06',
      source: '年度书单',
    },
  },
] as const;

let createdCount = 0;
let updatedCount = 0;

for (const sampleBook of sampleBooks) {
  const existing = db
    .select({ id: books.id, status: books.status })
    .from(books)
    .where(
      and(
        eq(books.owner_id, ownerId),
        eq(books.title, sampleBook.title),
        eq(books.author, sampleBook.author),
      ),
    )
    .get();

  const bookPayload = {
    owner_id: ownerId,
    category_id: categoryIds.get(sampleBook.category) ?? null,
    title: sampleBook.title,
    author: sampleBook.author,
    isbn: sampleBook.isbn,
    publisher: sampleBook.publisher,
    publish_year: sampleBook.publish_year,
    description: sampleBook.description,
    language: sampleBook.language,
    status: sampleBook.status,
    visibility: sampleBook.visibility,
    reading_purpose: sampleBook.reading_purpose,
    rating: sampleBook.rating,
    custom_attributes: JSON.stringify(sampleBook.custom_attributes),
    metadata_source: 'manual',
    updated_at: timestamp,
  };

  const bookId =
    existing?.id ??
    db
      .insert(books)
      .values({
        ...bookPayload,
        created_at: timestamp,
      })
      .returning({ id: books.id })
      .get().id;

  if (existing) {
    db.update(books).set(bookPayload).where(eq(books.id, bookId)).run();
    updatedCount += 1;
  } else {
    createdCount += 1;
  }

  db.delete(bookTags).where(eq(bookTags.book_id, bookId)).run();

  for (const tagName of sampleBook.tags) {
    const tagId = tagIds.get(tagName);
    if (!tagId) {
      continue;
    }

    db.insert(bookTags)
      .values({
        book_id: bookId,
        tag_id: tagId,
        created_at: timestamp,
      })
      .run();
  }

  if (!existing) {
    db.insert(statusHistory)
      .values({
        book_id: bookId,
        from_status: null,
        to_status: sampleBook.status,
        changed_at: timestamp,
      })
      .run();
  } else if (existing.status !== sampleBook.status) {
    db.insert(statusHistory)
      .values({
        book_id: bookId,
        from_status: existing.status,
        to_status: sampleBook.status,
        changed_at: timestamp,
      })
      .run();
  }
}

console.log(
  `[redesk] 本地示例书籍处理完成：新增 ${createdCount} 本，更新 ${updatedCount} 本。当前数据库原有书籍总数 ${existingBooks}。`,
);
handle.close();
