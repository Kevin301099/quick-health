import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CreditCard, Download, FileText, Lock, PenLine, ScanLine, TriangleAlert, Upload, Wand2 } from 'lucide-react';
import { SLOTS } from '@/domain/visas';
import type { DocSlotId, Profile } from '@/domain/types';
import { analysePhoto, lightenBackground, shrinkDocument, type PhotoReport } from '@/domain/photo';
import { aed, cn, fmtDate, formatBytes } from '@/lib/utils';
import { Pill, Spinner } from '@/components/ui';
import { ChecksReport, Checklist, PermitReady, StatusTimeline } from '@/components/cards/results';
import { api, ApiError, uploadDocument, type Extraction, type LiveApplication, type LiveConfig, type LiveDoc } from './api';
import { ErrorNote, Label, LiveHeader, Stages, StatusPill } from './chrome';
import { useApplication, useLiveConfig, useMe } from './hooks';
import { SignIn } from './SignIn';

const noop = () => undefined;

/* ------------------------------------------------------------------ page */

export function LiveApplicationPage({ id, justPaid }: { id: string; justPaid: boolean }) {
  const me = useMe();
  const { config } = useLiveConfig();
  const { app, setApp, error } = useApplication(id, (a) => justPaid && a.status === 'ready_to_pay');

  const stage = !app ? 1 : app.status === 'draft' || app.status === 'needs_info' ? (app.readiness?.ready ? 2 : 1) : app.status === 'ready_to_pay' ? 3 : app.status === 'approved' ? 5 : 4;

  let body: ReactNode;
  if (me === null) body = <SignIn title="Sign in to see your application" />;
  else if (error && error.status === 404) body = <Empty title="We could not find that application" text="It may belong to another email address. Sign in with the email you used, or start a new application." />;
  else if (error && !app) body = <Empty title="Something went wrong" text={error.message} />;
  else if (!app || !config) body = <Loading />;
  else body = <Body app={app} setApp={setApp} config={config} justPaid={justPaid} />;

  return (
    <div className="min-h-full bg-bg">
      <LiveHeader me={me}>
        <div className="hidden justify-center md:flex">
          <Stages current={stage} />
        </div>
      </LiveHeader>
      <main className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">{body}</div>
        {app && config && <Summary app={app} />}
      </main>
    </div>
  );
}

function Body({ app, setApp, config, justPaid }: { app: LiveApplication; setApp: (a: LiveApplication) => void; config: LiveConfig; justPaid: boolean }) {
  const name = `${app.profile.given ?? ''} ${app.profile.surname ?? ''}`.trim();
  switch (app.status) {
    case 'draft':
      return (
        <>
          <Heading title="Your documents" text="Upload your passport and photo. We read the passport for you, check everything, and show you any problem before you pay." />
          <Documents app={app} setApp={setApp} config={config} />
          <Details app={app} setApp={setApp} />
          <TripPanel app={app} setApp={setApp} />
          <Checks app={app} />
          <Sign app={app} setApp={setApp} config={config} />
        </>
      );
    case 'needs_info':
      return (
        <>
          <NeedsYou app={app} setApp={setApp} />
          <Documents app={app} setApp={setApp} config={config} />
          <Details app={app} setApp={setApp} />
        </>
      );
    case 'ready_to_pay':
      return justPaid ? (
        <Panel icon={<Spinner size={18} />} title="Confirming your payment" tone="brand">
          <p className="text-[14.5px] text-muted">The payment page sent you back. We are waiting for the payment provider to confirm, which usually takes a few seconds.</p>
        </Panel>
      ) : (
        <Pay app={app} />
      );
    case 'approved':
      return (
        <>
          <Permit app={app} name={name} />
          <Checklist
            id="before-you-fly"
            act={noop}
            readonly
            props={{
              title: 'Before you fly',
              items: [
                { label: 'Carry a printed or saved copy of the visa', note: 'Airlines and border officers may ask for it' },
                { label: `Enter the UAE by ${app.permit?.validUntil ? fmtDate(app.permit.validUntil) : 'the date on the visa'}`, note: 'A UAE visit visa has to be used within its validity' },
                { label: `Leave within ${app.answers.days} days of arriving`, note: 'Overstaying costs AED 50 a day, from the first day' },
              ],
            }}
          />
          <Tracking app={app} />
        </>
      );
    case 'rejected':
    case 'cancelled':
      return (
        <>
          <Panel icon={<TriangleAlert size={18} />} title={app.status === 'rejected' ? 'The application was not approved' : 'This application was cancelled'} tone="attn">
            <p className="text-[14.5px] text-muted">{app.providerMessage || (app.status === 'cancelled' ? 'Your payment has been refunded to your card.' : 'The authorities did not give a reason.')}</p>
            <p className="mt-2 text-[14px] text-muted">Reply to any of our emails and a person on our team will look at your options with you.</p>
          </Panel>
          <Tracking app={app} />
        </>
      );
    default:
      return (
        <>
          {justPaid && (
            <Panel icon={<Check size={18} />} title="Payment received" tone="ok">
              <p className="text-[14.5px] text-muted">Thank you. We have started filing. You can close this page: we email you when the visa is ready, or if anything is needed.</p>
            </Panel>
          )}
          <Tracking app={app} />
        </>
      );
  }
}

/* ------------------------------------------------------------------ building blocks */

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="font-display text-[clamp(30px,4vw,40px)] font-bold leading-[1.05] tracking-[-0.03em] balance">{title}</h1>
      <p className="mt-2 max-w-[60ch] text-[15.5px] text-muted pretty">{text}</p>
    </div>
  );
}

function Panel({ icon, title, tone = 'neutral', right, children }: { icon?: ReactNode; title: string; tone?: 'neutral' | 'brand' | 'ok' | 'attn'; right?: ReactNode; children: ReactNode }) {
  const wash = tone === 'brand' ? 'bg-[var(--brand-wash)] text-brand' : tone === 'ok' ? 'bg-[var(--ok-wash)] text-ok' : tone === 'attn' ? 'bg-[var(--attn-wash)] text-attn' : 'bg-surface2 text-muted';
  return (
    <section className="card p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', wash)}>{icon}</span>}
          <h2 className="font-display text-[21px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div className="card space-y-3 p-6" aria-busy="true" aria-label="Loading your application">
      <div className="skeleton h-6 w-1/3" />
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="card p-6">
      <h1 className="font-display text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[14.5px] text-muted">{text}</p>
      <a className="btn btn-primary mt-5" href="#apply">
        Start an application
      </a>
    </div>
  );
}

function Summary({ app }: { app: LiveApplication }) {
  const q = app.quote;
  const name = `${app.profile.given ?? ''} ${app.profile.surname ?? ''}`.trim();
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Your application">
      <div className="ticket">
        <div className="ticket-body" style={{ ['--y' as string]: '56%' }}>
          <div className="px-6 pb-5 pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="eyebrow">UAE tourist visa</div>
              <StatusPill status={app.status} />
            </div>
            <div className="mt-2 font-display text-[24px] font-bold leading-tight tracking-[-0.03em]">{name || 'Traveller'}</div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <KV k="Arrives" v={fmtDate(app.answers.arrival)} />
              <KV k="Leaves" v={fmtDate(app.answers.departure)} />
              <KV k="Entering" v={app.answers.emirate} />
              <KV k="Visa" v={`${app.answers.days} days`} />
            </dl>
            {app.providerRef && <div className="mt-4 font-mono text-[12.5px] text-faint">Ref {app.providerRef}</div>}
          </div>
          <div className="perf mx-6" />
          <div className="px-6 pb-6 pt-4 text-[13.5px]">
            {q && (
              <div className="flex items-end justify-between">
                <span className="eyebrow">{app.payment?.status === 'paid' ? 'Paid' : 'Total'}</span>
                <span className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] tnum">{aed(q.total, 2)}</span>
              </div>
            )}
            <p className="mt-3 flex items-start gap-2 text-[12.5px] text-faint">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
              Documents are deleted 30 days after a decision.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{k}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-medium text-fg">{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ documents */

function Documents({ app, setApp, config }: { app: LiveApplication; setApp: (a: LiveApplication) => void; config: LiveConfig }) {
  const [extraction, setExtraction] = useState<Extraction | null>(app.extraction);
  const docs = new Map(app.documents.map((d) => [d.slot, d]));
  const required = config.slots.required as DocSlotId[];
  const optional = config.slots.optional as DocSlotId[];
  return (
    <Panel icon={<FileText size={18} />} title="Documents" right={<Pill tone={required.every((s) => docs.has(s)) ? 'ok' : 'neutral'}>{required.filter((s) => docs.has(s)).length} of {required.length} required</Pill>}>
      <ul className="space-y-3">
        {required.map((slot) => (
          <Slot key={slot} slot={slot} doc={docs.get(slot)} app={app} setApp={setApp} onExtraction={setExtraction} max={config.maxFileBytes} />
        ))}
      </ul>
      {extraction && extraction.status !== 'unavailable' && <ExtractionNote x={extraction} />}
      {extraction?.status === 'unavailable' && <p className="mt-3 text-[13px] text-faint">{extraction.note}</p>}
      <h3 className="mt-6 text-[14px] font-semibold text-fg">Optional, but they help</h3>
      <p className="mt-0.5 text-[13px] text-muted">A return ticket and a hotel booking make an approval more likely and let us cross-check your dates.</p>
      <ul className="mt-3 space-y-3">
        {optional.map((slot) => (
          <Slot key={slot} slot={slot} doc={docs.get(slot)} app={app} setApp={setApp} onExtraction={setExtraction} max={config.maxFileBytes} />
        ))}
      </ul>
    </Panel>
  );
}

function ExtractionNote({ x }: { x: Extraction }) {
  const good = x.status === 'ok';
  return (
    <div className={cn('mt-4 flex items-start gap-3 rounded-2xl p-4', good ? 'bg-[var(--ok-wash)]' : 'bg-[var(--sun-wash)]')} role="status">
      <ScanLine size={18} className={cn('mt-0.5 shrink-0', good ? 'text-ok' : 'text-[var(--sun-ink)]')} aria-hidden />
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-fg">{x.note}</div>
        {x.verified && <div className="mt-0.5 text-[13px] text-muted">The code lines at the bottom of the page matched every check digit, so the numbers and dates are confirmed.</div>}
      </div>
    </div>
  );
}

function Slot({ slot, doc, app, setApp, onExtraction, max }: { slot: DocSlotId; doc?: LiveDoc; app: LiveApplication; setApp: (a: LiveApplication) => void; onExtraction: (x: Extraction | null) => void; max: number }) {
  const spec = SLOTS[slot];
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'reading' | 'fixing'>('idle');
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<PhotoReport | null>(app.photoReport);
  const [lastFile, setLastFile] = useState<File | Blob | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const send = async (picked: File | Blob) => {
    setError(null);
    const type = picked.type === 'image/jpg' ? 'image/jpeg' : picked.type;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(type) || (slot === 'photo' && type === 'application/pdf')) {
      setError(slot === 'photo' ? 'The photo must be a JPEG or PNG image.' : 'Upload a JPEG, PNG or PDF.');
      return;
    }
    // Document photos are shrunk in the browser first; the visa photo keeps its pixels for the photo checks.
    const file = slot === 'photo' ? picked : await shrinkDocument(type === picked.type ? picked : new Blob([picked], { type }));
    if (file.size > max) {
      setError(`This file is ${formatBytes(file.size)}. Files can be up to ${formatBytes(max)}.`);
      return;
    }
    setLastFile(file);
    if (type.startsWith('image/')) setPreview(URL.createObjectURL(file));
    let photo: PhotoReport | null = null;
    if (slot === 'photo') {
      photo = await analysePhoto(file);
      setReport(photo);
    }
    try {
      setPhase('uploading');
      setProgress(0);
      if (slot === 'passport') window.setTimeout(() => setPhase((p) => (p === 'uploading' ? 'reading' : p)), 1200);
      const r = await uploadDocument(app.id, slot, file, setProgress);
      setApp(r.application);
      if (slot === 'passport') onExtraction(r.extraction);
      if (photo) setApp((await api<{ application: LiveApplication }>(`/v1/applications/${app.id}`, { method: 'PATCH', body: { photoReport: photo } })).application);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setPhase('idle');
      setProgress(null);
    }
  };

  const fixPhoto = async () => {
    if (!lastFile) return;
    setPhase('fixing');
    const fixed = await lightenBackground(lastFile);
    await send(new File([fixed], 'photo-fixed.jpg', { type: 'image/jpeg' }));
  };

  const busy = phase !== 'idle';
  const thumb = preview ?? (doc?.url && doc.mime.startsWith('image/') ? doc.url : null);
  const photoBad = slot === 'photo' && report && (report.needsFix || report.blocking);

  return (
    <li
      className={cn('rounded-2xl border p-4 transition-colors', drag ? 'border-brand bg-[var(--brand-wash)]' : doc ? 'border-line bg-surface' : 'border-dashed bg-surface')}
      style={!drag && !doc ? { borderColor: 'var(--line-strong)' } : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void send(f);
      }}
    >
      <div className="flex items-start gap-4">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className={cn('shrink-0 rounded-lg border border-line bg-surface2 object-cover', slot === 'photo' ? 'h-[70px] w-[55px]' : 'h-[52px] w-[72px]')} />
        ) : (
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl', doc ? 'bg-[var(--brand-wash)] text-brand' : 'bg-surface2 text-faint')}>{doc ? <Check size={20} aria-label="Uploaded" /> : <FileText size={20} aria-hidden />}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-fg">{spec.label}</div>
          <div className="text-[13px] text-muted">{spec.hint}</div>
          {busy ? (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-[12.5px] text-brand">
                <Spinner size={12} /> {phase === 'reading' ? 'Reading your passport…' : phase === 'fixing' ? 'Lightening the background…' : `Uploading${progress !== null ? ` ${Math.round(progress * 100)}%` : ''}`}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface3">
                <div className="h-full origin-left rounded-full bg-brand transition-transform" style={{ transform: `scaleX(${phase === 'reading' ? 1 : (progress ?? 0)})` }} />
              </div>
            </div>
          ) : doc ? (
            <div className="mt-1 font-mono text-[12px] text-faint">
              {doc.mime === 'application/pdf' ? 'PDF' : `${doc.width ?? '?'} × ${doc.height ?? '?'} px`} · {formatBytes(doc.bytes)}
            </div>
          ) : (
            <div className="mt-1 text-[12.5px] text-faint">Drop a file here, or choose one. JPEG, PNG{slot === 'photo' ? '' : ' or PDF'}.</div>
          )}
          {slot === 'photo' && report && doc && !busy && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Photo checks">
              {report.checks.map((c) => (
                <li key={c.id}>
                  <Pill tone={c.ok ? 'ok' : c.id === 'weight' ? 'sun' : 'attn'}>
                    {c.ok ? <Check size={11} aria-hidden /> : '!'} {c.label}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
          {photoBad && !busy && report && !report.blocking && lastFile && (
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={fixPhoto}>
              <Wand2 size={14} aria-hidden /> Fix the background for me
            </button>
          )}
          {error && <p className="mt-2 text-[13px] text-attn">{error}</p>}
        </div>
        <div className="shrink-0">
          <input
            ref={input}
            id={`live-file-${slot}`}
            type="file"
            className="sr-only"
            accept={slot === 'photo' ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void send(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={14} aria-hidden /> {doc ? 'Replace' : 'Choose'}
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ details */

const FIELDS: { key: keyof Profile; label: string; type?: string; required?: boolean; hint?: string }[] = [
  { key: 'given', label: 'Given names', required: true },
  { key: 'surname', label: 'Surname', required: true },
  { key: 'dob', label: 'Date of birth', type: 'date', required: true },
  { key: 'sex', label: 'Sex', required: true },
  { key: 'birthplace', label: 'Place of birth' },
  { key: 'passportNo', label: 'Passport number', required: true },
  { key: 'passportIssued', label: 'Passport issued', type: 'date' },
  { key: 'passportExpires', label: 'Passport expires', type: 'date', required: true },
  { key: 'phone', label: 'Mobile number', type: 'tel', required: true, hint: 'With country code' },
  { key: 'profession', label: 'Profession' },
];

function Details({ app, setApp }: { app: LiveApplication; setApp: (a: LiveApplication) => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(app.profile[f.key] ?? '')])));
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const attention = new Set(app.extraction?.attention ?? []);

  // When the passport is read, fill any fields the person has not touched yet.
  const seen = useRef(app.profile);
  useEffect(() => {
    if (seen.current === app.profile) return;
    seen.current = app.profile;
    setForm((f) => Object.fromEntries(FIELDS.map((x) => [x.key, f[x.key] || String(app.profile[x.key] ?? '')])));
  }, [app.profile]);

  const dirty = FIELDS.some((f) => (form[f.key] ?? '') !== String(app.profile[f.key] ?? ''));

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      const r = await api<{ application: LiveApplication }>(`/v1/applications/${app.id}`, { method: 'PATCH', body: { profile: form } });
      // The server normalises names and numbers to passport style; show exactly what it stored.
      seen.current = r.application.profile;
      setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(r.application.profile[f.key] ?? '')])));
      setApp(r.application);
      setState('saved');
    } catch (e) {
      setError((e as ApiError).message);
      setState('idle');
    }
  };

  return (
    <Panel icon={<PenLine size={18} />} title="Your details" right={app.extraction?.verified ? <Pill tone="ok">Read from passport</Pill> : undefined}>
      <p className="-mt-1 mb-4 text-[14px] text-muted">Exactly as printed in your passport. {attention.size ? 'Please check the highlighted fields.' : ''}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`pf-${f.key}`} hint={f.hint ?? (f.required ? undefined : 'Optional')}>
              {f.label}
            </Label>
            {f.key === 'sex' ? (
              <select id="pf-sex" className={cn('field', attention.has('sex') && 'doc-hl')} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">Choose</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            ) : (
              <input
                id={`pf-${f.key}`}
                type={f.type ?? 'text'}
                className={cn('field', f.key === 'passportNo' && 'font-mono uppercase', (f.key === 'given' || f.key === 'surname') && 'uppercase', attention.has(f.key) && 'doc-hl')}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                autoComplete={f.key === 'phone' ? 'tel' : f.key === 'given' ? 'given-name' : f.key === 'surname' ? 'family-name' : 'off'}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || state === 'saving'}>
          {state === 'saving' ? <Spinner /> : null} Save details
        </button>
        {state === 'saved' && !dirty && (
          <span className="flex items-center gap-1.5 text-[13.5px] text-ok">
            <Check size={14} aria-hidden /> Saved
          </span>
        )}
      </div>
      <ErrorNote>{error}</ErrorNote>
    </Panel>
  );
}

/* ------------------------------------------------------------------ trip */

function TripPanel({ app, setApp }: { app: LiveApplication; setApp: (a: LiveApplication) => void }) {
  const [open, setOpen] = useState(false);
  const [trip, setTrip] = useState({ arrival: app.answers.arrival, departure: app.answers.departure, days: app.answers.days, emirate: app.answers.emirate });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issue = app.checks?.issues.find((i) => i.id === 'stay' || i.id === 'window');

  const save = async (next = trip) => {
    setBusy(true);
    setError(null);
    try {
      const { nationality, hasPermit } = app.answers;
      const r = await api<{ application: LiveApplication }>(`/v1/applications/${app.id}`, { method: 'PATCH', body: { answers: { nationality, hasPermit, ...next } } });
      setApp(r.application);
      setOpen(false);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">Your trip</h2>
          <p className="mt-0.5 text-[14px] text-muted">
            {fmtDate(app.answers.arrival)} to {fmtDate(app.answers.departure)} · {app.answers.emirate} · {app.answers.days}-day visa
          </p>
        </div>
        <div className="flex gap-2">
          {issue?.id === 'stay' && app.answers.days === 30 && (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save({ ...trip, days: 60 })}>
              Switch to the 60-day visa
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Close' : 'Change'}
          </button>
        </div>
      </div>
      {issue && !open && <p className="mt-3 rounded-xl bg-[var(--sun-wash)] px-3.5 py-2.5 text-[13.5px] text-fg">{issue.detail}</p>}
      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tp-arrival">Arriving</Label>
            <input id="tp-arrival" type="date" className="field" value={trip.arrival} onChange={(e) => setTrip({ ...trip, arrival: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="tp-departure">Leaving</Label>
            <input id="tp-departure" type="date" className="field" min={trip.arrival} value={trip.departure} onChange={(e) => setTrip({ ...trip, departure: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="tp-emirate">Arriving in</Label>
            <select id="tp-emirate" className="field" value={trip.emirate} onChange={(e) => setTrip({ ...trip, emirate: e.target.value as typeof trip.emirate })}>
              {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tp-days">Visa length</Label>
            <select id="tp-days" className="field" value={trip.days} onChange={(e) => setTrip({ ...trip, days: Number(e.target.value) as 30 | 60 })}>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? <Spinner /> : null} Save trip
            </button>
          </div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

/* ------------------------------------------------------------------ checks and signing */

function Checks({ app }: { app: LiveApplication }) {
  if (!app.checks) return null;
  return <ChecksReport id="live-checks" act={noop} readonly props={{ title: 'What we checked', passes: app.checks.passes, issues: app.checks.issues.map((i) => ({ title: i.title, risk: i.risk })) }} />;
}

function Sign({ app, setApp, config }: { app: LiveApplication; setApp: (a: LiveApplication) => void; config: LiveConfig }) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = app.readiness;
  const passportName = `${app.profile.given ?? ''} ${app.profile.surname ?? ''}`.trim();
  const all = config.declarations.every((q) => typeof answers[q.id] === 'boolean' && (q.mustBe === null || answers[q.id] === q.mustBe));

  const sign = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ application: LiveApplication }>(`/v1/applications/${app.id}/sign`, { body: { declarations: answers, signatureName: name } });
      setApp(res.application);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const missing = r ? [...r.missingDocs.map((s) => SLOTS[s as DocSlotId]?.label ?? s), ...r.missingFields, ...r.blocking] : [];

  return (
    <Panel icon={<PenLine size={18} />} title="Declarations and signature">
      {!r?.ready ? (
        <div className="rounded-2xl bg-surface2 p-4 text-[14px] text-muted">
          <div className="font-medium text-fg">Before you can sign, we still need:</div>
          <ul className="mt-1.5 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="-mt-1 mb-4 text-[14px] text-muted">These are your own statements. We never answer them for you.</p>
          <ul className="ledger">
            {config.declarations.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1 text-[14.5px] text-fg">{q.text}</span>
                {q.mustBe === true ? (
                  <label className="flex items-center gap-2 text-[14px] font-medium">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={answers[q.id] === true} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} />I agree
                  </label>
                ) : (
                  <div role="radiogroup" aria-label={q.text} className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
                    {(
                      [
                        [false, 'No'],
                        [true, 'Yes'],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === v}
                        onClick={() => setAnswers({ ...answers, [q.id]: v })}
                        className={cn('min-w-[60px] rounded-[10px] px-3 py-1.5 text-[13.5px] font-medium', answers[q.id] === v ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}
                        style={answers[q.id] === v ? { boxShadow: 'var(--shadow-soft)' } : undefined}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Label htmlFor="live-signature" hint={passportName}>
              Type your full name to sign
            </Label>
            <input id="live-signature" className="field max-w-[420px] font-display text-[18px] tracking-[-0.01em]" value={name} onChange={(e) => setName(e.target.value)} placeholder={passportName} autoComplete="name" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary btn-lg" onClick={sign} disabled={!all || !name.trim() || busy}>
              {busy ? <Spinner /> : null} Sign and continue to payment <ArrowRight size={17} aria-hidden />
            </button>
            <span className="text-[13px] text-faint">After signing, details are locked so what you pay for is exactly what we file.</span>
          </div>
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Panel>
  );
}

/* ------------------------------------------------------------------ payment */

function Pay({ app }: { app: LiveApplication }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = app.quote!;
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>(`/v1/applications/${app.id}/checkout`, { method: 'POST' });
      window.location.href = r.url;
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  };
  return (
    <>
      <Heading title="Last step: payment" text="Everything is checked and signed. Once you pay, we file the application with our licensed partner and email you at every change." />
      <Panel icon={<CreditCard size={18} />} title="Pay and file">
        <dl className="space-y-2 text-[14.5px]">
          <Line k={`Government fee, ${q.days}-day tourist visa`} v={aed(q.govFee, 2)} />
          <Line k="Rihla filing service" v={aed(q.serviceFee, 2)} />
          <Line k="VAT" v={aed(q.vat, 2)} />
          <div className="flex items-end justify-between border-t border-line pt-3">
            <dt className="font-semibold text-fg">Total</dt>
            <dd className="font-display text-[30px] font-bold leading-none tracking-[-0.02em] tnum">{aed(q.total, 2)}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-primary btn-lg mt-6 w-full sm:w-auto" onClick={pay} disabled={busy}>
          {busy ? <Spinner /> : <Lock size={16} aria-hidden />} Pay {aed(q.total, 2)}
        </button>
        <p className="mt-3 text-[13px] text-faint">You pay on a secure payment page. Your card details never reach Rihla.</p>
        <ErrorNote>{error}</ErrorNote>
      </Panel>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono tnum text-fg">{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ after payment */

function Tracking({ app }: { app: LiveApplication }) {
  const at = (type: string) => app.events.find((e) => e.type === type)?.at;
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined);
  const s = app.status;
  const order = ['paid', 'queued', 'submitted', 'processing', 'approved'];
  const reached = (x: string) => order.indexOf(s) >= order.indexOf(x) || s === 'approved' || s === 'rejected';
  const steps = [
    { label: 'Payment received', detail: 'Your application is locked and ready to file', status: 'done' as const, at: time(at('paid')) },
    {
      label: 'Filed with our licensed partner',
      detail: s === 'queued' ? 'Our team is filing it now' : app.providerRef ? `Reference ${app.providerRef}` : 'Waiting to be filed',
      status: reached('submitted') ? ('done' as const) : ('active' as const),
      at: time(at('status_submitted') ?? at('filed')),
    },
    {
      label: 'Under review by the UAE authorities',
      detail: 'Usually up to 48 hours. Not guaranteed.',
      status: s === 'approved' || s === 'rejected' ? ('done' as const) : reached('processing') ? ('active' as const) : ('pending' as const),
      at: time(at('status_processing')),
    },
    {
      label: s === 'rejected' ? 'Not approved' : 'Visa issued',
      detail: s === 'approved' ? `Permit ${app.permit?.number}` : s === 'rejected' ? (app.providerMessage ?? '') : 'We email you the moment it is ready',
      status: s === 'approved' || s === 'rejected' ? ('done' as const) : ('pending' as const),
      at: time(at('status_approved') ?? at('status_rejected')),
    },
  ];
  return (
    <StatusTimeline
      id="live-tracking"
      act={noop}
      readonly
      props={{ steps, reference: app.providerRef, clock: s === 'approved' || s === 'rejected' ? undefined : 'This page updates on its own. You can close it; we email you at every change.' }}
    />
  );
}

function Permit({ app, name }: { app: LiveApplication; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>(`/v1/applications/${app.id}/permit`);
      window.location.href = r.url;
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  const sandbox = app.provider === 'sandbox';
  return (
    <>
      <Heading title="Your visa is ready" text="Download it now and keep a copy on your phone. We also emailed you a link." />
      <PermitReady
        id="live-permit"
        act={noop}
        readonly
        props={{
          name: name || 'Traveller',
          note: sandbox ? 'Sandbox permit. Not valid for travel.' : 'Issued by the UAE authorities.',
          permit: {
            number: app.permit?.number ?? '',
            holder: name,
            passportNo: String(app.profile.passportNo ?? ''),
            type: 'Tourist visa',
            days: app.answers.days,
            enterBy: app.permit?.validUntil ?? app.answers.arrival,
            emirate: app.answers.emirate,
          },
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary btn-lg" onClick={download} disabled={busy || !app.permit?.available}>
          {busy ? <Spinner /> : <Download size={17} aria-hidden />} Download the visa (PDF)
        </button>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </>
  );
}

function NeedsYou({ app, setApp }: { app: LiveApplication; setApp: (a: LiveApplication) => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ application: LiveApplication }>(`/v1/applications/${app.id}/respond`, { body: { message } });
      setApp(r.application);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card overflow-hidden" style={{ borderColor: 'var(--attn)' }}>
      <div className="flex items-center gap-2 bg-[var(--attn-wash)] px-6 py-2.5 text-[12.5px] font-semibold tracking-[0.06em] text-attn">
        <span className="relative size-2.5 rounded-full bg-attn ring-pulse ring-pulse-attn" aria-hidden />
        YOUR TURN
      </div>
      <div className="p-6">
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em]">We need something from you</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-fg">{app.needs?.message}</p>
        <p className="mt-2 text-[13.5px] text-muted">If it is a document, replace it below first. Then tell us it is done.</p>
        <Label htmlFor="live-reply">Message (optional)</Label>
        <textarea id="live-reply" rows={3} className="field !h-auto py-2" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button type="button" className="btn btn-attn mt-4" onClick={send} disabled={busy}>
          {busy ? <Spinner /> : null} Done, continue filing
        </button>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </section>
  );
}
