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