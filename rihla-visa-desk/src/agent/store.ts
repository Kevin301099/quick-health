import { create } from 'zustand';
import type { CaseData, CaseMeta, CaseRuntime, Level, PlanStep, StepId } from './types';
import { CORRIDORS } from './fixtures/corridors';
import { SEED_CASES } from './fixtures/people';
import { clock } from '@/lib/utils';

export const STEP_META: Record<StepId, { title: string; owner: PlanStep['owner'] }> = {
  intake: { title: 'Read the request', owner: 'agent' },
  requirements: { title: 'Work out what applies', owner: 'agent' },
  advisory: { title: 'Check live advisories', owner: 'agent' },
  documents: { title: 'Collect and read documents', owner: 'agent' },
  checks: { title: 'Cross-check everything', owner: 'agent' },
  draft: { title: 'Fill the application', owner: 'agent' },
  quote: { title: 'Quote the fees', owner: 'agent' },
  approval: { title: 'Your approval', owner: 'you' },
  applicant: { title: 'Client confirms', owner: 'client' },
  submit: { title: 'Submit', owner: 'agent' },
  track: { title: 'Track the decision', owner: 'agent' },
  watch: { title: 'Watch for launch', owner: 'agent' },
  wrap: { title: 'Wrap up', owner: 'agent' },
};

export function emptyData(): CaseData {
  return {
    docs: [],
    docStatus: {},
    conflicts: [],
    resolutions: {},
    form: null,
    edits: 0,
    fees: null,
    serviceFeeAED: 0,
    approved: false,
    held: [],
    applicantDone: false,
    references: [],
    stats: { agentTasks: 0, humanTasks: 0, clientTasks: 0 },
    startedAt: null,
    finishedAt: null,
  };
}

export function initCase(meta: CaseMeta): CaseRuntime {
  const corridor = CORRIDORS[meta.corridorId];
  const data = emptyData();
  data.serviceFeeAED = corridor.serviceFeeAED;
  return {
    meta,
    status: 'new',
    plan: corridor.steps.map((id) => ({ id, ...STEP_META[id], status: 'pending' as const })),
    items: [],
    audit: [
      { id: 'a0', at: Date.now() - 1000 * 60 * 14, actor: 'system', action: 'Case opened', detail: `From ${meta.channel} · ${meta.received}` },
    ],
    data,
    pending: [],
    run: { state: 'idle', runId: 0 },
    resolved: {},
  };
}

export interface Settings {
  autonomy: Level;
  speed: 1 | 2 | 4;
  live: boolean;
}

interface State {
  cases: Record<string, CaseRuntime>;
  order: string[];
  activeId: string;
  settings: Settings;
  liveAvailable: boolean | null;
  setActive: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLiveAvailable: (v: boolean) => void;
  addCase: (meta: CaseMeta) => void;
  mutate: (id: string, fn: (c: CaseRuntime) => CaseRuntime) => void;
  reset: (id: string) => void;
}

const seed = Object.fromEntries(SEED_CASES.map((m) => [m.id, initCase(m)]));

export const useStore = create<State>((set, get) => ({
  cases: seed,
  order: SEED_CASES.map((m) => m.id),
  activeId: SEED_CASES[0].id,
  settings: { autonomy: 2, speed: 1, live: false },
  liveAvailable: null,
  setActive: (id) => set({ activeId: id }),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setLiveAvailable: (v) => set({ liveAvailable: v }),
  addCase: (meta) =>
    set((s) => ({
      cases: { ...s.cases, [meta.id]: initCase(meta) },
      order: [meta.id, ...s.order],
      activeId: meta.id,
    })),
  mutate: (id, fn) =>
    set((s) => {
      const cur = s.cases[id];
      if (!cur) return s;
      return { cases: { ...s.cases, [id]: fn(cur) } };
    }),
  reset: (id) =>
    set((s) => {
      const cur = s.cases[id];
      if (!cur) return s;
      return { cases: { ...s.cases, [id]: initCase(cur.meta) } };
    }),
}));

export function nextCaseId() {
  const ids = Object.keys(useStore.getState().cases)
    .map((k) => Number(k.replace('C-', '')))
    .filter((n) => !Number.isNaN(n));
  return `C-${Math.max(1045, ...ids) + 1}`;
}

export const stamp = () => clock(Date.now());
