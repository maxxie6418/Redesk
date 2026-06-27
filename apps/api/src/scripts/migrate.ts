import { runMigrations } from '@redesk/db';
import { config } from '../config';

runMigrations(config.databaseUrl);
console.log(`[redesk] 数据库迁移已应用: ${config.databaseUrl}`);
