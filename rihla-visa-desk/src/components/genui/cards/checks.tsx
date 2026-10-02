import { Check, ArrowRight, Pause } from 'lucide-react';
import type { Conflict } from '@/agent/types';
import type { AutoFix } from '@/agent/checks';
import type { CardProps } from '../types';
import { CardShell, ResolvedLine } from '../Frame';
import { Pill } from '../../ui';

export function ChecksReport({ props }: CardProps<{ passes: string[]; flagged: number; fixed: AutoFix[]; minors: number }>) {
  return (
    <CardShell
      eyebrow="Cross-checks"
      title="What agrees across the file"
      right={<Pill tone={props.flagged ? 'warn' : 'ok'}>{props.flagged ? `${props.flagged} flagged` : 'All clear'}</Pill>}
    >
      <ul className="ledger">
        {props.passes.map((p) => (
          <li key={p} className="flex items-start gap-3 py-2 text-[14px] text-fg">
            <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
        {props.minors > 0 && (
          <li className="flex items-start gap-3 py-2 text-[14px] text-fg">
            <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            <span>
              {props.minors} traveller{props.minors === 1 ? ' is a child' : 's are children'}. Declarations go to a parent.
            </span>
          </li>
        )}
      </ul>
      {props.fixed.length > 0 && (
        <div className="mt-3 rounded-xl bg-surface2 p-3">
          <div className="eyebrow mb-2">Re-read and corrected by the agent</div>
          {props.fixed.map((f, i) => (
            <div key={i} className="text-[13px] text-muted">
              <span className="text-fg">
                {f.doc} · {f.field}
              </span>
              : <span className="font-mono text-warn">{f.from}</span> to <span className="font-mono text-ok">{f.to}</span>. {f.how}.
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

const RISK: Record<string, { tone: 'ok' | 'warn' | 'crit'; label: string }> = {
  low: { tone: 'ok', label: 'Low risk' },
  medium: { tone: 'warn', label: 'Medium risk' },
  high: { tone: 'crit', label: 'High risk' },
};

export function ConflictResolver({ props, ctx }: CardProps<{ conflict: Conflict }>) {
  const c = props.conflict;
  const risk = RISK[c.risk];
  const resolved = props.resolved;
  const chosen = resolved ? c.options.find((o) => o.id === (resolved.outcome as { option: string }).option) : null;
  const canAct = !!props.interruptId && !resolved && !ctx.readonly;
  return (
    <CardShell
      eyebrow={`Flag · rule ${c.rule}`}
      title={c.title}
      right={<Pill tone={risk.tone}>{risk.label}</Pill>}
      tone={c.risk === 'high' ? 'warn' : 'default'}
    >
      <p className="max-w-[64ch] text-[14px] text-muted pretty">{c.detail}</p>

      <div className="mt-3 flex flex-col items-stretch gap-2 @lg:flex-row @lg:items-center">
        {c.evidence.map((e, i) => (
          <div key={i} className="contents">
            {i > 0 && (
              <span className="self-center px-1 font-mono text-[13px] text-faint" aria-label="differs from">
                ≠
              </span>
            )}
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3 py-2">
              <div className="eyebrow">
                {e.doc} · {e.field}
              </div>
              <div className="mt-0.5 break-words font-mono text-[14px] text-fg">{e.value}</div>
            </div>
          </div>
        ))}
      </div>

      {resolved && chosen ? (
        <div className="mt-4">
          <ResolvedLine by={resolved.by} text={chosen.label} reason={resolved.reason} />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {props.autoReason && !resolved && (
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <span className="relative inline-block size-2 rounded-full bg-brass ring-pulse" aria-hidden />
              Your autonomy level will settle this with the recommended option in a moment. {props.autoReason}
            </div>
          )}
          <ul className="ledger rounded-xl border border-line">
            {c.options.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 px-3 py-2.5 @lg:flex-row @lg:items-center @lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-fg">
                    {o.label}
                    {o.recommended && <Pill tone="brass">Recommended</Pill>}
                  </div>
                  <div className="text-[13px] text-muted">{o.detail}</div>
                </div>
                <button
                  type="button"
                  disabled={!canAct}
                  className={o.recommended ? 'btn btn-primary btn-sm shrink-0' : 'btn btn-outline btn-sm shrink-0'}
                  onClick={() => props.interruptId && ctx.resolve(props.interruptId, { option: o.id })}
                >
                  Use this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardShell>
  );
}

export function Checkpoint({ props, ctx }: CardProps<{ title: string; detail: string; cta: string }>) {
  const resolved = props.resolved;
  return (
    <CardShell tone="brass">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="flex items-start gap-3">
          <Pause size={18} className="mt-0.5 text-brass" aria-hidden />
          <div>
            <div className="text-[15px] font-semibold text-fg">{props.title}</div>
            <div className="text-[13.5px] text-muted">{props.detail}</div>
          </div>
        </div>
        {resolved ? (
          <Pill tone="ok">Continued</Pill>
        ) : (
          <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={ctx.readonly} onClick={() => props.interruptId && ctx.resolve(props.interruptId, { decision: 'continue' })}>
            {props.cta} <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </div>
    </CardShell>
  );
}
