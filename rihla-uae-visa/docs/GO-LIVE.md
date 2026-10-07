# Taking Rihla live

This is the checklist for filing real UAE tourist visas for real travellers. The code is ready to run in production; most of what remains is business setup that only you can do.

## 1. Who files the visa (the one hard requirement)

A standard 30- or 60-day UAE tourist visa must be sponsored by a licensed tourism establishment ([GDRFA Dubai](https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8)). There is no public government API, and an individual company cannot file these without that licence. So Rihla prepares, checks and takes payment, and a licensed partner files.

The backend supports three ways to do that, set with `FILING_PROVIDER`:

| Mode | How it works | When to use it |
|---|---|---|
| `manual` | Paid applications land in the **ops console** (`#ops`). Your team copies the prepared fields (one-click copy buttons) into the partner's B2B portal, uploads the documents, then marks the case filed, asks the traveller for more, or uploads the issued visa PDF. | **Launch with this.** Works with any licensed partner from day one, no integration needed. |
| `partner_http` | The API submits to the partner's API and polls for status. Mapping lives in `backend/src/providers.ts` (`toPartner` / `fromPartner`), marked as a template. | Once a partner gives you API documentation. JETT (Musafir) announced a B2B Visa API in September 2026; ask for its docs and sandbox. |
| `sandbox` | Approves everything after a short wait with a clearly marked fake PDF. | Development and demos only. Production refuses to start with it. |

Later, if volume justifies it, you can hold your own Dubai tourism licence and immigration establishment card and file directly; the `manual` mode then becomes your own team using the official portal.

Do **not** automate the government portals with a headless browser for real filings. It breaks their terms, needs a licensed account anyway, and is the most expensive and fragile part to run.

## 2. Business checklist

- [ ] Signed agreement with a licensed UAE tourism partner, including their **rate card**. Set `GOV_FEE_TOURIST_30` and `GOV_FEE_TOURIST_60` from it.
- [ ] Your **trade licence** covers visa assistance or travel services.
- [ ] Your service fee (`SERVICE_FEE`, AED, before VAT) and a written **refund policy**. The app promises a refund if you cannot file after payment.
- [ ] **Privacy policy and terms** reviewed by UAE counsel. You process passport data under the UAE PDPL. List your processors: hosting, database, storage, email, Stripe, Anthropic (passport reading), and your partner. Get consent for any transfer outside the UAE, or host in the UAE.
- [ ] A **full nationality list** with current entry rules. The app ships with 20 nationalities (`src/domain/nationalities.ts`); real users come from everywhere.
- [ ] Someone on the **ops rota** to work the console at least twice a day.

## 3. Accounts to create

| Service | Used for | Setting |
|---|---|---|
| Postgres (Neon, Supabase, or AWS RDS in `me-central-1`) | Applications, users, audit trail | `DATABASE_URL` |
| Object storage (Cloudflare R2, or S3 in `me-central-1` for UAE residency) | Passport, photo and visa files. Turn on encryption at rest. | `STORAGE_DRIVER=s3`, `S3_*` |
| Resend (verify your sending domain) | Sign-in codes and status emails | `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM` |
| Stripe (UAE entity) | Hosted checkout in AED, refunds | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, webhook `POST {API_URL}/v1/webhooks/stripe` for `checkout.session.completed` |
| Anthropic API | Reading the passport page | `ANTHROPIC_API_KEY`. Check the data-retention terms that fit passport data. |
| Hosting for the API (any Node 20+ host: Fly.io, Railway, Render, AWS) | `backend/` | All of `backend/.env.example` |
| Static hosting for the web app (Cloudflare Pages or Vercel) | `rihla-uae-visa/` built with `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_API_URL=https://api.your-domain` |

## 4. Deploy

```bash
# API
cd rihla-uae-visa/backend
npm ci && npm test && npm run build
node dist/server.js           # with the production environment set

# Web app (static files, any CDN)
cd rihla-uae-visa
NEXT_PUBLIC_API_URL=https://api.your-domain npm run build   # output in out/
```

The API refuses to start in production with development drivers, a weak secret or missing keys, so a misconfigured deploy fails loudly instead of quietly using fake payments.

Background work (filing paid applications, polling the partner, deleting old documents) runs inside the API every `TICK_SECONDS`. On a serverless host, set `TICK_SECONDS=0` and call `POST /internal/tick` with header `x-cron-secret: $CRON_SECRET` every minute instead.

## 5. What it costs to run

Estimates for **1,000 applications a month**, before the partner's fee. Prices change; check each provider.

| Item | Cost | Notes |
|---|---|---|
| API hosting | about $5–25 / month | One small instance handles this volume easily. |
| Postgres | $0–25 / month | Free tiers cover early volume. |
| File storage | under $1 / month | About 3 MB per application, deleted 30 days after a decision. R2 has no download fees. |
| Email | $0–20 / month | About 6 emails per application. |
| Passport reading | about $20 / month | Roughly $0.02 per passport on Claude Opus 5.5 at low effort (about 2,500 input and 600 output tokens). Each file is read once; re-uploads of the same file are free. |
| Card payments | about AED 11.70–15.40 **per application** | Stripe UAE: 2.9% + AED 1 domestic, plus 1% for international cards, on AED 368.55. This is your largest cost after the partner fee. |

So fixed costs are roughly **$30–90 a month**, and the variable cost is mostly card fees.

### Where the savings come from

- **No browser fleet.** Filing goes through a partner (API or ops), not by driving government websites with headless browsers.
- **Static web app** on a CDN: no server cost for pages.
- **Uploads go straight to storage** with signed URLs, so files never pass through (or bill) the API server.
- **Free checks first.** Dates, validity, photo shape and background run as plain code; the photo is measured in the traveller's own browser. The model is called once, only for the passport.
- **Proof without a second model call.** The passport's own check digits confirm the reading, so you do not pay to double-check it.
- **Caching by file hash.** The same passport file is never read twice.
- **Short retention.** Documents are deleted 30 days after a decision, and unfinished drafts after 30 days, so storage stays near zero.
- **Payment fees.** At volume, ask Stripe for custom pricing or compare UAE gateways (Network International, Checkout.com, Telr). Charging in AED avoids conversion fees.
- **Model choice.** `EXTRACT_MODEL` can be changed to a cheaper model such as `claude-haiku-5-5` (about $0.001 per passport). Test it on a sample of real passports first; the check-digit verification will tell you how often it misreads.

## 6. Before the first real traveller

- [ ] Run one application end to end in production with your own passport, paying a real (refundable) amount.
- [ ] Error monitoring (for example Sentry) on the API, and uptime alerts on `/v1/health`.
- [ ] Database backups switched on.
- [ ] Storage bucket lifecycle rule as a safety net (delete anything older than 90 days).
- [ ] Legal pages linked from the footer.
- [ ] Arabic interface (recommended for the UAE market; not built yet).
