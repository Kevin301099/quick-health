import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { tick } from '../src/jobs';
import { daysFromNow, fakeExtractor, makeDeps, png } from './helpers';
import { answers, call, declarations, goodPhoto, signIn, upload, type App, type Deps } from './flow';

/** Takes an application from nothing to signed and paid. */
async function paidApplication(app: App, deps: Deps, token: string) {
  const created = await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } });
  expect(created.status).toBe(201);
  const id = created.json.application.id as string;
  const passport = await upload(app, token, id, 'passport', 'image/png', png(1200, 850));
  expect(passport.status).toBe(200);
  expect(passport.json.application.profile.passportNo).toBe('Z9100234');
  const photo = await upload(app, token, id, 'photo', 'image/png', png(900, 1150));
  expect(photo.json.document.width).toBe(900);
  const patched = await call(app, 'PATCH', `/v1/applications/${id}`, { token, body: { profile: { phone: '+91 98200 11223' }, photoReport: goodPhoto } });
  expect(patched.status).toBe(200);
  expect(patched.json.application.readiness.ready).toBe(true);
  const signed = await call(app, 'POST', `/v1/applications/${id}/sign`, { token, body: { declarations, signatureName: 'Ananya Ravi Sharma' } });
  expect(signed.status).toBe(200);
  expect(signed.json.application.status).toBe('ready_to_pay');
  const checkout = await call(app, 'POST', `/v1/applications/${id}/checkout`, { token });
  expect(checkout.status).toBe(200);
  const page = new URL(checkout.json.url);
  const form = new URLSearchParams({ app: id, ok: page.searchParams.get('ok')! });
  const done = await app.request(`${page.pathname}/complete`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  expect(done.status).toBe(303);
  return id;
}

describe('sign-in', () => {
  it('signs in with an emailed code and rejects a wrong one', async () => {
    const { app, deps } = await makeDeps();
    await call(app, 'POST', '/v1/auth/code', { body: { email: 'A@Example.com' } });
    const wrong = await call(app, 'POST', '/v1/auth/verify', { body: { email: 'a@example.com', code: '000000' === deps.mailer.outbox[0].subject.slice(0, 6) ? '111111' : '000000' } });
    expect(wrong.status).toBe(400);
    const token = await signIn(app, deps, 'a@example.com');
    const me = await call(app, 'GET', '/v1/me', { token });
    expect(me.json.user.email).toBe('a@example.com');
    expect((await call(app, 'GET', '/v1/me')).status).toBe(401);
  });

  it('limits how many codes one email can request', async () => {
    const { app } = await makeDeps();
    for (let i = 0; i < 3; i++) expect((await call(app, 'POST', '/v1/auth/code', { body: { email: 'b@example.com' } })).status).toBe(200);
    expect((await call(app, 'POST', '/v1/auth/code', { body: { email: 'b@example.com' } })).status).toBe(429);
  });
});

describe('a tourist visa, start to finish (sandbox filer)', () => {
  it('files, approves and serves the permit, then purges documents', async () => {
    const extractor = fakeExtractor();
    const { app, deps } = await makeDeps({ RETENTION_DAYS: '0' }, extractor);
    const token = await signIn(app, deps, 'ananya@example.com');
    const id = await paidApplication(app, deps, token);

    // Filed the moment payment landed, without waiting for a scheduled run.
    let view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.status).toBe('submitted');
    expect(view.json.application.providerRef).toMatch(/^SBX-/);
    expect(deps.mailer.outbox.some((m) => m.subject.startsWith('Payment received'))).toBe(true);

    await tick(deps); // the test sandbox approves on the first poll
    view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.events.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['filed', 'status_submitted', 'status_approved']));
    expect(view.json.application.status).toBe('approved');
    expect(view.json.application.permit.available).toBe(true);
    expect(deps.mailer.outbox.some((m) => m.subject === 'Your UAE visa is ready')).toBe(true);

    const permit = await call(app, 'GET', `/v1/applications/${id}/permit`, { token });
    const url = new URL(permit.json.url);
    const pdf = await app.request(url.pathname + url.search);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect((await pdf.text()).startsWith('%PDF-1.4')).toBe(true);

    // Retention is 0 days in this test, so the next run deletes the documents.
    await tick(deps);
    view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.purged).toBe(true);
    expect(view.json.application.documents).toHaveLength(0);
    expect(view.json.application.profile.passportNo).toBeUndefined();
    expect(extractor.calls).toBe(1);
  });

  it('keeps other people out', async () => {
    const { app, deps } = await makeDeps();
    const t1 = await signIn(app, deps, 'one@example.com');
    const t2 = await signIn(app, deps, 'two@example.com');
    const created = await call(app, 'POST', '/v1/applications', { token: t1, body: { answers: answers() } });
    const id = created.json.application.id;
    expect((await call(app, 'GET', `/v1/applications/${id}`, { token: t2 })).status).toBe(404);
    expect((await call(app, 'GET', '/v1/ops/applications', { token: t1 })).status).toBe(403);
  });

  it('refuses nationalities that do not need a visa, and unsigned or incomplete applications', async () => {
    const { app, deps } = await makeDeps();
    const token = await signIn(app, deps, 'c@example.com');
    const uk = await call(app, 'POST', '/v1/applications', { token, body: { answers: { ...answers(), nationality: 'GB' } } });
    expect(uk.status).toBe(422);
    const created = await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } });
    const id = created.json.application.id;
    const early = await call(app, 'POST', `/v1/applications/${id}/sign`, { token, body: { declarations, signatureName: 'X' } });
    expect(early.status).toBe(422);
    expect(early.json.error.message).toMatch(/passport/);
    expect((await call(app, 'POST', `/v1/applications/${id}/checkout`, { token })).status).toBe(409);
  });

  it('rejects a renamed file and caches passport reading by content', async () => {
    const extractor = fakeExtractor();
    const { app, deps } = await makeDeps({}, extractor);
    const token = await signIn(app, deps, 'd@example.com');
    const id = (await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } })).json.application.id;
    const fake = await upload(app, token, id, 'photo', 'image/png', new TextEncoder().encode('not really a png at all'));
    expect(fake.status).toBe(415);
    const file = png(1000, 700);
    await upload(app, token, id, 'passport', 'image/png', file);
    await upload(app, token, id, 'passport', 'image/png', file);
    expect(extractor.calls).toBe(1);
  });
});

describe('manual filing through the ops console', () => {
  it('queues for ops, who approve with an uploaded visa', async () => {
    const { app, deps } = await makeDeps({ FILING_PROVIDER: 'manual' });
    const token = await signIn(app, deps, 'e@example.com');
    const id = await paidApplication(app, deps, token);
    await tick(deps);
    let view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.status).toBe('queued');

    const ops = await signIn(app, deps, 'ops@rihla.test');
    const list = await call(app, 'GET', '/v1/ops/applications?status=queued', { token: ops });
    expect(list.json.applications.map((a: { id: string }) => a.id)).toContain(id);
    const detail = await call(app, 'GET', `/v1/ops/applications/${id}`, { token: ops });
    expect(detail.json.packet.traveller.passportNo).toBe('Z9100234');
    expect(detail.json.packet.documents.length).toBe(2);

    await call(app, 'POST', `/v1/ops/applications/${id}/status`, { token: ops, body: { state: 'submitted', message: 'Filed on partner portal' } });
    const needs = await call(app, 'POST', `/v1/ops/applications/${id}/status`, { token: ops, body: { state: 'needs_info', message: 'Please upload a clearer photo' } });
    expect(needs.json.application.status).toBe('needs_info');
    expect(deps.mailer.outbox.some((m) => m.subject === 'Your visa application needs you')).toBe(true);
    const replied = await call(app, 'POST', `/v1/applications/${id}/respond`, { token, body: { message: 'Uploaded a new one' } });
    expect(replied.json.application.status).toBe('queued');

    const up = await call(app, 'POST', `/v1/ops/applications/${id}/permit-upload`, { token: ops });
    const u = new URL(up.json.upload.url);
    await app.request(u.pathname + u.search, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: new TextEncoder().encode('%PDF-1.4 test') });
    const approved = await call(app, 'POST', `/v1/ops/applications/${id}/status`, { token: ops, body: { state: 'approved', permitNumber: '201/2026/1234567', permitKey: up.json.key } });
    expect(approved.status).toBe(200);
    view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.status).toBe('approved');
    expect((await call(app, 'GET', `/v1/applications/${id}/permit`, { token })).status).toBe(200);
  });
});

describe('Stripe webhooks', () => {
  it('marks paid once, from a correctly signed event only', async () => {
    const secret = 'whsec_test_secret';
    const { app, deps } = await makeDeps({ PAYMENTS_DRIVER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: secret });
    const token = await signIn(app, deps, 'f@example.com');
    const id = (await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } })).json.application.id;
    await upload(app, token, id, 'passport', 'image/png', png(1200, 850));
    await upload(app, token, id, 'photo', 'image/png', png(900, 1150));
    await call(app, 'PATCH', `/v1/applications/${id}`, { token, body: { profile: { phone: '+91 1' }, photoReport: goodPhoto } });
    await call(app, 'POST', `/v1/applications/${id}/sign`, { token, body: { declarations, signatureName: 'ANANYA RAVI SHARMA' } });
    await deps.db.query(`UPDATE applications SET payment = '{"driver":"stripe","sessionId":"cs_test_1","status":"open"}'::jsonb WHERE id = $1`, [id]);

    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', object: 'checkout.session', payment_status: 'paid', client_reference_id: id, amount_total: 36855 } } });
    const bad = await call(app, 'POST', '/v1/webhooks/stripe', { raw: payload, headers: { 'stripe-signature': 't=1,v1=nope', 'content-type': 'application/json' } });
    expect(bad.status).toBe(400);
    const header = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload, secret });
    const ok = await call(app, 'POST', '/v1/webhooks/stripe', { raw: payload, headers: { 'stripe-signature': header, 'content-type': 'application/json' } });
    expect(ok.status).toBe(200);
    const again = await call(app, 'POST', '/v1/webhooks/stripe', { raw: payload, headers: { 'stripe-signature': header, 'content-type': 'application/json' } });
    expect(again.status).toBe(200);
    const view = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(view.json.application.status).toBe('submitted');
    expect(view.json.application.events.filter((e: { type: string }) => e.type === 'paid')).toHaveLength(1);
    expect(view.json.application.events.filter((e: { type: string }) => e.type === 'filed')).toHaveLength(1);
  });
});
