# Rihla Visa Desk

An agentic visa desk for UAE travel and visa agencies. This folder holds the **landing page** and a **working demo console** in one Next.js app.

The working name is a placeholder. All people, passport numbers and messages are fictional. Submissions go to a sandbox, and nothing reaches a government.

## What is in it

- **Landing page** (`src/components/landing`): hero with a live agent preview, Emirati-first routes, the agent loop, the generative workspace explained, an autonomy table computed from the real policy, trust principles, pricing in AED, FAQ and contact.
- **Demo console** (`src/components/console`): case desk, agent conversation with generated UI, activity panel (plan, who did what, audit trail), new-case modal, autonomy levels (L1 to L3), speed control and light and dark themes.
- **Agent runtime** (`src/agent`): a small, deterministic planner that speaks an AG-UI style event vocabulary.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, console at /demo or #demo
npm run typecheck
npm run design-lint    # Impeccable anti-pattern detector over src/
npm run build:artifact # static export plus a single self-contained HTML in artifact/index.html
```

## How the agent works

The agent never emits markup. It emits `{ component, props }`, and a fixed registry (`src/components/genui/registry.tsx`) decides how that renders. Unknown names fall back to a plain card.

| Piece | File | Job |
| --- | --- | --- |
| Engine | `src/agent/engine.ts` | Streams text, tool calls and generated UI. Pauses for people (interrupts). Pause, resume, stop. |
| Flows | `src/agent/flows.ts` | The steps for each route: intake, rules, advisory, documents, checks, draft, quote, approval, applicant, submit, track, watch, wrap. |
| Policy | `src/agent/policy.ts` | `allowAuto(level, risk)` decides who settles a decision. |
| Checks | `src/agent/checks.ts` | Real cross-checks: name spelling, passport validity, funds, date clashes. |
| Rule packs | `src/agent/fixtures/corridors.ts` | Versioned data per route, with source and review date. |
| Router | `src/agent/router.ts` | Free-form questions answered locally. |
| Live model | `src/agent/live.ts` | Optional. Uses the Claude viewer's `sample` capability when it is declared. |

Autonomy levels: **L1 Guided** asks before every step, **L2 Supervised** settles low-risk items, **L3 Autopilot** settles low and medium items. High-risk items and applicant-only steps always go to a person.

### Add a route

1. Add a rule pack to `src/agent/fixtures/corridors.ts` (fees, validity, requirements, applicant-only steps, tracking).
2. Pick its `steps`. The flows adapt: an advisory step, a signature step or a watch step are all optional.
3. Add any new check to `crossCheck` in `src/agent/checks.ts`.

## Data you must verify before real use

The rule packs were compiled from public sources on 2 October 2026 and are **demo data**. Fees, timings and advisories change. In particular, the US visa advisory is dated 17 July 2026 and must be re-checked. Production needs a maintained rules service with a human reviewer, never a model's memory.

## Boundaries by design

- The applicant signs, answers declarations and takes selfies. The agent prepares around them.
- No slot bots and no workarounds for portal bot protection.
- Live submission is enabled per route only after the portal's terms are checked. This build is sandbox only.

## Packaging as a single file

`scripts/inline-artifact.mjs` inlines the CSS and every script of the static export into one HTML fragment, because the host supplies the document, head and body. The pages router is used so React hydrates only `#__next`.
