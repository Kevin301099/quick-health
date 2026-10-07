import { KEEP_MS, MAX_PACK_CHARS, invalidPack, type Pack, type StoredPack } from './pack';
import type { FrameReport } from './fill';

/*
  The extension's background worker. It keeps the pack on this device (never sent anywhere), and fills a tab
  when the traveller asks: from the toolbar popup, or with Alt+Shift+F on the page.
*/

declare const __APP_ORIGINS__: string[];
const KEY = 'rihla.pack';

export interface FillResult {
  ok: boolean;
  reason?: 'no_pack' | 'blocked';
  message?: string;
  filled?: number;
  attached?: number;
  check?: number;
  yours?: number;
}

async function load(): Promise<StoredPack | null> {
  const got = (await chrome.storage.local.get(KEY))[KEY] as StoredPack | undefined;
  if (!got) return null;
  if (got.expiresAt < Date.now()) {
    await forget();
    return null;
  }
  return got;
}

async function forget() {
  await chrome.storage.local.remove(KEY);
  await chrome.alarms.clear('expire');
  await chrome.action.setBadgeText({ text: '' });
}

async function save(pack: Pack) {
  const stored: StoredPack = { pack, savedAt: Date.now(), expiresAt: Date.now() + KEEP_MS };
  await chrome.storage.local.set({ [KEY]: stored });
  await chrome.alarms.create('expire', { when: stored.expiresAt });
  await chrome.action.setBadgeBackgroundColor({ color: '#0b7a63' });
  await chrome.action.setBadgeText({ text: '✓' });
  return stored;
}

async function fillTab(tabId: number): Promise<FillResult> {
  const stored = await load();
  if (!stored) return { ok: false, reason: 'no_pack' };
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['fill.js'] });
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (pack: Pack) => globalThis.__rihla?.fill(pack),
      args: [stored.pack],
    });
    const reports = results.map((r) => r.result as FrameReport | undefined).filter((r): r is FrameReport => !!r);
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: (rs: FrameReport[], pack: Pack) => globalThis.__rihla?.panel(rs, pack),
      args: [reports, stored.pack],
    });
    const items = reports.flatMap((r) => r.items);
    return {
      ok: true,
      filled: reports.reduce((s, r) => s + r.filled, 0),
      attached: reports.reduce((s, r) => s + r.attached, 0),
      check: items.filter((i) => i.state === 'check').length,
      yours: items.filter((i) => i.state === 'yours').length,
    };
  } catch (e) {
    return { ok: false, reason: 'blocked', message: e instanceof Error ? e.message : String(e) };
  }
}

const fromApp = (sender: chrome.runtime.MessageSender) => !!sender.origin && __APP_ORIGINS__.includes(sender.origin) && sender.id === chrome.runtime.id;
/** The extension's own pages (the popup). Content scripts report the web page's address, so they never pass. */
const fromExtension = (sender: chrome.runtime.MessageSender) => sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((msg: { type?: string; pack?: unknown; tabId?: number }, sender, reply) => {
  (async () => {
    switch (msg?.type) {
      case 'rihla:save': {
        if (!fromApp(sender)) return { ok: false, error: 'This page cannot send details to Rihla Filler.' };
        if (JSON.stringify(msg.pack ?? null).length > MAX_PACK_CHARS) return { ok: false, error: 'The documents are too large.' };
        const bad = invalidPack(msg.pack);
        if (bad) return { ok: false, error: `The details were not in the expected shape (${bad}).` };
        const s = await save(msg.pack as Pack);
        return { ok: true, expiresAt: s.expiresAt };
      }
      case 'rihla:forget':
        if (!fromApp(sender) && !fromExtension(sender)) return { ok: false };
        await forget();
        return { ok: true };
      case 'rihla:state': {
        if (!fromExtension(sender)) return null;
        const s = await load();
        if (!s) return { pack: null };
        const { documents, ...rest } = s.pack;
        return { pack: { ...rest, documents: documents.map(({ data: _data, ...d }) => d) }, savedAt: s.savedAt, expiresAt: s.expiresAt };
      }
      case 'rihla:fill':
        if (!fromExtension(sender) || typeof msg.tabId !== 'number') return { ok: false };
        return fillTab(msg.tabId);
      default:
        return null;
    }
  })().then(reply);
  return true;
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'fill-page' || !tab?.id) return;
  const r = await fillTab(tab.id);
  if (!r.ok) {
    await chrome.action.setBadgeBackgroundColor({ color: '#c27a0e' });
    await chrome.action.setBadgeText({ text: '!', tabId: tab.id });
  }
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'expire') void forget();
});

chrome.runtime.onStartup.addListener(() => void load());

// For the automated tests, which cannot click the toolbar button.
(globalThis as { rihlaFillTab?: typeof fillTab }).rihlaFillTab = fillTab;
