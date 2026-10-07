import { useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { Braces } from 'lucide-react';
import { Spinner } from '../ui';
import { cn } from '@/lib/utils';

export function GeneratingCard({ component }: { component: string }) {
  return (
    <div className="card p-5" aria-busy="true" aria-label={`Generating ${component}`}>
      <div className="mb-3 flex items-center gap-2 text-faint">
        <Spinner size={13} className="text-brand" />
        <span className="font-mono text-[12px]">Generating {component}</span>
      </div>
      <div className="space-y-2.5">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-3/5" />
      </div>
    </div>
  );
}

function specText(component: string, props: Record<string, unknown>) {
  const clean = JSON.parse(JSON.stringify(props, (k, v) => (k === 'resolved' || k === 'actionId' || (typeof v === 'string' && v.startsWith('blob:')) ? undefined : v)));
  const text = JSON.stringify({ component, props: clean }, null, 2);
  return text.length > 2400 ? `${text.slice(0, 2400)}\n  …` : text;
}

/** Entrance motion plus a small "view UI spec" toggle that shows exactly what the agent emitted. */
export function GenFrame({ component, props, children, spec = true }: { component: string; props: Record<string, unknown>; children: ReactNode; spec?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 0.9, 0.24, 1] }} className="min-w-0">
      {children}
      {spec && (
        <>
          <div className="mt-1 px-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[12px] transition-colors', open ? 'text-brand' : 'text-faint hover:text-muted')}
            >
              <Braces size={12} aria-hidden />
              UI spec · {component}
            </button>
          </div>
          {open && <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-raised p-3 font-mono text-[11.5px] leading-relaxed text-muted">{specText(component, props)}</pre>}
        </>
      )}
    </m.div>
  );
}

export function CardShell({
  eyebrow,
  title,
  right,
  children,
  tone = 'default',
  className,
}: {
  eyebrow?: string;
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'attn' | 'brand';
  className?: string;
}) {
  return (
    <section
      className={cn(
        'card @container overflow-hidden p-5',
        tone === 'attn' && '!border-attn/50',
        tone === 'brand' && '!border-brand/40',
        className,
      )}
    >
      {(eyebrow || title || right) && (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-fg">{title}</h2>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={cn(title || eyebrow || right ? 'pt-3' : '')}>{children}</div>
    </section>
  );
}

/** What a card collapses to once the person has acted. */
export function Settled({ text, by }: { text: string; by: 'you' | 'portal' | 'agent' }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--ok-wash)] px-3 py-2 text-[13.5px] text-ok">
      <span className="font-semibold">{by === 'you' ? 'You decided' : by === 'portal' ? 'Done in the portal' : 'Handled by the agent'}</span>
      <span className="text-muted">{text}</span>
    </div>
  );
}
