export type TopicWorkspaceBlock = '问题' | '判断' | '比较';

export interface TopicBook {
  id: string;
  title: string;
  traceCount: number;
  citationCount: number;
  tone: string;
}

export interface TopicTrace {
  id: string;
  traceType: 'highlight' | 'note' | 'segment';
  bookId: number;
  bookTitle: string;
  chapter: string;
  cfi: string | null;
  createdAt: string;
  quote: string;
  note?: string;
  tone: 'primary' | 'success' | 'info';
}

export interface TopicInsight {
  id: string;
  title: string;
  citations: number;
  block: TopicWorkspaceBlock;
}

export interface Topic {
  id: string;
  title: string;
  updatedAt: string;
  description: string;
  tags: string[];
  books: TopicBook[];
  traces: TopicTrace[];
  latestUpdate: string;
  insights: TopicInsight[];
}

export const topics: Topic[] = [
  {
    id: 'bias',
    title: '决策与认知偏差',
    updatedAt: '2 天前更新',
    description: '整理行为经济学中关于人类决策偏差的经典论述，比较卡尼曼、泰勒、艾瑞里三位作者的不同视角与互补观点。',
    tags: ['行为经济学', '决策科学', '认知心理学'],
    books: [
      { id: 'b1', title: '思考，快与慢', traceCount: 42, citationCount: 8, tone: 'bg-[#d8c6b7]' },
      { id: 'b2', title: '助推', traceCount: 23, citationCount: 5, tone: 'bg-[#c7d4dc]' },
      { id: 'b3', title: '怪诞行为学', traceCount: 18, citationCount: 5, tone: 'bg-[#ded7c2]' },
    ],
    traces: [
      {
        id: 't1',
        traceType: 'highlight',
        bookId: 1,
        bookTitle: '思考，快与慢',
        chapter: '第 12 章',
        cfi: null,
        createdAt: '2026-06-28',
        quote: '“系统 1 的运行是无意识且快速的，不怎么费脑力，没有感觉，完全处于自主控制状态。”',
        note: '人们面对复杂决策时，往往让系统 1 代替系统 2 工作，导致可预测的偏差。',
        tone: 'primary',
      },
      {
        id: 't2',
        traceType: 'note',
        bookId: 2,
        bookTitle: '助推',
        chapter: '第 3 章',
        cfi: null,
        createdAt: '2026-06-26',
        quote: '“选择架构无处不在，即使我们什么都不做，也已经设计了选择环境。”',
        tone: 'success',
      },
      {
        id: 't3',
        traceType: 'segment',
        bookId: 3,
        bookTitle: '怪诞行为学',
        chapter: '第 1 章',
        cfi: null,
        createdAt: '2026-06-24',
        quote: '“人们很少做不加对比的选择。我们的心里并没有一个‘内部价值计量器’。”',
        tone: 'info',
      },
    ],
    latestUpdate: '《助推》里的默认项设计，本质上是在利用系统 1 的惯性，把选择引导向一个更稳妥的方向。',
    insights: [
      { id: 'i1', title: '系统 1 的直觉偏差能否通过训练减少？', citations: 2, block: '问题' },
      { id: 'i2', title: '助推与操纵的边界在哪里？', citations: 3, block: '问题' },
      { id: 'i3', title: '卡尼曼更关注认知偏差本身，泰勒更关注政策设计。', citations: 5, block: '判断' },
      { id: 'i4', title: '三本书对“非理性”的解释框架并不相同：启发式、默认项与社会比较各有重心。', citations: 8, block: '比较' },
    ],
  },
  {
    id: 'government',
    title: '地方政府与经济发展',
    updatedAt: '1 周前更新',
    description: '从《置身事内》《小镇喧嚣》《乡土中国》中提炼中国地方政府行为逻辑，理解中央与地方的激励结构。',
    tags: ['中国经济', '地方政府', '制度分析'],
    books: [
      { id: 'g1', title: '置身事内', traceCount: 31, citationCount: 4, tone: 'bg-[#cfd8c8]' },
      { id: 'g2', title: '小镇喧嚣', traceCount: 14, citationCount: 3, tone: 'bg-[#d7c8d5]' },
    ],
    traces: [],
    latestUpdate: '《置身事内》强调政府作为“运动员”的角色，这种双重身份在土地财政上体现得最明显。',
    insights: [
      { id: 'g-i1', title: '地方政府为何同时追求增长与稳定？', citations: 4, block: '问题' },
      { id: 'g-i2', title: '财政约束会改变治理方式，但不会改变激励方向。', citations: 3, block: '判断' },
    ],
  },
  {
    id: 'civilization',
    title: '文明发展的地理因素',
    updatedAt: '2 周前更新',
    description: '对比《枪炮、病菌与钢铁》《崩溃》《文明的冲突》中关于文明兴衰的解释框架，辨析地理、制度与文化的权重。',
    tags: ['地理决定论', '文明史', '制度比较'],
    books: [
      { id: 'c1', title: '枪炮、病菌与钢铁', traceCount: 28, citationCount: 4, tone: 'bg-[#d6d0c6]' },
      { id: 'c2', title: '崩溃', traceCount: 17, citationCount: 3, tone: 'bg-[#d8c6b7]' },
      { id: 'c3', title: '文明的冲突', traceCount: 12, citationCount: 2, tone: 'bg-[#cfd8c8]' },
    ],
    traces: [],
    latestUpdate: '欧亚大陆的东西轴线促进了作物与技术传播，而美洲的南北轴线则受到气候带阻隔。',
    insights: [{ id: 'c-i1', title: '制度变量如何修正纯粹的地理解释？', citations: 2, block: '比较' }],
  },
];

export const topicStats = (topic: Topic) => ({
  books: topic.books.length,
  traces: topic.books.reduce((sum, book) => sum + book.traceCount, 0),
  insights: topic.insights.length,
});
