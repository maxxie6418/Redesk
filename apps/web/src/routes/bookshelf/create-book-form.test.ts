import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../../..');

function readCreateBookForm() {
  return readFileSync(resolve(root, 'apps/web/src/routes/bookshelf/create-book-form.tsx'), 'utf8');
}

describe('创建书籍请求参数', () => {
  it('未选择标签时仍提交空标签数组', () => {
    const source = readCreateBookForm();

    expect(source).toContain('tag_ids: tagIds,');
    expect(source).not.toContain('tag_ids: tagIds.length > 0 ? tagIds : null,');
  });
});
