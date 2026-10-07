import { mkdirSync } from 'node:fs';
import type { Config } from '../config';
import { MIGRATIONS } from './migrations';

/*
  A deliberately thin database layer: parameterised SQL in, rows out.
  Production talks to Postgres through `pg`. Development and tests run the same SQL on PGlite,
  an embedded Postgres, so there is nothing to install and nothing to pay for until launch.
*/

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` in a transaction. Nested calls reuse the outer transaction. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDb(c: Config, opts: { memory?: boolean } = {}): Promise<Db> {
  const db = c.DATABASE_URL ? await openPostgres(c.DATABASE_URL, c.DB_POOL_MAX) : await openPglite(opts.memory ? null : c.PGLITE_DIR);
  if (c.MIGRATE_ON_BOOT || !c.DATABASE_URL) await migrate(db);
  return db;
}

async function openPostgres(url: string, max: number): Promise<Db> {
  const { default: pg } = await import('pg');
  // Dates come back as ISO strings, which is what the API sends anyway.
  pg.types.setTypeParser(1184, (v: string) => new Date(v).toISOString());
  pg.types.setTypeParser(1114, (v: string) => new Date(`${v}Z`).toISOString());
  // Idle connections close after 10 seconds so a serverless database (Neon, Aurora Serverless) can scale to zero
  // between visitors. Use the provider's pooled connection string when the API itself is serverless.
  const pool = new pg.Pool({ connectionString: url, max, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000, allowExitOnIdle: true });
  const wrap = (client: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Db => ({
    async query<T>(sql: string, params: unknown[] = []) {
      return (await client.query(sql, params)).rows as T[];
    },
    tx: (fn) => fn(wrap(client)),
    close: async () => undefined,
  });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function openPglite(dir: string | null): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  const iso = (rows: Record<string, unknown>[]) =>
    rows.map((r) => {
      for (const k of Object.keys(r)) if (r[k] instanceof Date) r[k] = (r[k] as Date).toISOString();
      return r;
    });
  type Q = { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (q: Q): Db => ({
    async query<T>(sql: string, params: unknown[] = []) {
      return iso((await q.query(sql, params)).rows as Record<string, unknown>[]) as T[];
    },
    tx: (fn) => fn(wrap(q)),
    close: async () => undefined,
  });
  return {
    ...wrap(pg),
    tx: (fn) => pg.transaction((t) => fn(wrap(t))),
    close: () => pg.close(),
  };
}

const applied = async (db: Db) => new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).map((r) => r.id));

/**
 * Applies pending migrations. The common case (nothing to do) is one query. Otherwise everything runs in one
 * transaction behind an advisory lock, so two instances starting together cannot both apply the same migration.
 */
export async function migrate(db: Db) {
  const done = await applied(db).catch(() => new Set<string>());
  if (MIGRATIONS.every((m) => done.has(m.id))) return [];
  return db.tx(async (t) => {
    await t.query('SELECT pg_advisory_xact_lock(7274201)');
    await t.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const now = await applied(t);
    const ran: string[] = [];
    for (const m of MIGRATIONS) {
      if (now.has(m.id)) continue;
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await t.query(stmt);
      await t.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
      ran.push(m.id);
    }
    return ran;
  });
}
