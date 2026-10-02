import type { FlowCtx } from './engine';
import { useStore } from './store';
import { CORRIDOR_LIST } from './fixtures/corridors';
import { buildQuote } from './fees';
import { missingDocsMessage, decisionMessage } from './messages';
import { askLive } from './live';
import { aed, fmtDate } from '@/lib/utils';

/*
  Free-form questions. The local router answers common desk questions deterministically.
  When the live model is switched on, anything the router does not recognise goes to Claude,
  which answers with a message and (optionally) one component from the registry.
*/

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

export const SUGGESTIONS = [
  'What is still missing?',
  'Explain the flags',
  'Total in dirhams?',
  'Draft a client update',
  'Compare the four routes',
];

export async function answer(ctx: FlowCtx, text: string): Promise<void> {
  const t = text.toLowerCase();
  const rt = useStore.getState().cases[ctx.caseId];
  const { settings } = useStore.getState();
  const d = rt.data;
  const people = ctx.applicants.filter((a) => !d.held.includes(a.id));

  if (has(t, 'missing', 'document', 'need from', 'checklist', 'what do we need')) {
    const doneDocs = d.docs.length > 0 && Object.values(d.docStatus).every((s) => s === 'done');
    const items = [
      ...ctx.corridor.requirements.map((r) => ({
        label: r.label,
        status: (r.who === 'client' && !d.applicantDone ? 'todo' : r.id === 'passport' || r.id === 'photo' || r.id === 'work' ? (doneDocs ? 'done' : 'todo') : r.who === 'agent' && d.form ? 'done' : 'todo') as 'done' | 'todo' | 'blocked',
        note: r.who === 'client' ? 'From the client' : r.who === 'agent' ? 'The agent handles this' : undefined,
      })),
    ];
    await ctx.say(doneDocs ? 'Documents are in. What is left sits with the client or comes later in the flow.' : 'Nothing has been read yet. Here is what this route needs.');
    await ctx.render('Checklist', { title: `${ctx.corridor.short} requirements`, items }, { gen: 400 });
    return;
  }

  if (has(t, 'flag', 'conflict', 'issue', 'problem', 'why', 'explain', 'wrong')) {
    if (!d.conflicts.length) {
      await ctx.say(d.docs.length ? 'No flags on this file. Every check passed.' : 'I have not cross-checked anything yet. Start the agent and I will explain each flag as it appears.');
      return;
    }
    await ctx.say(`${d.conflicts.length} flag${d.conflicts.length === 1 ? '' : 's'} on this file. Here is each one with the rule behind it.`);
    await ctx.render(
      'InfoCard',
      {
        title: 'Flags on this file',
        tone: 'warn',
        bullets: d.conflicts.map((c) => {
          const r = d.resolutions[c.id];
          const label = r ? c.options.find((o) => o.id === r.option)?.label : null;
          return `${c.title} (${c.rule}, ${c.risk} risk). ${r ? `${label}, ${r.by === 'agent' ? 'settled by policy' : 'decided by you'}.` : 'Still open.'}`;
        }),
        footnote: 'Rules are versioned. The audit trail records who settled each flag.',
      },
      { gen: 400 },
    );
    return;
  }

  if (has(t, 'fee', 'cost', 'price', 'total', 'quote', 'aed', 'dirham', 'how much', 'pay')) {
    const q = d.fees ?? buildQuote(ctx.corridor, Math.max(1, people.length), d.serviceFeeAED);
    await ctx.say(`${d.fees ? 'Here is the quote' : 'The file has not been priced yet, so this is an estimate'} for ${people.length} traveller${people.length === 1 ? '' : 's'}: ${aed(q.totalAED)} in total.`);
    await ctx.render('FeeQuote', { corridorId: ctx.corridor.id, travellers: Math.max(1, people.length), serviceFeeAED: d.serviceFeeAED, quote: q }, { gen: 400 });
    return;
  }

  if (has(t, 'message', 'whatsapp', 'tell the client', 'client update', 'update the client', 'arabic', 'draft')) {
    const done = rt.plan.find((p) => p.id === 'track')?.status === 'done';
    const msg = done || ctx.corridor.mode !== 'e-authorisation' ? decisionMessage(ctx.meta, ctx.corridor, Math.max(1, people.length)) : missingDocsMessage(ctx.meta, ['a clear photo of each passport', 'the Emirates ID, front and back']);
    await ctx.say('Here is a draft in English and Arabic. Copy it or send it in the demo.');
    await ctx.render('MessageDraft', { channel: ctx.meta.channel, to: ctx.meta.client.name, en: msg.en, ar: msg.ar }, { gen: 400 });
    return;
  }

  if (has(t, 'compare', 'difference', ' vs ', 'which route', 'four routes', 'all routes')) {
    await ctx.say('Here are the four routes side by side. Fees and timings come from the demo rule packs.');
    await ctx.render(
      'ComparisonTable',
      {
        title: 'UAE passport, four routes',
        columns: CORRIDOR_LIST.map((c) => c.short),
        rows: [
          { label: 'Type', cells: CORRIDOR_LIST.map((c) => (c.mode === 'visa' ? 'Visa' : c.mode === 'watch' ? 'Coming authorisation' : 'Online authorisation')) },
          { label: 'Government fee', cells: CORRIDOR_LIST.map((c) => `${c.gov.currency} ${c.gov.perPerson}${c.gov.extras ? ` + ${c.gov.extras[0].amount}` : ''}`) },
          { label: 'Decision', cells: CORRIDOR_LIST.map((c) => c.decision) },
          { label: 'Automation', cells: CORRIDOR_LIST.map((c) => (c.automation === 'full' ? 'End to end' : c.automation === 'assisted' ? 'Up to the signature' : 'Prepare and watch')) },
        ],
        footnote: 'Demo rule packs reviewed 2 Oct 2026. Verify before filing.',
      },
      { gen: 500 },
    );
    return;
  }

  if (has(t, 'status', 'where are we', 'progress', 'what next', "what's next", 'update me')) {
    const doneSteps = rt.plan.filter((p) => p.status === 'done').length;
    const cur = rt.plan.find((p) => p.status === 'running' || p.status === 'needs_you' || p.status === 'waiting');
    await ctx.say(
      rt.run.state === 'idle'
        ? `Not started. ${rt.plan.length} steps are planned for ${ctx.meta.id}. Press Run the agent.`
        : cur
          ? `${doneSteps} of ${rt.plan.length} steps done. Now on "${cur.title.toLowerCase()}"${cur.status === 'needs_you' ? ', and I need you' : cur.status === 'waiting' ? ', waiting on the client' : ''}.`
          : `${doneSteps} of ${rt.plan.length} steps done.`,
    );
    return;
  }

  if (has(t, 'passport') && has(t, 'expir', 'renew', 'valid')) {
    await ctx.say('Here are the passport dates for this file.');
    await ctx.render(
      'InfoCard',
      { title: 'Passport validity', bullets: ctx.applicants.map((a) => `${a.given.split(' ')[0]}: expires ${fmtDate(a.passportExpires)}`), footnote: `Trip ends ${fmtDate(ctx.meta.trip.to)}.` },
      { gen: 300 },
    );
    return;
  }

  if (settings.live && useStore.getState().liveAvailable !== false) {
    const ok = await askLive(ctx, text);
    if (ok) return;
  }

  await ctx.say(
    settings.live
      ? 'I could not reach the live model, and the local desk does not cover that one. Try one of the suggestions below.'
      : 'I can answer desk questions about this case: what is missing, why something was flagged, fees in dirhams, a client message, or a comparison of the routes. Turn on the live model for anything else.',
  );
}
