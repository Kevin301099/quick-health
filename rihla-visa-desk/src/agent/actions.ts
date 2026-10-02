import type { GenUICtx } from '@/components/genui/types';
import { resolveInterrupt } from './engine';
import { useStore } from './store';
import { CORRIDORS } from './fixtures/corridors';
import { PEOPLE } from './fixtures/people';
import { buildQuote } from './fees';
import { uid } from '@/lib/utils';

/** The hands a generated card gets. Everything a person does inside a card goes through here and lands in the audit trail. */
export function makeUICtx(caseId: string): GenUICtx {
  const mutate = useStore.getState().mutate;
  return {
    caseId,
    readonly: false,
    resolve: (id, outcome, by = 'human') => {
      resolveInterrupt(caseId, id, outcome, by);
    },
    audit: (action, detail) =>
      mutate(caseId, (c) => ({ ...c, audit: [{ id: uid('a'), at: Date.now(), actor: 'human', action, detail }, ...c.audit] })),
    editField: (traveller, label, from, to) =>
      mutate(caseId, (c) => ({
        ...c,
        data: { ...c.data, edits: c.data.edits + 1, stats: { ...c.data.stats, humanTasks: c.data.stats.humanTasks + 1 } },
        audit: [{ id: uid('a'), at: Date.now(), actor: 'human', action: `Edited ${label} for ${traveller}`, detail: `${from} to ${to}` }, ...c.audit],
      })),
    setServiceFee: (n) =>
      mutate(caseId, (c) => {
        const corridor = CORRIDORS[c.meta.corridorId];
        const people = c.meta.applicantIds.filter((id) => !c.data.held.includes(id)).map((id) => PEOPLE[id]);
        return {
          ...c,
          data: { ...c.data, serviceFeeAED: n, fees: buildQuote(corridor, Math.max(1, people.length), n) },
          audit: [{ id: uid('a'), at: Date.now(), actor: 'human', action: 'Changed the service fee', detail: `AED ${n} per traveller` }, ...c.audit],
        };
      }),
  };
}
