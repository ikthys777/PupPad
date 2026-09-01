#!/usr/bin/env node
/**
 * CHECK 5 — Cache isolation between the two deploy paths.
 *
 * Two independent mechanisms fail northstar invariant 7, and this asserts both:
 *
 *   §1.1  caches.keys() is ORIGIN-scoped, so an activate handler that deletes by
 *         inequality reaps the other deploy path's caches. Naming alone converts a
 *         collision into mutual deletion (architecture §6).
 *   §1.2  The root worker's scope COVERS /stable/, and the fetch handler caches
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
import { FakeCacheStorage, loadWorker } from './lib/sw-harness.mjs';

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
const rootPrefix = rootW.get('CACHE_PREFIX');
const stablePrefix = stableW.get('CACHE_PREFIX');
const rootName = rootW.get('CACHE_NAME');
const stableName = stableW.get('CACHE_NAME');

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
const rootStale = rootPrefix + 'v1';

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

/* ---- verdict ---- */
if (failures.length) {
  console.error(`\nCHECK 5 FAILED — ${failures.length} assertion(s):\n`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.detail}`);
  console.error('\n  northstar invariant 7: a device serves exactly one build\'s assets, never a mixture.');
  process.exit(1);
}
console.log('\nCHECK 5 PASSED — prefixes differ and do not nest; the reap is bounded to its own prefix;');
console.log('  the legacy exception is an exact literal; the root worker declines /stable/.');
