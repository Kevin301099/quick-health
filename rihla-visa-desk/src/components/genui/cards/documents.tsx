import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FileUp, X, Paperclip } from 'lucide-react';
import type { DocKind, DocSpec } from '@/agent/types';
import { useStore } from '@/agent/store';
import type { CardProps } from '../types';
import { CardShell, ResolvedLine } from '../Frame';
import { DocPreview } from '../DocPreview';
import { Confidence, Pill, Spinner } from '../../ui';
import { cn } from '@/lib/utils';

type Summary = { id: string; kind: DocKind; label: string; holder: string; filename: string; fields: number };

export function ExtractionPanel({ props }: CardProps<{ doc: DocSpec; holder: string; note?: string }>) {
  const { doc } = props;
  const [hl, setHl] = useState<string | null>(doc.fields[0]?.key ?? null);
  const [manual, setManual] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    if (manual) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => {
      idx.current = (idx.current + 1) % doc.fields.length;
      setHl(doc.fields[idx.current].key);
    }, 1500);
    return () => clearInterval(t);
  }, [manual, doc.fields]);

  return (
    <CardShell
      eyebrow="Read from"
      title={
        <>
          {doc.label} <span className="font-normal text-muted">· {props.holder}</span>
        </>
      }
      right={<Pill tone="ok" mono>{doc.filename}</Pill>}
    >
      <div className="grid gap-5 @2xl:grid-cols-2">
        <div className="min-w-0">
          <DocPreview doc={doc} hl={hl} />
        </div>
        <ul className="ledger min-w-0 self-start" onMouseLeave={() => setManual(false)}>
          {doc.fields.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onMouseEnter={() => {
                  setManual(true);
                  setHl(f.key);
                }}
                onFocus={() => {
                  setManual(true);
                  setHl(f.key);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-2 py-[7px] text-left transition-colors',
                  hl === f.key ? 'bg-[var(--brass-wash)]' : 'hover:bg-surface2',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[12px] text-faint">{f.label}</span>
                  <span className="block break-words font-mono text-[12.5px] leading-snug text-fg">{f.value}</span>
                </span>
                <span className="shrink-0">
                  {f.flag ? <Pill tone="warn">Re-read</Pill> : <Confidence value={f.confidence} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {props.note && <p className="mt-3 text-[12.5px] text-faint">{props.note}</p>}
    </CardShell>
  );
}

function Viewer({ doc, holder, onClose }: { doc: DocSpec; holder: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${doc.label} detail`}>
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm absolute right-3 top-3 z-10 bg-surface" aria-label="Close preview">
          <X size={16} />
        </button>
        <ExtractionPanel id="viewer" ctx={{} as never} props={{ doc, holder, note: 'Hover a field to see where it was read.' }} />
      </div>
    </div>,
    document.body,
  );
}

export function DocumentTray({ props, ctx }: CardProps<{ docs: Summary[]; status: Record<string, 'queued' | 'reading' | 'done'>; mode: 'request' | 'processing' | 'done'; client: string }>) {
  const [files, setFiles] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docsData = useStore((s) => s.cases[ctx.caseId]?.data.docs);
  const done = Object.values(props.status).filter((s) => s === 'done').length;
  const total = props.docs.length;
  const resolved = props.resolved;
  const canAct = !!props.interruptId && !resolved && !ctx.readonly;

  const take = (list: FileList | File[] | null) => {
    const names = Array.from(list ?? []).map((f) => f.name);
    if (!names.length || !props.interruptId) return;
    setFiles(names);
    ctx.resolve(props.interruptId, { source: 'upload', files: names });
  };

  const openDoc = docsData?.find((d) => d.id === open);
  const openSummary = props.docs.find((d) => d.id === open);

  return (
    <CardShell
      eyebrow="Documents"
      title={props.mode === 'request' && !resolved ? `Waiting for ${total} documents from ${props.client.split(' ')[0]}` : `${done} of ${total} documents read`}
      right={
        <div className="flex items-center gap-2" aria-live="polite">
          {props.mode === 'processing' && <Spinner className="text-brass" />}
          <Pill tone={done === total && total > 0 ? 'ok' : 'neutral'} mono>
            {done}/{total}
          </Pill>
        </div>
      }
    >
      <div className="relative mb-4 h-[3px] overflow-hidden rounded-full bg-surface3">
        <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-brass transition-transform duration-500" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
      </div>

      <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4">
        {props.docs.map((d) => {
          const st = props.status[d.id] ?? 'queued';
          const data = docsData?.find((x) => x.id === d.id);
          const clickable = st === 'done' && !!data;
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => setOpen(d.id)}
                className={cn(
                  'group block w-full min-w-0 rounded-xl border border-line bg-surface2 p-2 text-left transition-colors',
                  clickable && 'hover:border-brass',
                )}
              >
                <div className="relative h-[92px] overflow-hidden rounded-lg">
                  {data ? (
                    <DocPreview doc={data} scanning={st === 'reading'} />
                  ) : (
                    <div className="skeleton h-full w-full" />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="truncate text-[12.5px] font-medium text-fg">{d.label}</span>
                  {st === 'done' ? <Check size={14} className="shrink-0 text-ok" aria-label="Read" /> : st === 'reading' ? <Spinner size={13} className="shrink-0 text-brass" /> : null}
                </div>
                <div className="truncate text-[11.5px] text-faint">{d.holder}</div>
                <div className="truncate font-mono text-[11px] text-faint">{st === 'done' ? `${d.fields} fields` : st === 'reading' ? 'Reading' : 'Queued'}</div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        {resolved ? (
          <ResolvedLine
            by={resolved.by}
            text={
              (resolved.outcome as { source?: string; files?: string[] })?.source === 'upload'
                ? `Received ${files.length || 'your'} file${files.length === 1 ? '' : 's'}. The demo reads the sample pack for extraction.`
                : `Received the client folder, ${total} files.`
            }
            reason={resolved.reason}
          />
        ) : canAct ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              take(e.dataTransfer.files);
            }}
            className={cn(
              'flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 transition-colors @xl:flex-row @xl:items-center @xl:justify-between',
              drag ? 'border-brass bg-[var(--brass-wash)]' : 'border-line-strong',
            )}
            style={{ borderColor: drag ? undefined : 'var(--line-strong)' }}
          >
            <div className="flex items-center gap-3">
              <FileUp size={20} className="text-brass" aria-hidden />
              <div>
                <div className="text-[14px] font-medium text-fg">Drop files here</div>
                <div className="text-[12.5px] text-muted">
                  {props.autoReason ? `Autonomy will take the client folder in a moment. ${props.autoReason}.` : 'Passports, Emirates IDs and trip documents. Or use the sample pack.'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} id={`files-${props.interruptId}`} type="file" multiple className="sr-only" onChange={(e) => take(e.target.files)} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} aria-hidden /> Choose files
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => props.interruptId && ctx.resolve(props.interruptId, { source: 'sample' })}>
                Use the sample pack
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {open && openDoc && openSummary && <Viewer doc={openDoc} holder={openSummary.holder} onClose={() => setOpen(null)} />}
    </CardShell>
  );
}
