import { useEffect, useState } from 'react';
import { api } from './api';

/*
  Talking to Rihla Filler, the browser extension that fills the official form in the traveller's own browser.
  The page and the extension exchange window messages; the extension only listens on Rihla's own address.
  Documents are downloaded here and handed over as files, so the extension never needs network access.
*/

/** The extension's store listing, once published. Without it the page explains how to install the beta. */
export const FILLER_URL = process.env.NEXT_PUBLIC_FILLER_URL ?? '';

type FromExtension = { source: 'rihla-extension'; type: string; id?: string; version?: string; ok?: boolean; error?: string; expiresAt?: number };

const post = (m: Record<string, unknown>) => window.postMessage({ source: 'rihla-app', ...m }, window.location.origin);

function waitFor(pred: (m: FromExtension) => boolean, ms: number) {
  return new Promise<FromExtension | null>((resolve) => {
    const on = (e: MessageEvent<FromExtension>) => {
      if (e.source !== window || e.data?.source !== 'rihla-extension' || !pred(e.data)) return;
      window.removeEventListener('message', on);
      clearTimeout(t);
      resolve(e.data);
    };
    const t = setTimeout(() => {
      window.removeEventListener('message', on);
      resolve(null);
    }, ms);
    window.addEventListener('message', on);
  });
}

/** Whether the extension is installed in this browser. Checks again when the traveller comes back to the tab. */
export function useFiller() {
  const [state, setState] = useState<{ status: 'checking' | 'installed' | 'missing'; version?: string }>({ status: 'checking' });
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ready = waitFor((m) => m.type === 'rihla:ready', 1200);
      post({ type: 'rihla:hello' });
      const m = await ready;
      if (alive) setState(m ? { status: 'installed', version: m.version } : { status: 'missing' });
    };
    void check();
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      window.removeEventListener('focus', check);
    };
  }, []);
  return state;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

interface ServerPack {
  documents: { slot: string; label: string; mime: string; name: string; url: string }[];
  [k: string]: unknown;
}

/** Sends this application's details and documents to the extension. */
export async function sendToFiller(appId: string) {
  const { pack } = await api<{ pack: ServerPack }>(`/v1/applications/${appId}/pack`);
  const documents = await Promise.all(
    pack.documents.map(async ({ url, ...d }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not download your ${d.label.toLowerCase()}. Try again.`);
      return { ...d, data: await toDataUrl(new Blob([await res.blob()], { type: d.mime })) };
    }),
  );
  const id = Math.random().toString(36).slice(2);
  const saved = waitFor((m) => m.type === 'rihla:saved' && m.id === id, 15000);
  post({ type: 'rihla:pack', id, pack: { ...pack, documents } });
  const r = await saved;
  if (!r) throw new Error('Rihla Filler did not answer. Reload this page and try again.');
  if (!r.ok) throw new Error(r.error ?? 'Rihla Filler could not take your details.');
  return { expiresAt: r.expiresAt };
}

/** Asks the extension to delete what it holds for the traveller. */
export async function forgetInFiller() {
  const id = Math.random().toString(36).slice(2);
  const done = waitFor((m) => m.type === 'rihla:forgotten' && m.id === id, 1500);
  post({ type: 'rihla:forget', id });
  await done;
}
