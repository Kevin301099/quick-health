import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { NATIONALITIES, checkEligibility } from '@/domain/nationalities';
import { useStore } from '@/agent/store';
import { cn } from '@/lib/utils';
import { Pill } from '../ui';

const LABEL = { visa_required: 'Visa needed', no_visa: 'No visa needed', on_arrival: 'On arrival', check: 'Check' } as const;

/** "Do I need a visa?" in one question. It reuses the same rules the application flow uses. */
export function Checker({ onApply }: { onApply: () => void }) {
  const [code, setCode] = useState('');
  const [permit, setPermit] = useState<boolean | null>(null);
  const setAnswers = useStore((s) => s.setAnswers);
  const elig = checkEligibility(code, permit);
  const needs = elig.status === 'visa_required' && (!elig.askPermit || permit === false || NATIONALITIES.some((n) => n.code === code && n.group === 'visa'));

  const begin = () => {
    setAnswers({ nationality: code, hasPermit: permit });
    onApply();
  };

  return (
    <div className="card p-6" style={{ boxShadow: 'var(--shadow-soft)' }}>
      <label htmlFor="landing-nat" className="mb-1.5 block text-[13px] font-medium text-muted">
        Passport nationality
      </label>
      <select
        id="landing-nat"
        className="field"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setPermit(null);
        }}
      >
        <option value="">Choose your passport</option>
        {NATIONALITIES.map((n) => (
          <option key={n.code} value={n.code}>
            {n.name}
          </option>
        ))}
      </select>

      {elig.askPermit && (
        <div className="mt-4">
          <div className="mb-1.5 text-[13px] font-medium text-muted">Do you hold a valid visa or residence permit from the US, EU, UK, Singapore, Japan, South Korea, Australia, New Zealand or Canada?</div>
          <div role="radiogroup" aria-label="Residence permit" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
            {(
              [
                [true, 'Yes'],
                [false, 'No'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={permit === v}
                onClick={() => setPermit(v)}
                className={cn('min-w-[72px] rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', permit === v ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}
                style={permit === v ? { boxShadow: 'var(--shadow-soft)' } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn('mt-5 rounded-2xl p-4', !code ? 'bg-surface2' : needs ? 'bg-[var(--brand-wash)]' : elig.status === 'check' ? 'bg-surface2' : 'bg-[var(--sun-wash)]')} role="status" aria-live="polite">
        {!code ? (
          <p className="text-[14px] text-muted">Pick a passport and the answer shows up here. Many passports do not need a visa at all.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {elig.askPermit && permit === null ? <Pill>One question</Pill> : <Pill tone={needs ? 'brand' : elig.status === 'check' ? 'neutral' : 'sun'}>{needs ? LABEL.visa_required : LABEL[elig.status]}</Pill>}
              <span className="font-display text-[18px] font-semibold leading-tight tracking-[-0.01em]">{elig.askPermit && permit === null ? 'One quick question' : elig.headline}</span>
            </div>
            <p className="mt-1.5 max-w-[62ch] text-[14px] text-muted pretty">{elig.detail}</p>
            {needs && (
              <button type="button" className="btn btn-primary mt-4" onClick={begin}>
                Start my application <ArrowRight size={16} aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-[12.5px] text-faint">Reported entry rules for October 2026, a short demo list. Check the official list before you fly.</p>
    </div>
  );
}
