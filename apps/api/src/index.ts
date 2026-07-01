import { buildServer } from './server';
import { initDatabase } from './db';
import { config } from './config';
import { ensureDefaultAdmin } from './lib/auth';

async function main(): Promise<void> {
  if (config.isProd && config.isDefaultSessionSecret) {
    console.error('[redesk] 致命错误：生产环境必须设置强随机 SESSION_SECRET');
    console.error('[redesk] 请通过环境变量或 .env 文件设置 SESSION_SECRET（建议 32+ 字节随机字符串）');
    process.exit(1);
  }

  initDatabase();
  await ensureDefaultAdmin();

  const app = await buildServer();

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`[redesk] API 已启动: http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
