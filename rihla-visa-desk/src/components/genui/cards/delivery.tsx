import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Radar, Send, Smartphone, Lock } from 'lucide-react';
import { useStore } from '@/agent/store';
import type { CardProps } from '../types';
import { CardShell, ResolvedLine } from '../Frame';
import { Pill, Spinner } from '../../ui';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------ applicant handoff */

export function ApplicantHandoff({
  props,
  ctx,
}: CardProps<{ client: string; phone: string; en: string; ar: string; title: string; detail: string; steps: string[] }>) {
  const speed = useStore((s) => s.settings.speed);
  const [phase, setPhase] = useState(-1); // -1 idle, 0..n-1 steps running, n complete
  const resolved = props.resolved;
  const n = props.steps.length;
  const started = useRef(false);

  const run = (by: 'client' | 'auto') => {
    if (started.current) return;
    started.current = true;
    let i = 0;
    setPhase(0);
    const t = setInterval(() => {
      i += 1;
      setPhase(i);
      if (i >= n) {
        clearInterval(t);
        if (by === 'client' && props.interruptId) ctx.resolve(props.interruptId, { done: true }, 'client');
      }
    }, Math.max(250, 820 / speed));
  };

  // Autopilot simulates the client: animate the phone in step with the agent.
  useEffect(() => {
    if (props.autoReason && !resolved && !ctx.readonly) run('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = !!resolved || phase >= n;
  const shown = resolved ? n : phase;

  return (
    <CardShell eyebrow="Applicant-only step" title={props.title} right={<Pill tone={done ? 'ok' : 'info'}>{done ? 'Confirmed' : 'Waiting for the client'}</Pill>}>
      <div className="grid gap-5 @2xl:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <p className="max-w-[56ch] text-[14px] text-muted pretty">{props.detail}</p>
          <div className="space-y-2">
            <div className="rounded-2xl rounded-tl-md bg-surface2 p-3 text-[13.5px] leading-relaxed text-fg">
              <div className="eyebrow mb-1">WhatsApp · English</div>
              {props.en}
            </div>
            <div dir="rtl" className="rounded-2xl rounded-tr-md bg-surface2 p-3 font-arabic text-[16px] leading-[1.9] text-fg">
              <div className="eyebrow mb-1 text-right" dir="ltr">
                WhatsApp · العربية
              </div>
              {props.ar}
            </div>
          </div>
          {resolved ? (
            <ResolvedLine by={resolved.by === 'agent' ? 'client' : resolved.by} text="Client completed the secure link (simulated)." reason={resolved.reason} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" disabled={ctx.readonly || phase >= 0} onClick={() => run('client')}>
                <Smartphone size={15} aria-hidden /> Simulate the client
              </button>
              <span className="text-[12.5px] text-faint">{props.autoReason ?? 'In production the client does this on their own phone.'}</span>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="mx-auto w-[216px] shrink-0 rounded-[30px] border-[6px] border-surface3 bg-raised p-3" aria-label="What the client sees">
          <div className="mb-3 flex items-center justify-between text-[11px] text-faint">
            <span className="font-mono">rihla.example</span>
            <Lock size={10} aria-hidden />
          </div>
          <div className="mb-3 text-[13px] font-semibold text-fg">Gulf Horizon Travel</div>
          <ol className="space-y-2">
            {props.steps.map((s, i) => {
              const state = shown > i ? 'done' : shown === i ? 'active' : 'todo';
              return (
                <li key={s} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11.5px] leading-tight transition-colors', state === 'active' ? 'border-brass bg-[var(--brass-wash)] text-fg' : state === 'done' ? 'border-line text-muted' : 'border-line text-faint')}>
                  <span className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px]', state === 'done' ? 'bg-ok text-bg' : 'bg-surface3 text-faint')}>
                    {state === 'done' ? <Check size={10} /> : i + 1}
                  </span>
                  {s}
                </li>
              );
            })}
          </ol>
          <div className={cn('mt-3 rounded-lg px-2.5 py-2 text-center text-[11.5px] font-medium transition-colors', done ? 'bg-ok/20 text-ok' : 'bg-surface3 text-faint')}>{done ? 'All done. Thank you.' : 'Complete each step'}</div>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------ submission receipt */

export function SubmissionReceipt({ props }: CardProps<{ mode: 'sandbox' | 'staged'; portal: string; rows: { name: string; ref: string; at: string; status: string }[]; note: string }>) {
  return (
    <CardShell
      eyebrow={props.mode === 'sandbox' ? 'Submission · demo sandbox' : 'File staged'}
      title={props.mode === 'sandbox' ? `Sent to ${props.portal}` : 'Interview file assembled'}
      right={<Pill tone="warn">{props.mode === 'sandbox' ? 'Sandbox. Nothing live.' : 'Not submitted by Rihla'}</Pill>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[13.5px]">
          <thead>
            <tr className="eyebrow">
              <th className="py-2 pr-4 font-normal">Traveller</th>
              <th className="py-2 pr-4 font-normal">Reference</th>
              <th className="py-2 pr-4 font-normal">Time</th>
              <th className="py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="ledger [&>tr]:border-t [&>tr]:border-line">
            {props.rows.map((r) => (
              <tr key={r.ref}>
                <td className="py-2.5 pr-4 text-fg">{r.name}</td>
                <td className="py-2.5 pr-4 font-mono text-[12.5px] text-brasshi">{r.ref}</td>
                <td className="py-2.5 pr-4 font-mono text-[12.5px] text-muted">{r.at}</td>
                <td className="py-2.5">
                  <Pill tone="ok">{r.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-faint">{props.note}</p>
    </CardShell>
  );
}

/* ------------------------------------------------------------ status timeline */

export function StatusTimeline({
  props,
}: CardProps<{ steps: { label: string; detail: string; status: 'done' | 'active' | 'pending'; at?: string }[]; notes?: { name: string; outcome: string }[]; clockNote: string }>) {
  return (
    <CardShell eyebrow="Tracking" title="Where the case stands">
      <ol className="relative">
        {props.steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-4 pb-5 last:pb-0">
            {i < props.steps.length - 1 && (
              <span className="absolute left-[9px] top-5 h-[calc(100%-12px)] w-px origin-top bg-line-strong" style={{ background: s.status === 'done' ? 'var(--brass)' : 'var(--line-strong)' }} aria-hidden />
            )}
            <span className="relative mt-0.5 flex size-[19px] shrink-0 items-center justify-center">
              {s.status === 'done' ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-[19px] items-center justify-center rounded-full bg-brass text-[var(--on-brass)]">
                  <Check size={12} strokeWidth={3} />
                </motion.span>
              ) : s.status === 'active' ? (
                <span className="relative flex size-[19px] items-center justify-center rounded-full border-2 border-brass ring-pulse" />
              ) : (
                <span className="size-[19px] rounded-full border border-line-strong" style={{ borderColor: 'var(--line-strong)' }} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={cn('text-[14.5px] font-medium', s.status === 'pending' ? 'text-faint' : 'text-fg')}>{s.label}</span>
                {s.at && <span className="font-mono text-[11.5px] text-faint">{s.at}</span>}
              </div>
              <div className="text-[13px] text-muted">{s.detail}</div>
              {s.label === 'Decision' && props.notes && props.notes.length > 0 && (
                <ul className="mt-2 ledger rounded-xl border border-line px-3">
                  {props.notes.map((n) => (
                    <li key={n.name} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-[13px]">
                      <span className="text-fg">{n.name}</span>
                      <span className="text-ok">{n.outcome}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12px] text-faint">{props.clockNote}</p>
    </CardShell>
  );
}

/* ------------------------------------------------------------ launch watch */

export function LaunchWatch({ props }: CardProps<{ expected: string; ready: number; sources: { domain: string; status: string; checked: string }[]; plan: string[] }>) {
  return (
    <CardShell eyebrow="Watching" title="Waiting for the portal to open" right={<Pill tone="info">Expected {props.expected}</Pill>}>
      <div className="grid gap-5 @2xl:grid-cols-[auto_1fr]">
        <div className="relative mx-auto flex size-[132px] items-center justify-center" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="absolute inset-0 rounded-full border border-brass/40" style={{ transform: `scale(${1 - i * 0.28})` }} />
          ))}
          <span className="relative size-3 rounded-full bg-brass ring-pulse" />
          <Radar size={18} className="absolute text-brasshi" style={{ top: 12, right: 18 }} />
        </div>
        <div className="min-w-0">
          <ul className="ledger">
            {props.sources.map((s) => (
              <li key={s.domain} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                <span className="font-mono text-[12.5px] text-fg">{s.domain}</span>
                <span className="text-[12.5px] text-muted">
                  {s.status} · checked {s.checked}
                </span>
              </li>
            ))}
          </ul>
          <div className="eyebrow mb-1 mt-4">When it opens</div>
          <ol className="space-y-1 text-[13.5px] text-muted">
            {props.plan.map((p, i) => (
              <li key={p} className="flex gap-2">
                <span className="font-mono text-[12px] text-brass">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12.5px] text-faint">
            {props.ready} finished profile{props.ready === 1 ? '' : 's'} on hold. Only public announcement pages are read.
          </p>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------ message draft */

function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text).catch(() => undefined);
  } catch {
    /* clipboard can be refused inside a frame; the text stays selectable */
  }
}

export function MessageDraft({ props }: CardProps<{ channel: string; to: string; en?: string; ar?: string; sent?: boolean }>) {
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState(!!props.sent);
  const mark = (k: string, t: string) => {
    copyText(t);
    setCopied(k);
    setTimeout(() => setCopied(null), 1400);
  };
  return (
    <CardShell eyebrow={`${props.channel} draft`} title={`Message to ${props.to}`} right={sent ? <Pill tone="ok">Sent in demo</Pill> : <Pill>Draft</Pill>}>
      <div className="space-y-3">
        {props.en && (
          <div className="rounded-2xl rounded-tl-md bg-surface2 p-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="eyebrow">English</span>
              <button type="button" className="btn btn-ghost btn-sm !min-h-[28px] !px-2" onClick={() => mark('en', props.en as string)} aria-label="Copy the English message">
                {copied === 'en' ? <Check size={13} /> : <Copy size={13} />} {copied === 'en' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[14px] leading-relaxed text-fg">{props.en}</p>
          </div>
        )}
        {props.ar && (
          <div dir="rtl" className="rounded-2xl rounded-tr-md bg-surface2 p-3.5">
            <div className="mb-1 flex items-center justify-between" dir="ltr">
              <button type="button" className="btn btn-ghost btn-sm !min-h-[28px] !px-2" onClick={() => mark('ar', props.ar as string)} aria-label="Copy the Arabic message">
                {copied === 'ar' ? <Check size={13} /> : <Copy size={13} />} {copied === 'ar' ? 'Copied' : 'Copy'}
              </button>
              <span className="eyebrow">العربية</span>
            </div>
            <p className="font-arabic text-[17px] leading-[1.9] text-fg">{props.ar}</p>
          </div>
        )}
      </div>
      {!sent && (
        <div className="mt-3">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSent(true)}>
            <Send size={14} aria-hidden /> Send in the demo
          </button>
        </div>
      )}
    </CardShell>
  );
}

/* ------------------------------------------------------------ case summary */

export function CaseSummary({ props }: CardProps<{ title: string; metrics: { label: string; value: string }[]; highlights: string[]; next: string[]; basis: string }>) {
  return (
    <CardShell eyebrow="Case summary" title={props.title} tone="brass">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 @lg:grid-cols-3">
        {props.metrics.map((m) => (
          <div key={m.label}>
            <dd className="font-display text-[30px] font-medium leading-none tnum text-fg">{m.value}</dd>
            <dt className="mt-1 text-[12.5px] text-muted">{m.label}</dt>
          </div>
        ))}
      </dl>
      <div className="mt-5 grid gap-5 @2xl:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Decisions on this file</div>
          <ul className="space-y-1.5 text-[13.5px] text-muted">
            {props.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <Check size={14} className="mt-[3px] shrink-0 text-ok" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-2">What happens next</div>
          <ul className="space-y-1.5 text-[13.5px] text-muted">
            {props.next.map((h) => (
              <li key={h} className="flex gap-2">
                <Spinner size={13} className="mt-[3px] shrink-0 text-brass" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-faint">{props.basis}</p>
    </CardShell>
  );
}
