#!/usr/bin/env node
/**
 * CHECK 5 — Cache isolation between the two deploy paths.
 *
 * Two independent mechanisms fail northstar invariant 7, and this asserts both:
 *
 *   §1.1  caches.keys() is ORIGIN-scoped, so an activate handler that deletes by
 *         inequality reaps the other deploy path's caches. Naming alone converts a
 *         collision into mutual deletion (architecture §6).
 *   §1.4  The root worker's scope COVERS /stable/, and the fetch handler caches
 *         what it serves — so it can cache the promoted copy's assets under the
 *         root prefix before stable's worker registers.
 *
 * These are asserted BEHAVIOURALLY: sw.js is loaded into a sandbox, a populated
 * origin-wide cache store is handed to it, the real activate handler runs, and the
 * check asks what survived. A textual assertion (grep for `startsWith`) proves a
 * token is present, not that a foreign cache is still there afterwards — and the
 * defect is one line of rewriting away from passing such a grep.
 */
import { join } from 'node:path';
import { FakeCacheStorage, loadWorker, swRequest, REQUEST_SHAPES } from './lib/sw-harness.mjs';

const REPO = process.argv[2] || process.cwd();
const SW = join(REPO, 'sw.js');

const ROOT_SCOPE = 'https://ikthys777.github.io/PupPad/';
const STABLE_SCOPE = 'https://ikthys777.github.io/PupPad/stable/';

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, detail) => { failures.push({ m, detail }); console.log(`  FAIL  ${m}`); };

/* ---- 1. The two published paths derive different, non-nesting prefixes ---- */
const probe = new FakeCacheStorage();
const rootW = loadWorker(SW, ROOT_SCOPE, probe);
const stableW = loadWorker(SW, STABLE_SCOPE, probe);

/* A worker with no CACHE_PREFIX at all is the UNFIXED file — `main` before this
 * work order, and `refs/heads/stable` until it is fast-forwarded past it — whose
 * activate handler reaps every cache on the origin by inequality. That is the exact
 * hazard architecture §6 names, so this must say so in words rather than dying on a
 * ReferenceError: PUP-WO-0103 runs this same check against every copy it is about
 * to publish, and a diagnostic is the difference between "the promoted copy carries
 * the origin-wide reaper, fast-forward `stable`" and a stack trace. That is how the
 * §6 ordering stops being prose — but the diagnostic has to exist first, and it
 * belongs with the check, which is here. */
const readOr = (w, name) => { try { return w.get(name); } catch { return undefined; } };
const rootPrefix = readOr(rootW, 'CACHE_PREFIX');
const stablePrefix = readOr(stableW, 'CACHE_PREFIX');
const rootName = readOr(rootW, 'CACHE_NAME');
const stableName = readOr(stableW, 'CACHE_NAME');

if (rootPrefix === undefined || rootName === undefined) {
  console.error('\nCHECK 5 FAILED — this copy\'s sw.js defines no CACHE_PREFIX.');
  console.error('  That is the pre-PUP-WO-0102 worker, whose activate handler reaps by inequality:');
  console.error('      names.filter(function(name) { return name !== CACHE_NAME; })');
  console.error('  caches.keys() is ORIGIN-scoped, so publishing this copy alongside the other one');
  console.error('  means each deletes the other\'s cache on every activation — northstar invariants');
  console.error('  3 and 7 (architecture §6).');
  console.error('\n  If this is the PROMOTED copy: fast-forward `stable` before publishing it.');
  process.exit(1);
}

console.log(`  root   scope=${ROOT_SCOPE}\n         prefix=${rootPrefix}\n         name=${rootName}`);
console.log(`  stable scope=${STABLE_SCOPE}\n         prefix=${stablePrefix}\n         name=${stableName}`);

if (rootPrefix !== stablePrefix) ok('the two deploy paths derive different cache prefixes');
else bad('the two deploy paths derive the SAME cache prefix', `both ${rootPrefix}`);

/* The subtle one. "/PupPad/" IS a prefix of "/PupPad/stable/", so a prefix built
 * naively from the path would leave the root worker able to reap stable while
 * looking correctly bounded. Assert the nesting is actually broken. */
if (!stableName.startsWith(rootPrefix)) ok('stable\'s cache name does not start with root\'s prefix');
else bad('stable\'s cache name STARTS WITH root\'s prefix — root would reap stable', `${stableName} vs ${rootPrefix}`);
if (!rootName.startsWith(stablePrefix)) ok('root\'s cache name does not start with stable\'s prefix');
else bad('root\'s cache name STARTS WITH stable\'s prefix', `${rootName} vs ${stablePrefix}`);

/* ---- 2. The reap is prefix-bounded, proven by what survives it ---- */
const LEGACY = 'pup-pad-v16';
const ADJACENT = rootPrefix.replace(/\|$/, 'x|') + 'v17';   // adjacent, NOT owned
const UNRELATED = 'some-other-app-cache';
/* Derived so it can NEVER equal rootName. `rootPrefix + 'v1'` collides the moment
 * CACHE_VERSION is 'v1', and the check would then demand one cache be both deleted
 * and preserved — an assertion guaranteed to fail whatever the worker does. This
 * file's sibling already carries the lesson ("a check that cannot survive the change
 * another check requires is a check that will be deleted"); it was applied there and
 * not here. */
const rootStale = rootName + '-stale-from-a-previous-build';

const store = new FakeCacheStorage([rootName, rootStale, stableName, ADJACENT, UNRELATED, LEGACY]);
const activating = loadWorker(SW, ROOT_SCOPE, store);
await activating.dispatch('activate');
const survivors = await store.keys();

const expectGone = { [rootStale]: 'a stale cache of its OWN prefix', [LEGACY]: 'the legacy cache, by exact literal' };
const expectKept = {
  [rootName]: 'its own current cache',
  [stableName]: "the OTHER deploy path's cache",
  [ADJACENT]: 'an adjacent prefix it does not own',
  [UNRELATED]: 'an unrelated cache on the same origin',
};
for (const [name, why] of Object.entries(expectGone)) {
  if (!survivors.includes(name)) ok(`reap deleted ${why}`);
  else bad(`reap did NOT delete ${why}`, name);
}
for (const [name, why] of Object.entries(expectKept)) {
  if (survivors.includes(name)) ok(`reap preserved ${why}`);
  else bad(`reap DELETED ${why} — this is the origin-wide reap (architecture §6)`, name);
}

/* ---- 2a. F3: THE SAME MATRIX AT THE PROMOTED SCOPE ----
 *
 * Everything above dispatches at ROOT_SCOPE. The only activate ever run at
 * STABLE_SCOPE was handed a two-entry store and asserted one thing — that the legacy
 * literal survived. So a worker that reaps origin-wide ONLY when running at the
 * promoted scope passed every assertion in this file, and §1.4's whole mechanism
 * inherits that coverage. sw.js already branches on scope (IS_STABLE_WORKER, the
 * legacy exception), so scope-conditional is the realistic shape of a defect here,
 * not a contrived one — and the promoted copy is the one the child uses.
 *
 * (PUP-WO-0103 F3. This file is PUP-WO-0102's; touched here under the work order's
 * documented seam exception, because §1.4 makes it 0103's mechanism and fixing a
 * blind gate in a later work order means the gate stays blind meanwhile.) */
const sAdjacent = stablePrefix.replace(/\|$/, 'x|') + 'v17';
const sStale = stableName + '-stale-from-a-previous-build';
const sStore = new FakeCacheStorage([stableName, sStale, rootName, sAdjacent, UNRELATED, LEGACY]);
const sActivating = loadWorker(SW, STABLE_SCOPE, sStore);
await sActivating.dispatch('activate');
const sSurvivors = await sStore.keys();
for (const [name, why] of Object.entries({ [sStale]: 'a stale cache of its OWN prefix' })) {
  if (!sSurvivors.includes(name)) ok(`[stable scope] reap deleted ${why}`);
  else bad(`[stable scope] reap did NOT delete ${why}`, name);
}
for (const [name, why] of Object.entries({
  [stableName]: 'its own current cache',
  [rootName]: "the ROOT deploy path's cache",
  [sAdjacent]: 'an adjacent prefix it does not own',
  [UNRELATED]: 'an unrelated cache on the same origin',
  [LEGACY]: "the ROOT copy's legacy cache (the exception is the root worker's alone)",
})) {
  if (sSurvivors.includes(name)) ok(`[stable scope] reap preserved ${why}`);
  else bad(`[stable scope] reap DELETED ${why} — an origin-wide reap on the PROMOTED copy`, name);
}

/* ---- 2b. F9: nothing may touch a cache AFTER activate's waitUntil settles ----
 *
 * `dispatch()` awaits every promise the handler passed to waitUntil, so a reap
 * inside it is fully observed HOWEVER SLOW it is — that half needs no window. The
 * hole is a deletion scheduled outside the event: `setTimeout(function(){
 * caches.delete(x); }, 5000)` mutates the origin while every assertion above has
 * already measured, and passes. It is also genuinely broken, not merely invisible —
 * the browser only guarantees the worker stays alive for the duration of waitUntil,
 * so a deferred reap may be killed halfway through.
 *
 * So rather than sleeping and re-reading — which only catches timers shorter than
 * whatever sleep is chosen — a TRAP is installed on the store: from here to the end
 * of the run, any deletion at all is recorded and fails the check. The bounded wait
 * below only exists to give a short timer its chance to fire; a timer longer than
 * the remaining process lifetime still escapes, and that limit is stated rather
 * than papered over. (Finding F9, PUP-WO-0101 — undocumented before that pass.) */
const afterSettle = [];
const realDelete = store.delete.bind(store);
store.delete = async (name) => { afterSettle.push(name); return realDelete(name); };
await new Promise((r) => setTimeout(r, 250));
if (afterSettle.length === 0)
  ok("no cache was touched after activate's waitUntil settled (the reap lives inside the event)");
else
  bad('a cache was deleted AFTER activate settled — the reap runs outside waitUntil',
      `${afterSettle.join(', ')} — the browser may kill the worker mid-deletion, and every ` +
      'assertion above has already measured');

/* ---- 3. The legacy exception matches nothing but the exact literal ---- */
const nearMisses = ['pup-pad-v16x', 'xpup-pad-v16', 'pup-pad-v1', 'pup-pad-v17', 'PUP-PAD-V16'];
const store2 = new FakeCacheStorage([rootName, ...nearMisses]);
const w2 = loadWorker(SW, ROOT_SCOPE, store2);
await w2.dispatch('activate');
const left = await store2.keys();
const wronglyDeleted = nearMisses.filter(n => !left.includes(n));
if (wronglyDeleted.length === 0) ok('the legacy exception matches the exact literal only');
else bad('the legacy exception matched a NEAR MISS — it is a pattern, not a literal', wronglyDeleted.join(', '));

/* ---- 4. The root worker declines the other deploy path (§1.2) ---- */
const store3 = new FakeCacheStorage();
const rootFetch = loadWorker(SW, ROOT_SCOPE, store3);
const stableReq = await rootFetch.dispatch('fetch', { request: { url: 'https://ikthys777.github.io/PupPad/stable/index.html' } });
if (!stableReq.respondWithCalled) ok('root worker DECLINES a request under /stable/ (no response, no cache entry)');
else bad('root worker SERVES /stable/ — it can cache the promoted copy under the root prefix', 'respondWith was called');

const ownReq = await rootFetch.dispatch('fetch', { request: { url: 'https://ikthys777.github.io/PupPad/index.html' } });
if (ownReq.respondWithCalled) ok('root worker still serves its own path');
else bad('root worker declined its OWN path — the exclusion is too broad', 'respondWith not called');

const stableFetch = loadWorker(SW, STABLE_SCOPE, new FakeCacheStorage());
const stableOwn = await stableFetch.dispatch('fetch', { request: { url: 'https://ikthys777.github.io/PupPad/stable/index.html' } });
if (stableOwn.respondWithCalled) ok('stable worker serves its own path');
else bad('stable worker declined its own path — the exclusion misfires on the stable copy', 'respondWith not called');

/* ---- 4b. F4: the decline must hold across every REQUEST SHAPE, not just a GET ----
 *
 * A worker that exempts top-level navigations from the /stable/ decline caches the
 * promoted copy's document under the root prefix and passed all six checks, because
 * every fake request here was `{ url }` and nothing else. The sandbox could not
 * express a navigation, so no assertion could reach the branch. */
const shapeW = loadWorker(SW, ROOT_SCOPE, new FakeCacheStorage());
for (const [what, opts] of REQUEST_SHAPES) {
  const foreign = await shapeW.dispatch('fetch', {
    request: swRequest('https://ikthys777.github.io/PupPad/stable/index.html', opts) });
  if (!foreign.respondWithCalled) ok(`root worker declines /stable/ for ${what}`);
  else bad(`root worker SERVES /stable/ for ${what} — it caches the promoted copy under the root prefix`,
           JSON.stringify(opts));
  const own = await shapeW.dispatch('fetch', {
    request: swRequest('https://ikthys777.github.io/PupPad/index.html', opts) });
  if (own.respondWithCalled) ok(`root worker still serves its own path for ${what}`);
  else bad(`root worker declined its OWN path for ${what} — the rule is shape-dependent`, JSON.stringify(opts));
}

/* ---- 5. finding 7: the legacy exception belongs to the ROOT worker only ---- */
const store4 = new FakeCacheStorage([LEGACY, stableName]);
const stableOnly = loadWorker(SW, STABLE_SCOPE, store4);
await stableOnly.dispatch('activate');
const left4 = await store4.keys();
if (left4.includes(LEGACY))
  ok("stable's worker leaves the ROOT's legacy cache alone (no cross-path deletion)");
else
  bad("stable's worker DELETED pup-pad-v16 — a cache the ROOT copy owns", 'root install left with no cache until next online load');

/* ---- 6. finding 4: non-canonical paths that resolve INTO /stable/ ---- */
const encodings = [
  ['/PupPad/%73table/manifest.json', 'percent-encoded "s"'],
  ['/PupPad/stable%2Fmanifest.json', 'encoded separator'],
  ['/PupPad//stable/manifest.json',  'doubled slash'],
  ['/PupPad/./stable/manifest.json', 'dot segment'],
  ['/PupPad/x/../stable/index.html', 'dot-dot segment'],
  /* The lenient-decode path must not become an escape hatch. sw.js decodes a
   * malformed segment escape-by-escape precisely so "100%off.png" is served; these
   * prove the separator test still runs on the RESULT, so a valid %2F cannot ride
   * through on the back of a neighbouring invalid escape. Without them the comment
   * in sw.js would be claiming coverage nothing tests. */
  ['/PupPad/%2Fstable%GG/manifest.json', 'valid %2F beside an INVALID escape'],
  ['/PupPad/%GG%2Fstable/manifest.json', 'invalid escape first, then a valid %2F'],
];
const rootServe = loadWorker(SW, ROOT_SCOPE, new FakeCacheStorage());
for (const [path, why] of encodings) {
  const r = await rootServe.dispatch('fetch', { request: { url: 'https://ikthys777.github.io' + path } });
  if (!r.respondWithCalled) ok(`root worker declines ${why}: ${path}`);
  else bad(`root worker SERVES a path that resolves into /stable/ (${why})`, path);
}
/* and it must still serve its own ordinary traffic */
for (const p of ['/PupPad/index.html', '/PupPad/icon-192.png', '/PupPad/games/gyre.js']) {
  const r = await rootServe.dispatch('fetch', { request: { url: 'https://ikthys777.github.io' + p } });
  if (r.respondWithCalled) ok(`root worker still serves ${p}`);
  else bad('root worker declined a path it owns — the allowlist is too narrow', p);
}

/* ---- 7. a worker at a non-canonical scope must not leave an orphan cache ---- */
const orphanStore = new FakeCacheStorage();
const orphan = loadWorker(SW, 'https://ikthys777.github.io/PupPad//stable/', orphanStore);
let unregistered = false;
orphan.sandbox.self.registration.unregister = () => { unregistered = true; return Promise.resolve(true); };
await orphan.dispatch('activate');
if (unregistered) ok('a worker at a non-canonical scope unregisters itself instead of orphaning a cache');
else bad('a worker at a non-canonical scope stayed registered', 'its prefix nests under neither deploy path, so nothing will ever reap it');

/* ---- 8. the OFFLINE READ must be scoped too (northstar invariant 7's own test) ---- */
/* "Load the promoted copy after the test copy has been cached; find any asset
 * served from the other build." The reap being prefix-bounded is not enough — a
 * worker that falls back to CacheStorage.match reads every cache on the origin. */
const shared = 'https://ikthys777.github.io/PupPad/shared-lib.js';
const crossStore = new FakeCacheStorage();
const stableSeed = loadWorker(SW, STABLE_SCOPE, crossStore);
const stableCache = await crossStore.open(stableSeed.get('CACHE_NAME'));
await stableCache.put(shared, 'BYTES FROM THE OTHER DEPLOY PATH');

/* POSITIVE CONTROL — prove the FIXTURE before trusting the assertion.
 *
 * This assertion is the only one in this file that rests entirely on stubs whose
 * degenerate value is also a LEGITIMATE one. An inert `put()` and a blind
 * origin-wide `match()` both mean "cache miss" — and a cache miss is exactly what a
 * PASS looks like here, so neither would contradict anything. That is the precise
 * shape of the architecture §6.1 blindness: not "a stub was wrong" but "a stub's
 * broken answer was indistinguishable from its correct one".
 *
 * Elsewhere the check is self-defending by symmetry — it asserts what must go as
 * well as what must stay, what must be served as well as what must be declined —
 * so a neutered stub contradicts some other assertion and fails loudly. Here there
 * is no such counterweight, so the seed is proven REACHABLE before its absence is
 * accepted as evidence of correctness. */
const seedReadback = await crossStore.match(shared);
if (seedReadback === 'BYTES FROM THE OTHER DEPLOY PATH')
  ok('cross-path seed is reachable through the store (the next assertion is not vacuous)');
else
  bad('the cross-path seed did not take — the offline-read assertion below would pass VACUOUSLY',
      'FakeCacheStorage.put or its origin-wide match is inert, and a cache miss is what a PASS looks like here');

const rootOffline = loadWorker(SW, ROOT_SCOPE, crossStore);
let servedOffline;
const offline = await rootOffline.dispatch('fetch', { request: { url: shared } });
if (offline.respondWithCalled) {
  try { servedOffline = await offline.responses[0]; } catch { servedOffline = undefined; }
}
if (servedOffline === 'BYTES FROM THE OTHER DEPLOY PATH')
  bad('the root worker SERVED the other deploy path\'s cached bytes when offline',
      'CacheStorage.match is origin-wide — invariant 7 falsified by its own stated test');
else
  ok('offline fallback reads only this worker\'s own cache, not the origin');

/* F6 — PROVE THE FIXTURE FIRED. The assertion above only means anything if the
 * worker actually took its offline branch, and what forces it there is the sandbox
 * `fetch` rejecting. Neuter that one stub — make fetch RESOLVE — and the worker
 * returns the network response, the offline branch never runs, and the assertion
 * passes because nothing happened. The positive control above proves the SEED was
 * reachable; it does not prove the BRANCH was taken. This does. */
const net = rootOffline.network();
if (net.attempted > 0 && net.rejected === net.attempted)
  ok(`the offline branch was actually taken (network attempted ${net.attempted}x, rejected ${net.rejected}x)`);
else
  bad('the offline branch was NOT exercised — the assertion above passed vacuously',
      `network attempted ${net.attempted}, rejected ${net.rejected}: a resolving fetch means the worker never reached its cache fallback`);

/* ---- 8b. F5: the invariant's OWN stated direction — the promoted copy reading ----
 *
 * Northstar invariant 7's falsification column reads "load the PROMOTED copy after
 * the TEST copy has been cached; find any asset served from the other build." The
 * assertion above runs the mirror of that: it seeds stable and reads from root. The
 * code is symmetric so both behave identically today — which is exactly why the gap
 * was invisible. It is not wrong now; it is unguarded against a change that touches
 * only one worker's branch.
 *
 * The fixture is a realistic device state, not a synthetic one: /PupPad/stable/... in
 * the ROOT worker's cache is precisely what a pre-PUP-WO-0102 root worker produced,
 * since its scope covered /stable/ and it cached unconditionally. */
const stableShared = 'https://ikthys777.github.io/PupPad/stable/app.js';
const mirrorStore = new FakeCacheStorage();
const rootSeed = loadWorker(SW, ROOT_SCOPE, mirrorStore);
const rootCacheHandle = await mirrorStore.open(rootSeed.get('CACHE_NAME'));
await rootCacheHandle.put(stableShared, 'BYTES FROM THE TEST BUILD');
if (await mirrorStore.match(stableShared) === 'BYTES FROM THE TEST BUILD')
  ok('test-build seed is reachable through the store (the next assertion is not vacuous)');
else
  bad('the test-build seed did not take — the promoted-copy assertion would pass VACUOUSLY', 'put or origin-wide match is inert');

const stableOffline = loadWorker(SW, STABLE_SCOPE, mirrorStore);
const promoted = await stableOffline.dispatch('fetch', { request: swRequest(stableShared) });
let promotedServed;
if (promoted.respondWithCalled) {
  try { promotedServed = await promoted.responses[0]; } catch (e) { promotedServed = undefined; }
}
if (promotedServed === 'BYTES FROM THE TEST BUILD')
  bad('THE PROMOTED COPY SERVED THE TEST BUILD\'S BYTES — invariant 7 by its own stated test',
      'load the promoted copy after the test copy has been cached; an asset came from the other build');
else
  ok('the promoted copy, offline, reads only its own cache (invariant 7 in its own stated direction)');
const netP = stableOffline.network();
if (netP.attempted > 0 && netP.rejected === netP.attempted)
  ok(`the promoted copy's offline branch was actually taken (network attempted ${netP.attempted}x)`);
else
  bad('the promoted copy\'s offline branch was NOT exercised', `network attempted ${netP.attempted}, rejected ${netP.rejected}`);

/* ---- 9. legitimate percent-encoded assets must still be served (invariant 3) ---- */
/* All of these are served by a static host and must therefore be served offline too,
 * or they are invariant 3 violations of the exact shape F7 was: works online, absent
 * offline, no error anywhere. The first three decode cleanly and always passed. The
 * last two are the ones the adversarial pass found refused — a filename containing a
 * backslash, and one containing a bare percent (the URL path encode-set does not
 * escape '%', so the browser sends it verbatim and decodeURIComponent throws). */
const encodedOk = ['/PupPad/my%20photo.png', '/PupPad/caf%C3%A9.png', '/PupPad/a%2Bb.png',
                   '/PupPad/a%5Cb.png', '/PupPad/100%off.png'];
const rootEnc = loadWorker(SW, ROOT_SCOPE, new FakeCacheStorage());
for (const p of encodedOk) {
  const r = await rootEnc.dispatch('fetch', { request: { url: 'https://ikthys777.github.io' + p } });
  if (r.respondWithCalled) ok(`serves a legitimately encoded asset: ${p}`);
  else bad('declined a legitimately encoded asset — it works online and is absent offline', p);
}

/* ---- 10. the foreign subtree's DIRECTORY, with no trailing slash ---- */
for (const p of ['/PupPad/stable', '/PupPad/stable?x=1']) {
  const r = await rootEnc.dispatch('fetch', { request: { url: 'https://ikthys777.github.io' + p } });
  if (!r.respondWithCalled) ok(`root worker declines the bare foreign directory: ${p}`);
  else bad('root worker serves the foreign directory without its trailing slash', `${p} — a host 301s this to /stable/ and a subresource fetch follows`);
}

/* ---- 11. F7: the PRECACHE must not reach outside this worker's scope ----
 *
 * `install` was never dispatched by any check and `addAll` recorded nothing, so
 * everything the precache does was unobservable. "A worker touches only what it
 * owns" covers install as much as fetch and activate — a urlsToCache entry pointing
 * into the other deploy path writes the promoted copy's bytes under this prefix
 * before a single fetch happens. */
for (const [scopeLabel, scopeUrl] of [['root', ROOT_SCOPE], ['stable', STABLE_SCOPE]]) {
const preStore = new FakeCacheStorage();
const installing = loadWorker(SW, scopeUrl, preStore);
await installing.dispatch('install');
const ownCache = await preStore.open(installing.get('CACHE_NAME'));
const precached = await ownCache.keys();
if (precached.length) ok(`[${scopeLabel}] install precached ${precached.length} entr(ies) into its own cache`);
else bad(`[${scopeLabel}] install precached NOTHING — no offline capability at all (invariant 3)`, 'urlsToCache is empty or addAll never ran');

const scopePath = new URL(scopeUrl).pathname;
const escaped = precached
  .map((u) => { try { return new URL(u, scopeUrl).pathname; } catch (e) { return u; } })
  .filter((path) => !path.startsWith(scopePath) || (scopeLabel === 'root' && path.startsWith(scopePath + 'stable/')));
if (escaped.length === 0) ok(`[${scopeLabel}] every precached entry lies inside this worker's own scope`);
else bad(`[${scopeLabel}] install precached OUTSIDE this worker's scope`, escaped.join(', '));
}

/* ---- verdict ---- */
if (failures.length) {
  console.error(`\nCHECK 5 FAILED — ${failures.length} assertion(s):\n`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.detail}`);
  console.error('\n  northstar invariant 7: a device serves exactly one build\'s assets, never a mixture.');
  process.exit(1);
}
console.log('\nCHECK 5 PASSED — prefixes differ and do not nest; the reap is bounded to its own prefix;');
console.log('  the legacy exception is an exact literal; the root worker declines /stable/.');
