import type { Answers, DocSlotId, FileRef, Profile } from './types';
import { PRODUCTS } from './visas';
import { makeSamplePhoto } from './photo';

/* SAMPLE TRAVELLERS. Every person, number and document is fictional. */

export interface Sample {
  id: 'ananya' | 'nasreen';
  label: string;
  line: string;
  answers: Answers;
  profile: Profile;
  photo: { background: 'grey' | 'white'; skin: string; hair: string; shirt: string; long?: boolean };
}

export const SAMPLES: Sample[] = [
  {
    id: 'ananya',
    label: 'Ananya, India',
    line: 'Tourist visa, 30 days in Dubai',
    answers: { nationality: 'IN', hasPermit: false, visa: 'tourist', days: 30, arrival: '2026-11-15', departure: '2026-11-29', emirate: 'Dubai', relationship: 'friend' },
    profile: {
      given: 'ANANYA RAVI',
      surname: 'SHARMA',
      dob: '1992-06-18',
      sex: 'F',
      birthplace: 'PUNE',
      passportNo: 'Z9100234',
      passportIssued: '2019-08-20',
      passportExpires: '2029-08-19',
      passportPlace: 'MUMBAI',
      email: 'ananya.sharma@example.com',
      phone: '+91 98200 55012',
      address: '14 Lake View Road, Pune, India',
      profession: 'Product designer',
      marital: 'Single',
      flightNo: 'XA 204',
      arrivalDate: '2026-11-15',
      arrivalTime: '02:40',
      ticketName: 'SHARMA/ANANYA RAVI MS',
      hotelName: 'Marina Bay Residences',
      hotelCheckIn: '2026-11-14',
      hotelCheckOut: '2026-11-29',
      insurer: 'Safe Journeys Insurance',
      policyNo: 'SJ-7782019',
      insuranceName: 'ANANYA RAVI SHARMA',
      insuranceFrom: '2026-11-14',
      insuranceTo: '2026-12-14',
      sponsor: null,
    },
    photo: { background: 'grey', skin: '#c99774', hair: '#231a17', shirt: '#27405b', long: true },
  },
  {
    id: 'nasreen',
    label: 'Nasreen, Pakistan',
    line: 'Family visit, sponsored by her son in Dubai',
    answers: { nationality: 'PK', hasPermit: null, visa: 'family', days: 30, arrival: '2026-11-28', departure: '2026-12-26', emirate: 'Dubai', relationship: 'parent' },
    profile: {
      given: 'NASREEN',
      surname: 'HUSSAIN',
      dob: '1963-03-02',
      sex: 'F',
      birthplace: 'LAHORE',
      passportNo: 'AB4412096',
      passportIssued: '2022-01-10',
      passportExpires: '2030-05-14',
      passportPlace: 'LAHORE',
      email: 'nasreen.hussain@example.com',
      phone: '+92 300 5550143',
      address: '22 Gulberg Block C, Lahore, Pakistan',
      profession: 'Retired teacher',
      marital: 'Widowed',
      flightNo: 'XB 611',
      arrivalDate: '2026-11-28',
      arrivalTime: '14:25',
      ticketName: 'HUSSAIN/NASREEN MRS',
      hotelName: '',
      hotelCheckIn: '',
      hotelCheckOut: '',
      insurer: 'Safe Journeys Insurance',
      policyNo: 'SJ-8841102',
      insuranceName: 'NASRIN HUSSAIN',
      insuranceFrom: '2026-11-28',
      insuranceTo: '2026-12-28',
      sponsor: {
        name: 'Imran Hussain',
        emiratesId: '784-1986-7732190-3',
        eidExpires: '2028-02-11',
        phone: '+971 55 000 7781',
        salaryAED: 6500,
        tenancyExpires: '2027-06-30',
        address: 'Al Nahda 2, Dubai',
      },
    },
    photo: { background: 'white', skin: '#d6a784', hair: '#6d6a68', shirt: '#7a3b4a', long: false },
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id) as Sample;

const NAMES: Record<DocSlotId, (s: Sample) => { name: string; mime: string; bytes: number }> = {
  passport: (s) => ({ name: `${s.id}_passport.pdf`, mime: 'application/pdf', bytes: 412_000 }),
  photo: (s) => ({ name: `${s.id}_photo.jpg`, mime: 'image/jpeg', bytes: 0 }),
  ticket: (s) => ({ name: `${s.id}_flight_ticket.pdf`, mime: 'application/pdf', bytes: 188_000 }),
  hotel: (s) => ({ name: `${s.id}_hotel_booking.pdf`, mime: 'application/pdf', bytes: 143_000 }),
  insurance: (s) => ({ name: `${s.id}_health_insurance.pdf`, mime: 'application/pdf', bytes: 221_000 }),
  bank: (s) => ({ name: `${s.id}_bank_statements.pdf`, mime: 'application/pdf', bytes: 356_000 }),
  sponsor_id: () => ({ name: 'sponsor_emirates_id.jpg', mime: 'image/jpeg', bytes: 310_000 }),
  tenancy: () => ({ name: 'sponsor_tenancy_ejari.pdf', mime: 'application/pdf', bytes: 530_000 }),
  salary: () => ({ name: 'sponsor_salary_certificate.pdf', mime: 'application/pdf', bytes: 97_000 }),
  relationship: () => ({ name: 'birth_certificate.pdf', mime: 'application/pdf', bytes: 264_000 }),
};

/** Files for a sample traveller. The photo is a real image, drawn and encoded in the browser, so the checks run on real pixels. */
export async function buildSampleFiles(s: Sample): Promise<FileRef[]> {
  const out: FileRef[] = [];
  for (const slot of PRODUCTS[s.answers.visa].slots) {
    const meta = NAMES[slot](s);
    if (slot === 'photo') {
      const blob = await makeSamplePhoto(s.photo);
      out.push({ slot, name: meta.name, mime: 'image/jpeg', bytes: blob.size, sample: true, blob, url: URL.createObjectURL(blob) });
    } else {
      out.push({ slot, name: meta.name, mime: meta.mime, bytes: meta.bytes, sample: true });
    }
  }
  return out;
}
