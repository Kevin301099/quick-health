import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { createExtractor, priceOf } from '../src/extract';
import { buildMrz } from '../src/mrz';
import { submitToProvider, type AppRow } from '../src/applications';
import { tick } from '../src/jobs';
import { createMailer } from '../src/mail';
import { fakeExtractor, makeDeps, png } from './helpers';
import { answers, call, signIn, upload } from './flow';

async function draft(email: string, env: Record<string, string> = {}) {
  const extractor = fakeExtractor();
  const { app, deps } = await makeDeps(env, extractor);
  const token = await signIn(app, deps, email);
  const id = (await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } })).json.application.id as string;
  return { app, deps, token, id, extractor };
}

describe('passport reading costs', () => {
  it('records every billed call and reads each file once', async () => {
    const { app, deps, token, id, extractor } = await draft('cost1@example.com');
    const file = png(1200, 850);
    await upload(app, token, id, 'passport', 'image/png', file);
    await upload(app, token, id, 'passport', 'image/png', file); // same file again: served from the cache
    expect(extractor.calls).toBe(1);
    const rows = await deps.db.query<{ model: string; cost_usd: string; application_id: string }>('SELECT * FROM ai_usage');
    expect(rows).toHaveLength(1);
    expect(rows[0].application_id).toBe(id);
    expect(Number(rows[0].cost_usd)).toBeCloseTo(0.022);
  });

  it('stops reading after the per-application cap and lets the person type instead', async () => {
    const { app, token, id, extractor } = await draft('cost2@example.com', { AI_CALLS_PER_APPLICATION: '1' });
    expect((await upload(app, token, id, 'passport', 'image/png', png(1200, 850))).json.extraction.status).toBe('ok');
    const second = await upload(app, token, id, 'passport', 'image/png', png(1201, 850));
    expect(second.status).toBe(200);
    expect(second.json.extraction.status).toBe('unavailable');
    expect(extractor.calls).toBe(1);
  });

  it('pauses reading once the monthly budget is spent', async () => {
    const { app, deps, token, id, extractor } = await draft('cost3@example.com', { AI_MONTHLY_BUDGET_USD: '0.01' });
    await upload(app, token, id, 'passport', 'image/png', png(1200, 850)); // spends 0.022, over the 0.01 budget
    const other = (await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } })).json.application.id;
    const r = await upload(app, token, other, 'passport', 'image/png', png(1202, 850));
    expect(r.json.extraction.status).toBe('unavailable');
    expect(extractor.calls).toBe(1);
    const ops = await signIn(app, deps, 'ops@rihla.test');
    const usage = await call(app, 'GET', '/v1/ops/usage', { token: ops });
    expect(usage.status).toBe(200);
    expect(usage.json.month.calls).toBe(1);
    expect(usage.json.month.costUsd).toBeCloseTo(0.022);
    expect(usage.json.month.budgetUsd).toBe(0.01);
    expect((await call(app, 'GET', '/v1/ops/usage', { token })).status).toBe(403);
  });

  it('prices calls from token counts', () => {
    expect(priceOf('claude-opus-5-5', { input_tokens: 2500, output_tokens: 600 })).toBeCloseTo(0.022);
    expect(priceOf('claude-haiku-5-5', { input_tokens: 2500, output_tokens: 600 })).toBeCloseTo(0.00055);
    // Unknown models are priced as the most expensive, so budgets err on the safe side.
    expect(priceOf('some-new-model', { input_tokens: 2500, output_tokens: 600 })).toBeCloseTo(0.022);
  });
});

describe('cheaper first pass', () => {
  // A stand-in for the Messages API: the fast model misreads one digit, the main model reads it right.
  const [l1, l2] = buildMrz({ surname: 'SHARMA', given: 'ANANYA RAVI', number: 'Z9100234', nationality: 'IND', dob: '1992-06-14', sex: 'F', expiry: '2029-02-28' });
  const reading = (line2: string) => ({
    is_passport_photo_page: true,
    legibility: 'clear',
    surname: 'SHARMA',
    given_names: 'ANANYA RAVI',
    passport_number: 'Z9100234',
    nationality_code: 'IND',
    issuing_country_code: 'IND',
    date_of_birth: '1992-06-14',
    sex: 'F',
    date_of_issue: '2019-03-01',
    date_of_expiry: '2029-02-28',
    place_of_birth: 'PUNE',
    mrz_line_1: l1,
    mrz_line_2: line2,
  });
  const seen: { model: string; effort?: string }[] = [];
  let server: Server;
  let url = '';

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const r = JSON.parse(body) as { model: string; output_config?: { effort?: string } };
        seen.push({ model: r.model, effort: r.output_config?.effort });
        const out = r.model === 'claude-haiku-5-5' ? reading(l2.replace('920614', '920615')) : reading(l2);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            id: `msg_${seen.length}`,
            type: 'message',
            role: 'assistant',
            model: r.model,
            content: [{ type: 'text', text: JSON.stringify(out) }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 2500, output_tokens: 600, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        );
      });
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const addr = server.address() as { port: number };
    url = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

  it('keeps a fast reading only when the check digits prove it, otherwise asks the main model', async () => {
    process.env.ANTHROPIC_BASE_URL = url;
    try {
      const x = createExtractor(loadConfig({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'test-key', EXTRACT_FAST_MODEL: 'claude-haiku-5-5' }));
      const r = await x.passport(png(10, 10), 'image/png');
      expect(seen.map((s) => s.model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
      expect(seen[1].effort).toBe('low');
      expect(r.extraction.verified).toBe(true);
      expect(r.extraction.model).toBe('claude-opus-5-5');
      expect(r.calls.map((c) => c.outcome)).toEqual(['check', 'ok']);
      expect(r.calls.reduce((s, c) => s + c.costUsd, 0)).toBeCloseTo(0.02255);

      // Without a fast model configured, only the main model is called.
      seen.length = 0;
      const main = createExtractor(loadConfig({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'test-key' }));
      const m = await main.passport(png(10, 10), 'image/png');
      expect(seen.map((s) => s.model)).toEqual(['claude-opus-5-5']);
      expect(m.calls).toHaveLength(1);
    } finally {
      delete process.env.ANTHROPIC_BASE_URL;
    }
  });
});

describe('filing', () => {
  it('files an application once, even when the webhook and the scheduler race', async () => {
    const { app, deps, token, id } = await draft('race@example.com');
    await upload(app, token, id, 'passport', 'image/png', png(1200, 850));
    const [row] = await deps.db.query<AppRow>(`UPDATE applications SET status = 'paid', paid_at = now() WHERE id = $1 RETURNING *`, [id]);
    const submit = deps.provider.submit.bind(deps.provider);
    let submissions = 0;
    deps.provider.submit = async (p) => {
      submissions++;
      await new Promise((r) => setTimeout(r, 50));
      return submit(p);
    };
    await Promise.all([submitToProvider(deps, row), submitToProvider(deps, row), tick(deps)]);
    expect(submissions).toBe(1);
    const filed = await deps.db.query(`SELECT * FROM events WHERE application_id = $1 AND type = 'filed'`, [id]);
    expect(filed).toHaveLength(1);
  });

  it('releases the claim when filing fails, so the scheduler retries', async () => {
    const { app, deps, token, id } = await draft('retry@example.com');
    await upload(app, token, id, 'passport', 'image/png', png(1200, 850));
    const [row] = await deps.db.query<AppRow>(`UPDATE applications SET status = 'paid', paid_at = now() WHERE id = $1 RETURNING *`, [id]);
    const submit = deps.provider.submit.bind(deps.provider);
    deps.provider.submit = async () => {
      throw new Error('partner down');
    };
    await expect(submitToProvider(deps, row)).rejects.toThrow('partner down');
    deps.provider.submit = submit;
    const out = await tick(deps);
    expect(out.submitted).toBe(1);
  });
});

describe('polling', () => {
  it('answers an unchanged application with an empty 304, and in full once it changes', async () => {
    const { app, token, id } = await draft('poll@example.com');
    const first = await call(app, 'GET', `/v1/applications/${id}`, { token });
    const tag = first.res.headers.get('etag')!;
    expect(tag).toMatch(/^W\//);
    const same = await call(app, 'GET', `/v1/applications/${id}`, { token, headers: { 'if-none-match': tag } });
    expect(same.status).toBe(304);
    expect(same.text).toBe('');
    await call(app, 'PATCH', `/v1/applications/${id}`, { token, body: { profile: { phone: '+91 1' } } });
    const changed = await call(app, 'GET', `/v1/applications/${id}`, { token, headers: { 'if-none-match': tag } });
    expect(changed.status).toBe(200);
    expect(changed.json.application.profile.phone).toBe('+91 1');
  });
});

describe('pay-per-use email', () => {
  it('sends through Amazon SES with a signed request', async () => {
    const real = globalThis.fetch;
    const sent: { url: string; auth: string; body: any }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      sent.push({ url: req.url, auth: req.headers.get('authorization') ?? '', body: JSON.parse(await req.text()) });
      return new Response('{"MessageId":"m-1"}', { status: 200 });
    }) as typeof fetch;
    try {
      const mailer = createMailer(loadConfig({ NODE_ENV: 'test', MAIL_DRIVER: 'ses', SES_REGION: 'me-central-1', AWS_ACCESS_KEY_ID: 'AKIDEXAMPLE', AWS_SECRET_ACCESS_KEY: 'secret', AWS_SESSION_TOKEN: 'token', MAIL_FROM: 'Rihla <visas@rihla.test>' }));
      await mailer.send({ to: 'a@example.com', subject: 'Hello', text: 'Body' });
    } finally {
      globalThis.fetch = real;
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://email.me-central-1.amazonaws.com/v2/email/outbound-emails');
    expect(sent[0].auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/me-central-1\/ses\/aws4_request/);
    expect(sent[0].body).toEqual({
      FromEmailAddress: 'Rihla <visas@rihla.test>',
      Destination: { ToAddresses: ['a@example.com'] },
      Content: { Simple: { Subject: { Data: 'Hello', Charset: 'UTF-8' }, Body: { Text: { Data: 'Body', Charset: 'UTF-8' } } } },
    });
  });
});

describe('AWS Lambda', () => {
  it('serves HTTP from a Function URL event and runs scheduled work from the scheduler event', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rihla-lambda-'));
    Object.assign(process.env, { NODE_ENV: 'test', PGLITE_DIR: join(dir, 'db'), LOCAL_STORAGE_DIR: join(dir, 'files') });
    const { handler } = await import('../src/lambda');
    const res = (await handler(
      {
        version: '2.0',
        routeKey: '$default',
        rawPath: '/v1/health',
        rawQueryString: '',
        headers: { host: 'abc.lambda-url.me-central-1.on.aws', 'x-forwarded-proto': 'https' },
        requestContext: { http: { method: 'GET', path: '/v1/health', protocol: 'HTTP/1.1', sourceIp: '203.0.113.9', userAgent: 'test' }, domainName: 'abc.lambda-url.me-central-1.on.aws', stage: '$default', requestId: 'r1', time: '', timeEpoch: 0, accountId: 'anonymous', apiId: 'abc', routeKey: '$default' },
        isBase64Encoded: false,
        body: null,
      },
      {},
    )) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    const out = (await handler({ rihla: 'tick' }, {})) as { errors: number };
    expect(out.errors).toBe(0);
  });
});
