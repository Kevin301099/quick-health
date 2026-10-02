import { PRODUCTS, quote } from '@/domain/visas';
import { byCode } from '@/domain/nationalities';
import type { Answers } from '@/domain/types';
import { aed, daysBetween, fmtDate } from '@/lib/utils';

/** The application as a boarding pass. It fills in as the person answers. */
export function Ticket({ answers, uploaded, total }: { answers: Answers; uploaded: number; total: number }) {
  const product = PRODUCTS[answers.visa];
  const q = quote(answers.visa, answers.days);
  const nat = byCode(answers.nationality);
  const stay = answers.arrival && answers.departure ? daysBetween(answers.arrival, answers.departure) : null;
  return (
    <div className="ticket">
      <div className="ticket-body overflow-hidden" style={{ ['--y' as string]: '58%' }}>
        <div className="px-6 pb-5 pt-6">
          <div className="eyebrow">Your application</div>
          <div className="mt-1 font-display text-[28px] font-bold leading-[1.05] tracking-[-0.03em] text-fg">{product.name}</div>
          <div className="mt-1 text-[14px] text-muted">{answers.days} days · single entry</div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="eyebrow">Passport</dt>
              <dd className="mt-0.5 text-[14.5px] font-medium text-fg">{nat && nat.code !== 'XX' ? nat.name : 'Not chosen'}</dd>
            </div>
            <div>
              <dt className="eyebrow">Entering</dt>
              <dd className="mt-0.5 text-[14.5px] font-medium text-fg">{answers.emirate}</dd>
            </div>
            <div>
              <dt className="eyebrow">Arrives</dt>
              <dd className="mt-0.5 font-mono text-[13.5px] text-fg">{answers.arrival ? fmtDate(answers.arrival) : '—'}</dd>
            </div>
            <div>
              <dt className="eyebrow">Leaves</dt>
              <dd className="mt-0.5 font-mono text-[13.5px] text-fg">{answers.departure ? fmtDate(answers.departure) : '—'}</dd>
            </div>
          </dl>
          {stay !== null && stay > 0 && <div className="mt-3 text-[13px] text-muted">{stay} days in the UAE</div>}
        </div>
        <div className="perf mx-6" />
        <div className="px-6 pb-6 pt-4">
          <div className="flex items-baseline justify-between text-[13.5px]">
            <span className="text-muted">Government fee, incl. VAT</span>
            <span className="font-mono tnum text-fg">{aed(q.govTotalAED, 2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[13.5px]">
            <span className="text-muted">Rihla service, incl. VAT</span>
            <span className="font-mono tnum text-fg">{aed(q.serviceTotalAED, 2)}</span>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="eyebrow">Total</span>
            <span className="font-display text-[28px] font-bold leading-none tracking-[-0.02em] tnum text-fg">{aed(q.totalAED, 2)}</span>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[12.5px] text-muted">
              <span>Documents</span>
              <span className="font-mono">
                {uploaded} of {total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
              <div className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-500" style={{ transform: `scaleX(${total ? uploaded / total : 0})` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
