/*
  The pack: what the Rihla web app hands to the extension, in the traveller's own browser.
  It holds the details and documents the traveller prepared, never a login or a payment detail.
  It is kept on this device only, and deleted after 24 hours or when the traveller says so.
*/

export interface PackDocument {
  slot: 'passport' | 'photo' | 'ticket' | 'hotel' | 'insurance' | 'bank' | string;
  label: string;
  mime: string;
  name: string;
  /** The file itself, as a data: URL. */
  data: string;
}

export interface Pack {
  v: 1;
  applicationId: string;
  route: 'five_year' | 'airline';
  airline: string | null;
  site: { name: string; url: string; steps: string[] } | null;
  preparedAt: string;
  traveller: {
    given: string;
    surname: string;
    sex: 'M' | 'F' | '';
    dob: string;
    birthplace: string;
    nationality: { iso2: string; iso3: string; name: string };
    passportNo: string;
    passportType: string;
    passportIssued: string;
    passportExpires: string;
    email: string;
    phone: string;
    profession: string;
    address: string;
  };
  trip: { arrival: string; departure: string; emirate: string };
  documents: PackDocument[];
}

export interface StoredPack {
  pack: Pack;
  savedAt: number;
  expiresAt: number;
}

export const KEEP_MS = 24 * 60 * 60 * 1000;
export const MAX_PACK_CHARS = 40 * 1024 * 1024;

const isStr = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length <= max;
const isDate = (v: unknown) => v === '' || (isStr(v, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v));

/** Checks a pack from the web page before it is stored. Returns a reason when it is not acceptable. */
export function invalidPack(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'not an object';
  const x = p as Pack;
  if (x.v !== 1) return 'unknown version';
  if (!isStr(x.applicationId, 64)) return 'applicationId';
  if (x.route !== 'five_year' && x.route !== 'airline') return 'route';
  const t = x.traveller;
  if (!t || typeof t !== 'object') return 'traveller';
  for (const k of ['given', 'surname', 'birthplace', 'passportNo', 'passportType', 'email', 'phone', 'profession', 'address'] as const) if (!isStr(t[k])) return `traveller.${k}`;
  for (const k of ['dob', 'passportIssued', 'passportExpires'] as const) if (!isDate(t[k])) return `traveller.${k}`;
  if (!['M', 'F', ''].includes(t.sex)) return 'traveller.sex';
  if (!t.nationality || !isStr(t.nationality.iso2, 3) || !isStr(t.nationality.iso3, 3) || !isStr(t.nationality.name, 80)) return 'traveller.nationality';
  if (!x.trip || !isDate(x.trip.arrival) || !isDate(x.trip.departure) || !isStr(x.trip.emirate, 40)) return 'trip';
  if (!Array.isArray(x.documents) || x.documents.length > 12) return 'documents';
  for (const d of x.documents) {
    if (!isStr(d.slot, 20) || !isStr(d.label, 80) || !isStr(d.name, 120) || !isStr(d.mime, 40)) return 'document fields';
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(d.mime)) return 'document type';
    if (typeof d.data !== 'string' || !d.data.startsWith(`data:${d.mime};base64,`)) return 'document data';
  }
  return null;
}

export const fullName = (p: Pack) => `${p.traveller.given} ${p.traveller.surname}`.trim();
