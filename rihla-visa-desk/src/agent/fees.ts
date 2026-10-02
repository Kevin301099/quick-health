import type { Corridor, FeeQuoteData, FeeLine } from './types';

const SYMBOL: Record<Corridor['gov']['currency'], string> = { GBP: '£', CAD: 'CA$', USD: 'US$', EUR: '€' };

export const VAT_RATE = 0.05;

export function buildQuote(corridor: Corridor, travellers: number, serviceFeeAED: number): FeeQuoteData {
  const sym = SYMBOL[corridor.gov.currency];
  const lines: FeeLine[] = [];

  lines.push({
    label: `${corridor.short} government fee`,
    qty: travellers,
    kind: 'government',
    local: `${travellers} × ${sym}${corridor.gov.perPerson}`,
    aed: Math.round(travellers * corridor.gov.perPerson * corridor.rateToAED),
  });
  for (const ex of corridor.gov.extras ?? []) {
    lines.push({
      label: ex.label,
      qty: travellers,
      kind: 'government',
      local: `${travellers} × ${sym}${ex.amount}`,
      aed: Math.round(travellers * ex.amount * corridor.rateToAED),
    });
  }
  const serviceAED = Math.round(travellers * serviceFeeAED);
  lines.push({
    label: 'Agency service fee',
    qty: travellers,
    kind: 'service',
    local: `${travellers} × AED ${serviceFeeAED}`,
    aed: serviceAED,
  });
  const vatAED = Math.round(serviceAED * VAT_RATE);
  lines.push({ label: 'VAT 5% on service fee', qty: 1, kind: 'tax', aed: vatAED });

  const govAED = lines.filter((l) => l.kind === 'government').reduce((s, l) => s + l.aed, 0);
  return {
    lines,
    govAED,
    serviceAED,
    vatAED,
    totalAED: govAED + serviceAED + vatAED,
    rateNote: `Indicative rate 1 ${corridor.gov.currency} = AED ${corridor.rateToAED}. Government fees are passed through at cost.`,
  };
}
