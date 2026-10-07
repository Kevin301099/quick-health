/*
  The machine-readable zone at the bottom of a passport photo page (ICAO 9303, TD3: two lines of 44 characters).
  Its check digits let us prove a reading is right without trusting anyone, model included.
*/

const WEIGHTS = [7, 3, 1];

function charValue(ch: string) {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return 0; // '<' and anything unreadable
}

export function checkDigit(s: string) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * WEIGHTS[i % 3];
  return String(sum % 10);
}

export interface MrzResult {
  valid: boolean;
  failed: string[];
  surname: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  issuer: string;
  dateOfBirth: string;
  sex: 'M' | 'F' | '';
  dateOfExpiry: string;
}

const clean = (l: string) => l.toUpperCase().replace(/\s+/g, '').replace(/[«‹]/g, '<');

/** YYMMDD to YYYY-MM-DD. Birth dates pick the century that keeps them in the past. */
function mrzDate(yymmdd: string, kind: 'birth' | 'expiry', today: string) {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const nowYY = Number(today.slice(2, 4));
  const century = kind === 'expiry' ? 2000 : yy > nowYY ? 1900 : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

export function parseMrz(line1: string, line2: string, today = new Date().toISOString().slice(0, 10)): MrzResult | null {
  const a = clean(line1);
  const b = clean(line2);
  if (a.length !== 44 || b.length !== 44 || a[0] !== 'P') return null;
  const failed: string[] = [];
  const num = b.slice(0, 9);
  if (checkDigit(num) !== b[9]) failed.push('passport number');
  const dob = b.slice(13, 19);
  if (checkDigit(dob) !== b[19]) failed.push('date of birth');
  const exp = b.slice(21, 27);
  if (checkDigit(exp) !== b[27]) failed.push('expiry date');
  const personal = b.slice(28, 42);
  // An all-filler personal number may carry '<' or '0' as its check digit.
  if (b[42] !== '<' && checkDigit(personal) !== b[42]) failed.push('personal number');
  const composite = b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43);
  if (checkDigit(composite) !== b[43]) failed.push('composite');
  const [sur, giv = ''] = a.slice(5).split('<<');
  const sx = b[20];
  return {
    valid: failed.length === 0,
    failed,
    surname: sur.replace(/</g, ' ').trim(),
    givenNames: giv.replace(/</g, ' ').replace(/\s+/g, ' ').trim(),
    passportNumber: num.replace(/</g, ''),
    nationality: b.slice(10, 13).replace(/</g, ''),
    issuer: a.slice(2, 5).replace(/</g, ''),
    dateOfBirth: mrzDate(dob, 'birth', today),
    sex: sx === 'M' || sx === 'F' ? sx : '',
    dateOfExpiry: mrzDate(exp, 'expiry', today),
  };
}

/** Builds a valid TD3 MRZ. Used by tests and by the sample traveller. */
export function buildMrz(p: { surname: string; given: string; number: string; nationality: string; issuer?: string; dob: string; sex: 'M' | 'F'; expiry: string }) {
  const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n);
  const name = pad(`${p.surname.replace(/\s+/g, '<')}<<${p.given.replace(/\s+/g, '<')}`.toUpperCase(), 39);
  const l1 = `P<${pad(p.issuer ?? p.nationality, 3)}${name}`;
  const ymd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  const num = pad(p.number.toUpperCase(), 9);
  const dob = ymd(p.dob);
  const exp = ymd(p.expiry);
  const personal = '<'.repeat(14);
  const body = `${num}${checkDigit(num)}${pad(p.nationality, 3)}${dob}${checkDigit(dob)}${p.sex}${exp}${checkDigit(exp)}${personal}<`;
  const composite = body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43);
  return [l1, body + checkDigit(composite)] as const;
}
