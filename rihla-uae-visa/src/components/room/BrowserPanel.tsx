import { Lock, MousePointer2, Hand, Pause } from 'lucide-react';
import { useStore } from '@/agent/store';
import { handBack, takeControl } from '@/agent/engine';
import { ConnectedPortal } from '@/portal/ConnectedPortal';
import { Pill } from '../ui';
import { cn } from '@/lib/utils';

export function BrowserPanel() {
  const portal = useStore((s) => s.portal);
  const run = useStore((s) => s.run.state);
  const pending = useStore((s) => s.pending);
  const waiting = pending.length > 0;
  const user = portal.controller === 'user';
  const idle = run === 'idle';

  const status = idle
    ? { tone: 'neutral' as const, label: 'Idle', icon: null }
    : user && run === 'paused'
      ? { tone: 'ok' as const, label: 'You are in control', icon: <Hand size={13} aria-hidden /> }
      : user
        ? { tone: 'attn' as const, label: 'Your turn in the portal', icon: <Hand size={13} aria-hidden /> }
        : waiting
          ? { tone: 'attn' as const, label: 'Waiting for you', icon: <Pause size={13} aria-hidden /> }
          : run === 'paused'
            ? { tone: 'neutral' as const, label: 'Paused', icon: <Pause size={13} aria-hidden /> }
            : run === 'done'
              ? { tone: 'ok' as const, label: 'Finished', icon: null }
              : { tone: 'brand' as const, label: 'Rihla is driving', icon: <MousePointer2 size={13} aria-hidden /> };

  return (
    <div className="flex h-full min-h-0 flex-col p-4 pl-0 max-[1023px]:p-4">
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-surface transition-colors', user ? 'border-brand' : 'border-line')} style={{ boxShadow: user ? '0 0 0 3px var(--brand-wash)' : 'var(--shadow-soft)' }}>
        {/* browser chrome */}
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-2" style={{ background: 'var(--surface-2)' }}>
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-surface3" />
            <span className="size-2.5 rounded-full bg-surface3" />
            <span className="size-2.5 rounded-full bg-surface3" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-[12.5px] text-muted" aria-label="Address bar">
            <Lock size={12} className="shrink-0 text-ok" aria-hidden />
            <span className="truncate font-mono">{portal.url}</span>
          </div>
          <Pill tone={status.tone}>
            {status.icon}
            {status.label}
          </Pill>
          {user ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={handBack}>
              Hand back to Rihla
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={takeControl} disabled={idle || run === 'done' || run === 'stopped'}>
              <Hand size={14} aria-hidden /> Take control
            </button>
          )}
        </div>

        {/* what is going on, in words */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-1.5 text-[12.5px] text-muted" aria-live="polite">
          <span className={cn('size-1.5 rounded-full', user ? 'bg-brand' : waiting ? 'bg-attn' : 'bg-brand')} aria-hidden />
          {portal.note ?? (idle ? 'The sandbox portal opens here when you start filing.' : user ? 'The portal is yours.' : waiting ? 'Waiting for you. Details on the left.' : 'Watching the application.')}
        </div>

        <div className="min-h-0 flex-1">
          <ConnectedPortal />
        </div>
      </div>
    </div>
  );
}
