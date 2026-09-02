#!/usr/bin/env node
/**
 * CHECK 6 — the same properties as check 5, in a REAL BROWSER.
 *
 * It began as evidence and was promoted to a check for a reason worth keeping: a
 * Node sandbox is DETECTABLE. One line — `typeof ExtendableEvent !== 'undefined'` —
 * makes a worker behave for check 5 and reap origin-wide in Chromium, and nothing
 * standing in CI caught that bypass. Check 5 proves the logic; this proves the
 * browser agrees.
 *
 * WHY THIS IS PUP-WO-0102'S AND NOT PUP-WO-0103'S. It serves ONE tree — the working
 * copy — at both / and /stable/, and registers the SAME sw.js twice. It verifies
 * the worker, not publication, so it needs no published trees and no build. The
 * two-TREE harness, which drives the two genuinely different published workers
 * (F8), is PUP-WO-0103's and is not here.
 *
 * Demonstrates PUP-WO-0102 acceptance items 4, 5 and 6 (§3):
 *
 *   4  prefix-bounded reaping: populate both caches, force-activate the ROOT
 *      worker, show the /stable/ cache still present afterwards.
 *   5  the legacy migration, on a device state that STARTS with pup-pad-v16
 *      present: reaped by exact literal, the new cache built. This is merge day.
 *   6  with the root worker controlling, a request under /stable/ is neither
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
import { requireSubject } from './lib/subject.mjs';

const REPO = resolve(process.argv[2] || process.cwd());
/* SERVED AT THE REAL DEPLOYED PATHS (PUP-WO-0103 F0, fix 4).
 * This served '/' and '/stable/', whose prefixes are puppad|%2F| and
 * puppad|%2Fstable%2F|. The site serves /PupPad/ and /PupPad/stable/. So this check
 * exercised paths that do not exist, and — worse — skipped the nesting case
 * ("/PupPad/" IS a prefix of "/PupPad/stable/") that the trailing-| delimiter in
 * sw.js exists for. */
const BASE = '/PupPad/';
const STABLE_BASE = BASE + 'stable/';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

/* Serve the SAME tree at / and at /stable/ — which is exactly the shape the two
 * deploy paths have, and the shape that makes the two workers collide. */
let rootSwVersion = 0;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    /* A bare same-origin page with NO service-worker registration, so caches can be
     * seeded BEFORE any worker exists. index.html registers a worker on load
     * (index.html:1935), so seeding from it means the root worker has already
     * activated and reaped before the seed lands — which would test nothing. */
    if (p === BASE + '__seed.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>seed</title>');
      return;
    }
    const underStable = p.startsWith(STABLE_BASE);
    p = underStable ? '/' + p.slice(STABLE_BASE.length) : '/' + p.slice(BASE.length);
    if (p.endsWith('/')) p += 'index.html';
    let body = await readFile(join(REPO, p));
    /* Bump the ROOT worker's bytes on demand so update() has something to install. */
    if (!underStable && p === '/sw.js' && rootSwVersion > 0) {
      body = Buffer.from(String(body) + `\n/* rev ${rootSwVersion} */\n`);
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream',
                         'Service-Worker-Allowed': BASE }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* Cache names are DERIVED from the worker under test, never hardcoded. An earlier
 * version pinned 'v17', so the moment CACHE_VERSION was bumped — which check 3
 * MANDATES whenever a cached asset changes — this check went red and the two
 * checks contradicted each other on every app change. A check that cannot survive
 * the change another check requires is a check that will be deleted. */
/* PUP-WO-0301 §2.4: check 6 asserted no subject at all. It is run twice in CI — once
 * against the repo and once against each published copy — and a demonstration that
 * cannot say which commit produced the tree it just proved something about is a
 * demonstration about no particular tree. The subject is the commit the CHECK came
 * from, which is well defined even when the argument is dist/stable. */
const SUBJECT = requireSubject(resolve(join(import.meta.dirname, '..', '..')), 'CHECK 6');
console.log(`  subject commit ${SUBJECT.slice(0, 12)}`);

const probeStore = new FakeCacheStorage();
const ROOT_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}${BASE}`, probeStore).get('CACHE_NAME');
const STABLE_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}${STABLE_BASE}`, probeStore).get('CACHE_NAME');
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

/* ---- seed a device that already holds the legacy cache (item 5) ---- */
const root = await context.newPage();
await root.goto(`${ORIGIN}${BASE}__seed.html`, { waitUntil: 'load' });
const SEED_STALE = ROOT_CACHE.replace(/[^|]*$/, 'seed-stale');
await root.evaluate(async ({ stale, stableCache }) => {
  await caches.open('pup-pad-v16');      // the real legacy name
  await caches.open(stale);              // a stale cache of root's OWN prefix
  await caches.open('some-other-app');   // an unrelated cache on this origin
  /* F0 fix 1 — THE PROMOTED COPY'S CACHE EXISTS BEFORE ANY WORKER RUNS.
   * It was absent from this seed, and stable registered AFTER root, so the root
   * worker's only activate ran with nothing of /stable/'s on the origin to eat. A
   * root worker that deletes the promoted copy's cache passed this check. */
  await caches.open(stableCache);
}, { stale: SEED_STALE, stableCache: STABLE_CACHE });
console.log('  seeded (no worker has run yet):', (await keys(root)).join(', '));

/* ---- bring up BOTH workers ---- */
await root.goto(`${ORIGIN}${BASE}index.html`, { waitUntil: 'load' });
await root.evaluate(async () => {
  const r = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  await navigator.serviceWorker.ready; return r.scope;
});
const stable = await context.newPage();
await stable.goto(`${ORIGIN}${STABLE_BASE}index.html`, { waitUntil: 'load' });
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
/* The F0 name-existence assertion that stood here is DELETED, not fixed.
 *
 * It seeded the promoted cache, brought up the root worker, then registered the
 * stable worker — whose install RECREATES a cache of that name — and only then
 * asserted the name was present. Name-existence cannot distinguish "survived" from
 * "deleted, then recreated by the next step", and it printed `ok` on a run where the
 * root worker demonstrably deleted it. My fix, and vacuous.
 *
 * NOT ASSERTED HERE: that the promoted copy's cache survives the root worker's
 * activation. The force-activate assertion further down covers the re-activation
 * case; the FIRST activation is uncovered. (PUP-WO-0104) */
console.log('  NOT ASSERTED: survival of the promoted cache through the root worker\'s FIRST activation — see PUP-WO-0104');
if (stableCache) ok('stable worker created its own prefixed cache'); else bad('stable worker cache missing');

/* ---- item 5: legacy gone, by literal; unrelated cache untouched ---- */
if (!afterBoth.includes('pup-pad-v16')) ok('legacy pup-pad-v16 removed (item 5 — merge day)');
else bad('legacy pup-pad-v16 still present');
if (!afterBoth.includes(SEED_STALE)) ok("root's own stale cache reaped");
else bad("root's own stale cache survived");
if (afterBoth.includes('some-other-app')) ok('an unrelated cache on the same origin was NOT touched');
else bad('an unrelated cache on the same origin was DELETED — the reap is origin-wide');

/* ---- item 4: force-activate root, stable must survive ---- */
await root.bringToFront();
/* F0 fix 2 — THE RE-ACTIVATION HAS TO INSTALL SOMETHING.
 * This called r.update() against a BYTE-IDENTICAL sw.js. The browser byte-compares,
 * installs nothing, and no second activate fires — so "force-activating the ROOT
 * worker" activated nothing and the assertion below was vacuous. Serving a byte
 * different worker is what makes update() produce a new one. */
rootSwVersion += 1;
await root.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  await r.update();
  await new Promise(res => setTimeout(res, 1200));
});
await root.reload({ waitUntil: 'load' });
await root.waitForTimeout(1500);
const afterReactivate = await keys(root);
console.log('  after force-activating the ROOT worker:', afterReactivate.join(', '));
if (afterReactivate.includes(STABLE_CACHE))
  ok('THE /stable/ CACHE SURVIVED the root worker activating (item 4 — roadmap P1 gate 4)');
else
  bad('the /stable/ cache was DELETED by the root worker activating — invariant 7 fails');

/* ---- item 6: root worker must not serve or cache /stable/ ---- */
const controlled = await root.evaluate(() => !!navigator.serviceWorker.controller);
if (controlled) ok('root page is controlled by the root worker'); else bad('root page is not controlled');
const before = await keys(root);
const probe = await root.evaluate(async ({ origin, cacheName, stableBase }) => {
  await fetch(origin + '/stable/manifest.json', { cache: 'no-store' });
  const names = await caches.keys();
  // Do NOT caches.open() here: open CREATES the cache, which both hides a moved
  // name and manufactures the very cache the next assertion counts.
  if (!names.includes(cacheName)) return { missing: true };
  const c = await caches.open(cacheName);
  return { missing: false, hit: !!(await c.match(origin + '/stable/manifest.json')) };
}, { origin: ORIGIN, cacheName: ROOT_CACHE, stableBase: STABLE_BASE });
if (probe.missing) bad(`the root cache ${ROOT_CACHE} does not exist — this assertion tested nothing`);
else if (!probe.hit) ok('root worker did NOT cache a /stable/ asset under its own prefix (item 6)');
else bad('root worker CACHED a /stable/ asset under the root prefix — invariant 7 fails');
if ((await keys(root)).length === before.length) ok('no new cache was created by that request');
else bad('a new cache appeared during the /stable/ probe', (await keys(root)).join(', '));

/* ---- F4's navigation probe: DELETED, NOT FIXED (PUP-WO-0103 round 3) ----
 *
 * It filtered cached paths with `.startsWith('/stable/')` while the harness serves
 * '/PupPad/stable/', so it could not match ANY input — and the correct value was
 * passed into the evaluate and never read. The stale literals survived the rename
 * that made this file serve the real deployed paths, which is why the fix looked
 * complete: the SERVING agreed with the deployment and the ASSERTIONS did not.
 *
 * Deleted rather than repaired, on the ruling that an assertion which cannot fire is
 * FALSE COVERAGE and worse than none — a green line reads as a guarantee. PUP-WO-0104
 * builds the real one, along with the browser-at-the-production-origin work that
 * makes this class inexpressible instead of merely detected.
 *
 * NOT ASSERTED HERE, said out loud so its absence is visible:
 *   - that a top-level NAVIGATION to /stable/ leaves no foreign bytes under the root
 *     prefix. Nothing checks this now. (PUP-WO-0104) */
console.log('  NOT ASSERTED: navigation-poisoning of the root cache by /stable/ — see PUP-WO-0104');

/* ---- item 5, SECOND HALF: offline cold-load after the legacy migration ----
 *
 * §3.5 does not stop at "legacy reaped, new cache built" — it ends "offline
 * cold-load succeeds", and that is the half Buddy actually experiences. A migration
 * that deletes the old cache and then cannot serve from the new one is STRICTLY
 * WORSE than no migration at all: it converts a stale-but-working tablet into a
 * blank one, offline, with no adult able to tell why (northstar invariant 3).
 *
 * The expected title is taken from the ONLINE load rather than written here as a
 * literal. Hardcoding it would reproduce finding F2 exactly — check 6 pinned 'v17'
 * once already and went red the moment check 3 MANDATED a bump, so the two checks
 * contradicted each other on every app change. A check that cannot survive a
 * legitimate edit to the app is a check that gets deleted. */
const onlineTitle = await root.title();

/* OFFLINE IS THE SERVER BEING GONE, not context.setOffline(true).
 *
 * setOffline was tried first and DID NOT WORK: a mutant whose offline fallback
 * returns undefined — serving nothing at all — passed this assertion green. The
 * flag does not stop a service worker's own fetch reaching a loopback server, so
 * the worker kept being handed live bytes and "offline" tested nothing. That is a
 * stub that cannot fail, found in the assertion added to prove the merge-day path,
 * inside the work order whose §3.7 is about exactly this.
 *
 * Closing the listener and its keep-alive sockets is unambiguous: nothing can
 * answer on that port, so anything served now came out of the Cache API. */
server.closeAllConnections?.();
await new Promise((r) => server.close(r));

const cold = await context.newPage();
let coldTitle = null, coldControlled = false, coldErr = null;
try {
  await cold.goto(`${ORIGIN}${BASE}index.html`, { waitUntil: 'load' });
  coldTitle = await cold.title();
  coldControlled = await cold.evaluate(() => !!navigator.serviceWorker.controller);
} catch (e) { coldErr = e.message; }

if (coldTitle && coldTitle === onlineTitle)
  ok(`offline cold-load served the console from cache after the legacy migration (item 5): ${JSON.stringify(coldTitle)}`);
else
  bad('offline cold-load FAILED after the legacy migration — the tablet is blank with no network',
      coldErr || `expected ${JSON.stringify(onlineTitle)}, got ${JSON.stringify(coldTitle)}`);
if (coldControlled) ok('the offline page is controlled by the worker that served it');
else bad('the offline page loaded but is NOT worker-controlled', 'it was served by the HTTP cache, so this proved nothing about sw.js');

await context.close(); await browser.close();   /* the server is already closed, above */
if (fails.length) { console.error(`\nCHECK 6 FAILED — ${fails.length}:`); for (const f of fails) console.error('  ' + f); process.exit(1); }
console.log('\nCHECK 6 PASSED — acceptance items 4, 5 (including offline cold-load) and 6 hold in a real browser.');
