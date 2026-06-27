import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../migrate';

const here = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(here, '..', '..', '..', '..');

function readRootEnv(): Record<string, string> {
  const envPath = join(MONOREPO_ROOT, '.env');
  if (!existsSync(envPath)) return {};

  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

function resolvePath(path: string): string {
  return isAbsolute(path) ? path : join(MONOREPO_ROOT, path);
}

const rootEnv = readRootEnv();
const databaseUrl = resolvePath(process.env.DATABASE_URL ?? rootEnv.DATABASE_URL ?? './data/redesk.db');

runMigrations(databaseUrl);
console.log(`[redesk] 数据库迁移已应用: ${databaseUrl}`);
