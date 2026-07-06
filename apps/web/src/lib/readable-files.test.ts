import { describe, expect, it } from 'vitest';
import { EXTENSION_FORMATS, MIME_TYPES, isReadableFileFormat, selectReadableFile } from '@redesk/shared';

interface FileItem {
  id: number;
  is_primary: number;
  file_format: string;
}

const file = (id: number, file_format: string, is_primary = 0): FileItem => ({ id, file_format, is_primary });

describe('readable file rules', () => {
  it('提供 Markdown 和图片上传所需的扩展名与 MIME 映射', () => {
    expect(EXTENSION_FORMATS['.md']).toBe('MD');
    expect(EXTENSION_FORMATS['.markdown']).toBe('MARKDOWN');
    expect(EXTENSION_FORMATS['.jpg']).toBe('JPG');
    expect(EXTENSION_FORMATS['.jpeg']).toBe('JPEG');
    expect(EXTENSION_FORMATS['.png']).toBe('PNG');
    expect(MIME_TYPES['.md']).toBe('text/markdown; charset=utf-8');
    expect(MIME_TYPES['.jpg']).toBe('image/jpeg');
    expect(MIME_TYPES['.png']).toBe('image/png');
  });

  it('识别 EPUB、PDF、文本和图片为可预览格式', () => {
    expect(isReadableFileFormat('EPUB')).toBe(true);
    expect(isReadableFileFormat('pdf')).toBe(true);
    expect(isReadableFileFormat('md')).toBe(true);
    expect(isReadableFileFormat('MARKDOWN')).toBe(true);
    expect(isReadableFileFormat('txt')).toBe(true);
    expect(isReadableFileFormat('jpg')).toBe(true);
    expect(isReadableFileFormat('jpeg')).toBe(true);
    expect(isReadableFileFormat('png')).toBe(true);
  });

  it('不把 MOBI、AZW3 和未知格式当作可预览格式', () => {
    expect(isReadableFileFormat('MOBI')).toBe(false);
    expect(isReadableFileFormat('AZW3')).toBe(false);
    expect(isReadableFileFormat('UNKNOWN')).toBe(false);
  });

  it('优先选择主可预览文件', () => {
    const selected = selectReadableFile([
      file(1, 'EPUB'),
      file(2, 'PDF', 1),
      file(3, 'TXT'),
    ]);

    expect(selected?.id).toBe(2);
  });

  it('主文件不可预览时按格式优先级选择第一个可预览文件', () => {
    const selected = selectReadableFile([
      file(1, 'MOBI', 1),
      file(2, 'PNG'),
      file(3, 'TXT'),
      file(4, 'PDF'),
    ]);

    expect(selected?.id).toBe(4);
  });
});
