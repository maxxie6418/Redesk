import type { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { MONOREPO_ROOT } from '../config';
import { ERROR_CODE } from '@redesk/shared';
import { AppError } from '../lib/errors';
import { requireUserId } from '../lib/auth';

const FONT_DIR = join(MONOREPO_ROOT, 'data', 'reader-fonts');
const ALLOWED_EXTENSIONS = ['.ttf', '.otf', '.woff2'];
const MAX_FONT_SIZE = 5 * 1024 * 1024;

function ensureFontDir() {
  if (!existsSync(FONT_DIR)) {
    mkdirSync(FONT_DIR, { recursive: true });
  }
}

export async function readerFontRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reader/fonts', async (req) => {
    requireUserId(req);
    ensureFontDir();

    const files = readdirSync(FONT_DIR).filter((f) => ALLOWED_EXTENSIONS.some((ext) => f.endsWith(ext)));
    const fonts = files.map((filename) => ({
      filename,
      url: `/api/v1/reader/fonts/${encodeURIComponent(filename)}`,
    }));

    return { data: fonts };
  });

  app.get('/reader/fonts/:filename', async (req, reply) => {
    requireUserId(req);
    const { filename } = req.params as { filename: string };
    const filePath = join(FONT_DIR, filename);

    if (!existsSync(filePath)) {
      throw new AppError(ERROR_CODE.NOT_FOUND, '字体文件不存在');
    }

    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      ttf: 'font/ttf',
      otf: 'font/otf',
      woff2: 'font/woff2',
    };

    reply.header('Content-Type', mimeMap[ext] ?? 'application/octet-stream');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.sendFile(filePath);
  });

  app.post('/reader/fonts', async (req) => {
    requireUserId(req);
    ensureFontDir();

    const data = await req.file();
    if (!data) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '请上传字体文件');
    }

    const ext = `.${data.filename.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的字体格式，仅支持 ${ALLOWED_EXTENSIONS.join('/')}`);
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_FONT_SIZE) {
        throw new AppError(ERROR_CODE.VALIDATION_ERROR, '字体文件不能超过 5MB');
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(FONT_DIR, safeName);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(filePath, buffer);

    return { data: { filename: safeName, url: `/api/v1/reader/fonts/${encodeURIComponent(safeName)}` } };
  });

  app.delete('/reader/fonts/:filename', async (req) => {
    requireUserId(req);
    const { filename } = req.params as { filename: string };
    const filePath = join(FONT_DIR, filename);

    if (!existsSync(filePath)) {
      throw new AppError(ERROR_CODE.NOT_FOUND, '字体文件不存在');
    }

    unlinkSync(filePath);
    return { data: { deleted: true } };
  });
}
