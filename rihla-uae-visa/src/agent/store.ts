import { create } from 'zustand';
import type { Answers, DocSlotId, FileRef, Profile } from '@/domain/types';
import type { PhotoReport } from '@/domain/photo';
import type { AuditEntry, FlowData, InboxMessage, Item, PendingAction, Phase, PortalState, RunState } from './types';
import { uid } from '@/lib/utils';

export const emptyProfile = (): Profile => ({
  given: '',
  surname: '',
  dob: '',
  sex: '',
  birthplace: '',
  passportNo: '',
  passportIssued: '',
  passportExpires: '',
  passportPlace: '',
  email: '',
  phone: '',
  address: '',
  profession: '',
  marital: '',
  flightNo: '',
  arrivalDate: '',
  arrivalTime: '',
  ticketName: '',
  hotelName: '',
  hotelCheckIn: '',
  hotelCheckOut: '',
  insurer: '',
  policyNo: '',
  insuranceName: '',
  insuranceFrom: '',
  insuranceTo: '',
  sponsor: null,
});

export const defaultAnswers = (): Answers => ({
  nationality: '',
  hasPermit: null,
  visa: 'tourist',
  days: 30,
  arrival: '2026-11-15',
  departure: '2026-11-29',
  emirate: 'Dubai',
  relationship: 'parent',
});

export const PHASES: Omit<Phase, 'status'>[] = [
  { id: 'docs', title: 'Read documents' },
  { id: 'checks', title: 'Check everything' },
  { id: 'portal', title: 'File in the portal' },
  { id: 'signoff', title: 'Your sign-off' },
  { id: 'payment', title: 'Payment' },
  { id: 'visa', title: 'Your visa' },
];

export const freshPhases = (): Phase[] => PHASES.map((p) => ({ ...p, status: 'pending' as const }));

export const freshPortal = (): PortalState => ({
  page: 'home',
  url: 'sandbox.entry-permit.example/start',
  fields: {},
  checks: {},
  uploads: {},
  staged: {},
  error: null,
  otp: { sent: false, code: '' },
  bank: { sent: false, code: '' },
  sponsorApproved: false,
  reference: null,
  status: 'draft',
  controller: 'agent',
  highlight: null,
  note: null,
  cursor: { x: 40, y: 40, visible: false, clicking: false },
  busy: false,
  permitDownloaded: false,
});

export const freshData = (): FlowData => ({ issues: [], resolutions: {}, photo: null, permit: null, stats: { agent: 0, you: 0 } });

interface State {
  // inputs
  answers: Answers;
  files: Partial<Record<DocSlotId, FileRef>>;
  profile: Profile;
  sampleId: string | null;
  photoReport: PhotoReport | null;
  // run
  run: { state: RunState; id: number };
  phases: Phase[];
  items: Item[];
  pending: PendingAction[];
  audit: AuditEntry[];
  inbox: InboxMessage[];
  data: FlowData;
  portal: PortalState;
  speed: 1 | 2 | 4;

  setAnswers: (p: Partial<Answers>) => void;
  setFile: (slot: DocSlotId, f: FileRef | null) => void;
  setProfile: (p: Partial<Profile>) => void;
  setSample: (id: string | null, answers: Answers, profile: Profile, files: FileRef[]) => void;
  setPhotoReport: (r: PhotoReport | null) => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  patch: (fn: (s: State) => Partial<State>) => void;
  patchPortal: (p: Partial<PortalState> | ((s: PortalState) => Partial<PortalState>)) => void;
  addInbox: (m: Omit<InboxMessage, 'id' | 'at' | 'unread'>) => void;
  readInbox: () => void;
  resetRun: () => void;
  resetAll: () => void;
}

export const useStore = create<State>((set, get) => ({
  answers: defaultAnswers(),
  files: {},
  profile: emptyProfile(),
  sampleId: null,
  photoReport: null,
  run: { state: 'idle', id: 0 },
  phases: freshPhases(),
  items: [],
  pending: [],
  audit: [],
  inbox: [],
  data: freshData(),
  portal: freshPortal(),
  speed: 1,

  setAnswers: (p) => set((s) => ({ answers: { ...s.answers, ...p } })),
  setFile: (slot, f) =>
    set((s) => {
      const files = { ...s.files };
      if (f) files[slot] = f;
      else delete files[slot];
      return { files, ...(slot === 'photo' ? { photoReport: null } : {}) };
    }),
  setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
  setSample: (id, answers, profile, files) =>
    set(() => ({
      sampleId: id,
      answers,
      profile,
      files: Object.fromEntries(files.map((f) => [f.slot, f])),
      photoReport: null,
    })),
  setPhotoReport: (r) => set({ photoReport: r }),
  setSpeed: (speed) => set({ speed }),
  patch: (fn) => set((s) => fn(s)),
  patchPortal: (p) => set((s) => ({ portal: { ...s.portal, ...(typeof p === 'function' ? p(s.portal) : p) } })),
  addInbox: (m) => set((s) => ({ inbox: [{ ...m, id: uid('m'), at: Date.now(), unread: true }, ...s.inbox] })),
  readInbox: () => set((s) => ({ inbox: s.inbox.map((m) => ({ ...m, unread: false })) })),
  resetRun: () =>
    set({ run: { state: 'idle', id: get().run.id }, phases: freshPhases(), items: [], pending: [], audit: [], inbox: [], data: freshData(), portal: freshPortal() }),
  resetAll: () =>
    set({
      answers: defaultAnswers(),
      files: {},
      profile: emptyProfile(),
      sampleId: null,
      photoReport: null,
      run: { state: 'idle', id: get().run.id },
      phases: freshPhases(),
      items: [],
      pending: [],
      audit: [],
      inbox: [],
      data: freshData(),
      portal: freshPortal(),
    }),
}));

export const portalUrl = (page: string) => `sandbox.entry-permit.example/${page === 'home' ? 'start' : page.replace('_', '-')}`;
