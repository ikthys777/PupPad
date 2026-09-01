#!/usr/bin/env node
/**
 * EVIDENCE, not a check. Not wired into the workflow.
 *
 * Demonstrates PUP-WO-0101 acceptance items 5, 6 and 7 in a real browser against
 * two real deploy paths, because the sandbox check (check 5) proves the logic and
 * this proves the browser agrees.
 *
 *   5  prefix-bounded reaping: populate both caches, force-activate the ROOT
 *      worker, show the /stable/ cache still present afterwards.
 *   6  the legacy cache pup-pad-v16 is removed once, by exact literal, from a
 *      device state that starts with it present.
 *   7  with the root worker controlling, a request under /stable/ is neither
 *      served nor cached by it.
 *
 * Roadmap P1 gate item 4 is written as "after force-activating the root worker,
 * the /stable/ cache still exists" precisely because the naive form —
 * "caches.keys() shows disjoint names" — passes at the instant of measurement
 * exactly when one has just been deleted.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { FakeCacheStorage, loadWorker } from './lib/sw-harness.mjs';

const REPO = resolve(process.argv[2] || process.cwd());
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

/* Serve the SAME tree at / and at /stable/ — which is exactly the shape the two
 * deploy paths have, and the shape that makes the two workers collide. */
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    /* A bare same-origin page with NO service-worker registration, so caches can be
     * seeded BEFORE any worker exists. index.html registers a worker on load
     * (index.html:1935), so seeding from it means the root worker has already
     * activated and reaped before the seed lands — which would test nothing. */
    if (p === '/__seed.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>seed</title>');
      return;
    }
    const underStable = p.startsWith('/stable/');
    if (underStable) p = p.slice('/stable'.length);
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(REPO, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream',
                         'Service-Worker-Allowed': '/' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* Cache names are DERIVED from the worker under test, never hardcoded. An earlier
 * version pinned 'v17', so the moment CACHE_VERSION was bumped — which check 3
 * MANDATES whenever a cached asset changes — this check went red and the two
 * checks contradicted each other on every app change. A check that cannot survive
 * the change another check requires is a check that will be deleted. */
const probeStore = new FakeCacheStorage();
const ROOT_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}/`, probeStore).get('CACHE_NAME');
const STABLE_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}/stable/`, probeStore).get('CACHE_NAME');
console.log(`  cache names derived from sw.js: root=${ROOT_CACHE} stable=${STABLE_CACHE}`);

const opts = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
if (process.env.PUPPAD_CHROMIUM) opts.executablePath = process.env.PUPPAD_CHROMIUM;
else opts.channel = 'chromium';
const browser = await chromium.launch(opts);
const context = await browser.newContext();
await context.route('**', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort());

const fails = [];
const ok  = (m) => console.log(`  ok    ${m}`);
const bad = (m) => { fails.push(m); console.log(`  FAIL  ${m}`); };
const keys = (pg) => pg.evaluate(() => caches.keys());

/* ---- seed a device that already holds the legacy cache (item 6) ---- */
const root = await context.newPage();
await root.goto(`${ORIGIN}/__seed.html`, { waitUntil: 'load' });
const SEED_STALE = ROOT_CACHE.replace(/[^|]*$/, 'seed-stale');
await root.evaluate(async ({ stale }) => {
  await caches.open('pup-pad-v16');      // the real legacy name
  await caches.open(stale);              // a stale cache of root's OWN prefix
  await caches.open('some-other-app');   // an unrelated cache on this origin
}, { stale: SEED_STALE });
console.log('  seeded (no worker has run yet):', (await keys(root)).join(', '));

/* ---- bring up BOTH workers ---- */
await root.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
await root.evaluate(async () => {
  const r = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  await navigator.serviceWorker.ready; return r.scope;
});
const stable = await context.newPage();
await stable.goto(`${ORIGIN}/stable/index.html`, { waitUntil: 'load' });
await stable.evaluate(async () => {
  const r = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  await navigator.serviceWorker.ready; return r.scope;
});
await stable.reload({ waitUntil: 'load' });
await stable.waitForTimeout(1200);

const afterBoth = await keys(root);
console.log('  after both workers installed:', afterBoth.join(', '));
const rootCache   = afterBoth.find(n => n === ROOT_CACHE);
const stableCache = afterBoth.find(n => n === STABLE_CACHE);
if (rootCache)   ok('root worker created its own prefixed cache'); else bad('root worker cache missing');
if (stableCache) ok('stable worker created its own prefixed cache'); else bad('stable worker cache missing');

/* ---- item 6: legacy gone, by literal; unrelated cache untouched ---- */
if (!afterBoth.includes('pup-pad-v16')) ok('legacy pup-pad-v16 removed (item 6)');
else bad('legacy pup-pad-v16 still present');
if (!afterBoth.includes(SEED_STALE)) ok("root's own stale cache reaped");
else bad("root's own stale cache survived");
if (afterBoth.includes('some-other-app')) ok('an unrelated cache on the same origin was NOT touched');
else bad('an unrelated cache on the same origin was DELETED — the reap is origin-wide');

/* ---- item 5: force-activate root, stable must survive ---- */
await root.bringToFront();
await root.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  await r.update();
  if (r.installing || r.waiting) await new Promise(res => setTimeout(res, 800));
  // Re-dispatch activate by claiming again; skipWaiting() in sw.js makes this take.
});
await root.reload({ waitUntil: 'load' });
await root.waitForTimeout(1500);
const afterReactivate = await keys(root);
console.log('  after force-activating the ROOT worker:', afterReactivate.join(', '));
if (afterReactivate.includes(STABLE_CACHE))
  ok('THE /stable/ CACHE SURVIVED the root worker activating (item 5 — roadmap P1 gate 4)');
else
  bad('the /stable/ cache was DELETED by the root worker activating — invariant 7 fails');

/* ---- item 7: root worker must not serve or cache /stable/ ---- */
const controlled = await root.evaluate(() => !!navigator.serviceWorker.controller);
if (controlled) ok('root page is controlled by the root worker'); else bad('root page is not controlled');
const before = await keys(root);
const probe = await root.evaluate(async ({ origin, cacheName }) => {
  await fetch(origin + '/stable/manifest.json', { cache: 'no-store' });
  const names = await caches.keys();
  // Do NOT caches.open() here: open CREATES the cache, which both hides a moved
  // name and manufactures the very cache the next assertion counts.
  if (!names.includes(cacheName)) return { missing: true };
  const c = await caches.open(cacheName);
  return { missing: false, hit: !!(await c.match(origin + '/stable/manifest.json')) };
}, { origin: ORIGIN, cacheName: ROOT_CACHE });
if (probe.missing) bad(`the root cache ${ROOT_CACHE} does not exist — this assertion tested nothing`);
else if (!probe.hit) ok('root worker did NOT cache a /stable/ asset under its own prefix (item 7)');
else bad('root worker CACHED a /stable/ asset under the root prefix — invariant 7 fails');
if ((await keys(root)).length === before.length) ok('no new cache was created by that request');
else bad('a new cache appeared during the /stable/ probe', (await keys(root)).join(', '));

await context.close(); await browser.close(); server.close();
if (fails.length) { console.error(`\nDEMO FAILED — ${fails.length}:`); for (const f of fails) console.error('  ' + f); process.exit(1); }
console.log('\nDEMO PASSED — acceptance items 5, 6 and 7 hold in a real browser across both paths.');
