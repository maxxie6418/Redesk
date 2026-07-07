import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BookDetailTabs } from './book-detail-tabs';

const noop = () => undefined;

describe('BookDetailTabs', () => {
  it('renders vertical detail tabs and marks active tab', () => {
    const html = renderToStaticMarkup(
      createElement(BookDetailTabs, {
        activeTab: 'traces',
        editMode: false,
        onChange: noop,
        onEditModeChange: noop,
      }),
    );

    expect(html).toContain('档案');
    expect(html).toContain('笔记');
    expect(html).toContain('主题');
    expect(html).toContain('AI');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('writing-mode:vertical-rl');
  });
});
