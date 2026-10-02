import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const aed = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-12-18 -> 18 Dec 2026 (no timezone surprises). */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function clock(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function safeStorage() {
  return {
    get(key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage can be blocked; the app works without it */
      }
    },
  };
}

/** Whole years between an ISO date of birth and a reference ISO date. */
export function ageOn(dob: string, ref: string) {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ry, rm, rd] = ref.split('-').map(Number);
  let a = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) a -= 1;
  return a;
}

/** Whole months from one ISO date to another (can be negative). */
export function monthsBetween(fromIso: string, toIso: string) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return m;
}
