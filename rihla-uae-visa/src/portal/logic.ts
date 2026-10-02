import type { PortalPageId } from '@/domain/types';
import { PRODUCTS, SLOTS } from '@/domain/visas';
import { PORTAL_DOC_MAX, PORTAL_PHOTO_MAX } from '@/domain/photo';
import { formatBytes } from '@/lib/utils';
import { portalUrl, useStore } from '@/agent/store';

/*
  The sandbox portal's behaviour. A person clicking in the browser panel and the agent clicking the same
  buttons both land here. It simulates what a real entry-permit service does: validate each page, send
  one-time codes, take a card payment and issue a reference. It is not a real government site.
*/

const st = () => useStore.getState();
const sixDigits = () => String(Math.floor(100000 + Math.random() * 900000));

export function setField(aid: string, value: string) {
  st().patchPortal((p) => ({ fields: { ...p.fields, [aid]: value }, error: null }));
}

export function setCheck(aid: string, value: boolean) {
  st().patchPortal((p) => ({ checks: { ...p.checks, [aid]: value }, error: null }));
}

export function pageList(): PortalPageId[] {
  return PRODUCTS[st().answers.visa].pages;
}

export function goPage(page: PortalPageId) {
  st().patchPortal({ page, url: portalUrl(page), error: null, busy: true });
  setTimeout(() => st().patchPortal({ busy: false }), 260);
}

function nextOf(page: PortalPageId): PortalPageId {
  const list = pageList();
  const i = list.indexOf(page);
  return list[Math.min(list.length - 1, i + 1)];
}

const REQUIRED: Partial<Record<PortalPageId, string[]>> = {
  register: ['register:email', 'register:phone'],
  personal: ['personal:given', 'personal:surname', 'personal:dob', 'personal:sex', 'personal:birthplace', 'personal:nationality', 'personal:marital', 'personal:profession'],
  passport: ['passport:number', 'passport:issued', 'passport:expires', 'passport:place'],
  travel: ['travel:purpose', 'travel:arrival', 'travel:departure', 'travel:emirate', 'travel:accommodation', 'travel:flight'],
  sponsor: ['sponsor:name', 'sponsor:eid', 'sponsor:phone', 'sponsor:relationship', 'sponsor:salary'],
  contact: ['contact:phone', 'contact:address'],
};

function validate(page: PortalPageId): string | null {
  const p = st().portal;
  const need = REQUIRED[page] ?? [];
  const missing = need.filter((k) => !(p.fields[k] ?? '').trim());
  if (missing.length) return `Please complete all required fields (${missing.length} missing).`;
  if (page === 'register' && !/^\S+@\S+\.\S+$/.test(p.fields['register:email'] ?? '')) return 'Enter a valid email address.';
  if (page === 'verify') {
    if ((p.fields['verify:otp'] ?? '').trim() !== p.otp.code) return 'That code is not correct. Check the latest email and try again.';
  }
  if (page === 'uploads') {
    const slots = PRODUCTS[st().answers.visa].slots;
    const bad = slots.filter((s) => p.uploads[s]?.status !== 'ok');
    if (bad.length) return `Upload every document first (${bad.length} missing or rejected).`;
  }
  if (page === 'declarations') {
    const qs = ['refused', 'overstay', 'criminal', 'work'];
    if (qs.some((q) => !p.fields[`decl:${q}`])) return 'Answer every declaration question.';
  }
  if (page === 'review') {
    if (!p.checks['review:confirm']) return 'You must confirm that the information is correct.';
    if (!(p.fields['review:signature'] ?? '').trim()) return 'Type the applicant’s full name as the signature.';
  }
  if (page === 'payment') {
    const num = (p.fields['payment:card'] ?? '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(num)) return 'Enter a 16-digit card number.';
    if (!/^\d{2}\/\d{2}$/.test(p.fields['payment:exp'] ?? '')) return 'Enter the expiry as MM/YY.';
    if (!/^\d{3}$/.test(p.fields['payment:cvc'] ?? '')) return 'Enter the 3-digit security code.';
    if (!(p.fields['payment:name'] ?? '').trim()) return 'Enter the name on the card.';
  }
  if (page === 'bank') {
    if ((p.fields['bank:code'] ?? '').trim() !== p.bank.code) return 'That code is not correct.';
  }
  return null;
}

/** The main button on a page. Validates, runs the page's side effect, then moves on. */
export function submitPage(page: PortalPageId): boolean {
  const err = validate(page);
  if (err) {
    st().patchPortal({ error: err });
    return false;
  }
  const s = st();
  if (page === 'register') {
    const code = sixDigits();
    st().patchPortal({ otp: { sent: true, code } });
    st().addInbox({ from: 'Entry Permit Sandbox', subject: 'Your verification code', body: `Your one-time code is ${code}. It expires in 10 minutes. This is a sandbox message.`, code });
  }
  if (page === 'payment') {
    const code = sixDigits();
    st().patchPortal({ bank: { sent: true, code } });
    st().addInbox({ from: 'Your bank (sandbox SMS)', subject: 'Card payment code', body: `Use ${code} to approve the payment of AED ${payAmount().toFixed(2)}. This is a sandbox message.`, code });
  }
  if (page === 'bank') {
    const ref = `SBX-26-${sixDigits()}`;
    st().patchPortal({ reference: ref, status: 'submitted' });
    st().addInbox({ from: 'Entry Permit Sandbox', subject: 'Application received', body: `Your application ${ref} was received and is now in review. This is a sandbox message.` });
  }
  void s;
  goPage(nextOf(page));
  return true;
}

export function payAmount() {
  const { answers } = st();
  const fee = PRODUCTS[answers.visa].fees[answers.days];
  return Math.round(fee * 1.05 * 100) / 100;
}

export function approveSponsor() {
  st().patchPortal({ sponsorApproved: true });
  st().addInbox({ from: 'Entry Permit Sandbox', subject: 'Sponsor approved your application', body: 'Your sponsor approved the application. You can continue to payment. This is a sandbox message.' });
}

export function continueAfterSponsor() {
  if (!st().portal.sponsorApproved) {
    st().patchPortal({ error: 'Your sponsor has not approved yet.' });
    return false;
  }
  goPage('payment');
  return true;
}

export function openStatus() {
  goPage('status');
}

export function downloadPermit() {
  if (st().portal.status !== 'approved') {
    st().patchPortal({ error: 'The permit is not ready yet.' });
    return;
  }
  st().patchPortal({ permitDownloaded: true });
}

/** The "Choose file" button. Uploads the file the agent staged, or the person's own file for that slot. Resolves when accepted or rejected. */
export function chooseFile(slot: string, delay = 600): Promise<void> {
  const s = st();
  const staged = s.portal.staged[slot];
  const own = s.files[slot as keyof typeof s.files];
  const file = staged ?? (own ? { name: own.name, bytes: own.bytes } : { name: `${slot}.pdf`, bytes: 200_000 });
  s.patchPortal((p) => ({ uploads: { ...p.uploads, [slot]: { name: file.name, bytes: file.bytes, status: 'uploading' } }, error: null }));
  return new Promise((resolve) => {
    setTimeout(() => {
      const max = slot === 'photo' ? PORTAL_PHOTO_MAX : PORTAL_DOC_MAX;
      const tooBig = file.bytes > max;
      st().patchPortal((p) => ({
        uploads: {
          ...p.uploads,
          [slot]: tooBig
            ? { name: file.name, bytes: file.bytes, status: 'error', error: `File too large (${formatBytes(file.bytes)}). The limit is ${formatBytes(max)}.` }
            : { name: file.name, bytes: file.bytes, status: 'ok' },
        },
      }));
      resolve();
    }, delay);
  });
}

export const slotLabel = (slot: string) => SLOTS[slot as keyof typeof SLOTS]?.label ?? slot;

export const STEPS = [
  { id: 'account', label: 'Account', pages: ['home', 'register', 'verify'] },
  { id: 'applicant', label: 'Applicant', pages: ['personal', 'passport'] },
  { id: 'travel', label: 'Travel', pages: ['travel', 'sponsor', 'contact'] },
  { id: 'documents', label: 'Documents', pages: ['uploads', 'declarations'] },
  { id: 'review', label: 'Review', pages: ['review', 'sponsor_wait'] },
  { id: 'payment', label: 'Payment', pages: ['payment', 'bank', 'done', 'status'] },
] as const;
