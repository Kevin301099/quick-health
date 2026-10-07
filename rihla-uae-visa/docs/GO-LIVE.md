# Taking Rihla live

This is the checklist for filing real UAE tourist visas for real travellers. The code is ready to run in production; most of what remains is business setup that only you can do.

## 1. Who files the visa (the one hard requirement)

A standard 30- or 60-day UAE tourist visa must be sponsored. GDRFA Dubai's service page names a business in the tourism sector as the host ([GDRFA Dubai](https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8)), and the other sponsors are airlines, hotels, or a UAE resident sponsoring their own family or friends. There is no public government API. So Rihla prepares, checks and takes payment, and a licensed partner files.

### Can a browser bot replace the licence?

No. The sponsor requirement belongs to the **visa**, not to the software that fills the form. A bot that types into the government portal still has to be logged in as a sponsor. If that is not your own licensed account, it is someone else's, and using it without their agreement is impersonation. Automating it does not change who the sponsor is.

Filing real applications this way, for paying customers, also exposes you to the following:

- The account gets blocked.
- Payments are taken for visas you cannot deliver, which means chargebacks and complaints.
- You are processing passport data without a lawful basis under the UAE PDPL.
- UAE cybercrime law covers access to government systems.

Ask a UAE lawyer before trying any variant of this. Rihla's code deliberately never drives a government portal.

Here is what does work without your own licence:

| Path | What you do | What the partner or traveller does |
|---|---|---|
| **Licensed partner** (built, recommended) | Everything up to and including payment: documents, passport reading, checks, signature, payment, status updates. | A licensed tourism company files. You pay their rate per visa (set `GOV_FEE_*` from it). |
| **Partner portal automation** (possible next step) | With the partner's **written permission**, a browser agent fills *their* B2B portal from each paid application, instead of your ops team copying fields. Ask for this when you sign the agreement; an API (`partner_http`) is better still. | The partner stays the sponsor and the filer of record. |
| **Traveller files it themselves** | A preparation service: checks, photo fixes, a filled-in summary, step-by-step guidance. Charge for the help, never for the visa itself. | The traveller applies through an official route open to individuals, such as an airline's visa service when they fly Emirates, Etihad or flydubai. Higher-income travellers can use the self-sponsored 5-year multiple-entry tourist visa. |
| **Your own licence** (later) | Hold a Dubai tourism licence and immigration establishment card, and file directly. The `manual` mode then becomes your own team on the official portal. | Nothing; you are the sponsor. |

The backend supports the partner path in three ways, set with `FILING_PROVIDER`:

| Mode | How it works | When to use it |
|---|---|---|
| `manual` | Paid applications land in the **ops console** (`#ops`). Your team copies the prepared fields (one-click copy buttons) into the partner's B2B portal, uploads the documents, then marks the case filed, asks the traveller for more, or uploads the issued visa PDF. | **Launch with this.** Works with any licensed partner from day one, no integration needed. |
| `partner_http` | The API submits to the partner's API (with an idempotency key, so a retry never files twice) and polls for status. Mapping lives in `backend/src/providers.ts` (`toPartner` / `fromPartner`), marked as a template. | Once a partner gives you API documentation. JETT (Musafir) announced a B2B Visa API in September 2026; ask for its docs and sandbox. |
| `sandbox` | Approves everything after a short wait with a clearly marked fake PDF. | Development and demos only. Production refuses to start with it. |

## 2. Business checklist

- [ ] Signed agreement with a licensed UAE tourism partner, including their **rate card**. Set `GOV_FEE_TOURIST_30` and `GOV_FEE_TOURIST_60` from it.
- [ ] Your **trade licence** covers visa assistance or travel services.
- [ ] Your service fee (`SERVICE_FEE`, AED, before VAT) and a written **refund policy**. The app promises a refund if you cannot file after payment.
- [ ] **Privacy policy and terms** reviewed by UAE counsel. You process passport data under the UAE PDPL. List your processors: hosting, database, storage, email, Stripe, Anthropic (passport reading), and your partner. Get consent for any transfer outside the UAE, or host in the UAE.
- [ ] A **full nationality list** with current entry rules. The app ships with 20 nationalities (`src/domain/nationalities.ts`); real users come from everywhere.
- [ ] Someone on the **ops rota** to work the console at least twice a day.

## 3. The pay-as-you-go stack

Every service below bills only for what is used. None has a monthly plan you pay for while nobody is applying; Stripe and Anthropic were already per use.

| Service | Used for | How it bills | Setting |
|---|---|---|---|
| **AWS Lambda** with a Function URL | The API (`backend/`) | Per request and per millisecond. The free tier is 1 million requests and 400,000 GB-seconds a month. Function URLs cost nothing extra (no API Gateway). | `deploy/template.yaml` |
| **Neon** Postgres | Applications, users, audit trail, AI spend ledger | Per compute-hour while awake. It sleeps after about 5 idle minutes. The free plan has 100 compute-hours a month. | `DATABASE_URL` (the pooled one) |
| **Cloudflare R2** (or S3 in `me-central-1` for UAE residency) | Passport, photo and visa files. Turn on encryption at rest. | Per GB stored, with 10 GB free and no download fees. | `STORAGE_DRIVER=s3`, `S3_*` |
| **Amazon SES** | Sign-in codes and status emails | About $0.10 per 1,000 emails, with no plan. New accounts start in the SES sandbox; request production access. | `MAIL_DRIVER=ses` |
| **EventBridge Scheduler** | Background work (retries, partner polling, deleting old files) | 14 million invocations a month free. One run every 10 minutes is about 4,300 a month. | `TickRate` in the template |
| **Stripe** (UAE entity) | Hosted checkout in AED, refunds | Per payment | `STRIPE_*`, webhook `{API URL}/v1/webhooks/stripe` for `checkout.session.completed` |
| **Anthropic API** | Reading the passport page | Per token | `ANTHROPIC_API_KEY`. Check the data-retention terms that fit passport data. |
| **Cloudflare Pages** (or Bunny CDN) | The web app: static files | Free on Pages; Bunny is per GB with a $1 monthly minimum | build with `NEXT_PUBLIC_API_URL` |

Prefer one provider with fewer moving parts? The same API runs as a container (`backend/Dockerfile`) on hosts that bill by CPU actually used, such as Google Cloud Run, Fly.io machines with auto-stop, or Bunny Magic Containers. It also runs as a plain Node server (`npm start`).

## 4. Deploy

```bash
# API on AWS Lambda (recommended)
cd rihla-uae-visa/backend
npm ci && npm test && npm run build          # bundles to dist/lambda and dist/server (no node_modules needed)
DATABASE_URL=... npm run migrate             # once per release; the API itself skips migrations on Lambda
sam deploy --guided -t deploy/template.yaml  # region me-central-1 keeps processing in the UAE
# The output ApiUrl is your API. Point the Stripe webhook at <ApiUrl>v1/webhooks/stripe.

# Or as a container (Cloud Run, Fly.io, Bunny Magic Containers), built from the rihla-uae-visa folder
docker build -f backend/Dockerfile -t rihla-api .

# Web app (static files, any CDN)
cd rihla-uae-visa
NEXT_PUBLIC_API_URL=https://<your API URL without trailing slash> npm run build   # output in out/
```

The API refuses to start in production with development drivers, a weak secret or missing keys, so a misconfigured deploy fails loudly instead of quietly using fake payments.

Background work runs on a schedule rather than constantly. Filing happens the moment payment lands, and the scheduled run only:

- retries filings that failed,
- asks a partner API for news, and
- deletes old documents.

Use every 10 minutes with `partner_http` and hourly with `manual`, so the database can sleep in between.

- **On Lambda:** the template's scheduler invokes the function directly.
- **On a container host:** set `TICK_SECONDS` to run it in-process.
- **On any other serverless host:** set `TICK_SECONDS=0` and call `POST /internal/tick` with header `x-cron-secret: $CRON_SECRET`.

Tests run on an embedded Postgres by default. Run them on a real one with `TEST_DATABASE_URL=postgres://... npm test`.

## 5. What it costs to run

### Per application

These are estimates for one traveller, start to finish, before the partner's fee. Prices change; check each provider.

| Item | Per application | Notes |
|---|---|---|
| **Card payment** | **AED 11.70–15.40** | Stripe UAE charges 2.9% + AED 1 on domestic cards, plus 1% for international ones, on AED 368.55. This is about 99% of your running cost. |
| Passport reading, Claude Opus 5.5 | about $0.022 | About 2,500 input and 600 output tokens at low effort, read once per file. |
| Passport reading with the optional cheap first pass | about $0.001–0.023 | See "Model choice" below. |
| API compute (Lambda) | about $0.0001 | About 80 requests including status polls, plus one passport reading (about 10 s) at 512 MB. It stays inside the free tier up to roughly 12,000 applications a month. |
| Email (SES) | about $0.0006 | About 6 emails. |
| Files (R2) | under $0.0001 | About 1–3 MB, deleted 30 days after a decision. |
| Database (Neon) | $0 at launch | Most months fit in the free 100 compute-hours. If it never sleeps (busy all day), expect about $19 a month at the smallest size. |

### Per month

- **With nobody applying:** about **$0**, plus your domain (and $1 if you host the web app on Bunny). There are no servers, plans or seats.
- **At 1,000 applications a month:** about **$22–45 in AI and infrastructure**. Card fees of about AED 11,700–15,400 come on top, and they go up and down with revenue.

### Where the savings come from

- **Nothing runs between visitors.**
  - The API is a Lambda function, and the database sleeps.
  - Filing happens on payment, so the scheduler runs rarely.
  - Database connections close after 10 idle seconds.
- **Cheap polling.**
  - The status page asks "has anything changed?" and gets an empty reply while nothing has.
  - It backs off from 3 seconds to a minute, and stops while the tab is hidden.
  - The ops console only refreshes while someone is looking.
- **Small cold starts.** Everything is bundled into about 115 KB of start-up code (about 40 ms to load). Stripe and the Claude SDK load only on the requests that use them.
- **Smaller files.**
  - Phone photos of a passport (4–12 MB) are shrunk in the browser to a sharp 2,000-pixel JPEG before upload.
  - Uploads go straight to storage with signed URLs, never through the API.
- **The model is called once, and only for the passport.**
  - Dates, validity, photo shape and background are checked by plain code; the photo is measured in the traveller's own browser.
  - The passport's own check digits prove the reading, so there is no second "double-check" call.
  - The same file is never read twice.
- **Spending guards** (pay-as-you-go has no ceiling unless you set one):
  - `AI_CALLS_PER_APPLICATION` (6) stops one person running up the bill with re-uploads.
  - `AI_MONTHLY_BUDGET_USD` ($50) pauses automatic reading for everyone once reached; people type their details instead, and nothing else stops.
  - Spend shows in the ops console.
  - Sign-in codes are limited per address and per network, in the database, so nobody can mass-mail through you.
  - `MaxConcurrency` in the template caps simultaneous instances.
- **Short retention.** Documents are deleted 30 days after a decision, and unfinished drafts after 30 days.
- **Logs** are kept for 14 days instead of forever.
- **Card fees** are where real money is. At volume, ask Stripe for custom pricing or compare UAE gateways (Network International, Checkout.com, Telr). Charging in AED avoids conversion fees.

### Model choice (your decision)

Passport reading uses Claude Opus 5.5 by default. Set `EXTRACT_FAST_MODEL=claude-haiku-5-5` to try a cheaper model first:

- Its reading is kept **only when the passport's check digits prove it right**.
- Anything else goes to Opus 5.5, so accuracy on the proven fields is unchanged.
- If the cheap model is proven right on most passports, the average drops from about $0.022 to a few tenths of a cent.

Measure it on your own sample before switching:

```bash
ANTHROPIC_API_KEY=... EXTRACT_FAST_MODEL=claude-haiku-5-5 npm run try-reading -- passport1.jpg passport2.pdf ...
```

It prints, for each file, whether the check digits passed, which models were called and what it cost.

### Why not rewrite the API in Rust?

Rust is excellent for CPU-heavy work, but this API mostly waits on the database, Stripe and Claude:

- **Cost.** Compute is about $0.0001 per application today. A Rust version would save about 8 US cents per 1,000 applications, against card fees of about AED 12,000 for the same thousand.
- **Speed.** The code already loads in about 40 ms on a cold start. The time travellers notice is the passport reading (a few seconds, the same in any language) and the payment page.
- **Security.** TypeScript is already memory-safe. Neither Stripe nor Anthropic has an official Rust SDK, so a port would hand-write the security-critical parts (webhook signatures, API clients) that the official SDKs handle today.

It becomes worth it if the API takes on heavy computation itself, such as image processing on the server, or traffic in the millions of requests a day. The API contract is small and fully tested, so a port is straightforward if that day comes.

### Could Bunny.net host everything?

Not everything:

- **Works well:**
  - **The web app.** Bunny Storage plus CDN, about $0.01 per GB, with a $1 monthly minimum.
  - **The API container.** Magic Containers bills CPU and memory by use; build it with `backend/Dockerfile`.
- **Does not fit:**
  - **The database.** Bunny Database is SQLite-compatible, while Rihla uses Postgres features, so it would mean a data-layer rewrite.
  - **Passport files.** Bunny Storage's S3 API is still in preview, has no UAE region and no lifecycle rules.
  - **Email.** Bunny does not send email.

A good split: Bunny (or Cloudflare Pages) for the web app; Lambda or Magic Containers for the API; Neon for the database; R2 or S3 for files; SES for email.

## 6. Before the first real traveller

- [ ] Run one application end to end in production with your own passport, paying a real (refundable) amount.
- [ ] Error monitoring (for example Sentry's free tier) on the API, and uptime alerts on `/v1/health`.
- [ ] Database backups switched on (Neon keeps point-in-time history).
- [ ] An AWS Budgets alert (free) and a spend limit in the Anthropic console.
- [ ] Storage bucket lifecycle rule as a safety net (delete anything older than 90 days).
- [ ] SES production access requested, with the sending domain verified (SPF, DKIM, DMARC).
- [ ] Legal pages linked from the footer.
- [ ] Arabic interface (recommended for the UAE market; not built yet).
