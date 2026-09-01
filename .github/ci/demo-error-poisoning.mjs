#!/usr/bin/env node
/**
 * DEMONSTRATION — the app shell, poisoned by an HTTP error, in a real browser.
 *
 * PUP-WO-0105. `check-error-caching.mjs` keeps this property in a Node sandbox, which
 * is fast and mutation-testable but is a model of the browser rather than the browser.
 * This runs the same defect against real Chromium and a real service worker, so the
 * sandbox check is anchored to something observed rather than assumed.
 *
 * Sequence, all against the SAME worker under test:
 *   1. load the app online; confirm the worker controls the page and the shell is
 *      cached with status 200
 *   2. make the origin return 404 for the shell, and reload ONLINE
 *   3. read the worker's cache: what is stored under the shell URL now?
 *   4. take the origin genuinely away and read the shell THROUGH the worker: this is
 *      what the child's device would serve
 *
 * REAL OFFLINE MEANS CLOSING THE LISTENER. `context.setOffline(true)` does not stop a
 * service worker's fetch to a loopback server — a lesson this project already paid for
 * — so step 4 closes the server AND destroys its keep-alive sockets.
 *
 * Exit 0 if the shell survives; exit 1 with the served body if it does not.
 * Usage: node demo-error-poisoning.mjs <dir containing sw.js and index.html>
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIR = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const BASE = '/PupPad/';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.css':'text/css' };
const ERROR_BODY = '<!doctype html><title>SITE-NOT-FOUND</title><body>404 THIS IS THE ERROR PAGE';

let serveErrors = false;
const sockets = new Set();
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (!p.startsWith(BASE)) { res.writeHead(404).end('out of scope'); return; }
  let rel = p.slice(BASE.length) || 'index.html';
  if (rel.endsWith('/') || rel === '') rel += 'index.html';
  if (serveErrors && (rel === 'index.html')) {
    res.writeHead(404, { 'content-type': 'text/html' }).end(ERROR_BODY);
    return;
  }
  try {
    const buf = await readFile(join(DIR, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('not found'); }
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const ORIGIN = `http://127.0.0.1:${port}`;
const SHELL = ORIGIN + BASE + 'index.html';

const opts = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
if (process.env.PUPPAD_CHROMIUM) opts.executablePath = process.env.PUPPAD_CHROMIUM;
else opts.channel = 'chromium';
const browser = await chromium.launch(opts);
const ctx = await browser.newContext();
/* hermetic: the real CDNs are aborted, exactly as check-load does, so a slow or
 * rate-limited third party cannot turn this demonstration red. */
await ctx.route('**/*', (r) => (r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort()));
const page = await ctx.newPage();

const shellInCache = () => page.evaluate(async (url) => {
  const n = (await caches.keys()).find((k) => k.startsWith('puppad|'));
  if (!n) return { noCache: true };
  const hit = await (await caches.open(n)).match(url);
  return hit ? { status: hit.status, body: (await hit.clone().text()).slice(0, 60) } : { missing: true };
}, SHELL);

console.log(`demo-error-poisoning: ${join(DIR, 'sw.js')}\n  origin ${ORIGIN}${BASE}\n`);

/* ---- 1. healthy ---- */
await page.goto(ORIGIN + BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.evaluate(() => navigator.serviceWorker.ready);
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller)))
  { console.error('the page is not controlled by a worker — nothing below tests anything'); process.exit(2); }
await page.evaluate((u) => fetch(u, { cache: 'no-store' }), SHELL);
await page.waitForTimeout(600);
console.log('1. healthy   ', JSON.stringify(await shellInCache()));

/* ---- 2 & 3. an HTTP error, received WHILE ONLINE ---- */
serveErrors = true;
await page.evaluate((u) => fetch(u, { cache: 'no-store' }), SHELL);
await page.waitForTimeout(600);
const after = await shellInCache();
console.log('2. after one 404 while ONLINE ', JSON.stringify(after));

/* ---- 4. the origin genuinely goes away ---- */
await new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });
const served = await page.evaluate(async (u) => {
  try { const r = await fetch(u, { cache: 'no-store' });
        return { status: r.status, body: (await r.text()).slice(0, 60) }; }
  catch (e) { return { threw: String(e) }; }
}, SHELL);
console.log('3. OFFLINE, what the device serves ', JSON.stringify(served), '\n');

await browser.close();

const poisoned = (after.status && after.status !== 200) ||
                 (served.body || '').includes('THIS IS THE ERROR PAGE');
if (poisoned) {
  console.error('DEMO RED — the app shell was replaced by an HTTP error received while online.');
  console.error(`  cached after the 404: ${JSON.stringify(after)}`);
  console.error(`  served offline:       ${JSON.stringify(served)}`);
  console.error('  Buddy taps his icon and gets this. Northstar invariants 3 and 5.');
  process.exit(1);
}
console.log('DEMO GREEN — the 404 was refused; the shell survived and is what the device serves offline.');
