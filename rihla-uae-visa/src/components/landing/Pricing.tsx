import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { VisaId } from '@/domain/types';
import { PRODUCTS, SLOTS, VAT_RATE, quote } from '@/domain/visas';
import { useStore } from '@/agent/store';
import { aed, cn } from '@/lib/utils';

type Days = 30 | 60;

export interface LiveQuote {
  govFee: number;
  serviceFee: number;
  vat: number;
  total: number;
}

function FareTicket({ id, days, onApply, live }: { id: VisaId; days: Days; onApply: (id: VisaId, days: Days) => void; live?: LiveQuote }) {
  const p = PRODUCTS[id];
  const demo = quote(id, days);
  const q = live
    ? { govAED: live.govFee, serviceAED: live.serviceFee, govVatAED: live.vat, serviceVatAED: 0, totalAED: live.total }
    : demo;
  const slots = live ? (['passport', 'photo'] as const) : p.slots;
  return (
    <div className="ticket h-full">
      <div className="ticket-body flex h-full flex-col overflow-hidden" style={{ ['--y' as string]: 'calc(100% - 232px)' }}>
        <div className="flex-1 px-6 pb-6 pt-6">
          <h3 className="font-display text-[28px] font-bold leading-[1.05] tracking-[-0.03em]">{p.name}</h3>
          <p className="mt-2 max-w-[40ch] text-[14.5px] text-muted pretty">{p.blurb}</p>
          <div className="mt-5 eyebrow">You upload</div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {slots.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13.5px] text-fg">
                <Check size={14} className="mt-[3px] shrink-0 text-brand" aria-hidden />
                {SLOTS[s].label}
              </li>
            ))}
          </ul>
          {live && <p className="mt-2 text-[13px] text-muted">A return ticket and hotel booking are optional and help approval.</p>}
          <p className="mt-4 text-[13px] text-muted">Processing: {p.processing}</p>
        </div>
        <div className="perf mx-6" />
        <div className="mt-auto px-6 pb-6 pt-4">
          <div className="flex items-baseline justify-between text-[13.5px]">
            <span className="text-muted">Government fee</span>
            <span className="font-mono tnum text-fg">{aed(q.govAED, 2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[13.5px]">
            <span className="text-muted">Rihla service</span>
            <span className="font-mono tnum text-fg">{aed(q.serviceAED, 2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[13.5px]">
            <span className="text-muted">VAT {Math.round(VAT_RATE * 100)}%</span>
            <span className="font-mono tnum text-fg">{aed(q.govVatAED + q.serviceVatAED, 2)}</span>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="eyebrow">Total</span>
            <span className="font-display text-[32px] font-bold leading-none tracking-[-0.02em] tnum">{aed(q.totalAED, 2)}</span>
          </div>
          <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => onApply(id, days)}>
            Apply for {days} days <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pricing({ onApply, live }: { onApply: () => void; live?: Record<'30' | '60', LiveQuote> }) {
  const [days, setDays] = useState<Days>(30);
  const setAnswers = useStore((s) => s.setAnswers);
  const pick = (visa: VisaId, d: Days) => {
    setAnswers({ visa, days: d });
    onApply();
  };
  return (
    <div>
      <div role="radiogroup" aria-label="Length of stay" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
        {([30, 60] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => setDays(d)}
            className={cn('min-w-[96px] rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', days === d ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}
            style={days === d ? { boxShadow: 'var(--shadow-soft)' } : undefined}
          >
            {d} days
          </button>
        ))}
      </div>
      {live ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <FareTicket id="tourist" days={days} onApply={pick} live={live[String(days) as '30' | '60']} />
          <div className="self-start">
            <h3 className="font-display text-[22px] font-semibold tracking-[-0.02em]">What the price covers</h3>
            <ul className="mt-4 grid gap-3">
              {[
                ['Your passport read for you', 'The numbers and dates are confirmed against the check digits printed on the page.'],
                ['Checks before you pay', 'Passport validity, dates, photo shape and background, and the 60-day window.'],
                ['Filing by a licensed partner', 'A UAE tourist visa must be sponsored by a licensed tourism company. Ours files it for you.'],
                ['Updates by email', 'At every change, and the moment we need something from you.'],
                ['Your visa as a PDF', 'Download it from your application page, ready to print or show on your phone.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <Check size={18} className="mt-[3px] shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-fg">{t}</div>
                    <div className="text-[14px] text-muted pretty">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <FareTicket id="tourist" days={days} onApply={pick} />
          <FareTicket id="family" days={days} onApply={pick} />
        </div>
      )}
      <p className="mt-4 max-w-[70ch] text-[12.5px] text-faint">
        {live
          ? 'The government fee is passed on exactly as charged. Totals include 5% VAT. If we cannot file your application, you get your money back.'
          : 'Government fees are as reported for October 2026 and are paid on the government’s own page. The Rihla service fee of AED 99 is a placeholder for this demo. Totals include 5% VAT.'}
      </p>
    </div>
  );
}
