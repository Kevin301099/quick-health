import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw } from 'lucide-react';
import { aed, cn, fmtDate } from '@/lib/utils';
import { Pill, Spinner } from '@/components/ui';
import { api, ApiError, type LiveApplication, type Status } from './api';
import { CopyRow, ErrorNote, Label, LiveHeader, StatusPill } from './chrome';
import { useMe } from './hooks';
import { SignIn } from './SignIn';

/*
  The ops console: where your team files prepared applications on the licensed partner's portal (manual mode),
  answers "needs info" cases, uploads the issued visa, and refunds when something cannot be filed.
*/

interface Row {
  id: string;
  status: Status;
  name: string;
  nationality: string;
  days: number;
  arrival: string;
  providerRef: string | null;
  paidAt: string | null;
  updatedAt: string;
  flagged: string[];
}

interface Packet {
  visa: { days: number };
  traveller: Record<string, string>;
  trip: Record<string, string>;
  documents: { slot: string; mime: string; url: string }[];
  declarations: Record<string, boolean>;
  signature: { name: string; at: string };
}

const QUEUES: { id: string; label: string }[] = [
  { id: 'queued', label: 'To file' },
  { id: 'submitted', label: 'Filed' },
  { id: 'processing', label: 'Under review' },
  { id: 'needs_info', label: 'Waiting on traveller' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'paid', label: 'Paid, not filed' },
];

export function OpsConsole() {
  const me = useMe();
  const [queue, setQueue] = useState('queued');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([api<{ applications: Row[]; counts: Record<string, number> }>(`/v1/ops/applications?status=${queue}`), api<Usage>('/v1/ops/usage')]);
      setRows(r.applications);
      setCounts(r.counts);
      setUsage(u);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [queue]);

  useEffect(() => {
    if (!me?.ops) return;
    void load();
    // Refresh while someone is looking; a hidden tab costs nothing.
    const t = window.setInterval(() => !document.hidden && void load(), 30_000);
    const onVisible = () => !document.hidden && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [me, load]);

  return (
    <div className="min-h-full bg-bg">
      <LiveHeader me={me} />
      <main className="mx-auto max-w-[1180px] px-6 py-8">
        {me === null && <SignIn title="Sign in to the ops console" note="Only emails listed in OPS_EMAILS on the server can open this console." />}
        {me && !me.ops && <p className="card p-6 text-[15px]">This account ({me.email}) is not on the ops list.</p>}
        {me?.ops && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <section className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Ops</h1>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
                  <RefreshCw size={14} aria-hidden /> Refresh
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Queues">
                {QUEUES.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    role="tab"
                    aria-selected={queue === q.id}
                    onClick={() => {
                      setQueue(q.id);
                      setOpen(null);
                    }}
                    className={cn('rounded-full border px-3 py-1.5 text-[13px] font-medium', queue === q.id ? 'border-brand bg-[var(--brand-wash)] text-brand' : 'border-line text-muted hover:text-fg')}
                  >
                    {q.label} <span className="font-mono tnum">{counts[q.id] ?? 0}</span>
                  </button>
                ))}
              </div>
              {usage && <SpendLine usage={usage} />}
              <ErrorNote>{error}</ErrorNote>
              <ul className="ledger mt-4 rounded-2xl border border-line bg-surface">
                {rows === null && (
                  <li className="p-4">
                    <Spinner />
                  </li>
                )}
                {rows?.length === 0 && <li className="p-4 text-[14px] text-muted">Nothing here.</li>}
                {rows?.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setOpen(r.id)} className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-left', open === r.id && 'bg-surface2')}>
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-semibold text-fg">{r.name || 'No name yet'}</span>
                        <span className="block font-mono text-[12px] text-faint">
                          {r.nationality} · {r.days}d · arrives {fmtDate(r.arrival)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {r.flagged.length > 0 && <Pill tone="sun">Declared yes</Pill>}
                        <StatusPill status={r.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="min-w-0">{open ? <OpsDetail key={open} id={open} onChange={load} /> : <p className="card p-6 text-[14.5px] text-muted">Choose an application to see everything needed to file it.</p>}</section>
          </div>
        )}
      </main>
    </div>
  );
}

interface Usage {
  month: { calls: number; costUsd: number; budgetUsd: number; applications: number; perApplicationUsd: number };
  today: { calls: number; costUsd: number };
  models: { main: string; fast: string | null };
}

const usd = (n: number) => (n === 0 ? '$0' : `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`);

/** What passport reading has cost this month, against the budget that pauses it. */
function SpendLine({ usage }: { usage: Usage }) {
  const { month } = usage;
  const share = month.budgetUsd > 0 ? Math.min(1, month.costUsd / month.budgetUsd) : 0;
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span>
          Passport reading this month <span className="font-mono font-semibold text-fg tnum">{usd(month.costUsd)}</span>
          {month.budgetUsd > 0 && <span className="tnum"> of {usd(month.budgetUsd)}</span>}
        </span>
        <span className="tnum">
          {month.applications} applications · {usd(month.perApplicationUsd)} each
        </span>
      </div>
      {month.budgetUsd > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface2" aria-hidden>
          <div className={cn('h-full rounded-full', share >= 0.9 ? 'bg-attn' : 'bg-brand')} style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function OpsDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [data, setData] = useState<{ application: LiveApplication; packet: Packet | null } | null>(null);
  const [message, setMessage] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setData(await api(`/v1/ops/applications/${id}`)), [id]);
  useEffect(() => {
    void load().catch((e: ApiError) => setError(e.message));
  }, [load]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
      onChange();
      setMessage('');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (state: string, extra: Record<string, unknown> = {}) => act(state, () => api(`/v1/ops/applications/${id}/status`, { body: { state, message: message || undefined, ...extra } }));

  const approve = () =>
    act('approved', async () => {
      if (!permitFile) throw new ApiError(422, 'permit', 'Choose the visa PDF first.');
      const up = await api<{ key: string; upload: { url: string; headers: Record<string, string> } }>(`/v1/ops/applications/${id}/permit-upload`, { method: 'POST' });
      const r = await fetch(up.upload.url, { method: 'PUT', headers: up.upload.headers, body: permitFile });
      if (!r.ok) throw new ApiError(r.status, 'upload', 'The visa upload failed.');
      await api(`/v1/ops/applications/${id}/status`, { body: { state: 'approved', permitNumber, permitKey: up.key, message: message || undefined } });
    });

  if (!data) return <div className="card p-6">{error ? <ErrorNote>{error}</ErrorNote> : <Spinner />}</div>;
  const { application: a, packet } = data;
  const t = packet?.traveller ?? {};

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[24px] font-semibold tracking-[-0.02em]">
            {t.given} {t.surname}
          </h2>
          <StatusPill status={a.status} />
        </div>
        <p className="mt-1 font-mono text-[12.5px] text-faint">
          {a.id} {a.providerRef ? `· ${a.providerRef}` : ''} {a.quote ? `· ${aed(a.quote.total, 2)}` : ''}
        </p>
        {packet && (
          <>
            <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">For the partner portal</h3>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {[
                ['Visa', `Tourist, ${packet.visa.days} days, single entry`],
                ['Given names', t.given],
                ['Surname', t.surname],
                ['Sex', t.sex],
                ['Date of birth', t.dob],
                ['Nationality', t.nationality],
                ['Place of birth', t.birthplace],
                ['Passport number', t.passportNo],
                ['Passport issued', t.passportIssued],
                ['Passport expires', t.passportExpires],
                ['Mobile', t.phone],
                ['Email', t.email],
                ['Profession', t.profession],
                ['Arrival', packet.trip.arrival],
                ['Departure', packet.trip.departure],
                ['Emirate', packet.trip.emirate],
              ].map(([k, v]) => (
                <CopyRow key={k} k={k} v={v ?? ''} />
              ))}
            </dl>
            <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Documents</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {packet.documents.map((d) => (
                <li key={d.slot}>
                  <a className="btn btn-outline btn-sm" href={d.url} target="_blank" rel="noreferrer">
                    {d.slot} <ExternalLink size={13} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Declarations</h3>
            <ul className="mt-2 grid gap-1 text-[13.5px] sm:grid-cols-2">
              {Object.entries(packet.declarations).map(([k, v]) => (
                <li key={k} className={cn(v && !['truthful', 'authorise'].includes(k) && 'font-semibold text-[var(--sun-ink)]')}>
                  {k.replace('_', ' ')}: {v ? 'yes' : 'no'}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12.5px] text-faint">
              Signed by {packet.signature.name} on {new Date(packet.signature.at).toLocaleString()}
            </p>
          </>
        )}
      </div>

      {['approved', 'rejected', 'cancelled'].includes(a.status) ? (
        <p className="card p-6 text-[14px] text-muted">This application is decided. {a.status === 'approved' ? 'The traveller can download the visa from their page.' : ''}</p>
      ) : (
      <div className="card p-6">
        <h3 className="font-display text-[19px] font-semibold">Update</h3>
        <Label htmlFor="ops-message" hint="Shown to the traveller">
          Message
        </Label>
        <textarea id="ops-message" rows={2} className="field !h-auto py-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="For example: Please upload a photo with a white background" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void setStatus('submitted')}>
            Mark filed
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void setStatus('processing')}>
            Under review
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || !message} onClick={() => void setStatus('needs_info')}>
            Ask traveller
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void setStatus('rejected')}>
            Rejected
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy || a.payment?.status !== 'paid'} onClick={() => void act('refund', () => api(`/v1/ops/applications/${id}/refund`, { method: 'POST' }))}>
            Refund
          </button>
        </div>
        <div className="mt-5 grid gap-3 rounded-2xl bg-surface2 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="ops-permit-no">Visa number</Label>
            <input id="ops-permit-no" className="field font-mono" value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ops-permit-file">Visa PDF</Label>
            <input id="ops-permit-file" type="file" accept="application/pdf" className="block w-full text-[13px]" onChange={(e) => setPermitFile(e.target.files?.[0] ?? null)} />
          </div>
          <button type="button" className="btn btn-primary" disabled={!!busy || !permitNumber || !permitFile} onClick={() => void approve()}>
            {busy === 'approved' ? <Spinner /> : <Check size={15} aria-hidden />} Approve
          </button>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
      )}
    </div>
  );
}
