/*
  Schema, in order. Never edit a migration that has shipped; add a new one.
  Personal data lives in `applications.profile` and in stored files. Both are deleted on the retention schedule.
*/
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_codes (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email ON login_codes (email, created_at DESC);

CREATE TABLE applications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL,
  answers jsonb NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_report jsonb,
  checks jsonb,
  declarations jsonb,
  signature jsonb,
  quote jsonb,
  payment jsonb,
  provider text,
  provider_ref text,
  provider_message text,
  permit jsonb,
  needs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  purged_at timestamptz
);
CREATE INDEX applications_user ON applications (user_id, created_at DESC);
CREATE INDEX applications_status ON applications (status, updated_at);

CREATE TABLE documents (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id),
  slot text NOT NULL,
  storage_key text NOT NULL,
  mime text NOT NULL,
  bytes int NOT NULL,
  sha256 text,
  status text NOT NULL DEFAULT 'pending',
  width int,
  height int,
  extracted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX documents_app ON documents (application_id, slot);

CREATE TABLE extraction_cache (
  sha256 text PRIMARY KEY,
  result jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id),
  actor text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_app ON events (application_id, id);

CREATE TABLE payment_events (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
)`,
  },
  {
    id: '002_costs',
    sql: `
CREATE TABLE ai_usage (
  id bigserial PRIMARY KEY,
  application_id uuid,
  purpose text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL,
  output_tokens int NOT NULL,
  cost_usd numeric(12, 6) NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_created ON ai_usage (created_at);
CREATE INDEX ai_usage_app ON ai_usage (application_id);

ALTER TABLE applications ADD COLUMN claimed_at timestamptz;

ALTER TABLE login_codes ADD COLUMN ip_hash text;
CREATE INDEX login_codes_ip ON login_codes (ip_hash, created_at DESC)`,
  },
  {
    id: '003_self_apply',
    sql: `
ALTER TABLE applications ADD COLUMN route text NOT NULL DEFAULT 'partner';
ALTER TABLE applications ADD COLUMN airline text;
ALTER TABLE applications ADD COLUMN self_ref text`,
  },
];
