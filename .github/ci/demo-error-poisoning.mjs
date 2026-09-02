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
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { requireBlob } from './lib/subject.mjs';

/* Architecture §5: a demonstration asserts the COMMIT that ran, never the conclusion
 * alone. PUP-WO-0105's first version printed only a path and its feedback file then
 * claimed the blob was "recorded in each run" — it was computed by hand at a shell.
 * Claiming a mechanism that does not exist is the defect this file is about.
 *
 * AND IT FELL OPEN UNTIL PUP-WO-0301 §2.4: no git meant the string '(git unavailable)'
 * printed under the word SUBJECT and a green underneath it. requireBlob refuses. */

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
/* Aborts the PAGE's third-party requests. NOT hermetic, and the first version of
 * this file claimed it was: ctx.route() does not intercept a service worker's own
 * fetch(), so once the worker controls the page it reaches the public internet.
 * Measured — with this route in place the worker still cached three real CDN
 * responses. Blocking at the resolver is what actually isolates it. Harmless here
 * because nothing below depends on the third parties, but the claim was false. */
await ctx.route('**/*', (r) => (r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort()));
const page = await ctx.newPage();

const shellInCache = () => page.evaluate(async (url) => {
  const n = (await caches.keys()).find((k) => k.startsWith('puppad|'));
  if (!n) return { noCache: true };
  const hit = await (await caches.open(n)).match(url);
  const text = hit ? await hit.clone().text() : null;
  return hit ? { status: hit.status, len: text.length, isApp: text.includes('<title>Pup Pad</title>'),
                 body: text.slice(0, 60) } : { missing: true };
}, SHELL);

const SW_PATH = join(DIR, 'sw.js');
const SUBJECT = requireBlob(resolve(join(import.meta.dirname, '..', '..')), 'demo-error-poisoning', SW_PATH);
console.log(`demo-error-poisoning: ${SW_PATH}`);
console.log(`  subject commit     : ${SUBJECT.commit.slice(0, 12)}`);
console.log(`  SUBJECT sw.js blob : ${SUBJECT.blob}`);
console.log(`  origin             : ${ORIGIN}${BASE}\n`);

/* ---- 1. healthy ---- */
await page.goto(ORIGIN + BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.evaluate(() => navigator.serviceWorker.ready);
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller)))
  { console.error('the page is not controlled by a worker — nothing below tests anything'); process.exit(2); }
await page.evaluate((u) => fetch(u, { cache: 'no-store' }), SHELL);
await page.waitForTimeout(600);
const healthy = await shellInCache();
console.log('1. healthy   ', JSON.stringify(healthy));

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
        const t = await r.text();
        return { status: r.status, len: t.length, isApp: t.includes('<title>Pup Pad</title>'),
                 body: t.slice(0, 60) }; }
  catch (e) { return { threw: String(e) }; }
}, SHELL);
console.log('3. OFFLINE, what the device serves ', JSON.stringify(served), '\n');

await browser.close();

/* THE VERDICT NEEDS POSITIVE CONTROLS, AND THE FIRST VERSION OF THIS FILE HAD NONE.
 *
 * It concluded "not poisoned" from `after.status !== 200` plus the absence of an error
 * string. A cache MISS has no `.status`, and a 504 has an empty body — so a worker that
 * precached nothing and cached nothing printed DEMO GREEN with `{"missing":true}` and
 * `{"status":504}` on the two lines directly above the verdict. Reproduced: the
 * evidence of total failure sat two lines above a verdict contradicting it, which is
 * architecture §6.1's family exactly, in the file that exists to demonstrate it.
 *
 * So each step must now prove it did its job before the verdict is allowed to mean
 * anything: the shell must have been cached healthy FIRST, and what the device serves
 * offline must be the real app, not merely not-an-error. */
/* IDENTITY, NOT SHAPE. The first version of this verdict asserted the body contained
 * `<!DOCTYPE html>` — which EVERY HTML DOCUMENT SATISFIES, INCLUDING AN ERROR PAGE.
 * A soft 404 (status 200 with an error body, which is how most real error pages
 * arrive) therefore printed DEMO GREEN with SITE-NOT-FOUND on the two lines above
 * the verdict. Reproduced against the correct worker, changing only the origin.
 *
 * The property needed is "this is PupPad", not "this is HTML". `<title>Pup Pad</title>`
 * is in the served shell and cannot be in an error page the origin substitutes for it.
 * Asserting the ABSENCE OF A SYMPTOM rather than the PRESENCE OF THE PROPERTY is the
 * one shape behind every false green this work order produced. */
const isTheApp = (x) => !!x && x.status === 200 && x.isApp === true;
const problems = [];
if (!isTheApp(healthy))
  problems.push(`step 1 never cached a healthy shell, so nothing below tested anything: ${JSON.stringify(healthy)}`);
if (after.status && after.status !== 200)
  problems.push(`the cached shell was REPLACED by an HTTP error while online: ${JSON.stringify(after)}`);
if (!after.status)
  problems.push(`the cached shell VANISHED rather than surviving: ${JSON.stringify(after)}`);
if (!isTheApp(served))
  problems.push(`OFFLINE the device did not serve the real app: ${JSON.stringify(served)}`);

if (problems.length) {
  console.error(`DEMO RED — subject ${SUBJECT.commit.slice(0, 12)} / sw.js ${SUBJECT.blob}`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('  Buddy taps his icon and gets this. Northstar invariants 3 and 5.');
  process.exit(1);
}
console.log(`DEMO GREEN — subject ${SUBJECT.commit.slice(0, 12)} / sw.js ${SUBJECT.blob}`);
console.log('  the shell was cached healthy, survived a 404 received while online,');
console.log('  and is what the device serves with the origin gone.');
