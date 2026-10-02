import type { FileRef } from '@/domain/types';
import { useStore } from './store';
import { setField } from '@/portal/logic';

/*
  The browser bridge. The agent operates the sandbox portal the way a person would:
  it finds an element, moves a visible pointer to it, then types or clicks. Everything it does goes
  through the same page logic a person's clicks use, so a person can take over at any moment.
*/

export interface Pace {
  sleep(ms: number): Promise<void>;
  throwIfAborted(): void;
}

const st = () => useStore.getState();
const q = (aid: string) => document.querySelector<HTMLElement>(`[data-aid="${aid}"]`);

export class Browser {
  constructor(private pace: Pace) {}

  private async waitEl(aid: string, timeout = 4000): Promise<HTMLElement> {
    const t0 = performance.now();
    for (;;) {
      this.pace.throwIfAborted();
      const el = q(aid);
      if (el) return el;
      if (performance.now() - t0 > timeout) throw new Error(`Element not found: ${aid}`);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  }

  async waitFor(pred: () => boolean, timeout = 15000) {
    const t0 = performance.now();
    while (!pred()) {
      this.pace.throwIfAborted();
      if (performance.now() - t0 > timeout) return false;
      await new Promise((r) => setTimeout(r, 60));
    }
    return true;
  }

  async waitForPage(page: string) {
    await this.waitFor(() => st().portal.page === page, 5000);
    await this.waitEl(`page:${page}`);
    await this.pace.sleep(220);
  }

  narrate(note: string | null) {
    st().patchPortal({ note });
  }

  private async moveTo(aid: string, hover = false): Promise<HTMLElement> {
    const el = await this.waitEl(aid);
    const stage = document.querySelector<HTMLElement>('[data-portal-stage]');
    const scroller = document.querySelector<HTMLElement>('[data-portal-scroll]');
    if (scroller && stage) {
      const er = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      const delta = er.top - sr.top - sr.height / 2 + er.height / 2;
      if (Math.abs(delta) > 24) {
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
        await this.pace.sleep(380);
      }
    }
    const er2 = el.getBoundingClientRect();
    const sr2 = (stage ?? document.body).getBoundingClientRect();
    const x = er2.left - sr2.left + Math.min(er2.width * 0.5, 90);
    const y = er2.top - sr2.top + er2.height * 0.55;
    st().patchPortal((p) => ({ cursor: { ...p.cursor, x, y, visible: true, clicking: false } }));
    await this.pace.sleep(hover ? 380 : 560);
    return el;
  }

  async click(aid: string) {
    const el = await this.moveTo(aid);
    st().patchPortal((p) => ({ cursor: { ...p.cursor, clicking: true } }));
    await this.pace.sleep(170);
    el.click();
    st().patchPortal((p) => ({ cursor: { ...p.cursor, clicking: false } }));
    await this.pace.sleep(140);
  }

  async type(aid: string, text: string) {
    const el = await this.moveTo(aid);
    el.focus({ preventScroll: true });
    setField(aid, '');
    let out = '';
    for (const ch of text) {
      this.pace.throwIfAborted();
      out += ch;
      setField(aid, out);
      await this.pace.sleep(24);
    }
    el.blur();
    await this.pace.sleep(120);
  }

  async select(aid: string, value: string) {
    await this.moveTo(aid);
    await this.pace.sleep(220);
    setField(aid, value);
    await this.pace.sleep(160);
  }

  async radio(aid: string, value: string) {
    await this.click(`${aid}:${value}`);
  }

  /** Picks a file in the upload widget, the way a person would, and waits for the portal's verdict. */
  async upload(slot: string, file: Pick<FileRef, 'name' | 'bytes'>) {
    st().patchPortal((p) => ({ staged: { ...p.staged, [slot]: { name: file.name, bytes: file.bytes } } }));
    await this.click(`upload:${slot}`);
    await this.waitFor(() => st().portal.uploads[slot]?.status !== 'uploading', 8000);
    await this.pace.sleep(260);
    return st().portal.uploads[slot];
  }

  read(aid: string) {
    return st().portal.fields[aid] ?? '';
  }

  handOver(opts: { highlight?: string; note?: string }) {
    st().patchPortal((p) => ({ controller: 'user', highlight: opts.highlight ?? null, note: opts.note ?? p.note, cursor: { ...p.cursor, visible: false } }));
  }

  takeBack() {
    st().patchPortal({ controller: 'agent', highlight: null, note: null });
  }
}
