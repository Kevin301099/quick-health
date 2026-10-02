import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brass';

const TONE: Record<Tone, string> = {
  neutral: '',
  ok: 'pill-ok',
  warn: 'pill-warn',
  crit: 'pill-crit',
  info: 'pill-info',
  brass: 'pill-brass',
};

export function Pill({ tone = 'neutral', mono, children, className }: { tone?: Tone; mono?: boolean; children: ReactNode; className?: string }) {
  return <span className={cn('pill', TONE[tone], mono && 'pill-mono', className)}>{children}</span>;
}

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn('spin', className)} aria-hidden />;
}

export function Initials({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  const text = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface3 font-mono text-[11px] font-medium text-brasshi"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {text.toUpperCase()}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.95 ? 'bg-ok' : value >= 0.85 ? 'bg-brass' : 'bg-warn';
  return (
    <span className="inline-flex items-center gap-2" title={`${pct}% confidence`}>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-surface3">
        <span className={cn('absolute inset-y-0 left-0 w-full origin-left rounded-full', tone)} style={{ transform: `scaleX(${value})` }} />
      </span>
      <span className="font-mono text-[11px] text-faint tnum">{pct}%</span>
    </span>
  );
}

export function Eyebrow({ children, brass, className }: { children: ReactNode; brass?: boolean; className?: string }) {
  return <span className={cn('eyebrow', brass && 'eyebrow-brass', className)}>{children}</span>;
}

export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="16" cy="16" r="10.5" stroke="var(--brass)" strokeWidth="1.6" />
      <path d="M8.2 21.6C11 11.4 19.6 7.4 25.6 11.2" stroke="var(--brass-hi)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="25.6" cy="11.2" r="2.1" fill="var(--brass-hi)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark />
      <span className="font-display text-[22px] italic leading-none tracking-tight text-fg">Rihla</span>
      <span className="hidden font-kufi text-[15px] leading-none text-faint min-[420px]:inline" aria-hidden>
        رحلة
      </span>
    </span>
  );
}
