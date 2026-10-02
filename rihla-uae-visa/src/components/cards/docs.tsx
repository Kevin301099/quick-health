import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X as XIcon } from 'lucide-react';
import type { DocField, DocSlotId } from '@/domain/types';
import type { PhotoReport as PhotoReportData } from '@/domain/photo';
import { byCode } from '@/domain/nationalities';
import { useStore } from '@/agent/store';
import type { CardProps } from './types';
import { CardShell } from './Frame';
import { DocPreview } from './DocPreview';
import { Pill } from '../ui';
import { cn, formatBytes } from '@/lib/utils';

interface DocRow {
  slot: DocSlotId;
  label: string;
  name: string;
  bytes: number;
  sample: boolean;
  fields: DocField[];
}

function conf(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Viewer({ doc, country, imageUrl, onClose }: { doc: DocRow; country: string; imageUrl?: string; onClose: () => void }) {
  const [hl, setHl] = useState<string | null>(doc.fields[0]?.key ?? null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${doc.label} detail`}>
      <button type="button" className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />
      <div className="card card-soft relative max-h-[90vh] w-full max-w-3xl overflow-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">{doc.name}</div>
            <h2 className="font-display text-[20px] font-semibold">{doc.label}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <DocPreview slot={doc.slot} fields={doc.fields} hl={hl} country={country} imageUrl={imageUrl} />
          <ul className="ledger self-start" onMouseLeave={() => setHl(doc.fields[0]?.key ?? null)}>
            {doc.fields.length === 0 && <li className="py-2 text-[14px] text-muted">Your own file. Rihla asks you to type its details.</li>}
            {doc.fields.map((f) => (
              <li key={f.key}>
                <button type="button" onMouseEnter={() => setHl(f.key)} onFocus={() => setHl(f.key)} className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-2 py-[7px] text-left', hl === f.key ? 'bg-[var(--sun-wash)]' : 'hover:bg-surface2')}>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-faint">{f.label}</span>
                    <span className="block break-words font-mono text-[12.5px] text-fg">{f.value}</span>
                  </span>
                  <span className="font-mono text-[11px] text-faint">{conf(f.confidence)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DocsRead({ props }: CardProps<{ docs: DocRow[]; note?: string }>) {
  const [open, setOpen] = useState<DocRow | null>(null);
  const files = useStore((s) => s.files);
  const nat = useStore((s) => s.answers.nationality);
  const country = byCode(nat)?.name ?? 'Passport';
  const total = props.docs.reduce((n, d) => n + d.fields.length, 0);
  return (
    <CardShell eyebrow="Documents" title={`${props.docs.length} documents read`} right={<Pill tone="ok">{total ? `${total} fields` : 'Received'}</Pill>}>
      <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3">
        {props.docs.map((d) => (
          <li key={d.slot}>
            <button type="button" onClick={() => setOpen(d)} className="block w-full min-w-0 rounded-xl border border-line bg-surface2 p-2 text-left transition-colors hover:border-brand">
              <div className="h-[84px] overflow-hidden rounded-lg">
                <DocPreview slot={d.slot} fields={d.fields} country={country} imageUrl={files[d.slot]?.url} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="truncate text-[13px] font-medium text-fg">{d.label}</span>
                <Check size={14} className="shrink-0 text-ok" aria-label="Read" />
              </div>
              <div className="truncate font-mono text-[11px] text-faint">{d.fields.length ? `${d.fields.length} fields` : formatBytes(d.bytes)}</div>
            </button>
          </li>
        ))}
      </ul>
      {props.note && <p className="mt-3 text-[13px] text-muted">{props.note}</p>}
      {open && <Viewer doc={open} country={country} imageUrl={files[open.slot]?.url} onClose={() => setOpen(null)} />}
    </CardShell>
  );
}

function CheckRows({ report }: { report: PhotoReportData }) {
  return (
    <ul className="mt-2 space-y-1">
      {report.checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-[13px]">
          {c.ok ? <Check size={14} className="mt-[3px] shrink-0 text-ok" aria-label="Pass" /> : <XIcon size={14} className="mt-[3px] shrink-0 text-attn" aria-label="Fail" />}
          <span className="min-w-0">
            <span className="text-fg">{c.label}</span> <span className="text-muted">{c.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PhotoReport({ props }: CardProps<{ title: string; before: { url: string; report: PhotoReportData }; after?: { url: string; report: PhotoReportData } }>) {
  const sides = [{ label: props.after ? 'Before' : 'Your photo', ...props.before }, ...(props.after ? [{ label: 'After', ...props.after }] : [])];
  return (
    <CardShell eyebrow="Photo check" title={props.title}>
      <div className={cn('grid gap-5', props.after ? '@xl:grid-cols-2' : '@xl:grid-cols-[auto_1fr]')}>
        {sides.map((s) => (
          <div key={s.label} className="flex gap-4">
            <div className="w-[104px] shrink-0">
              <div className="overflow-hidden rounded-lg border border-line bg-surface2" style={{ aspectRatio: '4.3 / 5.5' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.url ? <img src={s.url} alt={s.label} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="eyebrow mt-1.5">{s.label}</div>
            </div>
            <div className="min-w-0 flex-1">
              <CheckRows report={s.report} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-faint">Measured on the pixels, in your browser. I do not detect faces or expressions.</p>
    </CardShell>
  );
}
