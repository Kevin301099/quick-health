import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, Copy, Link2, Lock, PenLine, Plus, ScrollText, ShieldOff } from 'lucide-react';
import { allowAuto, LEVELS } from '@/agent/policy';
import { REGISTRY } from '../genui/registry';
import { NOOP_CTX } from '../genui/types';
import { Pill } from '../ui';
import { CONTACT, FAQ, ROUTES, TIERS, TRUST } from './content';
import { FRAMES, ORDER } from './stageData';
import { cn } from '@/lib/utils';

const EASE = [0.22, 0.9, 0.24, 1] as const;

/** Rises into place. Content stays readable if the observer never fires. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0.75, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Head({ eyebrow, title, sub, className }: { eyebrow: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-[760px]', className)}>
      <div className="eyebrow eyebrow-brass">{eyebrow}</div>
      <h2 className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] font-normal leading-[1.02] tracking-[-0.02em] text-fg balance">{title}</h2>
      {sub && <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-muted pretty">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ routes */

function RouteArc({ code }: { code: string }) {
  return (
    <svg width="92" height="26" viewBox="0 0 92 26" fill="none" aria-hidden>
      <path d="M4 22C26 -4 66 -4 88 20" stroke="var(--brass)" strokeWidth="1.2" strokeDasharray="2 4" />
      <circle cx="4" cy="22" r="3" fill="var(--brass-hi)" />
      <circle cx="88" cy="20" r="3.5" stroke="var(--brass)" strokeWidth="1.2" />
      <text x="46" y="25" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--fg-faint)">
        DXB · {code}
      </text>
    </svg>
  );
}

const SPAN = ['lg:col-span-7', 'lg:col-span-5', 'lg:col-span-5', 'lg:col-span-7'];

export function Routes() {
  return (
    <section id="routes" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pb-8 pt-12">
      <Reveal>
        <Head
          eyebrow="Emirati-first routes"
          title="Built around how Emiratis actually travel."
          sub="Most journeys on a UAE passport need an online authorisation, not a visa. Rihla runs those from start to finish, and prepares the real visas right up to the step only the applicant can take."
        />
      </Reveal>
      <div className="mt-12 grid gap-5 lg:grid-cols-12">
        {ROUTES.map((r, i) => (
          <Reveal key={r.id} className={cn('flex', SPAN[i])} delay={(i % 2) * 0.08}>
            <article className="surface flex w-full flex-col gap-5 p-6 sm:p-7">
              <header className="flex items-start justify-between gap-3">
                <RouteArc code={r.code} />
                <Pill tone={r.id === 'us-b1b2' ? 'warn' : r.id === 'etias' ? 'info' : 'ok'}>{r.kind}</Pill>
              </header>
              <div>
                <h3 className="font-display text-[clamp(2rem,3.2vw,2.6rem)] italic leading-none text-fg">{r.short}</h3>
                <p className="mt-2 max-w-[44ch] text-[15px] text-muted pretty">{r.line}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4">
                <div className="min-w-0">
                  <dt className="eyebrow">Government fee</dt>
                  <dd className="mt-1 text-[14px] text-fg">{r.fee}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="eyebrow">Decision</dt>
                  <dd className="mt-1 text-[14px] text-fg">{r.decision}</dd>
                </div>
              </dl>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="eyebrow">Automation</span>
                  <span className="text-[13px] font-medium text-brasshi">{r.level}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface3" role="img" aria-label={`${r.level}`}>
                  <div className="h-full w-full origin-left rounded-full bg-brass" style={{ transform: `scaleX(${r.pct})` }} />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-[1.25fr_1fr]">
                <div>
                  <div className="eyebrow mb-2">Rihla does</div>
                  <ul className="space-y-1.5">
                    {r.agent.map((a) => (
                      <li key={a} className="flex gap-2 text-[13.5px] text-fg">
                        <Check size={14} className="mt-[3px] shrink-0 text-ok" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="eyebrow mb-2">Only the applicant</div>
                  <ul className="space-y-1.5">
                    {r.person.map((a) => (
                      <li key={a} className="flex gap-2 text-[13.5px] text-muted">
                        <Lock size={13} className="mt-[3px] shrink-0 text-faint" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 max-w-[70ch] text-[13px] text-faint">
        Demo rule packs, reviewed 2 October 2026 from public sources. Fees, timings and advisories change, so every pack carries its source and review date and is verified before an agency relies on it.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ loop */

export function Loop() {
  const [i, setI] = useState(0);
  const frame = FRAMES[ORDER[i]];
  const Card = REGISTRY[frame.component];
  return (
    <section id="how" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-32">
      <Reveal>
        <Head eyebrow="The agent loop" title="Eight moves from message to decision." sub="Pick a move to see the component the agent builds for it. These are the same cards you see inside the demo." />
      </Reveal>
      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-10">
        <ol className="space-y-1" aria-label="Steps">
          {ORDER.map((k, n) => {
            const f = FRAMES[k];
            const on = n === i;
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setI(n)}
                  aria-current={on ? 'step' : undefined}
                  className={cn('w-full rounded-2xl px-4 py-3.5 text-left transition-colors', on ? 'bg-surface2' : 'hover:bg-surface')}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('font-mono text-[12px] tnum', on ? 'text-brass' : 'text-faint')}>{String(n + 1).padStart(2, '0')}</span>
                    <span className={cn('flex-1 text-[16px] font-medium', on ? 'text-fg' : 'text-muted')}>{f.label}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{f.owner}</span>
                  </div>
                  {on && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 pl-[34px] text-[14px] text-muted">
                      {f.blurb}
                    </motion.p>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[22px] border border-line p-4 sm:p-5" aria-live="polite">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="eyebrow">{frame.label}</span>
              <span className="font-mono text-[11px] text-faint">{frame.component}</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={frame.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <Card id={`loop-${frame.key}`} props={frame.props as never} ctx={NOOP_CTX} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ generative */

const COMPOSITIONS = [
  {
    id: 'eta',
    tab: 'Family ETA',
    note: 'Four travellers, a flag on a passport, and applicant-only steps for a parent.',
    parts: ['IntakeSummary', 'RequirementsCard', 'DocumentTray', 'ChecksReport', 'ConflictResolver', 'FormDraft', 'FeeQuote', 'ApprovalGate', 'ApplicantHandoff', 'SubmissionReceipt', 'StatusTimeline', 'CaseSummary'],
    spec: `{
  "component": "ConflictResolver",
  "props": {
    "conflict": {
      "rule": "R-PASS-02",
      "risk": "medium",
      "title": "Aisha's passport is close to expiry",
      "evidence": [{ "doc": "Passport", "value": "9 Feb 2027" }],
      "options": ["proceed", "renew", "ask"]
    }
  }
}`,
  },
  {
    id: 'us',
    tab: 'US interview',
    note: 'A live advisory, two flags that need a person, and a file staged for an interview.',
    parts: ['IntakeSummary', 'RequirementsCard', 'AdvisoryBanner', 'DocumentTray', 'ConflictResolver', 'ConflictResolver', 'FormDraft', 'FeeQuote', 'ApprovalGate', 'ApplicantHandoff', 'SubmissionReceipt', 'StatusTimeline', 'MessageDraft'],
    spec: `{
  "component": "AdvisoryBanner",
  "props": {
    "title": "Routine US visa services in the UAE were reported suspended",
    "asOf": "17 Jul 2026",
    "source": "ae.usembassy.gov security alert",
    "actions": [
      "Prepare and lock the DS-160 draft",
      "Hold appointment booking",
      "Tell the client what to expect"
    ]
  }
}`,
  },
  {
    id: 'etias',
    tab: 'ETIAS watch',
    note: 'No portal yet, so the agent prepares the profile and waits for the launch.',
    parts: ['IntakeSummary', 'RequirementsCard', 'DocumentTray', 'ChecksReport', 'FormDraft', 'FeeQuote', 'ApprovalGate', 'LaunchWatch', 'MessageDraft', 'CaseSummary'],
    spec: `{
  "component": "LaunchWatch",
  "props": {
    "expected": "Q4 2026, as reported",
    "ready": 1,
    "sources": [
      { "domain": "travel-europe.europa.eu/etias", "status": "Not open" }
    ],
    "plan": ["Alert you the moment the status changes", "Send the client a secure link"]
  }
}`,
  },
];

function Spec({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <pre className="overflow-x-auto rounded-2xl border border-line bg-raised p-5 font-mono text-[12.5px] leading-[1.75]" aria-label="Component spec emitted by the agent">
      <code>
        {lines.map((l, n) => {
          const m = l.match(/^(\s*)("[^"]+")(:)(.*)$/);
          return (
            <div key={n} className="whitespace-pre">
              {m ? (
                <>
                  {m[1]}
                  <span className="text-info">{m[2]}</span>
                  <span className="text-faint">{m[3]}</span>
                  <span className={m[4].includes('"') ? 'text-ok' : 'text-brasshi'}>{m[4]}</span>
                </>
              ) : (
                <span className="text-faint">{l}</span>
              )}
            </div>
          );
        })}
      </code>
    </pre>
  );
}

export function Generative() {
  const [t, setT] = useState(0);
  const c = COMPOSITIONS[t];
  return (
    <section id="generative" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-36">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <Reveal>
          <Head
            eyebrow="Generative workspace"
            title="A workspace that builds itself around the case."
            sub="The agent does not fill in a fixed screen. It decides what this case needs, then composes the interface from a library of components. The same agent produces a different workspace for each kind of case."
          />
          <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Case types">
            {COMPOSITIONS.map((x, n) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={n === t}
                type="button"
                onClick={() => setT(n)}
                className={cn('rounded-full border px-4 py-2 text-[14px] font-medium transition-colors', n === t ? 'border-brass bg-[var(--brass-wash)] text-fg' : 'border-line text-muted hover:text-fg')}
              >
                {x.tab}
              </button>
            ))}
          </div>
          <p className="mt-4 max-w-[48ch] text-[14.5px] text-muted">{c.note}</p>
        </Reveal>

        <Reveal delay={0.1} className="min-w-0">
          <div className="eyebrow mb-3">Composed, in order</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol key={c.id} initial="hide" animate="show" exit={{ opacity: 0 }} variants={{ show: { transition: { staggerChildren: 0.035 } }, hide: {} }} className="flex flex-wrap gap-2">
              {c.parts.map((p, n) => (
                <motion.li key={`${p}-${n}`} variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-fg">
                  <span className="mr-1.5 text-faint tnum">{n + 1}</span>
                  {p}
                </motion.li>
              ))}
            </motion.ol>
          </AnimatePresence>
          <div className="eyebrow mb-3 mt-8">One, as emitted</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={c.id + 'spec'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Spec text={c.spec} />
            </motion.div>
          </AnimatePresence>
          <p className="mt-3 max-w-[58ch] text-[13px] text-faint">The agent never writes markup. It names a component and its data, and a fixed library decides how that renders. An unknown name falls back to a plain card.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ autonomy */

type Who = 'Agent' | 'You' | 'Client';

export function Autonomy() {
  const [lvl, setLvl] = useState<1 | 2 | 3>(2);
  const rows = useMemo(() => {
    const byRisk = (risk: 'low' | 'medium' | 'high'): Who[] => ([1, 2, 3] as const).map((l) => (allowAuto(l, risk) ? 'Agent' : 'You'));
    return [
      { label: 'Read documents and fill forms', who: ['Agent', 'Agent', 'Agent'] as Who[], risk: 'No decision' },
      { label: 'Confirm what the agent read', who: ['You', 'Agent', 'Agent'] as Who[], risk: 'Low' },
      { label: 'Settle a name spelled two ways', who: byRisk('low'), risk: 'Low' },
      { label: 'Passport close to expiry', who: byRisk('medium'), risk: 'Medium' },
      { label: 'Flight and hotel dates disagree', who: byRisk('medium'), risk: 'Medium' },
      { label: 'Passport expired before the trip', who: byRisk('high'), risk: 'High' },
      { label: 'Approve the file', who: ['You', 'You', 'Agent'] as Who[], risk: 'Needs no open flags' },
      { label: 'Selfie, declarations, signature', who: ['Client', 'Client', 'Client'] as Who[], risk: 'Applicant only' },
    ];
  }, []);

  return (
    <section id="control" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <Reveal>
          <Head
            eyebrow="Control"
            title="Set how much the agent decides."
            sub="Every decision has a risk level. Your autonomy level decides who settles it. High-risk items, and anything only the applicant can do, always come to a person."
          />
          <div className="mt-8 space-y-2" role="radiogroup" aria-label="Autonomy level">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                role="radio"
                aria-checked={lvl === l.level}
                onClick={() => setLvl(l.level)}
                className={cn('flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-colors', lvl === l.level ? 'border-brass bg-[var(--brass-wash)]' : 'border-line hover:border-line-strong')}
              >
                <span className={cn('font-mono text-[13px]', lvl === l.level ? 'text-brasshi' : 'text-faint')}>L{l.level}</span>
                <span>
                  <span className="block text-[16px] font-medium text-fg">{l.name}</span>
                  <span className="block text-[13.5px] text-muted">{l.line}</span>
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="min-w-0">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[540px] text-left">
              <caption className="sr-only">Who settles each decision at each autonomy level</caption>
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow px-4 py-3 font-normal">Decision</th>
                  {LEVELS.map((l) => (
                    <th key={l.level} className={cn('px-3 py-3 text-center text-[13px] font-medium transition-colors', lvl === l.level ? 'bg-[var(--brass-wash)] text-brasshi' : 'text-muted')}>
                      L{l.level} {l.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="block text-[14px] text-fg">{r.label}</span>
                      <span className="block font-mono text-[11px] uppercase tracking-wide text-faint">{r.risk}</span>
                    </th>
                    {r.who.map((w, n) => (
                      <td key={n} className={cn('px-3 py-3 text-center transition-colors', lvl === n + 1 && 'bg-[var(--brass-wash)]')}>
                        <Pill tone={w === 'Agent' ? 'brass' : w === 'Client' ? 'info' : 'neutral'}>{w}</Pill>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-faint">This table is computed from the same policy function the demo runs. Try it: switch level in the console and run the same case again.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ trust */

const TRUST_ICONS = [PenLine, ShieldOff, Link2, ScrollText];

export function Trust() {
  return (
    <section id="limits" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-36">
      <Reveal>
        <Head eyebrow="Where Rihla stops" title="The lines the agent does not cross." />
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((t, n) => {
          const Icon = TRUST_ICONS[n];
          return (
            <Reveal key={t.title} delay={n * 0.06} className="bg-surface p-7">
              <Icon size={22} className="text-brass" aria-hidden />
              <h3 className="font-display mt-6 text-[26px] italic leading-tight text-fg">{t.title}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted pretty">{t.body}</p>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ pricing */

export function Pricing({ onContact }: { onContact: () => void }) {
  return (
    <section id="pricing" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-32">
      <Reveal>
        <Head eyebrow="Pricing" title="Start with one route. Grow into the whole desk." sub="Founding-agency pricing in dirhams. Government fees, third-party costs and VAT are not included." />
      </Reveal>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {TIERS.map((t, n) => (
          <Reveal key={t.name} delay={n * 0.07} className="flex">
            <article className={cn('flex w-full flex-col rounded-3xl border p-7', t.featured ? 'border-brass bg-surface2' : 'border-line bg-surface')}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[30px] italic text-fg">{t.name}</h3>
                {t.featured && <Pill tone="brass">Most agencies start here</Pill>}
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none tnum text-fg">{t.price}</span>
                <span className="text-[13.5px] text-muted">{t.unit}</span>
              </div>
              <p className="mt-3 min-h-[3.2em] text-[14.5px] text-muted">{t.line}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                {t.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[14px] text-fg">
                    <Check size={15} className="mt-[3px] shrink-0 text-brass" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onContact} className={cn('btn btn-lg mt-7 w-full', t.featured ? 'btn-primary' : 'btn-outline')}>
                {t.cta}
              </button>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pt-32">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <Reveal>
          <Head eyebrow="Questions" title="What agencies ask first." />
        </Reveal>
        <Reveal delay={0.08}>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus size={18} className="shrink-0 text-brass transition-transform duration-300 group-open:rotate-45" aria-hidden />
                </summary>
                <p className="max-w-[62ch] pb-6 text-[15px] leading-relaxed text-muted pretty">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ closing */

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard.writeText(value).catch(() => undefined);
    } catch {
      /* the value stays selectable */
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        <div className="mt-0.5 select-all break-all font-mono text-[15px] text-fg">{value}</div>
      </div>
      <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={copy} aria-label={`Copy ${label}`}>
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function Closing({ onOpenDemo }: { onOpenDemo: () => void }) {
  return (
    <section id="contact" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 pb-24 pt-36">
      <div className="relative overflow-hidden rounded-[32px] border border-line bg-surface p-8 sm:p-12 lg:p-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <div className="eyebrow eyebrow-brass">Next step</div>
            <h2 className="font-display mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.02em] text-fg balance">
              Watch an agent finish a <em className="font-medium text-brasshi">family’s file.</em>
            </h2>
            <p className="mt-5 max-w-[48ch] text-[17px] text-muted">Open the demo, pick a case, and set the autonomy level. Then talk to us about a pilot on your own route.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary btn-lg" onClick={onOpenDemo}>
                Open the demo <ArrowRight size={17} aria-hidden />
              </button>
            </div>
          </div>
          <div className="border-t border-line pt-4">
            <div className="eyebrow">Book an agency pilot</div>
            <div className="divide-y divide-[var(--line)]">
              <CopyRow label="Email" value={CONTACT.email} />
              <CopyRow label="WhatsApp" value={CONTACT.whatsapp} />
            </div>
            <p className="pt-2 text-[12.5px] text-faint">{CONTACT.hours}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
