import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

function mockFetch(response: Response) {
  vi.stubGlobal('fetch', vi.fn(async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('非 JSON 错误响应会抛出可读 ApiError', async () => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

    await expect(api.get('/books')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      message: '服务返回了非预期响应',
    });
  });

  it('保留标准错误响应中的 code、message 和 details', async () => {
    const details = [{ field: 'title', issue: '必填' }];
    mockFetch(
      Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数校验失败',
            details,
          },
        },
        { status: 400 },
      ),
    );

    await expect(api.post('/books', {})).rejects.toMatchObject({
      name: 'ApiError',
      code: 'VALIDATION_ERROR',
      message: '参数校验失败',
      details,
    });
  });

  it('成功响应继续返回 data 字段', async () => {
    mockFetch(Response.json({ data: { id: 1, title: '红楼梦' } }));

    await expect(api.get('/books/1')).resolves.toEqual({ id: 1, title: '红楼梦' });
  });

  it('非法 JSON 的成功响应会抛出可读 ApiError', async () => {
    mockFetch(new Response('not json', { status: 200 }));

    await expect(api.get('/books')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      message: '服务返回了非预期响应',
    });
  });
});
