#!/usr/bin/env node
/*
  Try Rihla on your own computer with one command, from the rihla-uae-visa folder:

    npm run try

  It installs what is missing (first run only), builds the Rihla Filler extension, and starts:
    - the API on http://localhost:8787 (embedded database, files on disk, emails printed in this window)
    - the web app on http://localhost:3000
    - test forms on http://localhost:4000, copies of the kinds of forms the filler meets on official sites
  Ctrl+C stops everything. Nothing is sent anywhere: payments are a test page, filing is a sandbox.

  Optional: set ANTHROPIC_API_KEY first to have passports read automatically (about $0.02 each).
*/

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';
const PORTS = { api: 8787, web: 3000, forms: 4000 };
const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const green = (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);
const yellow = (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s);

if (Number(process.versions.node.split('.')[0]) < 20) {
  console.error(`Rihla needs Node.js 20 or newer, and this is ${process.version}. Install the LTS version from https://nodejs.org and try again.`);
  process.exit(1);
}

function npmSync(cwd, args, what) {
  const r = spawnSync(npm, args, { cwd, stdio: 'inherit', shell: win });
  if (r.status !== 0) {
    console.error(`\n${what} failed. The error is above.`);
    process.exit(1);
  }
}

const portBusy = (port) =>
  new Promise((resolve) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });

for (const [name, port] of Object.entries(PORTS)) {
  if (await portBusy(port)) {
    console.error(`Port ${port} (for the ${name}) is already in use. Close the program using it, or stop an earlier "npm run try", then try again.`);
    process.exit(1);
  }
}

// 1. Packages (first run only)
for (const [dir, what] of [
  [root, 'the web app'],
  [join(root, 'backend'), 'the API'],
  [join(root, 'extension'), 'the extension'],
]) {
  if (existsSync(join(dir, 'node_modules'))) continue;
  console.log(bold(`\nInstalling ${what} (first run only, takes a minute or two)...`));
  npmSync(dir, [existsSync(join(dir, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], `Installing ${what}`);
}

// 2. The extension, built for this computer's web app
console.log(bold('\nBuilding Rihla Filler...'));
npmSync(join(root, 'extension'), ['run', 'build'], 'Building the extension');

// 3. Test forms that look like official sites
const formsDir = join(root, 'extension', 'test', 'fixtures');
const formNames = { 'gov.html': 'Government e-service (English and Arabic, table layout, login and captcha boxes)', 'airline.html': 'Airline visa form (two steps, split date of birth, card section)', 'arabic.html': 'Arabic-only form', 'angular.html': 'Form with pick-from-list and calendar-only fields' };
const forms = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path === '/') {
    const links = Object.keys(formNames)
      .filter((f) => existsSync(join(formsDir, f)))
      .map((f) => `<li><a href="/${f}">${formNames[f]}</a></li>`)
      .join('');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>Rihla test forms</title><body style="font:16px system-ui;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.5"><h1>Test forms</h1><p>Copies of the kinds of forms Rihla Filler meets on official sites. Open one, then click the Rihla icon in the toolbar and choose <b>Fill this page</b> (or press Alt+Shift+F).</p><ul>${links}</ul></body>`);
    return;
  }
  const file = join(formsDir, path.replace(/^\/+/, ''));
  if (!file.startsWith(formsDir) || !formNames[path.slice(1)]) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': extname(file) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORTS.forms, '127.0.0.1');

// 4. The API and the web app
const children = [];
let stopping = false;
let apiUp = false;
let webUp = false;
let shown = false;

function start(name, cwd, args, env, onLine) {
  const child = spawn(npm, args, { cwd, env: { ...process.env, ...env }, shell: win, detached: !win, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let buf = '';
  const feed = (d) => {
    buf += d;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    for (const line of lines) onLine(line);
  };
  child.stdout.on('data', feed);
  child.stderr.on('data', feed);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(yellow(`\nThe ${name} stopped (exit code ${code}). The error is above. Stopping everything.`));
      stop(1);
    }
  });
  return child;
}

function showReady() {
  if (shown || !apiUp || !webUp) return;
  shown = true;
  const ext = join(root, 'extension', 'dist');
  console.log(`
${green(bold('Rihla is running.'))}

  ${bold('1. Add Rihla Filler to Chrome (once):')}
     Open ${bold('chrome://extensions')}, switch on ${bold('Developer mode')} (top right),
     click ${bold('Load unpacked')} and choose this folder:
     ${ext}
     (Edge: edge://extensions. Brave: brave://extensions. Same steps.)

  ${bold('2. Open the app:')} ${bold(`http://localhost:${PORTS.web}`)}
     Press "Start your application". Use any email address:
     the six-digit sign-in code is printed in this window.

  ${bold('3. Try the filler on test forms:')} ${bold(`http://localhost:${PORTS.forms}`)}

  The full checklist is in docs/TESTING.md. Stop everything with Ctrl+C.
`);
}

start('API', join(root, 'backend'), ['run', 'dev'], { PORT: String(PORTS.api), APP_URL: `http://localhost:${PORTS.web}`, API_URL: `http://localhost:${PORTS.api}`, CORS_ORIGINS: `http://localhost:${PORTS.web}`, OPS_EMAILS: process.env.OPS_EMAILS ?? 'ops@rihla.test' }, (line) => {
  const code = line.match(/\[mail\] to (\S+): (\d{6}) is your Rihla sign-in code/);
  if (code) console.log(green(bold(`\n  >>> Sign-in code for ${code[1]}: ${code[2]}\n`)));
  else if (/^\[mail\]|^Your sign-in code|^If you did not ask/.test(line) || !line.trim()) return;
  else console.log(`[api] ${line}`);
  if (/Rihla API on :/.test(line)) {
    apiUp = true;
    showReady();
  }
});

start('web app', root, ['run', 'dev', '--', '-p', String(PORTS.web)], { NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.api}` }, (line) => {
  if (!line.trim()) return;
  console.log(`[web] ${line}`);
  if (/Ready in|ready started|Local:/.test(line)) {
    webUp = true;
    showReady();
  }
});

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  forms.close();
  for (const c of children) {
    try {
      if (win) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-c.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
