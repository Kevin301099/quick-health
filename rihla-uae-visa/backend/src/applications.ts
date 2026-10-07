import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Deps } from './deps';
import { HttpError } from './errors';
import { quoteFor, type Quote } from './payments';
import type { FilingPacket, FilingUpdate } from './providers';
import { imageSize, sniffMime } from './images';
import { templates } from './mail';
import { unavailable, type Extraction } from './extract';
import { checkEligibility, NATIONALITIES } from '@/domain/nationalities';
import { runChecks } from '@/domain/checks';
import { similarity } from '@/domain/checks';
import type { Answers, Profile } from '@/domain/types';
import type { PhotoReport } from '@/domain/photo';
import { todayIso } from '@/lib/dates';
import { AIRLINES, ROUTE_SPECS, officialSiteFor, type AirlineId, type RouteId } from '@/domain/routes';
import { SLOTS } from '@/domain/visas';

/*
  One application, one traveller. The lifecycle:

    draft ──review & sign──▶ ready_to_pay ──payment webhook──▶ paid ──filed──▶ queued | submitted
      ▲                                                                           │
      └──────────────── needs_info ◀──── processing ◀─────────────────────────────┘
                                             │
                                   approved | rejected

  Everything a person can change happens in `draft` (or `needs_info`). After signing, the facts are frozen
  so what they paid for is exactly what gets filed.

  Free routes (the 5-year visa, an airline visa) stop earlier: the traveller applies on the official site
  themselves, with the form filled by the Rihla extension in their own browser, then tells us it is done.

    draft ──ready, filled on the official site──▶ self_submitted
*/

export type Status = 'draft' | 'ready_to_pay' | 'paid' | 'queued' | 'submitted' | 'processing' | 'needs_info' | 'approved' | 'rejected' | 'cancelled' | 'self_submitted';

export interface AppRow {
  id: string;
  user_id: string;
  status: Status;
  route: RouteId;
  airline: AirlineId | null;
  /** The official site's reference, when the traveller applied themselves. */
  self_ref: string | null;
  answers: Answers;
  profile: Partial<Profile> & { nationality?: string };
  photo_report: PhotoReport | null;
  checks: { issues: unknown[]; passes: string[]; ranAt: string } | null;
  declarations: Record<string, boolean> | null;
  signature: { name: string; at: string } | null;
  quote: Quote | null;
  payment: { driver: string; sessionId: string; status: string; amount?: number } | null;
  provider: string | null;
  provider_ref: string | null;
  provider_message: string | null;
  permit: { number: string; key?: string; validUntil?: string } | null;
  needs: { message: string; at: string } | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  purged_at: string | null;
}

export interface DocRow {
  id: string;
  application_id: string;
  slot: string;
  storage_key: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  status: 'pending' | 'uploaded';
  width: number | null;
  height: number | null;
  extracted: unknown;
  created_at: string;
  deleted_at: string | null;
}

/* ------------------------------------------------------------------ rules for the live product */

/** For now Rihla files the single-entry tourist visa only. */
export const REQUIRED_SLOTS = ['passport', 'photo'] as const;
export const OPTIONAL_SLOTS = ['ticket', 'hotel', 'insurance'] as const;
export const ALL_SLOTS = [...REQUIRED_SLOTS, ...OPTIONAL_SLOTS, 'bank'] as const;
export const ROUTE_IDS = ['five_year', 'airline', 'partner'] as const;
export const AIRLINE_IDS = ['emirates', 'etihad', 'flydubai', 'airarabia'] as const;

/** The documents an application needs, which depend on how the traveller is applying. */
export const slotsFor = (a: Pick<AppRow, 'route'>) => ROUTE_SPECS[a.route ?? 'partner'];
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Statements the traveller makes themselves. The agent never answers these. */
export const DECLARATIONS = [
  { id: 'refused_before', text: 'Have you ever been refused a UAE visa or entry to the UAE?', mustBe: null },
  { id: 'deported', text: 'Have you ever been deported or banned from entering any country?', mustBe: null },
  { id: 'criminal', text: 'Have you ever been convicted of a crime in any country?', mustBe: null },
  { id: 'truthful', text: 'I confirm the information in this application is true and complete.', mustBe: true },
  { id: 'authorise', text: 'I authorise Rihla and its licensed partner to file this application for me.', mustBe: true },
] as const;

const REQUIRED_PROFILE: { key: keyof Profile; label: string }[] = [
  { key: 'given', label: 'Given names' },
  { key: 'surname', label: 'Surname' },
  { key: 'sex', label: 'Sex' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'passportNo', label: 'Passport number' },
  { key: 'passportExpires', label: 'Passport expiry date' },
  { key: 'phone', label: 'Mobile number' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const AnswersInput = z
  .object({
    nationality: z.string().length(2),
    hasPermit: z.boolean().nullable(),
    days: z.union([z.literal(30), z.literal(60)]),
    arrival: isoDate,
    departure: isoDate,
    emirate: z.enum(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah']),
  })
  .refine((a) => a.departure > a.arrival, { message: 'The leaving date must be after the arrival date', path: ['departure'] });

const short = z.string().trim().max(120);
export const ProfileInput = z
  .object({
    given: short,
    surname: short,
    sex: z.enum(['M', 'F', '']),
    dob: isoDate.or(z.literal('')),
    birthplace: short,
    passportNo: z.string().trim().max(20),
    passportIssued: isoDate.or(z.literal('')),
    passportExpires: isoDate.or(z.literal('')),
    phone: z.string().trim().max(30),
    profession: short,
    address: z.string().trim().max(240),
  })
  .partial();

export const PhotoReportInput = z.object({
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  aspect: z.number(),
  bgLuma: z.number(),
  bgSpread: z.number(),
  checks: z.array(z.object({ id: z.enum(['ratio', 'background', 'resolution', 'weight']), label: z.string().max(60), value: z.string().max(120), ok: z.boolean() })).max(8),
  needsFix: z.boolean(),
  needsResize: z.boolean(),
  blocking: z.boolean(),
});

/* ------------------------------------------------------------------ helpers */

const j = (v: unknown) => JSON.stringify(v ?? null);

export async function logEvent(d: Deps, applicationId: string, actor: 'you' | 'agent' | 'ops' | 'partner' | 'system', type: string, data: Record<string, unknown> = {}) {
  await d.db.query('INSERT INTO events (application_id, actor, type, data) VALUES ($1, $2, $3, $4::jsonb)', [applicationId, actor, type, j(data)]);
}

export async function getApp(d: Deps, id: string): Promise<AppRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'not_found', 'Application not found.');
  const rows = await d.db.query<AppRow>('SELECT * FROM applications WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Application not found.');
  return rows[0];
}

export async function ownApp(d: Deps, userId: string, id: string) {
  const a = await getApp(d, id);
  if (a.user_id !== userId) throw new HttpError(404, 'not_found', 'Application not found.');
  return a;
}

async function setFields(d: Deps, id: string, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  const jsonCols = new Set(['answers', 'profile', 'photo_report', 'checks', 'declarations', 'signature', 'quote', 'payment', 'permit', 'needs']);
  const sets = keys.map((k, i) => `${k} = $${i + 2}${jsonCols.has(k) ? '::jsonb' : ''}`);
  const vals = keys.map((k) => (jsonCols.has(k) ? j(fields[k]) : fields[k]));
  const rows = await d.db.query<AppRow>(`UPDATE applications SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  return rows[0];
}

const editable = (a: AppRow) => a.status === 'draft' || a.status === 'needs_info';

function assertEditable(a: AppRow) {
  if (!editable(a)) throw new HttpError(409, 'locked', 'This application has been signed and can no longer be changed.');
}

export async function docsFor(d: Deps, applicationId: string) {
  return d.db.query<DocRow>(`SELECT * FROM documents WHERE application_id = $1 AND deleted_at IS NULL AND status = 'uploaded' ORDER BY created_at`, [applicationId]);
}

/** The newest uploaded document per slot. Re-uploads replace earlier ones. */
function latestPerSlot(docs: DocRow[]) {
  const m = new Map<string, DocRow>();
  for (const doc of docs) m.set(doc.slot, doc);
  return m;
}

function fullProfile(a: AppRow): Profile {
  const p = a.profile;
  return {
    given: p.given ?? '',
    surname: p.surname ?? '',
    dob: p.dob ?? '',
    sex: (p.sex as Profile['sex']) ?? '',
    birthplace: p.birthplace ?? '',
    passportNo: p.passportNo ?? '',
    passportIssued: p.passportIssued ?? '',
    passportExpires: p.passportExpires ?? '',
    passportPlace: '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    address: p.address ?? '',
    profession: p.profession ?? '',
    marital: '',
    flightNo: '',
    arrivalDate: '',
    arrivalTime: '',
    ticketName: '',
    hotelName: '',
    hotelCheckIn: '',
    hotelCheckOut: '',
    insurer: '',
    policyNo: '',
    insuranceName: '',
    insuranceFrom: '',
    insuranceTo: '',
    sponsor: null,
  };
}

function computeChecks(d: Deps, a: AppRow) {
  const res = runChecks({
    answers: a.answers,
    profile: fullProfile(a),
    photo: a.photo_report,
    hasTicket: false,
    today: todayIso(d.now()),
    multiEntry: a.route === 'five_year' ? { maxStay: 90 } : undefined,
  });
  return { ...res, ranAt: d.now().toISOString() };
}

/** What is still missing before the person can sign. Empty means ready. */
export async function readiness(d: Deps, a: AppRow) {
  const docs = latestPerSlot(await docsFor(d, a.id));
  const missingDocs = slotsFor(a).required.filter((s) => !docs.has(s));
  const missingFields = REQUIRED_PROFILE.filter((f) => !String(a.profile[f.key] ?? '').trim()).map((f) => f.label);
  const checks = a.checks ?? computeChecks(d, a);
  const blocking = (checks.issues as { risk: string; title: string }[]).filter((i) => i.risk === 'high').map((i) => i.title);
  return { missingDocs, missingFields, blocking, ready: !missingDocs.length && !missingFields.length && !blocking.length };
}

/* ------------------------------------------------------------------ create and edit */

export async function createApplication(d: Deps, user: { id: string; email: string }, input: unknown, how: { route?: unknown; airline?: unknown } = {}) {
  const enabled = d.config.ROUTES;
  const route = (how.route ?? (enabled.includes('partner') ? 'partner' : undefined)) as RouteId | undefined;
  if (!route || !enabled.includes(route)) throw new HttpError(422, 'route', 'Choose how you want to apply.');
  const airline = route === 'airline' ? (how.airline as AirlineId) : null;
  if (route === 'airline' && !AIRLINE_IDS.includes(airline as AirlineId)) throw new HttpError(422, 'airline', 'Choose the airline you are flying with.');
  const parsed = AnswersInput.safeParse(input);
  if (!parsed.success) throw new HttpError(422, 'invalid', parsed.error.issues[0]?.message ?? 'Check the trip details');
  const a = parsed.data;
  const elig = checkEligibility(a.nationality, a.hasPermit);
  if (elig.status === 'no_visa' || elig.status === 'on_arrival') throw new HttpError(422, 'no_visa_needed', elig.headline);
  if (!NATIONALITIES.some((n) => n.code === a.nationality)) throw new HttpError(422, 'nationality', 'Choose your passport from the list.');
  const today = todayIso(d.now());
  if (a.arrival < today) throw new HttpError(422, 'past', 'The arrival date is in the past.');
  const answers: Answers = { ...a, visa: 'tourist', relationship: 'friend' };
  const id = randomUUID();
  const quote = route === 'partner' ? quoteFor(d.config, a.days) : null;
  const rows = await d.db.query<AppRow>(
    `INSERT INTO applications (id, user_id, status, answers, profile, quote, route, airline) VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb, $6, $7) RETURNING *`,
    [id, user.id, j(answers), j({ email: user.email }), j(quote), route, airline],
  );
  await logEvent(d, id, 'you', 'created', { route, airline, days: a.days, arrival: a.arrival });
  return rows[0];
}

export async function updateApplication(d: Deps, a: AppRow, input: { answers?: unknown; profile?: unknown; photoReport?: unknown }) {
  assertEditable(a);
  const fields: Record<string, unknown> = {};
  if (input.answers !== undefined) {
    const parsed = AnswersInput.safeParse(input.answers);
    if (!parsed.success) throw new HttpError(422, 'invalid', parsed.error.issues[0]?.message ?? 'Check the trip details');
    fields.answers = { ...a.answers, ...parsed.data, visa: 'tourist' };
    if (a.route === 'partner') fields.quote = quoteFor(d.config, parsed.data.days);
  }
  if (input.profile !== undefined) {
    const parsed = ProfileInput.safeParse(input.profile);
    if (!parsed.success) throw new HttpError(422, 'invalid', parsed.error.issues[0]?.message ?? 'Check your details');
    const p = { ...parsed.data };
    if (p.given) p.given = p.given.toUpperCase();
    if (p.surname) p.surname = p.surname.toUpperCase();
    if (p.passportNo) p.passportNo = p.passportNo.toUpperCase().replace(/\s/g, '');
    fields.profile = { ...a.profile, ...p };
  }
  if (input.photoReport !== undefined) {
    const parsed = PhotoReportInput.safeParse(input.photoReport);
    if (!parsed.success) throw new HttpError(422, 'invalid', 'Photo report is malformed');
    fields.photo_report = parsed.data;
  }
  const next = { ...a, ...fields } as AppRow;
  fields.checks = computeChecks(d, next);
  return setFields(d, a.id, fields);
}

/* ------------------------------------------------------------------ documents */

export async function startUpload(d: Deps, a: AppRow, input: { slot?: string; mime?: string; bytes?: number }) {
  assertEditable(a);
  if (!ALL_SLOTS.includes(input.slot as (typeof ALL_SLOTS)[number])) throw new HttpError(422, 'slot', 'Unknown document type.');
  if (!ACCEPTED_MIME.includes(input.mime as (typeof ACCEPTED_MIME)[number])) throw new HttpError(415, 'type', 'Upload a JPEG, PNG or PDF.');
  if (input.slot === 'photo' && input.mime === 'application/pdf') throw new HttpError(415, 'type', 'The photo must be a JPEG or PNG image.');
  if (!input.bytes || input.bytes > MAX_FILE_BYTES) throw new HttpError(413, 'too_big', 'Files can be up to 10 MB.');
  const id = randomUUID();
  const ext = input.mime === 'application/pdf' ? 'pdf' : input.mime === 'image/png' ? 'png' : 'jpg';
  const key = `applications/${a.id}/${input.slot}-${id}.${ext}`;
  await d.db.query(`INSERT INTO documents (id, application_id, slot, storage_key, mime, bytes) VALUES ($1, $2, $3, $4, $5, $6)`, [id, a.id, input.slot, key, input.mime, input.bytes]);
  const upload = await d.storage.uploadUrl(key, input.mime!);
  return { documentId: id, upload: { method: 'PUT' as const, ...upload } };
}

export async function completeUpload(d: Deps, a: AppRow, documentId: string) {
  assertEditable(a);
  const rows = await d.db.query<DocRow>('SELECT * FROM documents WHERE id = $1 AND application_id = $2', [documentId, a.id]);
  const doc = rows[0];
  if (!doc) throw new HttpError(404, 'not_found', 'Document not found.');
  const bytes = await d.storage.get(doc.storage_key);
  if (!bytes) throw new HttpError(409, 'not_uploaded', 'The upload did not arrive. Please try again.');
  if (bytes.byteLength > MAX_FILE_BYTES) throw new HttpError(413, 'too_big', 'Files can be up to 10 MB.');
  const real = sniffMime(bytes);
  if (!real || real !== doc.mime) {
    await d.storage.remove(doc.storage_key);
    throw new HttpError(415, 'type', 'That file is not a real JPEG, PNG or PDF.');
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const size = real === 'application/pdf' ? null : imageSize(bytes);

  const extraction = doc.slot === 'passport' ? await readPassport(d, a, bytes, real, sha256) : null;

  await d.db.query(`UPDATE documents SET status = 'uploaded', sha256 = $2, bytes = $3, width = $4, height = $5, extracted = $6::jsonb WHERE id = $1`, [
    doc.id,
    sha256,
    bytes.byteLength,
    size?.width ?? null,
    size?.height ?? null,
    j(extraction),
  ]);
  // A new upload replaces any earlier file in the same slot.
  const older = await d.db.query<DocRow>(`SELECT * FROM documents WHERE application_id = $1 AND slot = $2 AND id <> $3 AND deleted_at IS NULL`, [a.id, doc.slot, doc.id]);
  for (const o of older) {
    await d.storage.remove(o.storage_key);
    await d.db.query('UPDATE documents SET deleted_at = now() WHERE id = $1', [o.id]);
  }
  await logEvent(d, a.id, 'you', 'document_uploaded', { slot: doc.slot, bytes: bytes.byteLength });

  let app = a;
  if (extraction && (extraction.status === 'ok' || extraction.status === 'check')) {
    // Fill only what the person has not typed themselves.
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(extraction.fields)) if (v && !String(a.profile[k as keyof Profile] ?? '').trim()) filled[k] = v as string;
    app = await setFields(d, a.id, { profile: { ...a.profile, ...filled } });
    await logEvent(d, a.id, 'agent', 'passport_read', { verified: extraction.verified, attention: extraction.attention });
    if (extraction.fields.nationality && extraction.fields.nationality !== '') {
      const iso2 = ISO3_TO_ISO2[extraction.fields.nationality];
      if (iso2 && iso2 !== a.answers.nationality) extraction.attention.push('nationality');
    }
  }
  const next = { ...app };
  app = await setFields(d, a.id, { checks: computeChecks(d, next) });
  return { document: publicDoc({ ...doc, status: 'uploaded', sha256, bytes: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null, extracted: extraction }), extraction, application: app };
}

/**
 * Reads a passport at most once per unique file, and only within the spending limits: a cap on model calls per
 * application (so repeated uploads cannot run up the bill) and a monthly budget for the whole service.
 * Over a limit, the person types their details instead; nothing else in the application changes.
 */
async function readPassport(d: Deps, a: AppRow, bytes: Uint8Array, mime: string, sha256: string): Promise<Extraction> {
  const cached = await d.db.query<{ result: Extraction }>('SELECT result FROM extraction_cache WHERE sha256 = $1', [sha256]);
  if (cached[0]) return cached[0].result;
  const [spent] = await d.db.query<{ app_calls: string; month_usd: string }>(
    `SELECT (SELECT count(*) FROM ai_usage WHERE application_id = $1)::text AS app_calls,
            (SELECT coalesce(sum(cost_usd), 0) FROM ai_usage WHERE created_at >= date_trunc('month', now()))::text AS month_usd`,
    [a.id],
  );
  const { AI_CALLS_PER_APPLICATION: perApp, AI_MONTHLY_BUDGET_USD: budget } = d.config;
  if (perApp > 0 && Number(spent.app_calls) >= perApp) return unavailable('We have read several passport files for this application already. Please type your details.');
  if (budget > 0 && Number(spent.month_usd) >= budget) {
    console.warn(`[extract] monthly reading budget of $${budget} reached; people type their details until it is raised or the month ends`);
    return unavailable('Automatic reading is paused right now. Please type your passport details.');
  }
  const { extraction, calls } = await d.extractor.passport(bytes, mime);
  for (const call of calls) {
    await d.db.query(`INSERT INTO ai_usage (application_id, purpose, model, input_tokens, output_tokens, cost_usd, outcome) VALUES ($1, 'passport', $2, $3, $4, $5, $6)`, [
      a.id,
      call.model,
      call.inputTokens,
      call.outputTokens,
      call.costUsd,
      call.outcome,
    ]);
  }
  if (calls.length && extraction.model) {
    await d.db.query('INSERT INTO extraction_cache (sha256, result, model) VALUES ($1, $2::jsonb, $3) ON CONFLICT DO NOTHING', [sha256, j(extraction), extraction.model]);
  }
  return extraction;
}

/** Three-letter codes used on passports for the nationalities the app knows. */
const ISO3_TO_ISO2: Record<string, string> = {
  GBR: 'GB', USA: 'US', D: 'DE', DEU: 'DE', FRA: 'FR', ITA: 'IT', ESP: 'ES', NLD: 'NL', CHE: 'CH', RUS: 'RU', IND: 'IN', PHL: 'PH', IDN: 'ID', VNM: 'VN', THA: 'TH', KEN: 'KE', ZAF: 'ZA', PAK: 'PK', BGD: 'BD', NGA: 'NG',
};

export function publicDoc(doc: DocRow) {
  return { id: doc.id, slot: doc.slot, mime: doc.mime, bytes: doc.bytes, width: doc.width, height: doc.height, uploadedAt: doc.created_at };
}

/* ------------------------------------------------------------------ review, sign, pay */

const assertPartner = (a: AppRow) => {
  if (a.route !== 'partner') throw new HttpError(409, 'self_route', 'You apply for this visa yourself on the official site, so there is nothing to sign or pay here.');
};

export async function signApplication(d: Deps, a: AppRow, input: { declarations?: Record<string, boolean>; signatureName?: string }) {
  assertPartner(a);
  assertEditable(a);
  const fresh = await setFields(d, a.id, { checks: computeChecks(d, a) });
  const r = await readiness(d, fresh);
  if (!r.ready) {
    const what = [...r.missingDocs.map((s) => `the ${s}`), ...r.missingFields, ...r.blocking].join(', ');
    throw new HttpError(422, 'not_ready', `Before signing we still need: ${what}.`);
  }
  const decl = input.declarations ?? {};
  for (const q of DECLARATIONS) {
    if (typeof decl[q.id] !== 'boolean') throw new HttpError(422, 'declarations', 'Please answer every question.');
    if (q.mustBe !== null && decl[q.id] !== q.mustBe) throw new HttpError(422, 'declarations', 'Please confirm the statements to continue.');
  }
  const name = (input.signatureName ?? '').trim().toUpperCase();
  const passportName = `${fresh.profile.given ?? ''} ${fresh.profile.surname ?? ''}`.trim();
  if (!name || similarity(name, passportName) < 0.85) throw new HttpError(422, 'signature', `Type your full name as it appears in your passport: ${passportName}.`);
  const signature = { name, at: d.now().toISOString() };
  const updated = await setFields(d, a.id, { status: 'ready_to_pay', declarations: decl, signature, quote: quoteFor(d.config, a.answers.days), needs: null });
  const flagged = DECLARATIONS.filter((q) => q.mustBe === null && decl[q.id]).map((q) => q.id);
  await logEvent(d, a.id, 'you', 'signed', { flagged });
  return updated;
}

export async function startCheckout(d: Deps, a: AppRow, email: string) {
  assertPartner(a);
  if (a.status !== 'ready_to_pay') throw new HttpError(409, 'not_ready', a.status === 'draft' ? 'Review and sign the application first.' : 'This application is already paid.');
  const quote = a.quote ?? quoteFor(d.config, a.answers.days);
  const base = `${d.config.APP_URL}/#app-${a.id}`;
  const s = await d.payments.createCheckout({ applicationId: a.id, email, quote, successUrl: `${base}-paid`, cancelUrl: base });
  await setFields(d, a.id, { payment: { driver: d.payments.driver, sessionId: s.sessionId, status: 'open' } });
  await logEvent(d, a.id, 'you', 'checkout_started', { total: quote.total });
  return s;
}

/** Called from the verified payment webhook (or the fake checkout). Idempotent. */
export async function markPaid(d: Deps, applicationId: string, sessionId: string, amount?: number) {
  const a = await getApp(d, applicationId);
  if (a.status !== 'ready_to_pay') return a;
  if (a.payment?.sessionId && a.payment.sessionId !== sessionId) {
    // A second checkout session can complete; record it so ops can refund the duplicate.
    await logEvent(d, a.id, 'system', 'payment_mismatch', { expected: a.payment.sessionId, got: sessionId });
  }
  const updated = await setFields(d, a.id, { status: 'paid', paid_at: d.now().toISOString(), payment: { driver: d.payments.driver, sessionId, status: 'paid', amount } });
  await logEvent(d, a.id, 'you', 'paid', { amount });
  await notify(d, updated, 'paid');
  // File straight away rather than on the next scheduled run, so the scheduler can run rarely (or the database
  // can sleep). If filing fails here, the scheduled run retries it.
  try {
    return await submitToProvider(d, updated);
  } catch (e) {
    console.error('[filing] submit after payment failed', a.id, e);
    await logEvent(d, a.id, 'system', 'filing_error', { message: String(e).slice(0, 300) });
    return updated;
  }
}

/* ------------------------------------------------------------------ filing */

export async function packetFor(d: Deps, a: AppRow): Promise<FilingPacket> {
  const docs = latestPerSlot(await docsFor(d, a.id));
  const p = fullProfile(a);
  const documents = await Promise.all([...docs.values()].map(async (doc) => ({ slot: doc.slot, mime: doc.mime, url: await d.storage.downloadUrl(doc.storage_key, 3 * 86400) })));
  const nat = Object.entries(ISO3_TO_ISO2).find(([, v]) => v === a.answers.nationality)?.[0] ?? a.answers.nationality;
  return {
    applicationId: a.id,
    visa: { type: 'tourist', days: a.answers.days, entry: 'single' },
    traveller: {
      given: p.given,
      surname: p.surname,
      sex: p.sex,
      dob: p.dob,
      nationality: nat,
      birthplace: p.birthplace,
      passportNo: p.passportNo,
      passportIssued: p.passportIssued,
      passportExpires: p.passportExpires,
      email: p.email,
      phone: p.phone,
      profession: p.profession,
    },
    trip: { arrival: a.answers.arrival, departure: a.answers.departure, emirate: a.answers.emirate },
    documents,
    declarations: a.declarations ?? {},
    signature: a.signature ?? { name: '', at: '' },
  };
}

/** Applications that are paid but not filed, and not being filed by someone else right now. */
export const UNFILED = `status = 'paid' AND provider_ref IS NULL AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')`;

export async function submitToProvider(d: Deps, a: AppRow) {
  if (a.status !== 'paid' || a.provider_ref) return a;
  // Claim it first, so the payment webhook and a scheduled run (or two instances) never file it twice.
  const [claimed] = await d.db.query<AppRow>(`UPDATE applications SET claimed_at = now() WHERE id = $1 AND ${UNFILED} RETURNING *`, [a.id]);
  if (!claimed) return a;
  try {
    const { ref, update } = await d.provider.submit(await packetFor(d, claimed));
    const updated = await setFields(d, a.id, { provider: d.provider.name, provider_ref: ref, submitted_at: d.now().toISOString() });
    await logEvent(d, a.id, 'agent', 'filed', { provider: d.provider.name, ref });
    return applyUpdate(d, updated, update, d.provider.name === 'manual' ? 'agent' : 'partner');
  } catch (e) {
    await d.db.query('UPDATE applications SET claimed_at = NULL WHERE id = $1', [a.id]);
    throw e;
  }
}

/** Moves an application to the state a provider (or ops) reports. Safe to call with the same update twice. */
export async function applyUpdate(d: Deps, a: AppRow, u: FilingUpdate, actor: 'partner' | 'ops' | 'agent') {
  if (a.status === 'approved' || a.status === 'rejected' || a.status === 'cancelled') return a;
  if (u.state === a.status && !u.permit && (u.message ?? null) === a.provider_message) return a;
  const fields: Record<string, unknown> = { status: u.state, provider_message: u.message ?? null };
  if (u.state === 'needs_info') fields.needs = { message: u.message ?? 'We need something from you.', at: d.now().toISOString() };
  if (u.state === 'approved') {
    if (!u.permit) throw new Error('An approval needs a permit');
    let key: string | undefined;
    if (u.permit.file) {
      key = `applications/${a.id}/permit-${u.permit.number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
      await d.storage.put(key, u.permit.file.bytes, u.permit.file.mime);
    } else if (u.permit.url) {
      const r = await fetch(u.permit.url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`Could not fetch the permit: ${r.status}`);
      key = `applications/${a.id}/permit-${u.permit.number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
      await d.storage.put(key, new Uint8Array(await r.arrayBuffer()), 'application/pdf');
    }
    fields.permit = { number: u.permit.number, key, validUntil: u.permit.validUntil };
    fields.decided_at = d.now().toISOString();
  }
  if (u.state === 'rejected') fields.decided_at = d.now().toISOString();
  const updated = await setFields(d, a.id, fields);
  await logEvent(d, a.id, actor, `status_${u.state}`, { message: u.message, permit: u.permit?.number });
  if (u.state === 'approved' || u.state === 'rejected' || u.state === 'needs_info') await notify(d, updated, u.state);
  return updated;
}

async function notify(d: Deps, a: AppRow, kind: 'paid' | 'approved' | 'rejected' | 'needs_info') {
  const email = a.profile.email;
  if (!email) return;
  const url = `${d.config.APP_URL}/#app-${a.id}`;
  const name = `${a.profile.given ?? ''}`.split(' ')[0] || 'there';
  const t =
    kind === 'paid'
      ? templates.paid(url)
      : kind === 'approved'
        ? templates.approved(url, name.charAt(0) + name.slice(1).toLowerCase())
        : kind === 'rejected'
          ? templates.rejected(url, a.provider_message ?? '')
          : templates.needsYou(url, a.needs?.message ?? 'We need something from you to continue.');
  try {
    await d.mailer.send({ to: email, ...t });
  } catch (e) {
    console.error('[mail] failed', e);
  }
}

/** The person answered a request for more information. */
export async function respond(d: Deps, a: AppRow, message: string) {
  if (a.status !== 'needs_info') throw new HttpError(409, 'not_waiting', 'Nothing is waiting for you on this application.');
  const updated = await setFields(d, a.id, { status: d.provider.automatic ? 'processing' : 'queued', needs: null });
  await logEvent(d, a.id, 'you', 'responded', { message: message.slice(0, 1000) });
  return updated;
}

/* ------------------------------------------------------------------ applying yourself (free routes) */

const iso3Of = (iso2: string) => Object.entries(ISO3_TO_ISO2).find(([k, v]) => v === iso2 && k.length === 3)?.[0] ?? iso2;

/** Where the traveller applies, for a free route. */
export function siteFor(a: Pick<AppRow, 'route' | 'airline' | 'answers'>) {
  if (a.route === 'airline' && a.airline) return AIRLINES[a.airline];
  if (a.route === 'five_year') return officialSiteFor(a.answers.emirate);
  return null;
}

/**
 * Everything the Rihla extension needs to fill the official form: the traveller's details and short-lived links to
 * their documents. The web page downloads the files and hands the lot to the extension in the same browser, so
 * the official site's login, payment and submit button stay entirely with the traveller.
 */
export async function packFor(d: Deps, a: AppRow) {
  if (a.route === 'partner') throw new HttpError(409, 'partner_route', 'This application is filed for you by our partner.');
  if (a.purged_at) throw new HttpError(409, 'purged', 'The documents for this application have been deleted.');
  if (editable(a)) {
    const r = await readiness(d, a);
    if (!r.ready) throw new HttpError(422, 'not_ready', 'Finish your documents and details first.');
  }
  const p = fullProfile(a);
  const docs = [...latestPerSlot(await docsFor(d, a.id)).values()];
  const nationality = NATIONALITIES.find((n) => n.code === a.answers.nationality);
  await logEvent(d, a.id, 'you', 'handed_to_filler', { documents: docs.length });
  return {
    v: 1 as const,
    applicationId: a.id,
    route: a.route,
    airline: a.airline,
    site: siteFor(a),
    preparedAt: d.now().toISOString(),
    traveller: {
      given: p.given,
      surname: p.surname,
      sex: p.sex,
      dob: p.dob,
      birthplace: p.birthplace,
      nationality: { iso2: a.answers.nationality, iso3: iso3Of(a.answers.nationality), name: nationality?.name ?? '' },
      passportNo: p.passportNo,
      passportType: 'Normal',
      passportIssued: p.passportIssued,
      passportExpires: p.passportExpires,
      email: p.email,
      phone: p.phone,
      profession: p.profession,
      address: p.address,
    },
    trip: { arrival: a.answers.arrival, departure: a.answers.departure, emirate: a.answers.emirate },
    documents: await Promise.all(
      docs.map(async (doc) => {
        const ext = doc.mime === 'application/pdf' ? 'pdf' : doc.mime === 'image/png' ? 'png' : 'jpg';
        const name = `${doc.slot}-${(p.surname || 'traveller').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
        return { slot: doc.slot, label: SLOTS[doc.slot as keyof typeof SLOTS]?.label ?? doc.slot, mime: doc.mime, name, url: await d.storage.downloadUrl(doc.storage_key, 300) };
      }),
    ),
  };
}

/** The traveller tells us they submitted on the official site. Their documents are deleted soon after. */
export async function selfSubmitted(d: Deps, a: AppRow, reference: string) {
  if (a.route === 'partner') throw new HttpError(409, 'partner_route', 'This application is filed for you by our partner.');
  if (a.status !== 'draft') throw new HttpError(409, 'not_draft', 'This application is already marked as submitted.');
  const updated = await setFields(d, a.id, { status: 'self_submitted', self_ref: reference.trim().slice(0, 60) || null, submitted_at: d.now().toISOString() });
  await logEvent(d, a.id, 'you', 'self_submitted', { reference: reference.trim().slice(0, 60) });
  return updated;
}

/* ------------------------------------------------------------------ public views */

export async function publicApp(d: Deps, a: AppRow, opts: { withFiles?: boolean } = {}) {
  const docs = await docsFor(d, a.id);
  const latest = [...latestPerSlot(docs).values()];
  const events = await d.db.query<{ id: string; actor: string; type: string; data: unknown; created_at: string }>('SELECT id, actor, type, data, created_at FROM events WHERE application_id = $1 ORDER BY id', [a.id]);
  const r = editable(a) ? await readiness(d, a) : null;
  const files = opts.withFiles
    ? await Promise.all(latest.map(async (doc) => ({ ...publicDoc(doc), url: await d.storage.downloadUrl(doc.storage_key, 300) })))
    : latest.map(publicDoc);
  const lastPassport = latest.find((x) => x.slot === 'passport');
  const spec = slotsFor(a);
  return {
    id: a.id,
    status: a.status,
    route: a.route,
    airline: a.airline,
    selfRef: a.self_ref,
    site: siteFor(a),
    slots: { required: spec.required, optional: spec.optional },
    answers: a.answers,
    profile: a.profile,
    photoReport: a.photo_report,
    checks: a.checks,
    declarations: a.declarations,
    signature: a.signature,
    quote: a.quote,
    payment: a.payment ? { status: a.payment.status, amount: a.payment.amount } : null,
    provider: a.provider,
    providerRef: a.provider_ref,
    providerMessage: a.provider_message,
    needs: a.needs,
    permit: a.permit ? { number: a.permit.number, validUntil: a.permit.validUntil, available: !!a.permit.key } : null,
    documents: files,
    extraction: (lastPassport?.extracted as unknown) ?? null,
    readiness: r,
    events: events.map((e) => ({ id: Number(e.id), actor: e.actor, type: e.type, data: e.data, at: e.created_at })),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    purged: !!a.purged_at,
  };
}

export async function permitUrl(d: Deps, a: AppRow) {
  if (a.status !== 'approved' || !a.permit?.key) throw new HttpError(404, 'no_permit', 'The visa is not ready yet.');
  return d.storage.downloadUrl(a.permit.key, 300, `UAE-visa-${a.permit.number}.pdf`);
}
