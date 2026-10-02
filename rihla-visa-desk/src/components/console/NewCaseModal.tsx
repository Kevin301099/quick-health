import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CORRIDOR_LIST } from '@/agent/fixtures/corridors';
import { PEOPLE_LIST } from '@/agent/fixtures/people';
import { nextCaseId, useStore } from '@/agent/store';
import type { Corridor } from '@/agent/types';
import { cn, fmtDate } from '@/lib/utils';

export function NewCaseModal({ onClose }: { onClose: () => void }) {
  const addCase = useStore((s) => s.addCase);
  const [corridorId, setCorridorId] = useState<Corridor['id']>('uk-eta');
  const [picked, setPicked] = useState<string[]>(['noura']);
  const corridor = CORRIDOR_LIST.find((c) => c.id === corridorId) as Corridor;
  const [from, setFrom] = useState(corridor.defaultTrip.from);
  const [to, setTo] = useState(corridor.defaultTrip.to);

  useEffect(() => {
    setFrom(corridor.defaultTrip.from);
    setTo(corridor.defaultTrip.to);
  }, [corridor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = picked.length > 0 && from && to && from <= to;

  const create = () => {
    if (!valid) return;
    const lead = PEOPLE_LIST.find((p) => p.id === picked[0])!;
    const surname = lead.surname.split(' ').slice(-1)[0];
    const last = lead.surname.replace('AL ', 'Al ').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
    const trip = { ...corridor.defaultTrip, from, to };
    addCase({
      id: nextCaseId(),
      title: `${last}${picked.length > 1 ? ' party' : ''} · ${trip.city}`,
      client: { name: `${lead.given.split(' ')[0].charAt(0)}${lead.given.split(' ')[0].slice(1).toLowerCase()} ${last}`, phone: lead.phone, ar: lead.arabic.split(' ')[0] },
      applicantIds: picked,
      corridorId,
      trip,
      channel: 'WhatsApp',
      message: `Hello, ${picked.length === 1 ? 'I am' : `${picked.length} of us are`} travelling to ${trip.city} from ${fmtDate(from)} to ${fmtDate(to)}. Can you take care of the ${corridor.short}?`,
      received: 'Just now',
    });
    void surname;
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New case">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="surface relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:rounded-b-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">New case</div>
            <h2 className="mt-1 font-display text-[26px] italic leading-tight text-fg">Open a sample case</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <fieldset className="mb-4">
          <legend className="eyebrow mb-2">Route</legend>
          <div className="grid grid-cols-2 gap-2">
            {CORRIDOR_LIST.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === corridorId}
                onClick={() => setCorridorId(c.id)}
                className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors', c.id === corridorId ? 'border-brass bg-[var(--brass-wash)]' : 'border-line hover:border-line-strong')}
              >
                <div className="text-[14px] font-medium text-fg">{c.short}</div>
                <div className="text-[12px] text-muted">{c.destination}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="eyebrow mb-2">Travellers</legend>
          <div className="flex flex-wrap gap-2">
            {PEOPLE_LIST.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                  className={cn('rounded-full border px-3 py-1.5 text-[13px] transition-colors', on ? 'border-brass bg-[var(--brass-wash)] text-fg' : 'border-line text-muted hover:text-fg')}
                >
                  {p.given.split(' ')[0].charAt(0) + p.given.split(' ')[0].slice(1).toLowerCase()} <span className="text-faint">· {p.role}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-faint">Try Aisha, whose passport expires soon, or set the trip after a passport expires to see a blocking flag.</p>
        </fieldset>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="trip-from" className="eyebrow mb-1 block">
              Leaving
            </label>
            <input id="trip-from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="trip-to" className="eyebrow mb-1 block">
              Returning
            </label>
            <input id="trip-to" type="date" className="field" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={create}>
            Create case
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
