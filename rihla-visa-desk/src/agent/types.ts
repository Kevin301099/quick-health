export type Level = 1 | 2 | 3;
export type Mode = 'e-authorisation' | 'visa' | 'watch';
export type Automation = 'full' | 'assisted' | 'watch';
export type Owner = 'agent' | 'you' | 'client';
export type Risk = 'low' | 'medium' | 'high';

export type StepId =
  | 'intake'
  | 'requirements'
  | 'advisory'
  | 'documents'
  | 'checks'
  | 'draft'
  | 'quote'
  | 'approval'
  | 'applicant'
  | 'submit'
  | 'track'
  | 'watch'
  | 'wrap';

export type StepStatus = 'pending' | 'running' | 'done' | 'needs_you' | 'waiting' | 'skipped';

export interface PlanStep {
  id: StepId;
  title: string;
  owner: Owner;
  status: StepStatus;
  note?: string;
}

export type DocKind =
  | 'passport'
  | 'emirates_id'
  | 'photo'
  | 'bank_statement'
  | 'employment_letter'
  | 'itinerary';

export interface Applicant {
  id: string;
  given: string;
  surname: string;
  arabic: string;
  role: string;
  sex: 'M' | 'F';
  dob: string;
  birthplace: string;
  passportNo: string;
  passportIssued: string;
  passportExpires: string;
  eidNo: string;
  eidExpires: string;
  eidEnglishName: string;
  occupation: string;
  employer: string;
  email: string;
  phone: string;
  balanceAED: number;
  /** Seeded imperfection used by the demo, e.g. a blurry stamp that lowers OCR confidence. */
  quirks?: { lowConfidenceBirthplace?: boolean };
}

export interface Trip {
  city: string;
  from: string;
  to: string;
  purpose: string;
  estCostAED: number;
  /** Hotel checkout offset in days against the flight return. Seeded for one demo case. */
  hotelCheckoutOffset?: number;
}

export interface DocField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  flag?: string;
}

export interface DocSpec {
  id: string;
  kind: DocKind;
  holderId?: string;
  filename: string;
  label: string;
  pages: number;
  fields: DocField[];
}

export interface Requirement {
  id: string;
  label: string;
  detail: string;
  who: Owner;
}

export interface Advisory {
  title: string;
  body: string;
  asOf: string;
  source: string;
  actions: string[];
}

export interface Corridor {
  id: 'uk-eta' | 'ca-eta' | 'us-b1b2' | 'etias';
  name: string;
  short: string;
  destination: string;
  code: string;
  mode: Mode;
  automation: Automation;
  steps: StepId[];
  gov: { currency: 'GBP' | 'CAD' | 'USD' | 'EUR'; perPerson: number; extras?: { label: string; amount: number }[] };
  rateToAED: number;
  serviceFeeAED: number;
  decision: string;
  validity: string;
  maxValidityMonths?: number;
  portal: string;
  sources: { label: string; domain: string }[];
  rulepack: string;
  reviewed: string;
  headline: string;
  requirements: Requirement[];
  perApplicantDocs: DocKind[];
  tripDocs: DocKind[];
  applicantOnly: { title: string; detail: string; steps: string[] };
  advisory?: Advisory;
  tracking: { label: string; detail: string }[];
  defaultTrip: { city: string; from: string; to: string; purpose: string; estCostAED: number };
}

export interface CaseMeta {
  id: string;
  title: string;
  client: { name: string; phone: string; ar?: string };
  applicantIds: string[];
  corridorId: Corridor['id'];
  trip: Trip;
  channel: 'WhatsApp' | 'Email';
  message: string;
  received: string;
}

export interface ConflictOption {
  id: string;
  label: string;
  detail: string;
  recommended?: boolean;
}

export interface Conflict {
  id: string;
  rule: string;
  risk: Risk;
  title: string;
  detail: string;
  evidence: { doc: string; field: string; value: string }[];
  options: ConflictOption[];
}

export interface FormField {
  key: string;
  label: string;
  value: string;
  source: string;
  by: 'agent' | 'applicant' | 'human';
  confidence?: number;
  locked?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  applicantOnly?: boolean;
  fields: FormField[];
}

export interface FormDraftData {
  portal: string;
  travellers: { id: string; name: string; sections: FormSection[] }[];
}

export interface FeeLine {
  label: string;
  qty: number;
  kind: 'government' | 'service' | 'tax';
  local?: string;
  aed: number;
}

export interface FeeQuoteData {
  lines: FeeLine[];
  totalAED: number;
  govAED: number;
  serviceAED: number;
  vatAED: number;
  rateNote: string;
}

export interface CaseData {
  docs: DocSpec[];
  docStatus: Record<string, 'queued' | 'reading' | 'done'>;
  conflicts: Conflict[];
  resolutions: Record<string, { option: string; by: 'agent' | 'human'; rule?: string }>;
  form: FormDraftData | null;
  edits: number;
  fees: FeeQuoteData | null;
  serviceFeeAED: number;
  approved: boolean;
  held: string[];
  applicantDone: boolean;
  references: { id: string; name: string; ref: string; outcome?: string }[];
  stats: { agentTasks: number; humanTasks: number; clientTasks: number };
  startedAt: number | null;
  finishedAt: number | null;
}

export type CaseStatus = 'new' | 'running' | 'needs_you' | 'waiting' | 'paused' | 'done' | 'watching';

export type AuditActor = 'agent' | 'human' | 'client' | 'system';

export interface AuditEntry {
  id: string;
  at: number;
  actor: AuditActor;
  action: string;
  detail?: string;
}

export type Item =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'text'; id: string; text: string; streaming: boolean }
  | {
      kind: 'tool';
      id: string;
      name: string;
      args: string;
      status: 'running' | 'done';
      result?: string;
      ms?: number;
    }
  | { kind: 'ui'; id: string; component: string; props: Record<string, unknown>; ready: boolean; pendingId?: string }
  | { kind: 'notice'; id: string; text: string; tone?: 'info' | 'warn' | 'ok' };

export interface PendingInterrupt {
  id: string;
  step: StepId;
  title: string;
  kind: 'approval' | 'input' | 'applicant';
  itemId: string;
  auto?: { at: number; reason: string };
}

export interface RunInfo {
  state: 'idle' | 'running' | 'paused' | 'waiting' | 'done' | 'stopped';
  runId: number;
}

export interface CaseRuntime {
  meta: CaseMeta;
  status: CaseStatus;
  plan: PlanStep[];
  items: Item[];
  audit: AuditEntry[];
  data: CaseData;
  pending: PendingInterrupt[];
  run: RunInfo;
  resolved: Record<string, unknown>;
}
