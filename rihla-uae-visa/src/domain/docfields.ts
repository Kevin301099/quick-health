import type { Answers, DocField, DocSlotId, Profile } from './types';
import { fmtDate } from '@/lib/utils';
import { byCode } from './nationalities';

const f = (key: string, label: string, value: string, confidence = 0.98): DocField => ({ key, label, value, confidence });

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function passportDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

function mrz(p: Profile, country: string) {
  const sn = p.surname.replace(/\s+/g, '<');
  const gn = p.given.replace(/\s+/g, '<');
  const l1 = `P<${country}${sn}<<${gn}`.padEnd(44, '<').slice(0, 44);
  const dt = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  const l2 = `${p.passportNo}<8${country}${dt(p.dob)}1${p.sex || 'X'}${dt(p.passportExpires)}5`.padEnd(44, '<').slice(0, 44);
  return [l1, l2];
}

/** What the agent reads from each document of a sample traveller. Real uploads are typed by the person in the demo. */
export function docFields(slot: DocSlotId, p: Profile, a: Answers): DocField[] {
  const nat = byCode(a.nationality)?.name ?? '';
  const code = (a.nationality || 'XXX').padEnd(3, 'X').slice(0, 3);
  switch (slot) {
    case 'passport': {
      const [l1, l2] = mrz(p, code);
      return [
        f('surname', 'Surname', p.surname, 0.99),
        f('given', 'Given names', p.given, 0.99),
        f('nationality', 'Nationality', nat.toUpperCase(), 0.99),
        f('dob', 'Date of birth', passportDate(p.dob), 0.98),
        f('sex', 'Sex', p.sex, 0.99),
        f('pob', 'Place of birth', p.birthplace, 0.96),
        f('number', 'Passport number', p.passportNo, 0.99),
        f('issued', 'Date of issue', passportDate(p.passportIssued), 0.98),
        f('expires', 'Date of expiry', passportDate(p.passportExpires), 0.99),
        f('mrz1', 'MRZ line 1', l1, 0.99),
        f('mrz2', 'MRZ line 2', l2, 0.99),
      ];
    }
    case 'photo':
      return [f('shape', 'Shape', 'Checked below', 0.95), f('background', 'Background', 'Checked below', 0.95)];
    case 'ticket':
      return [
        f('name', 'Passenger', p.ticketName, 0.97),
        f('flight', 'Flight', p.flightNo, 0.98),
        f('arrive', 'Arrives', `${fmtDate(p.arrivalDate)}, ${p.arrivalTime}`, 0.96),
        f('depart', 'Return flight', fmtDate(a.departure), 0.97),
      ];
    case 'hotel':
      return [
        f('hotel', 'Hotel', p.hotelName, 0.96),
        f('in', 'Check-in', fmtDate(p.hotelCheckIn), 0.97),
        f('out', 'Check-out', fmtDate(p.hotelCheckOut), 0.97),
        f('guest', 'Guest', `${p.given} ${p.surname}`, 0.95),
      ];
    case 'insurance':
      return [
        f('insurer', 'Insurer', p.insurer, 0.96),
        f('policy', 'Policy number', p.policyNo, 0.97),
        f('holder', 'Insured person', p.insuranceName, 0.94),
        f('from', 'Cover from', fmtDate(p.insuranceFrom), 0.97),
        f('to', 'Cover to', fmtDate(p.insuranceTo), 0.97),
      ];
    case 'sponsor_id':
      return p.sponsor
        ? [
            f('name', 'Sponsor', p.sponsor.name, 0.97),
            f('eid', 'Emirates ID number', p.sponsor.emiratesId, 0.99),
            f('expires', 'Expiry', fmtDate(p.sponsor.eidExpires), 0.98),
          ]
        : [];
    case 'tenancy':
      return p.sponsor
        ? [f('tenant', 'Tenant', p.sponsor.name, 0.96), f('address', 'Address', p.sponsor.address, 0.93), f('until', 'Valid until', fmtDate(p.sponsor.tenancyExpires), 0.97)]
        : [];
    case 'salary':
      return p.sponsor ? [f('employee', 'Employee', p.sponsor.name, 0.96), f('salary', 'Monthly salary', `AED ${p.sponsor.salaryAED.toLocaleString('en-US')}`, 0.95)] : [];
    case 'relationship':
      return [f('a', 'Person one', `${p.given} ${p.surname}`, 0.95), f('b', 'Person two', p.sponsor?.name ?? '', 0.95), f('relation', 'Relationship', a.relationship, 0.92)];
  }
}
