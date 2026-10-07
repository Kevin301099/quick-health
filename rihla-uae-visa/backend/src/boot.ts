import { assertProductionReady, loadConfig, type Config } from './config';
import { openDb } from './db';
import { createStorage } from './storage';
import { createMailer } from './mail';
import { createPayments } from './payments';
import { createProvider } from './providers';
import { createExtractor } from './extract';
import { buildApp } from './app';
import type { Deps } from './deps';

/** Builds everything the API needs. Shared by the Node server and the Lambda handler. */
export async function boot(config: Config = loadConfig()) {
  assertProductionReady(config);
  const deps: Deps = {
    config,
    db: await openDb(config),
    storage: createStorage(config),
    mailer: createMailer(config),
    payments: createPayments(config),
    provider: createProvider(config),
    extractor: createExtractor(config),
    now: () => new Date(),
  };
  return { deps, app: buildApp(deps) };
}
