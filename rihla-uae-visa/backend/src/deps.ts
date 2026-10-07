import type { Config } from './config';
import type { Db } from './db';
import type { Storage } from './storage';
import type { Mailer } from './mail';
import type { Payments } from './payments';
import type { FilingProvider } from './providers';
import type { Extractor } from './extract';

/** Everything the API needs, built once at start-up and swapped out in tests. */
export interface Deps {
  config: Config;
  db: Db;
  storage: Storage;
  mailer: Mailer;
  payments: Payments;
  provider: FilingProvider;
  extractor: Extractor;
  now: () => Date;
}
