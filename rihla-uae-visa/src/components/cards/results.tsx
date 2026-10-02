import { motion } from 'motion/react';
import { Check, Circle, TriangleAlert } from 'lucide-react';
import type { PermitData } from '@/agent/types';
import type { Risk, VisaId } from '@/domain/types';
import { quote } from '@/domain/visas';
import type { CardProps } from './types';
import { CardShell } from './Frame';
import { Pill, Spinner, Stamp } from '../ui';
import { aed, cn, fmtDate } from '@/lib/utils';

export function ChecksReport({ props }: CardProps<{ passes: string[]; issues: { title: string; risk: Risk }[] }>) {
  return (
    <CardShell eyebrow="Checks" title="What I found" right={<Pill tone={props.issues.length ? 'attn' : 'ok'}>{props.issues.length ? `${props.issues.length} for you` : 'All clear'}</Pill>}>
      <ul className="ledger">
        {props.passes.map((p) => (
          <li key={p} className="flex items-start gap-3 py-2 text-[14px] text-fg">
            <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            {p}
          </li>
        ))}
        {props.issues.map((i) => (
          <li key={i.title} className="flex items-start gap-3 py-2 text-[14px] text-fg">
            <TriangleAlert size={16} className={cn('mt-0.5 shrink-0', i.risk === 'high' ? 'text-attn' : 'text-[var(--sun-ink)]')} aria-hidden />
            <span className="min-w-0 flex-1">{i.title}</span>
            <Pill tone={i.risk === 'high' ? 'attn' : i.risk === 'medium' ? 'sun' : 'neutral'}>{i.risk === 'high' ? 'Blocks filing' : 'Needs a choice'}</Pill>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function FieldsDiff({ props }: CardProps<{ total: number; matched: number; diffs: { label: string; expected: string; actual: string }[] }>) {
  const ok = props.diffs.length === 0;
  return (
    <CardShell eyebrow="Read back" title="Does the portal match your documents?" right={<Pill tone={ok ? 'ok' : 'attn'}>{props.matched} of {props.total} match</Pill>}>
      {ok ? (
        <p className="text-[14px] text-muted">I read the review page back and compared every field with what you confirmed. Nothing differs.</p>
      ) : (
        <ul className="ledger">
          {props.diffs.map((d) => (
            <li key={d.label} className="py-2 text-[13.5px]">
              <span className="text-fg">{d.label}</span>: expected <span className="font-mono text-ok">{d.expected}</span>, portal has <span className="font-mono text-attn">{d.actual || 'nothing'}</span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

export function StatusTimeline({ props }: CardProps<{ steps: { label: string; detail: string; status: 'done' | 'active' | 'pending'; at?: string }[]; reference?: string | null; clock?: string }>) {
  return (
    <CardShell eyebrow="Tracking" title="Where your application is" right={props.reference ? <Pill mono>{props.reference}</Pill> : undefined}>
      <ol>
        {props.steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-4 pb-5 last:pb-0">
            {i < props.steps.length - 1 && <span className="absolute left-[9px] top-5 h-[calc(100%-12px)] w-px" style={{ background: s.status === 'done' ? 'var(--brand)' : 'var(--line-strong)' }} aria-hidden />}
            <span className="relative mt-0.5 flex size-[19px] shrink-0 items-center justify-center">
              {s.status === 'done' ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-[19px] items-center justify-center rounded-full bg-brand text-[var(--on-brand)]">
                  <Check size={12} strokeWidth={3} />
                </motion.span>
              ) : s.status === 'active' ? (
                <span className="relative flex size-[19px] items-center justify-center rounded-full border-2 border-brand ring-pulse" />
              ) : (
                <Circle size={19} className="text-line-strong" style={{ color: 'var(--line-strong)' }} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={cn('text-[15px] font-medium', s.status === 'pending' ? 'text-faint' : 'text-fg')}>{s.label}</span>
                {s.at && <span className="font-mono text-[12px] text-faint">{s.at}</span>}
              </div>
              <div className="text-[13.5px] text-muted">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
      {props.clock && <p className="mt-4 text-[12.5px] text-faint">{props.clock}</p>}
    </CardShell>
  );
}

export function PermitReady({ props }: CardProps<{ permit: PermitData; name: string }>) {
  const p = props.permit;
  const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1];
  return (
    <div className="ticket @container">
      <div className="ticket-body relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-brand px-6 py-4 text-[var(--on-brand)]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">Entry permit</div>
            <div className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">{p.type}</div>
          </div>
          <Pill className="!bg-white/20 !text-[var(--on-brand)]" mono>
            {p.days} days
          </Pill>
        </div>
        <div className="grid gap-6 px-6 pb-5 pt-5 @xl:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="eyebrow">Holder</div>
            <div className="font-display text-[clamp(1.6rem,4cqw,2.2rem)] font-bold leading-tight tracking-[-0.02em] text-fg">{props.name}</div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 @lg:grid-cols-3">
              {[
                ['Permit number', p.number],
                ['Passport', p.passportNo],
                ['Entering', p.emirate],
                ['Enter by', fmtDate(p.enterBy)],
                ['Stay up to', `${p.days} days`],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-0.5 truncate font-mono text-[14px] text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="justify-self-center">
            <Stamp top="UNITED ARAB" bottom="ENTRY PERMIT" date={fmtDate(p.enterBy).slice(0, 6).toUpperCase()} size={148} className="stamp-in" />
          </div>
        </div>
        <div className="perf mx-6" />
        <div className="flex items-end justify-between gap-4 px-6 pb-5 pt-4">
          <div className="flex h-10 items-end gap-[2px]" aria-hidden>
            {bars.map((b, i) => (
              <span key={i} className="block bg-fg" style={{ width: b, height: i % 4 === 0 ? 40 : 34 }} />
            ))}
          </div>
          <p className="max-w-[28ch] text-right text-[12px] leading-snug text-faint">Sandbox permit for demonstration. Not valid for travel.</p>
        </div>
      </div>
    </div>
  );
}

export function Checklist({ props }: CardProps<{ title: string; items: { label: string; note?: string }[] }>) {
  return (
    <CardShell eyebrow="Checklist" title={props.title}>
      <ul className="ledger">
        {props.items.map((it) => (
          <li key={it.label} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 size-[18px] shrink-0 rounded-md border border-line-strong" style={{ borderColor: 'var(--line-strong)' }} aria-hidden />
            <div className="min-w-0">
              <div className="text-[14.5px] text-fg">{it.label}</div>
              {it.note && <div className="text-[13px] text-muted">{it.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function InfoCard({ props }: CardProps<{ title: string; tone?: 'neutral' | 'ok' | 'warn'; bullets: string[]; footnote?: string }>) {
  return (
    <CardShell eyebrow="Answer" title={props.title} tone={props.tone === 'ok' ? 'brand' : 'default'}>
      <ul className="space-y-2 text-[14px] text-fg">
        {props.bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[9px] size-1 shrink-0 rounded-full bg-brand" aria-hidden />
            <span className="min-w-0 pretty">{b}</span>
          </li>
        ))}
      </ul>
      {props.footnote && <p className="mt-3 text-[12.5px] text-faint">{props.footnote}</p>}
    </CardShell>
  );
}

export function FeeBreakdown({ props }: CardProps<{ visa: VisaId; days: 30 | 60 }>) {
  const q = quote(props.visa, props.days);
  const rows: [string, string, string][] = [
    ['Government fee', 'Paid straight to the government, in the portal', aed(q.govAED, 2)],
    ['VAT 5% on the government fee', '', aed(q.govVatAED, 2)],
    ['Rihla service fee', 'Flat, for the filing', aed(q.serviceAED, 2)],
    ['VAT 5% on the service fee', '', aed(q.serviceVatAED, 2)],
  ];
  return (
    <CardShell eyebrow="Price" title="What you pay in total">
      <div className="ledger">
        {rows.map(([k, sub, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[14px] text-fg">{k}</div>
              {sub && <div className="text-[12.5px] text-faint">{sub}</div>}
            </div>
            <div className="shrink-0 font-mono text-[14px] tnum text-fg">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-end justify-between gap-4 border-t border-line-strong pt-3" style={{ borderColor: 'var(--line-strong)' }}>
        <div className="eyebrow">Total</div>
        <div className="font-display text-[32px] font-bold leading-none tracking-[-0.02em] tnum text-fg">{aed(q.totalAED, 2)}</div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12.5px] text-faint">
        <Spinner size={11} className="hidden" />
        Demo prices. Government fees are reported for early October 2026 and change.
      </p>
    </CardShell>
  );
}
