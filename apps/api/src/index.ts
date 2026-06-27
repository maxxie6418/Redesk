import { buildServer } from './server';
import { initDatabase } from './db';
import { config } from './config';

async function main(): Promise<void> {
  if (config.isProd && config.isDefaultSessionSecret) {
    console.warn('[redesk] 警告：SESSION_SECRET 使用默认值，生产环境请设置强随机密钥');
  }

  initDatabase();

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
