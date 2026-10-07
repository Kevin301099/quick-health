import { serve } from '@hono/node-server';
import { boot } from './boot';
import { tick } from './jobs';

/*
  The API as a long-running Node server (local development, or any always-on host).
  For pay-per-request hosting use `src/lambda.ts` instead; the app is the same.
*/

const { deps, app } = await boot();
const { config } = deps;

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
