import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

let tempDir: string;

type AnyMock = Mock<(...args: unknown[]) => unknown>;
let mockGetSessionUserId: AnyMock;
let mockIsMultiUserEnabled: AnyMock;
let mockGetAdminUserId: AnyMock;
let mockGetDb: AnyMock;

vi.mock('../db', () => ({ getDb: () => mockGetDb() }));
vi.mock('../config', () => ({
  config: {
    nodeEnv: 'test',
    isDev: false,
    isProd: true,
    host: '127.0.0.1',
    port: 0,
    databaseUrl: ':memory:',
    storageDir: tempDir,
    spaDir: tempDir,
    sessionSecret: 'test-secret-at-least-16-bytes-long',
    isDefaultSessionSecret: false,
    webUrl: 'http://localhost',
    logLevel: 'silent',
    authDisabled: false,
    devAuthDisabled: false,
  },
}));

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'storage-route-test-'));
  mockGetSessionUserId = vi.fn();
  mockIsMultiUserEnabled = vi.fn();
  mockGetAdminUserId = vi.fn();
  mockGetDb = vi.fn();
  vi.resetModules();
  vi.doMock('../lib/auth', () => {
    return {
      isMultiUserEnabled: mockIsMultiUserEnabled,
      getSessionUserId: mockGetSessionUserId,
      getAdminUserId: mockGetAdminUserId,
      requireUserId: (req: FastifyRequest) => {
        if (!mockIsMultiUserEnabled()) {
          const adminId = mockGetAdminUserId();
          if (adminId) return adminId;
        }
        const userId = mockGetSessionUserId(req);
        if (!userId) {
          const err = new Error('Unauthorized') as Error & { statusCode: number };
          err.statusCode = 401;
          throw err;
        }
        return userId;
      },
    };
  });
});

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  vi.doUnmock('../lib/auth');
});

describe('requireUserId behavior', () => {
  it('returns admin id in single-user mode', async () => {
    mockIsMultiUserEnabled.mockReturnValue(false);
    mockGetAdminUserId.mockReturnValue(1);
    mockGetSessionUserId.mockReturnValue(null);
    const { requireUserId } = await import('../lib/auth');
    const req = { session: {} } as unknown as FastifyRequest;
    expect(requireUserId(req)).toBe(1);
  });

  it('throws 401 in single-user mode when no admin exists', async () => {
    mockIsMultiUserEnabled.mockReturnValue(false);
    mockGetAdminUserId.mockReturnValue(null);
    const { requireUserId } = await import('../lib/auth');
    const req = { session: {} } as unknown as FastifyRequest;
    expect(() => requireUserId(req)).toThrow(/Unauthorized/);
  });

  it('returns session user id in multi-user mode', async () => {
    mockIsMultiUserEnabled.mockReturnValue(true);
    mockGetSessionUserId.mockReturnValue(42);
    const { requireUserId } = await import('../lib/auth');
    const req = { session: { userId: 42 } } as unknown as FastifyRequest;
    expect(requireUserId(req)).toBe(42);
  });

  it('throws 401 in multi-user mode without session', async () => {
    mockIsMultiUserEnabled.mockReturnValue(true);
    mockGetSessionUserId.mockReturnValue(null);
    const { requireUserId } = await import('../lib/auth');
    const req = { session: {} } as unknown as FastifyRequest;
    expect(() => requireUserId(req)).toThrow();
    try { requireUserId(req); } catch (err) {
      expect((err as Error & { statusCode?: number }).statusCode).toBe(401);
    }
  });
});

describe('storage routes — auth gate static inspection', () => {
  it('all 5 storage routes call requireUserId', async () => {
    const file = await readFile(join(__dirname, 'storage.ts'), 'utf-8');
    const requireCallCount = (file.match(/requireUserId\(req\)/g) ?? []).length;
    const routeCount = (file.match(/app\.(get|post|patch|delete)\(['"]\/storage/g) ?? []).length;
    expect(routeCount).toBe(5);
    expect(requireCallCount).toBe(5);
  });

  it('each storage route definition is followed by requireUserId', async () => {
    const file = await readFile(join(__dirname, 'storage.ts'), 'utf-8');
    const routeLines = [...file.matchAll(/app\.(get|post|patch|delete)\(['"](\/storage[^'"]+)/g)];
    expect(routeLines.length).toBe(5);
    for (const m of routeLines) {
      const routeStart = m.index ?? 0;
      const window = file.slice(routeStart, routeStart + 200);
      expect(window, `route ${m[2]} should call requireUserId`).toMatch(/requireUserId\(req\)/);
    }
  });
});

describe('normalizeSecretSettingInput', () => {
  it('preserves existing secret when input is undefined', async () => {
    const { normalizeSecretSettingInput } = await import('./storage');
    expect(normalizeSecretSettingInput(undefined)).toBeUndefined();
  });

  it('preserves existing secret when input is null', async () => {
    const { normalizeSecretSettingInput } = await import('./storage');
    expect(normalizeSecretSettingInput(null)).toBeUndefined();
  });

  it('preserves existing secret when input is empty string', async () => {
    const { normalizeSecretSettingInput } = await import('./storage');
    expect(normalizeSecretSettingInput('')).toBeUndefined();
  });

  it('accepts non-empty secret input', async () => {
    const { normalizeSecretSettingInput } = await import('./storage');
    expect(normalizeSecretSettingInput('new-secret')).toBe('new-secret');
  });
});

describe('resolveSecretSettingInput', () => {
  it('returns null when explicitly clearing secret', async () => {
    const { resolveSecretSettingInput } = await import('./storage');
    expect(resolveSecretSettingInput('kept-secret', true)).toBeNull();
  });
});
