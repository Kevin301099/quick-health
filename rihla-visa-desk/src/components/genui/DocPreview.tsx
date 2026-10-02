import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocKind, DocSpec } from '@/agent/types';
import { cn } from '@/lib/utils';

/* Synthetic document previews. Every value on them is fictional and each sheet carries a SAMPLE mark. */

const SIZE: Record<DocKind, { w: number; h: number }> = {
  passport: { w: 440, h: 300 },
  emirates_id: { w: 440, h: 278 },
  photo: { w: 300, h: 300 },
  bank_statement: { w: 360, h: 440 },
  employment_letter: { w: 360, h: 440 },
  itinerary: { w: 360, h: 440 },
};

function Hl({ k, cur, children, className }: { k: string; cur?: string | null; children: ReactNode; className?: string }) {
  return (
    <span className={cn('transition-[background-color,outline-color] duration-200', cur === k && 'doc-hl', className)} data-field={k}>
      {children}
    </span>
  );
}

function Lbl({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#1c2a2b]/55">{children}</div>;
}

function Silhouette({ w = 92, h = 116 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 92 116" aria-hidden className="shrink-0 rounded-[4px]">
      <rect width="92" height="116" fill="#cfd6d2" />
      <circle cx="46" cy="44" r="19" fill="#9aa8a4" />
      <path d="M8 116c2-28 18-40 38-40s36 12 38 40z" fill="#9aa8a4" />
    </svg>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <span className="-rotate-[18deg] select-none whitespace-nowrap font-mono text-[26px] font-medium uppercase tracking-[0.14em] text-[#1c2a2b]/[0.07]">
        Sample · Fictional
      </span>
    </div>
  );
}

function Passport({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-[18px]" style={{ background: 'linear-gradient(160deg, var(--paper), color-mix(in srgb, var(--paper) 88%, #7d8f86))' }}>
      <div className="flex items-baseline justify-between border-b border-[#1c2a2b]/20 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] font-medium tracking-[0.2em]">PASSPORT</span>
          <span className="font-arabic text-[13px] leading-none">جواز سفر</span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.16em]">UNITED ARAB EMIRATES</span>
      </div>
      <div className="mt-3 flex gap-4">
        <Silhouette />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-[7px] text-[11px] font-medium leading-tight">
          <div>
            <Lbl>Type / Code</Lbl>P · ARE
          </div>
          <div>
            <Lbl>Passport no.</Lbl>
            <Hl k="number" cur={hl} className="font-mono">
              {v('number')}
            </Hl>
          </div>
          <div className="col-span-2">
            <Lbl>Surname</Lbl>
            <Hl k="surname" cur={hl}>
              {v('surname')}
            </Hl>
          </div>
          <div className="col-span-2">
            <Lbl>Given names</Lbl>
            <Hl k="given" cur={hl}>
              {v('given')}
            </Hl>
          </div>
          <div>
            <Lbl>Date of birth</Lbl>
            <Hl k="dob" cur={hl} className="font-mono">
              {v('dob')}
            </Hl>
          </div>
          <div>
            <Lbl>Sex · Nationality</Lbl>
            <Hl k="sex" cur={hl}>
              {v('sex')}
            </Hl>{' '}
            ·{' '}
            <Hl k="nationality" cur={hl}>
              UAE
            </Hl>
          </div>
          <div>
            <Lbl>Place of birth</Lbl>
            <Hl k="pob" cur={hl}>
              {v('pob')}
            </Hl>
          </div>
          <div>
            <Lbl>Issued · Expires</Lbl>
            <Hl k="issued" cur={hl} className="font-mono text-[10px]">
              {v('issued')}
            </Hl>
            <br />
            <Hl k="expires" cur={hl} className="font-mono text-[10px]">
              {v('expires')}
            </Hl>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-[4px] bg-[#1c2a2b]/[0.06] px-2 py-1.5 font-mono text-[10.5px] leading-[1.45] tracking-[0.03em]">
        <Hl k="mrz1" cur={hl} className="block break-all">
          {v('mrz1')}
        </Hl>
        <Hl k="mrz2" cur={hl} className="block break-all">
          {v('mrz2')}
        </Hl>
      </div>
      <Watermark />
    </div>
  );
}

function EmiratesId({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-[18px]" style={{ background: 'linear-gradient(135deg, var(--paper) 55%, color-mix(in srgb, var(--paper) 80%, #b9a06a))' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[9px] tracking-[0.18em]">UNITED ARAB EMIRATES</div>
          <div className="font-arabic text-[12px] leading-none">الإمارات العربية المتحدة</div>
        </div>
        <span className="h-6 w-8 rounded-[4px] border border-[#8f6f3c]/60 bg-[#c9a063]/50" aria-hidden />
      </div>
      <div className="mt-3 flex gap-4">
        <Silhouette w={78} h={98} />
        <div className="min-w-0 flex-1 space-y-[7px] text-[11px] font-medium leading-tight">
          <div>
            <Lbl>ID number</Lbl>
            <Hl k="idno" cur={hl} className="font-mono text-[13px] tracking-wide">
              {v('idno')}
            </Hl>
          </div>
          <div>
            <Lbl>Name</Lbl>
            <Hl k="name_en" cur={hl}>
              {v('name_en')}
            </Hl>
            <br />
            <Hl k="name_ar" cur={hl} className="font-arabic text-[14px]">
              {v('name_ar')}
            </Hl>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Lbl>Date of birth</Lbl>
              <Hl k="dob" cur={hl} className="font-mono text-[10px]">
                {v('dob')}
              </Hl>
            </div>
            <div>
              <Lbl>Expiry</Lbl>
              <Hl k="expires" cur={hl} className="font-mono text-[10px]">
                {v('expires')}
              </Hl>
            </div>
          </div>
        </div>
      </div>
      <Watermark />
    </div>
  );
}

function PhotoDoc({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden bg-[#dde3df] p-[16px]">
      <svg viewBox="0 0 268 220" className="w-full" aria-hidden>
        <rect width="268" height="220" rx="6" fill="#e9eeeb" />
        <circle cx="134" cy="92" r="40" fill="#9aa8a4" />
        <path d="M44 220c4-56 40-80 90-80s86 24 90 80z" fill="#9aa8a4" />
        <ellipse cx="134" cy="92" rx="56" ry="70" fill="none" stroke="#8f6f3c" strokeWidth="1.5" strokeDasharray="5 5" />
        <path d="M10 30h248M10 190h248" stroke="#8f6f3c" strokeWidth="0.8" strokeDasharray="2 4" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[9px]">
        <Hl k="crop" cur={hl} className="rounded bg-[#1c2a2b]/10 px-1.5 py-0.5">
          {v('crop')}
        </Hl>
        <Hl k="background" cur={hl} className="rounded bg-[#1c2a2b]/10 px-1.5 py-0.5">
          {v('background')}
        </Hl>
        <Hl k="resolution" cur={hl} className="rounded bg-[#1c2a2b]/10 px-1.5 py-0.5">
          {v('resolution')}
        </Hl>
      </div>
      <Watermark />
    </div>
  );
}

function Bank({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-5 text-[11px]">
      <div className="flex items-center justify-between border-b border-[#1c2a2b]/20 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.16em]">GULF NATIONAL BANK</span>
        <span className="font-mono text-[8px] tracking-wider text-[#1c2a2b]/60">STATEMENT</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Lbl>Account holder</Lbl>
          <Hl k="holder" cur={hl} className="font-medium">
            {v('holder')}
          </Hl>
        </div>
        <div>
          <Lbl>Period</Lbl>
          <Hl k="period" cur={hl} className="font-mono text-[10px]">
            {v('period')}
          </Hl>
        </div>
      </div>
      <div className="mt-4 space-y-[5px] font-mono text-[9.5px] text-[#1c2a2b]/75">
        {[
          ['01 Jul', 'Salary credit', '+31,500.00'],
          ['04 Jul', 'Card purchase', '-1,284.20'],
          ['12 Jul', 'Rent transfer', '-9,000.00'],
          ['01 Aug', 'Salary credit', '+31,500.00'],
          ['19 Aug', 'Utilities', '-742.10'],
          ['01 Sep', 'Salary credit', '+31,500.00'],
        ].map((r, i) => (
          <div key={i} className="grid grid-cols-[48px_1fr_72px] gap-2 border-b border-dashed border-[#1c2a2b]/15 pb-[4px]">
            <span>{r[0]}</span>
            <span>{i % 3 === 0 ? <Hl k="salary" cur={hl}>{r[1]}</Hl> : r[1]}</span>
            <span className="text-right">{r[2]}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-end justify-between border-t border-[#1c2a2b]/30 pt-3">
        <Lbl>Closing balance</Lbl>
        <Hl k="closing" cur={hl} className="font-mono text-[15px] font-medium">
          {v('closing')}
        </Hl>
      </div>
      <Watermark />
    </div>
  );
}

function Letter({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-6 text-[11px] leading-[1.6]">
      <div className="border-b border-[#1c2a2b]/25 pb-2">
        <Hl k="employer" cur={hl} className="text-[13px] font-semibold">
          {v('employer')}
        </Hl>
        <div className="font-mono text-[8px] tracking-wider text-[#1c2a2b]/60">DUBAI · UNITED ARAB EMIRATES</div>
      </div>
      <p className="mt-4 font-mono text-[9px] text-[#1c2a2b]/60">Date: 24 September 2026</p>
      <p className="mt-3 font-medium">To whom it may concern,</p>
      <p className="mt-2">
        This is to confirm that the bearer is employed with us as{' '}
        <Hl k="position" cur={hl} className="font-medium">
          {v('position')}
        </Hl>{' '}
        on a monthly salary of{' '}
        <Hl k="salary" cur={hl} className="font-mono font-medium">
          {v('salary')}
        </Hl>
        .
      </p>
      <p className="mt-2">
        Annual leave for the dates of travel has been approved:{' '}
        <Hl k="leave" cur={hl} className="font-medium">
          {v('leave')}
        </Hl>
        . The employee is expected to resume duty after the trip.
      </p>
      <p className="mt-6 font-arabic text-[13px] leading-none">إدارة الموارد البشرية</p>
      <p className="font-mono text-[8px] tracking-wider text-[#1c2a2b]/60">HUMAN RESOURCES</p>
      <Watermark />
    </div>
  );
}

function Itinerary({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  const v = (k: string) => doc.fields.find((f) => f.key === k)?.value ?? '';
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-5 text-[11px]">
      <div className="border-b border-[#1c2a2b]/20 pb-2 font-mono text-[10px] font-medium tracking-[0.16em]">TRAVEL ITINERARY</div>
      <div className="mt-3 rounded-lg border border-[#1c2a2b]/20 p-3">
        <Lbl>Flights</Lbl>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono text-[16px] font-medium">DXB → {v('city').slice(0, 3).toUpperCase()}</span>
          <Hl k="city" cur={hl}>
            {v('city')}
          </Hl>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Lbl>Out</Lbl>
            <Hl k="depart" cur={hl} className="font-mono text-[10px]">
              {v('depart')}
            </Hl>
          </div>
          <div>
            <Lbl>Back</Lbl>
            <Hl k="return" cur={hl} className="font-mono text-[10px]">
              {v('return')}
            </Hl>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[#1c2a2b]/20 p-3">
        <Lbl>Hotel</Lbl>
        <div className="mt-1 font-medium">Central hotel, 7 nights</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Lbl>Check-in</Lbl>
            <Hl k="checkin" cur={hl} className="font-mono text-[10px]">
              {v('checkin')}
            </Hl>
          </div>
          <div>
            <Lbl>Check-out</Lbl>
            <Hl k="checkout" cur={hl} className="font-mono text-[10px]">
              {v('checkout')}
            </Hl>
          </div>
        </div>
      </div>
      <Watermark />
    </div>
  );
}

function Sheet({ doc, hl }: { doc: DocSpec; hl?: string | null }) {
  switch (doc.kind) {
    case 'passport':
      return <Passport doc={doc} hl={hl} />;
    case 'emirates_id':
      return <EmiratesId doc={doc} hl={hl} />;
    case 'photo':
      return <PhotoDoc doc={doc} hl={hl} />;
    case 'bank_statement':
      return <Bank doc={doc} hl={hl} />;
    case 'employment_letter':
      return <Letter doc={doc} hl={hl} />;
    default:
      return <Itinerary doc={doc} hl={hl} />;
  }
}

/** Scales a fixed-size document to the width of its container. */
export function DocPreview({ doc, hl, scanning, className }: { doc: DocSpec; hl?: string | null; scanning?: boolean; className?: string }) {
  const { w, h } = SIZE[doc.kind];
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setScale(Math.min(1.4, el.clientWidth / w));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} className={cn('relative w-full overflow-hidden rounded-[10px]', className)} style={{ height: h * scale }} aria-label={`${doc.label} preview`} role="img">
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative">
        <Sheet doc={doc} hl={hl} />
        {scanning && <div className="scanline" aria-hidden />}
      </div>
    </div>
  );
}
