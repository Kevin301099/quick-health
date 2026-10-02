import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { REGISTRY } from '../genui/registry';
import { NOOP_CTX } from '../genui/types';
import { Mark, Pill } from '../ui';
import { RouteCanvas } from './RouteCanvas';
import { FRAMES, HERO_ORDER, RESOLVED_FLAG } from './stageData';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { label: string; tone: 'brass' | 'warn' | 'ok' | 'info' }> = {
  intake: { label: 'Reading', tone: 'brass' },
  rules: { label: 'Checking rules', tone: 'brass' },
  documents: { label: 'Reading documents', tone: 'brass' },
  checks: { label: 'Needs you', tone: 'warn' },
  quote: { label: 'Quoting', tone: 'brass' },
  track: { label: 'Approved', tone: 'ok' },
};

function AgentStage() {
  const [i, setI] = useState(0);
  const [settled, setSettled] = useState(false);
  const [hold, setHold] = useState(false);
  const key = HERO_ORDER[i];
  const frame = FRAMES[key];

  useEffect(() => {
    if (hold) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const isFlag = key === 'checks';
    const t = setTimeout(
      () => {
        if (isFlag && !settled) {
          setSettled(true);
          return;
        }
        setSettled(false);
        setI((n) => (n + 1) % HERO_ORDER.length);
      },
      isFlag && !settled ? 2800 : 4300,
    );
    return () => clearTimeout(t);
  }, [i, settled, hold, key]);

  const Card = REGISTRY[frame.component];
  const props = key === 'checks' && settled ? { ...frame.props, resolved: RESOLVED_FLAG } : frame.props;
  const st = key === 'checks' && settled ? { label: 'Settled', tone: 'ok' as const } : STATUS[key];

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-line-strong"
      style={{ borderColor: 'var(--line-strong)', boxShadow: 'var(--shadow-lift)' }}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      aria-label="Live preview of an agent working a UK ETA case"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mark size={20} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-fg">C-1042 · Al Mansoori family</div>
            <div className="truncate font-mono text-[11px] text-faint">UK ETA · 4 travellers · London</div>
          </div>
        </div>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>

      <div className="px-4 pb-1 pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${key}-line`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="flex items-start gap-2.5 text-[14.5px] leading-snug text-fg"
          >
            <Mark size={18} className="mt-[1px] shrink-0" />
            {frame.line}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="relative h-[430px] overflow-hidden px-4 pt-3 [mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${key}-${settled}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 0.9, 0.24, 1] }}
          >
            <Card id={`stage-${key}`} props={props as never} ctx={NOOP_CTX} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Preview steps">
          {HERO_ORDER.map((k, n) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={FRAMES[k].label}
              onClick={() => {
                setSettled(false);
                setI(n);
              }}
              className="group flex h-6 items-center"
            >
              <span className={cn('h-[3px] w-7 rounded-full transition-colors', n === i ? 'bg-brass' : 'bg-surface3 group-hover:bg-line-strong')} />
            </button>
          ))}
        </div>
        <span className="font-mono text-[12px] text-faint">Generated UI · real components</span>
      </div>
    </div>
  );
}

const ROUTE_CHIPS = [
  ['UK ETA', 'End to end'],
  ['Canada eTA', 'End to end'],
  ['US B1/B2', 'Up to the signature'],
  ['ETIAS', 'Prepare and watch'],
];

export function Hero({ onOpenDemo, onContact }: { onOpenDemo: () => void; onContact: () => void }) {
  const lines = [
    <span key="a">The visa desk</span>,
    <span key="b">
      that <em className="font-medium text-brasshi">files itself.</em>
    </span>,
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto grid max-w-[1280px] gap-14 px-6 pb-10 pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-10 lg:pt-20">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-wrap items-center gap-3">
            <span className="eyebrow eyebrow-brass">For UAE visa agencies</span>
            <span className="font-kufi text-[15px] text-faint" dir="rtl" lang="ar">
              مكتب التأشيرات الذكي
            </span>
          </motion.div>

          <h1 className="font-display mt-6 text-[clamp(3.1rem,7.2vw,6.4rem)] font-normal leading-[0.97] tracking-[-0.025em] text-fg">
            {lines.map((l, n) => (
              <span key={n} className="block overflow-hidden pb-[0.08em]">
                <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1 + n * 0.12, ease: [0.22, 0.9, 0.24, 1] }}>
                  {l}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-7 max-w-[52ch] text-[18px] leading-relaxed text-muted pretty"
          >
            Rihla is a team of agents for visa and travel agencies in the UAE. They read the documents, catch the errors, fill the forms and chase the client. Your staff approve once.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.58 }} className="mt-9 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary btn-lg" onClick={onOpenDemo}>
              Watch an agent work <ArrowRight size={17} aria-hidden />
            </button>
            <button type="button" className="btn btn-outline btn-lg" onClick={onContact}>
              Book an agency pilot
            </button>
          </motion.div>

          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.8 }} className="mt-10 flex flex-wrap gap-x-6 gap-y-3" aria-label="Routes covered">
            {ROUTE_CHIPS.map(([r, l]) => (
              <li key={r} className="min-w-0">
                <div className="text-[14px] font-medium text-fg">{r}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{l}</div>
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 0.9, 0.24, 1] }} className="min-w-0">
          <AgentStage />
        </motion.div>
      </div>
      <div className="relative mx-auto h-[240px] max-w-[1280px] px-6" aria-hidden>
        <RouteCanvas className="pointer-events-none h-full w-full [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" />
      </div>
    </section>
  );
}
