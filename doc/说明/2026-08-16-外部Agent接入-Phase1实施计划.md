# 外部 Agent 接入（Phase 1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让外部 AI Agent 通过「一次性链接 + skill 描述 + Bearer 令牌」接入 Redesk，在 scope 白名单内代为查询/新建书籍、更新元数据、管理分类与标签。

**Architecture:** 复用现有业务路由与 owner 校验链路；新增 3 张表（api_tokens / connect_codes / audit_logs）与一个全局 preHandler 守卫：带 `Bearer rdk_` 前缀的请求按「method + 路由模式 → scope」映射表放行，未登记路由一律 403。源链接（豆瓣读书）白名单只在 agent 请求边界强制。明文令牌仅在授权码换发时生成并返回一次，库中只存 sha256 哈希。

**Tech Stack:** Node.js 22 + Fastify 5 + better-sqlite3 + Drizzle ORM + Zod（@redesk/shared）+ Vitest + React（shadcn/ui）

---

## 文件结构总览

新增：
- `packages/db/src/schema/api-tokens.ts` — agent 令牌表
- `packages/db/src/schema/connect-codes.ts` — 一次性授权码表
- `packages/db/src/schema/audit-logs.ts` — 审计日志表
- `packages/db/drizzle/0036_*.sql` — 迁移（由 db:generate 生成）
- `apps/api/src/lib/agent-token.ts` — 令牌/授权码/白名单/审计核心库
- `apps/api/src/lib/agent-token.test.ts` — 核心库单元测试
- `apps/api/src/routes/agent.ts` — 公共 connect/exchange + 管理接口
- `apps/api/src/routes/agent.test.ts` — 接入全流程测试
- `apps/api/src/routes/agent-scope.test.ts` — 全局守卫测试
- `apps/api/src/routes/agent-books.test.ts` — 书籍边界测试
- `apps/api/src/routes/agent-categories.test.ts` — 分类/标签审计与越权测试
- `apps/web/src/hooks/use-agent-connections.ts` — 前端数据 hook
- `apps/web/src/routes/settings/agent-section.tsx` — 设置页 Agent 分区

修改：
- `packages/db/src/schema/index.ts` — 导出 3 张新表
- `packages/shared/src/types.ts` — AGENT_SCOPES / SETTINGS_KEY.AGENT_SOURCE_URL_WHITELIST / 默认白名单
- `packages/shared/src/schemas.ts` — createAgentConnectionSchema / agentTokenExchangeSchema
- `apps/api/src/lib/auth.ts` — requireUserId / requirePermission / getOptionalUserId 增加 apiIdentity 分支
- `apps/api/src/server.ts` — 全局 preHandler 守卫 + 注册 agent 路由
- `apps/api/src/config.ts` — REDESK_PUBLIC_URL
- `apps/api/src/routes/books.ts` — agent 字段白名单 + 源链接白名单 + 审计（create/update/fetch/apply）
- `apps/api/src/routes/categories.ts` — agent 审计
- `apps/api/src/routes/tags.ts` — agent 审计
- `apps/web/src/routes/settings/ai-tab.tsx` — 渲染 Agent 分区
- `doc/说明/外部Agent-Skill授权设计说明.md` — §8.1 字段名勘误（url → source_url）

---

## 关键设计（实现时不可偏离）

1. **授权码换发令牌（mint-at-exchange）**：创建接入时只生成一次性授权码（10 分钟 TTL，只存哈希），`api_tokens.token_hash` 初始为 NULL；`POST /agent/token/exchange` 时生成明文令牌 `rdk_live_...`，写入哈希并返回明文（仅此一次）。
2. **scope 白名单 = 默认拒绝**：全局 preHandler 只处理带 `Bearer rdk_` 的请求；按 `req.method + req.routeOptions.url` 查 ROUTE_SCOPE_MAP，未登记或 scope 不匹配 → 403 + 审计。分类/标签只登记 GET/POST，PATCH/DELETE 天然 403。
3. **业务路由零侵入**：`requireUserId` / `requirePermission` / `getOptionalUserId` 优先读 `req.apiIdentity.ownerId`，owner 边界照旧。
4. **字段白名单**：agent 的 POST /books 与 PATCH /books/:id 只允许 14 个字段（title/author/subtitle/publisher/publish_year/description/source_url/translator/original_title/page_count/category_id/genre_category_id/tag_ids/entry_reason）。**检查原始请求体 key**（不是 zod 解析后带默认值的对象），出现白名单外字段直接 403。
5. **源链接白名单**：settings key `agent_source_url_whitelist`（JSON 数组，默认 `["book.douban.com"]`）；`host === item || host.endsWith('.' + item)`，仅 http/https。只在 `req.apiIdentity` 存在时强制。
6. **审计**：agent 令牌换发、books/categories/tags 写操作、scope.denied、source_url.denied 均写 audit_logs。

**验证命令速查（所有任务共用）：**

```powershell
# 单元/路由测试（本计划新增的测试都通过它跑）
pnpm --filter @redesk/api test
# 只跑某个文件（vitest 在 apps/api 目录下执行，用相对路径）
pnpm --filter @redesk/api test src/routes/agent.test.ts
# 类型检查 / lint
pnpm typecheck
pnpm lint
# 生成迁移 / 空库演练
pnpm db:generate
$env:DATABASE_URL="$env:TEMP\redesk-migrate-drill.db"; pnpm db:migrate; Remove-Item $env:DATABASE_URL
```

执行前先确认 `node --version` 为 22.x（见 AGENTS.md）。

---

### Task 1: 数据表与迁移（api_tokens / connect_codes / audit_logs）

**Files:**
- Create: `packages/db/src/schema/api-tokens.ts`
- Create: `packages/db/src/schema/connect-codes.ts`
- Create: `packages/db/src/schema/audit-logs.ts`
- Modify: `packages/db/src/schema/index.ts`（追加 3 个 export）
- Modify: `packages/shared/src/types.ts`（AGENT_SCOPES / SETTINGS_KEY 新 key / 默认白名单）
- Generate: `packages/db/drizzle/0036_*.sql` + `packages/db/drizzle/meta/_journal.json` + snapshot

- [ ] **Step 1: 新建 api-tokens.ts**

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token_hash: text('token_hash'),
    scopes: text('scopes').notNull(),
    expires_at: text('expires_at'),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    idxOwner: index('idx_api_tokens_owner').on(table.owner_id),
    uqTokenHash: uniqueIndex('uq_api_tokens_token_hash').on(table.token_hash),
  }),
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
```

- [ ] **Step 2: 新建 connect-codes.ts**

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { apiTokens } from './api-tokens';

export const connectCodes = sqliteTable(
  'connect_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_id: integer('token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'cascade' }),
    code_hash: text('code_hash').notNull(),
    expires_at: text('expires_at').notNull(),
    used_at: text('used_at'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    uqCodeHash: uniqueIndex('uq_connect_codes_code_hash').on(table.code_hash),
    idxToken: index('idx_connect_codes_token').on(table.token_id),
  }),
);

export type ConnectCode = typeof connectCodes.$inferSelect;
export type NewConnectCode = typeof connectCodes.$inferInsert;
```

- [ ] **Step 3: 新建 audit-logs.ts**

```ts
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_id: integer('token_id'),
    request_id: text('request_id'),
    method: text('method'),
    path: text('path'),
    action: text('action').notNull(),
    resource_type: text('resource_type'),
    resource_id: text('resource_id'),
    result: text('result').notNull(),
    ip: text('ip'),
    user_agent: text('user_agent'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    idxOwnerTime: index('idx_audit_logs_owner_created_at').on(table.owner_id, table.created_at),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

- [ ] **Step 4: 更新 schema/index.ts，在文件尾部追加导出**

```ts
export * from './api-tokens';
export * from './connect-codes';
export * from './audit-logs';
```

（先打开 `packages/db/src/schema/index.ts`，按现有 `export * from './xxx'` 列表的排列风格追加。）

- [ ] **Step 5: 更新 shared/types.ts，在 SETTINGS_KEY 对象中追加 key，并在文件合适位置追加常量**

在 `export const SETTINGS_KEY = { ... } as const` 内追加一行：

```ts
AGENT_SOURCE_URL_WHITELIST: 'agent_source_url_whitelist',
```

在 SETTINGS_KEY 定义附近追加：

```ts
export const AGENT_SCOPES = [
  'books:read',
  'books:create',
  'books:update_metadata',
  'categories:manage',
  'tags:manage',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const AGENT_SOURCE_URL_WHITELIST_DEFAULT = ['book.douban.com'] as const;
```

- [ ] **Step 6: 生成迁移**

Run: `pnpm db:generate`
Expected: 生成 `packages/db/drizzle/0036_*.sql`，`_journal.json` 末尾 append 新 entry，`drizzle/meta/` 下生成对应 snapshot。

- [ ] **Step 7: 核对生成的 SQL**

打开生成的 `0036_*.sql`，确认**只包含**以下 3 张表的 CREATE TABLE（含索引与 FK），且表顺序为 api_tokens → connect_codes → audit_logs。若出现与本任务无关的改动（例如早期手写迁移与 schema 的漂移导致重建旧表），**立即停止**并向项目负责人报告，不要继续。

```sql
CREATE TABLE `api_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_id` integer NOT NULL,
  `name` text NOT NULL,
  `token_hash` text,
  `scopes` text NOT NULL,
  `expires_at` text,
  `last_used_at` text,
  `revoked_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connect_codes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_id` integer NOT NULL,
  `token_id` integer NOT NULL,
  `code_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`token_id`) REFERENCES `api_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_id` integer NOT NULL,
  `token_id` integer,
  `request_id` text,
  `method` text,
  `path` text,
  `action` text NOT NULL,
  `resource_type` text,
  `resource_id` text,
  `result` text NOT NULL,
  `ip` text,
  `user_agent` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_api_tokens_token_hash` ON `api_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_api_tokens_owner` ON `api_tokens` (`owner_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_connect_codes_code_hash` ON `connect_codes` (`code_hash`);
--> statement-breakpoint
CREATE INDEX `idx_connect_codes_token` ON `connect_codes` (`token_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_owner_created_at` ON `audit_logs` (`owner_id`, `created_at`);
```

- [ ] **Step 8: 空库迁移演练**

Run:

```powershell
$env:DATABASE_URL="$env:TEMP\redesk-migrate-drill.db"; pnpm db:migrate; Remove-Item $env:DATABASE_URL
```

Expected: 迁移成功、无报错。

- [ ] **Step 9: 类型检查**

Run: `pnpm typecheck`
Expected: 通过（`0036` 迁移与 schema 一致）。

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/schema/api-tokens.ts packages/db/src/schema/connect-codes.ts packages/db/src/schema/audit-logs.ts packages/db/src/schema/index.ts packages/shared/src/types.ts packages/db/drizzle
git commit -m "feat(db): 新增 api_tokens/connect_codes/audit_logs 表与 0036 迁移"
```

---

### Task 2: agent-token 核心库（哈希 / 令牌 / 白名单 / 审计）

**Files:**
- Test: `apps/api/src/lib/agent-token.test.ts`
- Create: `apps/api/src/lib/agent-token.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  generateAgentToken,
  generateConnectCode,
  isSourceUrlAllowed,
  parseScopes,
  sha256Hex,
} from './agent-token';

describe('agent-token 工具函数', () => {
  it('sha256Hex 输出 64 位小写十六进制', () => {
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateAgentToken 生成 rdk_live_ 前缀且每次不同', () => {
    const a = generateAgentToken();
    const b = generateAgentToken();
    expect(a.plaintext.startsWith('rdk_live_')).toBe(true);
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).toBe(sha256Hex(a.plaintext));
  });

  it('generateConnectCode 生成随机授权码', () => {
    const code = generateConnectCode();
    expect(code.plaintext.length).toBeGreaterThan(20);
    expect(code.hash).toBe(sha256Hex(code.plaintext));
  });

  it('parseScopes 解析 JSON 数组，坏数据返回空数组', () => {
    expect(parseScopes('["books:read","books:create"]')).toEqual(['books:read', 'books:create']);
    expect(parseScopes('not-json')).toEqual([]);
    expect(parseScopes('{"a":1}')).toEqual([]);
  });

  it('isSourceUrlAllowed 仅放行白名单域名及其子域', () => {
    const whitelist = ['book.douban.com'];
    expect(isSourceUrlAllowed('https://book.douban.com/subject/1001/', whitelist)).toBe(true);
    expect(isSourceUrlAllowed('https://m.book.douban.com/subject/1001/', whitelist)).toBe(true);
    expect(isSourceUrlAllowed('https://evil.example.com/', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('http://127.0.0.1:8787/secret', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('file:///etc/passwd', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('not-a-url', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('https://book.douban.com.evil.com/', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('https://evil.com/book.douban.com/', whitelist)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @redesk/api test apps/api/src/lib/agent-token.test.ts`
Expected: FAIL（`Cannot find module './agent-token'`）。

- [ ] **Step 3: 实现 agent-token.ts**

```ts
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { apiTokens, auditLogs } from '@redesk/db';
import { AGENT_SOURCE_URL_WHITELIST_DEFAULT, SETTINGS_KEY } from '@redesk/shared';
import { getDb } from '../db';
import { forbidden } from './errors';
import { getStringSetting } from './settings-store';

export interface ApiIdentity {
  ownerId: number;
  tokenId: number;
  scopes: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    apiIdentity?: ApiIdentity;
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateAgentToken(): { plaintext: string; hash: string } {
  const plaintext = `rdk_live_${randomBytes(32).toString('base64url')}`;
  return { plaintext, hash: sha256Hex(plaintext) };
}

export function generateConnectCode(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(24).toString('base64url');
  return { plaintext, hash: sha256Hex(plaintext) };
}

export function parseScopes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export const ROUTE_SCOPE_MAP: Record<string, string> = {
  'GET /api/v1/books': 'books:read',
  'GET /api/v1/books/duplicates': 'books:read',
  'GET /api/v1/books/:id': 'books:read',
  'POST /api/v1/books/metadata/fetch': 'books:read',
  'POST /api/v1/books': 'books:create',
  'PATCH /api/v1/books/:id': 'books:update_metadata',
  'POST /api/v1/books/:id/metadata/apply': 'books:update_metadata',
  'GET /api/v1/categories': 'categories:manage',
  'POST /api/v1/categories': 'categories:manage',
  'GET /api/v1/tags': 'tags:manage',
  'POST /api/v1/tags': 'tags:manage',
};

export function parseApiToken(req: FastifyRequest): ApiIdentity | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer rdk_')) return null;
  const plaintext = header.slice('Bearer '.length).trim();
  if (!plaintext) return null;

  const row = getDb()
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token_hash, sha256Hex(plaintext)), isNull(apiTokens.revoked_at)))
    .get();
  if (!row) return null;
  if (row.expires_at && row.expires_at <= new Date().toISOString()) return null;

  getDb()
    .update(apiTokens)
    .set({ last_used_at: new Date().toISOString() })
    .where(eq(apiTokens.id, row.id))
    .run();

  return { ownerId: row.owner_id, tokenId: row.id, scopes: parseScopes(row.scopes) };
}

export function getAgentSourceUrlWhitelist(): string[] {
  const raw = getStringSetting(SETTINGS_KEY.AGENT_SOURCE_URL_WHITELIST, '');
  if (!raw) return [...AGENT_SOURCE_URL_WHITELIST_DEFAULT];
  const parsed = parseScopes(raw);
  return parsed.length > 0 ? parsed : [...AGENT_SOURCE_URL_WHITELIST_DEFAULT];
}

export function isSourceUrlAllowed(url: string, whitelist: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return whitelist.some((item) => {
    const domain = item.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}

export function assertAgentSourceUrl(req: FastifyRequest, url: string | null | undefined): void {
  if (!req.apiIdentity) return;
  if (!url || !isSourceUrlAllowed(url, getAgentSourceUrlWhitelist())) {
    writeAuditLog({
      ownerId: req.apiIdentity.ownerId,
      tokenId: req.apiIdentity.tokenId,
      req,
      action: 'source_url.denied',
      result: 'denied',
    });
    throw forbidden('源链接不在白名单内（仅允许 book.douban.com）');
  }
}

export interface AuditLogEntry {
  ownerId: number;
  tokenId: number | null;
  req?: FastifyRequest;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  result: 'success' | 'denied' | 'failed';
}

export function writeAuditLog(entry: AuditLogEntry): void {
  try {
    const ua = entry.req?.headers['user-agent'];
    getDb()
      .insert(auditLogs)
      .values({
        owner_id: entry.ownerId,
        token_id: entry.tokenId,
        request_id: entry.req?.id ?? null,
        method: entry.req?.method ?? null,
        path: entry.req?.url ?? null,
        action: entry.action,
        resource_type: entry.resourceType ?? null,
        resource_id: entry.resourceId ?? null,
        result: entry.result,
        ip: entry.req?.ip ?? null,
        user_agent: typeof ua === 'string' ? ua : null,
        created_at: new Date().toISOString(),
      })
      .run();
  } catch {
    // 审计写入失败不影响主流程
  }
}
```

说明：`agent-token.ts` 内的 `declare module 'fastify'` 模块增强是全程序生效的，`auth.ts` 等文件无需显式导入即可使用 `req.apiIdentity`；但该文件必须被程序引入（后续 server.ts 与 routes/agent.ts 都会引入它）。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @redesk/api test apps/api/src/lib/agent-token.test.ts`
Expected: PASS（8 个用例）。

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/lib/agent-token.ts apps/api/src/lib/agent-token.test.ts
git commit -m "feat(api): agent 令牌/白名单/审计核心库与单元测试"
```

---

### Task 3: 鉴权接入与全局 scope 守卫

**Files:**
- Test: `apps/api/src/routes/agent-scope.test.ts`
- Modify: `apps/api/src/lib/auth.ts`（requireUserId / getOptionalUserId / requirePermission 增加 apiIdentity 分支）
- Modify: `apps/api/src/server.ts`（全局 preHandler 守卫）

- [ ] **Step 1: 写失败测试**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';
import { generateAgentToken, sha256Hex } from '../lib/agent-token';

let app: FastifyInstance;
let sqlite: ReturnType<typeof getSqlite>;
let ownerId: number;

async function seedUser(): Promise<number> {
  const ts = new Date().toISOString();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  return Number(
    sqlite
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`agent-user-${suffix}`, passwordHash, 'Agent测试用户', 1, 1, 0, ts, ts).lastInsertRowid,
  );
}

function seedToken(scopes: string[], opts: { revoked?: boolean; expiresAt?: string | null } = {}) {
  const { plaintext, hash } = generateAgentToken();
  const ts = new Date().toISOString();
  const id = Number(
    sqlite
      .prepare(
        `INSERT INTO api_tokens (owner_id, name, token_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(ownerId, '测试Agent', hash, JSON.stringify(scopes), opts.expiresAt ?? null, opts.revoked ? ts : null, ts)
      .lastInsertRowid,
  );
  return { id, plaintext };
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  ownerId = await seedUser();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Agent scope 白名单守卫', () => {
  it('白名单路由 + 匹配 scope → 放行', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('非白名单路由（settings）→ 403', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('scope 不匹配（无 books:create）→ 403', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: { title: '测试' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('已吊销令牌 → 401', async () => {
    const { plaintext } = seedToken(['books:read'], { revoked: true });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('已过期令牌 → 401', async () => {
    const { plaintext } = seedToken(['books:read'], { expiresAt: '2020-01-01T00:00:00.000Z' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('未知令牌 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: 'Bearer rdk_live_unknown' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('不带 Bearer → 走原会话逻辑', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/books' });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @redesk/api test src/routes/agent-scope.test.ts`
Expected: FAIL——「非白名单路由 → 403」「scope 不匹配 → 403」「已吊销/过期/未知令牌 → 401」这几个用例拿到 200（当前没有守卫，authDisabled 直接按管理员放行）。

- [ ] **Step 3: 修改 auth.ts**

在文件顶部 import 区追加类型导入（保证模块增强在本文件可见）：

```ts
import type { ApiIdentity } from './agent-token';
```

将 `requireUserId` 改为（在函数体最前面加一行）：

```ts
export function requireUserId(req: FastifyRequest): number {
  if (req.apiIdentity) return req.apiIdentity.ownerId;
  // ...原逻辑不变
}
```

将 `getOptionalUserId` 改为：

```ts
export function getOptionalUserId(req: FastifyRequest): number | undefined {
  if (req.apiIdentity) return req.apiIdentity.ownerId;
  // ...原逻辑不变
}
```

将 `requirePermission` 改为：

```ts
export function requirePermission(req: FastifyRequest, minLevel: PermissionLevel): number {
  if (req.apiIdentity) return req.apiIdentity.ownerId;
  // ...原逻辑不变
}
```

说明：agent 请求的授权以 scope 白名单为准，不再叠加用户权限等级；owner 边界由令牌的 `owner_id` 继承。

- [ ] **Step 4: 修改 server.ts，注册全局 preHandler 守卫**

在 import 区追加：

```ts
import { agentRoutes } from './routes/agent';
import { parseApiToken, ROUTE_SCOPE_MAP, writeAuditLog } from './lib/agent-token';
import { forbidden, unauthorized } from './lib/errors';
```

在 `app.setErrorHandler(...)` 之后、路由注册之前追加：

```ts
app.addHook('preHandler', async (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer rdk_')) return;
  const identity = parseApiToken(req);
  if (!identity) throw unauthorized('令牌无效或已过期');
  req.apiIdentity = identity;
  const routeKey = `${req.method} ${req.routeOptions.url}`;
  const scope = ROUTE_SCOPE_MAP[routeKey];
  if (!scope || !identity.scopes.includes(scope)) {
    writeAuditLog({
      ownerId: identity.ownerId,
      tokenId: identity.tokenId,
      req,
      action: 'scope.denied',
      result: 'denied',
    });
    throw forbidden('该令牌无权访问此接口');
  }
});
```

（`routes/agent.ts` 在 Task 4 才会创建，Step 4 注册该 import 后类型检查会先报模块缺失——因此先把 server.ts 的注册拆两步：本任务只加守卫 import 与 hook，`agentRoutes` 的注册放到 Task 4 Step 3 一起完成。若不想临时拆两步，也可以在本任务先创建空的 `routes/agent.ts`（仅 `export async function agentRoutes(...) {}`），下个任务再填充实现。）

- [ ] **Step 5: 运行确认通过**

Run: `pnpm --filter @redesk/api test src/routes/agent-scope.test.ts`
Expected: PASS（7 个用例）。

- [ ] **Step 6: 全量回归**

Run: `pnpm --filter @redesk/api test`
Expected: 原有测试全部通过（auth 改动为纯增量分支）。

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/lib/auth.ts apps/api/src/server.ts apps/api/src/routes/agent-scope.test.ts
git commit -m "feat(api): 全局 agent scope 白名单守卫与鉴权接入"
```

---

### Task 4: Agent 路由（connect skill / 令牌交换 / 管理接口）

**Files:**
- Test: `apps/api/src/routes/agent.test.ts`
- Create: `apps/api/src/routes/agent.ts`
- Modify: `apps/api/src/config.ts`（REDESK_PUBLIC_URL）
- Modify: `apps/api/src/server.ts`（注册 agentRoutes）
- Modify: `packages/shared/src/schemas.ts`（createAgentConnectionSchema / agentTokenExchangeSchema）

- [ ] **Step 1: 在 shared/schemas.ts 追加校验 schema**

在合适位置（如文件末尾）追加：

```ts
export const createAgentConnectionSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
  expires_at: z.string().datetime().optional().nullable(),
});

export const agentTokenExchangeSchema = z.object({
  code: z.string().min(1).max(500),
});
```

（`AGENT_SCOPES` 已在 types.ts 定义，schemas.ts 需 `import { AGENT_SCOPES } from './types'`——先检查文件现有 import，若已 `import type` 则补一个值导入。）

- [ ] **Step 2: 写失败测试**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';

let app: FastifyInstance;

async function createConnection(scopes: string[]) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/agent/connections',
    payload: { name: '测试Agent', scopes },
  });
  const data = res.json().data;
  const linkPath = new URL(data.link).pathname;
  return { id: data.id, code: data.code, linkPath };
}

beforeAll(async () => {
  initDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Agent 接入路由', () => {
  it('创建接入返回链接与一次性授权码', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agent/connections',
      payload: { name: '我的Claude', scopes: ['books:read', 'books:create'] },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.link).toMatch(/\/agent\/connect\//);
    expect(data.code).toBeTruthy();
  });

  it('读取 skill 链接返回能力清单（按 scope 过滤）', async () => {
    const created = await createConnection(['books:read', 'categories:manage']);
    const res = await app.inject({ method: 'GET', url: created.linkPath });
    expect(res.statusCode).toBe(200);
    const skill = res.json().data;
    expect(skill.skill_version).toBe(1);
    expect(skill.scopes).toEqual(['books:read', 'categories:manage']);
    expect(skill.base_url.endsWith('/api/v1')).toBe(true);
    const ids = skill.capabilities.map((c: { id: string }) => c.id);
    expect(ids).toContain('search_books');
    expect(ids).not.toContain('create_book');
    expect(ids).toContain('list_categories');
    expect(skill.connect_code).toBe(created.code);
  });

  it('授权码换令牌成功，且只能使用一次', async () => {
    const created = await createConnection(['books:read']);
    const res = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.access_token.startsWith('rdk_live_')).toBe(true);
    const again = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    expect(again.statusCode).toBe(400);
  });

  it('错误授权码 → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: 'invalid' } });
    expect(res.statusCode).toBe(400);
  });

  it('换发后的令牌可调用业务 API', async () => {
    const created = await createConnection(['books:read']);
    const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    const token = ex.json().data.access_token;
    const res = await app.inject({ method: 'GET', url: '/api/v1/books', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it('列表展示接入且不泄露哈希', async () => {
    await createConnection(['books:read']);
    const res = await app.inject({ method: 'GET', url: '/api/v1/agent/connections' });
    expect(res.statusCode).toBe(200);
    const rows = res.json().data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).not.toHaveProperty('token_hash');
    expect(rows[0]).not.toHaveProperty('code_hash');
  });

  it('吊销后令牌立即失效', async () => {
    const created = await createConnection(['books:read']);
    const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    const token = ex.json().data.access_token;
    const revoke = await app.inject({ method: 'POST', url: `/api/v1/agent/connections/${created.id}/revoke` });
    expect(revoke.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/api/v1/books', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @redesk/api test src/routes/agent.test.ts`
Expected: FAIL（路由不存在，404 或模块缺失错误）。

- [ ] **Step 4: 修改 config.ts**

在 envSchema 中追加（参照现有 `REDESK_*` 字段的风格）：

```ts
REDESK_PUBLIC_URL: z.string().optional(),
```

在 config 对象中追加：

```ts
publicUrl: env.REDESK_PUBLIC_URL && env.REDESK_PUBLIC_URL.trim() ? env.REDESK_PUBLIC_URL.replace(/\/+$/, '') : undefined,
```

- [ ] **Step 5: 实现 routes/agent.ts**

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiTokens, connectCodes } from '@redesk/db';
import {
  agentTokenExchangeSchema,
  createAgentConnectionSchema,
  ERROR_CODE,
} from '@redesk/shared';
import { config } from '../config';
import { getDb } from '../db';
import { isAdmin, requirePermission } from '../lib/auth';
import {
  generateAgentToken,
  generateConnectCode,
  parseScopes,
  sha256Hex,
  writeAuditLog,
} from '../lib/agent-token';
import { AppError, forbidden, notFound } from '../lib/errors';
import { validate } from '../lib/zod';

const CONNECT_CODE_TTL_MS = 10 * 60 * 1000;

interface Capability {
  id: string;
  method: string;
  path: string;
  requires_scope: string;
  description: string;
}

const ALL_CAPABILITIES: Capability[] = [
  { id: 'search_books', method: 'GET', path: '/books?q={query}', requires_scope: 'books:read', description: '搜索书架，用于创建前查重' },
  { id: 'get_book', method: 'GET', path: '/books/{id}', requires_scope: 'books:read', description: '查看书籍详情' },
  { id: 'fetch_metadata', method: 'POST', path: '/books/metadata/fetch', requires_scope: 'books:read', description: '从白名单源站（豆瓣读书）抓取元数据，只读不落库' },
  { id: 'create_book', method: 'POST', path: '/books', requires_scope: 'books:create', description: '新建书籍条目' },
  { id: 'update_book', method: 'PATCH', path: '/books/{id}', requires_scope: 'books:update_metadata', description: '更新书籍元数据字段' },
  { id: 'apply_metadata', method: 'POST', path: '/books/{id}/metadata/apply', requires_scope: 'books:update_metadata', description: '把抓取结果应用到已有书' },
  { id: 'list_categories', method: 'GET', path: '/categories', requires_scope: 'categories:manage', description: '分类列表' },
  { id: 'create_category', method: 'POST', path: '/categories', requires_scope: 'categories:manage', description: '新建分类' },
  { id: 'list_tags', method: 'GET', path: '/tags', requires_scope: 'tags:manage', description: '标签列表' },
  { id: 'create_tag', method: 'POST', path: '/tags', requires_scope: 'tags:manage', description: '新建标签' },
];

const CONVENTIONS = [
  '创建或更新书籍前，必须先向用户展示元数据预览并询问是否调整，用户明确同意后才可执行写操作',
  '只允许调用 capabilities 中列出的端点，其余一律禁止',
  '源链接只允许豆瓣读书（book.douban.com），不得使用其他信息源链接',
  '创建前必须先用 search_books 做重复检测，发现疑似重复须先告知用户',
  '用户拒绝或说不必时，不要重试或纠缠',
  '不要修改书籍的阅读状态、可见性、评分等非元数据字段',
];

function resolveBaseUrl(req: FastifyRequest): string {
  if (config.publicUrl) return config.publicUrl;
  return `${req.protocol}://${req.host}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/agent/connect/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    if (!code) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少授权码');

    const row = getDb()
      .select()
      .from(connectCodes)
      .where(and(eq(connectCodes.code_hash, sha256Hex(code)), isNull(connectCodes.used_at)))
      .get();
    if (!row || row.expires_at <= new Date().toISOString()) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '授权码无效或已过期');
    }
    const token = getDb()
      .select({
        id: apiTokens.id,
        owner_id: apiTokens.owner_id,
        name: apiTokens.name,
        scopes: apiTokens.scopes,
        expires_at: apiTokens.expires_at,
        revoked_at: apiTokens.revoked_at,
      })
      .from(apiTokens)
      .where(eq(apiTokens.id, row.token_id))
      .get();
    if (!token || token.revoked_at) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '接入已被吊销');
    }

    const scopes = parseScopes(token.scopes);
    const skill = {
      skill_version: 1,
      name: token.name,
      scopes,
      base_url: `${resolveBaseUrl(req)}/api/v1`,
      connect_code: code,
      capabilities: ALL_CAPABILITIES.filter((c) => scopes.includes(c.requires_scope)),
      conventions: CONVENTIONS,
    };

    if ((req.headers.accept ?? '').includes('text/html')) {
      reply.type('text/html; charset=utf-8');
      return reply.send(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>Redesk Agent 接入</title></head>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.7">
<h1>Redesk Agent 接入</h1>
<p>接入名称：<strong>${escapeHtml(token.name)}</strong></p>
<p>授权范围：${scopes.map((s) => `<code>${escapeHtml(s)}</code>`).join('、')}</p>
<p>此链接是一次性授权入口，请将完整链接发送给 AI Agent。</p>
</body></html>`);
    }
    return { data: skill };
  });

  app.post('/agent/token/exchange', async (req) => {
    const input = validate(agentTokenExchangeSchema, req.body);
    const nowIso = new Date().toISOString();
    const row = getDb()
      .select()
      .from(connectCodes)
      .where(and(eq(connectCodes.code_hash, sha256Hex(input.code)), isNull(connectCodes.used_at)))
      .get();
    if (!row || row.expires_at <= nowIso) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '授权码无效或已过期');
    }
    const token = getDb()
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, row.token_id))
      .get();
    if (!token || token.revoked_at) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '接入已被吊销');
    }

    getDb().update(connectCodes).set({ used_at: nowIso }).where(eq(connectCodes.id, row.id)).run();

    const { plaintext, hash: tokenHash } = generateAgentToken();
    getDb()
      .update(apiTokens)
      .set({ token_hash: tokenHash, last_used_at: nowIso })
      .where(eq(apiTokens.id, token.id))
      .run();

    const scopes = parseScopes(token.scopes);
    writeAuditLog({
      ownerId: token.owner_id,
      tokenId: token.id,
      req,
      action: 'agent.token_exchange',
      result: 'success',
    });

    return { data: { access_token: plaintext, expires_at: token.expires_at, scopes, name: token.name } };
  });

  app.get('/api/v1/agent/connections', async (req) => {
    const userId = requirePermission(req, 'use');
    if (!isAdmin(userId)) throw forbidden('只有管理员可以管理 Agent 接入');
    const rows = getDb()
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.owner_id, userId))
      .orderBy(desc(apiTokens.created_at))
      .all();
    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      scopes: parseScopes(row.scopes),
      expires_at: row.expires_at,
      last_used_at: row.last_used_at,
      revoked_at: row.revoked_at,
      activated: row.token_hash !== null,
      created_at: row.created_at,
    }));
    return { data };
  });

  app.post('/api/v1/agent/connections', async (req) => {
    const userId = requirePermission(req, 'use');
    if (!isAdmin(userId)) throw forbidden('只有管理员可以管理 Agent 接入');
    const input = validate(createAgentConnectionSchema, req.body);

    const ts = new Date().toISOString();
    const db = getDb();
    const token = db
      .insert(apiTokens)
      .values({
        owner_id: userId,
        name: input.name,
        scopes: JSON.stringify(input.scopes),
        expires_at: input.expires_at ?? null,
        created_at: ts,
      })
      .returning({ id: apiTokens.id })
      .get();
    const { plaintext: codePlain, hash: codeHash } = generateConnectCode();
    db.insert(connectCodes)
      .values({
        owner_id: userId,
        token_id: token.id,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + CONNECT_CODE_TTL_MS).toISOString(),
        created_at: ts,
      })
      .run();

    const link = `${resolveBaseUrl(req)}/agent/connect/${codePlain}`;
    return {
      data: {
        id: token.id,
        name: input.name,
        scopes: input.scopes,
        expires_at: input.expires_at ?? null,
        link,
        code: codePlain,
        created_at: ts,
      },
    };
  });

  app.post('/api/v1/agent/connections/:id/revoke', async (req) => {
    const userId = requirePermission(req, 'use');
    if (!isAdmin(userId)) throw forbidden('只有管理员可以管理 Agent 接入');
    const tokenId = Number((req.params as { id: string }).id);
    if (Number.isNaN(tokenId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的接入 ID');
    const ts = new Date().toISOString();
    const result = getDb()
      .update(apiTokens)
      .set({ revoked_at: ts })
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.owner_id, userId)))
      .run();
    if (result.changes === 0) throw notFound('接入不存在');
    return { data: { id: tokenId, revoked_at: ts } };
  });
}
```

- [ ] **Step 6: 在 server.ts 注册 agentRoutes**

在原有路由注册区块（如 opds 等根级路由附近）追加：

```ts
app.register(agentRoutes);
```

（`agentRoutes` 已在 Task 3 Step 4 的 import 中；若当时选择创建空占位文件，现在直接替换为上述完整实现即可。）

- [ ] **Step 7: 运行确认通过**

Run: `pnpm --filter @redesk/api test src/routes/agent.test.ts`
Expected: PASS（7 个用例）。

- [ ] **Step 8: 类型检查 + 全量回归**

Run: `pnpm typecheck`
Run: `pnpm --filter @redesk/api test`
Expected: 均通过。

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas.ts apps/api/src/routes/agent.ts apps/api/src/config.ts apps/api/src/server.ts apps/api/src/routes/agent.test.ts
git commit -m "feat(api): agent 接入路由（skill 链接/令牌交换/接入管理）"
```

---

### Task 5: 书籍边界强制（源链接白名单 + 字段白名单 + 审计）

**Files:**
- Test: `apps/api/src/routes/agent-books.test.ts`
- Modify: `apps/api/src/routes/books.ts`（metadata/fetch、POST /books、PATCH /books/:id、metadata/apply）
- Modify: `doc/说明/外部Agent-Skill授权设计说明.md`（§8.1 字段名勘误）

- [ ] **Step 1: 写失败测试**

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';

vi.mock('../lib/book-metadata', () => ({
  fetchBookMetadataFromUrl: vi.fn(),
}));

import { fetchBookMetadataFromUrl } from '../lib/book-metadata';

const mockedFetch = vi.mocked(fetchBookMetadataFromUrl);

let app: FastifyInstance;
let sqlite: ReturnType<typeof getSqlite>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createAgentToken(scopes: string[]): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/agent/connections',
    payload: { name: '测试Agent', scopes },
  });
  const { code } = created.json().data;
  const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code } });
  return ex.json().data.access_token;
}

async function createBookViaAgent(token: string, payload: Record<string, unknown>): Promise<{ id: number }> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/books', headers: auth(token), payload });
  return res.json().data as { id: number };
}

async function createBookViaSession(payload: Record<string, unknown>): Promise<{ id: number }> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/books', payload });
  return res.json().data as { id: number };
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Agent 书籍操作边界', () => {
  it('metadata/fetch：白名单外源链接 → 403 且不触发抓取', async () => {
    const token = await createAgentToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books/metadata/fetch',
      headers: auth(token),
      payload: { source_url: 'https://evil.example.com/book' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('metadata/fetch：豆瓣链接 → 放行并返回元数据', async () => {
    mockedFetch.mockResolvedValueOnce({ title: '测试书', author: '作者', metadata_source: 'douban' });
    const token = await createAgentToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books/metadata/fetch',
      headers: auth(token),
      payload: { source_url: 'https://book.douban.com/subject/123/' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('测试书');
    expect(mockedFetch).toHaveBeenCalledWith('https://book.douban.com/subject/123/');
  });

  it('创建：白名单外 source_url → 403', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', source_url: 'https://evil.example.com/book' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('创建：status 等非白名单字段 → 403', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', status: 'READING' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('创建：豆瓣 source_url 正常创建', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', author: '作者', source_url: 'https://book.douban.com/subject/123/' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('测试书');
  });

  it('更新：visibility 等非白名单字段 → 403', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题', source_url: 'https://book.douban.com/subject/123/' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { visibility: 'PUBLIC' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('更新：title 等白名单字段 → 200', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { title: '新标题' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('新标题');
  });

  it('更新：白名单外 source_url → 403', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaSession({ title: '浏览器录入', source_url: 'https://example.com/x' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { source_url: 'https://evil.example.com/y' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('apply fetch_cover：非白名单书源 → 403 且字段不落库', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaSession({ title: '浏览器录入', source_url: 'https://example.com/x' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { title: '不应生效' }, fetch_cover: true },
    });
    expect(res.statusCode).toBe(403);
    const book = sqlite.prepare('SELECT title FROM books WHERE id = ?').get(created.id) as { title: string };
    expect(book.title).toBe('浏览器录入');
  });

  it('apply：白名单书源 → 200', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题', source_url: 'https://book.douban.com/subject/123/' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { title: '新标题' } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('浏览器（非 agent）创建不受源链接白名单限制', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      payload: { title: '浏览器录入', source_url: 'https://example.com/x' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('审计日志记录 agent 写操作', async () => {
    const token = await createAgentToken(['books:create']);
    await app.inject({ method: 'POST', url: '/api/v1/books', headers: auth(token), payload: { title: '审计测试' } });
    const row = sqlite.prepare(`SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'books.create' AND result = 'success'`).get() as { c: number };
    expect(Number(row.c)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @redesk/api test src/routes/agent-books.test.ts`
Expected: FAIL——「白名单外 source_url → 403」「status 字段 → 403」「visibility → 403」「apply fetch_cover 非白名单 → 403」「审计日志」等用例当前会拿到 200 或 0 条审计。

- [ ] **Step 3: 修改 books.ts 顶部 import**

追加：

```ts
import { assertAgentSourceUrl, writeAuditLog } from '../lib/agent-token';
```

在模块级（路由文件内、app 注册之前）追加字段白名单常量：

```ts
const AGENT_BOOK_FIELDS = new Set([
  'title',
  'author',
  'subtitle',
  'publisher',
  'publish_year',
  'description',
  'source_url',
  'translator',
  'original_title',
  'page_count',
  'category_id',
  'genre_category_id',
  'tag_ids',
  'entry_reason',
]);
```

- [ ] **Step 4: POST /books 增加 agent 约束**

在 `app.post('/books', ...)` 处理器中，`const userId = requirePermission(req, 'use');` 之后、multipart 分支之前追加：

```ts
if (req.apiIdentity && contentType.includes('multipart/form-data')) {
  throw forbidden('Agent 不支持文件上传方式创建书籍');
}
```

在 JSON 分支（`const input = validate(createBookSchema, req.body);` 之后、`createBookRecord` 调用之前）追加：

```ts
if (req.apiIdentity) {
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const blocked = Object.keys(raw).filter((key) => !AGENT_BOOK_FIELDS.has(key));
  if (blocked.length > 0) throw forbidden(`Agent 不能使用字段: ${blocked.join(', ')}`);
  assertAgentSourceUrl(req, typeof raw.source_url === 'string' ? raw.source_url : null);
}
```

在 `const book = await createBookRecord(...)` 成功之后追加审计：

```ts
if (req.apiIdentity) {
  writeAuditLog({
    ownerId: req.apiIdentity.ownerId,
    tokenId: req.apiIdentity.tokenId,
    req,
    action: 'books.create',
    resourceType: 'book',
    resourceId: String(book.id),
    result: 'success',
  });
}
```

（`forbidden` 已从 `../lib/errors` 导入，无需新增。）

- [ ] **Step 5: POST /books/metadata/fetch 增加源链接校验**

在 `const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';` 之后、非空校验处追加：

```ts
assertAgentSourceUrl(req, sourceUrl || null);
```

- [ ] **Step 6: PATCH /books/:id 增加 agent 约束**

在 `const input = validate(updateBookSchema, req.body);` 之后、任何 DB 写入之前追加：

```ts
if (req.apiIdentity) {
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const blocked = Object.keys(raw).filter((key) => !AGENT_BOOK_FIELDS.has(key));
  if (blocked.length > 0) throw forbidden(`Agent 不能使用字段: ${blocked.join(', ')}`);
  assertAgentSourceUrl(req, typeof raw.source_url === 'string' ? raw.source_url : null);
}
```

在更新成功、`return { data: updatedBook }` 之前追加审计：

```ts
if (req.apiIdentity) {
  writeAuditLog({
    ownerId: req.apiIdentity.ownerId,
    tokenId: req.apiIdentity.tokenId,
    req,
    action: 'books.update',
    resourceType: 'book',
    resourceId: String(bookId),
    result: 'success',
  });
}
```

- [ ] **Step 7: POST /books/:id/metadata/apply 增加源链接校验与审计**

在处理器中「allowedFields 处理之后、`if (Object.keys(updates).length > 0)` 的 DB 更新之前」追加：

```ts
const fetchCoverSourceUrl = fetchCover ? ((updates.source_url as string | undefined) ?? book.source_url) : null;
if (req.apiIdentity) assertAgentSourceUrl(req, fetchCoverSourceUrl);
```

随后把原 `if (fetchCover)` 块内重新抓取用到的 URL 变量统一替换为上面预计算的 `fetchCoverSourceUrl`（原逻辑：`updates.source_url ?? book.source_url`——注意 allowedFields 不含 source_url，所以该值就是 `book.source_url`，语义不变）。

在处理器成功返回 `{ data: {...} }` 之前追加审计：

```ts
if (req.apiIdentity) {
  writeAuditLog({
    ownerId: req.apiIdentity.ownerId,
    tokenId: req.apiIdentity.tokenId,
    req,
    action: 'books.metadata_apply',
    resourceType: 'book',
    resourceId: String(bookId),
    result: 'success',
  });
}
```

- [ ] **Step 8: 运行确认通过**

Run: `pnpm --filter @redesk/api test src/routes/agent-books.test.ts`
Expected: PASS（12 个用例）。

- [ ] **Step 9: 勘误设计文档 §8.1**

打开 `doc/说明/外部Agent-Skill授权设计说明.md`，将 §8.1 表中 metadata/fetch 一行的字段名 `url` 改为 `source_url`（与真实路由字段一致），并检查 §7.1/§9 相关表述是否一致。

- [ ] **Step 10: 全量回归 + 提交**

Run: `pnpm --filter @redesk/api test`
Expected: 原有测试全部通过。

```bash
git add apps/api/src/routes/books.ts apps/api/src/routes/agent-books.test.ts doc/说明/外部Agent-Skill授权设计说明.md
git commit -m "feat(api): agent 书籍边界（源链接白名单/字段白名单/审计）"
```

---

### Task 6: 分类/标签审计与越权防护测试

**Files:**
- Test: `apps/api/src/routes/agent-categories.test.ts`
- Modify: `apps/api/src/routes/categories.ts`（POST /categories 成功路径追加审计）
- Modify: `apps/api/src/routes/tags.ts`（POST /tags 成功路径追加审计）

> 说明：ROUTE_SCOPE_MAP 只登记了 categories/tags 的 GET/POST，PATCH/DELETE 天然被 Task 3 的守卫拒绝（403），本任务不修改这两个处理器的读写逻辑，只补「写操作审计」与「越权/归属验证」。categories.ts / tags.ts 现有处理器通过 `requirePermission` 拿到 ownerId，Task 3 已让该函数在 agent 请求下返回 `req.apiIdentity.ownerId`，owner 边界自动生效，零侵入。

- [ ] **Step 1: 写失败测试**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';
import { generateAgentToken } from '../lib/agent-token';

let app: FastifyInstance;
let sqlite: ReturnType<typeof getSqlite>;
let ownerId: number;

async function seedUser(): Promise<number> {
  const ts = new Date().toISOString();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  return Number(
    sqlite
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`agent-user-${suffix}`, passwordHash, 'Agent测试用户', 1, 1, 0, ts, ts).lastInsertRowid,
  );
}

function seedToken(scopes: string[]) {
  const { plaintext, hash } = generateAgentToken();
  const ts = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO api_tokens (owner_id, name, token_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .run(ownerId, '测试Agent', hash, JSON.stringify(scopes), null, ts);
  return plaintext;
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  ownerId = await seedUser();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Agent 分类/标签边界', () => {
  it('列出分类 → 200', async () => {
    const token = seedToken(['categories:manage']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('新建分类成功且归属当前 owner', async () => {
    const token = seedToken(['categories:manage']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '推理小说', type: 'PERSONAL' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('推理小说');
    const row = sqlite.prepare('SELECT owner_id FROM categories WHERE id = ?').get(res.json().data.id) as { owner_id: number };
    expect(row.owner_id).toBe(ownerId);
  });

  it('重名分类 → 409', async () => {
    const token = seedToken(['categories:manage']);
    const headers = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '已存在', type: 'PERSONAL' } });
    const dup = await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '已存在', type: 'PERSONAL' } });
    expect(dup.statusCode).toBe(409);
  });

  it('列出标签 → 200', async () => {
    const token = seedToken(['tags:manage']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tags',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('新建标签成功', async () => {
    const token = seedToken(['tags:manage']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '待读' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('待读');
  });

  it('修改分类 → 403（scope 未授权，ROUTE_SCOPE_MAP 未登记 PATCH）', async () => {
    const token = seedToken(['categories:manage']);
    const headers = { authorization: `Bearer ${token}` };
    const created = await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '禁改' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${created.json().data.id}`,
      headers,
      payload: { name: '改名' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('删除标签 → 403（scope 未授权）', async () => {
    const token = seedToken(['tags:manage']);
    const headers = { authorization: `Bearer ${token}` };
    const created = await app.inject({ method: 'POST', url: '/api/v1/tags', headers, payload: { name: '不可删' } });
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/tags/${created.json().data.id}`, headers });
    expect(res.statusCode).toBe(403);
  });

  it('新建分类/标签写入审计日志', async () => {
    const token = seedToken(['categories:manage', 'tags:manage']);
    const headers = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '审计分类' } });
    await app.inject({ method: 'POST', url: '/api/v1/tags', headers, payload: { name: '审计标签' } });
    const catAudit = sqlite.prepare(`SELECT action FROM audit_logs WHERE owner_id = ? AND action = 'categories.create'`).all(ownerId);
    const tagAudit = sqlite.prepare(`SELECT action FROM audit_logs WHERE owner_id = ? AND action = 'tags.create'`).all(ownerId);
    expect(catAudit.length).toBeGreaterThanOrEqual(1);
    expect(tagAudit.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @redesk/api test src/routes/agent-categories.test.ts`

Expected: 8 个用例中，除「修改分类 → 403」「删除标签 → 403」已在 Task 3 守卫下通过外，「新建分类/标签写入审计日志」用例失败（audit_logs 暂无 categories.create / tags.create 记录），其余读写用例通过。

- [ ] **Step 3: 修改 categories.ts**

在 import 区追加：

```ts
import { writeAuditLog } from '../lib/agent-token';
```

在 POST /categories 处理器中，`.returning().get()` 之后、`return { data: { ...category, book_count: 0 } };` 之前追加：

```ts
if (req.apiIdentity) {
  writeAuditLog({
    ownerId: req.apiIdentity.ownerId,
    tokenId: req.apiIdentity.tokenId,
    req,
    action: 'categories.create',
    resourceType: 'category',
    resourceId: String(category.id),
    result: 'success',
  });
}
```

- [ ] **Step 4: 修改 tags.ts**

在 import 区追加：

```ts
import { writeAuditLog } from '../lib/agent-token';
```

在 POST /tags 处理器中，`.returning().get()` 之后、`return { data: { ...tag, book_count: 0 } };` 之前追加：

```ts
if (req.apiIdentity) {
  writeAuditLog({
    ownerId: req.apiIdentity.ownerId,
    tokenId: req.apiIdentity.tokenId,
    req,
    action: 'tags.create',
    resourceType: 'tag',
    resourceId: String(tag.id),
    result: 'success',
  });
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm --filter @redesk/api test src/routes/agent-categories.test.ts`
Expected: PASS（8 个用例）。

- [ ] **Step 6: 类型检查 + 全量回归 + 提交**

Run: `pnpm typecheck`
Run: `pnpm --filter @redesk/api test`
Expected: 均通过。

```bash
git add apps/api/src/routes/categories.ts apps/api/src/routes/tags.ts apps/api/src/routes/agent-categories.test.ts
git commit -m "feat(api): 分类/标签 agent 审计与越权防护测试"
```

---

### Task 7: Web 设置页 Agent 接入分区

**Files:**
- Create: `apps/web/src/hooks/use-agent-connections.ts` — 数据 hook（列表/创建/吊销）
- Create: `apps/web/src/routes/settings/agent-section.tsx` — 设置页 Agent 分区组件
- Modify: `apps/web/src/routes/settings/ai-tab.tsx`（在「功能状态」卡片之后渲染 AgentSection）

> 对接 Task 4 已定契约：`POST /api/v1/agent/connections` 返回 `{ data: { id, name, scopes, expires_at, link, code, created_at } }`；`GET /api/v1/agent/connections` 返回 `{ data: [{ id, name, scopes, expires_at, last_used_at, revoked_at, activated, created_at }] }`；`POST /api/v1/agent/connections/:id/revoke` 返回 `{ data: { id, revoked_at } }`。三个接口均要求管理员会话（浏览器 cookie），前端经 `@/lib/api` 的 `api.get/post` 调用即可。能力范围标签复用 `@redesk/shared` 的 `AGENT_SCOPES` 常量（web 已有 `@redesk/shared` 依赖）。

- [ ] **Step 1: 新建 use-agent-connections.ts**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AgentConnection {
  id: number;
  name: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  activated: boolean;
  created_at: string;
}

export interface CreateAgentConnectionInput {
  name: string;
  scopes: string[];
}

export interface CreateAgentConnectionResult {
  id: number;
  name: string;
  scopes: string[];
  expires_at: string | null;
  link: string;
  code: string;
  created_at: string;
}

export function useAgentConnections() {
  return useQuery({
    queryKey: ['agent-connections'],
    queryFn: () => api.get<AgentConnection[]>('/agent/connections'),
  });
}

export function useCreateAgentConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentConnectionInput) =>
      api.post<CreateAgentConnectionResult>('/agent/connections', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-connections'] });
    },
  });
}

export function useRevokeAgentConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<{ id: number; revoked_at: string }>(`/agent/connections/${id}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-connections'] });
    },
  });
}
```

- [ ] **Step 2: 新建 agent-section.tsx**

组件结构：顶部说明 →「新建接入」卡片（名称输入 + 能力范围按钮组 + 生成按钮）→ 生成成功后的链接展示与复制 →「已创建的接入」列表（状态徽标：待激活/已激活/已吊销、scope 标签、创建/最近使用时间、吊销按钮）。scope 选择用按钮组（与 ai-tab.tsx 提供商选择同款交互，项目内无 checkbox 组件，不引入新依赖）。

```tsx
import { useCallback, useMemo, useState } from 'react';
import { Bot, Check, Copy, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { AGENT_SCOPES } from '@redesk/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useAgentConnections,
  useCreateAgentConnection,
  useRevokeAgentConnection,
  type CreateAgentConnectionResult,
} from '@/hooks/use-agent-connections';
import { cn } from '@/lib/utils';
import type { StatusMessage } from './types';

const SCOPE_LABELS: Record<string, string> = {
  'books:read': '查看书籍',
  'books:create': '添加书籍',
  'books:update_metadata': '更新书籍元数据',
  'categories:manage': '分类管理',
  'tags:manage': '标签管理',
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'books:read': '检索书库、查看书籍详情、触发元数据预取',
  'books:create': '创建新书（标题必填）',
  'books:update_metadata': '更新书籍属性与来源链接',
  'categories:manage': '查看与新建分类（不能改名/删除）',
  'tags:manage': '查看与新建标签（不能改名/删除）',
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

export function AgentSection({ onToast }: { onToast: (msg: StatusMessage) => void }) {
  const connections = useAgentConnections();
  const createConnection = useCreateAgentConnection();
  const revokeConnection = useRevokeAgentConnection();

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['books:read', 'books:create']);
  const [created, setCreated] = useState<CreateAgentConnectionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = useCallback((scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      onToast({ type: 'error', text: '请填写接入名称' });
      return;
    }
    if (scopes.length === 0) {
      onToast({ type: 'error', text: '请至少选择一个能力范围' });
      return;
    }
    try {
      const result = await createConnection.mutateAsync({ name: name.trim(), scopes });
      setCreated(result);
      setName('');
      onToast({ type: 'info', text: '接入链接已生成（10 分钟内有效）' });
    } catch {
      onToast({ type: 'error', text: '生成失败，请检查权限' });
    }
  }, [name, scopes, createConnection, onToast]);

  const handleCopy = useCallback(async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast({ type: 'error', text: '复制失败，请手动复制' });
    }
  }, [created, onToast]);

  const handleRevoke = useCallback(
    async (id: number, connName: string) => {
      if (!window.confirm(`吊销接入「${connName}」？其令牌将立即失效，且无法恢复。`)) return;
      try {
        await revokeConnection.mutateAsync(id);
        onToast({ type: 'info', text: '已吊销' });
      } catch {
        onToast({ type: 'error', text: '吊销失败' });
      }
    },
    [revokeConnection, onToast],
  );

  const list = useMemo(() => connections.data ?? [], [connections.data]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Agent 接入
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs leading-5 text-muted-foreground">
          生成一次性接入链接发给外部 AI（ChatGPT / Claude 等）。AI 读取能力清单后，可在你授予的范围内协助添加与管理书籍。链接 10 分钟内有效，兑换令牌后自动失效。
        </p>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">接入名称</p>
            <Input
              placeholder="例如：我的Claude / 写作助手"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">能力范围</p>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  title={SCOPE_DESCRIPTIONS[scope] ?? scope}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    scopes.includes(scope)
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-popover text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => toggleScope(scope)}
                >
                  {SCOPE_LABELS[scope] ?? scope}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} disabled={createConnection.isPending}>
            {createConnection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            生成接入链接
          </Button>
        </div>

        {created ? (
          <div className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
            <p className="text-sm font-medium text-foreground">接入链接（仅本次显示）</p>
            <div className="flex gap-2">
              <Input readOnly value={created.link} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="复制链接">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              将此链接发给 AI。10 分钟内有效，兑换令牌后自动失效。
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">已创建的接入</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => connections.refetch()}
              disabled={connections.isFetching}
            >
              {connections.isFetching ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              刷新
            </Button>
          </div>

          {connections.isLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-border py-6 text-sm text-muted-foreground">
              加载中...
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">
              还没有创建过 Agent 接入
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{conn.name}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          conn.revoked_at
                            ? 'bg-muted text-muted-foreground'
                            : conn.activated
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {conn.revoked_at ? '已吊销' : conn.activated ? '已激活' : '待激活'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {conn.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {SCOPE_LABELS[scope] ?? scope}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      创建于 {formatDate(conn.created_at)}
                      {conn.last_used_at ? ` · 最近使用 ${formatDate(conn.last_used_at)}` : ''}
                    </p>
                  </div>
                  {conn.revoked_at ? null : (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(conn.id, conn.name)}>
                      <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                      吊销
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 修改 ai-tab.tsx 渲染 AgentSection**

在文件顶部 import 区追加：

```tsx
import { AgentSection } from './agent-section';
```

在「功能状态」Card 结束（`</Card>`）与底部「保存配置」按钮块（`<div className="flex justify-end">`）之间插入：

```tsx
      <AgentSection onToast={onToast} />
```

（Agent 接入与 LLM 配置相互独立，不参与「保存配置」提交；onToast 复用现有 toast 通道。）

- [ ] **Step 4: 验证**

Run: `pnpm typecheck`
Run: `pnpm lint`
Run: `pnpm --filter @redesk/web build`
Expected: 均通过。

- [ ] **Step 5: 浏览器手工验证清单**

1. 启动 `pnpm dev`，管理员登录 → 设置 → AI 标签页。
2. 在「Agent 接入」输入名称、勾选若干能力范围 → 生成接入链接 → 出现绿色提示块与可复制链接。
3. 用无痕窗口打开该链接 → 页面展示能力清单（含 connect code），或返回 skill JSON（取决于 Accept）。
4. 用终端以 code 调 `POST /agent/token/exchange` → 回到设置页点「刷新」→ 该接入状态变为「已激活」，且「最近使用」出现时间。
5. 点「吊销」→ 确认弹窗 → 状态变「已吊销」，吊销按钮消失；用旧令牌调业务 API 返回 401。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/hooks/use-agent-connections.ts apps/web/src/routes/settings/agent-section.tsx apps/web/src/routes/settings/ai-tab.tsx
git commit -m "feat(web): 设置页 Agent 接入分区（生成链接/管理/吊销）"
```

---

### Task 8: 全量自检与收尾

**Files:**
- Modify: 无（只读自检）

- [ ] **Step 1: 全量验证**

Run: `pnpm typecheck`
Run: `pnpm lint`
Run: `pnpm --filter @redesk/api test`
Run: `pnpm build`
Expected: 全部通过。

- [ ] **Step 2: 迁移红线自检**（对照 AGENTS.md「数据库迁移红线」）

1. 检查 `drizzle/meta/_journal.json` 末尾 idx 与 `drizzle/` 下 `00NN_*.sql` 数量一致（只有 0036 新增一条）。
2. 确认 `0036_*.sql` 是唯一新增迁移，未修改任何已应用迁移正文、未删除文件、journal 只 append。
3. 空库演练已做（Task 1 Step 5）；若演练库残留，确认 `$env:TEMP\redesk-migrate-drill.db` 已删除。
4. 本次新增的是独立新表，不触碰「可锁定数据」段（对照《数据库兼容性与可锁定数据》）。

- [ ] **Step 3: 中文编码自检**

`git diff` 全文扫描：
1. 无 `\uXXXX` 转义中文（唯一允许的转义是 CSV 场景的 `\uFEFF`，本计划不涉及）。
2. 新文件全部 UTF-8（无 BOM）。
3. 用 grep 抽查：`grep -rn "u4e66" apps packages` 无命中（证明没有写成转义）。

- [ ] **Step 4: 规范与占位符扫描**

1. 命名：DB 列/API 字段 snake_case；TS 变量 camelCase；组件 PascalCase；文件 kebab-case / PascalCase.tsx。
2. 无 TODO / FIXME / xxx / 示例占位逻辑残留。
3. scope 常量、路由映射、审计 action 命名全表核对一致：

| 作用点 | 值 |
| --- | --- |
| AGENT_SCOPES | books:read / books:create / books:update_metadata / categories:manage / tags:manage |
| ROUTE_SCOPE_MAP | books GET/duplicates/:id/metadata-fetch → books:read；POST books → books:create；PATCH books/:id、metadata/apply → books:update_metadata；categories/tags GET+POST → 对应 manage |
| 审计 action | agent.token_exchange / scope.denied / source_url.denied / books.create / books.update / books.metadata_apply / categories.create / tags.create |

4. 确认所有 agent 专属测试文件（agent-token.test.ts / agent.test.ts / agent-scope.test.ts / agent-books.test.ts / agent-categories.test.ts）命名与文件结构总览一致，且都在 `pnpm --filter @redesk/api test` 全量跑动范围内。

- [ ] **Step 5: 端到端冒烟（本地手动）**

1. `pnpm dev` 启动前后端。
2. 设置 → AI → 生成接入链接。
3. 打开链接读取能力清单 → 用 code 换令牌 → 用令牌依次调用：
   - `GET /api/v1/books`（books:read）→ 200
   - `POST /api/v1/books`（books:create，title + source_url=豆瓣链接）→ 200
   - `POST /api/v1/books`（source_url=非豆瓣域名）→ 403 + audit_logs 出现 source_url.denied
   - `PATCH /api/v1/categories/1` → 403
4. 吊销后旧令牌 → 401。
5. 以上任一步失败，回滚该任务相关 commit 后修复重跑。

- [ ] **Step 6: 收尾说明（不写代码，仅告知用户）**

- 完成范围：Phase 1 全部（数据层 / 核心库 / 全局守卫 / 接入路由 / 书籍与分类标签边界 / Web UI / 审计）。
- 明确不包含（后续阶段候选）：书名服务端搜索、pending-action 后端表、非豆瓣信息源、MCP server 形态、非管理员账号接入、scope 粒度细化（如 categories 只读/读写拆分）。

---

**执行方式（开始前请与用户确认）：**

- 选项 A：Subagent-Driven（推荐）——按任务逐个派发 subagent 实现，每任务独立 commit，主会话负责审查与验收。
- 选项 B：Inline Execution——在当前会话内按 Task 1→8 顺序逐任务实现，随时可提问。
- 选项 C：先由用户 review 本计划，调整后再开始。