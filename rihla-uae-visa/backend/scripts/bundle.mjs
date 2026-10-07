import { build } from 'esbuild';
import { rmSync } from 'node:fs';

/*
  Production bundles. Everything the API needs is compiled in, so neither target ships node_modules:
  - dist/lambda  AWS Lambda (handler: index.handler). Zip this folder, or point SAM at it.
  - dist/server  Any container or VM: `node server.mjs`, plus `node migrate.mjs` for the deploy step.
  Code splitting keeps Stripe and the Claude SDK in their own chunks, loaded only when a request needs them,
  so a cold start reads a fraction of the code. PGlite (development only) is left out.
*/

rmSync('dist', { recursive: true, force: true });

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  splitting: true,
  minify: true,
  sourcemap: 'linked',
  legalComments: 'none',
  tsconfig: 'tsconfig.json',
  external: ['@electric-sql/pglite', 'pg-native'],
  outExtension: { '.js': '.mjs' },
  // Bundled CommonJS packages still call require() for Node built-ins.
  banner: { js: "import { createRequire as __rihlaRequire } from 'node:module'; const require = __rihlaRequire(import.meta.url);" },
  logLevel: 'warning',
};

for (const [outdir, entryPoints] of [
  ['dist/lambda', { index: 'src/lambda.ts' }],
  ['dist/server', { server: 'src/server.ts', migrate: 'src/migrate.ts' }],
]) {
  const r = await build({ ...common, entryPoints, outdir, metafile: true });
  const files = Object.entries(r.metafile.outputs).filter(([f]) => f.endsWith('.mjs'));
  const total = files.reduce((s, [, o]) => s + o.bytes, 0);
  const entry = files.filter(([, o]) => Object.values(entryPoints).includes(o.entryPoint)).map(([f, o]) => `${f.split('/').pop()} ${(o.bytes / 1024).toFixed(0)} KB`);
  console.log(`${outdir}: ${files.length} files, ${(total / 1024).toFixed(0)} KB in all; ${entry.join(', ')}`);
}
