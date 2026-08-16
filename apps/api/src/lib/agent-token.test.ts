import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { rmSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { settings } from '@redesk/db';
import {
  AGENT_SOURCE_URL_WHITELIST_DEFAULT,
  SETTINGS_KEY,
} from '@redesk/shared';
import { getDb, getSqlite, initDatabase } from '../db';
import { hashPassword } from './auth';
import { AppError } from './errors';
import { setSetting } from './settings-store';
import {
  assertAgentSourceUrl,
  generateAgentToken,
  generateConnectCode,
  getAgentSourceUrlWhitelist,
  isSourceUrlAllowed,
  parseApiToken,
  parseScopes,
  ROUTE_SCOPE_MAP,
  sha256Hex,
  writeAuditLog,
} from './agent-token';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-agent-token-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;
  process.env.NODE_ENV = 'test';
  process.env.AUTH_DISABLED = 'true';
  process.env.DATABASE_URL = `${root}/redesk.db`;
  process.env.STORAGE_DIR = `${root}/storage`;
  process.env.SPA_DIR = `${root}/spa`;
  process.env.SESSION_SECRET = 'test-session-secret-12345678901234567890';
  process.env.WEB_URL = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'silent';
  return { root };
});

type SqliteDatabase = ReturnType<typeof getSqlite>;

let sqlite: SqliteDatabase;
let ownerId: number;

interface ReqStub {
  id?: string;
  method?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, string>;
  apiIdentity?: { ownerId: number; tokenId: number; scopes: string[] };
}

function makeReq(partial?: ReqStub): FastifyRequest {
  return {
    id: 'req-test-1',
    method: 'POST',
    url: '/api/v1/books',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'agent-token-test' },
    ...partial,
  } as unknown as FastifyRequest;
}

function seedApiToken(scopes: string[], opts: { revoked?: boolean; expiresAt?: string | null } = {}): {
  id: number;
  plaintext: string;
} {
  const { plaintext, hash } = generateAgentToken();
  const ts = new Date().toISOString();
  const id = Number(
    sqlite
      .prepare(
        `INSERT INTO api_tokens (owner_id, name, token_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(ownerId, '核心库测试令牌', hash, JSON.stringify(scopes), opts.expiresAt ?? null, opts.revoked ? ts : null, ts)
      .lastInsertRowid,
  );
  return { id, plaintext };
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  const ts = new Date().toISOString();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  ownerId = Number(
    sqlite
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`agent-token-user-${suffix}`, passwordHash, 'Agent核心库测试用户', 1, 1, 0, ts, ts)
      .lastInsertRowid,
  );
});

afterAll(() => {
  try {
    getSqlite().close();
  } catch {
    // 连接可能未初始化
  }
  rmSync(testEnv.root, { recursive: true, force: true });
});

beforeEach(() => {
  getDb().delete(settings).where(eq(settings.key, SETTINGS_KEY.AGENT_SOURCE_URL_WHITELIST)).run();
});

describe('agent-token 工具函数', () => {
  it('sha256Hex 输出 64 位小写十六进制', () => {
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sha256Hex 输出确定且与标准向量一致', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('generateAgentToken 生成 rdk_live_ 前缀且每次不同', () => {
    const a = generateAgentToken();
    const b = generateAgentToken();
    expect(a.plaintext.startsWith('rdk_live_')).toBe(true);
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).toBe(sha256Hex(a.plaintext));
    expect(a.hash).not.toBe(b.hash);
  });

  it('generateConnectCode 生成随机授权码', () => {
    const code = generateConnectCode();
    expect(code.plaintext.length).toBeGreaterThan(20);
    expect(code.hash).toBe(sha256Hex(code.plaintext));
  });

  it('parseScopes 解析 JSON 数组', () => {
    expect(parseScopes('["books:read","books:create"]')).toEqual(['books:read', 'books:create']);
    expect(parseScopes('[]')).toEqual([]);
  });

  it('parseScopes 拒绝坏数据返回空数组', () => {
    expect(parseScopes('not-json')).toEqual([]);
    expect(parseScopes('{"a":1}')).toEqual([]);
    expect(parseScopes('123')).toEqual([]);
    expect(parseScopes('[1,"books:read"]')).toEqual(['books:read']);
  });
});

describe('ROUTE_SCOPE_MAP', () => {
  it('覆盖 books 路由的读/写/元数据 scope', () => {
    expect(ROUTE_SCOPE_MAP['GET /api/v1/books']).toBe('books:read');
    expect(ROUTE_SCOPE_MAP['GET /api/v1/books/duplicates']).toBe('books:read');
    expect(ROUTE_SCOPE_MAP['GET /api/v1/books/:id']).toBe('books:read');
    expect(ROUTE_SCOPE_MAP['POST /api/v1/books/metadata/fetch']).toBe('books:read');
    expect(ROUTE_SCOPE_MAP['POST /api/v1/books']).toBe('books:create');
    expect(ROUTE_SCOPE_MAP['PATCH /api/v1/books/:id']).toBe('books:update_metadata');
    expect(ROUTE_SCOPE_MAP['POST /api/v1/books/:id/metadata/apply']).toBe('books:update_metadata');
  });

  it('覆盖 categories/tags 的 GET/POST', () => {
    expect(ROUTE_SCOPE_MAP['GET /api/v1/categories']).toBe('categories:manage');
    expect(ROUTE_SCOPE_MAP['POST /api/v1/categories']).toBe('categories:manage');
    expect(ROUTE_SCOPE_MAP['GET /api/v1/tags']).toBe('tags:manage');
    expect(ROUTE_SCOPE_MAP['POST /api/v1/tags']).toBe('tags:manage');
  });

  it('未登记路由返回 undefined（默认拒绝）', () => {
    expect(ROUTE_SCOPE_MAP['PATCH /api/v1/categories/:id']).toBeUndefined();
    expect(ROUTE_SCOPE_MAP['DELETE /api/v1/tags/:id']).toBeUndefined();
    expect(ROUTE_SCOPE_MAP['GET /api/v1/settings']).toBeUndefined();
  });
});

describe('parseApiToken', () => {
  it('缺少 authorization 头或非 rdk_ 前缀返回 null', () => {
    expect(parseApiToken(makeReq())).toBeNull();
    expect(parseApiToken(makeReq({ headers: { authorization: 'Basic abc' } }))).toBeNull();
    expect(parseApiToken(makeReq({ headers: { authorization: 'Bearer oops' } }))).toBeNull();
    expect(parseApiToken(makeReq({ headers: { authorization: 'Bearer ' } }))).toBeNull();
  });

  it('有效令牌返回身份信息并更新 last_used_at', () => {
    const { id, plaintext } = seedApiToken(['books:read', 'books:create']);
    const identity = parseApiToken(makeReq({ headers: { authorization: `Bearer ${plaintext}` } }));
    expect(identity).toEqual({ ownerId, tokenId: id, scopes: ['books:read', 'books:create'] });
    const row = sqlite.prepare('SELECT last_used_at FROM api_tokens WHERE id = ?').get(id) as { last_used_at: string | null };
    expect(row.last_used_at).not.toBeNull();
  });

  it('已吊销令牌返回 null', () => {
    const { plaintext } = seedApiToken(['books:read'], { revoked: true });
    expect(parseApiToken(makeReq({ headers: { authorization: `Bearer ${plaintext}` } }))).toBeNull();
  });

  it('已过期令牌返回 null', () => {
    const { plaintext } = seedApiToken(['books:read'], { expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(parseApiToken(makeReq({ headers: { authorization: `Bearer ${plaintext}` } }))).toBeNull();
  });

  it('未知令牌返回 null', () => {
    expect(parseApiToken(makeReq({ headers: { authorization: 'Bearer rdk_live_unknown-token' } }))).toBeNull();
  });
});

describe('getAgentSourceUrlWhitelist', () => {
  it('未配置时返回默认白名单 book.douban.com', () => {
    expect(getAgentSourceUrlWhitelist()).toEqual([...AGENT_SOURCE_URL_WHITELIST_DEFAULT]);
  });

  it('读取 settings 中配置的 JSON 数组', () => {
    setSetting(SETTINGS_KEY.AGENT_SOURCE_URL_WHITELIST, '["book.douban.com","book.douban.com.cn"]');
    expect(getAgentSourceUrlWhitelist()).toEqual(['book.douban.com', 'book.douban.com.cn']);
  });

  it('settings 值为非法 JSON 时回退默认白名单', () => {
    setSetting(SETTINGS_KEY.AGENT_SOURCE_URL_WHITELIST, 'not-json');
    expect(getAgentSourceUrlWhitelist()).toEqual([...AGENT_SOURCE_URL_WHITELIST_DEFAULT]);
  });
});

describe('isSourceUrlAllowed', () => {
  const whitelist = ['book.douban.com'];

  it('仅放行白名单域名及其子域', () => {
    expect(isSourceUrlAllowed('https://book.douban.com/subject/1001/', whitelist)).toBe(true);
    expect(isSourceUrlAllowed('https://m.book.douban.com/subject/1001/', whitelist)).toBe(true);
    expect(isSourceUrlAllowed('https://evil.example.com/', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('http://127.0.0.1:8787/secret', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('file:///etc/passwd', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('not-a-url', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('https://book.douban.com.evil.com/', whitelist)).toBe(false);
    expect(isSourceUrlAllowed('https://evil.com/book.douban.com/', whitelist)).toBe(false);
  });

  it('处理白名单项自带 http(s) 协议前缀的情况', () => {
    expect(isSourceUrlAllowed('https://book.douban.com/subject/1001/', ['https://book.douban.com'])).toBe(true);
  });
});

describe('assertAgentSourceUrl', () => {
  function agentReq(): FastifyRequest {
    return makeReq({ apiIdentity: { ownerId, tokenId: 100, scopes: ['books:create'] } });
  }

  it('非 agent 请求（无 apiIdentity）不校验', () => {
    expect(() => assertAgentSourceUrl(makeReq(), 'https://evil.example.com/')).not.toThrow();
  });

  it('agent 请求白名单 URL 放行', () => {
    expect(() => assertAgentSourceUrl(agentReq(), 'https://book.douban.com/subject/1001/')).not.toThrow();
  });

  it('agent 请求非白名单 URL 抛 FORBIDDEN 并写 source_url.denied 审计', () => {
    let err: unknown;
    try {
      assertAgentSourceUrl(agentReq(), 'https://evil.example.com/book');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('FORBIDDEN');
    const row = sqlite
      .prepare(`SELECT owner_id, token_id, action, result FROM audit_logs WHERE action = 'source_url.denied' ORDER BY id DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    expect(row).toBeTruthy();
    expect(row?.owner_id).toBe(ownerId);
    expect(row?.token_id).toBe(100);
    expect(row?.result).toBe('denied');
  });

  it('agent 请求缺失 source_url 同样拒绝并审计', () => {
    expect(() => assertAgentSourceUrl(agentReq(), null)).toThrow(AppError);
    expect(() => assertAgentSourceUrl(agentReq(), undefined)).toThrow(AppError);
    const count = sqlite.prepare(`SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'source_url.denied'`).get() as { c: number };
    expect(Number(count.c)).toBeGreaterThan(0);
  });
});

describe('writeAuditLog', () => {
  it('写入含请求信息的审计日志', () => {
    writeAuditLog({
      ownerId,
      tokenId: 7,
      req: makeReq({ headers: { 'user-agent': 'agent-test-ua' } }),
      action: 'books.create',
      resourceType: 'book',
      resourceId: '42',
      result: 'success',
    });
    const row = sqlite
      .prepare(`SELECT owner_id, token_id, request_id, method, path, ip, user_agent, resource_type, resource_id, result FROM audit_logs WHERE action = 'books.create' ORDER BY id DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    expect(row).toBeTruthy();
    expect(row?.owner_id).toBe(ownerId);
    expect(row?.token_id).toBe(7);
    expect(row?.request_id).toBe('req-test-1');
    expect(row?.method).toBe('POST');
    expect(row?.path).toBe('/api/v1/books');
    expect(row?.ip).toBe('127.0.0.1');
    expect(row?.user_agent).toBe('agent-test-ua');
    expect(row?.resource_type).toBe('book');
    expect(row?.resource_id).toBe('42');
    expect(row?.result).toBe('success');
  });

  it('无 req 时请求相关字段为空，denied 结果正常写入', () => {
    writeAuditLog({ ownerId, tokenId: null, action: 'scope.denied', result: 'denied' });
    const row = sqlite
      .prepare(`SELECT token_id, request_id, method, path, ip, result FROM audit_logs WHERE action = 'scope.denied' ORDER BY id DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    expect(row).toBeTruthy();
    expect(row?.result).toBe('denied');
    expect(row?.token_id).toBeNull();
    expect(row?.request_id).toBeNull();
    expect(row?.method).toBeNull();
    expect(row?.path).toBeNull();
    expect(row?.ip).toBeNull();
  });
});