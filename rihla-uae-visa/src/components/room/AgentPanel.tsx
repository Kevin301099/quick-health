import { useEffect, useRef, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { ArrowUp, Square } from 'lucide-react';
import { useStore } from '@/agent/store';
import { resolveAction, sendUserMessage, startRun, stopRun, isActive } from '@/agent/engine';
import { SUGGESTIONS } from '@/agent/router';
import { PRODUCTS, SLOTS } from '@/domain/visas';
import { Generated } from '../cards/registry';
import { Transcript } from './Transcript';
import { Pill } from '../ui';
import { clock, cn, formatBytes } from '@/lib/utils';

function Dock() {
  const pending = useStore((s) => s.pending[0]);
  const item = useStore((s) => (pending ? s.items.find((i) => i.id === pending.uiId) : undefined));
  return (
    <AnimatePresence initial={false}>
      {pending && item && item.kind === 'ui' && (
        <m.section
          key={pending.id}
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 0.9, 0.24, 1] }}
          className="@container relative z-10 mx-3 mb-3 flex max-h-[62%] min-h-0 flex-col overflow-hidden rounded-2xl border-2 bg-surface"
          style={{ borderColor: 'var(--attn)', boxShadow: 'var(--shadow-lift)' }}
          aria-label="Your turn"
        >
          <header className="flex items-center gap-2 bg-[var(--attn-wash)] px-4 py-2">
            <span className="relative size-2.5 rounded-full bg-attn ring-pulse ring-pulse-attn" aria-hidden />
            <span className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-attn">Your turn</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted">· {pending.title}</span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <Generated id={item.id} component={item.component} props={item.props} ready act={(o) => resolveAction(pending.id, o, 'you')} readonly={false} spec={false} />
          </div>
        </m.section>
      )}
    </AnimatePresence>
  );
}

function Activity() {
  const audit = useStore((s) => s.audit);
  return (
    <ul className="ledger px-5 py-2">
      {audit.length === 0 && <li className="py-6 text-center text-[13.5px] text-muted">Nothing yet. Every tool call and every choice you make is logged here.</li>}
      {audit.map((a) => (
        <li key={a.id} className="py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-faint">{clock(a.at)}</span>
            <Pill tone={a.actor === 'you' ? 'sun' : a.actor === 'portal' ? 'info' : 'brand'}>{a.actor === 'you' ? 'You' : a.actor === 'portal' ? 'Portal' : a.actor === 'agent' ? 'Rihla' : 'System'}</Pill>
          </div>
          <div className="mt-0.5 text-[13.5px] text-fg">{a.action}</div>
          {a.detail && <div className="text-[12.5px] text-muted">{a.detail}</div>}
        </li>
      ))}
    </ul>
  );
}

export function AgentPanel() {
  const items = useStore((s) => s.items);
  const run = useStore((s) => s.run.state);
  const pending = useStore((s) => s.pending);
  const files = useStore((s) => s.files);
  const answers = useStore((s) => s.answers);
  const [tab, setTab] = useState<'chat' | 'activity'>('chat');
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const last = items[items.length - 1];
  const lastLen = last && last.kind === 'text' ? last.text.length : 0;
  const active = isActive() && ['running', 'waiting', 'paused'].includes(run);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [items.length, lastLen, pending.length, last && last.kind === 'ui' ? last.ready : 0]);

  const send = (t: string) => {
    const v = t.trim();
    if (!v) return;
    stick.current = true;
    sendUserMessage(v);
    setText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-4 py-2" role="tablist" aria-label="Agent panel">
        {(['chat', 'activity'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn('rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors', tab === t ? 'bg-surface2 text-fg' : 'text-muted hover:text-fg')}>
            {t === 'chat' ? 'Conversation' : 'Activity'}
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        onScroll={() => {
          const el = scroller.current;
          if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        }}
        className="@container min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-label="Agent conversation"
      >
        {tab === 'activity' ? (
          <Activity />
        ) : (
          <div className="px-5 py-5">
            {run === 'idle' && items.length === 0 ? (
              <div className="card p-5">
                <h2 className="font-display text-[20px] font-semibold">Ready to file</h2>
                <p className="mt-1 text-[14px] text-muted">I have {Object.keys(files).length} documents for your {PRODUCTS[answers.visa].name.toLowerCase()}.</p>
                <ul className="ledger mt-3">
                  {PRODUCTS[answers.visa].slots.map((s) => (
                    <li key={s} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                      <span className="text-fg">{SLOTS[s].label}</span>
                      <span className="truncate font-mono text-[12px] text-faint">{files[s] ? `${files[s]!.name} · ${formatBytes(files[s]!.bytes)}` : 'Missing'}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-primary mt-4" disabled={!Object.keys(files).length} onClick={startRun}>
                  Start filing
                </button>
              </div>
            ) : (
              <Transcript items={items} />
            )}
          </div>
        )}
      </div>

      <Dock />

      <div className="border-t border-line px-4 pb-3 pt-3">
        {pending.length === 0 && tab === 'chat' && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <button key={s} role="listitem" type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-line px-3 py-1 text-[13px] text-muted transition-colors hover:border-brand hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() && active) stopRun();
            else send(text);
          }}
          className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-1.5 transition-colors focus-within:border-brand"
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
            placeholder={pending.length ? 'Ask a question while you decide' : 'Ask about your application'}
            className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-[14.5px] text-fg outline-none placeholder:text-faint"
          />
          <button type="submit" className={cn('btn !min-h-[38px] !px-3', !text.trim() && active ? 'btn-outline' : 'btn-primary')} aria-label={!text.trim() && active ? 'Stop the agent' : 'Send'} disabled={!text.trim() && !active}>
            {!text.trim() && active ? <Square size={14} /> : <ArrowUp size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
