import { z } from 'zod';

/*
  Every setting comes from the environment. Defaults are safe for local development:
  an embedded database, files on disk, emails printed to the console, fake payments and the sandbox filer.
  Production sets real drivers; `assertProductionReady` refuses to boot with development drivers.
*/

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8787),
  /** Public URL of the web app. Payment and email links point here. */
  APP_URL: z.string().url().default('http://localhost:3000'),
  /** Public URL of this API. Local uploads are addressed through it. */
  API_URL: z.string().url().default('http://localhost:8787'),
  /** Origins allowed to call the API from a browser (comma separated). */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  /** Signs session tokens and hashes one-time codes. Long and random in production. */
  AUTH_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  /** Emails allowed into the ops console (comma separated). */
  OPS_EMAILS: z.string().default(''),

  /** postgres://... in production. Empty means an embedded PGlite database on disk (or in memory for tests). */
  DATABASE_URL: z.string().default(''),
  PGLITE_DIR: z.string().default('./data/db'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./data/files'),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),

  MAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('Rihla <visas@example.com>'),

  PAYMENTS_DRIVER: z.enum(['fake', 'stripe']).default('fake'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),

  /** Who files the visa: the sandbox, your own ops team on a partner portal, or a partner's API. */
  FILING_PROVIDER: z.enum(['sandbox', 'manual', 'partner_http']).default('sandbox'),
  PARTNER_API_URL: z.string().default(''),
  PARTNER_API_KEY: z.string().default(''),
  SANDBOX_APPROVE_AFTER_SECONDS: z.coerce.number().default(20),

  /** Passport reading. Without a key the app asks people to type their details instead. */
  ANTHROPIC_API_KEY: z.string().default(''),
  EXTRACT_MODEL: z.string().default('claude-opus-5-5'),
  EXTRACT_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),

  /** Prices in AED, before VAT. Set these from your partner's rate card. */
  GOV_FEE_TOURIST_30: z.coerce.number().default(252),
  GOV_FEE_TOURIST_60: z.coerce.number().default(352),
  SERVICE_FEE: z.coerce.number().default(99),
  VAT_RATE: z.coerce.number().default(0.05),

  /** Documents are deleted this many days after a decision. */
  RETENTION_DAYS: z.coerce.number().default(30),
  /** Shared secret for POST /internal/tick when an external scheduler drives background work. */
  CRON_SECRET: z.string().default(''),
  /** Run background work inside this process every N seconds (0 = off, use the cron endpoint). */
  TICK_SECONDS: z.coerce.number().default(15),
  LOG_REQUESTS: bool,
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  return parsed.data;
}

/** Production must not run on development drivers or secrets. */
export function assertProductionReady(c: Config) {
  if (c.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  if (c.AUTH_SECRET.startsWith('dev-only') || c.AUTH_SECRET.length < 32) problems.push('AUTH_SECRET must be a random string of 32+ characters');
  if (!c.DATABASE_URL) problems.push('DATABASE_URL must point at Postgres');
  if (c.STORAGE_DRIVER !== 's3') problems.push('STORAGE_DRIVER must be s3');
  if (c.MAIL_DRIVER !== 'resend') problems.push('MAIL_DRIVER must be resend');
  if (c.PAYMENTS_DRIVER !== 'stripe') problems.push('PAYMENTS_DRIVER must be stripe');
  if (c.FILING_PROVIDER === 'sandbox') problems.push('FILING_PROVIDER cannot be sandbox');
  if (c.PAYMENTS_DRIVER === 'stripe' && (!c.STRIPE_SECRET_KEY || !c.STRIPE_WEBHOOK_SECRET)) problems.push('Stripe keys are missing');
  if (c.FILING_PROVIDER === 'partner_http' && (!c.PARTNER_API_URL || !c.PARTNER_API_KEY)) problems.push('Partner API URL and key are missing');
  if (problems.length) throw new Error(`Not ready for production:\n  ${problems.join('\n  ')}`);
}

export const opsEmails = (c: Config) =>
  c.OPS_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
