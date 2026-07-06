import { describe, expect, it } from 'vitest';
import type { TopicDetail } from '@/hooks/use-topics';
import { mapTopicDetailToViewModel } from './mapping';

const topicDetail: TopicDetail = {
  id: 1,
  owner_id: 1,
  name: '技术伦理',
  description: '整理技术伦理相关材料',
  created_at: '2026-07-06T00:00:00.000Z',
  updated_at: '2026-07-06T00:00:00.000Z',
  deleted_at: null,
  book_count: 1,
  entry_count: 0,
  books: [
    {
      topic_id: 1,
      book_id: 11,
      added_at: '2026-07-06T00:00:00.000Z',
      title: '技术与文明',
      author: '佚名',
      cover_path: null,
    },
  ],
  highlights: [
    {
      topic_id: 1,
      highlight_id: 21,
      added_at: '2026-07-06T01:00:00.000Z',
      text: '技术不是中性的，它会重塑社会关系。',
      cfi_start: 'epubcfi(/6/2!/4/2/10)',
      cfi_end: 'epubcfi(/6/2!/4/2/18)',
      color: '#fde047',
      note: '关键判断',
      book_id: 11,
      book_title: '技术与文明',
    },
  ],
  notes: [
    {
      topic_id: 1,
      note_id: 31,
      added_at: '2026-07-06T02:00:00.000Z',
      title: '读后问题',
      content_markdown: '平台治理是否需要新的公共性框架？',
      cfi: 'epubcfi(/6/4!/4/2/6)',
      book_id: 11,
      book_title: '技术与文明',
    },
  ],
  segments: [
    {
      id: 41,
      topic_id: 1,
      book_id: 11,
      cfi_start: 'epubcfi(/6/8!/4/2/2)',
      cfi_end: 'epubcfi(/6/8!/4/2/30)',
      label: '第二章片段',
      added_at: '2026-07-06T03:00:00.000Z',
      book_title: '技术与文明',
    },
  ],
  entries: [],
};

describe('mapTopicDetailToViewModel', () => {
  it('为话题工作区阅读痕迹保留跳回原文所需字段', () => {
    const topic = mapTopicDetailToViewModel(topicDetail);

    expect(topic.traces).toMatchObject([
      {
        id: 'highlight-21',
        traceType: 'highlight',
        bookId: 11,
        cfi: 'epubcfi(/6/2!/4/2/10)',
      },
      {
        id: 'note-31',
        traceType: 'note',
        bookId: 11,
        cfi: 'epubcfi(/6/4!/4/2/6)',
      },
      {
        id: 'segment-41',
        traceType: 'segment',
        bookId: 11,
        cfi: 'epubcfi(/6/8!/4/2/2)',
      },
    ]);
  });
});
