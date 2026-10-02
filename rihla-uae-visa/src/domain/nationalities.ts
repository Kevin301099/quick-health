export type Group = 'free90' | 'conditional' | 'visa' | 'unknown';

export interface Nationality {
  code: string;
  name: string;
  group: Group;
}

/* Demo list. Compiled in October 2026 from public reports of the UAE entry rules. Verify before relying on it. */
export const NATIONALITIES: Nationality[] = [
  { code: 'GB', name: 'United Kingdom', group: 'free90' },
  { code: 'US', name: 'United States', group: 'free90' },
  { code: 'DE', name: 'Germany', group: 'free90' },
  { code: 'FR', name: 'France', group: 'free90' },
  { code: 'IT', name: 'Italy', group: 'free90' },
  { code: 'ES', name: 'Spain', group: 'free90' },
  { code: 'NL', name: 'Netherlands', group: 'free90' },
  { code: 'CH', name: 'Switzerland', group: 'free90' },
  { code: 'RU', name: 'Russia', group: 'free90' },
  { code: 'IN', name: 'India', group: 'conditional' },
  { code: 'PH', name: 'Philippines', group: 'conditional' },
  { code: 'ID', name: 'Indonesia', group: 'conditional' },
  { code: 'VN', name: 'Vietnam', group: 'conditional' },
  { code: 'TH', name: 'Thailand', group: 'conditional' },
  { code: 'KE', name: 'Kenya', group: 'conditional' },
  { code: 'ZA', name: 'South Africa', group: 'conditional' },
  { code: 'PK', name: 'Pakistan', group: 'visa' },
  { code: 'BD', name: 'Bangladesh', group: 'visa' },
  { code: 'NG', name: 'Nigeria', group: 'visa' },
  { code: 'XX', name: 'Another nationality', group: 'unknown' },
];

export const byCode = (code: string) => NATIONALITIES.find((n) => n.code === code);

export interface Eligibility {
  status: 'no_visa' | 'on_arrival' | 'visa_required' | 'check';
  headline: string;
  detail: string;
  /** Ask whether the traveller holds a residence permit from a listed country. */
  askPermit: boolean;
}

const PERMIT_COUNTRIES = 'the US, the EU, the UK, Singapore, Japan, South Korea, Australia, New Zealand or Canada';

export function checkEligibility(code: string, hasPermit: boolean | null): Eligibility {
  const n = byCode(code);
  if (!n) return { status: 'check', headline: 'Pick a nationality', detail: 'We use it to work out whether you need a visa at all.', askPermit: false };
  if (n.group === 'free90') {
    return {
      status: 'no_visa',
      headline: `${n.name} passport holders usually do not need to apply`,
      detail: 'Entry is reported as free on arrival, typically for up to 90 days. You do not need a visa in advance. Check the official list for your exact stay.',
      askPermit: false,
    };
  }
  if (n.group === 'conditional') {
    const india = n.code === 'IN';
    if (hasPermit === true) {
      return {
        status: 'on_arrival',
        headline: 'You can get a visa on arrival',
        detail: india
          ? 'Indian passport holders with a valid US, UK or EU visa or residence permit can get a 14-day visa on arrival (AED 100), extendable once. You do not need a pre-arranged visa.'
          : `With a valid residence permit from ${PERMIT_COUNTRIES}, ${n.name} passport holders can choose a 14-day (AED 100) or 60-day (AED 250) visa on arrival, as reported for June 2026.`,
        askPermit: true,
      };
    }
    return {
      status: 'visa_required',
      headline: hasPermit === false ? 'You need a visa before you fly' : 'One quick question',
      detail:
        hasPermit === false
          ? `Without a residence permit or visa from ${PERMIT_COUNTRIES}, ${n.name} passport holders need a pre-arranged visit visa. That is what we file for you.`
          : `Do you hold a valid visa or residence permit from ${PERMIT_COUNTRIES}? It decides whether you need a visa at all.`,
      askPermit: true,
    };
  }
  if (n.group === 'visa') {
    return {
      status: 'visa_required',
      headline: 'You need a visa before you fly',
      detail: `${n.name} passport holders need a pre-arranged visa for the UAE. It is usually sponsored by an airline, a hotel, a licensed travel agency or a resident. That is what we file for you.`,
      askPermit: false,
    };
  }
  return {
    status: 'check',
    headline: 'Check the official list first',
    detail: 'This demo covers a short list of nationalities. In production the agent checks the current official list for every passport.',
    askPermit: false,
  };
}
