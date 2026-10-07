import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { Answers } from '@/domain/types';
import { NATIONALITIES, checkEligibility } from '@/domain/nationalities';
import { ROUTE_SPECS, type AirlineId, type RouteId, type RouteSpec } from '@/domain/routes';
import { addDays, todayIso } from '@/lib/dates';
import { aed, cn } from '@/lib/utils';
import { Pill, Spinner } from '@/components/ui';
import { useStore } from '@/agent/store';
import { api, ApiError, type LiveApplication } from './api';
import { ErrorNote, Label, LiveHeader, PARTNER_STAGES, SELF_STAGES, Stages, go } from './chrome';
import { useLiveConfig, useMe } from './hooks';
import { SignIn } from './SignIn';

type Trip = Pick<Answers, 'nationality' | 'hasPermit' | 'days' | 'arrival' | 'departure' | 'emirate'>;

/** Step one of a real application: the trip, then sign-in, then the application exists on the server. */
export function LiveStart() {
  const me = useMe();
  const { config } = useLiveConfig();
  // The landing page's checker may already have chosen a passport.
  const preset = useStore((s) => s.answers);
  const today = todayIso();
  const [trip, setTrip] = useState<Trip>({
    nationality: preset.nationality || '',
    hasPermit: preset.hasPermit,
    days: 30,
    arrival: addDays(today, 21),
    departure: addDays(today, 30),
    emirate: 'Dubai',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Trip>) => setTrip((t) => ({ ...t, ...p }));
  // How the traveller applies. Servers without routes file everything through the partner.
  const routes: RouteSpec[] = config ? (config.routes ?? [ROUTE_SPECS.partner]) : [];
  const [route, setRoute] = useState<RouteId | null>(null);
  const [airline, setAirline] = useState<AirlineId | ''>('');
  const [meets, setMeets] = useState(false);
  useEffect(() => {
    if (routes.length === 1 && !route) setRoute(routes[0].id);
  }, [routes, route]);
  const spec = route ? ROUTE_SPECS[route] : null;
  const routeOk = !!route && (route !== 'airline' || !!airline) && (route !== 'five_year' || meets);

  const elig = checkEligibility(trip.nationality, trip.hasPermit);
  const isVisaGroup = NATIONALITIES.some((n) => n.code === trip.nationality && n.group === 'visa');
  const needs = elig.status === 'visa_required' && (!elig.askPermit || trip.hasPermit === false || isVisaGroup);
  const datesOk = !!trip.arrival && !!trip.departure && trip.departure > trip.arrival && trip.arrival >= today;
  const quote = config?.quotes[String(trip.days) as '30' | '60'];

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ application: LiveApplication }>('/v1/applications', { body: { answers: trip, route, airline: route === 'airline' ? airline : undefined } });
      go(`app-${r.application.id}`);
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-bg">
      <LiveHeader me={me}>
        <div className="hidden justify-center md:flex">
          <Stages current={0} names={spec?.free ? SELF_STAGES : PARTNER_STAGES} />
        </div>
      </LiveHeader>
      <main className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="font-display text-[clamp(30px,4vw,40px)] font-bold leading-[1.05] tracking-[-0.03em] balance">Your trip to the UAE</h1>
            <p className="mt-2 max-w-[56ch] text-[15.5px] text-muted pretty">A few questions, then your documents. Rihla reads and checks everything before anything is filed.</p>
          </div>

          <section className="card p-6" aria-labelledby="passport-h">
            <h2 id="passport-h" className="font-display text-[20px] font-semibold tracking-[-0.02em]">
              Your passport
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="live-nat">Nationality on your passport</Label>
                <select id="live-nat" className="field" value={trip.nationality} onChange={(e) => set({ nationality: e.target.value, hasPermit: null })}>
                  <option value="">Choose your passport</option>
                  {NATIONALITIES.filter((n) => n.code !== 'XX').map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
              {elig.askPermit && !isVisaGroup && (
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-medium text-muted">Valid US, UK or EU visa or residence permit?</legend>
                  <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
                    {(
                      [
                        [true, 'Yes'],
                        [false, 'No'],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={trip.hasPermit === v}
                        onClick={() => set({ hasPermit: v })}
                        className={cn('min-w-[72px] rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', trip.hasPermit === v ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}
                        style={trip.hasPermit === v ? { boxShadow: 'var(--shadow-soft)' } : undefined}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
            {trip.nationality && !(elig.askPermit && trip.hasPermit === null && !isVisaGroup) && (
              <div className={cn('mt-4 rounded-2xl p-4', needs ? 'bg-[var(--brand-wash)]' : 'bg-[var(--sun-wash)]')} role="status">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={needs ? 'brand' : 'sun'}>{needs ? 'Visa needed' : 'No pre-arranged visa needed'}</Pill>
                  <span className="font-display text-[17px] font-semibold">{needs ? 'You need a visa before you fly' : elig.headline}</span>
                </div>
                {!needs && <p className="mt-1.5 max-w-[62ch] text-[14px] text-muted">{elig.detail}</p>}
              </div>
            )}
          </section>

          {needs && routes.length > 0 && (
            <section className="card p-6" aria-labelledby="route-h">
              <h2 id="route-h" className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                How do you want to apply?
              </h2>
              <div role="radiogroup" aria-labelledby="route-h" className={cn('mt-4 grid gap-3', routes.length > 2 ? 'md:grid-cols-3' : 'sm:grid-cols-2')}>
                {routes.map((r) => {
                  const on = route === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setRoute(r.id)}
                      className={cn('flex h-full flex-col rounded-2xl border p-4 text-left transition-colors', on ? 'border-brand bg-[var(--brand-wash)]' : 'border-line bg-surface hover:border-[var(--line-strong)]')}
                    >
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="font-display text-[16.5px] font-semibold leading-snug tracking-[-0.01em] text-fg">{r.name}</span>
                        {on ? <Check size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden /> : null}
                      </span>
                      <span className="mt-2">
                        <Pill tone={r.free ? 'ok' : 'brand'}>{r.free ? 'Free with Rihla' : quote ? `${aed(quote.total, 2)}` : 'Paid'}</Pill>
                      </span>
                      <span className="mt-2.5 text-[13.5px] leading-snug text-muted">{r.who}</span>
                      <span className="mt-auto pt-3 text-[12.5px] text-faint">{r.stay}</span>
                    </button>
                  );
                })}
              </div>
              {route === 'airline' && config?.airlines && (
                <div className="mt-5 max-w-[360px]">
                  <Label htmlFor="live-airline">Which airline are you flying with?</Label>
                  <select id="live-airline" className="field" value={airline} onChange={(e) => setAirline(e.target.value as AirlineId)}>
                    <option value="">Choose your airline</option>
                    {config.airlines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[12.5px] text-faint">You need a confirmed booking with them. Flying another airline? Choose another way to apply.</p>
                </div>
              )}
              {route === 'five_year' && spec && (
                <div className="mt-5 rounded-2xl bg-surface2 p-4">
                  <div className="text-[14px] font-medium text-fg">You need all three</div>
                  <ul className="mt-2 space-y-1.5 text-[14px] text-muted">
                    {spec.conditions.map((c) => (
                      <li key={c} className="flex gap-2">
                        <Check size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center gap-2.5 text-[14px] font-medium text-fg">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={meets} onChange={(e) => setMeets(e.target.checked)} />I have all three
                  </label>
                </div>
              )}
            </section>
          )}

          {needs && routeOk && (
            <section className="card p-6" aria-labelledby="dates-h">
              <h2 id="dates-h" className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                {route === 'five_year' ? 'Your first trip' : 'Dates and visa length'}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="live-arrival">Arriving</Label>
                  <input id="live-arrival" type="date" className="field" min={today} value={trip.arrival} onChange={(e) => set({ arrival: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="live-departure">Leaving</Label>
                  <input id="live-departure" type="date" className="field" min={trip.arrival} value={trip.departure} onChange={(e) => set({ departure: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="live-emirate">Arriving in</Label>
                  <select id="live-emirate" className="field" value={trip.emirate} onChange={(e) => set({ emirate: e.target.value as Trip['emirate'] })}>
                    {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah'].map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                </div>
                {route === 'five_year' ? (
                  <p className="self-end text-[13.5px] text-muted">Up to 90 days a visit. The visa lasts five years, so you can come back.</p>
                ) : (
                  <fieldset>
                    <legend className="mb-1.5 text-[13px] font-medium text-muted">{route === 'airline' ? 'Visa length (choose the same with the airline)' : 'Tourist visa, single entry'}</legend>
                    <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-surface2 p-0.5">
                      {([30, 60] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={trip.days === d}
                          onClick={() => set({ days: d })}
                          className={cn('rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors', trip.days === d ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}
                          style={trip.days === d ? { boxShadow: 'var(--shadow-soft)' } : undefined}
                        >
                          {d} days
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
              {!datesOk && trip.arrival && trip.departure && <ErrorNote>Pick an arrival date from today on, and a leaving date after it.</ErrorNote>}
            </section>
          )}

          {needs && routeOk && datesOk && (me === null ? <SignIn note="Your passport and documents are personal, so we keep them under your email. We send a six-digit code; there is no password." /> : null)}

          {needs && routeOk && datesOk && me && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary btn-lg" onClick={create} disabled={busy}>
                {busy ? <Spinner /> : null} Continue to documents <ArrowRight size={17} aria-hidden />
              </button>
              <span className="text-[13.5px] text-muted">Signed in as {me.email}</span>
            </div>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Price">
          {spec?.free ? (
            <FreeTicket spec={spec} />
          ) : (
            <div className="ticket">
              <div className="ticket-body" style={{ ['--y' as string]: '46%' }}>
                <div className="px-6 pb-5 pt-6">
                  <div className="eyebrow">You pay at the end</div>
                  <div className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">UAE tourist visa</div>
                  <div className="mt-1 text-[14px] text-muted">{trip.days} days · single entry</div>
                </div>
                <div className="perf mx-6" />
                <div className="space-y-1.5 px-6 pb-6 pt-4 text-[13.5px]">
                  {quote ? (
                    <>
                      <Row k="Government fee" v={aed(quote.govFee, 2)} />
                      <Row k="Rihla service" v={aed(quote.serviceFee, 2)} />
                      <Row k="VAT" v={aed(quote.vat, 2)} />
                      <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                        <span className="eyebrow">Total</span>
                        <span className="font-display text-[28px] font-bold leading-none tracking-[-0.02em] tnum">{aed(quote.total, 2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2" aria-busy="true">
                      <div className="skeleton h-3 w-3/4" />
                      <div className="skeleton h-3 w-2/3" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

/** The price card for a route the traveller applies for themselves: Rihla costs nothing. */
function FreeTicket({ spec }: { spec: RouteSpec }) {
  return (
    <div className="ticket">
      <div className="ticket-body" style={{ ['--y' as string]: '44%' }}>
        <div className="px-6 pb-5 pt-6">
          <div className="eyebrow">You apply yourself</div>
          <div className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.03em]">{spec.name}</div>
          <div className="mt-1 text-[14px] text-muted">{spec.stay}</div>
        </div>
        <div className="perf mx-6" />
        <div className="space-y-1.5 px-6 pb-6 pt-4 text-[13.5px]">
          <Row k="Reading and checks" v="Free" />
          <Row k="Filling the form" v="Free" />
          <Row k="Visa fee" v={spec.id === 'airline' ? 'To the airline' : 'To GDRFA or ICP'} />
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="eyebrow">To Rihla</span>
            <span className="font-display text-[28px] font-bold leading-none tracking-[-0.02em] tnum">{aed(0)}</span>
          </div>
          <p className="pt-2 text-[12.5px] text-faint">You pay the visa fee on the official site, with your own card. Rihla never sees it.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{k}</span>
      <span className="font-mono tnum text-fg">{v}</span>
    </div>
  );
}
