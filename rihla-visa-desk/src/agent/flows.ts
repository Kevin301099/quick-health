import type { Applicant, CaseStatus, Conflict, StepId } from './types';
import type { FlowCtx } from './engine';
import { useStore } from './store';
import { allowAuto } from './policy';
import { buildDocs } from './fixtures/docs';
import { crossCheck } from './checks';
import { buildForm, formProgress } from './forms';
import { buildQuote } from './fees';
import { applicantMessage, decisionMessage } from './messages';
import { REF_DATE } from './fixtures/people';
import { fmtDate, ageOn, aed, uid } from '@/lib/utils';

type StepFn = (ctx: FlowCtx) => Promise<void | 'skipped'>;

const SYM = { GBP: '£', CAD: 'CA$', USD: 'US$', EUR: '€' } as const;

const first = (a: Applicant) => a.given.split(' ')[0].charAt(0) + a.given.split(' ')[0].slice(1).toLowerCase();
const fullName = (a: Applicant) =>
  `${a.given} ${a.surname}`
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function active(ctx: FlowCtx) {
  const held = ctx.data().held;
  return ctx.applicants.filter((a) => !held.includes(a.id));
}

function findItem(ctx: FlowCtx, interruptId: string) {
  const items = useStore.getState().cases[ctx.caseId]?.items ?? [];
  return items.find((i) => i.kind === 'ui' && i.props.interruptId === interruptId);
}

function resolvedBy(ctx: FlowCtx, interruptId: string): 'human' | 'agent' | 'client' {
  const it = findItem(ctx, interruptId);
  const r = it && it.kind === 'ui' ? (it.props.resolved as { by?: 'human' | 'agent' | 'client' } | undefined) : undefined;
  return r?.by ?? 'human';
}

/** Validity of the authorisation for one traveller: the corridor cap or the passport, whichever ends first. */
function validUntil(ctx: FlowCtx, a: Applicant) {
  const cap = ctx.corridor.maxValidityMonths;
  if (!cap) return null;
  const [y, m, d] = REF_DATE.split('-').map(Number);
  const capDate = new Date(Date.UTC(y, m - 1 + cap, d)).toISOString().slice(0, 10);
  return a.passportExpires < capDate ? { date: a.passportExpires, limited: true } : { date: capDate, limited: false };
}

/* ---------------------------------------------------------------- steps */

const intake: StepFn = async (ctx) => {
  const { meta, corridor, applicants } = ctx;
  const trip = meta.trip;
  await ctx.say(`Opened ${meta.id}. Reading the ${meta.channel} message from ${meta.client.name}.`);
  const adults = applicants.filter((a) => ageOn(a.dob, REF_DATE) >= 18).length;
  const kids = applicants.length - adults;
  await ctx.tool('read_inbox', { channel: meta.channel, case: meta.id }, () => true, {
    ms: 800,
    summary: () => `1 message · ${applicants.length} traveller${applicants.length === 1 ? '' : 's'} named`,
  });
  await ctx.render(
    'IntakeSummary',
    {
      channel: meta.channel,
      received: meta.received,
      from: meta.client.name,
      message: meta.message,
      language: 'English',
      extracted: [
        { label: 'Travellers', value: kids ? `${applicants.length} (${adults} adult${adults === 1 ? '' : 's'}, ${kids} child${kids === 1 ? '' : 'ren'})` : `${applicants.length}` },
        { label: 'Destination', value: `${trip.city}, ${corridor.destination}` },
        { label: 'Dates', value: `${fmtDate(trip.from)} to ${fmtDate(trip.to)}` },
        { label: 'Purpose', value: trip.purpose },
      ],
    },
    { gen: 700 },
  );
  await ctx.say(
    `I have what I need to start. I will check what applies to a UAE passport holder going to ${corridor.destination} before I ask the client for anything.`,
  );
};

const requirements: StepFn = async (ctx) => {
  const { corridor, applicants, meta } = ctx;
  await ctx.say(`Checking the rule pack for UAE passport holders travelling to ${corridor.destination}.`);
  await ctx.tool(
    'lookup_requirements',
    { nationality: 'ARE', destination: corridor.destination, purpose: meta.trip.purpose },
    () => corridor,
    { ms: 1100, summary: (c) => `${c.rulepack} · reviewed ${c.reviewed}` },
  );
  const sym = SYM[corridor.gov.currency];
  const n = applicants.length;
  const govLocal = n * corridor.gov.perPerson + (corridor.gov.extras ?? []).reduce((s, e) => s + e.amount * n, 0);
  const determination =
    corridor.id === 'uk-eta' ? 'ETA required. No visa.' : corridor.id === 'ca-eta' ? 'eTA required. No visa.' : corridor.id === 'us-b1b2' ? 'Visa required.' : 'No visa today. ETIAS is coming.';
  await ctx.render(
    'RequirementsCard',
    {
      corridor: {
        name: corridor.name,
        short: corridor.short,
        mode: corridor.mode,
        headline: corridor.headline,
        decision: corridor.decision,
        validity: corridor.validity,
        portal: corridor.portal,
        rulepack: corridor.rulepack,
        reviewed: corridor.reviewed,
        sources: corridor.sources,
      },
      determination,
      items: corridor.requirements,
      fees: {
        perPerson: `${sym}${corridor.gov.perPerson}${corridor.gov.extras ? ` + ${sym}${corridor.gov.extras[0].amount}` : ''} per traveller`,
        total: `${sym}${govLocal}`,
        aed: Math.round(govLocal * corridor.rateToAED),
      },
    },
    { gen: 900 },
  );
  const lines: Record<string, string> = {
    'uk-eta': `A visa is not needed, but every traveller needs an ETA before departure, children included. Government fees come to ${sym}${govLocal} for ${n}.`,
    'ca-eta': 'Canada needs an eTA for air travel, linked to the electronic passport. It is usually decided within minutes.',
    'us-b1b2': 'This is a full visa with an interview. I can prepare everything up to the signature, which only the applicant can give.',
    etias: 'Schengen is visa-free for Emiratis today. ETIAS is a new pre-travel authorisation and the portal is not open yet, so I will prepare the profile and watch for the launch.',
  };
  await ctx.say(lines[corridor.id]);
};

const advisory: StepFn = async (ctx) => {
  const adv = ctx.corridor.advisory;
  if (!adv) return;
  await ctx.say('One more check before I ask for documents: live advisories that affect this route.');
  await ctx.tool('check_advisories', { source: adv.source, route: 'ARE to USA' }, () => adv, {
    ms: 1200,
    summary: () => '1 active advisory',
  });
  await ctx.render('AdvisoryBanner', { ...adv }, { gen: 600 });
  ctx.audit('agent', 'Advisory noted', adv.title);
  await ctx.say('I will not book or monitor appointment slots with scripts. I will finish the file now so the client can act the day services resume.');
};

const documents: StepFn = async (ctx) => {
  const { corridor, applicants, meta } = ctx;
  const docs = buildDocs(applicants, meta.trip, corridor.perApplicantDocs, corridor.tripDocs);
  const status = Object.fromEntries(docs.map((d) => [d.id, 'queued' as const]));
  ctx.setData((d) => ({ ...d, docs, docStatus: status }));
  const summary = docs.map((d) => ({
    id: d.id,
    kind: d.kind,
    label: d.label,
    holder: d.holderId ? first(applicants.find((a) => a.id === d.holderId) as Applicant) : 'Trip',
    filename: d.filename,
    fields: d.fields.length,
  }));
  const clientFirst = meta.client.name.split(' ')[0];
  await ctx.say(
    `I need ${docs.length} documents for this file. ${clientFirst} already sent a folder on ${meta.channel}. Drop files below, or use the sample pack to see the agent read them.`,
  );
  const lvl = ctx.level();
  const out = await ctx.ask<{ source: string; files?: string[] }>({
    id: 'docs',
    step: 'documents',
    title: 'Provide the documents',
    kind: 'input',
    component: 'DocumentTray',
    props: { docs: summary, status, mode: 'request', client: meta.client.name },
    auto: lvl >= 2 ? { delay: 1400, outcome: { source: 'sample' }, reason: 'Folder received from the client' } : null,
  });
  const tray = findItem(ctx, 'docs');
  const trayId = tray?.id as string;
  ctx.patch(trayId, { mode: 'processing' });
  await ctx.tool(
    'classify_and_extract',
    { files: docs.length, ocr: 'passport-mrz, id-card, statement' },
    async () => {
      const st: Record<string, 'queued' | 'reading' | 'done'> = { ...status };
      for (const d of docs) {
        st[d.id] = 'reading';
        ctx.patch(trayId, { status: { ...st } });
        await ctx.wait(380);
        st[d.id] = 'done';
        ctx.patch(trayId, { status: { ...st } });
      }
      ctx.setData((x) => ({ ...x, docStatus: st }));
      return st;
    },
    { ms: 200, summary: () => `${docs.length} read · ${docs.reduce((s, d) => s + d.fields.length, 0)} fields` },
  );
  ctx.patch(trayId, { mode: 'done' });
  const lead = docs.find((d) => d.kind === 'passport') ?? docs[0];
  const leadHolder = applicants.find((a) => a.id === lead.holderId);
  await ctx.render('ExtractionPanel', { doc: lead, holder: leadHolder ? fullName(leadHolder) : 'Trip document', note: 'Every value keeps a link back to where it was read.' }, { gen: 600 });

  const low = docs.flatMap((d) => d.fields.filter((f) => f.confidence < 0.8).map((f) => ({ d, f })));
  if (low.length) {
    const { d, f } = low[0];
    const holder = applicants.find((a) => a.id === d.holderId);
    await ctx.say(
      `${low.length === 1 ? 'One field was' : `${low.length} fields were`} hard to read. ${holder ? first(holder) : 'The'}'s ${f.label.toLowerCase()} sat under a stamp at ${Math.round(f.confidence * 100)}%. I re-read the page at higher resolution and settled it at 99%.`,
    );
    ctx.audit('agent', 'Re-read low-confidence field', `${f.label} · ${f.confidence} to 0.99`);
  } else {
    await ctx.say(`Read all ${docs.length} documents. Every field came in above 90% confidence.`);
  }
  void out;
  if (lvl === 1) {
    await ctx.ask<{ decision: string }>({
      id: 'cp-docs',
      step: 'documents',
      title: 'Confirm the extraction',
      kind: 'approval',
      component: 'Checkpoint',
      props: { title: 'Extraction ready', detail: 'Guided mode pauses here. Review what the agent read, then continue.', cta: 'Continue to checks' },
      auto: null,
    });
  }
};

const checks: StepFn = async (ctx) => {
  const { corridor, applicants, meta } = ctx;
  await ctx.say('Cross-checking names, dates, passport validity and funds across every document.');
  const result = await ctx.tool(
    'cross_check',
    { documents: ctx.data().docs.length, rules: ['R-NAME', 'R-PASS', 'R-DATE', 'R-FUNDS'] },
    () => crossCheck({ applicants, docs: ctx.data().docs, trip: meta.trip, corridor }),
    { ms: 1500, summary: (r) => `${r.conflicts.length} flag${r.conflicts.length === 1 ? '' : 's'} · ${r.passes.length} checks passed` },
  );
  ctx.setData((d) => ({ ...d, conflicts: result.conflicts }));
  await ctx.render(
    'ChecksReport',
    { passes: result.passes, flagged: result.conflicts.length, fixed: result.fixes, minors: result.minors },
    { gen: 700 },
  );
  if (result.minors > 0) {
    await ctx.say(`${result.minors} traveller${result.minors === 1 ? ' is a child' : 's are children'}. A parent completes the declarations on their behalf, so I will route those to ${meta.client.name.split(' ')[0]}.`);
  }
  if (result.conflicts.length === 0) {
    await ctx.say('Nothing needs a decision. Moving on.');
    return;
  }
  await ctx.say(
    `${result.conflicts.length} item${result.conflicts.length === 1 ? ' needs' : 's need'} a decision. I settle low-risk ones myself when the autonomy level allows it, and I always say which rule I used.`,
  );
  const order = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...result.conflicts].sort((a, b) => order[a.risk] - order[b.risk]);
  for (const c of sorted) {
    const rec = c.options.find((o) => o.recommended) ?? c.options[0];
    const auto = allowAuto(ctx.level(), c.risk) ? { delay: 1700, outcome: { option: rec.id }, reason: `${c.rule}: ${rec.label}` } : null;
    const out = await ctx.ask<{ option: string }>({
      id: `conflict-${c.id}`,
      step: 'checks',
      title: c.title,
      kind: 'input',
      component: 'ConflictResolver',
      props: { conflict: c },
      auto,
    });
    const by = resolvedBy(ctx, `conflict-${c.id}`);
    await applyResolution(ctx, c, out.option, by === 'agent' ? 'agent' : 'human');
  }
};

async function applyResolution(ctx: FlowCtx, c: Conflict, option: string, by: 'agent' | 'human') {
  ctx.setData((d) => ({ ...d, resolutions: { ...d.resolutions, [c.id]: { option, by, rule: c.rule } } }));
  const chosen = c.options.find((o) => o.id === option);
  const holder = ctx.applicants.find((a) => c.id.endsWith(a.id));
  if (option === 'renew' && holder) {
    ctx.setData((d) => ({ ...d, held: Array.from(new Set([...d.held, holder.id])) }));
    ctx.audit(by === 'agent' ? 'agent' : 'human', `Held ${first(holder)}'s application`, 'Waiting for a renewed passport');
    await ctx.say(`Understood. I am holding ${first(holder)}'s application and will set a reminder. The rest of the file keeps moving.`);
    return;
  }
  if (option === 'ask') {
    await ctx.tool('send_message', { channel: ctx.meta.channel, to: ctx.meta.client.phone, topic: c.rule }, () => true, {
      ms: 700,
      summary: () => 'Delivered',
    });
    await ctx.say('I asked the client. For this demo I will carry on with the recommended option and swap it if they answer differently.');
    return;
  }
  await ctx.say(
    by === 'agent'
      ? `Settled ${c.rule}: ${chosen?.label.toLowerCase()}. It is in the audit trail if you want to undo it.`
      : `Noted. ${chosen?.label}.`,
  );
}

const draft: StepFn = async (ctx) => {
  const { corridor, meta } = ctx;
  const people = active(ctx);
  if (people.length === 0) return 'skipped';
  await ctx.say('Filling the application from the verified facts. Every value keeps its source.');
  const form = await ctx.tool(
    'fill_form',
    { portal: corridor.portal, travellers: people.length },
    () => buildForm(corridor, people, ctx.data().docs, meta.trip, ctx.data().resolutions),
    {
      ms: 1700,
      summary: (f) => {
        const p = formProgress(f);
        return `${p.agent} fields filled · ${p.applicant} left for the applicant`;
      },
    },
  );
  ctx.setData((d) => ({ ...d, form }));
  await ctx.render('FormDraft', { form, progress: formProgress(form) }, { gen: 800 });
  await ctx.say('Everything except the applicant-only sections is filled. You can edit any value, and I will log the change.');
  if (ctx.level() === 1) {
    await ctx.ask<{ decision: string }>({
      id: 'cp-draft',
      step: 'draft',
      title: 'Lock the draft',
      kind: 'approval',
      component: 'Checkpoint',
      props: { title: 'Draft ready', detail: 'Guided mode pauses here so you can look over the form.', cta: 'Lock the draft' },
      auto: null,
    });
  }
};

const quote: StepFn = async (ctx) => {
  const { corridor } = ctx;
  const people = active(ctx);
  if (people.length === 0) return 'skipped';
  await ctx.say('Pricing the file in dirhams. Government fees pass through at cost.');
  const q = await ctx.tool('quote_fees', { corridor: corridor.short, travellers: people.length }, () => buildQuote(corridor, people.length, ctx.data().serviceFeeAED), {
    ms: 900,
    summary: (r) => `Total ${aed(r.totalAED)}`,
  });
  ctx.setData((d) => ({ ...d, fees: q }));
  await ctx.render('FeeQuote', { corridorId: corridor.id, travellers: people.length, serviceFeeAED: ctx.data().serviceFeeAED, quote: q }, { gen: 600 });
};

const approval: StepFn = async (ctx) => {
  const { corridor } = ctx;
  const people = active(ctx);
  if (people.length === 0) {
    await ctx.say('Every traveller is on hold, so there is nothing to approve yet.');
    return 'skipped';
  }
  const d = ctx.data();
  const byAgent = Object.values(d.resolutions).filter((r) => r.by === 'agent').length;
  const byYou = Object.values(d.resolutions).filter((r) => r.by === 'human').length;
  const heldCount = d.held.length;
  const nextBy: Record<string, string[]> = {
    'uk-eta': ['Send the client a secure link for the selfie and declarations', 'Submit each ETA to the sandbox portal', 'Track the decision and message the client'],
    'ca-eta': ['Send the client a secure link for the questions and card payment', 'Submit the eTA to the sandbox portal', 'Track the decision and message the client'],
    'us-b1b2': ['Hand the finished DS-160 to the applicant to sign', 'Stage the interview file', 'Watch the official advisory and tell you when services resume'],
    etias: ['Hold the finished profile', 'Watch the official ETIAS announcements', 'Alert you and the client when the portal opens'],
  };
  const props = {
    title: corridor.mode === 'watch' ? 'Approve the profile' : 'Approve and send to the client',
    summary: [
      { label: 'Travellers', value: `${people.length}${heldCount ? ` (+${heldCount} on hold)` : ''}` },
      { label: 'Route', value: `${ctx.meta.trip.city} · ${corridor.short}` },
      { label: 'Government fees', value: aed(d.fees?.govAED ?? 0) },
      { label: 'Agency fee incl. VAT', value: aed((d.fees?.serviceAED ?? 0) + (d.fees?.vatAED ?? 0)) },
      { label: 'Total to the client', value: aed(d.fees?.totalAED ?? 0) },
    ],
    checks: [
      { label: 'All documents read and cross-checked', status: 'pass' },
      { label: `${byAgent + byYou} flag${byAgent + byYou === 1 ? '' : 's'} settled (${byAgent} by policy, ${byYou} by you)`, status: 'pass' },
      { label: heldCount ? `${heldCount} traveller on hold for a passport renewal` : 'No traveller on hold', status: heldCount ? 'warn' : 'pass' },
      { label: 'Applicant-only sections left untouched', status: 'pass' },
    ],
    next: nextBy[corridor.id],
    boundaries: [
      'Will not answer declarations or sign for the applicant',
      'Will not submit anything live. This demo uses a sandbox',
      'Will not work around portal limits or bot protection',
    ],
  };
  const lvl = ctx.level();
  for (;;) {
    const gateId = `approve-${uid('g')}`;
    const out = await ctx.ask<{ decision: 'approve' | 'changes'; note?: string }>({
      id: gateId,
      step: 'approval',
      title: props.title,
      kind: 'approval',
      component: 'ApprovalGate',
      props,
      auto: lvl === 3 ? { delay: 2000, outcome: { decision: 'approve' }, reason: 'Autopilot: no unresolved flags' } : null,
    });
    if (out.decision === 'approve') {
      ctx.setData((x) => ({ ...x, approved: true }));
      await ctx.say(resolvedBy(ctx, gateId) === 'agent' ? 'Approved by policy. Continuing.' : 'Approved. Continuing.');
      break;
    }
    ctx.audit('human', 'Requested changes', out.note);
    await ctx.say(out.note ? `Noted: "${out.note}". Edit the draft above or tell me what to change, then approve again.` : 'Noted. Edit the draft above, then approve again.');
  }
};

const applicantStep: StepFn = async (ctx) => {
  const { corridor, meta } = ctx;
  const people = active(ctx);
  if (people.length === 0) return 'skipped';
  const msg = applicantMessage(meta, corridor, people.length);
  await ctx.say(`${corridor.applicantOnly.title} has to come from the client. Sending a secure link now, in English and Arabic.`);
  await ctx.tool('send_message', { channel: 'WhatsApp', to: meta.client.phone, lang: 'en+ar' }, () => true, { ms: 900, summary: () => 'Delivered' });
  await ctx.ask<{ done: boolean }>({
    id: 'applicant',
    step: 'applicant',
    title: corridor.applicantOnly.title,
    kind: 'applicant',
    component: 'ApplicantHandoff',
    props: { client: meta.client.name, phone: meta.client.phone, en: msg.en, ar: msg.ar, title: corridor.applicantOnly.title, detail: corridor.applicantOnly.detail, steps: corridor.applicantOnly.steps },
    auto: ctx.level() === 3 ? { delay: 4200, outcome: { done: true }, reason: 'Autopilot simulates the client in this demo' } : null,
  });
  ctx.setData((d) => ({ ...d, applicantDone: true }));
  await ctx.say(`${meta.client.name.split(' ')[0]} has confirmed. The applicant-only sections are now complete.`);
};

const submit: StepFn = async (ctx) => {
  const { corridor } = ctx;
  const people = active(ctx);
  if (people.length === 0) return 'skipped';
  const prefix = { 'uk-eta': 'ETA', 'ca-eta': 'ETA', 'us-b1b2': 'AA00', etias: 'ETIAS' }[corridor.id];
  const refs = people.map((a, i) => ({
    id: a.id,
    name: fullName(a),
    ref: `${prefix}-DEMO-${String(4821 + i * 37).padStart(4, '0')}`,
    at: new Date(Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }));
  if (corridor.mode === 'visa') {
    await ctx.say('The DS-160 is signed. Staging the interview file and the supporting evidence.');
    await ctx.tool('stage_file', { form: 'DS-160', travellers: people.length }, () => refs, { ms: 1500, summary: () => `${people.length} file staged` });
    await ctx.render(
      'SubmissionReceipt',
      { mode: 'staged', portal: corridor.portal, rows: refs.map((r) => ({ name: r.name, ref: r.ref, at: r.at, status: 'Staged' })), note: 'The signed DS-160 confirmation page came from the applicant. Nothing is submitted by Rihla.' },
      { gen: 600 },
    );
  } else {
    await ctx.say('Submitting to the portal. This demo uses a sandbox, so no real government submission is made.');
    await ctx.tool('submit_application', { portal: corridor.portal, travellers: people.length, mode: 'sandbox' }, () => refs, {
      ms: 1800,
      summary: (r) => `${r.length} reference${r.length === 1 ? '' : 's'} issued`,
    });
    await ctx.render(
      'SubmissionReceipt',
      { mode: 'sandbox', portal: corridor.portal, rows: refs.map((r) => ({ name: r.name, ref: r.ref, at: r.at, status: 'Submitted' })), note: 'Sandbox reference numbers. Live submission is enabled per route after the portal terms are checked.' },
      { gen: 600 },
    );
  }
  ctx.setData((d) => ({ ...d, references: refs }));
};

const track: StepFn = async (ctx) => {
  const { corridor, meta } = ctx;
  const people = active(ctx);
  if (people.length === 0) return 'skipped';
  const clientFirst = meta.client.name.split(' ')[0];

  if (corridor.mode === 'visa') {
    await ctx.say('Now the waiting part. I will read the official advisory page on a schedule and tell you and the client when services resume.');
    const steps = corridor.tracking.map((t, i) => ({ ...t, status: i < 2 ? 'done' : i === 2 ? 'active' : 'pending', at: i < 2 ? 'Today' : undefined }));
    await ctx.render('StatusTimeline', { steps, notes: [], clockNote: 'Official source only. No slot scraping, no booking scripts.' }, { gen: 600 });
    await ctx.tool('watch_source', { domain: 'ae.usembassy.gov', every: '6h', purpose: 'services resumed' }, () => true, { ms: 800, summary: () => 'Watching' });
    const msg = decisionMessage(meta, corridor, people.length);
    await ctx.render('MessageDraft', { channel: 'WhatsApp', to: meta.client.name, en: msg.en, ar: msg.ar, sent: false }, { gen: 400 });
    return;
  }

  await ctx.say('Tracking the decision. I check on a schedule and message the client the moment it changes.');
  const base = corridor.tracking.map((t) => ({ ...t, status: 'pending' as 'done' | 'active' | 'pending', at: undefined as string | undefined }));
  const days = corridor.id === 'ca-eta' ? ['Day 0 · 10:47', 'Day 0 · 10:48', 'Day 0 · 10:55', 'Day 0 · 10:56'] : ['Day 0 · 10:42', 'Day 0 · 10:43', 'Day 2 · 14:05', 'Day 2 · 14:06'];
  base[0] = { ...base[0], status: 'done', at: days[0] };
  base[1] = { ...base[1], status: 'active' };
  const id = await ctx.render('StatusTimeline', { steps: base, notes: [], clockNote: 'Simulated clock. Hours and days are compressed into seconds for the demo.' }, { gen: 500 });
  await ctx.wait(1700);
  base[1] = { ...base[1], status: 'done', at: days[1] };
  base[2] = { ...base[2], status: 'active' };
  ctx.patch(id, { steps: [...base] });
  await ctx.wait(1700);
  const notes = people.map((a) => {
    const v = validUntil(ctx, a);
    return { name: first(a), outcome: v ? `Approved · valid until ${fmtDate(v.date)}${v.limited ? ' (passport expiry)' : ''}` : 'Approved' };
  });
  base[2] = { ...base[2], status: 'done', at: days[2] };
  base[3] = { ...base[3], status: 'active' };
  ctx.patch(id, { steps: [...base], notes });
  ctx.audit('agent', 'Decision received', `${people.length} approved (sandbox)`);
  const limited = people.filter((a) => validUntil(ctx, a)?.limited);
  await ctx.say(
    limited.length
      ? `Approved for ${people.length === 1 ? 'the traveller' : `all ${people.length}`}. ${limited.map((a) => first(a)).join(' and ')}'s authorisation is limited by the passport expiry. I set a renewal reminder.`
      : `Approved for ${people.length === 1 ? 'the traveller' : `all ${people.length}`}.`,
  );
  const limitNote = limited.length
    ? `Note: ${limited.map((a) => first(a)).join(' and ')}'s authorisation lasts until the passport expires.`
    : undefined;
  const msg = decisionMessage(meta, corridor, people.length, limitNote);
  await ctx.render('MessageDraft', { channel: 'WhatsApp', to: meta.client.name, en: msg.en, ar: msg.ar, sent: false }, { gen: 500 });
  await ctx.tool('send_message', { channel: 'WhatsApp', to: meta.client.phone, lang: 'en+ar' }, () => true, { ms: 800, summary: () => `Delivered to ${clientFirst}` });
  base[3] = { ...base[3], status: 'done', at: days[3] };
  ctx.patch(id, { steps: [...base] });
};

const watch: StepFn = async (ctx) => {
  const { corridor, meta } = ctx;
  const people = active(ctx);
  await ctx.say('The ETIAS portal is not open yet. I will hold the finished profile and watch the official announcement.');
  await ctx.tool('watch_source', { domain: corridor.sources[0].domain, every: '6h', purpose: 'portal opens' }, () => true, { ms: 900, summary: () => 'Watching' });
  await ctx.render(
    'LaunchWatch',
    {
      expected: 'Q4 2026, as reported',
      ready: people.length,
      sources: [
        { domain: 'travel-europe.europa.eu/etias', status: 'Not open', checked: 'just now' },
        { domain: 'home-affairs.ec.europa.eu', status: 'No launch date confirmed', checked: 'just now' },
      ],
      plan: ['Alert you the moment the status changes', 'Send the client a secure link to answer the security questions', 'Submit within minutes of the client confirming'],
    },
    { gen: 700 },
  );
  const msg = decisionMessage(meta, corridor, people.length);
  await ctx.render('MessageDraft', { channel: 'WhatsApp', to: meta.client.name, en: msg.en, ar: msg.ar, sent: false }, { gen: 400 });
};

const wrap: StepFn = async (ctx) => {
  const { corridor } = ctx;
  const d = ctx.data();
  const docs = d.docs.length;
  const fields = d.form ? formProgress(d.form).agent : 0;
  const flags = d.conflicts.length;
  const byAgent = Object.values(d.resolutions).filter((r) => r.by === 'agent').length;
  const byYou = Object.values(d.resolutions).filter((r) => r.by === 'human').length;
  const manual = Math.round(docs * 3 + fields * 0.5 + 12 + flags * 6 + 10 + 15);
  const yours = Math.max(2, (d.stats.humanTasks + 1) * 2);
  const saved = Math.max(0, manual - yours);
  const fmt = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

  const highlights: string[] = [];
  for (const c of d.conflicts) {
    const r = d.resolutions[c.id];
    if (!r) continue;
    const label = c.options.find((o) => o.id === r.option)?.label ?? r.option;
    highlights.push(`${c.title}. ${label}, ${r.by === 'agent' ? `settled by policy (${r.rule})` : 'decided by you'}.`);
  }
  if (!highlights.length) highlights.push('No flags. Every check passed on the first read.');

  const total = ctx.applicants.length;
  const heldPeople = ctx.applicants.filter((a) => d.held.includes(a.id));
  const activeN = total - heldPeople.length;
  const nextBy: Record<string, string[]> = {
    'uk-eta': ['Renewal reminders are scheduled for passports that limit validity', 'The client has the Arabic and English confirmation', 'The case file and audit trail are stored for your records'],
    'ca-eta': ['The eTA is linked to the passport, nothing to print', 'The client has the Arabic and English confirmation', 'The case file and audit trail are stored for your records'],
    'us-b1b2': ['Watching the official advisory every 6 hours', 'The client has the interview checklist in Arabic and English', 'The file is ready to book the day services resume'],
    etias: ['Watching the official ETIAS announcements', 'The profile is pre-filled and checked', 'The client confirms in about 5 minutes once the portal opens'],
  };
  const heldNext = heldPeople.length ? [`${heldPeople.map((a) => first(a)).join(' and ')} resume${heldPeople.length === 1 ? 's' : ''} when a renewed passport arrives`] : [];
  const title =
    heldPeople.length > 0 && activeN === 0
      ? 'On hold until a passport is renewed'
      : heldPeople.length > 0
        ? `Done for ${activeN} of ${total} travellers`
        : corridor.mode === 'e-authorisation'
          ? 'Case complete'
          : corridor.mode === 'visa'
            ? 'File ready, waiting on appointments'
            : 'Profile ready, watching for launch';
  await ctx.tool('write_case_summary', { case: ctx.meta.id }, () => true, { ms: 700, summary: () => 'Saved to the case file' });
  await ctx.render(
    'CaseSummary',
    {
      title,
      metrics: [
        { label: 'Documents read', value: String(docs) },
        { label: 'Fields filled', value: String(fields) },
        { label: 'Flags found', value: `${flags}` },
        { label: 'Settled by policy', value: String(byAgent) },
        { label: 'Decided by you', value: String(byYou) },
        { label: 'Desk time saved', value: `≈ ${fmt(saved)}` },
      ],
      highlights,
      next: activeN === 0 ? [...heldNext, 'The case file and audit trail are stored for your records'] : [...heldNext, ...nextBy[corridor.id]],
      basis: `Estimate: ${docs} docs × 3 min, ${fields} fields × 30 s, plus research, checks, quoting and messaging, minus your review time.`,
    },
    { gen: 700 },
  );
  await ctx.say(
    activeN === 0
      ? 'Everything is on hold. I will pick the case up when a renewed passport arrives.'
      : heldPeople.length > 0
        ? `Done for ${activeN}. The held traveller${heldPeople.length === 1 ? '' : 's'} resume${heldPeople.length === 1 ? 's' : ''} when the new passport arrives.`
        : corridor.mode === 'e-authorisation'
          ? 'Done. The client is notified and the file is closed.'
          : corridor.mode === 'visa'
            ? 'The file is ready. I will wake up when the advisory changes.'
            : 'The profile is ready. I will wake up when the portal opens.',
  );
  const status: CaseStatus = heldPeople.length > 0 ? 'waiting' : corridor.mode === 'e-authorisation' ? 'done' : corridor.mode === 'visa' ? 'waiting' : 'watching';
  ctx.setStatus(status);
};

const STEP_FNS: Record<StepId, StepFn> = {
  intake,
  requirements,
  advisory,
  documents,
  checks,
  draft,
  quote,
  approval,
  applicant: applicantStep,
  submit,
  track,
  watch,
  wrap,
};

export async function runFlow(ctx: FlowCtx) {
  for (const id of ctx.corridor.steps) {
    ctx.step(id, 'running');
    const out = await STEP_FNS[id](ctx);
    ctx.step(id, out === 'skipped' ? 'skipped' : 'done');
    await ctx.checkpoint();
  }
}
