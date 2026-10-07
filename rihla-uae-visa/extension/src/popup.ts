import { OFFICIAL_DOMAINS } from '../../src/domain/routes';
import type { FillResult } from './background';
import type { Pack } from './pack';

/*
  The toolbar popup: who is loaded, whether this tab is an official site we recognise, and one button.
  Opening the popup is what grants the extension access to this tab (activeTab), so it reads no other site.
*/

declare const __APP_URL__: string;

type State = { pack: (Omit<Pack, 'documents'> & { documents: Omit<Pack['documents'][number], 'data'>[] }) | null; savedAt?: number; expiresAt?: number };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T>(m: Record<string, unknown>) => chrome.runtime.sendMessage(m) as Promise<T>;

function timeLeft(at: number) {
  const mins = Math.max(0, Math.round((at - Date.now()) / 60000));
  return mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const state = await send<State>({ type: 'rihla:state' });
  const host = (() => {
    try {
      return new URL(tab?.url ?? '').hostname;
    } catch {
      return '';
    }
  })();
  const official = !!host && OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  const fillable = !!tab?.id && /^https?:/.test(tab.url ?? '');

  if (!state.pack) {
    $('empty').hidden = false;
    const link = $<HTMLAnchorElement>('open-app');
    link.href = __APP_URL__;
    return;
  }

  const p = state.pack;
  $('ready').hidden = false;
  $('name').textContent = `${p.traveller.given} ${p.traveller.surname}`;
  $('passport').textContent = `Passport ···${p.traveller.passportNo.slice(-4)} · ${p.traveller.nationality.name}`;
  $('route').textContent = p.site ? `For ${p.site.name}` : 'Ready to fill';
  $('docs').textContent = p.documents.length ? p.documents.map((d) => d.label).join(', ') : 'No documents';
  $('expires').textContent = state.expiresAt ? `Kept on this device for ${timeLeft(state.expiresAt)}.` : '';

  const site = $('site');
  if (!fillable) {
    site.className = 'site';
    site.textContent = 'Open the official form in this tab first.';
  } else if (official) {
    site.className = 'site ok';
    site.textContent = `${host} · official site`;
  } else {
    site.className = 'site warn';
    site.textContent = `${host} is not a site we recognise. Check the address bar before you type anything.`;
  }

  const btn = $<HTMLButtonElement>('fill');
  const result = $('result');
  btn.disabled = !fillable;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Filling…';
    const r = await send<FillResult>({ type: 'rihla:fill', tabId: tab!.id });
    btn.disabled = false;
    btn.textContent = 'Fill this page again';
    result.hidden = false;
    if (r.ok) {
      result.className = 'result ok';
      result.textContent = `Filled ${r.filled} field${r.filled === 1 ? '' : 's'} and attached ${r.attached} document${r.attached === 1 ? '' : 's'}.${r.check ? ` ${r.check} to check.` : ''} The list is on the page.`;
    } else {
      result.className = 'result warn';
      result.textContent = r.reason === 'no_pack' ? 'Your details have expired. Send them again from Rihla.' : 'This page does not allow extensions to fill it. Copy the details from Rihla instead.';
    }
  });

  $('forget').addEventListener('click', async () => {
    await send({ type: 'rihla:forget' });
    window.close();
  });
}

void main();
