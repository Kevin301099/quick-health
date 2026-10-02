import type { Answers, DocSlotId, FileRef, Issue, PortalPageId, Profile } from '@/domain/types';
import type { PhotoReport } from '@/domain/photo';

export type PhaseId = 'docs' | 'checks' | 'portal' | 'signoff' | 'payment' | 'visa';
export type PhaseStatus = 'pending' | 'running' | 'needs_you' | 'done';

export interface Phase {
  id: PhaseId;
  title: string;
  status: PhaseStatus;
  note?: string;
}

export type AuditActor = 'agent' | 'you' | 'portal' | 'system';
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
  | { kind: 'tool'; id: string; name: string; args: string; status: 'running' | 'done'; result?: string; ms?: number }
  | { kind: 'ui'; id: string; component: string; props: Record<string, unknown>; ready: boolean; dock?: boolean }
  | { kind: 'action'; id: string; title: string; status: 'waiting' | 'done'; summary?: string; uiId: string }
  | { kind: 'notice'; id: string; text: string; tone?: 'info' | 'warn' | 'ok' };

export interface PendingAction {
  id: string;
  phase: PhaseId;
  title: string;
  uiId: string;
  actionId: string;
}

export type RunState = 'idle' | 'running' | 'paused' | 'waiting' | 'done' | 'stopped';

export interface UploadState {
  name: string;
  bytes: number;
  status: 'uploading' | 'ok' | 'error';
  error?: string;
}

export interface PortalState {
  page: PortalPageId;
  url: string;
  fields: Record<string, string>;
  checks: Record<string, boolean>;
  uploads: Record<string, UploadState>;
  staged: Record<string, { name: string; bytes: number }>;
  error: string | null;
  otp: { sent: boolean; code: string };
  bank: { sent: boolean; code: string };
  sponsorApproved: boolean;
  reference: string | null;
  status: 'draft' | 'submitted' | 'under_review' | 'approved';
  controller: 'agent' | 'user';
  highlight: string | null;
  note: string | null;
  cursor: { x: number; y: number; visible: boolean; clicking: boolean };
  busy: boolean;
  permitDownloaded: boolean;
}

export interface InboxMessage {
  id: string;
  at: number;
  from: string;
  subject: string;
  body: string;
  code?: string;
  unread: boolean;
}

export interface PermitData {
  number: string;
  holder: string;
  passportNo: string;
  type: string;
  days: number;
  enterBy: string;
  emirate: string;
}

export interface FlowData {
  issues: Issue[];
  resolutions: Record<string, string>;
  photo: PhotoReport | null;
  permit: PermitData | null;
  stats: { agent: number; you: number };
}

export interface AppSnapshot {
  answers: Answers;
  profile: Profile;
  files: Partial<Record<DocSlotId, FileRef>>;
}
