import { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Check, Lock, MousePointer2 } from 'lucide-react';
import { Pill, Stamp } from '../ui';
import { cn } from '@/lib/utils';

/*
  A scripted, sped-up filing, drawn from the same pieces the real room uses: the plain sandbox portal on the left,
  the agent's timeline and its "Your turn" dock on the right. It starts on the most telling frame (the agent has
  stopped for an email code) so the first still already explains the product, then keeps looping.
*/

const FIELDS: [string, string][] = [
  ['Given names', 'ANANYA RAVI'],
  ['Surname', 'SHARMA'],
  ['Passport number', 'Z9100234'],
  ['Date of birth', '14 Jun 1992'],
  ['Arrival date', '25 Nov 2026'],
  ['Stay', '30 days'],
];

const STEPS = ['Read your 5 documents', 'Checked names, dates and photo', 'Filled in the application', 'You enter the email code', 'You pay on the portal', 'Visa issued'];

type Dock = 'code' | 'pay' | 'done' | null;
interface Stage {
  cur: number;
  fields: number;
  dock: Dock;
  url: string;
}

const STAGES: Stage[] = [
  { cur: 0, fields: 0, dock: null, url: 'sandbox.demo/start' },
  { cur: 2, fields: 3, dock: null, url: 'sandbox.demo/personal' },
  { cur: 2, fields: 6, dock: null, url: 'sandbox.demo/travel' },
  { cur: 3, fields: 6, dock: 'code', url: 'sandbox.demo/verify' },
  { cur: 4, fields: 6, dock: 'pay', url: 'sandbox.demo/payment' },
  { cur: 5, fields: 6, dock: 'done', url: 'sandbox.demo/done' },
];

const DWELL_MS = 3200;

function Dots() {
  return (
    <div className="mt-3 flex gap-1.5" aria-hidden>
      {['4', '8', '2', '1', '7', '3'].map((d, i) => (
        <span key={i} className={cn('grid h-10 w-8 place-items-center rounded-lg border font-mono text-[17px]', i < 4 ? 'border-line-strong bg-surface text-fg' : 'border-brand bg-[var(--brand-wash)] text-brand')} style={i < 4 ? { borderColor: 'var(--line-strong)' } : undefined}>
          {i < 4 ? d : i === 4 ? <span className="caret" /> : ''}
        </span>
      ))}
    </div>
  );
}

function DockCard({ dock }: { dock: Exclude<Dock, null> }) {
  if (dock === 'done')
    return (
      <div className="flex items-center gap-4">
        <Stamp top="ENTRY PERMIT" bottom="UNITED ARAB EMIRATES" date="3 DEC" size={96} className="stamp-in shrink-0" />
        <div className="min-w-0">
          <div className="eyebrow">Permit</div>
          <div className="font-display text-[20px] font-bold leading-tight tracking-[-0.02em]">Your visa is ready</div>
          <div className="mt-1 font-mono text-[12px] text-muted">ENT-26-716004</div>
        </div>
      </div>
    );
  return (
    <div>
      <div className="flex items-center gap-2">
        <Pill tone="attn">Your turn</Pill>
      </div>
      <div className="mt-2 font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">{dock === 'code' ? 'Enter the code from your email' : 'Pay on the portal’s page'}</div>
      <p className="mt-1 text-[13px] leading-snug text-muted">{dock === 'code' ? 'The portal just sent a 6-digit code to a.sharma@mail.com. Only you can read it.' : 'AED 368.55 in total. The card form is in the browser. I never see your card.'}</p>
      {dock === 'code' ? (
        <Dots />
      ) : (
        <div className="mt-3 inline-flex min-h-9 items-center rounded-xl bg-attn px-4 text-[13.5px] font-semibold text-[var(--on-attn)]" aria-hidden>
          Take over the browser
        </div>
      )}
    </div>
  );
}

export function HeroPreview({ caption = 'A sample filing, sped up. In the real thing you can watch every click, or take over the browser yourself.' }: { caption?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(3);
  const [paused, setPaused] = useState(false);
  const stage = STAGES[i]!;

  useEffect(() => {
    if (reduce || paused) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % STAGES.length), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [i, reduce, paused]);

  const driving = stage.dock === null;
  const active = stage.fields > 0 && stage.fields <= 6 ? stage.fields - 1 : -1;

  return (
    <figure className="m-0" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="@container overflow-hidden rounded-[22px] border border-line bg-surface" style={{ boxShadow: 'var(--shadow-lift)' }}>
        <div className="grid @lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* the browser the agent drives */}
          <div className="flex min-w-0 flex-col border-b border-line @lg:border-b-0 @lg:border-r">
            <div className="flex items-center gap-2 border-b border-line bg-surface2 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-[12px] text-muted">
                <Lock size={12} aria-hidden className="shrink-0" />
                <AnimatePresence mode="wait" initial={false}>
                  <m.span key={stage.url} className="truncate font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {stage.url}
                  </m.span>
                </AnimatePresence>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold', driving ? 'bg-[var(--brand-wash)] text-brand' : 'bg-[var(--attn-wash)] text-attn')}>
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {driving ? 'Agent filing' : 'Waiting for you'}
              </span>
            </div>
            <div className="portal min-h-[318px] flex-1 overflow-hidden">
              <div className="p-head !py-2.5">
                <span className="p-brand text-[13px]">
                  <span className="p-emblem !size-5" aria-hidden />
                  Entry Permit Service
                </span>
                <span className="p-chip">SANDBOX</span>
              </div>
              <div className="p-main !px-4 !py-4">
                <div className="p-card !p-4">
                  <div className="text-[16px] font-semibold leading-tight">Personal and passport details</div>
                  <p className="p-sub !mb-3 !mt-1 !text-[12px]">As shown on the passport photo page.</p>
                  <div className="p-grid !gap-x-3 !gap-y-2.5">
                    {FIELDS.map(([label, value], n) => {
                      const filled = n < stage.fields;
                      return (
                        <div key={label} className="relative min-w-0">
                          <span className="p-label !mb-1 !text-[11.5px]">{label}</span>
                          <div className={cn('p-input flex !h-8 items-center !px-2.5 !text-[12.5px]', n === active && driving && 'spotlight')} aria-hidden>
                            <AnimatePresence initial={false}>
                              {filled && (
                                <m.span key="v" className="truncate" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                                  {value}
                                </m.span>
                              )}
                            </AnimatePresence>
                          </div>
                          {n === active && driving && (
                            <m.span key={`c-${i}`} className="pointer-events-none absolute -bottom-2.5 right-3 text-brand" initial={{ opacity: 0, y: 8, x: 8 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ duration: 0.35 }} aria-hidden>
                              <MousePointer2 size={20} fill="currentColor" />
                            </m.span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-actions !mt-4" aria-hidden>
                    <span className="p-btn p-ghost p-small">Save draft</span>
                    <span className="p-btn p-small">Continue</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* the agent */}
          <div className="flex min-w-0 flex-col">
            <ol className="ledger px-4 py-2" aria-label="What the agent has done">
              {STEPS.map((label, n) => {
                const state = n < stage.cur ? 'done' : n === stage.cur ? (stage.dock && stage.dock !== 'done' ? 'you' : stage.dock === 'done' ? 'done' : 'now') : 'later';
                return (
                  <li key={label} className="flex items-center gap-2.5 py-[7px] text-[13px]">
                    <span
                      className={cn('grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold', state === 'done' && 'bg-brand text-[var(--on-brand)]', state === 'now' && 'border-2 border-brand', state === 'you' && 'bg-attn text-[var(--on-attn)]', state === 'later' && 'border')}
                      style={state === 'later' ? { borderColor: 'var(--line-strong)' } : undefined}
                    >
                      {state === 'done' ? <Check size={11} strokeWidth={3.5} aria-hidden /> : state === 'you' ? '!' : null}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate', state === 'later' ? 'text-faint' : 'text-fg', state === 'you' && 'font-semibold')}>{label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-auto min-h-[148px] border-t border-line bg-surface2 p-4">
              <AnimatePresence mode="wait" initial={false}>
                {stage.dock ? (
                  <m.div key={stage.dock} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                    <DockCard dock={stage.dock} />
                  </m.div>
                ) : (
                  <m.div key="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="eyebrow">Agent</div>
                    <div className="mt-1 font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">{stage.cur === 0 ? 'Reading your documents' : 'Filling the form for you'}</div>
                    <p className="mt-1 text-[13px] leading-snug text-muted">{stage.cur === 0 ? '26 fields from 5 documents, each one linked back to its page.' : `Typing into the portal like a person would. ${stage.fields} of 6 fields.`}</p>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[12.5px] text-faint">{caption}</figcaption>
    </figure>
  );
}
