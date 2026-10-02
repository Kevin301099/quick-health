import { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react';
import { useStore } from '@/agent/store';
import { pauseRun, resumeRun, startRun, stopRun } from '@/agent/engine';
import { PRODUCTS } from '@/domain/visas';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Pill, Wordmark } from '../ui';
import { AgentPanel } from './AgentPanel';
import { BrowserPanel } from './BrowserPanel';
import { Inbox } from './Inbox';
import { Ribbon } from './Ribbon';

export function Room({ onExit, onRestart }: { onExit: () => void; onRestart: () => void }) {
  const phases = useStore((s) => s.phases);
  const run = useStore((s) => s.run.state);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const answers = useStore((s) => s.answers);
  const profile = useStore((s) => s.profile);
  const { theme, toggle } = useTheme();
  const [pane, setPane] = useState<'agent' | 'browser'>('agent');
  const name = `${profile.given} ${profile.surname}`.trim();
  const status =
    run === 'running' ? { tone: 'brand' as const, label: 'Filing' } : run === 'waiting' ? { tone: 'attn' as const, label: 'Needs you' } : run === 'paused' ? { tone: 'neutral' as const, label: 'Paused' } : run === 'done' ? { tone: 'ok' as const, label: 'Finished' } : run === 'stopped' ? { tone: 'neutral' as const, label: 'Stopped' } : { tone: 'neutral' as const, label: 'Ready' };

  useEffect(() => {
    document.documentElement.classList.add('app-mode');
    return () => document.documentElement.classList.remove('app-mode');
  }, []);

  // A person who needs to act in the portal should see it.
  const pending = useStore((s) => s.pending.length);
  const controller = useStore((s) => s.portal.controller);
  useEffect(() => {
    if (controller === 'user') setPane('browser');
  }, [controller]);
  useEffect(() => {
    if (pending > 0 && controller !== 'user') setPane('agent');
  }, [pending, controller]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={onExit} className="rounded-lg" aria-label="Back to the Rihla site">
            <Wordmark />
          </button>
          <span className="hidden h-6 w-px bg-line-strong md:block" style={{ background: 'var(--line-strong)' }} aria-hidden />
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-[14px] font-semibold text-fg">
              {PRODUCTS[answers.visa].name} · {answers.days} days
            </div>
            <div className="truncate text-[12.5px] text-muted">{name || 'Your application'}</div>
          </div>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {(run === 'running' || run === 'waiting') && (
            <button type="button" className="btn btn-outline btn-sm" onClick={pauseRun}>
              <Pause size={14} aria-hidden /> Pause
            </button>
          )}
          {run === 'paused' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={resumeRun}>
              <Play size={14} aria-hidden /> Resume
            </button>
          )}
          {(run === 'done' || run === 'stopped') && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => startRun()}>
              <RotateCcw size={14} aria-hidden /> File again
            </button>
          )}
          <div role="group" aria-label="Demo speed" className="inline-flex shrink-0 rounded-lg border border-line bg-bg p-0.5">
            {([1, 2, 4] as const).map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={cn('rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors', speed === s ? 'bg-surface text-fg' : 'text-faint hover:text-fg')} style={speed === s ? { boxShadow: 'var(--shadow-soft)' } : undefined}>
                {s}×
              </button>
            ))}
          </div>
          <Inbox />
          <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { stopRun(); onRestart(); }}>
            <ArrowLeft size={14} aria-hidden /> <span className="hidden sm:inline">Start over</span>
          </button>
        </div>
      </header>

      <div className="border-b border-line bg-surface">
        <Ribbon phases={phases} />
      </div>

      <div className="flex border-b border-line bg-surface min-[1024px]:hidden" role="tablist" aria-label="Panels">
        {(['agent', 'browser'] as const).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} type="button" onClick={() => setPane(p)} className={cn('flex-1 py-2.5 text-[14px] font-medium transition-colors', pane === p ? 'border-b-2 border-brand text-fg' : 'text-muted')}>
            {p === 'agent' ? 'Rihla' : 'Browser'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 min-[1024px]:grid-cols-[minmax(400px,470px)_minmax(0,1fr)]">
        <section className={cn('min-h-0 min-w-0 border-r border-line bg-bg', pane === 'agent' ? 'block' : 'hidden', 'min-[1024px]:block')} aria-label="Rihla agent">
          <AgentPanel />
        </section>
        <section className={cn('min-h-0 min-w-0', pane === 'browser' ? 'block' : 'hidden', 'min-[1024px]:block')} aria-label="Browser">
          <BrowserPanel />
        </section>
      </div>
    </div>
  );
}
