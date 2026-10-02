import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, FileText, Moon, Sparkles, Sun, Trash2, Upload } from 'lucide-react';
import type { DocSlotId, FileRef, VisaId } from '@/domain/types';
import { NATIONALITIES, checkEligibility } from '@/domain/nationalities';
import { PRODUCTS, SLOTS, quote } from '@/domain/visas';
import { SAMPLES, buildSampleFiles, sampleById } from '@/domain/samples';
import { analysePhoto } from '@/domain/photo';
import { useStore } from '@/agent/store';
import { useTheme } from '@/lib/theme';
import { aed, cn, formatBytes, fmtDate } from '@/lib/utils';
import { Pill, Spinner, Wordmark } from '../ui';
import { Ticket } from './Ticket';

type Step = 1 | 2;

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-muted">
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ step 1 */

function TripStep({ onNext }: { onNext: () => void }) {
  const answers = useStore((s) => s.answers);
  const setAnswers = useStore((s) => s.setAnswers);
  const sampleId = useStore((s) => s.sampleId);
  const setSample = useStore((s) => s.setSample);
  const setPhotoReport = useStore((s) => s.setPhotoReport);
  const [loading, setLoading] = useState<string | null>(null);
  const elig = checkEligibility(answers.nationality, answers.hasPermit);
  const must = elig.status === 'visa_required' && (!elig.askPermit || answers.hasPermit === false || !!NATIONALITIES.find((n) => n.code === answers.nationality && n.group === 'visa'));
  const ready = must && !!answers.arrival && !!answers.departure && answers.departure > answers.arrival;

  const loadSample = async (id: string) => {
    setLoading(id);
    const s = sampleById(id);
    const files = await buildSampleFiles(s);
    setSample(s.id, s.answers, s.profile, files);
    const ph = files.find((f) => f.slot === 'photo');
    if (ph?.blob) setPhotoReport(await analysePhoto(ph.blob));
    setLoading(null);
  };

  return (
    <div>
      <div className="card p-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
          <Sparkles size={15} className="text-brand" aria-hidden /> Want to see it work first? Try a sample traveller.
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadSample(s.id)}
              disabled={loading !== null}
              aria-pressed={sampleId === s.id}
              className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors', sampleId === s.id ? 'border-brand bg-[var(--brand-wash)]' : 'border-line hover:border-line-strong')}
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-fg">{s.label}</span>
                <span className="block text-[13px] text-muted">{s.line}</span>
              </span>
              {loading === s.id ? <Spinner className="text-brand" /> : sampleId === s.id ? <Check size={18} className="text-brand" aria-label="Loaded" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-5 p-5">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Do you need a visa?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nationality">Passport nationality</Label>
            <select id="nationality" className="field" value={answers.nationality} onChange={(e) => setAnswers({ nationality: e.target.value, hasPermit: null })}>
              <option value="">Choose your passport</option>
              {NATIONALITIES.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          {elig.askPermit && (
            <div>
              <Label>Valid visa or residence permit from the US, EU, UK, Singapore, Japan, South Korea, Australia, New Zealand or Canada?</Label>
              <div role="radiogroup" aria-label="Residence permit" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
                {[
                  [true, 'Yes'],
                  [false, 'No'],
                ].map(([v, l]) => (
                  <button key={String(v)} type="button" role="radio" aria-checked={answers.hasPermit === v} onClick={() => setAnswers({ hasPermit: v as boolean })} className={cn('min-w-[72px] rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', answers.hasPermit === v ? 'bg-surface text-fg' : 'text-muted hover:text-fg')} style={answers.hasPermit === v ? { boxShadow: 'var(--shadow-soft)' } : undefined}>
                    {l as string}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {answers.nationality && (
          <div className={cn('mt-5 rounded-2xl p-4', elig.status === 'visa_required' ? 'bg-[var(--brand-wash)]' : elig.status === 'check' ? 'bg-surface2' : 'bg-[var(--sun-wash)]')} role="status">
            <div className="flex items-center gap-2">
              <Pill tone={elig.status === 'visa_required' ? 'brand' : elig.status === 'check' ? 'neutral' : 'sun'}>{elig.status === 'visa_required' ? 'Visa needed' : elig.status === 'no_visa' ? 'No visa needed' : elig.status === 'on_arrival' ? 'On arrival' : 'Check'}</Pill>
              <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">{elig.headline}</span>
            </div>
            <p className="mt-1.5 max-w-[62ch] text-[14px] text-muted pretty">{elig.detail}</p>
            <p className="mt-2 text-[12.5px] text-faint">Reported entry rules for October 2026. Check the official list before you fly.</p>
          </div>
        )}
      </div>

      {must && (
        <div className="card mt-5 p-5">
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Your trip</h2>
          <fieldset className="mt-4">
            <legend className="sr-only">Visa type</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.values(PRODUCTS) as (typeof PRODUCTS)[VisaId][]).map((p) => (
                <button key={p.id} type="button" aria-pressed={answers.visa === p.id} onClick={() => setAnswers({ visa: p.id })} className={cn('rounded-2xl border p-4 text-left transition-colors', answers.visa === p.id ? 'border-brand bg-[var(--brand-wash)]' : 'border-line hover:border-line-strong')}>
                  <div className="text-[15.5px] font-semibold text-fg">{p.name}</div>
                  <div className="mt-0.5 text-[13.5px] text-muted">{p.blurb}</div>
                  <div className="mt-2 font-mono text-[12px] text-faint">from AED {p.fees[30]} + VAT</div>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>How long can you stay?</Label>
              <div role="radiogroup" aria-label="Duration" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
                {([30, 60] as const).map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={answers.days === d} onClick={() => setAnswers({ days: d })} className={cn('rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', answers.days === d ? 'bg-surface text-fg' : 'text-muted hover:text-fg')} style={answers.days === d ? { boxShadow: 'var(--shadow-soft)' } : undefined}>
                    {d} days · AED {PRODUCTS[answers.visa].fees[d]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="emirate">Arriving in</Label>
              <select id="emirate" className="field" value={answers.emirate} onChange={(e) => setAnswers({ emirate: e.target.value as never })}>
                {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah'].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="arrival">Arriving</Label>
              <input id="arrival" type="date" className="field" value={answers.arrival} min="2026-10-04" onChange={(e) => setAnswers({ arrival: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="departure">Leaving</Label>
              <input id="departure" type="date" className="field" value={answers.departure} min={answers.arrival} onChange={(e) => setAnswers({ departure: e.target.value })} />
            </div>
            {answers.visa === 'family' && (
              <div>
                <Label htmlFor="relationship">Who is your sponsor to you?</Label>
                <select id="relationship" className="field" value={answers.relationship} onChange={(e) => setAnswers({ relationship: e.target.value as never })}>
                  {[
                    ['parent', 'My son or daughter (I am their parent)'],
                    ['spouse', 'My spouse'],
                    ['child', 'My parent (I am their child)'],
                    ['sibling', 'My brother or sister'],
                    ['friend', 'A friend or other relative'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="btn btn-primary btn-lg" disabled={!ready} onClick={onNext}>
          Continue to documents
        </button>
        {!must && answers.nationality && <span className="text-[13.5px] text-muted">Pick a passport that needs a visa to continue, or try a sample traveller.</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 2 */

function SlotCard({ slot, file }: { slot: DocSlotId; file?: FileRef }) {
  const setFile = useStore((s) => s.setFile);
  const setPhotoReport = useStore((s) => s.setPhotoReport);
  const report = useStore((s) => s.photoReport);
  const spec = SLOTS[slot];
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const take = async (f?: File | null) => {
    if (!f) return;
    const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    setFile(slot, { slot, name: f.name, bytes: f.size, mime: f.type, sample: false, blob: f, url });
    if (slot === 'photo' && f.type.startsWith('image/')) setPhotoReport(await analysePhoto(f));
    if (ref.current) ref.current.value = '';
  };

  return (
    <li
      className={cn('rounded-2xl border p-4 transition-colors', drag ? 'border-brand bg-[var(--brand-wash)]' : file ? 'border-line bg-surface' : 'border-dashed border-line-strong bg-surface')}
      style={{ borderColor: drag || file ? undefined : 'var(--line-strong)' }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void take(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex items-start gap-4">
        {slot === 'photo' && file?.url ? (
          <div className="w-[76px] shrink-0 overflow-hidden rounded-lg border border-line bg-surface2" style={{ aspectRatio: '4.3 / 5.5' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt="Your photo" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', file ? 'bg-[var(--brand-wash)] text-brand' : 'bg-surface2 text-faint')}>{file ? <Check size={20} aria-label="Uploaded" /> : <FileText size={20} aria-hidden />}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-fg">{spec.label}</span>
            {file?.sample && <Pill tone="sun">Sample</Pill>}
          </div>
          <div className="text-[13px] text-muted">{spec.hint}</div>
          {file ? (
            <div className="mt-1 truncate font-mono text-[12px] text-faint">
              {file.name} · {formatBytes(file.bytes)}
            </div>
          ) : (
            <div className="mt-1 text-[12.5px] text-faint">Drop a file here, or choose one</div>
          )}
          {slot === 'photo' && file && report && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Photo checks">
              {report.checks.map((c) => (
                <li key={c.id}>
                  <Pill tone={c.ok ? 'ok' : c.id === 'weight' ? 'sun' : 'attn'}>
                    {c.ok ? '✓' : '!'} {c.label}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <input ref={ref} type="file" id={`file-${slot}`} className="sr-only" accept={spec.accept === 'image' ? 'image/jpeg,image/png' : 'image/*,application/pdf'} onChange={(e) => void take(e.target.files?.[0])} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.click()}>
            <Upload size={14} aria-hidden /> {file ? 'Replace' : 'Choose'}
          </button>
          {file && (
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setFile(slot, null)} aria-label={`Remove ${spec.label}`}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function DocsStep({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const answers = useStore((s) => s.answers);
  const files = useStore((s) => s.files);
  const sampleId = useStore((s) => s.sampleId);
  const setSample = useStore((s) => s.setSample);
  const setPhotoReport = useStore((s) => s.setPhotoReport);
  const [loading, setLoading] = useState(false);
  const slots = PRODUCTS[answers.visa].slots;
  const uploaded = slots.filter((s) => files[s]).length;

  const useSample = async () => {
    setLoading(true);
    const s = sampleById(answers.visa === 'family' ? 'nasreen' : 'ananya');
    const f = await buildSampleFiles(s);
    setSample(s.id, s.answers, s.profile, f);
    const ph = f.find((x) => x.slot === 'photo');
    if (ph?.blob) setPhotoReport(await analysePhoto(ph.blob));
    setLoading(false);
  };

  return (
    <div>
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Upload your documents</h2>
            <p className="mt-1 max-w-[56ch] text-[14px] text-muted">Upload everything now. Then I start filing, and I only stop to ask you when I need a code, a choice, a signature or a payment.</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={useSample} disabled={loading}>
            {loading ? <Spinner /> : <Sparkles size={14} aria-hidden />} Use sample documents
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {slots.map((slot) => (
            <SlotCard key={slot} slot={slot} file={files[slot]} />
          ))}
        </ul>
        {sampleId && <p className="mt-3 text-[13px] text-faint">Sample documents are fictional. Photos are drawn in your browser and checked on their real pixels.</p>}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" disabled={uploaded < slots.length} onClick={onStart}>
          Start filing
        </button>
        {uploaded < slots.length && <span className="text-[13.5px] text-muted">{slots.length - uploaded} more to upload</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ screen */

export function StartFlow({ onExit, onStart }: { onExit: () => void; onStart: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const answers = useStore((s) => s.answers);
  const files = useStore((s) => s.files);
  const { theme, toggle } = useTheme();
  const slots = PRODUCTS[answers.visa].slots;
  const uploaded = slots.filter((s) => files[s]).length;

  // A sample traveller already carries documents, so there is nothing to wait for on step 2.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3">
          <button type="button" onClick={onExit} className="rounded-lg" aria-label="Back to the Rihla site">
            <Wordmark />
          </button>
          <ol className="flex items-center gap-2 text-[13.5px]" aria-label="Steps">
            {[
              [1, 'Your trip'],
              [2, 'Documents'],
            ].map(([n, l]) => (
              <li key={n as number} className={cn('flex items-center gap-2 rounded-full px-3 py-1', step === n ? 'bg-[var(--brand-wash)] font-semibold text-brand' : 'text-muted')} aria-current={step === n ? 'step' : undefined}>
                <span className={cn('grid size-5 place-items-center rounded-full text-[11px] font-bold', step === n ? 'bg-brand text-[var(--on-brand)]' : 'bg-surface3 text-muted')}>{n}</span>
                {l}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
              <ArrowLeft size={14} aria-hidden /> Site
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{step === 1 ? <TripStep onNext={() => setStep(2)} /> : <DocsStep onBack={() => setStep(1)} onStart={onStart} />}</div>
        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Your application">
          <Ticket answers={answers} uploaded={uploaded} total={slots.length} />
          <p className="mt-4 text-[12.5px] text-faint">
            {fmtDate('2026-10-02') && 'Demo prices from reported fees for October 2026. Government fees go straight to the government.'}
          </p>
        </aside>
      </main>
    </div>
  );
}



