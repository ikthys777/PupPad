#!/usr/bin/env node
/**
 * CHECK — the worker must not cache an HTTP error over a good entry.
 *
 * PUP-WO-0105. `fetch()` RESOLVES on 4xx and 5xx; it rejects only on a network-layer
 * failure. So a worker that writes every resolved response into its cache replaces
 * the good copy with the error body while ONLINE, and the offline branch never runs
 * because nothing rejected. './' is in urlsToCache, so the poisoned entry is the app
 * shell — northstar invariants 3 and 5.
 *
 * WHY THIS CHECK HAD TO BE NEW, and it is the part worth reading.
 *
 * The obvious diagnosis — "the sandbox fetch always throws, so the .then branch never
 * runs" — is true of the default stub and TOO COARSE. `check-mutations.mjs`'s B7
 * already makes it resolve. The blindness is the SHAPE of what it resolves to:
 *
 *     fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; }
 *
 * a bare object with no `status`, no `ok`, no `type`, and not a `Response`. Before this
 * file, the ONLY `new Response` occurrences anywhere in .github/ci were the two inside
 * sw.js MUTATION TEXT in check-mutations.mjs — the offline 504, never a fetched
 * response. So no check could express "the worker cached an error response", and not
 * because a branch was unreachable: because the one fixture that reached it could not
 * carry the property under test.
 *
 * (Measured on THIS branch, which forks `main`. The `expectFail` mechanism that names
 * WHICH assertion must fire is PUP-WO-0103's and is not merged, so on `main` every one
 * of check-mutations' 21 mutations is verified by `code !== 0` alone — B7 included.
 * That is PUP-WO-0104's to fix and is not touched here; it is recorded because it is
 * why B7's green says less than its label promises.)
 *
 * A stub that cannot fail is not a test. A stub that can only fail is not one either.
 * A stub that can neither carry nor be asked about the property under test is not one
 * at all.
 *
 * So this check supplies both halves the artifact lacked:
 *   1. a fixture that IS a real Response with a settable status, and
 *   2. an assertion that READS THE STATUS of what was cached.
 *
 * WHAT IS SHAPED RATHER THAN REAL, stated rather than glossed. Node cannot construct a
 * genuine opaque response — `new Response(null, {status: 0})` throws, and `type` is a
 * read-only accessor. The opaque case below is therefore a REAL Response instance with
 * `status`, `ok` and `type` redefined on it. Every other case is a genuine Response.
 * The genuine article was observed in Chromium and is recorded in
 * docs/feedback/PUP-WO-0105.md §2; this check exists to keep the property, not to
 * discover it.
 *
 * Usage: node check-error-caching.mjs <dir containing sw.js>
 */
import { join, resolve } from 'node:path';
import { FakeCacheStorage, loadWorker, swRequest } from './lib/sw-harness.mjs';

const DIR = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const SW = join(DIR, 'sw.js');
const ORIGIN = 'https://ikthys777.github.io';
const SCOPE = `${ORIGIN}/PupPad/`;
const TARGET = `${SCOPE}index.html`;
const GOOD = 'THE GOOD BYTES';

let failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, detail) => { failures.push(m); console.log(`  FAIL  ${m}${detail ? `\n          ${detail}` : ''}`); };

/**
 * A real Response, with `type` forced only where Node cannot produce the real thing.
 *
 * THE CLONE MUST CARRY THE PROPERTY TOO, and the first version of this fixture did
 * not — which made this check go red against a CORRECT worker. `Response.prototype
 * .clone()` returns a fresh Response built from the internal state, so properties
 * redefined on the instance are DROPPED by the clone; the worker stores the clone, so
 * the cache received status 200 while the guard had correctly seen status 0. A real
 * opaque response clones to an opaque response, so the fixture must too.
 *
 * That is the same failure this check exists to catch — a fixture that cannot carry
 * the property under test past the point where the code actually uses it — met while
 * building the fixture for it. Recorded rather than quietly fixed.
 */
function opaqueResponse() {
  const make = () => {
    const r = new Response('', { status: 200 });
    Object.defineProperty(r, 'status', { value: 0 });
    Object.defineProperty(r, 'ok', { value: false });
    Object.defineProperty(r, 'type', { value: 'opaque' });
    Object.defineProperty(r, 'clone', { value: () => make() });
    return r;
  };
  return make();
}

function fixture(kind) {
  if (kind === 'opaque') return opaqueResponse();
  return new Response(kind === 200 ? GOOD : `ERROR BODY ${kind}`, { status: kind });
}

/** Run one request through the worker and report what ended up in its cache. */
async function run(kind, { seedGood }) {
  const cacheStorage = new FakeCacheStorage();
  const net = { attempted: 0 };
  const worker = loadWorker(SW, SCOPE, cacheStorage, {
    fetch: async () => { net.attempted++; return fixture(kind); },
  });
  const name = worker.get('CACHE_NAME');
  if (!name) throw new Error('worker derived no CACHE_NAME — wrong scope?');

  if (seedGood) {
    const c = await cacheStorage.open(name);
    await c.put(TARGET, new Response(GOOD, { status: 200 }));
  }

  const { responses } = await worker.dispatch('fetch', { request: swRequest(TARGET) });
  if (responses.length) await responses[0].catch(() => {});
  /* the write is fire-and-forget by design; flush the microtask queue rather than
   * sampling immediately — a race here would make this check flaky, and a flaky
   * assertion is worse than a dead one because it goes green on a real regression
   * and gets dismissed as flake. */
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));

  const c = await cacheStorage.open(name);
  const hit = await c.match(TARGET);
  return { net, hit, stored: hit ? { status: hit.status, body: await hit.clone().text() } : null };
}

console.log(`check-error-caching: ${SW}\n`);

/* ---- 1. the fixture must actually fire, or every verdict below is vacuous ---- */
const base = await run(200, { seedGood: false });
if (base.net.attempted > 0) ok('the network fixture fired — the online branch is reachable');
else bad('the network fixture never fired; nothing below tested anything', 'the worker did not call fetch');

/* ---- 2. a 200 must still be cached: the guard must not over-refuse ---- */
if (base.stored && base.stored.status === 200) ok('a 200 is cached, with status 200 read back from the cache');
else bad('a 200 was NOT cached — the guard refuses legitimate traffic', `stored=${JSON.stringify(base.stored)}`);

/* ---- 3. THE DEFECT: an error must not overwrite a good entry ---- */
for (const code of [404, 500, 503]) {
  const r = await run(code, { seedGood: true });
  if (!r.stored) {
    bad(`a ${code} DELETED the cached entry`, 'nothing is stored under the app shell URL');
  } else if (r.stored.status === 200 && r.stored.body === GOOD) {
    ok(`a ${code} did not replace the cached entry — status 200 still read back`);
  } else {
    bad(`A ${code} RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5`,
        `cached status=${r.stored.status} body=${JSON.stringify(r.stored.body.slice(0, 40))}; ` +
        `offline, the device would serve this instead of the app`);
  }
}

/* ---- 4. opaque must STILL be cached: invariant 3 for the Map panel ---- */
const op = await run('opaque', { seedGood: false });
if (op.stored && op.stored.status === 0) {
  ok('an opaque cross-origin response is still cached — the Map panel keeps its offline assets');
} else {
  bad('AN OPAQUE RESPONSE WAS REFUSED — the Map panel loses leaflet, supabase and every tile offline',
      `stored=${JSON.stringify(op.stored)}; response.ok is FALSE for opaque, so a naive ` +
      '`response.ok` guard trades invariant 3 against invariant 3 (work order §1.2, §7)');
}

console.log('  NOT ASSERTED: whether an opaque 200 and an opaque 404 can be told apart.');
console.log('                They cannot — both are status 0, type opaque, body unreadable —');
console.log('                so a failed tile is cached exactly as it is today. PUP-WO-0600.');

if (failures.length) {
  console.error(`\nCHECK FAILED — ${failures.length} assertion(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nCHECK PASSED — errors are not cached over good entries; 200 and opaque still are.');
