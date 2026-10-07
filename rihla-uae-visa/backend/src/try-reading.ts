import { readFileSync } from 'node:fs';
import { loadConfig } from './config';
import { createExtractor } from './extract';
import { sniffMime } from './images';

/*
  Try the passport reader on your own files before choosing a model:

    ANTHROPIC_API_KEY=... npm run try-reading -- passport1.jpg passport2.pdf
    ANTHROPIC_API_KEY=... EXTRACT_FAST_MODEL=claude-haiku-5-5 npm run try-reading -- passport1.jpg

  For each file it prints whether the check digits proved the reading, which model(s) were called and the cost.
*/

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Usage: npm run try-reading -- <passport image or PDF> [more files]');
  process.exit(1);
}
const config = loadConfig();
if (!config.ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY first.');
const extractor = createExtractor(config);
let total = 0;
let proven = 0;
for (const f of files) {
  const bytes = new Uint8Array(readFileSync(f));
  const mime = sniffMime(bytes);
  if (!mime) {
    console.log(`${f}: not a JPEG, PNG or PDF`);
    continue;
  }
  const t = Date.now();
  const { extraction, calls } = await extractor.passport(bytes, mime);
  const cost = calls.reduce((s, c) => s + c.costUsd, 0);
  total += cost;
  if (extraction.verified) proven++;
  const path = calls.map((c) => `${c.model} (${c.inputTokens} in / ${c.outputTokens} out, ${c.outcome})`).join(' → ') || 'no billed call';
  console.log(`${f}: ${extraction.status}${extraction.verified ? ', check digits pass' : ''} · $${cost.toFixed(4)} · ${((Date.now() - t) / 1000).toFixed(1)}s · ${path}`);
  if (extraction.attention.length) console.log(`  check: ${extraction.attention.join(', ')}`);
}
console.log(`\n${proven} of ${files.length} proven by check digits · $${total.toFixed(4)} in all · $${(total / files.length).toFixed(4)} per passport`);
