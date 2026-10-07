import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocField, DocSlotId } from '@/domain/types';
import { cn } from '@/lib/utils';

/* Synthetic document previews. Every value on them is fictional and each sheet carries a SAMPLE mark. */

const SIZE: Record<DocSlotId, { w: number; h: number }> = {
  passport: { w: 440, h: 300 },
  photo: { w: 300, h: 384 },
  ticket: { w: 440, h: 200 },
  hotel: { w: 360, h: 300 },
  insurance: { w: 360, h: 300 },
  bank: { w: 360, h: 300 },
  sponsor_id: { w: 440, h: 278 },
  tenancy: { w: 360, h: 300 },
  salary: { w: 360, h: 300 },
  relationship: { w: 360, h: 300 },
};

function Hl({ k, cur, children, className }: { k: string; cur?: string | null; children: ReactNode; className?: string }) {
  return (
    <span className={cn('transition-[background-color,outline-color] duration-200', cur === k && 'doc-hl', className)} data-field={k}>
      {children}
    </span>
  );
}

const Lbl = ({ children }: { children: ReactNode }) => <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#1c2a2b]/55">{children}</div>;

function Silhouette({ w = 90, h = 112 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 92 116" aria-hidden className="shrink-0 rounded-[4px]">
      <rect width="92" height="116" fill="#cfd8d8" />
      <circle cx="46" cy="44" r="19" fill="#9aaaaa" />
      <path d="M8 116c2-28 18-40 38-40s36 12 38 40z" fill="#9aaaaa" />
    </svg>
  );
}

const Watermark = () => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
    <span className="-rotate-[16deg] select-none whitespace-nowrap font-mono text-[24px] font-medium uppercase tracking-[0.14em] text-[#1c2a2b]/[0.07]">Sample · Fictional</span>
  </div>
);

type P = { f: (k: string) => string; hl?: string | null; country: string };

function Passport({ f, hl, country }: P) {
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-[18px]" style={{ background: 'linear-gradient(160deg, var(--paper), color-mix(in srgb, var(--paper) 90%, #7da39a))' }}>
      <div className="flex items-baseline justify-between border-b border-[#1c2a2b]/20 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.2em]">PASSPORT</span>
        <span className="font-mono text-[9px] tracking-[0.16em]">{country.toUpperCase()}</span>
      </div>
      <div className="mt-3 flex gap-4">
        <Silhouette />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-[7px] text-[11px] font-medium leading-tight">
          <div>
            <Lbl>Type</Lbl>P
          </div>
          <div>
            <Lbl>Passport no.</Lbl>
            <Hl k="number" cur={hl} className="font-mono">{f('number')}</Hl>
          </div>
          <div className="col-span-2">
            <Lbl>Surname</Lbl>
            <Hl k="surname" cur={hl}>{f('surname')}</Hl>
          </div>
          <div className="col-span-2">
            <Lbl>Given names</Lbl>
            <Hl k="given" cur={hl}>{f('given')}</Hl>
          </div>
          <div>
            <Lbl>Date of birth</Lbl>
            <Hl k="dob" cur={hl} className="font-mono">{f('dob')}</Hl>
          </div>
          <div>
            <Lbl>Sex · Nationality</Lbl>
            <Hl k="sex" cur={hl}>{f('sex')}</Hl> · <Hl k="nationality" cur={hl}>{f('nationality').slice(0, 14)}</Hl>
          </div>
          <div>
            <Lbl>Place of birth</Lbl>
            <Hl k="pob" cur={hl}>{f('pob')}</Hl>
          </div>
          <div>
            <Lbl>Issued · Expires</Lbl>
            <Hl k="issued" cur={hl} className="font-mono text-[10px]">{f('issued')}</Hl>
            <br />
            <Hl k="expires" cur={hl} className="font-mono text-[10px]">{f('expires')}</Hl>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-[4px] bg-[#1c2a2b]/[0.06] px-2 py-1.5 font-mono text-[10.5px] leading-[1.45] tracking-[0.03em]">
        <Hl k="mrz1" cur={hl} className="block break-all">{f('mrz1')}</Hl>
        <Hl k="mrz2" cur={hl} className="block break-all">{f('mrz2')}</Hl>
      </div>
      <Watermark />
    </div>
  );
}

function Ticket({ f, hl }: P) {
  return (
    <div className="sheet relative h-full w-full overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="flex h-full">
        <div className="flex-1 p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] font-medium tracking-[0.2em]">BOARDING PASS</span>
            <Hl k="flight" cur={hl} className="font-mono text-[11px]">{f('flight')}</Hl>
          </div>
          <div className="mt-2 flex items-baseline gap-3 font-display text-[28px] font-bold leading-none tracking-[-0.02em]">
            <span>ORIGIN</span>
            <span className="text-[16px] text-[#1c2a2b]/50">to</span>
            <span>UAE</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] font-medium">
            <div className="col-span-2">
              <Lbl>Passenger</Lbl>
              <Hl k="name" cur={hl}>{f('name')}</Hl>
            </div>
            <div>
              <Lbl>Arrives</Lbl>
              <Hl k="arrive" cur={hl} className="font-mono text-[10.5px]">{f('arrive')}</Hl>
            </div>
            <div>
              <Lbl>Return flight</Lbl>
              <Hl k="depart" cur={hl} className="font-mono text-[10.5px]">{f('depart')}</Hl>
            </div>
          </div>
        </div>
        <div className="w-[96px] border-l-2 border-dashed border-[#1c2a2b]/25 p-3">
          <div className="grid h-full place-items-center">
            <div className="grid grid-cols-6 gap-[2px]" aria-hidden>
              {Array.from({ length: 36 }).map((_, i) => (
                <span key={i} className="size-[8px] rounded-[1px]" style={{ background: [0, 2, 3, 6, 9, 11, 13, 14, 17, 19, 21, 22, 25, 27, 28, 31, 33, 35].includes(i) ? '#1c2a2b' : '#1c2a2b22' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <Watermark />
    </div>
  );
}

function EmiratesId({ f, hl }: P) {
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-[18px]" style={{ background: 'linear-gradient(135deg, var(--paper) 55%, color-mix(in srgb, var(--paper) 78%, #c9a45a))' }}>
      <div className="flex items-start justify-between">
        <div className="font-mono text-[9px] tracking-[0.18em]">RESIDENT IDENTITY CARD</div>
        <span className="h-6 w-8 rounded-[4px] border border-[#8a6d2f]/60 bg-[#d6b46a]/50" aria-hidden />
      </div>
      <div className="mt-3 flex gap-4">
        <Silhouette w={78} h={98} />
        <div className="min-w-0 flex-1 space-y-[8px] text-[11px] font-medium leading-tight">
          <div>
            <Lbl>ID number</Lbl>
            <Hl k="eid" cur={hl} className="font-mono text-[13px] tracking-wide">{f('eid')}</Hl>
          </div>
          <div>
            <Lbl>Name</Lbl>
            <Hl k="name" cur={hl}>{f('name')}</Hl>
          </div>
          <div>
            <Lbl>Expiry</Lbl>
            <Hl k="expires" cur={hl} className="font-mono text-[10px]">{f('expires')}</Hl>
          </div>
        </div>
      </div>
      <Watermark />
    </div>
  );
}

const TITLES: Partial<Record<DocSlotId, [string, string]>> = {
  hotel: ['Hotel booking', 'RESERVATION CONFIRMATION'],
  insurance: ['Travel health insurance', 'CERTIFICATE OF COVER'],
  tenancy: ['Tenancy contract', 'EJARI REGISTERED'],
  salary: ['Salary certificate', 'TO WHOM IT MAY CONCERN'],
  relationship: ['Certificate', 'PROOF OF RELATIONSHIP'],
};

function Generic({ slot, fields, hl }: { slot: DocSlotId; fields: DocField[]; hl?: string | null }) {
  const [title, sub] = TITLES[slot] ?? ['Document', ''];
  return (
    <div className="sheet relative h-full w-full overflow-hidden p-5 text-[11px]">
      <div className="border-b border-[#1c2a2b]/20 pb-2">
        <div className="font-display text-[15px] font-bold tracking-[-0.01em]">{title}</div>
        <div className="font-mono text-[8px] tracking-[0.16em] text-[#1c2a2b]/60">{sub}</div>
      </div>
      <div className="mt-4 space-y-3">
        {fields.map((fl) => (
          <div key={fl.key}>
            <Lbl>{fl.label}</Lbl>
            <Hl k={fl.key} cur={hl} className="text-[12px] font-medium">{fl.value}</Hl>
          </div>
        ))}
      </div>
      <Watermark />
    </div>
  );
}

function Sheet({ slot, fields, hl, country, imageUrl }: { slot: DocSlotId; fields: DocField[]; hl?: string | null; country: string; imageUrl?: string }) {
  const f = (k: string) => fields.find((x) => x.key === k)?.value ?? '';
  const p: P = { f, hl, country };
  if (slot === 'passport') return <Passport {...p} />;
  if (slot === 'ticket') return <Ticket {...p} />;
  if (slot === 'sponsor_id') return <EmiratesId {...p} />;
  if (slot === 'photo')
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-[#dfe6e6]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Your photo" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <Silhouette w={140} h={176} />
          </div>
        )}
      </div>
    );
  return <Generic slot={slot} fields={fields} hl={hl} />;
}

/** Scales a fixed-size document to the width of its container. */
export function DocPreview({
  slot,
  fields,
  hl,
  scanning,
  country = 'Passport',
  imageUrl,
  className,
}: {
  slot: DocSlotId;
  fields: DocField[];
  hl?: string | null;
  scanning?: boolean;
  country?: string;
  imageUrl?: string;
  className?: string;
}) {
  const { w, h } = SIZE[slot];
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
    <div ref={ref} className={cn('relative w-full overflow-hidden rounded-[10px]', className)} style={{ height: h * scale }} role="img" aria-label={`${slot} preview`}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative">
        <Sheet slot={slot} fields={fields} hl={hl} country={country} imageUrl={imageUrl} />
        {scanning && <div className="scanline" aria-hidden />}
      </div>
    </div>
  );
}
