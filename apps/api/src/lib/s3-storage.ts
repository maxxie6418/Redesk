import type { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type UploadPartCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Buffer } from 'node:buffer';
import type { Storage, StorageGetOptions, StoragePutOptions, PutResult } from './storage';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlBase?: string;
  forcePathStyle?: boolean;
}

const MULTIPART_THRESHOLD = 8 * 1024 * 1024;

export class S3Storage implements Storage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string | null;

  constructor(config: S3StorageConfig) {
    if (!config.bucket) throw new Error('S3Storage: bucket is required');
    if (!config.endpoint) throw new Error('S3Storage: endpoint is required');
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('S3Storage: accessKeyId and secretAccessKey are required');
    }
    this.bucket = config.bucket;
    this.publicUrlBase = config.publicUrlBase ? config.publicUrlBase.replace(/\/$/, '') : null;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'auto',
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  private buildKey(key: string): string {
    if (!key) throw new Error('storage key must not be empty');
    if (key.startsWith('/')) throw new Error(`storage key must be relative: ${key}`);
    if (key.includes('..')) throw new Error(`storage key may not contain '..': ${key}`);
    return key;
  }

  async putBytes(key: string, bytes: Buffer, opts?: StoragePutOptions): Promise<PutResult> {
    const k = this.buildKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: k,
        Body: bytes,
        ContentType: opts?.contentType,
      }),
    );
    return { size: bytes.length, contentType: opts?.contentType ?? null };
  }

  async putStream(key: string, stream: Readable, opts?: StoragePutOptions): Promise<PutResult> {
    const k = this.buildKey(key);

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
      if (total >= MULTIPART_THRESHOLD) break;
    }

    if (total < MULTIPART_THRESHOLD) {
      const body = Buffer.concat(chunks, total);
      return this.putBytes(k, body, opts);
    }

    const create = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: k,
        ContentType: opts?.contentType,
      }),
    );
    const uploadId = create.UploadId;
    if (!uploadId) throw new Error('S3 multipart: no UploadId returned');

    try {
      const parts: { ETag: string; PartNumber: number }[] = [];
      let partNumber = 1;
      const pending = chunks;

      if (pending.length > 0) {
        const part = await this.client.send(
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: k,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: Buffer.concat(pending, total),
          }),
        );
        parts.push({ ETag: part.ETag!, PartNumber: partNumber });
        partNumber += 1;
      }

      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (buf.length === 0) continue;
        const part: UploadPartCommandOutput = await this.client.send(
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: k,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buf,
          }),
        );
        parts.push({ ETag: part.ETag!, PartNumber: partNumber });
        total += buf.length;
        partNumber += 1;
      }

      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: k,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
      return { size: total, contentType: opts?.contentType ?? null };
    } catch (err) {
      await this.client
        .send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: k, UploadId: uploadId }))
        .catch(() => undefined);
      throw err;
    }
  }

  async getStream(key: string, opts?: StorageGetOptions): Promise<NodeJS.ReadableStream> {
    const k = this.buildKey(key);
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: k,
        Range: opts?.range ? `bytes=${opts.range.start}-${opts.range.end}` : undefined,
      }),
    );
    if (!res.Body) throw new Error(`S3 object not found: ${k}`);
    return res.Body as Readable;
  }

  async getBytes(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const k = this.buildKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: k }));
  }

  async exists(key: string): Promise<boolean> {
    const k = this.buildKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: k }));
      return true;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number }; name?: string }).$metadata?.httpStatusCode;
      if (status === 404) return false;
      const name = (err as { name?: string }).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return false;
      throw err;
    }
  }

  async size(key: string): Promise<number> {
    const k = this.buildKey(key);
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: k }));
    if (!res.ContentLength) throw new Error(`S3 object has no ContentLength: ${k}`);
    return res.ContentLength;
  }

  async move(srcKey: string, dstKey: string): Promise<void> {
    const src = this.buildKey(srcKey);
    const dst = this.buildKey(dstKey);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: dst,
        Body: await this.getBytes(src),
      }),
    );
    await this.delete(src);
  }

  async signedUrl(key: string, ttlSec: number): Promise<string> {
    const k = this.buildKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: k }), { expiresIn: ttlSec });
  }

  publicUrl(key: string): string | null {
    if (!this.publicUrlBase) return null;
    return `${this.publicUrlBase}/${this.buildKey(key)}`;
  }
}
