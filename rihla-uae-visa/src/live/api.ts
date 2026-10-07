import type { Answers, Profile } from '@/domain/types';
import type { PhotoReport } from '@/domain/photo';
import type { AirlineId, OfficialSite, RouteId, RouteSpec } from '@/domain/routes';
import { safeStorage } from '@/lib/utils';

/*
  The live app talks to the Rihla API. It is switched on by building with NEXT_PUBLIC_API_URL;
  without it the site runs the self-contained demo, which is what the published preview shows.
*/

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const LIVE = API_URL.length > 0;

const TOKEN_KEY = 'rihla-session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const session = {
  get token() {
    return safeStorage().get(TOKEN_KEY);
  },
  set(token: string | null) {
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private windows can refuse storage; the session then lasts for this page only */
    }
    window.dispatchEvent(new Event('rihla:session'));
  },
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = session.token;
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  } catch {
    throw new ApiError(0, 'offline', 'We could not reach Rihla. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) {
    if (res.status === 401) session.set(null);
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

/**
 * A GET that only downloads when something changed: it sends back the tag from the last response and treats
 * an empty 304 as "same as before". Keeps polling cheap for the traveller's data plan and for the API.
 */
export async function getIfChanged<T>(path: string, etag: string | null): Promise<{ changed: false } | { changed: true; data: T; etag: string | null }> {
  const headers: Record<string, string> = {};
  const token = session.token;
  if (token) headers.authorization = `Bearer ${token}`;
  if (etag) headers['if-none-match'] = etag;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'offline', 'We could not reach Rihla. Check your connection and try again.');
  }
  if (res.status === 304) return { changed: false };
  const data = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) {
    if (res.status === 401) session.set(null);
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return { changed: true, data: data as T, etag: res.headers.get('etag') };
}

/* ------------------------------------------------------------------ shapes the API returns */

export interface Quote {
  currency: 'AED';
  days: 30 | 60;
  govFee: number;
  serviceFee: number;
  vat: number;
  total: number;
}

export interface Declaration {
  id: string;
  text: string;
  mustBe: boolean | null;
}

export interface LiveConfig {
  live: true;
  provider: 'sandbox' | 'manual' | 'partner_http';
  payments: 'fake' | 'stripe';
  extraction: 'on' | 'off';
  quotes: Record<'30' | '60', Quote>;
  slots: { required: string[]; optional: string[] };
  maxFileBytes: number;
  declarations: Declaration[];
  retentionDays: number;
  selfRetentionDays?: number;
  /** Ways to a visa this server offers. Older servers omit it and file everything through the partner. */
  routes?: RouteSpec[];
  airlines?: (OfficialSite & { id: AirlineId })[];
}

export type Status = 'draft' | 'ready_to_pay' | 'paid' | 'queued' | 'submitted' | 'processing' | 'needs_info' | 'approved' | 'rejected' | 'cancelled' | 'self_submitted';

export interface LiveDoc {
  id: string;
  slot: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  url?: string;
}

export interface Extraction {
  status: 'ok' | 'check' | 'not_passport' | 'unreadable' | 'unavailable' | 'failed';
  verified: boolean;
  attention: string[];
  note: string;
}

export interface LiveIssue {
  id: string;
  title: string;
  detail: string;
  risk: 'low' | 'medium' | 'high';
}

export interface LiveEvent {
  id: number;
  actor: string;
  type: string;
  data: Record<string, unknown>;
  at: string;
}

export interface LiveApplication {
  id: string;
  status: Status;
  route: RouteId;
  airline: AirlineId | null;
  selfRef: string | null;
  site: OfficialSite | null;
  slots: { required: string[]; optional: string[] };
  answers: Answers;
  profile: Partial<Profile>;
  photoReport: PhotoReport | null;
  checks: { issues: LiveIssue[]; passes: string[] } | null;
  declarations: Record<string, boolean> | null;
  signature: { name: string; at: string } | null;
  quote: Quote | null;
  payment: { status: string; amount?: number } | null;
  provider: string | null;
  providerRef: string | null;
  providerMessage: string | null;
  needs: { message: string; at: string } | null;
  permit: { number: string; validUntil?: string; available: boolean } | null;
  documents: LiveDoc[];
  extraction: Extraction | null;
  readiness: { missingDocs: string[]; missingFields: string[]; blocking: string[]; ready: boolean } | null;
  events: LiveEvent[];
  createdAt: string;
  updatedAt: string;
  purged: boolean;
}

/** Uploads a file straight to storage with the signed URL the API hands out, then confirms it. */
export async function uploadDocument(appId: string, slot: string, file: Blob, onProgress?: (p: number) => void) {
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  const start = await api<{ documentId: string; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }>(`/v1/applications/${appId}/documents`, {
    body: { slot, mime, bytes: file.size },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', start.upload.url);
    for (const [k, v] of Object.entries(start.upload.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'upload', 'The upload did not go through. Please try again.')));
    xhr.onerror = () => reject(new ApiError(0, 'upload', 'The upload did not go through. Check your connection and try again.'));
    xhr.send(file);
  });
  return api<{ document: LiveDoc; extraction: Extraction | null; application: LiveApplication }>(`/v1/applications/${appId}/documents/${start.documentId}/complete`, { method: 'POST' });
}
