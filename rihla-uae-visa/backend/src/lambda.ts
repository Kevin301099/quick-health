import { handle } from 'hono/aws-lambda';
import { boot } from './boot';
import { tick } from './jobs';

/*
  The API on AWS Lambda, billed per request with nothing running (or billed) between visitors.

  - HTTP arrives through a Lambda Function URL (no API Gateway fee) and goes to the same Hono app as the server.
  - The scheduler invokes the function directly with {"rihla":"tick"}. That event can only come from something
    allowed to invoke the function (EventBridge Scheduler), never from the public URL, so it needs no secret.
  - Start-up work (config, database pool, SDK clients) happens once per warm instance and is reused.
*/

type Booted = Awaited<ReturnType<typeof boot>>;
let booting: Promise<Booted> | null = null;
let http: ReturnType<typeof handle> | null = null;

function ready() {
  booting ??= boot().catch((e) => {
    booting = null; // let the next request try again instead of failing forever
    throw e;
  });
  return booting;
}

export const handler = async (event: unknown, context: unknown) => {
  const { deps, app } = await ready();
  if (event && typeof event === 'object' && (event as { rihla?: string }).rihla === 'tick') {
    const out = await tick(deps);
    if (out.submitted || out.polled || out.purged || out.errors) console.log('[tick]', JSON.stringify(out));
    return out;
  }
  http ??= handle(app);
  return http(event as Parameters<typeof http>[0], context as Parameters<typeof http>[1]);
};
