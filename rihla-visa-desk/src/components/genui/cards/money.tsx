import { useState } from 'react';
import { Check, TriangleAlert, Minus, Plus, X } from 'lucide-react';
import { CORRIDORS } from '@/agent/fixtures/corridors';
import { buildQuote } from '@/agent/fees';
import type { FeeQuoteData } from '@/agent/types';
import type { CardProps } from '../types';
import { CardShell, ResolvedLine } from '../Frame';
import { Pill } from '../../ui';
import { aed } from '@/lib/utils';

export function FeeQuote({ props, ctx }: CardProps<{ corridorId: 'uk-eta' | 'ca-eta' | 'us-b1b2' | 'etias'; travellers: number; serviceFeeAED: number; quote: FeeQuoteData }>) {
  const corridor = CORRIDORS[props.corridorId];
  const [fee, setFee] = useState(props.serviceFeeAED);
  const q = fee === props.serviceFeeAED ? props.quote : buildQuote(corridor, props.travellers, fee);
  const bump = (d: number) => {
    const next = Math.max(0, Math.min(2000, fee + d));
    setFee(next);
    ctx.setServiceFee(next);
  };
  return (
    <CardShell eyebrow="Quote in dirhams" title="What the client pays" right={<Pill tone="neutral">Payment link in sandbox</Pill>}>
      <div className="ledger">
        {q.lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[14px] text-fg">{l.label}</div>
              <div className="text-[12px] text-faint">
                {l.kind === 'government' ? 'Passed through at cost' : l.kind === 'tax' ? 'Applied to the service fee only' : 'Your fee'}
                {l.local ? ` · ${l.local}` : ''}
              </div>
            </div>
            <div className="shrink-0 font-mono text-[14px] tnum text-fg">{aed(l.aed)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-end justify-between gap-4 border-t border-line-strong pt-3" style={{ borderColor: 'var(--line-strong)' }}>
        <div className="eyebrow">Total</div>
        <div className="font-display text-[34px] font-medium leading-none tnum text-fg">{aed(q.totalAED)}</div>
      </div>

      {!ctx.readonly && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2.5">
          <label htmlFor={`fee-${props.corridorId}`} className="text-[13px] text-muted">
            Your service fee per traveller
          </label>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => bump(-10)} aria-label="Decrease fee by 10 dirhams">
              <Minus size={14} />
            </button>
            <output id={`fee-${props.corridorId}`} className="w-16 text-center font-mono text-[14px] tnum">
              {fee}
            </output>
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => bump(10)} aria-label="Increase fee by 10 dirhams">
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-[12px] text-faint">{q.rateNote}</p>
    </CardShell>
  );
}

export function ApprovalGate({
  props,
  ctx,
}: CardProps<{
  title: string;
  summary: { label: string; value: string }[];
  checks: { label: string; status: 'pass' | 'warn' }[];
  next: string[];
  boundaries: string[];
}>) {
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const resolved = props.resolved;
  const out = resolved?.outcome as { decision: 'approve' | 'changes'; note?: string } | undefined;
  const canAct = !!props.interruptId && !resolved && !ctx.readonly;

  return (
    <CardShell tone={resolved ? 'default' : 'brass'} eyebrow="Needs your approval" title={props.title} right={resolved ? <Pill tone="ok">Settled</Pill> : <Pill tone="brass">Waiting for you</Pill>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 @lg:grid-cols-3">
        {props.summary.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="eyebrow">{s.label}</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum text-fg">{s.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 ledger">
        {props.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 py-2 text-[14px] text-fg">
            {c.status === 'pass' ? <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />}
            <span>{c.label}</span>
          </li>
        ))}
      </ul>

      {!resolved && (
        <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
          <div>
            <div className="eyebrow mb-2">What happens next</div>
            <ol className="space-y-1.5 text-[13.5px] text-muted">
              {props.next.map((n, i) => (
                <li key={n} className="flex gap-2">
                  <span className="font-mono text-[12px] text-brass">{i + 1}.</span>
                  <span>{n}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="eyebrow mb-2">What the agent will not do</div>
            <ul className="space-y-1.5 text-[13.5px] text-muted">
              {props.boundaries.map((b) => (
                <li key={b} className="flex gap-2">
                  <X size={14} className="mt-[3px] shrink-0 text-crit" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-5">
        {resolved && out ? (
          <ResolvedLine by={resolved.by} text={out.decision === 'approve' ? 'Approved. The agent continued.' : `Asked for changes${out.note ? `: ${out.note}` : ''}`} reason={resolved.reason} />
        ) : (
          <>
            {props.autoReason && (
              <div className="mb-3 flex items-center gap-2 text-[12.5px] text-muted">
                <span className="relative inline-block size-2 rounded-full bg-brass ring-pulse" aria-hidden />
                Autopilot will approve this in a moment. {props.autoReason}
              </div>
            )}
            {changing && (
              <div className="mb-3">
                <label htmlFor="changes-note" className="eyebrow mb-1 block">
                  What should change
                </label>
                <textarea id="changes-note" className="field min-h-[72px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: use the Emirates ID spelling for the father" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={!canAct} onClick={() => props.interruptId && ctx.resolve(props.interruptId, { decision: 'approve' })}>
                Approve and continue
              </button>
              {!changing ? (
                <button type="button" className="btn btn-outline" disabled={!canAct} onClick={() => setChanging(true)}>
                  Request changes
                </button>
              ) : (
                <button type="button" className="btn btn-outline" disabled={!canAct} onClick={() => props.interruptId && ctx.resolve(props.interruptId, { decision: 'changes', note: note.trim() || undefined })}>
                  Send the change request
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
