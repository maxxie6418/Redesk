import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MONOREPO_ROOT } from '../config';

const SCRIPTS: Record<string, { file: string; contentType: string; filename: string }> = {
  'update.sh': { file: 'update.sh', contentType: 'application/x-sh', filename: 'update.sh' },
  'update.ps1': { file: 'update.ps1', contentType: 'text/plain', filename: 'update.ps1' },
};

export async function updateScriptRoutes(app: FastifyInstance): Promise<void> {
  app.get('/update-script/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const entry = SCRIPTS[name];
    if (!entry) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '脚本不存在' } });
    }

    try {
      const filePath = join(MONOREPO_ROOT, entry.file);
      const content = readFileSync(filePath, 'utf-8');
      return reply
        .header('Content-Type', entry.contentType)
        .header('Content-Disposition', `attachment; filename="${entry.filename}"`)
        .send(content);
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: '脚本文件读取失败' } });
    }
  });
}
