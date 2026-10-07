import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createStorage } from '../src/storage';
import { createMailer } from '../src/mail';
import { createPayments } from '../src/payments';
import { createProvider } from '../src/providers';
import { buildApp } from '../src/app';
import type { Deps } from '../src/deps';
import type { Extraction, Extractor } from '../src/extract';

/**
 * Tests run on PGlite (embedded Postgres) by default. Set TEST_DATABASE_URL to run the same tests on a real
 * Postgres server, which is what production uses; each test gets its own schema there.
 */
async function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return '';
  const schema = `t_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.end();
  return `${url}${url.includes('?') ? '&' : '?'}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
}

export async function makeDeps(env: Record<string, string> = {}, extractor?: Extractor) {
  const dir = mkdtempSync(join(tmpdir(), 'rihla-'));
  const config = loadConfig({ NODE_ENV: 'test', LOCAL_STORAGE_DIR: join(dir, 'files'), OPS_EMAILS: 'ops@rihla.test', SANDBOX_APPROVE_AFTER_SECONDS: '0', DATABASE_URL: await testDatabaseUrl(), ...env });
  const deps: Deps = {
    config,
    db: await openDb(config, { memory: true }),
    storage: createStorage(config),
    mailer: createMailer(config),
    payments: createPayments(config),
    provider: createProvider(config),
    extractor: extractor ?? fakeExtractor(),
    now: () => new Date(),
  };
  return { deps, app: buildApp(deps) };
}

export function fakeExtractor(result?: Partial<Extraction>): Extractor & { calls: number } {
  const x = {
    calls: 0,
    async passport() {
      x.calls++;
      const extraction = {
        status: 'ok',
        verified: true,
        fields: { given: 'ANANYA RAVI', surname: 'SHARMA', passportNo: 'Z9100234', nationality: 'IND', dob: '1992-06-14', sex: 'F', passportIssued: '2019-03-01', passportExpires: '2029-02-28', birthplace: 'PUNE' },
        attention: [],
        note: 'ok',
        model: 'fake',
        ...result,
      } as Extraction;
      return { extraction, calls: [{ model: 'fake', inputTokens: 2500, outputTokens: 600, costUsd: 0.022, outcome: extraction.status }] };
    },
  };
  return x;
}

/** A real (tiny) PNG with the given size, so header sniffing and size reading are exercised. */
export function png(width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const raw = Buffer.alloc((width + 1) * height, 255);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

export const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
