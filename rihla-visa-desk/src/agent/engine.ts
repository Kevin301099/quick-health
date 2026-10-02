import type {
  Applicant,
  AuditActor,
  CaseData,
  CaseMeta,
  CaseRuntime,
  CaseStatus,
  Corridor,
  Item,
  Level,
  StepId,
  StepStatus,
} from './types';
import { useStore } from './store';
import { CORRIDORS } from './fixtures/corridors';
import { PEOPLE } from './fixtures/people';
import { runFlow } from './flows';
import { answer } from './router';
import { uid } from '@/lib/utils';

/*
  A small agent runtime that speaks an AG-UI style event vocabulary:
  text streams, tool calls, generated UI, interrupts for human input, plan updates and audit entries.
  The planner here is deterministic so a demo is repeatable; the surface it drives is the same one a
  model-driven planner would use. Everything the agent does is a mutation of one case's runtime state.
*/

export class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

interface Waiter {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

class Controller {
  abort = new AbortController();
  paused = false;
  private resumeFns: Array<() => void> = [];
  waiters = new Map<string, Waiter>();
  userQueue: string[] = [];
  answering = false;

  constructor(
    public caseId: string,
    public runId: number,
  ) {}

  get speed() {
    return useStore.getState().settings.speed;
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
    this.resumeFns.forEach((f) => f());
    this.resumeFns = [];
  }
}

const controllers = new Map<string, Controller>();

export interface AskSpec<T> {
  id: string;
  step: StepId;
  title: string;
  kind: 'approval' | 'input' | 'applicant';
  component: string;
  props: Record<string, unknown>;
  gen?: number;
  auto?: { delay: number; outcome: T; reason: string } | null;
}

export interface FlowCtx {
  caseId: string;
  meta: CaseMeta;
  corridor: Corridor;
  applicants: Applicant[];
  level(): Level;
  data(): CaseData;
  setData(fn: (d: CaseData) => CaseData): void;
  say(text: string): Promise<void>;
  tool<T>(
    name: string,
    args: Record<string, unknown>,
    exec: () => T | Promise<T>,
    opts?: { ms?: number; summary?: (r: T) => string },
  ): Promise<T>;
  render(component: string, props: Record<string, unknown>, opts?: { gen?: number }): Promise<string>;
  patch(itemId: string, props: Record<string, unknown>): void;
  notice(text: string, tone?: 'info' | 'warn' | 'ok'): void;
  step(id: StepId, status: StepStatus, note?: string): void;
  setStatus(status: CaseStatus): void;
  audit(actor: AuditActor, action: string, detail?: string): void;
  ask<T>(spec: AskSpec<T>): Promise<T>;
  wait(ms: number): Promise<void>;
  checkpoint(): Promise<void>;
  stat(kind: 'agent' | 'human' | 'client', n?: number): void;
}

const mutate = (id: string, fn: (c: CaseRuntime) => CaseRuntime) => useStore.getState().mutate(id, fn);

function compact(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`)
    .join(', ');
}

export function makeCtx(caseId: string, controller: Controller): FlowCtx {
  const get = () => useStore.getState().cases[caseId];
  const meta = get().meta;
  const corridor = CORRIDORS[meta.corridorId];
  const applicants = meta.applicantIds.map((id) => PEOPLE[id]);

  const addItem = (item: Item) => mutate(caseId, (c) => ({ ...c, items: [...c.items, item] }));
  const updateItem = (id: string, fn: (i: Item) => Item) =>
    mutate(caseId, (c) => ({ ...c, items: c.items.map((i) => (i.id === id ? fn(i) : i)) }));

  const ctx: FlowCtx = {
    caseId,
    meta,
    corridor,
    applicants,
    level: () => useStore.getState().settings.autonomy,
    data: () => get().data,
    setData: (fn) => mutate(caseId, (c) => ({ ...c, data: fn(c.data) })),

    async say(text) {
      controller.throwIfAborted();
      const id = uid('t');
      addItem({ kind: 'text', id, text: '', streaming: true });
      let i = 0;
      while (i < text.length) {
        i = Math.min(text.length, i + 2 + Math.floor(Math.random() * 3));
        const slice = text.slice(0, i);
        updateItem(id, (it) => (it.kind === 'text' ? { ...it, text: slice } : it));
        await controller.sleep(24);
      }
      updateItem(id, (it) => (it.kind === 'text' ? { ...it, streaming: false } : it));
      await controller.sleep(160);
    },

    async tool(name, args, exec, opts) {
      controller.throwIfAborted();
      const id = uid('tool');
      addItem({ kind: 'tool', id, name, args: compact(args), status: 'running' });
      const ms = opts?.ms ?? 900;
      await controller.sleep(ms);
      const result = await exec();
      const summary = opts?.summary ? opts.summary(result) : 'ok';
      updateItem(id, (it) => (it.kind === 'tool' ? { ...it, status: 'done', result: summary, ms } : it));
      ctx.audit('agent', name, summary);
      ctx.stat('agent');
      return result;
    },

    async render(component, props, opts) {
      controller.throwIfAborted();
      const id = uid('ui');
      const gen = opts?.gen ?? 0;
      addItem({ kind: 'ui', id, component, props, ready: gen === 0 });
      if (gen > 0) {
        await controller.sleep(gen);
        updateItem(id, (it) => (it.kind === 'ui' ? { ...it, ready: true } : it));
      }
      return id;
    },

    patch(itemId, props) {
      updateItem(itemId, (it) => (it.kind === 'ui' ? { ...it, props: { ...it.props, ...props } } : it));
    },

    notice(text, tone = 'info') {
      addItem({ kind: 'notice', id: uid('n'), text, tone });
    },

    step(id, status, note) {
      mutate(caseId, (c) => ({
        ...c,
        plan: c.plan.map((p) => (p.id === id ? { ...p, status, note: note ?? p.note } : p)),
      }));
    },

    setStatus(status) {
      mutate(caseId, (c) => ({ ...c, status }));
    },

    audit(actor, action, detail) {
      mutate(caseId, (c) => ({
        ...c,
        audit: [{ id: uid('a'), at: Date.now(), actor, action, detail }, ...c.audit],
      }));
    },

    async ask<T>(spec: AskSpec<T>): Promise<T> {
      controller.throwIfAborted();
      const itemId = await ctx.render(spec.component, { ...spec.props, interruptId: spec.id, autoReason: spec.auto?.reason }, { gen: spec.gen ?? 450 });
      const waitingStatus: CaseStatus = spec.kind === 'applicant' ? 'waiting' : 'needs_you';
      mutate(caseId, (c) => ({
        ...c,
        status: waitingStatus,
        run: { ...c.run, state: 'waiting' },
        pending: [
          ...c.pending,
          {
            id: spec.id,
            step: spec.step,
            title: spec.title,
            kind: spec.kind,
            itemId,
            auto: spec.auto ? { at: Date.now() + spec.auto.delay / controller.speed, reason: spec.auto.reason } : undefined,
          },
        ],
      }));
      ctx.step(spec.step, spec.kind === 'applicant' ? 'waiting' : 'needs_you');

      const outcome = new Promise<T>((resolve, reject) => {
        controller.waiters.set(spec.id, { resolve: resolve as (v: unknown) => void, reject });
      });

      if (spec.auto) {
        const auto = spec.auto;
        void controller
          .sleep(auto.delay)
          .then(() => resolveInterrupt(caseId, spec.id, auto.outcome, 'agent', auto.reason))
          .catch(() => undefined);
      }

      const value = await outcome;
      mutate(caseId, (c) => ({
        ...c,
        status: c.run.state === 'paused' ? 'paused' : 'running',
        run: { ...c.run, state: c.run.state === 'paused' ? 'paused' : 'running' },
      }));
      ctx.step(spec.step, 'running');
      return value;
    },

    wait: (ms) => controller.sleep(ms),

    async checkpoint() {
      await controller.whilePaused();
      while (controller.userQueue.length > 0) {
        const q = controller.userQueue.shift() as string;
        await answer(ctx, q);
      }
    },

    stat(kind, n = 1) {
      mutate(caseId, (c) => ({
        ...c,
        data: {
          ...c.data,
          stats: {
            ...c.data.stats,
            agentTasks: c.data.stats.agentTasks + (kind === 'agent' ? n : 0),
            humanTasks: c.data.stats.humanTasks + (kind === 'human' ? n : 0),
            clientTasks: c.data.stats.clientTasks + (kind === 'client' ? n : 0),
          },
        },
      }));
    },
  };
  return ctx;
}

/** Settle a pending interrupt. Called by cards (a person) and by the autonomy policy (the agent). */
export function resolveInterrupt(
  caseId: string,
  id: string,
  outcome: unknown,
  by: 'human' | 'client' | 'agent' = 'human',
  reason?: string,
) {
  const controller = controllers.get(caseId);
  const waiter = controller?.waiters.get(id);
  if (!controller || !waiter) return false;
  controller.waiters.delete(id);
  const rt = useStore.getState().cases[caseId];
  const pend = rt?.pending.find((p) => p.id === id);
  mutate(caseId, (c) => ({
    ...c,
    pending: c.pending.filter((p) => p.id !== id),
    items: c.items.map((i) =>
      pend && i.id === pend.itemId && i.kind === 'ui'
        ? { ...i, props: { ...i.props, resolved: { by, outcome, reason, at: Date.now() } } }
        : i,
    ),
    audit: [
      {
        id: uid('a'),
        at: Date.now(),
        actor: by === 'human' ? 'human' : by === 'client' ? 'client' : 'agent',
        action: by === 'agent' ? `Settled by policy: ${pend?.title ?? id}` : `${pend?.title ?? id}`,
        detail: reason,
      },
      ...c.audit,
    ],
    data: {
      ...c.data,
      stats: {
        ...c.data.stats,
        agentTasks: c.data.stats.agentTasks + (by === 'agent' ? 1 : 0),
        humanTasks: c.data.stats.humanTasks + (by === 'human' ? 1 : 0),
        clientTasks: c.data.stats.clientTasks + (by === 'client' ? 1 : 0),
      },
    },
  }));
  waiter.resolve(outcome);
  return true;
}

export function startRun(caseId: string) {
  const st = useStore.getState();
  const rt = st.cases[caseId];
  if (!rt) return;
  if (['running', 'waiting', 'paused'].includes(rt.run.state) && controllers.has(caseId)) return;
  const prevRun = rt.run.runId;
  if (rt.run.state === 'done' || rt.run.state === 'stopped') st.reset(caseId);
  const runId = prevRun + 1;
  const controller = new Controller(caseId, runId);
  controllers.set(caseId, controller);
  mutate(caseId, (c) => ({
    ...c,
    status: 'running',
    run: { state: 'running', runId },
    data: { ...c.data, startedAt: Date.now() },
    audit: [{ id: uid('a'), at: Date.now(), actor: 'human', action: 'Started the agent', detail: `Autonomy L${useStore.getState().settings.autonomy}` }, ...c.audit],
  }));
  const ctx = makeCtx(caseId, controller);
  void (async () => {
    try {
      await runFlow(ctx);
      mutate(caseId, (c) => ({
        ...c,
        run: { ...c.run, state: 'done' },
        data: { ...c.data, finishedAt: Date.now() },
      }));
    } catch (e) {
      if (e instanceof AbortError) {
        mutate(caseId, (c) => ({
          ...c,
          status: 'paused',
          run: { ...c.run, state: 'stopped' },
          pending: [],
          items: [...c.items, { kind: 'notice', id: uid('n'), text: 'Stopped. Run again to start the case from the top.', tone: 'warn' }],
        }));
      } else {
        console.error(e);
        mutate(caseId, (c) => ({
          ...c,
          status: 'paused',
          run: { ...c.run, state: 'stopped' },
          items: [...c.items, { kind: 'notice', id: uid('n'), text: 'The agent hit an unexpected error and stopped.', tone: 'warn' }],
        }));
      }
    } finally {
      if (controllers.get(caseId) === controller) controllers.delete(caseId);
    }
  })();
}

export function pauseRun(caseId: string) {
  const c = controllers.get(caseId);
  if (!c) return;
  c.setPaused(true);
  mutate(caseId, (r) => ({ ...r, status: 'paused', run: { ...r.run, state: 'paused' } }));
}

export function resumeRun(caseId: string) {
  const c = controllers.get(caseId);
  if (!c) return;
  c.setPaused(false);
  mutate(caseId, (r) => {
    const waiting = r.pending.length > 0;
    return { ...r, status: waiting ? 'needs_you' : 'running', run: { ...r.run, state: waiting ? 'waiting' : 'running' } };
  });
}

export function stopRun(caseId: string) {
  controllers.get(caseId)?.stop();
}

export function isRunning(caseId: string) {
  return controllers.has(caseId);
}

/** A person typed into the composer. Answer now when the agent is idle or waiting, otherwise queue for the next checkpoint. */
export function sendUserMessage(caseId: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  mutate(caseId, (c) => ({ ...c, items: [...c.items, { kind: 'user', id: uid('u'), text: clean }] }));
  const live = controllers.get(caseId);
  const rt = useStore.getState().cases[caseId];
  const busy = live && rt.run.state === 'running';
  if (busy && live) {
    live.userQueue.push(clean);
    mutate(caseId, (c) => ({
      ...c,
      items: [...c.items, { kind: 'notice', id: uid('n'), text: 'Noted. I will answer at the next checkpoint.', tone: 'info' }],
    }));
    return;
  }
  const controller = live ?? new Controller(caseId, rt.run.runId);
  if (controller.answering) {
    controller.userQueue.push(clean);
    return;
  }
  controller.answering = true;
  const ctx = makeCtx(caseId, controller);
  void (async () => {
    try {
      await answer(ctx, clean);
      while (controller.userQueue.length > 0 && !live) {
        await answer(ctx, controller.userQueue.shift() as string);
      }
    } catch (e) {
      if (!(e instanceof AbortError)) console.error(e);
    } finally {
      controller.answering = false;
    }
  })();
}
