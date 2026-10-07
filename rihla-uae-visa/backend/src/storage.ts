import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import type { Config } from './config';

/*
  Files never pass through the API in production: the browser uploads straight to object storage with a
  short-lived signed URL, and downloads the same way. That keeps bandwidth and compute off the server bill.
  Cloudflare R2 (no egress fees) or S3 in the UAE region both work through the same S3 API.
  The local driver imitates signed URLs on disk so development needs no cloud account.
*/

export interface Storage {
  /** URL the browser can PUT the file to, valid for a few minutes. */
  uploadUrl(key: string, mime: string, ttlSeconds?: number): Promise<{ url: string; headers: Record<string, string> }>;
  /** URL the browser (or a partner) can GET the file from, valid for a few minutes. */
  downloadUrl(key: string, ttlSeconds?: number, filename?: string): Promise<string>;
  head(key: string): Promise<{ bytes: number } | null>;
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, body: Uint8Array, mime: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createStorage(c: Config): Storage {
  return c.STORAGE_DRIVER === 's3' ? s3Storage(c) : diskStorage(c);
}

/* ------------------------------------------------------------------ local */

export function signLocal(secret: string, method: string, key: string, expires: number) {
  return createHmac('sha256', secret).update(`${method}\n${key}\n${expires}`).digest('base64url');
}

export function verifyLocal(secret: string, method: string, key: string, expires: number, sig: string) {
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const want = Buffer.from(signLocal(secret, method, key, expires));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

function diskStorage(c: Config): Storage {
  const root = resolve(c.LOCAL_STORAGE_DIR);
  const path = (key: string) => {
    const p = resolve(join(root, key));
    if (!p.startsWith(root)) throw new Error('Bad storage key');
    return p;
  };
  const signed = (method: string, key: string, ttl: number, extra = '') => {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = signLocal(c.AUTH_SECRET, method, key, exp);
    return `${c.API_URL}/v1/files/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}${extra}`;
  };
  return {
    async uploadUrl(key, mime, ttl = 600) {
      return { url: signed('PUT', key, ttl), headers: { 'content-type': mime } };
    },
    async downloadUrl(key, ttl = 300, filename) {
      return signed('GET', key, ttl, filename ? `&name=${encodeURIComponent(filename)}` : '');
    },
    async head(key) {
      try {
        const s = await stat(path(key));
        return { bytes: s.size };
      } catch {
        return null;
      }
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(path(key)));
      } catch {
        return null;
      }
    },
    async put(key, body) {
      const p = path(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
    },
    async remove(key) {
      await rm(path(key), { force: true });
    },
  };
}

/* ------------------------------------------------------------------ S3 / R2 */

function s3Storage(c: Config): Storage {
  const aws = new AwsClient({ accessKeyId: c.S3_ACCESS_KEY_ID, secretAccessKey: c.S3_SECRET_ACCESS_KEY, region: c.S3_REGION, service: 's3' });
  const objectUrl = (key: string) => `${c.S3_ENDPOINT.replace(/\/$/, '')}/${c.S3_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const presign = async (method: 'GET' | 'PUT', key: string, ttl: number, query = '') => {
    const url = new URL(objectUrl(key) + query);
    url.searchParams.set('X-Amz-Expires', String(ttl));
    const req = await aws.sign(url.toString(), { method, aws: { signQuery: true } });
    return req.url;
  };
  return {
    async uploadUrl(key, mime, ttl = 600) {
      return { url: await presign('PUT', key, ttl), headers: { 'content-type': mime } };
    },
    async downloadUrl(key, ttl = 300, filename) {
      const q = filename ? `?response-content-disposition=${encodeURIComponent(`attachment; filename="${filename}"`)}` : '';
      return presign('GET', key, ttl, q);
    },
    async head(key) {
      const r = await aws.fetch(objectUrl(key), { method: 'HEAD' });
      if (!r.ok) return null;
      return { bytes: Number(r.headers.get('content-length') ?? 0) };
    },
    async get(key) {
      const r = await aws.fetch(objectUrl(key));
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    },
    async put(key, body, mime) {
      const r = await aws.fetch(objectUrl(key), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': mime } });
      if (!r.ok) throw new Error(`Storage write failed: ${r.status}`);
    },
    async remove(key) {
      await aws.fetch(objectUrl(key), { method: 'DELETE' });
    },
  };
}
