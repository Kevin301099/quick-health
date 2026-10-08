import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';

/*
  Loads the real extension into Chromium and fills replicas of the kinds of forms it meets on official sites:
  a government e-service (table layout, unlinked labels, ASP.NET ids, English and Arabic), an airline's
  framework-driven form (split date, two steps, a card section) and an Arabic-only page. Login, one-time code,
  captcha, card fields, declarations and the submit and pay buttons must all stay untouched.

  CHROME_PATH picks the browser; SHOTS=<dir> saves screenshots.
*/

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = 47811;
const APP = `http://127.0.0.1:${PORT}`; // stands in for the Rihla web app
const SITE = `http://localhost:${PORT}`; // stands in for an official site: a different origin
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

function png(width, height) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const h = Buffer.alloc(13);
  h.writeUInt32BE(width, 0);
  h.writeUInt32BE(height, 4);
  h[8] = 8;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', deflateSync(Buffer.alloc((width + 1) * height, 200))), chunk('IEND', Buffer.alloc(0))]);
}
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const doc = (slot, label, mime, buf) => ({ slot, label, mime, name: `${slot}-sharma.${mime === 'application/pdf' ? 'pdf' : 'png'}`, data: `data:${mime};base64,${buf.toString('base64')}` });

const PACK = {
  v: 1,
  applicationId: '6d1c2b9e-0000-4000-8000-000000000001',
  route: 'five_year',
  airline: null,
  site: { name: 'GDRFA Dubai', url: 'https://www.gdrfad.gov.ae', steps: [] },
  preparedAt: new Date().toISOString(),
  traveller: {
    given: 'ANANYA RAVI',
    surname: 'SHARMA',
    sex: 'F',
    dob: '1992-06-14',
    birthplace: 'PUNE',
    nationality: { iso2: 'IN', iso3: 'IND', name: 'India' },
    passportNo: 'Z9100234',
    passportType: 'Normal',
    passportIssued: '2019-03-01',
    passportExpires: '2029-02-28',
    email: 'ananya@example.com',
    phone: '+91 98200 11223',
    profession: 'SOFTWARE ENGINEER',
    address: 'FLAT 4, MG ROAD, PUNE',
  },
  trip: { arrival: '2026-11-20', departure: '2026-12-10', emirate: 'Dubai' },
  documents: [
    doc('passport', 'Passport', 'image/png', png(40, 28)),
    doc('photo', 'Passport-style photo', 'image/png', png(30, 38)),
    doc('bank', 'Bank statements', 'application/pdf', pdf),
    doc('insurance', 'Travel health insurance', 'application/pdf', pdf),
    doc('ticket', 'Return or onward ticket', 'application/pdf', pdf),
  ],
};

let server;
let ctx;
let sw;
let extensionId;

before(async () => {
  const ext = mkdtempSync(join(tmpdir(), 'rihla-ext-'));
  execFileSync('node', ['build.mjs'], { cwd: root, env: { ...process.env, OUT_DIR: ext, RIHLA_APP_ORIGINS: APP, TEST_HOSTS: 'http://localhost/*' } });
  const types = { '.html': 'text/html; charset=utf-8' };
  server = createServer((req, res) => {
    const file = join(here, 'fixtures', new URL(req.url, APP).pathname);
    let body;
    try {
      body = readFileSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'rihla-profile-')), {
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  extensionId = new URL(sw.url()).host;
});

after(async () => {
  await ctx?.close();
  server?.close();
});

async function fill(page) {
  return sw.evaluate(async (url) => {
    const [t] = await chrome.tabs.query({ url });
    return globalThis.rihlaFillTab(t.id);
  }, page.url());
}
const val = (page, sel) => page.$eval(sel, (el) => el.value);

test('the Rihla web app hands the pack over, and only the Rihla web app can', async () => {
  const page = await ctx.newPage();
  await page.goto(`${APP}/app.html`);
  assert.equal(await page.evaluate(() => window.rihla.ready), '0.1.0');
  const bad = await page.evaluate(() => window.rihla.send({ v: 1, applicationId: 'x', route: 'partner' }));
  assert.equal(bad.ok, false);
  const ok = await page.evaluate((p) => window.rihla.send(p), PACK);
  assert.equal(ok.ok, true, ok.error);
  const stored = await sw.evaluate(() => chrome.storage.local.get('rihla.pack'));
  assert.equal(stored['rihla.pack'].pack.traveller.passportNo, 'Z9100234');

  // The same page on another origin is not the Rihla app: the extension does not answer it.
  const other = await ctx.newPage();
  await other.goto(`${SITE}/app.html`);
  const answered = await other.evaluate(() => Promise.race([window.rihla.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 800))]));
  assert.equal(answered, false);
  await page.close();
  await other.close();
});

test('fills a government e-service form and leaves everything private alone', async () => {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gov.html`);
  const r = await fill(page);
  assert.equal(r.ok, true, r.message);
  const id = (s) => `#ctl00_ContentPlaceHolder1_${s}`;

  assert.equal(await val(page, id('txtFirstNameEn')), 'ANANYA');
  assert.equal(await val(page, id('txtMiddleNameEn')), 'RAVI');
  assert.equal(await val(page, id('txtLastNameEn')), 'SHARMA');
  assert.equal(await val(page, id('txtDOB')), '14/06/1992');
  assert.equal(await val(page, id('txtBirthPlace')), 'PUNE');
  assert.equal(await val(page, id('ddlNationality')), 'IND');
  assert.equal(await val(page, id('txtProfession')), 'SOFTWARE ENGINEER');
  assert.equal(await val(page, id('ddlPassportType')), '1');
  assert.equal(await val(page, id('txtPassportNo')), 'Z9100234');
  assert.equal(await val(page, id('txtPassportIssueDate')), '01/03/2019');
  assert.equal(await val(page, id('txtPassportExpiryDate')), '28/02/2029');
  assert.equal(await val(page, id('ddlIssueCountry')), 'IND');
  assert.equal(await val(page, id('txtEmail')), 'ananya@example.com');
  assert.equal(await val(page, id('txtConfirmEmail')), 'ananya@example.com');
  assert.equal(await val(page, id('txtMobile')), '+91 98200 11223');
  assert.equal(await val(page, id('txtAddress')), 'FLAT 4, MG ROAD, PUNE');
  assert.equal(await page.$eval('input[name$="rblGender"][value="2"]', (el) => el.checked), true);

  // Documents attached, each to the right box
  const fileName = (s) => page.$eval(id(s), (el) => el.files[0]?.name ?? '');
  assert.equal(await fileName('fuPassport'), 'passport-sharma.png');
  assert.equal(await fileName('fuPhoto'), 'photo-sharma.png');
  assert.equal(await fileName('fuBank'), 'bank-sharma.pdf');
  assert.equal(await fileName('fuInsurance'), 'insurance-sharma.pdf');
  assert.equal(await fileName('fuTicket'), 'ticket-sharma.pdf');
  assert.equal(r.attached, 5);

  // Untouched: other people's names, the Arabic-script name, the login, the code, the captcha, the declaration
  for (const s of ['txtFatherName', 'txtFirstNameAr', 'txtUserName', 'txtPassword', 'txtOTP', 'txtCaptcha', 'ddlPrevNationality', 'ddlBirthCountry', 'ddlMobileCode']) assert.equal(await val(page, id(s)), '', s);
  assert.equal(await page.$eval(id('chkDeclare'), (el) => el.checked), false);
  assert.equal(await page.evaluate(() => window.__submitted || window.__clicked || false), false);

  // The review panel lists what to check; the issuing country is a guess from the nationality, so it is one of them
  const panel = page.locator('#rihla-filler-panel');
  await panel.waitFor({ state: 'attached' });
  const text = await panel.evaluate((h) => h.shadowRoot.textContent);
  assert.match(text, /Check theseIssuing country/);
  assert.doesNotMatch(text, /Check these.*Place of birth.*Filled/);
  assert.match(text, /Only you can do these/);
  if (shots) await page.screenshot({ path: join(shots, 'gov-filled.png'), fullPage: true });

  // Undo puts the page back as it was
  await panel.evaluate((h) => [...h.shadowRoot.querySelectorAll('button')].find((b) => b.textContent === 'Undo').click());
  assert.equal(await val(page, id('txtPassportNo')), '');
  assert.equal(await page.$eval(id('fuPassport'), (el) => el.files.length), 0);
  await page.close();
});

test('fills a framework-driven airline form across two steps, never the card', async () => {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/airline.html`);
  const r = await fill(page);
  assert.equal(r.ok, true, r.message);
  const model = await page.evaluate(() => window.model);
  assert.deepEqual(
    { ...model },
    { firstName: 'ANANYA', middleName: 'RAVI', lastName: 'SHARMA', dobDay: '14', dobMonth: '06', dobYear: '1992', gender: 'F', nationality: 'Indian', passportNumber: 'Z9100234', passportExpiry: '2029-02-28', email: 'ananya@example.com' },
  );
  if (shots) await page.screenshot({ path: join(shots, 'airline-step1.png'), fullPage: true });

  await page.click('#next');
  const r2 = await fill(page);
  assert.equal(r2.ok, true);
  assert.equal(await page.$eval('#upPassport', (el) => el.files[0]?.name), 'passport-sharma.png');
  assert.equal(await page.$eval('#upPhoto', (el) => el.files[0]?.name), 'photo-sharma.png');
  for (const s of ['#cardNumber', '#cardExpiry', '#cvv', '#cardName']) assert.equal(await val(page, s), '', s);
  assert.equal(await page.evaluate(() => window.__paid ?? false), false);
  if (shots) await page.screenshot({ path: join(shots, 'airline-step2.png'), fullPage: true });
  await page.close();
});

test('reads Arabic labels', async () => {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/arabic.html`);
  const r = await fill(page);
  assert.equal(r.ok, true, r.message);
  assert.equal(await val(page, '#a1'), 'ANANYA RAVI');
  assert.equal(await val(page, '#a2'), 'SHARMA');
  assert.equal(await val(page, '#a3'), 'Z9100234');
  assert.equal(await val(page, '#a4'), '14-06-1992');
  assert.equal(await val(page, '#a5'), '7');
  assert.equal(await val(page, '#a6'), '2');
  assert.equal(await val(page, '#a7'), '28-02-2029');
  assert.equal(await val(page, '#a8'), 'ananya@example.com');
  assert.equal(await val(page, '#a9'), '+91 98200 11223');
  assert.equal(await val(page, '#a10'), '');
  if (shots) await page.screenshot({ path: join(shots, 'arabic.png'), fullPage: true });
  await page.close();
});

test('marks pick-from-list boxes and calendar-only dates for the traveller', async () => {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/angular.html`);
  const r = await fill(page);
  assert.equal(r.ok, true, r.message);
  assert.equal(await val(page, '#given'), 'ANANYA RAVI');
  assert.equal(await val(page, '#family'), 'SHARMA');
  assert.equal(await val(page, '#ppn'), 'Z9100234');
  // Typed, and the list is open, but only the traveller's pick makes it count: amber, with a note.
  assert.equal(await val(page, '#nat'), 'India');
  assert.equal(await page.evaluate(() => window.picked), null);
  // A calendar-only box cannot be typed into: listed for the traveller, with the date to pick.
  assert.equal(await val(page, '#dob'), '');
  const text = await page.locator('#rihla-filler-panel').evaluate((h) => h.shadowRoot.textContent);
  assert.match(text, /Choose “India” from the list that opens/);
  assert.match(text, /Fill these yourself.*Date of birth14\/06\/1992Pick this date in the calendar/);
  if (shots) await page.screenshot({ path: join(shots, 'picker.png'), fullPage: true });
  await page.close();
});

test('the popup shows who is loaded, and the app can make the extension forget', async () => {
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 360, height: 520 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForSelector('#ready:not([hidden])');
  assert.equal(await popup.textContent('#name'), 'ANANYA RAVI SHARMA');
  assert.match(await popup.textContent('#passport'), /···0234 · India/);
  if (shots) await popup.screenshot({ path: join(shots, 'popup.png') });

  const app = await ctx.newPage();
  await app.goto(`${APP}/app.html`);
  await app.evaluate(() => window.rihla.ready);
  await app.evaluate(
    () =>
      new Promise((resolve) => {
        window.addEventListener('message', (e) => e.data?.type === 'rihla:forgotten' && resolve());
        window.postMessage({ source: 'rihla-app', type: 'rihla:forget', id: 'f' }, location.origin);
      }),
  );
  const stored = await sw.evaluate(() => chrome.storage.local.get('rihla.pack'));
  assert.equal(stored['rihla.pack'], undefined);
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gov.html`);
  assert.equal((await fill(page)).reason, 'no_pack');
});
