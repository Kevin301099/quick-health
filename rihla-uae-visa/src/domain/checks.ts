import type { Answers, Issue, Profile } from './types';
import type { PhotoReport } from './photo';
import { PRODUCTS, sponsorSalaryNeeded } from './visas';
import { TODAY, addDays, daysBetween, fmtDate, monthsBetween } from '@/lib/dates';

function norm(s: string) {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

export function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x.length && !y.length) return 1;
  const dp: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 0; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}

export interface CheckInput {
  answers: Answers;
  profile: Profile;
  photo: PhotoReport | null;
  /** True when a ticket was provided, so dates can be compared. */
  hasTicket: boolean;
  /** The date to check against. The demo uses its scripted date; live filing passes the real one. */
  today?: string;
  /**
   * A multiple-entry visa (the 5-year tourist visa) is not tied to one trip: it allows up to `maxStay` days a visit
   * and has no "use within 60 days" window. Leave both unset for a single-entry visa of `answers.days`.
   */
  multiEntry?: { maxStay: number };
}

export interface CheckResult {
  issues: Issue[];
  passes: string[];
}

export function runChecks({ answers: a, profile: p, photo, hasTicket, today = TODAY, multiEntry }: CheckInput): CheckResult {
  const issues: Issue[] = [];
  const passes: string[] = [];
  const product = PRODUCTS[a.visa];

  // Passport validity
  const monthsLeft = monthsBetween(a.arrival, p.passportExpires);
  if (p.passportExpires && p.passportExpires <= a.departure) {
    issues.push({
      id: 'passport',
      rule: 'R-PASS-01',
      risk: 'high',
      title: 'Your passport expires before the trip ends',
      detail: `It expires on ${fmtDate(p.passportExpires)}. You leave on ${fmtDate(a.departure)}. A visa cannot be filed on this passport.`,
      evidence: [{ label: 'Passport expires', value: fmtDate(p.passportExpires) }],
      options: [
        { id: 'renew', label: 'Pause until I renew my passport', detail: 'I will keep your documents and pick up when you are ready', recommended: true },
        { id: 'other', label: 'Use a different passport', detail: 'Upload its photo page' },
      ],
    });
  } else if (p.passportExpires && monthsLeft < 6) {
    issues.push({
      id: 'passport',
      rule: 'R-PASS-01',
      risk: 'high',
      title: 'Your passport is valid for less than 6 months on arrival',
      detail: `It expires on ${fmtDate(p.passportExpires)}, about ${Math.max(monthsLeft, 0)} months after you arrive. The UAE expects at least 6 months.`,
      evidence: [{ label: 'Passport expires', value: fmtDate(p.passportExpires) }, { label: 'Arrival', value: fmtDate(a.arrival) }],
      options: [
        { id: 'renew', label: 'Pause until I renew my passport', detail: 'Avoids a refusal at the airport', recommended: true },
        { id: 'proceed', label: 'Continue anyway', detail: 'Likely to be refused or turned back' },
      ],
    });
  } else if (p.passportExpires) {
    passes.push(`Passport is valid for ${monthsLeft} months after arrival`);
  }

  // Photo
  if (photo) {
    const bad = photo.checks.filter((c) => !c.ok && (c.id === 'ratio' || c.id === 'background' || c.id === 'resolution'));
    if (photo.blocking) {
      issues.push({
        id: 'photo',
        rule: 'R-PHOTO-01',
        risk: 'high',
        kind: 'photo',
        title: 'Your photo is too small',
        detail: `It is ${photo.width} × ${photo.height} px. The portal needs at least 600 × 700 px, and I cannot add detail that is not there.`,
        evidence: bad.map((c) => ({ label: c.label, value: c.value })),
        options: [{ id: 'new', label: 'Upload a new photo', detail: 'A recent photo on a plain, light background', recommended: true }],
      });
    } else if (photo.needsFix) {
      issues.push({
        id: 'photo',
        rule: 'R-PHOTO-01',
        risk: 'medium',
        kind: 'photo',
        title: bad.some((c) => c.id === 'background') ? 'The photo background is too dark' : 'The photo is the wrong shape',
        detail: 'The portal rejects photos that are not on a plain, light background in the right shape. I can correct this and show you the result before I use it.',
        evidence: bad.map((c) => ({ label: c.label, value: c.value })),
        options: [
          { id: 'fix', label: 'Fix it for me', detail: 'I lighten the background, then you check the result', recommended: true },
          { id: 'new', label: 'Upload a new photo', detail: 'A recent photo on a plain, light background' },
        ],
      });
    } else {
      passes.push('Photo is on a plain light background in the right shape');
    }
  }

  // Dates
  if (hasTicket && p.arrivalDate) {
    const candidates = Array.from(new Set([a.arrival, p.arrivalDate, p.hotelCheckIn].filter(Boolean)));
    if (candidates.length > 1) {
      issues.push({
        id: 'dates',
        rule: 'R-DATE-01',
        risk: 'medium',
        title: 'Your arrival date shows up as two different days',
        detail: `The flight lands on ${fmtDate(p.arrivalDate)} at ${p.arrivalTime}. ${p.hotelCheckIn ? `The hotel booking starts on ${fmtDate(p.hotelCheckIn)}.` : ''} The application needs one arrival date.`,
        evidence: [
          { label: 'Flight lands', value: `${fmtDate(p.arrivalDate)}, ${p.arrivalTime}` },
          ...(p.hotelCheckIn ? [{ label: 'Hotel check-in', value: fmtDate(p.hotelCheckIn) }] : []),
          ...(candidates.includes(a.arrival) && a.arrival !== p.arrivalDate ? [{ label: 'You entered', value: fmtDate(a.arrival) }] : []),
        ],
        options: [
          { id: p.arrivalDate, label: `Use ${fmtDate(p.arrivalDate)}`, detail: 'The day the flight lands. The hotel can be amended', recommended: true },
          ...candidates.filter((d) => d !== p.arrivalDate).map((d) => ({ id: d, label: `Use ${fmtDate(d)}`, detail: d === p.hotelCheckIn ? 'The hotel check-in day' : 'The date you entered' })),
        ],
      });
    } else {
      passes.push('Flight and hotel dates agree');
    }
  }

  // A single-entry visa must be used within 60 days of issue.
  const untilArrival = daysBetween(addDays(today, 2), a.arrival);
  if (multiEntry) {
    // Valid for five years from issue, so any arrival date works.
  } else if (untilArrival > 60) {
    issues.push({
      id: 'window',
      rule: 'R-ARR-01',
      risk: 'medium',
      title: 'Your trip is too far away to apply now',
      detail: `A UAE visit visa has to be used within 60 days of being issued. You arrive in about ${untilArrival} days, so it would expire before you travel.`,
      evidence: [{ label: 'Arrival', value: fmtDate(a.arrival) }, { label: 'Latest to apply from', value: fmtDate(addDays(a.arrival, -55)) }],
      options: [
        { id: 'renew', label: `Pause and apply from ${fmtDate(addDays(a.arrival, -55))}`, detail: 'Your documents stay ready', recommended: true },
        { id: 'proceed', label: 'Continue anyway', detail: 'The visa may expire before you fly' },
      ],
    });
  } else {
    passes.push('You will arrive within 60 days of the visa being issued');
  }

  // Stay length against the visa
  const stay = daysBetween(a.arrival, a.departure);
  const allowed = multiEntry?.maxStay ?? a.days;
  if (stay > allowed) {
    issues.push({
      id: 'stay',
      rule: 'R-STAY-01',
      risk: 'medium',
      title: `Your stay is ${stay} days. This visa allows ${allowed}${multiEntry ? ' a visit' : ''}`,
      detail: `You arrive on ${fmtDate(a.arrival)} and leave on ${fmtDate(a.departure)}. Staying past the visa costs AED 50 a day, with no grace period since April 2026.`,
      evidence: [{ label: 'Stay', value: `${stay} days` }, { label: 'Visa', value: `${allowed} days` }],
      options: [
        ...(a.days === 30 && !multiEntry ? [{ id: 'extend', label: 'Switch to the 60-day visa', detail: `Covers the whole stay. Government fee ${PRODUCTS[a.visa].fees[60]} AED`, recommended: true }] : []),
        { id: 'keep', label: 'Keep it as it is', detail: 'You would need to leave on time or extend later' },
      ],
    });
  } else {
    passes.push(multiEntry ? `Your ${stay}-day stay fits the ${allowed}-day limit for each visit` : `Your ${stay}-day stay fits the ${a.days}-day visa`);
  }

  // Insurance
  if (p.insuranceFrom && p.insuranceTo) {
    if (p.insuranceFrom > a.arrival || p.insuranceTo < a.departure) {
      issues.push({
        id: 'insurance',
        rule: 'R-INS-01',
        risk: 'medium',
        title: 'Your insurance does not cover the whole stay',
        detail: `The policy covers ${fmtDate(p.insuranceFrom)} to ${fmtDate(p.insuranceTo)}. You are in the UAE from ${fmtDate(a.arrival)} to ${fmtDate(a.departure)}.`,
        evidence: [{ label: 'Cover', value: `${fmtDate(p.insuranceFrom)} to ${fmtDate(p.insuranceTo)}` }, { label: 'Stay', value: `${fmtDate(a.arrival)} to ${fmtDate(a.departure)}` }],
        options: [
          { id: 'new', label: 'Upload a longer policy', detail: 'The insurer can extend the dates', recommended: true },
          { id: 'proceed', label: 'Continue anyway', detail: 'The application may be questioned' },
        ],
      });
    } else {
      passes.push('Insurance covers the whole stay');
    }
  }

  // Names across documents
  const passportName = `${p.given} ${p.surname}`;
  const t = p.ticketName.match(/^([^/]+)\/(.+?)(?:\s(?:MR|MS|MRS|MISS|MSTR))?$/);
  const ticketValue = t ? `${t[2]} ${t[1]}` : p.ticketName;
  const others = [
    { doc: 'Insurance', value: p.insuranceName },
    { doc: 'Ticket', value: ticketValue },
  ].filter((o) => o.value && o.value.trim());
  const mismatched = others.filter((o) => norm(o.value) !== norm(passportName) && similarity(o.value, passportName) > 0.6);
  if (mismatched.length) {
    const m = mismatched[0];
    issues.push({
      id: 'name',
      rule: 'R-NAME-01',
      risk: 'low',
      title: 'Your name is spelled two ways',
      detail: `${m.doc} says ${m.value.trim()}. Your passport says ${passportName}. The application follows the passport.`,
      evidence: [{ label: 'Passport', value: passportName }, { label: m.doc, value: m.value.trim() }],
      options: [
        { id: 'passport', label: 'Use the passport spelling', detail: 'This is what the portal checks', recommended: true },
        { id: 'fix', label: 'I will upload a corrected document', detail: `Ask ${m.doc.toLowerCase()} to reissue it` },
      ],
    });
  } else if (others.length) {
    passes.push('Your name matches across passport, ticket and insurance');
  }

  // Sponsor rules
  if (a.visa === 'family' && p.sponsor) {
    const need = sponsorSalaryNeeded(a.relationship);
    if (p.sponsor.salaryAED < need) {
      issues.push({
        id: 'salary',
        rule: 'R-SPON-01',
        risk: 'high',
        title: 'Your sponsor does not earn enough for this relationship',
        detail: `A sponsor needs at least AED ${need.toLocaleString('en-US')} a month to host a ${a.relationship}. ${p.sponsor.name} earns AED ${p.sponsor.salaryAED.toLocaleString('en-US')}.`,
        evidence: [{ label: 'Sponsor earns', value: `AED ${p.sponsor.salaryAED.toLocaleString('en-US')}` }, { label: 'Needed', value: `AED ${need.toLocaleString('en-US')}` }],
        options: [
          { id: 'other', label: 'Use a different sponsor', detail: 'Someone who meets the salary rule' },
          { id: 'proceed', label: 'Continue anyway', detail: 'Very likely to be rejected' },
        ],
      });
    } else {
      passes.push(`Sponsor's AED ${p.sponsor.salaryAED.toLocaleString('en-US')} salary meets the AED ${need.toLocaleString('en-US')} needed`);
    }
    if (p.sponsor.eidExpires <= a.departure) {
      issues.push({
        id: 'eid',
        rule: 'R-SPON-02',
        risk: 'high',
        title: "Your sponsor's Emirates ID expires during your visit",
        detail: `It expires on ${fmtDate(p.sponsor.eidExpires)}.`,
        evidence: [{ label: 'Emirates ID expires', value: fmtDate(p.sponsor.eidExpires) }],
        options: [{ id: 'other', label: 'Ask your sponsor to renew it first', detail: 'Then upload the new card', recommended: true }],
      });
    } else {
      passes.push("Sponsor's Emirates ID is valid for your whole visit");
    }
    if (p.sponsor.tenancyExpires < a.departure) {
      issues.push({
        id: 'tenancy',
        rule: 'R-SPON-03',
        risk: 'medium',
        title: "The sponsor's tenancy contract ends before you leave",
        detail: `It is valid until ${fmtDate(p.sponsor.tenancyExpires)}.`,
        evidence: [{ label: 'Tenancy valid until', value: fmtDate(p.sponsor.tenancyExpires) }],
        options: [{ id: 'new', label: 'Upload the renewed contract', detail: 'Ask your sponsor for it', recommended: true }, { id: 'proceed', label: 'Continue anyway', detail: 'May be questioned' }],
      });
    } else {
      passes.push('Tenancy contract covers your visit');
    }
  }

  void product;
  return { issues, passes };
}
