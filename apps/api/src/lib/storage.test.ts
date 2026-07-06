import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalStorage } from './storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

let root: string;
let storage: LocalStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'redesk-storage-'));
  storage = new LocalStorage(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function readAll(stream: NodeJS.ReadableStream | AsyncIterable<Buffer | Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('LocalStorage', () => {
  it('putBytes then exists + size', async () => {
    const key = 'books/1/main.epub';
    await storage.putBytes(key, Buffer.from('hello world'));
    expect(await storage.exists(key)).toBe(true);
    expect(await storage.size(key)).toBe(11);
  });

  it('getStream returns the same bytes', async () => {
    const key = 'books/1/main.epub';
    const bytes = Buffer.from('hello world');
    await storage.putBytes(key, bytes);
    const got = await readAll(await storage.getStream(key));
    expect(got.equals(bytes)).toBe(true);
  });

  it('getStream supports range', async () => {
    const key = 'books/1/main.epub';
    const bytes = Buffer.from('hello world');
    await storage.putBytes(key, bytes);
    const got = await readAll(await storage.getStream(key, { range: { start: 0, end: 4 } }));
    expect(got.toString()).toBe('hello');
  });

  it('getBytes returns full content', async () => {
    const key = 'covers/1/cover.jpg';
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    await storage.putBytes(key, bytes);
    const got = await storage.getBytes(key);
    expect(got.equals(bytes)).toBe(true);
  });

  it('delete removes the file', async () => {
    const key = 'tmp/upload.epub';
    await storage.putBytes(key, Buffer.from('x'));
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('exists returns false for missing key', async () => {
    expect(await storage.exists('nope/missing.bin')).toBe(false);
  });

  it('size throws for missing key', async () => {
    await expect(storage.size('nope/missing.bin')).rejects.toThrow();
  });

  it('move relocates the file', async () => {
    const src = 'tmp/upload_abc.epub';
    const dst = 'books/1/main.epub';
    await storage.putBytes(src, Buffer.from('content'));
    await storage.move(src, dst);
    expect(await storage.exists(src)).toBe(false);
    expect(await storage.exists(dst)).toBe(true);
    const got = await readFile(join(root, dst), 'utf-8');
    expect(got).toBe('content');
  });

  it('putStream writes from a Readable', async () => {
    const key = 'books/2/main.epub';
    const src = (async function* () {
      yield Buffer.from('streamed data');
    })();
    await storage.putStream(key, src, { contentType: 'application/epub+zip' });
    const got = await readFile(join(root, key), 'utf-8');
    expect(got).toBe('streamed data');
  });

  it('signedUrl throws (not supported on local)', async () => {
    await expect(storage.signedUrl('any', 60)).rejects.toThrow(/not supported/i);
  });

  it('publicUrl returns null for local', () => {
    expect(storage.publicUrl('any')).toBeNull();
  });

  it('rejects key with parent traversal', async () => {
    await expect(storage.putBytes('../escape.txt', Buffer.from('x'))).rejects.toThrow();
    await expect(storage.putBytes('a/../../b.txt', Buffer.from('x'))).rejects.toThrow();
  });

  it('produces an actual file on disk', async () => {
    const key = 'books/9/notes.md';
    await storage.putBytes(key, Buffer.from('# hello'));
    const s = await stat(join(root, key));
    expect(s.isFile()).toBe(true);
    expect(s.size).toBe(7);
  });
});

describe('storage key and log hygiene', () => {
  it('uses strong random storage keys in file routes', async () => {
    const file = await readFile(join(__dirname, '../routes/files.ts'), 'utf-8');
    const helper = await readFile(join(__dirname, 'storage-debug.ts'), 'utf-8');
    expect(file).not.toMatch(/Math\.random/);
    expect(file).toMatch(/randomStorageToken\(/);
    expect(helper).toMatch(/randomUUID\(/);
  });

  it('does not write storage keys or checksums to default console logs', async () => {
    const file = await readFile(join(__dirname, '../routes/files.ts'), 'utf-8');
    expect(file).not.toMatch(/console\.log\(.*\$\{key\}/s);
    expect(file).not.toMatch(/console\.(log|error)\(.*\$\{checksum\}/s);
  });

  it('does not log concrete S3 endpoint or bucket while building storage cache', async () => {
    const file = await readFile(join(__dirname, 'storage-factory.ts'), 'utf-8');
    expect(file).not.toMatch(/console\.log\(.*cfg\.endpoint/s);
    expect(file).not.toMatch(/console\.log\(.*cfg\.bucket/s);
  });
});
