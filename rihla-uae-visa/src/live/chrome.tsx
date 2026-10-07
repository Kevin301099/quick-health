import type { ReactNode } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Pill, Wordmark } from '@/components/ui';
import type { LiveApplication } from './api';
import { session } from './api';
import type { Me } from './hooks';

export const go = (hash: string) => {
  window.location.hash = hash;
  window.scrollTo({ top: 0 });
};

export function LiveHeader({ me, children }: { me: Me | null | undefined; children?: ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky z-30 border-b border-line bg-bg/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3">
        <a href="#" aria-label="Rihla home" className="rounded-lg">
          <Wordmark />
        </a>
        <div className="min-w-0 flex-1">{children}</div>
        <nav className="flex items-center gap-1.5" aria-label="Account">
          {me && (
            <a href="#apps" className="btn btn-ghost btn-sm">
              My applications
            </a>
          )}
          {me?.ops && (
            <a href="#ops" className="btn btn-ghost btn-sm">
              Ops
            </a>
          )}
          <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {me && (
            <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => session.set(null)} aria-label="Sign out" title={`Signed in as ${me.email}`}>
              <LogOut size={16} />
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium text-muted">
      <span>{children}</span>
      {hint && <span className="text-[12px] font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-[var(--attn-wash)] px-3.5 py-2.5 text-[13.5px] text-attn">
      {children}
    </p>
  );
}

/** The five stages of a live application, drawn as the same dashed flight path as the demo. */
export function Stages({ current }: { current: number }) {
  const names = ['Trip', 'Documents', 'Sign', 'Pay', 'Visa'];
  return (
    <ol className="flex items-center gap-0 overflow-x-auto" aria-label="Progress">
      {names.map((n, i) => (
        <li key={n} className="flex items-center" aria-current={i === current ? 'step' : undefined}>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full text-[11px] font-semibold',
                i < current && 'bg-brand text-[var(--on-brand)]',
                i === current && 'border-2 border-brand text-brand',
                i > current && 'border text-faint',
              )}
              style={i > current ? { borderColor: 'var(--line-strong)' } : undefined}
            >
              {i + 1}
            </span>
            <span className={cn('whitespace-nowrap text-[13px] font-medium', i > current ? 'text-faint' : 'text-fg')}>{n}</span>
          </span>
          {i < names.length - 1 && <span className="mx-2.5 h-px w-6 shrink-0 border-t-2 border-dashed" style={{ borderColor: i < current ? 'var(--brand)' : 'var(--line-strong)' }} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

const STATUS_LABEL: Record<LiveApplication['status'], [string, 'neutral' | 'brand' | 'ok' | 'attn' | 'sun' | 'info']> = {
  draft: ['In progress', 'neutral'],
  ready_to_pay: ['Ready to pay', 'brand'],
  paid: ['Paid', 'info'],
  queued: ['Filing', 'info'],
  submitted: ['Filed', 'info'],
  processing: ['Under review', 'info'],
  needs_info: ['Needs you', 'attn'],
  approved: ['Approved', 'ok'],
  rejected: ['Not approved', 'attn'],
  cancelled: ['Cancelled', 'neutral'],
};

export function StatusPill({ status }: { status: LiveApplication['status'] }) {
  const [label, tone] = STATUS_LABEL[status];
  return <Pill tone={tone}>{label}</Pill>;
}
