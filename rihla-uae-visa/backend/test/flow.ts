import { expect } from 'vitest';
import { daysFromNow, makeDeps } from './helpers';

/* Request helpers shared by the API tests. */

export type App = Awaited<ReturnType<typeof makeDeps>>['app'];
export type Deps = Awaited<ReturnType<typeof makeDeps>>['deps'];

export async function call(app: App, method: string, path: string, opts: { token?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await app.request(path, { method, headers, body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, res };
}

export async function signIn(app: App, deps: Deps, email: string) {
  expect((await call(app, 'POST', '/v1/auth/code', { body: { email } })).status).toBe(200);
  const mail = deps.mailer.outbox.filter((m) => m.to === email).at(-1)!;
  const code = mail.subject.slice(0, 6);
  const r = await call(app, 'POST', '/v1/auth/verify', { body: { email, code } });
  expect(r.status).toBe(200);
  return r.json.token as string;
}

export const answers = () => ({ nationality: 'IN', hasPermit: false, days: 30, arrival: daysFromNow(20), departure: daysFromNow(34), emirate: 'Dubai' });

export async function upload(app: App, token: string, appId: string, slot: string, mime: string, bytes: Uint8Array) {
  const start = await call(app, 'POST', `/v1/applications/${appId}/documents`, { token, body: { slot, mime, bytes: bytes.byteLength } });
  expect(start.status).toBe(201);
  const url = new URL(start.json.upload.url);
  const put = await app.request(url.pathname + url.search, { method: 'PUT', headers: { 'content-type': mime }, body: new Uint8Array(bytes) });
  expect(put.status).toBe(200);
  return call(app, 'POST', `/v1/applications/${appId}/documents/${start.json.documentId}/complete`, { token });
}

export const goodPhoto = { width: 900, height: 1150, bytes: 300_000, aspect: 0.78, bgLuma: 0.92, bgSpread: 0.05, checks: [{ id: 'background', label: 'Background', ok: true, value: 'light' }], needsFix: false, needsResize: false, blocking: false };
export const declarations = { refused_before: false, deported: false, criminal: false, truthful: true, authorise: true };
