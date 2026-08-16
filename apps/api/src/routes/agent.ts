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
    const authBase = resolveBaseUrl(req);
    const fullLink = `${authBase}/agent/connect/${code}`;
    const skill = {
      skill_version: 2,
      name: token.name,
      scopes,
      base_url: `${authBase}/api/v1`,
      connect_code: code,
      authorization: {
        steps: [
          '先读取本说明（就是当前 GET 本链接返回的这个 JSON）。',
          '用授权码兑换访问令牌：POST `' +
            `${authBase}` +
            `/agent/token/exchange` +
            '`，请求体为 `{"code":"' +
            `${code}` +
            '"}`，请求头带 `Content-Type: application/json`。',
          '兑换成功会返回 `access_token`（形如 `rdk_live_xxx`）、`scopes`、`expires_at`。',
          '之后调用业务接口时，每个请求头都带上 `Authorization: Bearer <access_token>`，端点前缀为 `' +
            `${authBase}/api/v1` +
            '`。',
        ],
        exchange: {
          method: 'POST',
          url: `${authBase}/agent/token/exchange`,
          headers: { 'Content-Type': 'application/json' },
          body: { code },
        },
        usage: { header: 'Authorization', scheme: 'Bearer', base_url: `${authBase}/api/v1` },
        note: '授权码一次性使用，10 分钟内有效；换得的 access_token 为长期令牌，可被主人吊销。未兑换令牌前调用业务接口会返回未登录。',
      },
      capabilities: ALL_CAPABILITIES.filter((c) => scopes.includes(c.requires_scope)),
      conventions: CONVENTIONS,
    };

    if ((req.headers.accept ?? '').includes('text/html')) {
      const scopeText = scopes.map((s) => `\`${s}\``).join('、');
      const promptText = [
        `我已接入 Redesk（接入名称：${token.name}），授权范围：${scopeText}。`,
        `请用以下链接完成授权并操作我的书籍：`,
        ``,
        `授权链接：${fullLink}`,
        ``,
        `授权步骤：`,
        `1. 读取授权说明：GET ${fullLink}（此步不带 Authorization 头），获得授权码 code 与能力清单。`,
        `2. 用授权码兑换访问令牌：POST ${authBase}/agent/token/exchange，请求体为 {"code":"${code}"}，请求头带 Content-Type: application/json。兑换成功会返回 access_token（形如 rdk_live_xxx）、scopes、expires_at。`,
        `3. 之后调用业务接口时，每个请求头带上 Authorization: Bearer <access_token>，端点前缀为 ${authBase}/api/v1。`,
        ``,
        `约定：授权码一次性使用、10 分钟内有效；换得的 access_token 为长期令牌，可被主人吊销。未兑换令牌前调用业务接口会返回未登录。所有写操作（新增书籍、更新元数据、新建分类/标签）都必须先征求我的同意。`,
      ].join('\n');
      reply.type('text/html; charset=utf-8');
      return reply.send(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>Redesk Agent 接入</title></head>
<body style="font-family:system-ui;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.7">
<h1>Redesk Agent 接入</h1>
<p>接入名称：<strong>${escapeHtml(token.name)}</strong></p>
<p>授权范围：${scopes.map((s) => `<code>${escapeHtml(s)}</code>`).join('、')}</p>
<p>授权链接（一次性，10 分钟有效）：<code>${escapeHtml(fullLink)}</code></p>
<h3>把下面这段提示词直接复制给 AI Agent</h3>
<textarea readonly rows="18" style="width:100%;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:13px;padding:12px;border:1px solid #ccc;border-radius:8px;background:#fafafa" onclick="this.select();this.setSelectionRange(0,99999)">${escapeHtml(promptText)}</textarea>
<p style="color:#888;font-size:13px">点击文本框即可全选复制。</p>
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
