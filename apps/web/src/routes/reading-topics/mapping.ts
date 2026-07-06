import type { TopicBook, TopicDetail } from '@/hooks/use-topics';
import type { Topic, TopicWorkspaceBlock } from './data';

function mapEntryTypeToBlock(type: string): TopicWorkspaceBlock {
  if (type === 'QUESTION') return '问题';
  if (type === 'JUDGMENT') return '判断';
  return '比较';
}

function findBookById(books: TopicBook[], bookId: number) {
  return books.find((book) => book.book_id === bookId);
}

const BOOK_TONES = ['bg-[#d8c6b7]', 'bg-[#c7d4dc]', 'bg-[#ded7c2]', 'bg-[#cfd8c8]', 'bg-[#d7c8d5]'] as const;

export function mapTopicDetailToViewModel(topic: TopicDetail): Topic {
  const bookTraceCounts = new Map<number, number>();
  for (const highlight of topic.highlights) {
    bookTraceCounts.set(highlight.book_id, (bookTraceCounts.get(highlight.book_id) ?? 0) + 1);
  }
  for (const note of topic.notes) {
    bookTraceCounts.set(note.book_id, (bookTraceCounts.get(note.book_id) ?? 0) + 1);
  }
  for (const segment of topic.segments) {
    bookTraceCounts.set(segment.book_id, (bookTraceCounts.get(segment.book_id) ?? 0) + 1);
  }

  return {
    id: String(topic.id),
    title: topic.name,
    updatedAt: topic.updated_at,
    description: topic.description ?? '',
    tags: [],
    books: topic.books.map((book, index) => ({
      id: String(book.book_id),
      title: book.title,
      traceCount: bookTraceCounts.get(book.book_id) ?? 0,
      citationCount: topic.entries.length,
      tone: BOOK_TONES[index % BOOK_TONES.length] ?? 'bg-muted',
    })),
    traces: [
      ...topic.highlights.map((highlight) => ({
        id: `highlight-${highlight.highlight_id}`,
        traceType: 'highlight' as const,
        bookId: highlight.book_id,
        bookTitle: highlight.book_title ?? '未知书籍',
        chapter: highlight.cfi_start,
        cfi: highlight.cfi_start,
        createdAt: highlight.added_at,
        quote: highlight.text,
        note: highlight.note ?? undefined,
        tone: 'primary' as const,
      })),
      ...topic.notes.map((note) => ({
        id: `note-${note.note_id}`,
        traceType: 'note' as const,
        bookId: note.book_id,
        bookTitle: note.book_title ?? '未知书籍',
        chapter: note.cfi ?? '独立笔记',
        cfi: note.cfi,
        createdAt: note.added_at,
        quote: note.content_markdown ?? note.title ?? '未命名笔记',
        tone: 'success' as const,
      })),
      ...topic.segments.map((segment) => ({
        id: `segment-${segment.id}`,
        traceType: 'segment' as const,
        bookId: segment.book_id,
        bookTitle: segment.book_title ?? findBookById(topic.books, segment.book_id)?.title ?? '未知书籍',
        chapter: segment.label ?? segment.cfi_start,
        cfi: segment.cfi_start,
        createdAt: segment.added_at,
        quote: `${segment.cfi_start} → ${segment.cfi_end}`,
        tone: 'info' as const,
      })),
    ],
    latestUpdate: topic.description?.trim() || `最近更新于 ${topic.updated_at}`,
    insights: topic.entries.map((entry) => ({
      id: String(entry.id),
      title: entry.content,
      citations: 0,
      block: mapEntryTypeToBlock(entry.entry_type),
    })),
  };
}
