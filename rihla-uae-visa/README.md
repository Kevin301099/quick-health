# Rihla UAE Visa

A web app (desktop first) that files **UAE tourist visas** for travellers. It runs two ways from one codebase:

- **Live product.** Build with `NEXT_PUBLIC_API_URL` pointing at the API in `backend/`. Real sign-in, uploads, passport reading, checks, signature, Stripe payment, filing through a licensed partner, status tracking, visa download and an ops console. See [`docs/GO-LIVE.md`](docs/GO-LIVE.md) for what you need to launch and what it costs to run.
- **Demo.** Build without it. A self-contained, scripted walkthrough that files into a sandbox portal you can watch. This is what the published preview shows.

## Live product

1. **Trip.** Passport nationality (with an eligibility check), dates, emirate, 30 or 60 days. Sign in with an emailed six-digit code.
2. **Documents.** Passport and photo are required; ticket, hotel and insurance are optional. Files go straight to storage. The passport is read by Claude and the reading is proven by the check digits in its machine-readable zone. The photo is measured in the browser, and a dark background can be fixed in one click.
3. **Details and checks.** Fields are pre-filled from the passport; anything uncertain is highlighted. Passport validity, the 60-day window and stay length are checked before payment.
4. **Sign.** The traveller answers the declarations and types their name. The application is then locked.
5. **Pay.** Stripe hosted checkout in AED. The card never reaches Rihla.
6. **Filed and tracked.** The partner files it (through the ops console or the partner's API). The traveller gets an email at every change and downloads the visa PDF.

Run both halves locally:

```bash
cd backend && npm install && npm run dev            # API on :8787 (embedded database, files on disk, emails in the console)
cd .. && NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev   # web app on :3000
```

Sign-in codes print in the API console. Payments use a test checkout page, and the sandbox filer approves after 20 seconds. Add yourself to `OPS_EMAILS` to open the ops console at `#ops`.

In production every piece is pay-as-you-go, so the running cost with nobody applying is close to zero: the API runs on AWS Lambda (`backend/deploy/template.yaml`) or as a container (`backend/Dockerfile`), with Neon Postgres, R2 or S3 storage, and SES email. Costs, spending guards and the deploy steps are in [`docs/GO-LIVE.md`](docs/GO-LIVE.md).

## The demo

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

- `backend/`: the API (Hono, TypeScript). Applications, documents, passport reading with spending guards, payments, filing providers, ops endpoints, background jobs. Runs as a Node server, a container, or on AWS Lambda (`src/lambda.ts`, `deploy/template.yaml`). Tests in `backend/test` (embedded Postgres by default, or a real one with `TEST_DATABASE_URL`).
- `src/live`: the live product screens (sign-in, trip, application, payment, tracking, ops console).
- `src/domain`: visa products and fees, eligibility, sample travellers, cross-checks, photo analysis.
- `src/agent`: store, engine (human-in-the-loop `ask`, pause, takeover), browser bridge, flows, local answers.
- `src/portal`: the sandbox portal (logic, view, store wiring).
- `src/components/cards`: the generative-UI card registry the agent renders from `{component, props}`.
- `src/components/room`: the Filing Room (ribbon, browser panel, agent panel with the pinned dock).
- `src/components/start`: the eligibility, trip and document-upload wizard.
- `src/components/landing`: the landing page.

## Run the demo

```bash
npm install
npm run dev            # http://localhost:3000 (no API URL: demo mode)
npm run typecheck
npm run design-lint    # Impeccable anti-pattern detector
npm run build:artifact # static export plus one self-contained HTML in artifact/index.html
```

Stack: Next.js (pages router, static export), React, TypeScript, Tailwind v4, motion, zustand. Light and dark themes follow the viewer.
