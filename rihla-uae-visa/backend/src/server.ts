import { serve } from '@hono/node-server';
import { assertProductionReady, loadConfig } from './config';
import { openDb } from './db';
import { createStorage } from './storage';
import { createMailer } from './mail';
import { createPayments } from './payments';
import { createProvider } from './providers';
import { createExtractor } from './extract';
import { buildApp } from './app';
import { tick } from './jobs';
import type { Deps } from './deps';

const config = loadConfig();
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

const app = buildApp(deps);
serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`Rihla API on :${info.port} · provider ${deps.provider.name} · payments ${deps.payments.driver} · passport reading ${config.ANTHROPIC_API_KEY ? 'on' : 'off'}`);
});

if (config.TICK_SECONDS > 0) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick(deps);
    } catch (e) {
      console.error('[tick]', e);
    } finally {
      running = false;
    }
  }, config.TICK_SECONDS * 1000);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await deps.db.close();
    process.exit(0);
  });
}
