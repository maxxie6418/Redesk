import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchBookMetadataFromUrl } from './book-metadata';

function mockHtmlResponse(html: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      text: async () => html,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchBookMetadataFromUrl', () => {
  it('parses NeoDB book fields and ignores rating when vote count is insufficient', async () => {
    mockHtmlResponse(`
      <html>
        <head>
          <meta property="og:image" content="https://neodb.social/book-cover.jpg">
          <script type="application/ld+json">
            {
              "@type": "Book",
              "name": "边城",
              "author": [{ "name": "沈从文" }],
              "publisher": { "name": "人民文学出版社" },
              "datePublished": "2000-07",
              "isbn": "9787020042289",
              "numberOfPages": 234,
              "alternateName": "Border Town",
              "description": "湘西小城故事"
            }
          </script>
        </head>
        <body>
          <div class="rating"><h3>8.8<small>/ 10</small></h3></div>
          <div>评分人数不足</div>
          <div>译者: 傅惟慈</div>
        </body>
      </html>
    `);

    const metadata = await fetchBookMetadataFromUrl('https://neodb.social/book/abc');

    expect(metadata).toMatchObject({
      title: '边城',
      author: '沈从文',
      translator: '傅惟慈',
      publisher: '人民文学出版社',
      publish_year: 2000,
      isbn: '9787020042289',
      page_count: 234,
      original_title: 'Border Town',
      description: '湘西小城故事',
      cover_url: 'https://neodb.social/book-cover.jpg',
      source_url: 'https://neodb.social/book/abc',
      metadata_source: 'neodb',
    });
    expect(metadata.douban_rating).toBeUndefined();
  });

  it('strips Douban metadata labels from parsed fields', async () => {
    mockHtmlResponse(`
      <html>
        <head>
          <meta property="og:title" content="乡土中国">
          <meta property="og:description" content="社会学经典">
          <meta property="og:image" content="https://img.example.com/cover.jpg">
        </head>
        <body>
          <div id="info">
            <span class="pl">作者:</span> 作者: 费孝通<br>
            <span class="pl">出版社:</span> 出版社: 北京大学出版社<br>
            <span class="pl">出版年:</span> 出版年: 2012-10<br>
            <span class="pl">页数:</span> 页数: 185<br>
            <span class="pl">ISBN:</span> ISBN: 9787301174821<br>
          </div>
          <strong class="rating_num">9.2</strong>
        </body>
      </html>
    `);

    const metadata = await fetchBookMetadataFromUrl('https://book.douban.com/subject/1234567/');

    expect(metadata).toMatchObject({
      title: '乡土中国',
      author: '费孝通',
      publisher: '北京大学出版社',
      publish_year: 2012,
      page_count: 185,
      isbn: '9787301174821',
      description: '社会学经典',
      cover_url: 'https://img.example.com/cover.jpg',
      douban_rating: 9.2,
      source_url: 'https://book.douban.com/subject/1234567/',
      metadata_source: 'douban',
    });
  });
});
