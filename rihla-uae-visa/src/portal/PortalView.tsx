import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, ShieldCheck } from 'lucide-react';
import type { DocSlotId, PortalPageId, VisaId } from '@/domain/types';
import { NATIONALITIES } from '@/domain/nationalities';
import { SLOTS } from '@/domain/visas';
import type { PortalState } from '@/agent/types';
import { STEPS } from './logic';
import { cn, fmtDate, formatBytes } from '@/lib/utils';

export interface PortalData {
  visa: VisaId;
  days: 30 | 60;
  payAmount: number;
  slots: DocSlotId[];
}

export interface PortalActions {
  setField(aid: string, value: string): void;
  setCheck(aid: string, value: boolean): void;
  submit(page: PortalPageId): void;
  chooseFile(slot: string): void;
  openStatus(): void;
  download(): void;
  approveSponsor(): void;
  continueSponsor(): void;
  testCard(): void;
}

interface Ctx {
  s: PortalState;
  data: PortalData;
  a: PortalActions;
  interactive: boolean;
}

/* ------------------------------------------------------------------ small controls */

function Field({ c, aid, label, placeholder, wide, type = 'text', hint, readOnly }: { c: Ctx; aid: string; label: string; placeholder?: string; wide?: boolean; type?: string; hint?: string; readOnly?: boolean }) {
  return (
    <div className={wide ? 'p-wide' : undefined}>
      <label className="p-label" htmlFor={`p-${aid}`}>
        {label}
      </label>
      <input
        id={`p-${aid}`}
        data-aid={aid}
        className="p-input"
        type={type}
        value={c.s.fields[aid] ?? ''}
        placeholder={placeholder}
        readOnly={readOnly || !c.interactive}
        autoComplete="off"
        onChange={(e) => c.a.setField(aid, e.target.value)}
      />
      {hint && <div style={{ fontSize: 12, color: 'var(--p-muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Select({ c, aid, label, options, wide }: { c: Ctx; aid: string; label: string; options: string[]; wide?: boolean }) {
  return (
    <div className={wide ? 'p-wide' : undefined}>
      <label className="p-label" htmlFor={`p-${aid}`}>
        {label}
      </label>
      <select id={`p-${aid}`} data-aid={aid} className="p-input" value={c.s.fields[aid] ?? ''} onChange={(e) => c.a.setField(aid, e.target.value)}>
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Page({ id, title, sub, children, c, actions }: { id: PortalPageId; title: string; sub?: string; children: ReactNode; c: Ctx; actions?: ReactNode }) {
  return (
    <section data-aid={`page:${id}`} className="p-card">
      <h1>{title}</h1>
      {sub && <p className="p-sub">{sub}</p>}
      {c.s.error && (
        <div className="p-error" role="alert" data-aid="error">
          {c.s.error}
        </div>
      )}
      {children}
      {actions && <div className="p-actions">{actions}</div>}
    </section>
  );
}

const Btn = ({ aid, onClick, children, ghost, small }: { aid: string; onClick: () => void; children: ReactNode; ghost?: boolean; small?: boolean }) => (
  <button type="button" data-aid={aid} className={cn('p-btn', ghost && 'p-ghost', small && 'p-small')} onClick={onClick}>
    {children}
  </button>
);

/* ------------------------------------------------------------------ pages */

const DECLARATIONS = [
  ['refused', 'Have you ever been refused entry to, or deported from, the UAE?'],
  ['overstay', 'Have you ever stayed in the UAE longer than your visa allowed?'],
  ['criminal', 'Have you ever been convicted of a criminal offence in any country?'],
  ['work', 'Do you plan to work or earn money during this visit?'],
] as const;

function Pages(c: Ctx) {
  const { s, data, a } = c;
  const f = (k: string) => s.fields[k] ?? '';
  switch (s.page) {
    case 'home':
      return (
        <Page id="home" title="Apply for a visit entry permit" sub="This is a simulated service for demonstration." c={c} actions={<Btn aid="home:start" onClick={() => a.submit('home')}>Start application</Btn>}>
          <div className="p-note">
            <strong>You will need:</strong> a valid passport, a passport-style photo, your travel booking and the documents listed for your visa type. Applications take about 10 minutes.
          </div>
        </Page>
      );
    case 'register':
      return (
        <Page id="register" title="Create your application account" sub="We will send a one-time code to confirm your email." c={c} actions={<Btn aid="register:send" onClick={() => a.submit('register')}>Send verification code</Btn>}>
          <div className="p-grid">
            <Field c={c} aid="register:email" label="Email address" placeholder="name@example.com" type="email" />
            <Field c={c} aid="register:phone" label="Mobile number" placeholder="+00 000 000 0000" />
          </div>
        </Page>
      );
    case 'verify':
      return (
        <Page id="verify" title="Verify your email" sub={`Enter the 6-digit code we sent to ${f('register:email') || 'your email'}.`} c={c} actions={<Btn aid="verify:submit" onClick={() => a.submit('verify')}>Verify and continue</Btn>}>
          <div style={{ maxWidth: 240 }}>
            <Field c={c} aid="verify:otp" label="Verification code" placeholder="000000" />
          </div>
        </Page>
      );
    case 'personal':
      return (
        <Page id="personal" title="Applicant details" sub="Enter these exactly as they appear in the passport." c={c} actions={<Btn aid="personal:next" onClick={() => a.submit('personal')}>Save and continue</Btn>}>
          <div className="p-grid">
            <Field c={c} aid="personal:given" label="Given names" />
            <Field c={c} aid="personal:surname" label="Surname" />
            <Field c={c} aid="personal:dob" label="Date of birth" placeholder="YYYY-MM-DD" />
            <Select c={c} aid="personal:sex" label="Sex" options={['Female', 'Male']} />
            <Field c={c} aid="personal:birthplace" label="Place of birth" />
            <Select c={c} aid="personal:nationality" label="Nationality" options={NATIONALITIES.map((n) => n.name)} />
            <Select c={c} aid="personal:marital" label="Marital status" options={['Single', 'Married', 'Divorced', 'Widowed']} />
            <Field c={c} aid="personal:profession" label="Profession" />
          </div>
        </Page>
      );
    case 'passport':
      return (
        <Page id="passport" title="Passport details" c={c} actions={<Btn aid="passport:next" onClick={() => a.submit('passport')}>Save and continue</Btn>}>
          <div className="p-grid">
            <Field c={c} aid="passport:number" label="Passport number" />
            <Field c={c} aid="passport:place" label="Place of issue" />
            <Field c={c} aid="passport:issued" label="Date of issue" placeholder="YYYY-MM-DD" />
            <Field c={c} aid="passport:expires" label="Date of expiry" placeholder="YYYY-MM-DD" />
          </div>
        </Page>
      );
    case 'travel':
      return (
        <Page id="travel" title="Travel details" c={c} actions={<Btn aid="travel:next" onClick={() => a.submit('travel')}>Save and continue</Btn>}>
          <div className="p-grid">
            <Select c={c} aid="travel:purpose" label="Purpose of visit" options={['Tourism', 'Visiting family or friends']} />
            <Select c={c} aid="travel:emirate" label="Emirate of arrival" options={['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah']} />
            <Field c={c} aid="travel:arrival" label="Arrival date" placeholder="YYYY-MM-DD" />
            <Field c={c} aid="travel:departure" label="Departure date" placeholder="YYYY-MM-DD" />
            <Field c={c} aid="travel:accommodation" label={data.visa === 'family' ? 'Address where you will stay' : 'Hotel name'} wide />
            <Field c={c} aid="travel:flight" label="Arrival flight number" />
          </div>
        </Page>
      );
    case 'sponsor':
      return (
        <Page id="sponsor" title="Sponsor details" sub="The UAE resident who invites you." c={c} actions={<Btn aid="sponsor:next" onClick={() => a.submit('sponsor')}>Save and continue</Btn>}>
          <div className="p-grid">
            <Field c={c} aid="sponsor:name" label="Sponsor's full name" />
            <Field c={c} aid="sponsor:eid" label="Emirates ID number" />
            <Field c={c} aid="sponsor:phone" label="Sponsor's mobile" />
            <Select c={c} aid="sponsor:relationship" label="Relationship to you" options={['Spouse', 'Parent', 'Child', 'Sibling', 'Friend']} />
            <Field c={c} aid="sponsor:salary" label="Sponsor's monthly salary (AED)" />
          </div>
        </Page>
      );
    case 'contact':
      return (
        <Page id="contact" title="Contact details" c={c} actions={<Btn aid="contact:next" onClick={() => a.submit('contact')}>Save and continue</Btn>}>
          <div className="p-grid">
            <Field c={c} aid="contact:email" label="Email address" readOnly placeholder={f('register:email')} />
            <Field c={c} aid="contact:phone" label="Mobile number" />
            <Field c={c} aid="contact:address" label="Home address" wide />
          </div>
        </Page>
      );
    case 'uploads':
      return (
        <Page id="uploads" title="Upload documents" sub="Photos must be 600 KB or less. Other files 2 MB or less." c={c} actions={<Btn aid="uploads:next" onClick={() => a.submit('uploads')}>Continue</Btn>}>
          {data.slots.map((slot) => {
            const u = s.uploads[slot];
            return (
              <div className="p-row" key={slot}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{SLOTS[slot].label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{u ? `${u.name} · ${formatBytes(u.bytes)}` : 'No file chosen'}</div>
                </div>
                <div style={{ width: 150, textAlign: 'right' }}>
                  {u?.status === 'ok' && <span className="p-ok">Accepted</span>}
                  {u?.status === 'uploading' && <span style={{ color: 'var(--p-muted)' }}>Uploading…</span>}
                  {u?.status === 'error' && <span className="p-bad">Rejected</span>}
                </div>
                <Btn aid={`upload:${slot}`} small ghost onClick={() => a.chooseFile(slot)}>
                  Choose file
                </Btn>
              </div>
            );
          })}
          {data.slots.some((sl) => s.uploads[sl]?.status === 'error') && (
            <div className="p-error" style={{ marginTop: 12 }}>
              {data.slots.map((sl) => s.uploads[sl]?.error && `${SLOTS[sl].label}: ${s.uploads[sl]?.error}`).filter(Boolean)[0]}
            </div>
          )}
        </Page>
      );
    case 'declarations':
      return (
        <Page id="declarations" title="Declarations" sub="Answer truthfully. A false declaration can lead to refusal." c={c} actions={<Btn aid="declarations:next" onClick={() => a.submit('declarations')}>Continue</Btn>}>
          {DECLARATIONS.map(([id, q]) => (
            <div className="p-q" key={id}>
              <div style={{ marginBottom: 8, fontWeight: 550 }}>{q}</div>
              <div className="p-radio">
                {(['yes', 'no'] as const).map((v) => (
                  <label key={v} data-aid={`decl:${id}:${v}`} onClick={() => a.setField(`decl:${id}`, v)}>
                    <input type="radio" name={`decl-${id}`} checked={f(`decl:${id}`) === v} readOnly />
                    {v === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </Page>
      );
    case 'review': {
      const rows: [string, string][] = [
        ['Applicant', `${f('personal:given')} ${f('personal:surname')}`],
        ['Date of birth', f('personal:dob')],
        ['Nationality', f('personal:nationality')],
        ['Passport', `${f('passport:number')}, expires ${f('passport:expires')}`],
        ['Visit', `${f('travel:purpose')} in ${f('travel:emirate')}`],
        ['Dates', `${f('travel:arrival')} to ${f('travel:departure')}`],
        ['Staying at', f('travel:accommodation')],
        ...(data.visa === 'family' ? ([['Sponsor', `${f('sponsor:name')} (${f('sponsor:relationship')})`]] as [string, string][]) : []),
        ['Documents', `${data.slots.filter((x) => s.uploads[x]?.status === 'ok').length} of ${data.slots.length} uploaded`],
      ];
      return (
        <Page id="review" title="Review and confirm" c={c} actions={<Btn aid="review:next" onClick={() => a.submit('review')}>Proceed</Btn>}>
          <dl className="p-kv" style={{ marginBottom: 16 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <label data-aid="review:confirm" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' }} onClick={() => a.setCheck('review:confirm', !s.checks['review:confirm'])}>
            <input type="checkbox" checked={!!s.checks['review:confirm']} readOnly style={{ marginTop: 3 }} />I confirm that the information is correct and complete.
          </label>
          <div style={{ maxWidth: 340 }}>
            <Field c={c} aid="review:signature" label="Applicant's full name (signature)" />
          </div>
        </Page>
      );
    }
    case 'sponsor_wait':
      return (
        <Page
          id="sponsor_wait"
          title={s.sponsorApproved ? 'Your sponsor approved' : 'Waiting for your sponsor'}
          sub={s.sponsorApproved ? 'You can continue to payment.' : `${f('sponsor:name') || 'Your sponsor'} must approve this application in their UAE Pass app.`}
          c={c}
          actions={<Btn aid="sponsor_wait:continue" onClick={() => a.continueSponsor()}>Continue to payment</Btn>}
        >
          <div className="p-note">{s.sponsorApproved ? 'Approval received.' : 'We are waiting for the approval. This page updates by itself.'}</div>
        </Page>
      );
    case 'payment':
      return (
        <Page id="payment" title="Pay the government fee" sub={`Entry permit, ${data.days} days. Total AED ${data.payAmount.toFixed(2)} including VAT.`} c={c} actions={<Btn aid="payment:next" onClick={() => a.submit('payment')}>{`Pay AED ${data.payAmount.toFixed(2)}`}</Btn>}>
          <div className="p-note" style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>Sandbox: no real money moves. Use the test card.</span>
            <Btn aid="payment:testcard" small ghost onClick={() => a.testCard()}>
              Fill test card
            </Btn>
          </div>
          <div className="p-grid">
            <Field c={c} aid="payment:card" label="Card number" placeholder="0000 0000 0000 0000" wide />
            <Field c={c} aid="payment:exp" label="Expiry" placeholder="MM/YY" />
            <Field c={c} aid="payment:cvc" label="Security code" placeholder="000" />
            <Field c={c} aid="payment:name" label="Name on card" wide />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 14, color: 'var(--p-muted)', fontSize: 12.5 }}>
            <ShieldCheck size={14} /> Card details go to the payment gateway, not to Rihla.
          </div>
        </Page>
      );
    case 'bank':
      return (
        <Page id="bank" title="Confirm with your bank" sub="Your bank sent a code by SMS to approve this payment." c={c} actions={<Btn aid="bank:next" onClick={() => a.submit('bank')}>Approve payment</Btn>}>
          <div style={{ maxWidth: 240 }}>
            <Field c={c} aid="bank:code" label="Bank code" placeholder="000000" />
          </div>
        </Page>
      );
    case 'done':
      return (
        <Page id="done" title="Application submitted" sub="Keep this reference. You will also receive an email." c={c} actions={<Btn aid="done:status" onClick={() => a.openStatus()}>View application status</Btn>}>
          <div className="p-note" style={{ fontSize: 16 }}>
            Reference <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{s.reference}</strong>
          </div>
        </Page>
      );
    case 'status':
      return (
        <Page id="status" title="Application status" c={c}>
          <dl className="p-kv" style={{ marginBottom: 16 }}>
            <dt>Reference</dt>
            <dd style={{ fontFamily: 'ui-monospace, monospace' }}>{s.reference}</dd>
            <dt>Status</dt>
            <dd className={s.status === 'approved' ? 'p-ok' : undefined}>{s.status === 'approved' ? 'Approved' : s.status === 'under_review' ? 'Under review' : 'Submitted'}</dd>
            <dt>Applicant</dt>
            <dd>
              {f('personal:given')} {f('personal:surname')}
            </dd>
            <dt>Dates</dt>
            <dd>{f('travel:arrival') && `${fmtDate(f('travel:arrival'))} to ${fmtDate(f('travel:departure'))}`}</dd>
          </dl>
          {s.status === 'approved' ? (
            <div className="p-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Entry permit</div>
                <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{s.permitDownloaded ? 'entry-permit.pdf downloaded' : 'entry-permit.pdf'}</div>
              </div>
              {s.permitDownloaded ? <span className="p-ok">Downloaded</span> : <Btn aid="status:download" small onClick={() => a.download()}>Download permit (PDF)</Btn>}
            </div>
          ) : (
            <div className="p-note">Your application is being reviewed. This page updates by itself.</div>
          )}
        </Page>
      );
  }
}

/* ------------------------------------------------------------------ agent pointer */

function AgentCursor({ s }: { s: PortalState }) {
  const { x, y, visible, clicking } = s.cursor;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20"
      initial={false}
      animate={{ x, y, opacity: visible ? 1 : 0 }}
      transition={{ x: { type: 'tween', duration: 0.5, ease: [0.22, 0.9, 0.24, 1] }, y: { type: 'tween', duration: 0.5, ease: [0.22, 0.9, 0.24, 1] }, opacity: { duration: 0.2 } }}
    >
      <div className="relative" style={{ transform: 'translate(-3px, -3px)' }}>
        {clicking && <span className="absolute -left-2 -top-2 size-7 rounded-full ring-pulse" />}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 2l15 7.2-6.4 1.8L9.4 17.5 3 2z" fill="var(--brand)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="absolute left-4 top-4 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--on-brand)]" style={{ background: 'var(--brand)' }}>
          Rihla
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ view */

function stepIndex(page: PortalPageId) {
  return STEPS.findIndex((st) => (st.pages as readonly string[]).includes(page));
}

export function PortalView({ state, data, actions, interactive }: { state: PortalState; data: PortalData; actions: PortalActions; interactive: boolean }) {
  const c: Ctx = { s: state, data, a: actions, interactive };
  const cur = stepIndex(state.page);

  // Spotlight the control a person has to use.
  useEffect(() => {
    if (!state.highlight) return;
    const el = document.querySelector<HTMLElement>(`[data-aid="${state.highlight}"]`);
    el?.classList.add('spotlight');
    const scroller = document.querySelector<HTMLElement>('[data-portal-scroll]');
    if (el && scroller) {
      const er = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      scroller.scrollBy({ top: er.top - sr.top - sr.height / 3, behavior: 'smooth' });
    }
    return () => el?.classList.remove('spotlight');
  }, [state.highlight, state.page]);

  return (
    <div className="portal relative h-full w-full overflow-hidden" data-portal-stage>
      {state.busy && <div className="p-loading" key={state.page} />}
      <div className={cn('h-full overflow-y-auto', !interactive || state.controller === 'agent' ? 'p-driving' : '')} data-portal-scroll>
        <header className="p-head">
          <div className="p-brand">
            <span className="p-emblem" aria-hidden>
              <Check size={15} color="#fff" strokeWidth={3} />
            </span>
            Entry Permit Service
            <span className="p-chip">SANDBOX</span>
          </div>
          <span style={{ color: 'var(--p-muted)', fontSize: 12.5 }}>{state.fields['register:email'] || 'Not signed in'}</span>
        </header>
        <nav className="p-steps" aria-label="Progress">
          {STEPS.map((st, i) => (
            <span key={st.id} className="p-step" data-state={i < cur ? 'done' : i === cur ? 'current' : 'todo'}>
              <i>{i < cur ? '✓' : i + 1}</i>
              {st.label}
            </span>
          ))}
        </nav>
        <main className="p-main">{Pages(c)}</main>
        <footer className="p-footer">A simulated portal for demonstration. It is not affiliated with any government.</footer>
      </div>
      <AgentCursor s={state} />
    </div>
  );
}
