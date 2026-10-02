import { Fragment } from 'react';
import { MessageCircle, Mail, ShieldCheck, TriangleAlert, ExternalLink } from 'lucide-react';
import type { Requirement, Owner } from '@/agent/types';
import type { CardProps } from '../types';
import { CardShell } from '../Frame';
import { Pill } from '../../ui';
import { aed } from '@/lib/utils';

const PATTERN =
  /(London|Toronto|New York|Orlando|Paris|Canada|Europe|\b\d{1,2}(?:\s?(?:to|-)\s?\d{1,2})?\s(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\bJanuary\b|\b(?:we are|party of)\s\d+)/gi;

function Marked({ text }: { text: string }) {
  const parts = text.split(PATTERN);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[4px] bg-[var(--brass-wash)] px-1 text-brasshi">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function IntakeSummary({ props }: CardProps<{ channel: string; received: string; from: string; message: string; language: string; extracted: { label: string; value: string }[] }>) {
  const Icon = props.channel === 'Email' ? Mail : MessageCircle;
  return (
    <CardShell eyebrow="Inbound request" title="What the client asked for" right={<Pill mono>{props.language}</Pill>}>
      <div className="grid gap-4 @2xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl rounded-tl-md bg-surface2 p-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-faint">
            <Icon size={13} aria-hidden />
            <span>
              {props.from} · {props.channel} · {props.received}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-fg">
            <Marked text={props.message} />
          </p>
        </div>
        <dl className="space-y-0 self-center">
          {props.extracted.map((e, i) => (
            <div key={e.label} className={`flex items-baseline justify-between gap-4 py-2 ${i > 0 ? 'hairline-t' : ''}`}>
              <dt className="text-[13px] text-muted">{e.label}</dt>
              <dd className="text-right text-[14px] font-medium text-fg">{e.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </CardShell>
  );
}

const MODE_LABEL: Record<string, string> = { 'e-authorisation': 'Online authorisation', visa: 'Visa', watch: 'Launch watch' };

export function OwnerPill({ who }: { who: Owner }) {
  if (who === 'agent') return <Pill tone="brass">Agent</Pill>;
  if (who === 'client') return <Pill tone="info">Client</Pill>;
  return <Pill>You</Pill>;
}

export function RequirementsCard({
  props,
}: CardProps<{
  corridor: { name: string; short: string; mode: string; headline: string; decision: string; validity: string; portal: string; rulepack: string; reviewed: string; sources: { label: string; domain: string }[] };
  determination: string;
  items: Requirement[];
  fees: { perPerson: string; total: string; aed: number };
}>) {
  const c = props.corridor;
  return (
    <CardShell eyebrow="Rule pack" right={<Pill tone="brass">{MODE_LABEL[c.mode]}</Pill>}>
      <h2 className="font-display text-[28px] font-medium italic leading-[1.1] text-fg balance">{props.determination}</h2>
      <p className="mt-2 max-w-[60ch] text-[14px] text-muted pretty">{c.headline}</p>

      <dl className="mt-4 grid grid-cols-1 overflow-hidden rounded-xl border border-line @lg:grid-cols-3">
        {[
          ['Decision', c.decision],
          ['Validity', c.validity],
          ['Government fee', `${props.fees.total} · ${aed(props.fees.aed)}`],
        ].map(([k, v], i) => (
          <div key={k} className={`px-4 py-3 ${i > 0 ? 'border-t border-line @lg:border-l @lg:border-t-0' : ''}`}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 text-[13.5px] font-medium text-fg">{v}</dd>
            {k === 'Government fee' && <div className="mt-0.5 text-[12px] text-faint">{props.fees.perPerson}</div>}
          </div>
        ))}
      </dl>

      <ul className="mt-4 ledger">
        {props.items.map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brass" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-fg">{r.label}</div>
              <div className="text-[13px] text-muted">{r.detail}</div>
            </div>
            <OwnerPill who={r.who} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[12px] text-faint">
        {c.sources.map((s) => (
          <span key={s.domain} className="inline-flex items-center gap-1 font-mono">
            <ExternalLink size={11} aria-hidden />
            {s.domain}
          </span>
        ))}
        <span>Demo pack {c.rulepack}, reviewed {c.reviewed}. Verify against the source before filing.</span>
      </div>
    </CardShell>
  );
}

export function AdvisoryBanner({ props }: CardProps<{ title: string; body: string; asOf: string; source: string; actions: string[] }>) {
  return (
    <CardShell tone="warn" eyebrow={`Live advisory · as of ${props.asOf}`} title={props.title} right={<TriangleAlert size={18} className="text-warn" aria-hidden />}>
      <p className="max-w-[62ch] text-[14px] text-muted pretty">{props.body}</p>
      <div className="mt-3">
        <div className="eyebrow mb-2">What the agent does about it</div>
        <ul className="flex flex-wrap gap-2">
          {props.actions.map((a) => (
            <li key={a} className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-fg" style={{ borderColor: 'var(--line-strong)' }}>
              {a}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 font-mono text-[11px] text-faint">Source · {props.source}. Re-check before relying on it.</div>
    </CardShell>
  );
}
