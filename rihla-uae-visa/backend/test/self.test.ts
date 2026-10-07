import { describe, expect, it } from 'vitest';
import { assertProductionReady, loadConfig } from '../src/config';
import { tick } from '../src/jobs';
import { daysFromNow, makeDeps, png } from './helpers';
import { answers, call, signIn, upload, type App } from './flow';

const FREE = { ROUTES: 'five_year,airline' };

async function ready(app: App, token: string, id: string, slots: string[]) {
  for (const [i, slot] of slots.entries()) {
    const r = await upload(app, token, id, slot, 'image/png', slot === 'photo' ? png(900, 1150) : png(1200 + i, 850));
    expect(r.status).toBe(200);
  }
  const photoReport = { width: 900, height: 1150, bytes: 300_000, aspect: 0.78, bgLuma: 0.92, bgSpread: 0.05, checks: [{ id: 'background', label: 'Background', ok: true, value: 'light' }], needsFix: false, needsResize: false, blocking: false };
  const r = await call(app, 'PATCH', `/v1/applications/${id}`, { token, body: { profile: { phone: '+91 98200 11223' }, photoReport } });
  expect(r.status).toBe(200);
  return r.json.application;
}

describe('applying yourself (free routes)', () => {
  it('prepares a 5-year visa, hands it to the filler, and deletes the documents after the traveller submits', async () => {
    const { app, deps } = await makeDeps({ ...FREE, SELF_RETENTION_DAYS: '0' });
    const token = await signIn(app, deps, 'five@example.com');

    // Without the partner route there is no default: the traveller chooses.
    expect((await call(app, 'POST', '/v1/applications', { token, body: { answers: answers() } })).status).toBe(422);
    expect((await call(app, 'POST', '/v1/applications', { token, body: { answers: answers(), route: 'partner' } })).status).toBe(422);

    // A long stay and an arrival far ahead are fine on a multiple-entry visa.
    const trip = { ...answers(), arrival: daysFromNow(120), departure: daysFromNow(200) };
    const created = await call(app, 'POST', '/v1/applications', { token, body: { answers: trip, route: 'five_year' } });
    expect(created.status).toBe(201);
    const id = created.json.application.id;
    expect(created.json.application.route).toBe('five_year');
    expect(created.json.application.quote).toBeNull();
    expect(created.json.application.slots.required).toEqual(['passport', 'photo', 'bank', 'insurance', 'ticket']);
    expect(created.json.application.site.name).toBe('GDRFA Dubai');

    expect((await call(app, 'GET', `/v1/applications/${id}/pack`, { token })).status).toBe(422); // not ready yet
    const prepared = await ready(app, token, id, ['passport', 'photo', 'bank', 'insurance', 'ticket']);
    expect(prepared.readiness.ready).toBe(true);
    expect(prepared.checks.issues.map((i: { id: string }) => i.id)).not.toContain('window');
    expect(prepared.checks.passes).toContain('Your 80-day stay fits the 90-day limit for each visit');

    // Nothing to sign or pay: the traveller pays on the official site.
    expect((await call(app, 'POST', `/v1/applications/${id}/sign`, { token, body: { declarations: {}, signatureName: 'X' } })).status).toBe(409);
    expect((await call(app, 'POST', `/v1/applications/${id}/checkout`, { token })).status).toBe(409);

    const pack = (await call(app, 'GET', `/v1/applications/${id}/pack`, { token })).json.pack;
    expect(pack.traveller).toMatchObject({ given: 'ANANYA RAVI', surname: 'SHARMA', passportNo: 'Z9100234', dob: '1992-06-14', sex: 'F', nationality: { iso2: 'IN', iso3: 'IND', name: 'India' } });
    expect(pack.documents.map((x: { slot: string }) => x.slot).sort()).toEqual(['bank', 'insurance', 'passport', 'photo', 'ticket']);
    const file = new URL(pack.documents.find((x: { slot: string }) => x.slot === 'passport').url);
    const got = await app.request(file.pathname + file.search);
    expect(got.status).toBe(200);
    expect(pack.documents[0].name).toMatch(/-sharma\.png$/);

    const done = await call(app, 'POST', `/v1/applications/${id}/self-submitted`, { token, body: { reference: 'GDRFA-12345' } });
    expect(done.status).toBe(200);
    expect(done.json.application.status).toBe('self_submitted');
    expect(done.json.application.selfRef).toBe('GDRFA-12345');
    expect((await call(app, 'POST', `/v1/applications/${id}/self-submitted`, { token, body: {} })).status).toBe(409);

    await tick(deps); // SELF_RETENTION_DAYS is 0 in this test
    const after = await call(app, 'GET', `/v1/applications/${id}`, { token });
    expect(after.json.application.purged).toBe(true);
    expect(after.json.application.documents).toHaveLength(0);
    expect((await call(app, 'GET', `/v1/applications/${id}/pack`, { token })).status).toBe(409);
  });

  it('needs the airline for an airline visa, and points at that airline', async () => {
    const { app, deps } = await makeDeps(FREE);
    const token = await signIn(app, deps, 'air@example.com');
    expect((await call(app, 'POST', '/v1/applications', { token, body: { answers: answers(), route: 'airline' } })).status).toBe(422);
    const created = await call(app, 'POST', '/v1/applications', { token, body: { answers: answers(), route: 'airline', airline: 'emirates' } });
    expect(created.status).toBe(201);
    expect(created.json.application.site).toMatchObject({ name: 'Emirates', url: 'https://www.emirates.com' });
    expect(created.json.application.slots.required).toEqual(['passport', 'photo']);
    const id = created.json.application.id;
    await ready(app, token, id, ['passport', 'photo']);
    const pack = (await call(app, 'GET', `/v1/applications/${id}/pack`, { token })).json.pack;
    expect(pack.route).toBe('airline');
    expect(pack.trip.emirate).toBe('Dubai');
    const other = await signIn(app, deps, 'someone-else@example.com');
    expect((await call(app, 'GET', `/v1/applications/${id}/pack`, { token: other })).status).toBe(404);
  });

  it('lists only the routes that are switched on', async () => {
    const { app } = await makeDeps(FREE);
    const cfg = (await call(app, 'GET', '/v1/config')).json;
    expect(cfg.routes.map((r: { id: string }) => r.id)).toEqual(['five_year', 'airline']);
    expect(cfg.airlines.map((a: { id: string }) => a.id)).toEqual(['emirates', 'etihad', 'flydubai', 'airarabia']);
  });

  it('runs in production without payments or a partner when only free routes are on', () => {
    const prod = {
      NODE_ENV: 'production',
      AUTH_SECRET: 'x'.repeat(40),
      DATABASE_URL: 'postgres://u@h/db',
      STORAGE_DRIVER: 's3',
      MAIL_DRIVER: 'ses',
      SES_REGION: 'me-central-1',
      AWS_ACCESS_KEY_ID: 'AKID',
      FILING_PROVIDER: 'sandbox',
    };
    expect(() => assertProductionReady(loadConfig({ ...prod, ...FREE }))).not.toThrow();
    expect(() => assertProductionReady(loadConfig(prod))).toThrow(/PAYMENTS_DRIVER must be stripe/);
    expect(() => loadConfig({ ROUTES: 'five_year,visa_run' })).toThrow(/Unknown route: visa_run/);
  });
});
