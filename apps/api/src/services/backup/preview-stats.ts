import { and, count, eq, isNull, sql } from 'drizzle-orm';
import {
  bookCovers,
  bookFiles,
  bookRelations,
  bookmarks,
  books,
  categories,
  highlights,
  notes,
  readingProgress,
  settings,
  tags,
  topicBooks,
  topicEntries,
  topicHighlights,
  topicNotes,
  topicSegments,
  topics,
  users,
  type AppDatabase,
} from '@redesk/db';
import type { BackupModuleId } from '@redesk/shared';
import type { BackupPreviewStats } from './preview';

export function collectBackupPreviewStats(db: AppDatabase, ownerId: number, databaseSizeBytes = 0): BackupPreviewStats {
  const settingsCount = db
    .select({ value: count() })
    .from(settings)
    .where(eq(settings.owner_id, ownerId))
    .get()?.value ?? 0;
  const userCount = db.select({ value: count() }).from(users).get()?.value ?? 0;
  const bookCount = db
    .select({ value: count() })
    .from(books)
    .where(and(eq(books.owner_id, ownerId), isNull(books.deleted_at)))
    .get()?.value ?? 0;
  const categoryCount = db
    .select({ value: count() })
    .from(categories)
    .where(eq(categories.owner_id, ownerId))
    .get()?.value ?? 0;
  const tagCount = db
    .select({ value: count() })
    .from(tags)
    .where(eq(tags.owner_id, ownerId))
    .get()?.value ?? 0;
  const relationCount = db
    .select({ value: count() })
    .from(bookRelations)
    .innerJoin(books, eq(books.id, bookRelations.source_book_id))
    .where(and(eq(books.owner_id, ownerId), isNull(books.deleted_at)))
    .get()?.value ?? 0;
  const bookFileCount = db
    .select({ value: count() })
    .from(bookFiles)
    .where(eq(bookFiles.owner_id, ownerId))
    .get()?.value ?? 0;
  const coverCount = db
    .select({ value: count() })
    .from(bookCovers)
    .where(eq(bookCovers.owner_id, ownerId))
    .get()?.value ?? 0;
  const bookBlobSize = db
    .select({ value: sql<number>`coalesce(sum(${bookFiles.file_size}), 0)` })
    .from(bookFiles)
    .where(eq(bookFiles.owner_id, ownerId))
    .get()?.value ?? 0;
  const coverBlobSize = db
    .select({ value: sql<number>`coalesce(sum(${bookCovers.file_size}), 0)` })
    .from(bookCovers)
    .where(eq(bookCovers.owner_id, ownerId))
    .get()?.value ?? 0;
  const progressCount = db
    .select({ value: count() })
    .from(readingProgress)
    .where(eq(readingProgress.owner_id, ownerId))
    .get()?.value ?? 0;
  const highlightCount = db
    .select({ value: count() })
    .from(highlights)
    .where(and(eq(highlights.owner_id, ownerId), isNull(highlights.deleted_at)))
    .get()?.value ?? 0;
  const noteCount = db
    .select({ value: count() })
    .from(notes)
    .where(and(eq(notes.owner_id, ownerId), isNull(notes.deleted_at)))
    .get()?.value ?? 0;
  const bookmarkCount = db
    .select({ value: count() })
    .from(bookmarks)
    .where(eq(bookmarks.owner_id, ownerId))
    .get()?.value ?? 0;
  const topicCount = db
    .select({ value: count() })
    .from(topics)
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicBookCount = db
    .select({ value: count() })
    .from(topicBooks)
    .innerJoin(topics, eq(topics.id, topicBooks.topic_id))
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicHighlightCount = db
    .select({ value: count() })
    .from(topicHighlights)
    .innerJoin(topics, eq(topics.id, topicHighlights.topic_id))
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicNoteCount = db
    .select({ value: count() })
    .from(topicNotes)
    .innerJoin(topics, eq(topics.id, topicNotes.topic_id))
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicSegmentCount = db
    .select({ value: count() })
    .from(topicSegments)
    .innerJoin(topics, eq(topics.id, topicSegments.topic_id))
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicEntryCount = db
    .select({ value: count() })
    .from(topicEntries)
    .innerJoin(topics, eq(topics.id, topicEntries.topic_id))
    .where(and(eq(topics.owner_id, ownerId), isNull(topics.deleted_at)))
    .get()?.value ?? 0;
  const topicWorkspaceCount =
    topicCount + topicBookCount + topicHighlightCount + topicNoteCount + topicSegmentCount + topicEntryCount;

  const moduleCounts: Partial<Record<BackupModuleId, number>> = {
    'settings.public': settingsCount,
    'settings.secrets': 0,
    'users.auth': userCount,
    'library.books': bookCount,
    'library.taxonomy': categoryCount + tagCount,
    'library.relations': relationCount,
    'assets.file_index': bookFileCount + coverCount,
    'assets.book_blobs': bookFileCount,
    'assets.cover_blobs': coverCount,
    'reading.progress': progressCount,
    'reading.highlights': highlightCount,
    'reading.notes': noteCount,
    'reading.bookmarks': bookmarkCount,
    'topics.workspace': topicWorkspaceCount,
    'database.snapshot': databaseSizeBytes > 0 ? 1 : 0,
  };

  const moduleSizes: Partial<Record<BackupModuleId, number>> = {
    'settings.public': settingsCount * 256,
    'settings.secrets': 0,
    'users.auth': userCount * 512,
    'library.books': bookCount * 2048,
    'library.taxonomy': (categoryCount + tagCount) * 512,
    'library.relations': relationCount * 512,
    'assets.file_index': (bookFileCount + coverCount) * 1024,
    'assets.book_blobs': bookBlobSize,
    'assets.cover_blobs': coverBlobSize,
    'reading.progress': progressCount * 512,
    'reading.highlights': highlightCount * 2048,
    'reading.notes': noteCount * 4096,
    'reading.bookmarks': bookmarkCount * 512,
    'topics.workspace': topicWorkspaceCount * 2048,
    'database.snapshot': databaseSizeBytes,
  };

  return {
    book_count: bookCount,
    note_count: noteCount,
    highlight_count: highlightCount,
    topic_count: topicCount,
    module_counts: moduleCounts,
    module_sizes: moduleSizes,
  };
}
