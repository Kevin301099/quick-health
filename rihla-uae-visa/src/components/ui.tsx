import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'ok' | 'attn' | 'info' | 'sun';

const TONE: Record<Tone, string> = { neutral: '', brand: 'pill-brand', ok: 'pill-ok', attn: 'pill-attn', info: 'pill-info', sun: 'pill-sun' };

export function Pill({ tone = 'neutral', mono, children, className }: { tone?: Tone; mono?: boolean; children: ReactNode; className?: string }) {
  return <span className={cn('pill', TONE[tone], mono && 'pill-mono', className)}>{children}</span>;
}

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn('spin', className)} aria-hidden />;
}

export function Mark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M8 21c3-9 11-12 16-8" stroke="var(--on-brand)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="13" r="2.7" fill="var(--sun)" />
    </svg>
  );
}

export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark size={size} />
      <span className="font-display text-[22px] font-bold leading-none tracking-[-0.03em] text-fg">Rihla</span>
    </span>
  );
}

/** A circular passport stamp. Draws text around a circle; used when something is approved. */
export function Stamp({ top, bottom, date, size = 150, className }: { top: string; bottom: string; date: string; size?: number; className?: string }) {
  const id = `st-${top.replace(/\W/g, '')}-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className={className} role="img" aria-label={`${top} ${bottom} ${date}`} style={{ color: 'var(--brand)' }}>
      <defs>
        <path id={`${id}-t`} d="M 80 80 m -57 0 a 57 57 0 1 1 114 0" />
        <path id={`${id}-b`} d="M 80 80 m -57 0 a 57 57 0 0 0 114 0" />
      </defs>
      <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 4" />
      <circle cx="80" cy="80" r="44" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontFamily="var(--font-mono)" fontSize="11.5" letterSpacing="3.2" fill="currentColor" fontWeight="500">
        <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">
          {top}
        </textPath>
      </text>
      <text fontFamily="var(--font-mono)" fontSize="11.5" letterSpacing="3.2" fill="currentColor" fontWeight="500">
        <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
          {bottom}
        </textPath>
      </text>
      <text x="80" y="76" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="21" fill="currentColor">
        APPROVED
      </text>
      <text x="80" y="96" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="currentColor">
        {date}
      </text>
    </svg>
  );
}
