import { Plus } from 'lucide-react';
import type { CaseRuntime, CaseStatus } from '@/agent/types';
import { CORRIDORS } from '@/agent/fixtures/corridors';
import { cn } from '@/lib/utils';
import { Pill } from '../ui';

export const STATUS_LABEL: Record<CaseStatus, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'info' | 'brass' }> = {
  new: { label: 'Not started', tone: 'neutral' },
  running: { label: 'Agent working', tone: 'brass' },
  needs_you: { label: 'Needs you', tone: 'warn' },
  waiting: { label: 'Waiting', tone: 'info' },
  paused: { label: 'Paused', tone: 'neutral' },
  done: { label: 'Complete', tone: 'ok' },
  watching: { label: 'Watching', tone: 'info' },
};

export function CaseList({
  cases,
  order,
  activeId,
  onSelect,
  onNew,
}: {
  cases: Record<string, CaseRuntime>;
  order: string[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="eyebrow">Case desk</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={onNew}>
          <Plus size={14} aria-hidden /> New case
        </button>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {order.map((id) => {
          const c = cases[id];
          const corridor = CORRIDORS[c.meta.corridorId];
          const done = c.plan.filter((p) => p.status === 'done').length;
          const st = STATUS_LABEL[c.status];
          const active = id === activeId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'block w-full rounded-xl border px-3.5 py-3 text-left transition-colors',
                  active ? 'border-brass/50 bg-surface2' : 'border-transparent hover:bg-surface',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-faint">{id}</span>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </div>
                <div className="mt-1.5 text-[14px] font-medium leading-snug text-fg">{c.meta.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                  <span>{corridor.short}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {c.meta.applicantIds.length} traveller{c.meta.applicantIds.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-surface3" aria-hidden>
                  <div className="h-full w-full origin-left rounded-full bg-brass transition-transform duration-500" style={{ transform: `scaleX(${done / c.plan.length})` }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line px-4 py-3 text-[12px] leading-snug text-faint">
        Demo sandbox. Every person, number and message is fictional, and nothing is submitted to a government.
      </div>
    </div>
  );
}
