import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, isAbsolute } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(here, '..', '..', '..');

dotenvConfig({ path: join(MONOREPO_ROOT, '.env') });

const DEFAULT_SESSION_SECRET = 'redesk-dev-session-secret-change-me';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().default('./data/redesk.db'),
  STORAGE_DIR: z.string().default('./data/storage'),
  SESSION_SECRET: z.string().min(16).default(DEFAULT_SESSION_SECRET),
  WEB_URL: z.string().default('http://localhost:5173'),
  SPA_DIR: z.string().default('./apps/web/dist'),
  LOG_LEVEL: z.string().default('info'),
  VITE_AUTH_DISABLED: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[redesk] 环境变量校验失败:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : join(MONOREPO_ROOT, p);
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  host: env.API_HOST,
  port: env.API_PORT,
  databaseUrl: resolvePath(env.DATABASE_URL),
  storageDir: resolvePath(env.STORAGE_DIR),
  spaDir: resolvePath(env.SPA_DIR),
  sessionSecret: env.SESSION_SECRET,
  isDefaultSessionSecret: env.SESSION_SECRET === DEFAULT_SESSION_SECRET,
  webUrl: env.WEB_URL,
  logLevel: env.LOG_LEVEL,
  devAuthDisabled:
    String(env.VITE_AUTH_DISABLED ?? (env.NODE_ENV === 'development' ? 'true' : 'false')).toLowerCase() === 'true',
};

export type AppConfig = typeof config;
