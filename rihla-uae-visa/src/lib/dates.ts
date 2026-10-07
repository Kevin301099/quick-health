/*
  Date helpers shared by the web app and the API. ISO dates (YYYY-MM-DD) only, computed in UTC,
  so a date never shifts with the viewer's timezone. No dependencies: the API imports this file too.
*/

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-12-18 -> 18 Dec 2026 (no timezone surprises). */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
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

/** Whole days from one ISO date to another (to minus from). */
export function daysBetween(fromIso: string, toIso: string) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** The fixed "today" the demo is scripted around. Live code passes the real date instead. */
export const TODAY = '2026-10-02';

/** The real current date, as an ISO date in UTC. */
export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
