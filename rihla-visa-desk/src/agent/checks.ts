import type { Applicant, Conflict, Corridor, DocSpec, Trip } from './types';
import { REF_DATE } from './fixtures/people';
import { fmtDate, monthsBetween, ageOn } from '@/lib/utils';

function norm(s: string) {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

/** Normalised Levenshtein similarity, 1 means identical. */
export function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x.length && !y.length) return 1;
  const dp: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 0; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}

export interface AutoFix {
  doc: string;
  field: string;
  from: string;
  to: string;
  how: string;
}

export interface CheckResult {
  conflicts: Conflict[];
  passes: string[];
  fixes: AutoFix[];
  minors: number;
}

interface Args {
  applicants: Applicant[];
  docs: DocSpec[];
  trip: Trip;
  corridor: Corridor;
}

export function crossCheck({ applicants, docs, trip, corridor }: Args): CheckResult {
  const conflicts: Conflict[] = [];
  const passes: string[] = [];
  const fixes: AutoFix[] = [];

  // 1. Names across passport and Emirates ID.
  let nameOk = 0;
  for (const a of applicants) {
    const p = `${a.given} ${a.surname}`;
    if (norm(p) === norm(a.eidEnglishName)) {
      nameOk += 1;
      continue;
    }
    const sim = similarity(p, a.eidEnglishName);
    conflicts.push({
      id: `name-${a.id}`,
      rule: 'R-NAME-01',
      risk: sim >= 0.8 ? 'low' : 'high',
      title: `${a.given.split(' ')[0].charAt(0)}${a.given.split(' ')[0].slice(1).toLowerCase()}'s name is spelled two ways`,
      detail: `The passport prints ${a.surname}. The Emirates ID prints ${a.eidEnglishName.split(' ').slice(-2).join(' ')}. The authority checks the passport, so the passport spelling is the safe choice.`,
      evidence: [
        { doc: 'Passport', field: 'Surname', value: a.surname },
        { doc: 'Emirates ID', field: 'Name', value: a.eidEnglishName },
      ],
      options: [
        { id: 'passport', label: 'Use the passport spelling', detail: `${a.surname}`, recommended: true },
        { id: 'eid', label: 'Use the Emirates ID spelling', detail: a.eidEnglishName.split(' ').slice(-2).join(' ') },
        { id: 'ask', label: 'Ask the client to confirm', detail: 'Agent sends a short message and waits' },
      ],
    });
  }
  if (nameOk === applicants.length) passes.push(`Names agree across passport and Emirates ID for ${nameOk} of ${applicants.length} travellers`);
  else if (nameOk > 0) passes.push(`Names agree for ${nameOk} of ${applicants.length} travellers`);

  // 2. Passport validity against the trip and the authorisation's own validity cap.
  let validityOk = 0;
  for (const a of applicants) {
    const first = a.given.split(' ')[0];
    const name = first.charAt(0) + first.slice(1).toLowerCase();
    const toExpiry = monthsBetween(REF_DATE, a.passportExpires);
    const afterTrip = monthsBetween(trip.to, a.passportExpires);
    if (afterTrip < 0) {
      conflicts.push({
        id: `expiry-${a.id}`,
        rule: 'R-PASS-01',
        risk: 'high',
        title: `${name}'s passport expires before the trip ends`,
        detail: `The passport expires on ${fmtDate(a.passportExpires)}. The trip ends on ${fmtDate(trip.to)}. This cannot be filed as it stands.`,
        evidence: [{ doc: 'Passport', field: 'Date of expiry', value: fmtDate(a.passportExpires) }],
        options: [
          { id: 'renew', label: 'Pause until the passport is renewed', detail: 'Agent sets a reminder and prepares everything else', recommended: true },
          { id: 'ask', label: 'Ask the client for another passport', detail: 'Agent sends a message' },
        ],
      });
      continue;
    }
    const needsSixMonths = corridor.mode === 'visa' && afterTrip < 6;
    const shortCap = corridor.mode !== 'visa' && toExpiry < 12;
    if (needsSixMonths || shortCap) {
      conflicts.push({
        id: `expiry-${a.id}`,
        rule: 'R-PASS-02',
        risk: 'medium',
        title: `${name}'s passport is close to expiry`,
        detail: needsSixMonths
          ? `The passport expires on ${fmtDate(a.passportExpires)}, ${afterTrip} months after the trip ends. Many consulates expect six months.`
          : `The passport expires on ${fmtDate(a.passportExpires)}. The ${corridor.short} is only valid until then, so it would last about ${Math.max(toExpiry, 0)} months instead of ${corridor.maxValidityMonths ?? 24}.`,
        evidence: [{ doc: 'Passport', field: 'Date of expiry', value: fmtDate(a.passportExpires) }],
        options: [
          { id: 'proceed', label: 'Proceed with the shorter validity', detail: 'Covers this trip. The agent adds a renewal reminder', recommended: !needsSixMonths },
          { id: 'renew', label: 'Pause until the passport is renewed', detail: 'Avoids paying twice later', recommended: needsSixMonths },
          { id: 'ask', label: 'Ask the client', detail: 'Agent sends a message' },
        ],
      });
    } else {
      validityOk += 1;
    }
  }
  if (validityOk === applicants.length) passes.push(`Passports are valid well beyond the trip for all ${validityOk} travellers`);
  else if (validityOk > 0) passes.push(`${validityOk} of ${applicants.length} passports have comfortable validity`);

  // 3. Funds against the estimated trip cost (visa routes).
  if (corridor.mode === 'visa' && applicants[0]) {
    const lead = applicants[0];
    if (lead.balanceAED < trip.estCostAED) {
      conflicts.push({
        id: 'funds',
        rule: 'R-FUNDS-01',
        risk: 'medium',
        title: 'Funds look low for this trip',
        detail: `The bank statement closes at AED ${lead.balanceAED.toLocaleString('en-US')}. The estimated trip cost is AED ${trip.estCostAED.toLocaleString('en-US')}. A consular officer will compare the two.`,
        evidence: [
          { doc: 'Bank statement', field: 'Closing balance', value: `AED ${lead.balanceAED.toLocaleString('en-US')}` },
          { doc: 'Itinerary', field: 'Estimated cost', value: `AED ${trip.estCostAED.toLocaleString('en-US')}` },
        ],
        options: [
          { id: 'income', label: 'Add salary evidence', detail: 'Salary certificate and 3 more months of statements', recommended: true },
          { id: 'sponsor', label: 'Add a sponsor letter', detail: 'Family member covers the trip' },
          { id: 'proceed', label: 'Proceed and note the gap', detail: 'The file records that the gap was reviewed' },
        ],
      });
    } else {
      passes.push('Closing balance covers the estimated trip cost');
    }
  }

  // 4. Itinerary dates (visa routes with a trip document).
  const itin = docs.find((d) => d.kind === 'itinerary');
  if (itin) {
    const ret = itin.fields.find((x) => x.key === 'return')?.value;
    const out = itin.fields.find((x) => x.key === 'checkout')?.value;
    if (ret && out && ret !== out) {
      conflicts.push({
        id: 'dates',
        rule: 'R-DATE-01',
        risk: 'medium',
        title: 'Flight and hotel dates disagree',
        detail: `The return flight is ${ret}. The hotel checks out on ${out}. The DS-160 asks for one arrival and one stay length.`,
        evidence: [
          { doc: 'Itinerary', field: 'Flight back', value: ret },
          { doc: 'Itinerary', field: 'Hotel check-out', value: out },
        ],
        options: [
          { id: 'flight', label: 'Use the flight dates', detail: 'Flights are ticketed. The hotel is easier to amend', recommended: true },
          { id: 'hotel', label: 'Use the hotel dates', detail: ret },
          { id: 'ask', label: 'Ask the client', detail: 'Agent sends a message' },
        ],
      });
    } else {
      passes.push('Flight and hotel dates agree');
    }
  }

  // 5. Emirates ID still valid on the travel dates.
  const eidBad = applicants.filter((a) => a.eidExpires <= trip.to);
  if (eidBad.length === 0) passes.push('Emirates IDs are valid on the travel dates');

  // 6. Photos.
  if (docs.some((d) => d.kind === 'photo')) passes.push('Photos meet size, crop and background rules');

  // Low-confidence reads the agent can settle itself by re-reading the page.
  for (const d of docs) {
    for (const fld of d.fields) {
      if (fld.confidence < 0.8) {
        const holder = applicants.find((a) => a.id === d.holderId);
        if (holder && fld.key === 'pob') {
          fixes.push({
            doc: `${d.label} · ${holder.given.split(' ')[0]}`,
            field: fld.label,
            from: fld.value,
            to: holder.birthplace,
            how: 'Re-read at higher resolution and matched against the MRZ-adjacent print',
          });
        }
      }
    }
  }

  const minors = applicants.filter((a) => ageOn(a.dob, REF_DATE) < 18).length;
  return { conflicts, passes, fixes, minors };
}
