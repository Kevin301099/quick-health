import type { Applicant, DocField, DocKind, DocSpec, Trip } from '../types';
import { fmtDate } from '@/lib/utils';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 1985-03-14 -> 14 MAR 1985, the way passports print dates. */
export function passportDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

function mrzDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${y.slice(2)}${m}${d}`;
}

function mrz(a: Applicant) {
  const sn = a.surname.replace(/\s+/g, '<');
  const gn = a.given.replace(/\s+/g, '<');
  const line1 = `P<ARE${sn}<<${gn}`.padEnd(44, '<').slice(0, 44);
  const line2 = `${a.passportNo}<9ARE${mrzDate(a.dob)}2${a.sex}${mrzDate(a.passportExpires)}4`.padEnd(44, '<').slice(0, 44);
  return [line1, line2];
}

function f(key: string, label: string, value: string, confidence = 0.98, flag?: string): DocField {
  return { key, label, value, confidence, flag };
}

function passport(a: Applicant): DocSpec {
  const [l1, l2] = mrz(a);
  const lowPob = a.quirks?.lowConfidenceBirthplace;
  return {
    id: `passport-${a.id}`,
    kind: 'passport',
    holderId: a.id,
    filename: `${a.id}_passport.pdf`,
    label: 'Passport',
    pages: 1,
    fields: [
      f('surname', 'Surname', a.surname, 0.99),
      f('given', 'Given names', a.given, 0.99),
      f('nationality', 'Nationality', 'UNITED ARAB EMIRATES', 0.99),
      f('dob', 'Date of birth', passportDate(a.dob), 0.98),
      f('sex', 'Sex', a.sex, 0.99),
      f('pob', 'Place of birth', lowPob ? a.birthplace.replace('ABU DHABI', 'ABU DHAB1') : a.birthplace, lowPob ? 0.72 : 0.96, lowPob ? 'Stamp overlaps the field' : undefined),
      f('number', 'Passport number', a.passportNo, 0.99),
      f('issued', 'Date of issue', passportDate(a.passportIssued), 0.98),
      f('expires', 'Date of expiry', passportDate(a.passportExpires), 0.99),
      f('mrz1', 'MRZ line 1', l1, 0.99),
      f('mrz2', 'MRZ line 2', l2, 0.99),
    ],
  };
}

function emiratesId(a: Applicant): DocSpec {
  return {
    id: `eid-${a.id}`,
    kind: 'emirates_id',
    holderId: a.id,
    filename: `${a.id}_emirates_id.jpg`,
    label: 'Emirates ID',
    pages: 2,
    fields: [
      f('idno', 'ID number', a.eidNo, 0.99),
      f('name_en', 'Name (English)', a.eidEnglishName, 0.95),
      f('name_ar', 'Name (Arabic)', a.arabic, 0.93),
      f('nationality', 'Nationality', 'United Arab Emirates', 0.98),
      f('dob', 'Date of birth', fmtDate(a.dob), 0.97),
      f('expires', 'Expiry date', fmtDate(a.eidExpires), 0.98),
    ],
  };
}

function photo(a: Applicant): DocSpec {
  return {
    id: `photo-${a.id}`,
    kind: 'photo',
    holderId: a.id,
    filename: `${a.id}_photo.jpg`,
    label: 'Photo',
    pages: 1,
    fields: [
      f('crop', 'Head size and crop', 'Within standard', 0.96),
      f('background', 'Background', 'Plain, light', 0.97),
      f('resolution', 'Resolution', '900 × 900 px', 0.99),
    ],
  };
}

function bank(a: Applicant, trip: Trip): DocSpec {
  return {
    id: `bank-${a.id}`,
    kind: 'bank_statement',
    holderId: a.id,
    filename: `${a.id}_bank_statement_3m.pdf`,
    label: 'Bank statement',
    pages: 4,
    fields: [
      f('holder', 'Account holder', `${a.given} ${a.surname}`, 0.96),
      f('period', 'Period', '1 Jul to 30 Sep 2026', 0.97),
      f('closing', 'Closing balance', `AED ${a.balanceAED.toLocaleString('en-US')}`, 0.98),
      f('salary', 'Salary credit', a.employer === 'None' ? 'None' : 'AED 31,500 monthly', 0.9),
    ],
  };
}

function employment(a: Applicant): DocSpec {
  return {
    id: `emp-${a.id}`,
    kind: 'employment_letter',
    holderId: a.id,
    filename: `${a.id}_employment_letter.pdf`,
    label: 'Employment letter',
    pages: 1,
    fields: [
      f('employer', 'Employer', a.employer, 0.97),
      f('position', 'Position', a.occupation, 0.96),
      f('salary', 'Monthly salary', 'AED 31,500', 0.94),
      f('leave', 'Approved leave', 'Yes', 0.9),
    ],
  };
}

function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function itinerary(trip: Trip): DocSpec {
  const checkout = shiftDate(trip.to, trip.hotelCheckoutOffset ?? 0);
  return {
    id: 'itinerary',
    kind: 'itinerary',
    filename: 'itinerary_flights_hotel.pdf',
    label: 'Itinerary',
    pages: 3,
    fields: [
      f('city', 'Destination', trip.city, 0.99),
      f('depart', 'Flight out', fmtDate(trip.from), 0.98),
      f('return', 'Flight back', fmtDate(trip.to), 0.98),
      f('checkin', 'Hotel check-in', fmtDate(trip.from), 0.97),
      f('checkout', 'Hotel check-out', fmtDate(checkout), 0.97),
    ],
  };
}

export function buildDocs(applicants: Applicant[], trip: Trip, perApplicant: DocKind[], tripDocs: DocKind[]): DocSpec[] {
  const out: DocSpec[] = [];
  for (const a of applicants) {
    for (const k of perApplicant) {
      if (k === 'passport') out.push(passport(a));
      if (k === 'emirates_id') out.push(emiratesId(a));
      if (k === 'photo') out.push(photo(a));
    }
  }
  const lead = applicants[0];
  for (const k of tripDocs) {
    if (k === 'bank_statement') out.push(bank(lead, trip));
    if (k === 'employment_letter') out.push(employment(lead));
    if (k === 'itinerary') out.push(itinerary(trip));
  }
  return out;
}

export const DOC_ICON_LABEL: Record<DocKind, string> = {
  passport: 'Passport',
  emirates_id: 'Emirates ID',
  photo: 'Photo',
  bank_statement: 'Bank statement',
  employment_letter: 'Employment letter',
  itinerary: 'Itinerary',
};
