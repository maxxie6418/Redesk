import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');

function readRoute(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('批量列表分页策略', () => {
  it('书架与设置批量页不再依赖 120/200 条大页请求', () => {
    const bookshelf = readRoute('apps/web/src/routes/bookshelf/index.tsx');
    const batchTab = readRoute('apps/web/src/routes/settings/batch-tab.tsx');

    expect(bookshelf).not.toContain('page_size: 200');
    expect(batchTab).not.toContain('page_size: 120');
    expect(batchTab).not.toContain('page_size: 200');
  });

  it('书架与设置批量页提供后续分页加载入口', () => {
    const bookshelf = readRoute('apps/web/src/routes/bookshelf/index.tsx');
    const batchTab = readRoute('apps/web/src/routes/settings/batch-tab.tsx');

    expect(bookshelf).toContain('BookshelfPagination');
    expect(bookshelf).toContain('hasMore');
    expect(batchTab).toContain('加载更多');
    expect(batchTab).toContain('下一页');
  });
});
