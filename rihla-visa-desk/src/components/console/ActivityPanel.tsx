import { Check, Clock, Hand, Minus } from 'lucide-react';
import type { AuditActor, CaseRuntime, PlanStep } from '@/agent/types';
import { Pill, Spinner } from '../ui';
import { cn, clock } from '@/lib/utils';

function StepIcon({ s }: { s: PlanStep['status'] }) {
  if (s === 'done') return <Check size={14} className="text-ok" aria-label="Done" />;
  if (s === 'running') return <Spinner size={14} className="text-brass" />;
  if (s === 'needs_you') return <Hand size={14} className="text-warn" aria-label="Needs you" />;
  if (s === 'waiting') return <Clock size={14} className="text-info" aria-label="Waiting" />;
  if (s === 'skipped') return <Minus size={14} className="text-faint" aria-label="Skipped" />;
  return <span className="size-[11px] rounded-full border border-line-strong" style={{ borderColor: 'var(--line-strong)' }} aria-label="Pending" />;
}

const OWNER: Record<PlanStep['owner'], string> = { agent: 'Agent', you: 'You', client: 'Client' };

const ACTOR: Record<AuditActor, { label: string; tone: 'brass' | 'neutral' | 'info' | 'warn' }> = {
  agent: { label: 'Agent', tone: 'brass' },
  human: { label: 'You', tone: 'neutral' },
  client: { label: 'Client', tone: 'info' },
  system: { label: 'System', tone: 'neutral' },
};

export function ActivityPanel({ rt, onJump }: { rt: CaseRuntime; onJump: (itemId: string) => void }) {
  const { plan, pending, audit, data } = rt;
  const total = data.stats.agentTasks + data.stats.humanTasks + data.stats.clientTasks;
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4">
      <section aria-label="Plan">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="eyebrow">Plan</h2>
          <span className="font-mono text-[11px] text-faint">
            {plan.filter((p) => p.status === 'done').length}/{plan.length}
          </span>
        </div>
        <ol className="space-y-0.5">
          {plan.map((p) => (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors',
                p.status === 'running' && 'bg-surface2',
                p.status === 'needs_you' && 'bg-[var(--warn-wash)]',
                p.status === 'waiting' && 'bg-[var(--info-wash)]',
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <StepIcon s={p.status} />
              </span>
              <span className={cn('min-w-0 flex-1 text-[13.5px]', p.status === 'pending' ? 'text-faint' : 'text-fg')}>{p.title}</span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{OWNER[p.owner]}</span>
            </li>
          ))}
        </ol>
      </section>

      {pending.length > 0 && (
        <section aria-label="Needs you" className="rounded-xl border border-warn/40 bg-[var(--warn-wash)] p-3">
          <h2 className="eyebrow mb-2 !text-warn">{pending.some((p) => p.kind === 'applicant') ? 'Waiting' : 'Needs you'}</h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-[13px] text-fg">{p.title}</span>
                <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => onJump(p.itemId)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Who did what">
        <h2 className="eyebrow mb-2">Who did what</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Agent', data.stats.agentTasks],
            ['You', data.stats.humanTasks],
            ['Client', data.stats.clientTasks],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-surface2 px-3 py-2">
              <div className="font-display text-[24px] leading-none tnum text-fg">{v}</div>
              <div className="mt-1 text-[12px] text-muted">{k}</div>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface3" aria-hidden>
            <span className="bg-brass" style={{ width: `${(data.stats.agentTasks / total) * 100}%` }} />
            <span className="bg-fg" style={{ width: `${(data.stats.humanTasks / total) * 100}%`, opacity: 0.6 }} />
            <span className="bg-info" style={{ width: `${(data.stats.clientTasks / total) * 100}%` }} />
          </div>
        )}
      </section>

      <section aria-label="Audit trail" className="min-h-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="eyebrow">Audit trail</h2>
          <span className="font-mono text-[11px] text-faint">{audit.length} entries</span>
        </div>
        <ul className="ledger">
          {audit.slice(0, 60).map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-faint">{clock(a.at)}</span>
                <Pill tone={ACTOR[a.actor].tone} className="!px-2 !py-0 !text-[11px]">
                  {ACTOR[a.actor].label}
                </Pill>
              </div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-fg">{a.action}</div>
              {a.detail && <div className="text-[12px] leading-snug text-faint">{a.detail}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
