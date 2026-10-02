import type { DocSlotId, PortalPageId, VisaId } from './types';

/*
  DEMO RULE DATA. Compiled from public sources in early October 2026.
  Fees, durations and document lists change. Production needs a maintained rules service
  with a human reviewer, never a model's memory.
*/

export const RULES_REVIEWED = '2 Oct 2026';
export const VAT_RATE = 0.05;
export const SERVICE_FEE_AED = 99; // PLACEHOLDER: set the real service fee

export interface SlotSpec {
  id: DocSlotId;
  label: string;
  hint: string;
  accept: 'image' | 'any';
  sponsor?: boolean;
}

export const SLOTS: Record<DocSlotId, SlotSpec> = {
  passport: { id: 'passport', label: 'Passport', hint: 'The photo page. Valid for at least 6 months from arrival.', accept: 'any' },
  photo: { id: 'photo', label: 'Passport-style photo', hint: 'White or light plain background, 4.3 × 5.5 cm ratio, JPEG or PNG.', accept: 'image' },
  ticket: { id: 'ticket', label: 'Return or onward ticket', hint: 'A confirmed booking with your name and both dates.', accept: 'any' },
  hotel: { id: 'hotel', label: 'Hotel booking', hint: 'Where you will stay, with check-in and check-out dates.', accept: 'any' },
  insurance: { id: 'insurance', label: 'Travel health insurance', hint: 'A certificate that covers the UAE for your whole stay.', accept: 'any' },
  sponsor_id: { id: 'sponsor_id', label: "Sponsor's Emirates ID", hint: 'Front and back, still valid.', accept: 'any', sponsor: true },
  tenancy: { id: 'tenancy', label: "Sponsor's tenancy contract", hint: 'The Ejari tenancy contract for the home you will stay in.', accept: 'any', sponsor: true },
  salary: { id: 'salary', label: "Sponsor's salary certificate", hint: 'Issued by the employer in the last 3 months.', accept: 'any', sponsor: true },
  relationship: { id: 'relationship', label: 'Proof of relationship', hint: 'Marriage or birth certificate that shows how you are related.', accept: 'any', sponsor: true },
};

export interface Product {
  id: VisaId;
  name: string;
  short: string;
  blurb: string;
  fees: { 30: number; 60: number };
  slots: DocSlotId[];
  pages: PortalPageId[];
  processing: string;
  who: string;
}

export const PRODUCTS: Record<VisaId, Product> = {
  tourist: {
    id: 'tourist',
    name: 'Tourist visa',
    short: 'Tourist',
    blurb: 'For holidays and short visits. Single entry, 30 or 60 days.',
    fees: { 30: 252, 60: 352 },
    slots: ['passport', 'photo', 'ticket', 'hotel', 'insurance'],
    pages: ['home', 'register', 'verify', 'personal', 'passport', 'travel', 'contact', 'uploads', 'declarations', 'review', 'payment', 'bank', 'done'],
    processing: 'Listed at 48 hours. Not guaranteed.',
    who: 'Visitors who need a pre-arranged visa',
  },
  family: {
    id: 'family',
    name: 'Family and friends visit',
    short: 'Family visit',
    blurb: 'Visiting a relative or friend who lives in the UAE and sponsors you.',
    fees: { 30: 252, 60: 352 },
    slots: ['passport', 'photo', 'ticket', 'insurance', 'sponsor_id', 'tenancy', 'salary', 'relationship'],
    pages: ['home', 'register', 'verify', 'personal', 'passport', 'travel', 'sponsor', 'contact', 'uploads', 'declarations', 'review', 'sponsor_wait', 'payment', 'bank', 'done'],
    processing: 'Listed at 48 hours, after your sponsor approves.',
    who: 'Visitors with a resident sponsor',
  },
};

export interface Quote {
  govAED: number;
  govVatAED: number;
  govTotalAED: number;
  serviceAED: number;
  serviceVatAED: number;
  serviceTotalAED: number;
  totalAED: number;
}

export function quote(visa: VisaId, days: 30 | 60): Quote {
  const govAED = PRODUCTS[visa].fees[days];
  const govVatAED = Math.round(govAED * VAT_RATE * 100) / 100;
  const serviceAED = SERVICE_FEE_AED;
  const serviceVatAED = Math.round(serviceAED * VAT_RATE * 100) / 100;
  return {
    govAED,
    govVatAED,
    govTotalAED: govAED + govVatAED,
    serviceAED,
    serviceVatAED,
    serviceTotalAED: serviceAED + serviceVatAED,
    totalAED: govAED + govVatAED + serviceAED + serviceVatAED,
  };
}

/** Salary the sponsor needs, by how the visitor is related. */
export function sponsorSalaryNeeded(rel: string) {
  return rel === 'spouse' || rel === 'parent' || rel === 'child' ? 4000 : 8000;
}

export const SOURCES = [
  { label: 'GDRFA Dubai: tourist visa services', domain: 'gdrfad.gov.ae' },
  { label: 'ICP smart services', domain: 'icp.gov.ae' },
  { label: 'UAE government portal: tourist visa', domain: 'u.ae' },
];
