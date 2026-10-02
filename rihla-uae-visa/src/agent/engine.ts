import type { AppSnapshot, AuditActor, FlowData, Item, PendingAction, PhaseId, PhaseStatus } from './types';
import { useStore } from './store';
import { Browser } from './browser';
import { runFlow } from './flows';
import { answer } from './router';
import { uid } from '@/lib/utils';

/*
  A small agent runtime. It streams text, tool calls and generated UI, drives the sandbox browser,
  and stops at "interrupts" whenever a person has to act: a code, a signature, a payment.
  The planner is deterministic so a demo is repeatable. The surface it drives is the one a
  model-driven planner would use.
*/

export class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

/** Thrown by a flow to end the run on purpose, for example when the person chooses to wait for a new passport. */
export class FlowStop extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'FlowStop';
  }
}

interface Waiter {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

class Controller {
  abort = new AbortController();
  paused = false;
  manualPause = false;
  private resumeFns: Array<() => void> = [];
  waiters = new Map<string, Waiter>();
  summaries = new Map<string, (o: never) => string>();
  unsubs = new Map<string, () => void>();
  userQueue: string[] = [];
  answering = false;

  get speed() {
    return useStore.getState().speed;
  }

  throwIfAborted() {
    if (this.abort.signal.aborted) throw new AbortError();
  }

  async whilePaused() {
    while (this.paused) {
      this.throwIfAborted();
      await new Promise<void>((r) => this.resumeFns.push(r));
    }
    this.throwIfAborted();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      const fns = this.resumeFns;
      this.resumeFns = [];
      fns.forEach((f) => f());
    }
  }

  async sleep(ms: number) {
    const total = Math.max(0, ms / this.speed);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, total);
      this.abort.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
    await this.whilePaused();
  }

  stop() {
    this.abort.abort();
    this.waiters.forEach((w) => w.reject(new AbortError()));
    this.waiters.clear();
    this.unsubs.forEach((u) => u());
    this.unsubs.clear();
    this.resumeFns.forEach((f) => f());
    this.resumeFns = [];
  }
}

let controller: Controller | null = null;

export interface AskSpec<T> {
  id: string;
  phase: PhaseId;
  title: string;
  component: string;
  props: Record<string, unknown>;
  summarise: (o: T) => string;
  /** Resolve from outside the card, for example when the portal reaches a page. Return a value to resolve with it. */
  until?: (s: ReturnType<typeof useStore.getState>) => T | null | undefined | false;
}

export interface FlowCtx {
  browser: Browser;
  app(): AppSnapshot;
  data(): FlowData;
  setData(fn: (d: FlowData) => FlowData): void;
  say(text: string): Promise<void>;
  tool<T>(name: string, args: Record<string, unknown>, exec: () => T | Promise<T>, opts?: { ms?: number; summary?: (r: T) => string }): Promise<T>;
  render(component: string, props: Record<string, unknown>, opts?: { gen?: number }): Promise<string>;
  patchItem(id: string, props: Record<string, unknown>): void;
  notice(text: string, tone?: 'info' | 'warn' | 'ok'): void;
  phase(id: PhaseId, status: PhaseStatus, note?: string): void;
  audit(actor: AuditActor, action: string, detail?: string): void;
  ask<T>(spec: AskSpec<T>): Promise<T>;
  wait(ms: number): Promise<void>;
  checkpoint(): Promise<void>;
}

const set = (fn: (s: ReturnType<typeof useStore.getState>) => Partial<ReturnType<typeof useStore.getState>>) => useStore.setState((s) => fn(s));

function compact(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`)
    .join(', ');
}

export function makeCtx(c: Controller): FlowCtx {
  const addItem = (item: Item) => set((s) => ({ items: [...s.items, item] }));
  const updateItem = (id: string, fn: (i: Item) => Item) => set((s) => ({ items: s.items.map((i) => (i.id === id ? fn(i) : i)) }));

  const ctx: FlowCtx = {
    browser: new Browser(c),
    app: () => {
      const s = useStore.getState();
      return { answers: s.answers, profile: s.profile, files: s.files };
    },
    data: () => useStore.getState().data,
    setData: (fn) => set((s) => ({ data: fn(s.data) })),

    async say(text) {
      c.throwIfAborted();
      const id = uid('t');
      addItem({ kind: 'text', id, text: '', streaming: true });
      let i = 0;
      while (i < text.length) {
        i = Math.min(text.length, i + 2 + Math.floor(Math.random() * 3));
        const slice = text.slice(0, i);
        updateItem(id, (it) => (it.kind === 'text' ? { ...it, text: slice } : it));
        await c.sleep(22);
      }
      updateItem(id, (it) => (it.kind === 'text' ? { ...it, streaming: false } : it));
      await c.sleep(160);
    },

    async tool(name, args, exec, opts) {
      c.throwIfAborted();
      const id = uid('tool');
      addItem({ kind: 'tool', id, name, args: compact(args), status: 'running' });
      const ms = opts?.ms ?? 800;
      await c.sleep(ms);
      const result = await exec();
      const summary = opts?.summary ? opts.summary(result) : 'ok';
      updateItem(id, (it) => (it.kind === 'tool' ? { ...it, status: 'done', result: summary, ms } : it));
      ctx.audit('agent', name, summary);
      set((s) => ({ data: { ...s.data, stats: { ...s.data.stats, agent: s.data.stats.agent + 1 } } }));
      return result;
    },

    async render(component, props, opts) {
      c.throwIfAborted();
      const id = uid('ui');
      const gen = opts?.gen ?? 0;
      addItem({ kind: 'ui', id, component, props, ready: gen === 0 });
      if (gen > 0) {
        await c.sleep(gen);
        updateItem(id, (it) => (it.kind === 'ui' ? { ...it, ready: true } : it));
      }
      return id;
    },

    patchItem(id, props) {
      updateItem(id, (it) => (it.kind === 'ui' ? { ...it, props: { ...it.props, ...props } } : it));
    },

    notice(text, tone = 'info') {
      addItem({ kind: 'notice', id: uid('n'), text, tone });
    },

    phase(id, status, note) {
      set((s) => ({ phases: s.phases.map((p) => (p.id === id ? { ...p, status, note: note ?? (status === 'done' ? undefined : p.note) } : p)) }));
    },

    audit(actor, action, detail) {
      set((s) => ({ audit: [{ id: uid('a'), at: Date.now(), actor, action, detail }, ...s.audit] }));
    },

    async ask<T>(spec: AskSpec<T>): Promise<T> {
      c.throwIfAborted();
      const uiId = uid('ui');
      const actionId = uid('act');
      const pending: PendingAction = { id: spec.id, phase: spec.phase, title: spec.title, uiId, actionId };
      set((s) => ({
        items: [
          ...s.items,
          { kind: 'ui', id: uiId, component: spec.component, props: { ...spec.props, actionId: spec.id }, ready: true, dock: true },
          { kind: 'action', id: actionId, title: spec.title, status: 'waiting', uiId },
        ],
        pending: [...s.pending, pending],
        phases: s.phases.map((p) => (p.id === spec.phase ? { ...p, status: 'needs_you' as const } : p)),
        run: { ...s.run, state: 'waiting' },
      }));
      c.summaries.set(spec.id, spec.summarise as (o: never) => string);

      const outcome = new Promise<T>((resolve, reject) => {
        c.waiters.set(spec.id, { resolve: resolve as (v: unknown) => void, reject });
      });

      if (spec.until) {
        const until = spec.until;
        const check = (s: ReturnType<typeof useStore.getState>) => {
          const r = until(s);
          if (r) resolveAction(spec.id, r, 'portal');
        };
        c.unsubs.set(spec.id, useStore.subscribe(check));
        check(useStore.getState());
      }

      const value = await outcome;
      c.unsubs.get(spec.id)?.();
      c.unsubs.delete(spec.id);
      set((s) => ({
        phases: s.phases.map((p) => (p.id === spec.phase ? { ...p, status: 'running' as const } : p)),
        run: { ...s.run, state: s.run.state === 'paused' ? 'paused' : s.pending.length ? 'waiting' : 'running' },
      }));
      return value;
    },

    wait: (ms) => c.sleep(ms),

    async checkpoint() {
      await c.whilePaused();
      while (c.userQueue.length > 0) {
        const q = c.userQueue.shift() as string;
        await answer(ctx, q);
      }
    },
  };
  return ctx;
}

/** Settle a pending action. Called by cards (a person) and by the portal (when it reaches a page). */
export function resolveAction(id: string, outcome: unknown, by: 'you' | 'portal' | 'agent' = 'you') {
  const c = controller;
  const w = c?.waiters.get(id);
  if (!c || !w) return false;
  c.waiters.delete(id);
  const summarise = c.summaries.get(id);
  const summary = summarise ? summarise(outcome as never) : 'Done';
  c.summaries.delete(id);
  const pend = useStore.getState().pending.find((p) => p.id === id);
  set((s) => ({
    pending: s.pending.filter((p) => p.id !== id),
    items: s.items.map((i) => {
      if (pend && i.id === pend.actionId && i.kind === 'action') return { ...i, status: 'done' as const, summary };
      if (pend && i.id === pend.uiId && i.kind === 'ui') return { ...i, props: { ...i.props, resolved: { by, outcome, at: Date.now() } } };
      return i;
    }),
    audit: [{ id: uid('a'), at: Date.now(), actor: by === 'you' ? ('you' as const) : by === 'portal' ? ('portal' as const) : ('agent' as const), action: pend?.title ?? id, detail: summary }, ...s.audit],
    data: { ...s.data, stats: { ...s.data.stats, you: s.data.stats.you + (by === 'you' ? 1 : 0) } },
  }));
  w.resolve(outcome);
  return true;
}

export function startRun() {
  const s = useStore.getState();
  if (controller && ['running', 'waiting', 'paused'].includes(s.run.state)) return;
  s.resetRun();
  const id = s.run.id + 1;
  const c = new Controller();
  controller = c;
  useStore.setState({ run: { state: 'running', id } });
  const ctx = makeCtx(c);
  ctx.audit('you', 'Started the filing', 'Documents uploaded');
  void (async () => {
    try {
      await runFlow(ctx);
      set((st) => ({ run: { ...st.run, state: 'done' } }));
    } catch (e) {
      if (e instanceof FlowStop) {
        set((st) => ({
          run: { ...st.run, state: 'done' },
          pending: [],
          items: [...st.items, { kind: 'notice', id: uid('n'), text: e.reason, tone: 'warn' }],
        }));
      } else if (e instanceof AbortError) {
        set((st) => ({
          run: { ...st.run, state: 'stopped' },
          pending: [],
          portal: { ...st.portal, controller: 'agent', highlight: null, cursor: { ...st.portal.cursor, visible: false } },
          items: [...st.items, { kind: 'notice', id: uid('n'), text: 'Stopped. Start again to file from the top. Nothing was submitted.', tone: 'warn' }],
        }));
      } else {
        console.error(e);
        set((st) => ({
          run: { ...st.run, state: 'stopped' },
          pending: [],
          items: [...st.items, { kind: 'notice', id: uid('n'), text: 'The agent hit an unexpected problem and stopped. Nothing was submitted.', tone: 'warn' }],
        }));
      }
    } finally {
      if (controller === c) controller = null;
    }
  })();
}

export function pauseRun() {
  if (!controller) return;
  controller.setPaused(true);
  set((s) => ({ run: { ...s.run, state: 'paused' } }));
}

export function resumeRun() {
  if (!controller) return;
  controller.setPaused(false);
  controller.manualPause = false;
  set((s) => ({ run: { ...s.run, state: s.pending.length ? 'waiting' : 'running' } }));
}

export function stopRun() {
  controller?.stop();
}

/** The person grabs the mouse. The agent stops where it is until they hand control back. */
export function takeControl() {
  const s = useStore.getState();
  s.patchPortal({ controller: 'user', note: 'You are in control' });
  if (controller && s.run.state === 'running') {
    controller.manualPause = true;
    controller.setPaused(true);
    set((st) => ({ run: { ...st.run, state: 'paused' } }));
  }
}

export function handBack() {
  const s = useStore.getState();
  s.patchPortal({ controller: 'agent', highlight: null, note: null });
  if (controller?.manualPause) {
    controller.manualPause = false;
    controller.setPaused(false);
    set((st) => ({ run: { ...st.run, state: st.pending.length ? 'waiting' : 'running' } }));
  }
}

export function isActive() {
  return controller !== null;
}

/** The person typed into the composer. Answer now when the agent is idle or waiting; otherwise queue it for the next checkpoint. */
export function sendUserMessage(text: string) {
  const clean = text.trim();
  if (!clean) return;
  set((s) => ({ items: [...s.items, { kind: 'user', id: uid('u'), text: clean }] }));
  const s = useStore.getState();
  if (controller && s.run.state === 'running') {
    controller.userQueue.push(clean);
    set((st) => ({ items: [...st.items, { kind: 'notice', id: uid('n'), text: 'Got it. I will answer at the next checkpoint.', tone: 'info' }] }));
    return;
  }
  const c = controller ?? new Controller();
  if (c.answering) {
    c.userQueue.push(clean);
    return;
  }
  c.answering = true;
  const ctx = makeCtx(c);
  void (async () => {
    try {
      await answer(ctx, clean);
      while (c.userQueue.length > 0 && !controller) await answer(ctx, c.userQueue.shift() as string);
    } catch (e) {
      if (!(e instanceof AbortError)) console.error(e);
    } finally {
      c.answering = false;
    }
  })();
}
