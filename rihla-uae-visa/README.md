# Rihla UAE Visa

A web app (desktop first) where an AI agent files a **UAE visa** application for the traveller.

1. **Check.** Pick your passport. The app tells you whether you need a visa at all.
2. **Upload everything first.** Passport, photo, ticket, hotel and insurance (a family visit adds the sponsor's papers). Nothing is filed yet.
3. **The agent files.** It reads the documents, cross-checks them, then opens a portal in a browser panel you can watch: a visible cursor, typing, uploads, a read-back of the review page.
4. **You step in when it needs you.** The email code, the declarations, the sign-off, the sponsor's approval and the payment each appear as one pinned "Your turn" card. Do it, and the agent carries on. You can also pause, stop, or take over the browser and hand it back.
5. **The permit arrives**, with a short "before you fly" checklist.

Everything fictional or simulated: the portal is a **sandbox** (labelled as one, not affiliated with any government), and all people and numbers are made up. UAE rules and fees in the app are demo data compiled from public sources on 2 Oct 2026 and must be re-verified.

## What is real in the demo

- **Photo check** is measured on the pixels in your browser: shape ratio, background lightness and flatness, resolution, file weight.
- **Cross-checks** (`src/domain/checks.ts`) are computed: passport validity, name match across documents, arrival window, stay length, insurance cover.
- **The browser panel** is a real page the agent drives through the same logic a person uses. A too-large photo is rejected by the portal and the agent shrinks and retries.
- **Eligibility** by nationality group (`src/domain/nationalities.ts`).

Not done in the demo: reading your own uploaded files (no OCR, so you confirm the details by typing), a live model (the agent is a deterministic script that speaks an AG-UI style event vocabulary), Arabic UI, and any real government filing. Production needs a licensed UAE sponsor partner, a legal review and a maintained rules service.

## Layout

- `src/domain`: visa products and fees, eligibility, sample travellers, cross-checks, photo analysis.
- `src/agent`: store, engine (human-in-the-loop `ask`, pause, takeover), browser bridge, flows, local answers.
- `src/portal`: the sandbox portal (logic, view, store wiring).
- `src/components/cards`: the generative-UI card registry the agent renders from `{component, props}`.
- `src/components/room`: the Filing Room (ribbon, browser panel, agent panel with the pinned dock).
- `src/components/start`: the eligibility, trip and document-upload wizard.
- `src/components/landing`: the landing page.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run typecheck
npm run design-lint    # Impeccable anti-pattern detector
npm run build:artifact # static export plus one self-contained HTML in artifact/index.html
```

Stack: Next.js (pages router, static export), React, TypeScript, Tailwind v4, motion, zustand. Light and dark themes follow the viewer.
