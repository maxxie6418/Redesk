import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';

export interface StoragePutOptions {
  contentType?: string;
}

export interface StorageRange {
  start: number;
  end: number;
}

export interface StorageGetOptions {
  range?: StorageRange;
}

export interface PutResult {
  size: number;
  contentType: string | null;
}

export type StorageInputStream = AsyncIterable<Buffer | Uint8Array> | NodeJS.ReadableStream;

export interface Storage {
  readonly driver: 'local' | 's3';

  putBytes(key: string, bytes: Buffer, opts?: StoragePutOptions): Promise<PutResult>;
  putStream(key: string, stream: StorageInputStream, opts?: StoragePutOptions): Promise<PutResult>;
  getStream(key: string, opts?: StorageGetOptions): Promise<NodeJS.ReadableStream>;
  getBytes(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  move(srcKey: string, dstKey: string): Promise<void>;

  signedUrl(key: string, ttlSec: number): Promise<string>;
  publicUrl(key: string): string | null;
}

function assertSafeKey(key: string): void {
  if (!key || key.length === 0) {
    throw new Error('storage key must not be empty');
  }
  if (isAbsolute(key)) {
    throw new Error(`storage key must be relative: ${key}`);
  }
  const normalized = normalize(key);
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || normalized.includes(`..${sep}`) || normalized.includes(`${sep}..`)) {
    throw new Error(`storage key may not contain '..': ${key}`);
  }
}

export class LocalStorage implements Storage {
  readonly driver = 'local' as const;

  constructor(private readonly rootDir: string) {}

  private resolveKey(key: string): string {
    assertSafeKey(key);
    return join(this.rootDir, key);
  }

  async putBytes(key: string, bytes: Buffer, _opts?: StoragePutOptions): Promise<PutResult> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(target, bytes);
    return { size: bytes.length, contentType: _opts?.contentType ?? null };
  }

  async putStream(key: string, stream: StorageInputStream, opts?: StoragePutOptions): Promise<PutResult> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    const ws = createWriteStream(target);
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer | Uint8Array, _enc, cb) {
        size += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        cb(null, chunk);
      },
    });
    await pipeline(stream as NodeJS.ReadableStream, counter, ws);
    return { size, contentType: opts?.contentType ?? null };
  }

  async getStream(key: string, opts?: StorageGetOptions): Promise<NodeJS.ReadableStream> {
    const target = this.resolveKey(key);
    if (opts?.range) {
      return createReadStream(target, { start: opts.range.start, end: opts.range.end });
    }
    return createReadStream(target);
  }

  async getBytes(key: string): Promise<Buffer> {
    const { readFile } = await import('node:fs/promises');
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    const s = await stat(this.resolveKey(key));
    return s.size;
  }

  async move(srcKey: string, dstKey: string): Promise<void> {
    const src = this.resolveKey(srcKey);
    const dst = this.resolveKey(dstKey);
    await mkdir(dirname(dst), { recursive: true });
    try {
      await rename(src, dst);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const bytes = await this.getBytes(srcKey);
      await this.putBytes(dstKey, bytes);
      await this.delete(srcKey);
    }
  }

  async signedUrl(_key: string, _ttlSec: number): Promise<string> {
    throw new Error('signedUrl is not supported by LocalStorage; use signedUrl on S3 only or generate a temporary route instead');
  }

  publicUrl(_key: string): string | null {
    return null;
  }
}
