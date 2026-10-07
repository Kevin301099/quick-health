import { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Check, MousePointerClick, ScanLine } from 'lucide-react';
import { Pill, Stamp } from '../ui';
import { cn } from '@/lib/utils';

/*
  The live product's hero: a passport photo page being read, then proven correct by the check digits printed
  in its machine-readable zone, then the official form filled in, then the traveller paying and submitting, then
  the visa. It opens on the proof, the frame that says most about what Rihla does, and loops from there.
*/

const MRZ = ['P<INDSHARMA<<ANANYA<RAVI<<<<<<<<<<<<<<<<<<<<', 'Z9100234<8IND9206148F2902289<<<<<<<<<<<<<<<8'] as const;
/** Positions of the five check digits in line two: number, birth date, expiry, personal number, composite. */
const CHECK_AT = new Set([9, 19, 27, 42, 43]);

const STEPS = ['Read your passport', 'Confirmed by 5 check digits', 'Checked dates and photo', 'Official form filled in', 'You pay and press Submit', 'Visa issued'];

type Dock = 'reading' | 'proof' | 'filled' | 'submit' | 'issued';
const STAGES: { cur: number; dock: Dock }[] = [
  { cur: 0, dock: 'reading' },
  { cur: 2, dock: 'proof' },
  { cur: 3, dock: 'filled' },
  { cur: 4, dock: 'submit' },
  { cur: 6, dock: 'issued' },
];
const DWELL_MS = 3400;

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium opacity-70">{k}</div>
      <div className={cn('truncate text-[13px] font-semibold', mono && 'font-mono')}>{v}</div>
    </div>
  );
}

function DockCard({ dock }: { dock: Dock }) {
  if (dock === 'issued')
    return (
      <div className="flex items-center gap-4">
        <Stamp top="ENTRY PERMIT" bottom="UNITED ARAB EMIRATES" date="28 OCT" size={96} className="stamp-in shrink-0" />
        <div className="min-w-0">
          <div className="font-display text-[20px] font-bold leading-tight tracking-[-0.02em]">Your visa is ready</div>
          <p className="mt-1 text-[13px] text-muted">The authorities email it to you. Carry a copy when you fly.</p>
        </div>
      </div>
    );
  if (dock === 'submit')
    return (
      <div>
        <Pill tone="attn">Your turn</Pill>
        <div className="mt-2 font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">Pay, then press Submit</div>
        <p className="mt-1 text-[13px] leading-snug text-muted">On the official site, with your own card. The declarations and the final click are yours.</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-attn px-3.5 py-2 text-[13.5px] font-semibold text-[var(--on-attn)]">
          <MousePointerClick size={15} aria-hidden /> Submit application
        </div>
      </div>
    );
  if (dock === 'filled')
    return (
      <div>
        <div className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">The official form, filled in</div>
        <p className="mt-1 text-[13px] leading-snug text-muted">One click on each page of GDRFA, ICP or your airline. Every field typed, every document attached.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ['Passport number', 'Z9100234'],
            ['Date of birth', '14/06/1992'],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-lg border-2 px-2.5 py-1.5" style={{ borderColor: 'var(--brand)' }}>
              <div className="text-[11px] text-muted">{k}</div>
              <div className="truncate font-mono text-[12.5px] font-semibold text-fg">{v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  const copy: Record<'reading' | 'proof', [string, string]> = {
    reading: ['Reading your passport', 'Every field on the photo page, and the two code lines at the bottom.'],
    proof: ['Every number checks out', 'Z9100234 · 14 Jun 1992 · 28 Feb 2029. Confirmed by the check digits, so nothing is mistyped.'],
  };
  const [title, text] = copy[dock];
  return (
    <div>
      <div className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">{title}</div>
      <p className="mt-1 text-[13px] leading-snug text-muted">{text}</p>
    </div>
  );
}

export function LiveHeroPreview() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(1);
  const [paused, setPaused] = useState(false);
  const stage = STAGES[i];
  const proven = stage.cur >= 1;

  useEffect(() => {
    if (reduce || paused) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % STAGES.length), DWELL_MS);
    return () => window.clearTimeout(t);
  }, [i, reduce, paused]);

  return (
    <figure className="m-0" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="@container overflow-hidden rounded-[22px] border border-line bg-surface" style={{ boxShadow: 'var(--shadow-lift)' }}>
        <div className="grid @lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* the passport being read */}
          <div className="flex min-w-0 flex-col border-b border-line bg-surface2 @lg:border-b-0 @lg:border-r">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
                <ScanLine size={14} aria-hidden /> Passport page
              </span>
              <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold', proven ? 'bg-[var(--ok-wash)] text-ok' : 'bg-[var(--brand-wash)] text-brand')}>
                {proven ? <Check size={12} strokeWidth={3} aria-hidden /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}
                {proven ? '5 of 5 check digits match' : 'Reading'}
              </span>
            </div>
            <div className="flex flex-1 items-center p-4">
              <div className="sheet @container relative w-full overflow-hidden p-4 shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
                {stage.cur === 0 && <div className="scanline" aria-hidden />}
                <div className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
                  <span>Republic of India</span>
                  <span>Passport · P</span>
                </div>
                <div className="mt-3 flex gap-3.5">
                  <svg viewBox="0 0 60 76" className="h-[86px] w-[68px] shrink-0 rounded-md" aria-hidden>
                    <rect width="60" height="76" rx="5" fill="currentColor" opacity="0.08" />
                    <circle cx="30" cy="30" r="12" fill="currentColor" opacity="0.28" />
                    <path d="M8 76c2-15 11-22 22-22s20 7 22 22" fill="currentColor" opacity="0.28" />
                  </svg>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
                    <Field k="Surname" v="SHARMA" />
                    <Field k="Given names" v="ANANYA RAVI" />
                    <Field k="Date of birth" v="14 JUN 1992" mono />
                    <Field k="Sex" v="F" />
                    <Field k="Passport no." v="Z9100234" mono />
                    <Field k="Date of expiry" v="28 FEB 2029" mono />
                  </div>
                </div>
                <div className="mt-3.5 border-t border-[var(--paper-line)] pt-2.5 font-mono text-[clamp(6px,3.6cqw,11.5px)] leading-[1.65]" aria-label="Machine-readable zone">
                  {MRZ.map((line, li) => (
                    <code key={li} className="block whitespace-nowrap font-mono">
                      {[...line].map((ch, ci) =>
                        li === 1 && CHECK_AT.has(ci) ? (
                          <span key={ci} className={cn('rounded-[2px] transition-colors duration-500', proven && 'bg-[var(--ok-wash)] font-bold text-ok outline outline-1 outline-[var(--ok)]')}>
                            {ch}
                          </span>
                        ) : (
                          <span key={ci}>{ch}</span>
                        ),
                      )}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* what happens next */}
          <div className="flex min-w-0 flex-col">
            <ol className="ledger px-4 py-2" aria-label="Progress">
              {STEPS.map((label, n) => {
                const state = n < stage.cur ? 'done' : n === stage.cur ? (stage.dock === 'submit' ? 'you' : 'now') : 'later';
                return (
                  <li key={label} className="flex items-center gap-2.5 py-[6px] text-[13px]">
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
            <div className="mt-auto min-h-[150px] border-t border-line bg-surface2 p-4">
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={stage.dock} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                  <DockCard dock={stage.dock} />
                </m.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[12.5px] text-faint">A sample application, sped up. Fictional traveller.</figcaption>
    </figure>
  );
}
