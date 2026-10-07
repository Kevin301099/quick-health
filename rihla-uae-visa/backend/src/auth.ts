import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import type { Context, MiddlewareHandler } from 'hono';
import { opsEmails } from './config';
import type { Deps } from './deps';
import { templates } from './mail';
import { HttpError } from './errors';

/*
  Passwordless sign-in: a six-digit code by email, then a signed session token.
  Codes are stored hashed, expire in 10 minutes, allow 5 attempts, and at most 3 can be requested per 10 minutes
  for one address (12 an hour from one network).
*/

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const MAX_CODES_PER_IP_HOUR = 12;
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  ops: boolean;
}

const hashCode = (secret: string, email: string, code: string) => createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');

export const normEmail = (e: string) => e.trim().toLowerCase();

export async function requestCode(d: Deps, rawEmail: string, ip = '') {
  const email = normEmail(rawEmail);
  // Limits live in the database, so they hold across every serverless instance. The per-address limit stops
  // one inbox being flooded; the per-network limit stops one sender mailing many addresses (each email costs money
  // and sending reputation). Addresses are stored as keyed hashes, never in the clear.
  const ipHash = ip ? createHmac('sha256', d.config.AUTH_SECRET).update(`ip:${ip}`).digest('hex').slice(0, 32) : null;
  const [recent] = await d.db.query<{ email_n: string; ip_n: string }>(
    `SELECT (SELECT count(*) FROM login_codes WHERE email = $1 AND created_at > now() - interval '${CODE_TTL_MIN} minutes')::text AS email_n,
            (SELECT count(*) FROM login_codes WHERE $2::text IS NOT NULL AND ip_hash = $2 AND created_at > now() - interval '1 hour')::text AS ip_n`,
    [email, ipHash],
  );
  if (Number(recent?.email_n ?? 0) >= MAX_CODES_PER_WINDOW) throw new HttpError(429, 'too_many_codes', 'Too many codes requested. Wait a few minutes and try again.');
  if (Number(recent?.ip_n ?? 0) >= MAX_CODES_PER_IP_HOUR) throw new HttpError(429, 'too_many_codes', 'Too many sign-in codes from this network. Try again in an hour.');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await d.db.query(`INSERT INTO login_codes (id, email, code_hash, expires_at, ip_hash) VALUES ($1, $2, $3, now() + interval '${CODE_TTL_MIN} minutes', $4)`, [randomUUID(), email, hashCode(d.config.AUTH_SECRET, email, code), ipHash]);
  await d.mailer.send({ to: email, ...templates.loginCode(code) });
}

export async function verifyCode(d: Deps, rawEmail: string, code: string) {
  const email = normEmail(rawEmail);
  const rows = await d.db.query<{ id: string; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM login_codes WHERE email = $1 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  const row = rows[0];
  if (!row || row.attempts >= MAX_ATTEMPTS) throw new HttpError(400, 'code_expired', 'That code has expired. Ask for a new one.');
  const want = Buffer.from(row.code_hash);
  const got = Buffer.from(hashCode(d.config.AUTH_SECRET, email, code.trim()));
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await d.db.query('UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw new HttpError(400, 'code_wrong', 'That code is not right. Check the latest email and try again.');
  }
  await d.db.query('UPDATE login_codes SET used_at = now() WHERE id = $1', [row.id]);
  const user = await upsertUser(d, email);
  const token = await sign(
    { sub: user.id, email, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 },
    d.config.AUTH_SECRET,
    'HS256',
  );
  return { token, user: { id: user.id, email, ops: opsEmails(d.config).includes(email) } satisfies SessionUser };
}

async function upsertUser(d: Deps, email: string) {
  const rows = await d.db.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
    [randomUUID(), email],
  );
  return rows[0];
}

export function authMiddleware(d: Deps): MiddlewareHandler {
  return async (c, next) => {
    const h = c.req.header('authorization');
    if (h?.startsWith('Bearer ')) {
      try {
        const p = (await verify(h.slice(7), d.config.AUTH_SECRET, 'HS256')) as { sub: string; email: string };
        c.set('user', { id: p.sub, email: p.email, ops: opsEmails(d.config).includes(p.email) } satisfies SessionUser);
      } catch {
        /* an expired or forged token is the same as no token */
      }
    }
    await next();
  };
}

export function currentUser(c: Context): SessionUser {
  const u = c.get('user') as SessionUser | undefined;
  if (!u) throw new HttpError(401, 'signed_out', 'Please sign in again.');
  return u;
}

export function opsUser(c: Context): SessionUser {
  const u = currentUser(c);
  if (!u.ops) throw new HttpError(403, 'not_ops', 'This needs an ops account.');
  return u;
}
