import { CORRIDORS } from '@/agent/fixtures/corridors';
import { PEOPLE, SEED_CASES } from '@/agent/fixtures/people';
import { buildDocs } from '@/agent/fixtures/docs';
import { crossCheck } from '@/agent/checks';
import { buildForm, formProgress } from '@/agent/forms';
import { buildQuote } from '@/agent/fees';
import { decisionMessage } from '@/agent/messages';
import { fmtDate } from '@/lib/utils';

/*
  Frames shown on the landing page. They are built from the same fixtures and logic the console uses,
  so what a visitor sees here is exactly what the agent produces inside the demo.
*/

const meta = SEED_CASES[0];
const corridor = CORRIDORS[meta.corridorId];
const applicants = meta.applicantIds.map((id) => PEOPLE[id]);
const docs = buildDocs(applicants, meta.trip, corridor.perApplicantDocs, corridor.tripDocs);
const check = crossCheck({ applicants, docs, trip: meta.trip, corridor });
const expiry = check.conflicts.find((c) => c.id === 'expiry-aisha')!;
const form = buildForm(corridor, applicants, docs, meta.trip, {});
const quote = buildQuote(corridor, applicants.length, corridor.serviceFeeAED);
const passport = docs.find((d) => d.id === 'passport-khalid')!;

export interface Frame {
  key: string;
  label: string;
  owner: 'Agent' | 'You' | 'Client' | 'Agent and you' | 'Agent and client';
  blurb: string;
  line: string;
  component: string;
  props: Record<string, unknown>;
}

export const FRAMES: Record<string, Frame> = {
  intake: {
    key: 'intake',
    label: 'Read the request',
    owner: 'Agent',
    blurb: 'WhatsApp or email comes in. Travellers, dates and purpose come out.',
    line: 'Reading the WhatsApp message from Khalid.',
    component: 'IntakeSummary',
    props: {
      channel: meta.channel,
      received: meta.received,
      from: meta.client.name,
      message: meta.message,
      language: 'English',
      extracted: [
        { label: 'Travellers', value: '4 (2 adults, 2 children)' },
        { label: 'Destination', value: 'London, United Kingdom' },
        { label: 'Dates', value: `${fmtDate(meta.trip.from)} to ${fmtDate(meta.trip.to)}` },
        { label: 'Purpose', value: 'Tourism' },
      ],
    },
  },
  rules: {
    key: 'rules',
    label: 'Work out what applies',
    owner: 'Agent',
    blurb: 'Versioned rule packs for the route, each with its source and review date.',
    line: 'Checking what a UAE passport needs for the UK.',
    component: 'RequirementsCard',
    props: {
      corridor: {
        name: corridor.name,
        short: corridor.short,
        mode: corridor.mode,
        headline: corridor.headline,
        decision: corridor.decision,
        validity: corridor.validity,
        portal: corridor.portal,
        rulepack: corridor.rulepack,
        reviewed: corridor.reviewed,
        sources: corridor.sources,
      },
      determination: 'ETA required. No visa.',
      items: corridor.requirements.slice(0, 4),
      fees: { perPerson: '£20 per traveller', total: '£80', aed: 392 },
    },
  },
  documents: {
    key: 'documents',
    label: 'Read the documents',
    owner: 'Agent',
    blurb: 'Passports, Emirates IDs and statements. Each value links to where it was read.',
    line: 'Read 12 documents. Every field keeps its source.',
    component: 'ExtractionPanel',
    props: { doc: passport, holder: 'Khalid Saeed Al Mansoori', note: 'Hover a field to see where it was read.' },
  },
  checks: {
    key: 'checks',
    label: 'Cross-check',
    owner: 'Agent and you',
    blurb: 'Names, dates, validity and funds, compared across every document. Flags come to you.',
    line: 'One flag needs a decision.',
    component: 'ConflictResolver',
    props: { conflict: expiry },
  },
  draft: {
    key: 'draft',
    label: 'Fill the application',
    owner: 'Agent',
    blurb: 'Every field from a verified fact. Edit any value and the change is logged.',
    line: 'Everything but the applicant-only sections is filled.',
    component: 'FormDraft',
    props: { form, progress: formProgress(form) },
  },
  quote: {
    key: 'quote',
    label: 'Quote',
    owner: 'Agent',
    blurb: 'Government fees at cost, your fee and VAT, in dirhams.',
    line: 'Quote ready in dirhams.',
    component: 'FeeQuote',
    props: { corridorId: corridor.id, travellers: 4, serviceFeeAED: corridor.serviceFeeAED, quote },
  },
  approve: {
    key: 'approve',
    label: 'Approve',
    owner: 'You',
    blurb: 'One screen for the decision that belongs to you.',
    line: 'Ready for your approval.',
    component: 'ApprovalGate',
    props: {
      title: 'Approve and send to the client',
      summary: [
        { label: 'Travellers', value: '4' },
        { label: 'Route', value: 'London · UK ETA' },
        { label: 'Government fees', value: 'AED 392' },
        { label: 'Agency fee incl. VAT', value: 'AED 630' },
        { label: 'Total to the client', value: 'AED 1,022' },
      ],
      checks: [
        { label: 'All documents read and cross-checked', status: 'pass' },
        { label: '2 flags settled (1 by policy, 1 by you)', status: 'pass' },
        { label: 'Applicant-only sections left untouched', status: 'pass' },
      ],
      next: ['Send the client a secure link for the selfie and declarations', 'Submit each ETA to the sandbox portal', 'Track the decision and message the client'],
      boundaries: ['Will not answer declarations or sign for the applicant', 'Will not work around portal limits or bot protection'],
    },
  },
  track: {
    key: 'track',
    label: 'Submit and track',
    owner: 'Agent and client',
    blurb: 'Applicant-only steps go to the client. The decision goes back in Arabic and English.',
    line: 'Approved. Message sent in English and Arabic.',
    component: 'StatusTimeline',
    props: {
      steps: corridor.tracking.map((t, i) => ({ ...t, status: 'done', at: ['Day 0 · 10:42', 'Day 0 · 10:43', 'Day 2 · 14:05', 'Day 2 · 14:06'][i] })),
      notes: [
        { name: 'Khalid', outcome: 'Approved · valid until 2 Oct 2028' },
        { name: 'Aisha', outcome: 'Approved · valid until 9 Feb 2027 (passport expiry)' },
      ],
      clockNote: 'Simulated clock. Hours and days are compressed into seconds for the demo.',
    },
  },
};

export const MESSAGE = decisionMessage(meta, corridor, 4);

export const ORDER = ['intake', 'rules', 'documents', 'checks', 'draft', 'quote', 'approve', 'track'] as const;
export const HERO_ORDER = ['intake', 'rules', 'documents', 'checks', 'quote', 'track'] as const;
export const RESOLVED_FLAG = {
  by: 'human' as const,
  outcome: { option: 'proceed' },
  at: 0,
};
