import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Deps } from './deps';
import { HttpError } from './errors';
import { authMiddleware, currentUser, opsUser, requestCode, verifyCode, type SessionUser } from './auth';
import {
  ALL_SLOTS,
  DECLARATIONS,
  MAX_FILE_BYTES,
  OPTIONAL_SLOTS,
  REQUIRED_SLOTS,
  applyUpdate,
  completeUpload,
  createApplication,
  getApp,
  logEvent,
  markPaid,
  ownApp,
  packetFor,
  packFor,
  selfSubmitted,
  permitUrl,
  publicApp,
  respond,
  signApplication,
  startCheckout,
  startUpload,
  updateApplication,
  type AppRow,
} from './applications';
import { quoteFor } from './payments';
import { verifyLocal } from './storage';
import { tick } from './jobs';
import { checkEligibility, NATIONALITIES } from '@/domain/nationalities';
import { AIRLINES, ROUTE_SPECS } from '@/domain/routes';

type Env = { Variables: { user?: SessionUser } };

/** A tiny fixed-window limiter. Per process, which is enough to stop casual abuse of sign-in. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return;
    }
    if (++h.n > max) throw new HttpError(429, 'slow_down', 'Too many attempts. Wait a minute and try again.');
  };
}

export function buildApp(d: Deps) {
  const app = new Hono<Env>();
  const authLimit = limiter(20, 60_000);
  // The caller's address: from Lambda's own request context when serverless (it cannot be spoofed by a header),
  // otherwise from the proxy in front of the server.
  const ip = (c: { env?: unknown; req: { header: (n: string) => string | undefined } }) =>
    (c.env as { requestContext?: { http?: { sourceIp?: string } } } | undefined)?.requestContext?.http?.sourceIp ??
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local';

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
  app.use(
    '/v1/*',
    cors({
      origin: d.config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      allowHeaders: ['authorization', 'content-type', 'if-none-match'],
      exposeHeaders: ['etag'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use('/v1/*', authMiddleware(d));
  if (d.config.LOG_REQUESTS) {
    app.use('*', async (c, next) => {
      const t = Date.now();
      await next();
      console.log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status} ${Date.now() - t}ms`);
    });
  }

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
    console.error('[api]', err);
    return c.json({ error: { code: 'server', message: 'Something went wrong on our side. Please try again.' } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));

  const json = async <T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new HttpError(400, 'bad_json', 'The request body is not valid JSON.');
    }
    const r = schema.safeParse(body);
    if (!r.success) throw new HttpError(422, 'invalid', r.error.issues[0]?.message ?? 'Invalid request');
    return r.data;
  };

  /* ---------------------------------------------------------------- public */

  app.get('/v1/health', (c) => c.json({ ok: true }));

  app.get('/v1/config', (c) =>
    c.json({
      live: true,
      provider: d.provider.name,
      payments: d.payments.driver,
      extraction: d.config.ANTHROPIC_API_KEY ? 'on' : 'off',
      quotes: { 30: quoteFor(d.config, 30), 60: quoteFor(d.config, 60) },
      slots: { required: REQUIRED_SLOTS, optional: OPTIONAL_SLOTS },
      routes: d.config.ROUTES.map((id) => ROUTE_SPECS[id]),
      airlines: Object.values(AIRLINES),
      maxFileBytes: MAX_FILE_BYTES,
      declarations: DECLARATIONS,
      retentionDays: d.config.RETENTION_DAYS,
      selfRetentionDays: d.config.SELF_RETENTION_DAYS,
      nationalities: NATIONALITIES.map((n) => ({ ...n, eligibility: checkEligibility(n.code, null).status })),
    }),
  );

  app.post('/v1/auth/code', async (c) => {
    authLimit(`code:${ip(c)}`);
    const { email } = await json(c, z.object({ email: z.string().email('Enter a valid email address') }));
    await requestCode(d, email, ip(c));
    return c.json({ ok: true });
  });

  app.post('/v1/auth/verify', async (c) => {
    authLimit(`verify:${ip(c)}`);
    const { email, code } = await json(c, z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/, 'The code has 6 digits') }));
    return c.json(await verifyCode(d, email, code));
  });

  app.get('/v1/me', (c) => c.json({ user: currentUser(c) }));

  /* ---------------------------------------------------------------- applications */

  app.post('/v1/applications', async (c) => {
    const u = currentUser(c);
    const body = (await c.req.json().catch(() => ({}))) as { answers?: unknown; route?: unknown; airline?: unknown };
    const a = await createApplication(d, u, body.answers, { route: body.route, airline: body.airline });
    return c.json({ application: await publicApp(d, a) }, 201);
  });

  app.get('/v1/applications', async (c) => {
    const u = currentUser(c);
    const rows = await d.db.query<AppRow>('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [u.id]);
    return c.json({
      applications: rows.map((a) => ({ id: a.id, status: a.status, answers: a.answers, name: `${a.profile.given ?? ''} ${a.profile.surname ?? ''}`.trim(), createdAt: a.created_at, updatedAt: a.updated_at })),
    });
  });

  app.get('/v1/applications/:id', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    // The status page polls this. A poll that sends back the tag it last saw gets an empty 304 while nothing has
    // changed, which skips the document, event and readiness queries. The tag also rolls over every 4 minutes,
    // so the short-lived file links in the full response are refreshed before they expire.
    const [v] = await d.db.query<{ ev: string }>('SELECT coalesce(max(id), 0)::text AS ev FROM events WHERE application_id = $1', [a.id]);
    const tag = `W/"${Date.parse(a.updated_at).toString(36)}.${v.ev}.${Math.floor(Date.now() / 240_000).toString(36)}"`;
    c.header('etag', tag);
    c.header('cache-control', 'private, no-cache');
    if (c.req.header('if-none-match') === tag) return c.body(null, 304);
    return c.json({ application: await publicApp(d, a, { withFiles: true }) });
  });

  app.patch('/v1/applications/:id', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const body = (await c.req.json().catch(() => ({}))) as { answers?: unknown; profile?: unknown; photoReport?: unknown };
    const updated = await updateApplication(d, a, body);
    return c.json({ application: await publicApp(d, updated, { withFiles: true }) });
  });

  app.post('/v1/applications/:id/documents', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const body = await json(c, z.object({ slot: z.enum(ALL_SLOTS), mime: z.string(), bytes: z.number().int().positive() }));
    return c.json(await startUpload(d, a, body), 201);
  });

  app.post('/v1/applications/:id/documents/:docId/complete', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const r = await completeUpload(d, a, c.req.param('docId'));
    return c.json({ document: r.document, extraction: r.extraction, application: await publicApp(d, r.application, { withFiles: true }) });
  });

  app.post('/v1/applications/:id/sign', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const body = await json(c, z.object({ declarations: z.record(z.string(), z.boolean()), signatureName: z.string().max(160) }));
    const updated = await signApplication(d, a, body);
    return c.json({ application: await publicApp(d, updated, { withFiles: true }) });
  });

  app.post('/v1/applications/:id/checkout', async (c) => {
    const u = currentUser(c);
    const a = await ownApp(d, u.id, c.req.param('id'));
    return c.json(await startCheckout(d, a, u.email));
  });

  app.post('/v1/applications/:id/respond', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const { message } = await json(c, z.object({ message: z.string().max(1000) }));
    const updated = await respond(d, a, message);
    return c.json({ application: await publicApp(d, updated, { withFiles: true }) });
  });

  /** Details and short-lived document links for the Rihla extension, which fills the official form. Free routes only. */
  app.get('/v1/applications/:id/pack', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    c.header('cache-control', 'no-store');
    return c.json({ pack: await packFor(d, a) });
  });

  app.post('/v1/applications/:id/self-submitted', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    const { reference } = await json(c, z.object({ reference: z.string().max(60).default('') }));
    const updated = await selfSubmitted(d, a, reference);
    return c.json({ application: await publicApp(d, updated, { withFiles: true }) });
  });

  app.get('/v1/applications/:id/permit', async (c) => {
    const a = await ownApp(d, currentUser(c).id, c.req.param('id'));
    return c.json({ url: await permitUrl(d, a) });
  });

  /* ---------------------------------------------------------------- payments */

  app.post('/v1/webhooks/stripe', async (c) => {
    if (d.payments.driver !== 'stripe') throw new HttpError(404, 'not_found', 'Not found');
    const raw = await c.req.text();
    let r;
    try {
      r = await d.payments.parseWebhook(raw, c.req.header('stripe-signature'));
    } catch {
      throw new HttpError(400, 'bad_signature', 'Invalid signature');
    }
    const seen = await d.db.query('INSERT INTO payment_events (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id', [r.eventId]);
    if (seen.length && r.kind === 'paid') await markPaid(d, r.applicationId, r.sessionId, r.amount);
    return c.json({ received: true });
  });

  if (d.payments.driver === 'fake') {
    // A stand-in for a hosted checkout page so the whole flow runs without a payment account.
    app.get('/v1/dev/checkout/:session', (c) => {
      const q = c.req.query();
      const esc = (s = '') => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
      return c.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title>
<style>body{font:16px system-ui,sans-serif;background:#f4f5f7;margin:0;display:grid;place-items:center;min-height:100vh}main{background:#fff;padding:32px;border-radius:16px;max-width:380px;width:calc(100% - 32px);box-shadow:0 10px 40px -20px #0004}h1{font-size:20px;margin:0 0 4px}p{color:#555;margin:0 0 20px}.amt{font-size:32px;font-weight:700;margin:12px 0 24px}button{width:100%;padding:14px;border:0;border-radius:10px;background:#0b7a63;color:#fff;font-size:16px;font-weight:600;cursor:pointer}a{display:block;text-align:center;margin-top:14px;color:#555}</style></head>
<body><main><h1>Test checkout</h1><p>No card is charged. This page stands in for the real payment provider.</p><div class="amt">AED ${esc(q.total)}</div>
<form method="post" action="${esc(c.req.path)}/complete"><input type="hidden" name="app" value="${esc(q.app)}"><input type="hidden" name="ok" value="${esc(q.ok)}"><button type="submit">Pay AED ${esc(q.total)}</button></form>
<a href="${esc(q.cancel)}">Cancel and go back</a></main></body></html>`);
    });
    app.post('/v1/dev/checkout/:session/complete', async (c) => {
      const f = await c.req.parseBody();
      const appId = String(f.app ?? '');
      const ok = String(f.ok ?? '');
      if (!ok.startsWith(d.config.APP_URL)) throw new HttpError(400, 'bad_redirect', 'Bad redirect');
      const a = await getApp(d, appId);
      if (a.payment?.sessionId !== c.req.param('session')) throw new HttpError(409, 'session', 'This checkout has expired.');
      await markPaid(d, appId, c.req.param('session'), a.quote?.total);
      return c.redirect(ok, 303);
    });
  }

  /* ---------------------------------------------------------------- local file storage */

  if (d.config.STORAGE_DRIVER === 'local') {
    app.put('/v1/files/:key{.+}', bodyLimit({ maxSize: MAX_FILE_BYTES, onError: (c) => c.json({ error: { code: 'too_big', message: 'Files can be up to 10 MB.' } }, 413) }), async (c) => {
      const key = decodeURIComponent(c.req.param('key'));
      if (!verifyLocal(d.config.AUTH_SECRET, 'PUT', key, Number(c.req.query('exp')), c.req.query('sig') ?? '')) throw new HttpError(403, 'expired', 'This upload link has expired.');
      const body = new Uint8Array(await c.req.arrayBuffer());
      await d.storage.put(key, body, c.req.header('content-type') ?? 'application/octet-stream');
      return c.body(null, 200);
    });
    app.get('/v1/files/:key{.+}', async (c) => {
      const key = decodeURIComponent(c.req.param('key'));
      if (!verifyLocal(d.config.AUTH_SECRET, 'GET', key, Number(c.req.query('exp')), c.req.query('sig') ?? '')) throw new HttpError(403, 'expired', 'This link has expired.');
      const body = await d.storage.get(key);
      if (!body) throw new HttpError(404, 'not_found', 'File not found.');
      const type = key.endsWith('.pdf') ? 'application/pdf' : key.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const name = c.req.query('name');
      return new Response(new Uint8Array(body), {
        headers: { 'content-type': type, 'cache-control': 'private, max-age=60', ...(name ? { 'content-disposition': `attachment; filename="${name.replace(/"/g, '')}"` } : {}) },
      });
    });
  }

  /* ---------------------------------------------------------------- ops console */

  app.get('/v1/ops/applications', async (c) => {
    opsUser(c);
    const status = c.req.query('status');
    const rows = status
      ? await d.db.query<AppRow>('SELECT * FROM applications WHERE status = $1 ORDER BY updated_at DESC LIMIT 100', [status])
      : await d.db.query<AppRow>(`SELECT * FROM applications WHERE status <> 'draft' ORDER BY updated_at DESC LIMIT 100`);
    const counts = await d.db.query<{ status: string; n: string }>('SELECT status, count(*)::text AS n FROM applications GROUP BY status');
    return c.json({
      counts: Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])),
      applications: rows.map((a) => ({
        id: a.id,
        status: a.status,
        name: `${a.profile.given ?? ''} ${a.profile.surname ?? ''}`.trim(),
        nationality: a.answers.nationality,
        days: a.answers.days,
        arrival: a.answers.arrival,
        providerRef: a.provider_ref,
        paidAt: a.paid_at,
        updatedAt: a.updated_at,
        flagged: DECLARATIONS.filter((q) => q.mustBe === null && a.declarations?.[q.id]).map((q) => q.id),
      })),
    });
  });

  app.get('/v1/ops/applications/:id', async (c) => {
    opsUser(c);
    const a = await getApp(d, c.req.param('id'));
    const view = await publicApp(d, a, { withFiles: true });
    const packet = a.status === 'draft' ? null : await packetFor(d, a);
    return c.json({ application: view, packet });
  });

  app.post('/v1/ops/applications/:id/status', async (c) => {
    const u = opsUser(c);
    const a = await getApp(d, c.req.param('id'));
    const body = await json(
      c,
      z.object({ state: z.enum(['submitted', 'processing', 'needs_info', 'approved', 'rejected']), message: z.string().max(1000).optional(), permitNumber: z.string().max(60).optional(), permitKey: z.string().optional() }),
    );
    if (['draft', 'ready_to_pay'].includes(a.status)) throw new HttpError(409, 'not_paid', 'Only paid applications can be moved.');
    if (body.state === 'approved') {
      if (!body.permitNumber || !body.permitKey || !body.permitKey.startsWith(`applications/${a.id}/`)) throw new HttpError(422, 'permit', 'Upload the visa PDF and enter its number first.');
      const head = await d.storage.head(body.permitKey);
      if (!head) throw new HttpError(422, 'permit', 'The visa PDF upload did not arrive.');
      const updated = await applyUpdate(d, { ...a }, { state: 'approved', message: body.message, permit: { number: body.permitNumber } }, 'ops');
      const fixed = await d.db.query<AppRow>(`UPDATE applications SET permit = jsonb_set(permit, '{key}', to_jsonb($2::text)) WHERE id = $1 RETURNING *`, [updated.id, body.permitKey]);
      await logEvent(d, a.id, 'ops', 'ops_note', { by: u.email, action: 'approved' });
      return c.json({ application: await publicApp(d, fixed[0], { withFiles: true }) });
    }
    const updated = await applyUpdate(d, a, { state: body.state, message: body.message }, 'ops');
    await logEvent(d, a.id, 'ops', 'ops_note', { by: u.email, action: body.state });
    return c.json({ application: await publicApp(d, updated, { withFiles: true }) });
  });

  app.post('/v1/ops/applications/:id/permit-upload', async (c) => {
    opsUser(c);
    const a = await getApp(d, c.req.param('id'));
    const key = `applications/${a.id}/permit-${Date.now()}.pdf`;
    const upload = await d.storage.uploadUrl(key, 'application/pdf');
    return c.json({ key, upload: { method: 'PUT', ...upload } });
  });

  app.post('/v1/ops/applications/:id/refund', async (c) => {
    const u = opsUser(c);
    const a = await getApp(d, c.req.param('id'));
    if (!a.payment?.sessionId || a.payment.status !== 'paid') throw new HttpError(409, 'not_paid', 'Nothing to refund.');
    await d.payments.refund(a.payment.sessionId);
    await d.db.query(`UPDATE applications SET status = 'cancelled', payment = jsonb_set(payment, '{status}', '"refunded"'), updated_at = now() WHERE id = $1`, [a.id]);
    await logEvent(d, a.id, 'ops', 'refunded', { by: u.email });
    return c.json({ ok: true });
  });

  /** What passport reading has cost: this month against the budget, and today. */
  app.get('/v1/ops/usage', async (c) => {
    opsUser(c);
    const [row] = await d.db.query<{ m_calls: string; m_usd: string; d_calls: string; d_usd: string; m_apps: string }>(
      `SELECT count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::text AS m_calls,
              coalesce(sum(cost_usd) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::text AS m_usd,
              count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::text AS d_calls,
              coalesce(sum(cost_usd) FILTER (WHERE created_at >= date_trunc('day', now())), 0)::text AS d_usd,
              count(DISTINCT application_id) FILTER (WHERE created_at >= date_trunc('month', now()))::text AS m_apps
         FROM ai_usage WHERE created_at >= date_trunc('month', now())`,
    );
    const byModel = await d.db.query<{ model: string; calls: string; usd: string }>(
      `SELECT model, count(*)::text AS calls, sum(cost_usd)::text AS usd FROM ai_usage WHERE created_at >= date_trunc('month', now()) GROUP BY model ORDER BY sum(cost_usd) DESC`,
    );
    const monthUsd = Number(row.m_usd);
    return c.json({
      month: { calls: Number(row.m_calls), costUsd: monthUsd, budgetUsd: d.config.AI_MONTHLY_BUDGET_USD, applications: Number(row.m_apps), perApplicationUsd: Number(row.m_apps) ? monthUsd / Number(row.m_apps) : 0 },
      today: { calls: Number(row.d_calls), costUsd: Number(row.d_usd) },
      byModel: byModel.map((m) => ({ model: m.model, calls: Number(m.calls), costUsd: Number(m.usd) })),
      models: { main: d.config.EXTRACT_MODEL, fast: d.config.EXTRACT_FAST_MODEL || null },
    });
  });

  /* ---------------------------------------------------------------- scheduler */

  app.post('/internal/tick', async (c) => {
    if (!d.config.CRON_SECRET || c.req.header('x-cron-secret') !== d.config.CRON_SECRET) throw new HttpError(403, 'forbidden', 'Forbidden');
    return c.json(await tick(d));
  });

  return app;
}
