// Packs the static export into one self-contained HTML fragment for publishing as a single-file artifact.
// The host supplies <!doctype>, <html>, <head> and <body>, so this writes only the page content:
// title, font links, one <style>, the app markup, then every script inlined in its original order.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
function pack(page) {
const html = readFileSync(join(OUT, page), 'utf8');

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
const bodyInner = body.slice(body.indexOf('>') + 1);

const title = (head.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || 'Rihla Visa Desk';

const links = [...head.matchAll(/<link [^>]*>/g)]
  .map((m) => m[0])
  .filter((l) => /fonts\.(googleapis|gstatic)\.com/.test(l))
  .map((l) => l.replace(/ data-[a-z-]+=""/g, ''));

const css = [...head.matchAll(/<link rel="stylesheet" href="(\/_next\/[^"]+\.css)"/g)]
  .map((m) => readFileSync(join(OUT, m[1]), 'utf8'))
  .join('\n');

const safeJs = (src) => src.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const scripts = [...head.matchAll(/<script\b[^>]*\bsrc="(\/_next\/[^"]+\.js)"[^>]*><\/script>/g)]
  .filter((m) => !/noModule/i.test(m[0]))
  .map((m) => `<script>${safeJs(readFileSync(join(OUT, m[1]), 'utf8'))}</script>`);

const fragment = [
  `<title>${title}</title>`,
  ...links,
  `<style>${css}</style>`,
  bodyInner,
  ...scripts,
].join('\n');

return { fragment, css, scripts };
}

mkdirSync('artifact', { recursive: true });
const { fragment, css, scripts } = pack('index.html');
writeFileSync('artifact/index.html', fragment);

// A copy wrapped the way the host wraps it, for local testing only.
const reset = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}';
writeFileSync(
  'artifact/wrapped.html',
  `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${reset}</style></head><body>${fragment}</body></html>`,
);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`artifact/index.html ${kb(fragment)} · css ${kb(css)} · ${scripts.length} scripts`);
