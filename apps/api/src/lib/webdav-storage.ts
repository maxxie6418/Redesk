import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { PutResult, Storage, StorageGetOptions, StorageInputStream, StoragePutOptions } from './storage';
import { fetchExternal } from './fetch-utils';

export interface WebDavStorageConfig {
  url: string;
  username?: string | null;
  password: string;
  basePath?: string | null;
}

export class WebDavStorage implements Storage {
  readonly driver = 'webdav' as const;
  private readonly baseUrl: string;
  private readonly auth: string;

  constructor(config: WebDavStorageConfig) {
    if (!config.url || !config.password) throw new Error('WebDAV 配置不完整');
    this.baseUrl = `${config.url.replace(/\/$/, '')}/${(config.basePath ?? '').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
    this.auth = `Basic ${Buffer.from(`${config.username ?? ''}:${config.password}`).toString('base64')}`;
  }

  private urlFor(key: string): string {
    if (!key || key.startsWith('/') || key.includes('..')) throw new Error('存储 key 必须是安全的相对路径');
    return `${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private headers(contentType?: string): Record<string, string> {
    return { Authorization: this.auth, ...(contentType ? { 'Content-Type': contentType } : {}) };
  }

  async putBytes(key: string, bytes: Buffer, opts?: StoragePutOptions): Promise<PutResult> {
    await fetchExternal({ url: this.urlFor(key), method: 'PUT', headers: this.headers(opts?.contentType), body: new Uint8Array(bytes) });
    return { size: bytes.length, contentType: opts?.contentType ?? null };
  }

  async putStream(key: string, stream: StorageInputStream, opts?: StoragePutOptions): Promise<PutResult> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return this.putBytes(key, Buffer.concat(chunks), opts);
  }

  async getStream(key: string, opts?: StorageGetOptions): Promise<NodeJS.ReadableStream> {
    const range: Record<string, string> = opts?.range ? { Range: `bytes=${opts.range.start}-${opts.range.end}` } : {};
    const res = await fetchExternal({ url: this.urlFor(key), headers: { ...this.headers(), ...range } });
    if (!res.body) throw new Error('WebDAV 返回了空响应');
    return Readable.fromWeb(res.body as NodeReadableStream);
  }

  async getBytes(key: string): Promise<Buffer> { return Buffer.from(await (await fetchExternal({ url: this.urlFor(key), headers: this.headers() })).arrayBuffer()); }
  async delete(key: string): Promise<void> { await fetchExternal({ url: this.urlFor(key), method: 'DELETE', headers: this.headers(), acceptableStatuses: [404] }); }
  async exists(key: string): Promise<boolean> { const res = await fetchExternal({ url: this.urlFor(key), method: 'HEAD', headers: this.headers(), acceptableStatuses: [404] }); return res.status !== 404; }
  async size(key: string): Promise<number> { const res = await fetchExternal({ url: this.urlFor(key), method: 'HEAD', headers: this.headers() }); return Number(res.headers.get('content-length') ?? 0); }
  async move(srcKey: string, dstKey: string): Promise<void> { await this.putBytes(dstKey, await this.getBytes(srcKey)); await this.delete(srcKey); }
  async signedUrl(_key: string, _ttlSec: number): Promise<string> { throw new Error('WebDAV 不支持签名 URL'); }
  publicUrl(_key: string): string | null { return null; }
}
