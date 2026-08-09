import { describe, expect, it } from 'vitest';
import { bookFileKey, buildContentDisposition, unassociatedFileKey } from './files';

describe('文件名与对象键', () => {
  it('为相同中文文件名生成不同且仅含 ASCII 的关联对象键', () => {
    const first = bookFileKey(42, '三体（全集）.epub');
    const second = bookFileKey(42, '三体（全集）.epub');

    expect(first).toMatch(/^books\/42\/[0-9a-f-]+\.epub$/);
    expect(second).toMatch(/^books\/42\/[0-9a-f-]+\.epub$/);
    expect(first).not.toBe(second);
  });

  it('为未关联文件按所有者隔离对象键', () => {
    expect(unassociatedFileKey(7, '中文书名.epub')).toMatch(/^unassociated\/7\/[0-9a-f-]+\.epub$/);
  });

  it('为中文下载名提供 ASCII 回退与 UTF-8 filename*', () => {
    expect(buildContentDisposition('三体.epub')).toBe(
      "attachment; filename=\"download.epub\"; filename*=UTF-8''%E4%B8%89%E4%BD%93.epub",
    );
  });

  it('移除下载文件名中的响应头控制字符', () => {
    expect(buildContentDisposition('book\r\n.txt')).toBe(
      "attachment; filename=\"download.txt\"; filename*=UTF-8''book.txt",
    );
  });

});
