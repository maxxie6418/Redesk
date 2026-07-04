export type NoteType = 'annotated' | 'highlight' | 'standalone';

export interface SourceBook {
  id: string;
  title: string;
  count: number;
  tone: string;
}

export interface ReadingNoteItem {
  id: string;
  sourceBookId: string | null;
  sourceTitle: string;
  author?: string;
  chapter: string;
  createdAt: string;
  type: NoteType;
  quote?: string;
  summary?: string;
  content?: string;
  tags: string[];
  highlightTone?: 'primary' | 'success' | 'info';
}

export const filterChips = ['最近 30 天', '批注型'];

export const sourceBooks: SourceBook[] = [
  { id: 'thinking-fast-slow', title: '思考，快与慢', count: 18, tone: 'bg-[#d8c6b7]' },
  { id: 'in-the-thick', title: '置身事内', count: 3, tone: 'bg-[#cfd8c8]' },
  { id: 'guns-germs-steel', title: '枪炮、病菌与钢铁', count: 3, tone: 'bg-[#d6d0c6]' },
];

export const notes: ReadingNoteItem[] = [
  {
    id: 'n1',
    sourceBookId: 'thinking-fast-slow',
    sourceTitle: '思考，快与慢',
    author: '丹尼尔·卡尼曼',
    chapter: '第 12 章',
    createdAt: '2026-06-28',
    type: 'annotated',
    quote: '“系统 1 的运行是无意识且快速的，不怎么费脑力，没有感觉，完全处于自主控制状态。”',
    summary: '这段解释了为什么直觉判断常常出错。我会把它当作一个提醒：在做投资、招聘和写方案时，先停一秒，把系统 2 拉进来。',
    tags: ['认知偏差', '决策', '系统 1/2'],
    highlightTone: 'primary',
  },
  {
    id: 'n2',
    sourceBookId: 'thinking-fast-slow',
    sourceTitle: '思考，快与慢',
    author: '丹尼尔·卡尼曼',
    chapter: '第 3 章',
    createdAt: '2026-06-26',
    type: 'highlight',
    quote: '“系统 1 的自信通常高于它的正确率，而系统 2 又懒得及时站出来纠错。”',
    tags: ['启发式', '认知偏差'],
    highlightTone: 'info',
  },
  {
    id: 'n3',
    sourceBookId: 'in-the-thick',
    sourceTitle: '置身事内',
    author: '兰小欢',
    chapter: '第 4 章',
    createdAt: '2026-06-25',
    type: 'highlight',
    quote: '“政府不仅是市场的裁判员，更是市场的运动员。理解中国经济，必须理解地方政府的行为逻辑。”',
    tags: ['中国经济', '地方政府'],
    highlightTone: 'success',
  },
  {
    id: 'n4',
    sourceBookId: null,
    sourceTitle: '独立笔记',
    chapter: '沉淀卡片',
    createdAt: '2026-06-22',
    type: 'standalone',
    content: '《助推》里提到的“选择架构”让我重新审视产品设计里的默认项。用户并不是完全理性的，设计者的责任是通过合理的默认设置帮助他们做出更好的选择，而不是操纵他们。',
    tags: ['行为经济学', '产品设计'],
  },
];

export const highFrequencyTags = [
  ['认知偏差', 18],
  ['决策', 14],
  ['中国经济', 12],
  ['产品设计', 9],
  ['文明史', 8],
  ['地理决定论', 6],
] as const;

export const pageStats = [
  { label: '总笔记数', value: '128' },
  { label: '本月新增', value: '24' },
  { label: '已批注', value: '36' },
  { label: '关联话题', value: '12' },
];
