import type { FlowCtx } from './engine';
import { useStore } from './store';
import { CORRIDOR_LIST } from './fixtures/corridors';

/*
  Optional live path. When the page runs inside a Claude viewer, the `sample` capability lets the page ask
  the viewer's own Claude for a structured answer: a short message plus at most one component from a safe subset.
  The result is validated before anything renders. If the capability is absent or declined, the caller falls back.
*/

type SampleFn = {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string }>;
  json: <T = unknown>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

let cached: SampleFn | null | undefined;

export async function liveSample(): Promise<SampleFn | null> {
  if (cached !== undefined) return cached;
  try {
    const use = typeof window !== 'undefined' ? window.claude?.use : undefined;
    cached = use ? ((await use('sample')) as SampleFn | null) : null;
  } catch {
    cached = null;
  }
  return cached ?? null;
}

const str = (v: unknown, max = 220) => (typeof v === 'string' ? v.slice(0, max) : '');
const arr = <T,>(v: unknown, max: number, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? (v.slice(0, max).map(f).filter((x): x is T => x !== null) as T[]) : [];

interface LiveAnswer {
  say?: unknown;
  ui?: { component?: unknown; props?: Record<string, unknown> } | null;
}

/** Whitelist and shape-check the component the model asked for. Returns null when it cannot be trusted. */
function sanitise(ui: LiveAnswer['ui']): { component: string; props: Record<string, unknown> } | null {
  if (!ui || typeof ui.component !== 'string' || !ui.props) return null;
  const p = ui.props;
  switch (ui.component) {
    case 'InfoCard':
      return {
        component: 'InfoCard',
        props: {
          title: str(p.title, 80) || 'Answer',
          tone: p.tone === 'ok' || p.tone === 'warn' ? p.tone : 'neutral',
          bullets: arr(p.bullets, 8, (x) => (typeof x === 'string' ? x.slice(0, 260) : null)),
          footnote: str(p.footnote, 200) || undefined,
        },
      };
    case 'Checklist':
      return {
        component: 'Checklist',
        props: {
          title: str(p.title, 80) || 'Checklist',
          items: arr(p.items, 12, (x) => {
            const o = x as Record<string, unknown>;
            if (!o || typeof o.label !== 'string') return null;
            const status = o.status === 'done' || o.status === 'blocked' ? o.status : 'todo';
            return { label: o.label.slice(0, 140), status, note: str(o.note, 160) || undefined };
          }),
        },
      };
    case 'ComparisonTable': {
      const columns = arr(p.columns, 5, (x) => (typeof x === 'string' ? x.slice(0, 40) : null));
      return {
        component: 'ComparisonTable',
        props: {
          title: str(p.title, 80) || 'Comparison',
          columns,
          rows: arr(p.rows, 8, (x) => {
            const o = x as Record<string, unknown>;
            if (!o || typeof o.label !== 'string') return null;
            return { label: o.label.slice(0, 40), cells: arr(o.cells, columns.length, (c) => (typeof c === 'string' ? c.slice(0, 120) : null)) };
          }),
          footnote: str(p.footnote, 200) || undefined,
        },
      };
    }
    case 'MessageDraft':
      return {
        component: 'MessageDraft',
        props: { channel: str(p.channel, 20) || 'WhatsApp', to: str(p.to, 60) || 'Client', en: str(p.en, 600) || undefined, ar: str(p.ar, 600) || undefined },
      };
    default:
      return null;
  }
}

export async function askLive(ctx: FlowCtx, question: string): Promise<boolean> {
  const sample = await liveSample();
  if (!sample) {
    useStore.getState().setLiveAvailable(false);
    return false;
  }
  const rt = useStore.getState().cases[ctx.caseId];
  const d = rt.data;
  const snapshot = {
    case: ctx.meta.id,
    client: ctx.meta.client.name,
    route: ctx.corridor.short,
    trip: ctx.meta.trip,
    travellers: ctx.applicants.map((a) => ({ name: `${a.given} ${a.surname}`, passportExpires: a.passportExpires, dob: a.dob })),
    status: rt.status,
    stepsDone: rt.plan.filter((p) => p.status === 'done').map((p) => p.title),
    flags: d.conflicts.map((c) => ({ title: c.title, rule: c.rule, risk: c.risk, resolution: d.resolutions[c.id]?.option ?? 'open' })),
    quoteAED: d.fees?.totalAED ?? null,
  };
  const rules = CORRIDOR_LIST.map((c) => ({
    route: c.short,
    type: c.mode,
    govFee: `${c.gov.currency} ${c.gov.perPerson}${c.gov.extras ? ` + ${c.gov.extras[0].amount} ${c.gov.extras[0].label}` : ''}`,
    decision: c.decision,
    validity: c.validity,
    rulepack: `${c.rulepack}, reviewed ${c.reviewed}`,
  }));
  const prompt = `You are Rihla, an agent that works a visa desk for a UAE travel agency. A caseworker asks a question about the open case.
Rules: use only the CASE and RULES below. If the answer is not there, say you do not know and what you would check. Never invent a fee, date or regulation. Keep "say" to at most two plain sentences.
You may add one UI component. Allowed components and props:
- InfoCard {title, tone: "neutral"|"ok"|"warn", bullets: string[], footnote?: string}
- Checklist {title, items: {label, status: "done"|"todo"|"blocked", note?}[]}
- ComparisonTable {title, columns: string[], rows: {label, cells: string[]}[], footnote?}
- MessageDraft {channel, to, en?, ar?}  (Arabic must be correct, natural Modern Standard Arabic)
Reply with only JSON: {"say": string, "ui": null | {"component": string, "props": object}}

CASE: ${JSON.stringify(snapshot)}
RULES: ${JSON.stringify(rules)}
QUESTION: ${question.slice(0, 600)}`;

  const id = 'live-thinking';
  ctx.notice('Asking the live model…', 'info');
  try {
    const out = await sample.json<LiveAnswer>(prompt, { modelTier: 'quick', cache: false });
    const say = str(out?.say, 400);
    if (say) await ctx.say(say);
    const ui = sanitise(out?.ui);
    if (ui) await ctx.render(ui.component, ui.props, { gen: 500 });
    ctx.audit('agent', 'Answered with the live model', question.slice(0, 80));
    void id;
    return !!(say || ui);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') {
      useStore.getState().setLiveAvailable(false);
      useStore.getState().setSettings({ live: false });
      ctx.notice('The live model is not available here, so I switched it off.', 'warn');
    }
    return false;
  }
}
