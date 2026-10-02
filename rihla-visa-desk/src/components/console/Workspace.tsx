import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Pause, Play, RotateCcw, Square, MessageCircle, Mail } from 'lucide-react';
import type { CaseRuntime } from '@/agent/types';
import { CORRIDORS } from '@/agent/fixtures/corridors';
import { LEVELS } from '@/agent/policy';
import { useStore } from '@/agent/store';
import { pauseRun, resumeRun, sendUserMessage, startRun, stopRun } from '@/agent/engine';
import { SUGGESTIONS } from '@/agent/router';
import type { GenUICtx } from '../genui/types';
import { Transcript } from './Transcript';
import { STATUS_LABEL } from './CaseList';
import { Pill } from '../ui';
import { cn } from '@/lib/utils';

export function Workspace({ rt, ctx }: { rt: CaseRuntime; ctx: GenUICtx }) {
  const autonomy = useStore((s) => s.settings.autonomy);
  const setSettings = useStore((s) => s.setSettings);
  const reset = useStore((s) => s.reset);
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const corridor = CORRIDORS[rt.meta.corridorId];
  const st = STATUS_LABEL[rt.status];
  const state = rt.run.state;
  const active = state === 'running' || state === 'waiting' || state === 'paused';
  const last = rt.items[rt.items.length - 1];
  const lastLen = last && last.kind === 'text' ? last.text.length : 0;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [rt.items.length, lastLen, last && last.kind === 'ui' ? last.ready : 0]);

  useEffect(() => {
    stick.current = true;
    scroller.current?.scrollTo({ top: 0 });
  }, [rt.meta.id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  };

  const send = (t: string) => {
    const v = t.trim();
    if (!v) return;
    stick.current = true;
    sendUserMessage(rt.meta.id, v);
    setText('');
  };

  const Channel = rt.meta.channel === 'Email' ? Mail : MessageCircle;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {/* header */}
      <header className="border-b border-line px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-faint">{rt.meta.id}</span>
              <Pill tone="brass">{corridor.short}</Pill>
              <Pill tone={st.tone}>{st.label}</Pill>
            </div>
            <h1 className="mt-1 text-[19px] font-semibold leading-tight text-fg">{rt.meta.title}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {state === 'idle' && (
              <button type="button" className="btn btn-primary" onClick={() => startRun(rt.meta.id)}>
                <Play size={15} aria-hidden /> Run the agent
              </button>
            )}
            {(state === 'running' || state === 'waiting') && (
              <button type="button" className="btn btn-outline" onClick={() => pauseRun(rt.meta.id)}>
                <Pause size={15} aria-hidden /> Pause
              </button>
            )}
            {state === 'paused' && (
              <button type="button" className="btn btn-primary" onClick={() => resumeRun(rt.meta.id)}>
                <Play size={15} aria-hidden /> Resume
              </button>
            )}
            {active && (
              <button type="button" className="btn btn-ghost" onClick={() => stopRun(rt.meta.id)}>
                <Square size={14} aria-hidden /> Stop
              </button>
            )}
            {(state === 'done' || state === 'stopped') && (
              <button type="button" className="btn btn-outline" onClick={() => startRun(rt.meta.id)}>
                <RotateCcw size={15} aria-hidden /> Run again
              </button>
            )}
            {state === 'idle' && rt.items.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => reset(rt.meta.id)}>
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="eyebrow">Autonomy</span>
          <div role="group" aria-label="Autonomy level" className="inline-flex rounded-xl border border-line bg-raised p-0.5">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                aria-pressed={autonomy === l.level}
                title={l.line}
                onClick={() => setSettings({ autonomy: l.level })}
                className={cn(
                  'rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors',
                  autonomy === l.level ? 'bg-brass text-[var(--on-brass)]' : 'text-muted hover:text-fg',
                )}
              >
                <span className="font-mono text-[11px] opacity-70">L{l.level}</span> {l.name}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-faint">{LEVELS[autonomy - 1].line}</span>
        </div>
      </header>

      {/* transcript */}
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-label="Agent conversation">
        <div className="mx-auto flex max-w-[860px] flex-col gap-4">
          <div className="rounded-2xl rounded-tl-md bg-surface p-4" style={{ border: '1px solid var(--line)' }}>
            <div className="mb-1.5 flex items-center gap-2 text-[12px] text-faint">
              <Channel size={13} aria-hidden />
              <span>
                Inbox · {rt.meta.client.name} · {rt.meta.channel} · {rt.meta.received}
              </span>
            </div>
            <p className="text-[14.5px] leading-relaxed text-fg">{rt.meta.message}</p>
          </div>

          {rt.items.length === 0 && (
            <div className="surface p-5">
              <h2 className="font-display text-[26px] italic leading-tight text-fg">{corridor.name}</h2>
              <p className="mt-1 max-w-[56ch] text-[14px] text-muted">{corridor.headline}</p>
              <ol className="mt-4 grid gap-x-6 sm:grid-cols-2">
                {rt.plan.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13.5px]">
                    <span className="text-fg">{p.title}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{p.owner === 'agent' ? 'Agent' : p.owner === 'you' ? 'You' : 'Client'}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary" onClick={() => startRun(rt.meta.id)}>
                  <Play size={15} aria-hidden /> Run the agent
                </button>
                <span className="text-[12.5px] text-faint">Pick an autonomy level above first. You can change it while the agent runs.</span>
              </div>
            </div>
          )}

          <Transcript items={rt.items} ctx={ctx} />
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-line bg-bg px-4 pb-3 pt-3 sm:px-6">
        <div className="mx-auto max-w-[860px]">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <button key={s} role="listitem" type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-line px-3 py-1 text-[12.5px] text-muted transition-colors hover:border-brass hover:text-fg">
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() && active) stopRun(rt.meta.id);
              else send(text);
            }}
            className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 transition-colors focus-within:border-brass"
            style={{ borderColor: undefined }}
          >
            <label htmlFor="composer" className="sr-only">
              Ask the agent
            </label>
            <textarea
              id="composer"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder={active ? 'Ask anything. Answered at the next checkpoint' : 'Ask about this case'}
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[14.5px] text-fg outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              className={cn('btn !min-h-[40px] !px-3', !text.trim() && active ? 'btn-outline' : 'btn-primary')}
              aria-label={!text.trim() && active ? 'Stop the agent' : 'Send'}
              disabled={!text.trim() && !active}
            >
              {!text.trim() && active ? <Square size={15} /> : <ArrowUp size={17} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
