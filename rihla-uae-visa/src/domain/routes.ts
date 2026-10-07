import type { DocSlotId } from './types';

/*
  How a traveller gets their UAE visa through Rihla.

  - five_year and airline are free: the traveller is the applicant on an official website, and Rihla prepares
    everything, then fills the form in the traveller's own browser (the Rihla filler extension). The traveller
    logs in, pays the government or airline, and presses submit. Rihla never submits and never holds their login.
  - partner is the paid 30- or 60-day tourist visa, filed by a licensed UAE tourism company. It needs a signed
    partner agreement, so it can be switched off (ROUTES on the API) until there is one.

  Facts below were compiled in October 2026 from public reports. Verify them before relying on them.
*/

export type RouteId = 'five_year' | 'airline' | 'partner';
export type AirlineId = 'emirates' | 'etihad' | 'flydubai' | 'airarabia';

export interface OfficialSite {
  name: string;
  url: string;
  /** What to open once signed in, in the site's own words where we know them. */
  steps: string[];
}

export interface RouteSpec {
  id: RouteId;
  name: string;
  short: string;
  free: boolean;
  who: string;
  stay: string;
  required: DocSlotId[];
  optional: DocSlotId[];
  /** Conditions the traveller confirms before choosing this route. */
  conditions: string[];
}

export const ROUTE_SPECS: Record<RouteId, RouteSpec> = {
  five_year: {
    id: 'five_year',
    name: '5-year multiple-entry tourist visa',
    short: '5-year visa',
    free: true,
    who: 'You apply yourself on the government website. No sponsor needed, open to every nationality.',
    stay: 'Up to 90 days a visit, at most 180 days a year, for five years',
    required: ['passport', 'photo', 'bank', 'insurance', 'ticket'],
    optional: ['hotel'],
    conditions: ['A bank balance of at least US$4,000 (AED 14,690) over the last six months', 'Health insurance that covers the UAE', 'A return ticket'],
  },
  airline: {
    id: 'airline',
    name: 'Visa through your airline',
    short: 'Airline visa',
    free: true,
    who: 'You apply yourself from your booking. The airline is the sponsor.',
    stay: '30 or 60 days, single entry',
    required: ['passport', 'photo'],
    optional: ['ticket', 'hotel', 'insurance'],
    conditions: ['A confirmed booking with Emirates, Etihad, flydubai or Air Arabia'],
  },
  partner: {
    id: 'partner',
    name: 'Tourist visa filed for you',
    short: 'Filed for you',
    free: false,
    who: 'A licensed UAE tourism company files it for you. You pay the government fee and our service fee.',
    stay: '30 or 60 days, single entry',
    required: ['passport', 'photo'],
    optional: ['ticket', 'hotel', 'insurance'],
    conditions: [],
  },
};

export const AIRLINES: Record<AirlineId, OfficialSite & { id: AirlineId }> = {
  emirates: { id: 'emirates', name: 'Emirates', url: 'https://www.emirates.com', steps: ['Sign in and open Manage booking', 'Choose your trip, then the option to apply for a UAE visa'] },
  etihad: { id: 'etihad', name: 'Etihad', url: 'https://www.etihad.com', steps: ['Sign in and open Manage booking', 'Choose your trip, then UAE visa'] },
  flydubai: { id: 'flydubai', name: 'flydubai', url: 'https://www.flydubai.com/en/plan/visas-and-passports/dubai-visas.aspx', steps: ['Open the visa page for your booking', 'Start a UAE visa application'] },
  airarabia: { id: 'airarabia', name: 'Air Arabia', url: 'https://www.airarabia.com', steps: ['Sign in and open your booking', 'Choose UAE visa'] },
};

/** Where the 5-year visa is applied for: GDRFA for Dubai, ICP for the other emirates. */
export function officialSiteFor(emirate: string): OfficialSite {
  return emirate === 'Dubai'
    ? {
        name: 'GDRFA Dubai',
        url: 'https://www.gdrfad.gov.ae',
        steps: ['Sign in with UAE PASS, or register as an individual (your email is confirmed with a code)', 'New application, then the 5-year tourism entry permit'],
      }
    : {
        name: 'ICP (federal)',
        url: 'https://icp.gov.ae',
        steps: ['Sign in to smart services with UAE PASS, or create an account', 'New application, then the 5-year multiple-entry tourist visa'],
      };
}

/** Official domains the filler recognises. Anything else gets a warning to check the address bar. */
export const OFFICIAL_DOMAINS = ['gdrfad.gov.ae', 'icp.gov.ae', 'u.ae', 'emirates.com', 'etihad.com', 'flydubai.com', 'airarabia.com'];
