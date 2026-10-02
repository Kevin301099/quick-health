import { Check } from 'lucide-react';
import type { Phase } from '@/agent/types';
import { cn } from '@/lib/utils';

/** The journey in six stops, drawn like a flight path. */
export function Ribbon({ phases }: { phases: Phase[] }) {
  return (
    <ol className="flex items-center gap-0 overflow-x-auto px-5 py-3" aria-label="Progress">
      {phases.map((p, i) => (
        <li key={p.id} className="flex min-w-0 items-center">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'relative grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors',
                p.status === 'done' && 'bg-brand text-[var(--on-brand)]',
                p.status === 'running' && 'border-2 border-brand bg-surface text-brand',
                p.status === 'needs_you' && 'bg-attn text-[var(--on-attn)]',
                p.status === 'pending' && 'border border-line-strong bg-surface text-faint',
              )}
              style={p.status === 'pending' ? { borderColor: 'var(--line-strong)' } : undefined}
            >
              {p.status === 'done' ? <Check size={13} strokeWidth={3} aria-label="Done" /> : i + 1}
              {(p.status === 'running' || p.status === 'needs_you') && <span className={cn('absolute inset-0 rounded-full ring-pulse', p.status === 'needs_you' && 'ring-pulse-attn')} aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className={cn('block whitespace-nowrap text-[13px] font-medium leading-tight', p.status === 'pending' ? 'text-faint' : 'text-fg')}>{p.title}</span>
              {p.status === 'needs_you' && <span className="block text-[11.5px] font-semibold leading-tight text-attn">Your turn</span>}
              {p.status === 'running' && p.note && <span className="block max-w-[170px] truncate text-[11.5px] leading-tight text-muted">{p.note}</span>}
            </span>
          </div>
          {i < phases.length - 1 && <span className="mx-3 h-px w-8 shrink-0 border-t-2 border-dashed" style={{ borderColor: p.status === 'done' ? 'var(--brand)' : 'var(--line-strong)' }} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
