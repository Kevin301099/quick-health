import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/*
  Builds the extension into dist/, ready for chrome://extensions → Load unpacked, or to zip for the Chrome Web Store.

  RIHLA_APP_ORIGINS  the Rihla web app's address(es), comma separated. Only these pages can hand details to the
                     extension. Default: http://localhost:3000 (local development).
*/

const origins = (process.env.RIHLA_APP_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
for (const o of origins) if (!/^https?:\/\/[^/]+$/.test(o)) throw new Error(`Not an origin: ${o}`);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

// OUT_DIR and TEST_HOSTS are for the automated tests only: a separate build that may fill test pages without a click.
const out = process.env.OUT_DIR ?? 'dist';
const testHosts = (process.env.TEST_HOSTS ?? '').split(',').filter(Boolean);
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/icons`, { recursive: true });

const define = { __APP_ORIGINS__: JSON.stringify(origins), __APP_URL__: JSON.stringify(origins[0]) };
const common = { bundle: true, target: 'chrome116', minify: true, legalComments: 'none', define, logLevel: 'warning' };
await build({ ...common, entryPoints: ['src/background.ts'], outfile: `${out}/background.js`, format: 'esm' });
for (const name of ['popup', 'bridge', 'fill']) await build({ ...common, entryPoints: [`src/${name}.ts`], outfile: `${out}/${name}.js`, format: 'iife' });
cpSync('static', out, { recursive: true });

/* Icons: the Rihla mark (a white arc on the brand green), drawn here so the repo holds no binaries. */
function png(size) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  // The arc: a cubic curve in a 24-unit box, from (5,19) to (19,5).
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const u = 1 - t;
    pts.push([u ** 3 * 5 + 3 * u * u * t * 7 + 3 * u * t * t * 12 + t ** 3 * 19, u ** 3 * 19 + 3 * u * u * t * 11 + 3 * u * t * t * 6 + t ** 3 * 5]);
  }
  const segDist = (x, y) => {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  };
  const stroke = size <= 16 ? 3.4 : size <= 32 ? 3 : 2.6;
  const radius = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let inside = 0;
      let white = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const ux = ((x + (sx + 0.5) / S) / size) * 24;
          const uy = ((y + (sy + 0.5) / S) / size) * 24;
          const qx = Math.max(Math.abs(ux - 12) - (12 - radius), 0);
          const qy = Math.max(Math.abs(uy - 12) - (12 - radius), 0);
          if (Math.hypot(qx, qy) <= radius) {
            inside++;
            if (segDist(ux, uy) <= stroke / 2) white++;
          }
        }
      const a = inside / (S * S);
      const w = inside ? white / inside : 0;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(11 + (255 - 11) * w);
      raw[o + 1] = Math.round(122 + (255 - 122) * w);
      raw[o + 2] = Math.round(99 + (255 - 99) * w);
      raw[o + 3] = Math.round(255 * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const icons = {};
for (const s of [16, 32, 48, 128]) {
  writeFileSync(`${out}/icons/icon-${s}.png`, png(s));
  icons[s] = `icons/icon-${s}.png`;
}

/* Match patterns cannot hold a port, so the bridge also checks the exact origin itself. */
const matches = [...new Set(origins.map((o) => `${new URL(o).protocol}//${new URL(o).hostname}/*`))];

const manifest = {
  manifest_version: 3,
  name: 'Rihla Filler',
  version,
  description: 'Fills official UAE visa forms with the details you prepared in Rihla. You sign in, pay and submit yourself.',
  minimum_chrome_version: '116',
  permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage', 'alarms'],
  background: { service_worker: 'background.js', type: 'module' },
  action: { default_popup: 'popup.html', default_title: 'Rihla Filler', default_icon: icons },
  icons,
  commands: { 'fill-page': { suggested_key: { default: 'Alt+Shift+F' }, description: 'Fill this page with your Rihla details' } },
  content_scripts: [{ matches, js: ['bridge.js'], run_at: 'document_start' }],
  ...(testHosts.length ? { host_permissions: testHosts } : {}),
};
writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${out}/ for ${origins.join(', ')}`);
