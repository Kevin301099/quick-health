/*
  Runs on the Rihla web app only. It lets the page know the extension is installed, and passes the traveller's
  pack to the extension when they press "Send to Rihla Filler". Messages from anywhere else are ignored.
*/

declare const __APP_ORIGINS__: string[];

type AppMessage = { source: 'rihla-app'; type: 'rihla:hello' | 'rihla:pack' | 'rihla:forget'; id?: string; pack?: unknown };

if (__APP_ORIGINS__.includes(location.origin)) {
  const version = chrome.runtime.getManifest().version;
  const post = (m: Record<string, unknown>) => window.postMessage({ source: 'rihla-extension', ...m }, location.origin);
  const announce = () => post({ type: 'rihla:ready', version });

  window.addEventListener('message', async (e: MessageEvent<AppMessage>) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'rihla-app') return;
    const m = e.data;
    if (m.type === 'rihla:hello') announce();
    else if (m.type === 'rihla:pack') {
      const r = await chrome.runtime.sendMessage({ type: 'rihla:save', pack: m.pack }).catch((err: Error) => ({ ok: false, error: err.message }));
      post({ type: 'rihla:saved', id: m.id, ...r });
    } else if (m.type === 'rihla:forget') {
      await chrome.runtime.sendMessage({ type: 'rihla:forget' }).catch(() => undefined);
      post({ type: 'rihla:forgotten', id: m.id });
    }
  });
  announce();
}
