import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ImageUp, Inbox, Send, X as XIcon } from 'lucide-react';
import type { Answers, FileRef, Issue, Profile } from '@/domain/types';
import type { PhotoReport as PhotoReportData } from '@/domain/photo';
import { useStore } from '@/agent/store';
import { PRODUCTS, quote } from '@/domain/visas';
import type { CardProps } from './types';
import { Pill, Spinner } from '../ui';
import { aed, cn, fmtDate } from '@/lib/utils';

/* Cards the person acts on. They sit in the "Your turn" dock, so they carry no frame of their own. */

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={cn('block min-w-0', wide && 'col-span-2')}>
      <span className="mb-1 block text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function openInbox() {
  window.dispatchEvent(new CustomEvent('rihla:open-inbox'));
}

/* ------------------------------------------------------------------ confirm details */

type Form = Profile & { arrival: string; departure: string; emirate: string };

export function ConfirmDetails({ props, act }: CardProps<{ sample: boolean }>) {
  const profile = useStore((s) => s.profile);
  const answers = useStore((s) => s.answers);
  const visa = answers.visa;
  const [f, setF] = useState<Form>(() => ({
    ...profile,
    arrival: answers.arrival,
    departure: answers.departure,
    emirate: answers.emirate,
    sponsor: profile.sponsor ?? (visa === 'family' ? { name: '', emiratesId: '', eidExpires: '', phone: '', salaryAED: 0, tenancyExpires: '', address: '' } : null),
  }));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const setSp = (k: keyof NonNullable<Profile['sponsor']>, v: string) =>
    setF((cur) => ({ ...cur, sponsor: { ...(cur.sponsor as NonNullable<Profile['sponsor']>), [k]: k === 'salaryAED' ? Number(v) || 0 : v } }));

  const missing = useMemo(() => {
    const need: [string, string][] = [
      [f.given, 'Given names'],
      [f.surname, 'Surname'],
      [f.dob, 'Date of birth'],
      [f.sex, 'Sex'],
      [f.passportNo, 'Passport number'],
      [f.passportExpires, 'Passport expiry'],
      [f.email, 'Email'],
      [f.phone, 'Phone'],
      [f.address, 'Address'],
      [f.flightNo, 'Flight'],
      [f.arrivalDate, 'Arrival date on the ticket'],
      [f.insuranceFrom, 'Insurance start'],
      [f.insuranceTo, 'Insurance end'],
      ...(visa === 'tourist' ? ([[f.hotelName, 'Hotel']] as [string, string][]) : []),
      ...(visa === 'family' ? ([[f.sponsor?.name ?? '', 'Sponsor name'], [f.sponsor?.emiratesId ?? '', 'Sponsor Emirates ID'], [String(f.sponsor?.salaryAED || ''), 'Sponsor salary'], [f.sponsor?.eidExpires ?? '', 'Sponsor ID expiry'], [f.sponsor?.tenancyExpires ?? '', 'Tenancy end']] as [string, string][]) : []),
    ];
    return need.filter(([v]) => !String(v).trim()).map(([, n]) => n);
  }, [f, visa]);

  const submit = () => {
    const { arrival, departure, emirate, ...rest } = f;
    const profileOut: Partial<Profile> = {
      ...rest,
      ticketName: rest.ticketName || `${rest.surname}/${rest.given}`,
      insuranceName: rest.insuranceName || `${rest.given} ${rest.surname}`,
      passportPlace: rest.passportPlace || rest.birthplace,
      hotelCheckIn: rest.hotelCheckIn || (visa === 'tourist' ? arrival : ''),
      hotelCheckOut: rest.hotelCheckOut || (visa === 'tourist' ? departure : ''),
    };
    act({ profile: profileOut, answers: { arrival, departure, emirate } });
  };

  const input = (k: keyof Form, type = 'text') => (
    <input className="field" type={type} value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
  );

  return (
    <div>
      <p className="mb-3 text-[14px] text-muted">
        {props.sample ? 'This is what I read from your documents. Fix anything that is wrong.' : 'Type the details from your documents. I cannot read your own files in this demo yet.'}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <div className="eyebrow col-span-2 pt-1">Passport</div>
        <Row label="Given names">{input('given')}</Row>
        <Row label="Surname">{input('surname')}</Row>
        <Row label="Date of birth">{input('dob', 'date')}</Row>
        <Row label="Sex">
          <select className="field" value={f.sex} onChange={(e) => set('sex', e.target.value as Form['sex'])}>
            <option value="">Select</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
        </Row>
        <Row label="Place of birth">{input('birthplace')}</Row>
        <Row label="Marital status">
          <select className="field" value={f.marital} onChange={(e) => set('marital', e.target.value)}>
            <option value="">Select</option>
            {['Single', 'Married', 'Divorced', 'Widowed'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Row>
        <Row label="Passport number">{input('passportNo')}</Row>
        <Row label="Place of issue">{input('passportPlace')}</Row>
        <Row label="Issued">{input('passportIssued', 'date')}</Row>
        <Row label="Expires">{input('passportExpires', 'date')}</Row>

        <div className="eyebrow col-span-2 pt-2">You</div>
        <Row label="Email">{input('email', 'email')}</Row>
        <Row label="Mobile">{input('phone')}</Row>
        <Row label="Home address" wide>{input('address')}</Row>
        <Row label="Profession">{input('profession')}</Row>

        <div className="eyebrow col-span-2 pt-2">Trip</div>
        <Row label="Flight number">{input('flightNo')}</Row>
        <Row label="Name on the ticket">{input('ticketName')}</Row>
        <Row label="Arrival date on the ticket">{input('arrivalDate', 'date')}</Row>
        <Row label="Arrival time">{input('arrivalTime', 'time')}</Row>
        <Row label="Arriving (your plan)">{input('arrival', 'date')}</Row>
        <Row label="Leaving">{input('departure', 'date')}</Row>
        {visa === 'tourist' && (
          <>
            <Row label="Hotel" wide>{input('hotelName')}</Row>
            <Row label="Hotel check-in">{input('hotelCheckIn', 'date')}</Row>
            <Row label="Hotel check-out">{input('hotelCheckOut', 'date')}</Row>
          </>
        )}

        <div className="eyebrow col-span-2 pt-2">Insurance</div>
        <Row label="Insurer">{input('insurer')}</Row>
        <Row label="Policy number">{input('policyNo')}</Row>
        <Row label="Insured person" wide>{input('insuranceName')}</Row>
        <Row label="Covered from">{input('insuranceFrom', 'date')}</Row>
        <Row label="Covered to">{input('insuranceTo', 'date')}</Row>

        {visa === 'family' && f.sponsor && (
          <>
            <div className="eyebrow col-span-2 pt-2">Your sponsor</div>
            <Row label="Name"><input className="field" value={f.sponsor.name} onChange={(e) => setSp('name', e.target.value)} /></Row>
            <Row label="Mobile"><input className="field" value={f.sponsor.phone} onChange={(e) => setSp('phone', e.target.value)} /></Row>
            <Row label="Emirates ID number"><input className="field" value={f.sponsor.emiratesId} onChange={(e) => setSp('emiratesId', e.target.value)} /></Row>
            <Row label="Emirates ID expires"><input className="field" type="date" value={f.sponsor.eidExpires} onChange={(e) => setSp('eidExpires', e.target.value)} /></Row>
            <Row label="Monthly salary (AED)"><input className="field" inputMode="numeric" value={f.sponsor.salaryAED || ''} onChange={(e) => setSp('salaryAED', e.target.value)} /></Row>
            <Row label="Tenancy valid until"><input className="field" type="date" value={f.sponsor.tenancyExpires} onChange={(e) => setSp('tenancyExpires', e.target.value)} /></Row>
            <Row label="Where you will stay" wide><input className="field" value={f.sponsor.address} onChange={(e) => setSp('address', e.target.value)} /></Row>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={missing.length > 0} onClick={submit}>
          Looks right. Continue
        </button>
        {missing.length > 0 && <span className="text-[12.5px] text-faint">Still needed: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ fix an issue */

const RISK: Record<string, { tone: 'ok' | 'sun' | 'attn'; label: string }> = {
  low: { tone: 'ok', label: 'Small' },
  medium: { tone: 'sun', label: 'Needs your choice' },
  high: { tone: 'attn', label: 'Blocks filing' },
};

function Evidence({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((e, i) => (
        <div key={i} className="min-w-0 rounded-xl border border-line bg-surface2 px-3 py-1.5">
          <div className="eyebrow">{e.label}</div>
          <div className="break-words font-mono text-[13px] text-fg">{e.value}</div>
        </div>
      ))}
    </div>
  );
}

export function FixIssue({ props, act }: CardProps<{ issue: Issue }>) {
  const { issue } = props;
  const risk = RISK[issue.risk];
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] font-semibold leading-snug">{issue.title}</h3>
        <Pill tone={risk.tone}>{risk.label}</Pill>
      </div>
      <p className="mt-1 text-[14px] text-muted pretty">{issue.detail}</p>
      <Evidence items={issue.evidence} />
      <ul className="ledger mt-4 rounded-xl border border-line">
        {issue.options.map((o) => (
          <li key={o.id} className="flex flex-col gap-2 px-3 py-2.5 @md:flex-row @md:items-center @md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-medium">
                {o.label}
                {o.recommended && <Pill tone="brand">Recommended</Pill>}
              </div>
              <div className="text-[13px] text-muted">{o.detail}</div>
            </div>
            <button type="button" className={cn('btn btn-sm shrink-0', o.recommended ? 'btn-primary' : 'btn-outline')} onClick={() => act({ option: o.id })}>
              Choose this
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ photo */

async function fileToRef(file: File): Promise<FileRef> {
  const url = URL.createObjectURL(file);
  return { slot: 'photo', name: file.name, bytes: file.size, mime: file.type || 'image/jpeg', sample: false, blob: file, url };
}

function PhotoPicker({ onPick, label, primary }: { onPick: (f: FileRef) => void; label: string; primary?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onPick(await fileToRef(f));
        }}
      />
      <button type="button" className={cn('btn btn-sm', primary ? 'btn-primary' : 'btn-outline')} onClick={() => ref.current?.click()}>
        <ImageUp size={15} aria-hidden /> {label}
      </button>
    </>
  );
}

export function PhotoFix({ props, act }: CardProps<{ issue: Issue; beforeUrl?: string }>) {
  const { issue } = props;
  const canFix = issue.options.some((o) => o.id === 'fix');
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] font-semibold leading-snug">{issue.title}</h3>
        <Pill tone={RISK[issue.risk].tone}>{RISK[issue.risk].label}</Pill>
      </div>
      <div className="mt-3 flex gap-4">
        <div className="w-[96px] shrink-0 overflow-hidden rounded-lg border border-line bg-surface2" style={{ aspectRatio: '4.3 / 5.5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {props.beforeUrl && <img src={props.beforeUrl} alt="Your photo" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-muted pretty">{issue.detail}</p>
          <ul className="mt-2 space-y-1">
            {issue.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <XIcon size={14} className="mt-[3px] shrink-0 text-attn" aria-hidden />
                <span>
                  {e.label} <span className="text-muted">{e.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canFix && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => act({ option: 'fix' })}>
            Fix it for me
          </button>
        )}
        <PhotoPicker label="Upload a new photo" primary={!canFix} onPick={(file) => act({ option: 'new', file })} />
      </div>
    </div>
  );
}

export function PhotoReview({ props, act }: CardProps<{ beforeUrl?: string; afterUrl: string; report: PhotoReportData }>) {
  return (
    <div>
      <h3 className="font-display text-[18px] font-semibold leading-snug">Check the fixed photo</h3>
      <p className="mt-1 text-[14px] text-muted">I lightened the background and kept everything else. Look at it before I use it.</p>
      <div className="mt-3 flex gap-4">
        {[
          ['Before', props.beforeUrl],
          ['After', props.afterUrl],
        ].map(([label, url]) => (
          <div key={label} className="w-[104px] shrink-0">
            <div className="overflow-hidden rounded-lg border border-line bg-surface2" style={{ aspectRatio: '4.3 / 5.5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
            </div>
            <div className="eyebrow mt-1.5">{label}</div>
          </div>
        ))}
        <ul className="min-w-0 flex-1 space-y-1">
          {props.report.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[13px]">
              {c.ok ? <Check size={14} className="mt-[3px] shrink-0 text-ok" aria-hidden /> : <XIcon size={14} className="mt-[3px] shrink-0 text-attn" aria-hidden />}
              <span>
                {c.label} <span className="text-muted">{c.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => act({ option: 'accept' })}>
          Use the fixed photo
        </button>
        <PhotoPicker label="Upload a different one" onPick={(file) => act({ option: 'new', file })} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ one-time code */

export function EnterCode({ props, act }: CardProps<{ purpose: string; sentTo: string; attempt: number }>) {
  const [code, setCode] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) act({ code });
      }}
    >
      <h3 className="font-display text-[18px] font-semibold leading-snug">Enter the code from your email</h3>
      <p className="mt-1 text-[14px] text-muted">
        The portal sent a 6-digit code to <span className="font-medium text-fg">{props.sentTo}</span>. I cannot see your inbox, so please read it to me.
      </p>
      {props.attempt > 0 && <p className="mt-2 text-[13.5px] font-medium text-attn">That code did not work. Use the newest email.</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium text-muted">6-digit code</span>
          <input className="field w-[170px] text-center font-mono text-[20px] tracking-[0.3em]" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={code.length !== 6}>
          Send to the portal
        </button>
        <button type="button" className="btn btn-outline" onClick={openInbox}>
          <Inbox size={15} aria-hidden /> Open my inbox
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ declarations */

const QUESTIONS: [string, string][] = [
  ['refused', 'Have you ever been refused entry to, or deported from, the UAE?'],
  ['overstay', 'Have you ever stayed in the UAE longer than your visa allowed?'],
  ['criminal', 'Have you ever been convicted of a criminal offence in any country?'],
  ['work', 'Do you plan to work or earn money during this visit?'],
];

export function Declarations({ act }: CardProps) {
  const [a, setA] = useState<Record<string, 'yes' | 'no'>>({});
  const done = QUESTIONS.every(([id]) => a[id]);
  return (
    <div>
      <h3 className="font-display text-[18px] font-semibold leading-snug">Answer the declarations</h3>
      <p className="mt-1 text-[14px] text-muted">These are your answers to give. I will type exactly what you choose, and nothing else.</p>
      <ul className="ledger mt-3">
        {QUESTIONS.map(([id, q]) => (
          <li key={id} className="flex flex-col gap-2 py-3 @md:flex-row @md:items-center @md:justify-between">
            <span className="text-[14.5px] text-fg">{q}</span>
            <div role="radiogroup" aria-label={q} className="inline-flex shrink-0 rounded-xl border border-line bg-surface2 p-0.5">
              {(['yes', 'no'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={a[id] === v}
                  onClick={() => setA((cur) => ({ ...cur, [id]: v }))}
                  className={cn('min-w-[64px] rounded-[10px] px-3 py-1.5 text-[13.5px] font-medium transition-colors', a[id] === v ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg')}
                  style={a[id] === v ? { boxShadow: 'var(--shadow-soft)' } : undefined}
                >
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary mt-3" disabled={!done} onClick={() => act({ answers: a })}>
        Confirm my answers
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ sign-off */

export function SignOff({ props, act }: CardProps<{ name: string }>) {
  const answers = useStore((s) => s.answers);
  const profile = useStore((s) => s.profile);
  const q = quote(answers.visa, answers.days);
  const [ok, setOk] = useState(false);
  const [sig, setSig] = useState('');
  const matches = sig.trim().toLowerCase() === props.name.trim().toLowerCase();
  return (
    <div>
      <h3 className="font-display text-[18px] font-semibold leading-snug">Approve and sign</h3>
      <p className="mt-1 text-[14px] text-muted">Everything in the portal matches your documents. Check the summary, then sign.</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface2 p-3 text-[13.5px]">
        <dt className="text-muted">Visa</dt>
        <dd className="text-right font-medium">{PRODUCTS[answers.visa].name}, {answers.days} days</dd>
        <dt className="text-muted">Applicant</dt>
        <dd className="text-right font-medium">{props.name}</dd>
        <dt className="text-muted">Dates</dt>
        <dd className="text-right font-medium">{fmtDate(answers.arrival)} to {fmtDate(answers.departure)}</dd>
        <dt className="text-muted">Passport</dt>
        <dd className="text-right font-mono">{profile.passportNo}</dd>
        <dt className="text-muted">Government fee next</dt>
        <dd className="text-right font-mono">{aed(q.govTotalAED, 2)}</dd>
      </dl>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[14px]">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I confirm the information is true and complete, and I let Rihla submit it for me.</span>
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[12.5px] font-medium text-muted">Type your full name as in your passport: {props.name}</span>
        <input className="field max-w-[360px]" value={sig} onChange={(e) => setSig(e.target.value)} placeholder={props.name} />
      </label>
      <button type="button" className="btn btn-primary mt-4" disabled={!ok || !matches} onClick={() => act({ signature: props.name })}>
        Approve and submit
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ pay */

export function PayHandover({ props }: CardProps<{ amount: number }>) {
  const page = useStore((s) => s.portal.page);
  const steps = [
    { id: 'payment', label: 'Enter your card in the portal', hint: 'Use the sandbox test card button if you like' },
    { id: 'bank', label: 'Approve with your bank code', hint: 'The code arrives in your inbox' },
    { id: 'done', label: 'Get the reference number', hint: 'I take over again from here' },
  ];
  const cur = Math.max(0, steps.findIndex((s) => s.id === page));
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] font-semibold leading-snug">Pay AED {props.amount.toFixed(2)} in the portal</h3>
        <Pill tone="attn">Your turn</Pill>
      </div>
      <p className="mt-1 text-[14px] text-muted pretty">I am paused and the portal is yours. I never see or store your card details.</p>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2', i === cur ? 'bg-[var(--attn-wash)]' : 'bg-surface2')}>
            <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold', i < cur ? 'bg-ok text-[var(--on-ok)]' : i === cur ? 'bg-attn text-[var(--on-attn)]' : 'bg-surface3 text-muted')}>
              {i < cur ? <Check size={13} /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-fg">{s.label}</div>
              <div className="text-[12.5px] text-muted">{s.hint}</div>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-outline btn-sm mt-3" onClick={openInbox}>
        <Inbox size={15} aria-hidden /> Open my inbox
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ sponsor */

export function SponsorApproval({ props, act }: CardProps<{ sponsor: string; phone: string; visitor: string }>) {
  const first = props.sponsor.split(' ')[0];
  const message = `Hi ${first}, ${props.visitor}'s UAE visit application is ready. Please approve it in your UAE Pass app. It takes a minute.`;
  const [sent, setSent] = useState(false);
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] font-semibold leading-snug">{first} has to approve this</h3>
        <Pill tone="attn">Waiting for {first}</Pill>
      </div>
      <p className="mt-1 text-[14px] text-muted">The sponsor approves in the UAE Pass app. I cannot do that for them. Send them this message:</p>
      <div className="mt-3 rounded-2xl rounded-tl-md bg-surface2 p-3 text-[14px]">{message}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSent(true)}>
          <Send size={14} aria-hidden /> {sent ? 'Marked as sent' : `Mark as sent to ${props.phone}`}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => act({ approved: true })}>
          Simulate {first} approving
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-faint">The demo cannot reach a real UAE Pass. In production this waits for the real approval.</p>
      {sent && <Spinner size={12} className="hidden" />}
    </div>
  );
}
