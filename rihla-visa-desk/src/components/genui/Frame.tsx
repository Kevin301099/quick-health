import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Braces } from 'lucide-react';
import { Spinner } from '../ui';
import { cn } from '@/lib/utils';

/** Skeleton shown while the agent is "generating" a component. */
export function GeneratingCard({ component }: { component: string }) {
  return (
    <div className="surface p-5" aria-busy="true" aria-label={`Generating ${component}`}>
      <div className="mb-4 flex items-center gap-2 text-faint">
        <Spinner size={13} className="text-brass" />
        <span className="font-mono text-[11px] tracking-wide">Generating {component}</span>
      </div>
      <div className="space-y-2.5">
        <div className="skeleton h-4 w-2/5" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-3/5" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      </div>
    </div>
  );
}

function specText(component: string, props: Record<string, unknown>) {
  const clean = JSON.parse(
    JSON.stringify(props, (k, v) => (k === 'resolved' || k === 'interruptId' || k === 'autoReason' ? undefined : v)),
  );
  const text = JSON.stringify({ component, props: clean }, null, 2);
  return text.length > 2600 ? `${text.slice(0, 2600)}\n  …` : text;
}

/** Wraps a generated card: entrance motion plus a small "view UI spec" toggle that shows what the agent emitted. */
export function GenFrame({ component, props, children }: { component: string; props: Record<string, unknown>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.9, 0.24, 1] }}
      className="min-w-0"
    >
      {children}
      <div className="mt-1.5 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[12px] transition-colors',
            open ? 'text-brass' : 'text-faint hover:text-muted',
          )}
          aria-expanded={open}
        >
          <Braces size={12} aria-hidden />
          UI spec · {component}
        </button>
      </div>
      {open && (
        <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-raised p-3 font-mono text-[11.5px] leading-relaxed text-muted">
          {specText(component, props)}
        </pre>
      )}
    </motion.div>
  );
}

/** Shared card chrome. */
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
  tone?: 'default' | 'warn' | 'brass';
  className?: string;
}) {
  return (
    <section
      className={cn(
        'surface @container overflow-hidden p-5',
        tone === 'warn' && '!border-warn/40 !bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))]',
        tone === 'brass' && '!border-brass/50',
        className,
      )}
    >
      {(eyebrow || title || right) && (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="text-[16px] font-semibold leading-snug text-fg">{title}</h2>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className="pt-3">{children}</div>
    </section>
  );
}

/** Settled state shared by every interactive card. */
export function ResolvedLine({ by, text, reason }: { by: 'human' | 'agent' | 'client'; text: string; reason?: string }) {
  const who = by === 'agent' ? 'Settled by policy' : by === 'client' ? 'Confirmed by the client' : 'Decided by you';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-ok/10 px-3 py-2 text-[13px] text-ok">
      <span className="font-semibold">{who}</span>
      <span className="text-muted">{text}</span>
      {reason && <span className="font-mono text-[11px] text-faint">{reason}</span>}
    </div>
  );
}
