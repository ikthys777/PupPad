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
import { execFileSync } from 'node:child_process';
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
  /* The fixture records WHAT IT ACTUALLY SERVED, not merely that it fired. Without
   * this the check can only say "the worker attempted to cache the 404" — about a
   * run in which no 404 ever existed, because a mutant fixture returned an ordinary
   * 200 for every error kind. Naming the wrong cause is the defect this project has
   * paid for four times (architecture §5): assert WHICH step failed, never that one did. */
  const net = { attempted: 0, served: [] };
  const worker = loadWorker(SW, SCOPE, cacheStorage, {
    fetch: async () => {
      net.attempted++;
      const r = fixture(kind);
      net.served.push({ status: r.status, type: r.type });
      return r;
    },
  });
  const name = worker.get('CACHE_NAME');
  if (!name) throw new Error('worker derived no CACHE_NAME — wrong scope?');

  if (seedGood) {
    const c = await cacheStorage.open(name);
    await c.put(TARGET, new Response(GOOD, { status: 200 }));
  }

  /* Attempts made BEFORE the dispatch (the seed) are not the worker's. */
  const attemptsBeforeDispatch = cacheStorage.putAttempts.length;
  const { responses } = await worker.dispatch('fetch', { request: swRequest(TARGET) });
  if (responses.length) await responses[0].catch(() => {});
  /* the write is fire-and-forget by design; flush the microtask queue rather than
   * sampling immediately — a race here would make this check flaky, and a flaky
   * assertion is worse than a dead one because it goes green on a real regression
   * and gets dismissed as flake. */
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));

  const c = await cacheStorage.open(name);
  const hit = await c.match(TARGET);
  const workerAttempts = cacheStorage.putAttempts.slice(attemptsBeforeDispatch);
  return { net, hit, workerAttempts,
           stored: hit ? { status: hit.status, body: await hit.clone().text() } : null };
}

/* Architecture §5: assert the COMMIT that ran, never the conclusion alone. */
let SUBJECT = '(git unavailable)';
try { SUBJECT = execFileSync('git', ['hash-object', SW], { encoding: 'utf8' }).trim(); } catch {}
console.log(`check-error-caching: ${SW}`);
console.log(`  SUBJECT sw.js blob : ${SUBJECT}\n`);

/* ---- 1. the fixture must actually fire, or every verdict below is vacuous ---- */
const base = await run(200, { seedGood: false });
if (base.net.attempted > 0) ok('the network fixture fired — the online branch is reachable');
else bad('the network fixture never fired; nothing below tested anything', 'the worker did not call fetch');

/* ---- 2. a 200 must still be cached: the guard must not over-refuse ---- */
if (base.stored && base.stored.status === 200) ok('a 200 is cached, with status 200 read back from the cache');
else bad('a 200 was NOT cached — the guard refuses legitimate traffic', `stored=${JSON.stringify(base.stored)}`);

/* ---- 3. THE DEFECT: an error must not overwrite a good entry ---- */
for (const code of [404, 429, 500, 502, 503]) {
  const r = await run(code, { seedGood: true });
  /* POSITIVE CONTROL, and it is the half that was missing. "The seed survived" is
   * equally true when the worker was never asked to write at all — which is exactly
   * what happened when a mutant fixture returned an ordinary 200 for every "error"
   * kind, and all three assertions here printed ok about errors that never existed.
   * Assert that the response REACHED the worker and that the worker REFUSED it. */
  const served = r.net.served.map((x) => x.status);
  if (r.net.attempted === 0) {
    bad(`the ${code} fixture never fired — this assertion tested nothing`,
        'the worker did not call fetch, so no error response existed to refuse');
  } else if (!served.includes(code)) {
    bad(`the fixture did not serve a ${code} — this assertion tested nothing`,
        `it served ${JSON.stringify(served)}; the status under test never reached the worker`);
  } else if (r.workerAttempts.length !== 0) {
    bad(`the worker ATTEMPTED to cache the ${code}`,
        `write attempts during dispatch: ${JSON.stringify(r.workerAttempts)}`);
  } else if (!r.stored) {
    bad(`a ${code} DELETED the cached entry`, 'nothing is stored under the app shell URL');
  } else if (r.stored.status === 200 && r.stored.body === GOOD) {
    ok(`a ${code} reached the worker and was REFUSED — zero write attempts, seed intact`);
  } else {
    bad(`A ${code} RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5`,
        `cached status=${r.stored.status} body=${JSON.stringify(r.stored.body.slice(0, 40))}; ` +
        `offline, the device would serve this instead of the app`);
  }
}

/* ---- 3b. THE CROSS-ORIGIN PATH ITSELF, which no check in this tree executed ----
 *
 * Assertions 2-3 above dispatch a SAME-ORIGIN url, and assertion 4 below forces
 * `type: 'opaque'` onto the response with defineProperty. Together they test the
 * guard's PREDICATE correctly and never once take sw.js's cross-origin branch —
 * `if (u.origin !== self.location.origin) return true;` — which is what actually
 * decides whether leaflet, supabase and every OSM tile are served at all. V8
 * coverage put that line at count 0 across the whole suite, and mutating it to
 * `return false` (the Map panel dark offline) left every check green.
 *
 * That is this work order's own defect one level over: the fixture reached the
 * predicate and never the path. So dispatch a real foreign origin. */
const FOREIGN = 'https://cdn.example.org/leaflet.min.js';
{
  const cacheStorage = new FakeCacheStorage();
  const worker = loadWorker(SW, SCOPE, cacheStorage, {
    fetch: async () => fixture('opaque'),
  });
  const name = worker.get('CACHE_NAME');
  const { responses } = await worker.dispatch('fetch', { request: swRequest(FOREIGN) });
  if (!responses.length) {
    bad('the worker DECLINED a cross-origin request outright — the Map panel gets nothing',
        `no respondWith for ${FOREIGN}`);
  } else {
    await responses[0].catch(() => {});
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    const hit = await (await cacheStorage.open(name)).match(FOREIGN);
    if (hit && hit.status === 0) ok('a genuinely cross-origin asset is served and cached (sw.js cross-origin branch)');
    else bad('THE CROSS-ORIGIN BRANCH DID NOT CACHE — leaflet, supabase and every map tile would be absent offline',
             `stored=${hit ? JSON.stringify({ status: hit.status }) : 'null'} for ${FOREIGN}`);
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

/* ---- 5. THE INSTALL PATH — PUP-WO-0105 §0a, AS IT STANDS AFTER THE REVERT.
 * 5b is asserted. 5a is CHARACTERISED — measured and printed — because the behaviour
 * it describes is an open defect (PUP-WO-0108) rather than a property this artifact
 * provides. An earlier version of this header said "ASSERTED, not measured and
 * printed", which was true of the install fix that was reverted.
 *
 * The guard stops new poisoning. It is worthless on a device the fix cannot reach,
 * and a device with no quota headroom is exactly that: addAll rejects, install fails,
 * the new worker goes `redundant`, and THE OLD UNGUARDED WORKER STAYS ACTIVATED. The
 * devices most likely to be squeezed are the most-used, and a poisoned device is a
 * used one — so without this the fix misses the tablet it was written for.
 *
 * Two assertions, and NEITHER IS SUFFICIENT ALONE. Install must survive a quota
 * failure AND must still fail loudly on a bad deploy; a blanket catch passes the
 * first and destroys the second. */
async function install(opts) {
  const cs = new FakeCacheStorage();
  const w = loadWorker(SW, SCOPE, cs, { fetch: async () => new Response(GOOD, { status: 200 }) });
  const name = w.get('CACHE_NAME');
  const c = await cs.open(name);
  for (const [url, res] of opts.seed || []) await c.put(url, res);
  if (opts.capacity !== undefined) cs.capacityEntries = opts.capacity;
  if (opts.httpFail) cs.httpFailFor = new Set(opts.httpFail);
  let rejected = null;
  try { await w.dispatch('install', {}); } catch (e) { rejected = e; }
  const keys = await (await cs.open(name)).keys();
  return { cs, name, rejected, keys, deleted: cs.deleted, entryDeletes: cs.entryDeletes };
}

const ABS = (u) => new URL(u, SCOPE).href;
function urlsToCacheAbs() {
  const probe = loadWorker(SW, SCOPE, new FakeCacheStorage());
  return probe.get('urlsToCache').map(ABS);
}
const SHELL = ABS('./index.html');
const RUNTIME = [`${ORIGIN}/cdn/leaflet.js`, `${ORIGIN}/cdn/tile-1.png`, `${ORIGIN}/cdn/tile-2.png`];

/* 5a. SQUEEZED QUOTA — A KNOWN OPEN DEFECT (PUP-WO-0108), NOT AN ASSERTION.
 *
 * Round 3 asserted here that a squeezed device still completes install. That fix was
 * REVERTED: its reclaim was total rather than sufficient, and resolving on a second
 * quota failure let the worker ACTIVATE over an unprovisioned cache, at which point
 * the activate handler's legacy deletion removed the device's last good shell.
 * Failing to install is a reach limitation; activating over nothing is a harm.
 *
 * So the behaviour is CHARACTERISED, not asserted. An assertion here would either
 * point at code that no longer exists or encode a defect as correct. */
{
  const seed = RUNTIME.map((u) => [u, new Response('opaque-ish', { status: 200 })]);
  seed.push([SHELL, new Response('POISONED', { status: 404 })]);
  const r = await install({ seed, capacity: 6 });
  console.log('  NOT ASSERTED: whether a squeezed device receives the fix at all.');
  console.log('                ' + (r.rejected
    ? `install REJECTED (${r.rejected.name}) — the new worker is discarded and the OLD one keeps serving.`
    : 'install RESOLVED — the new worker activates. That is NOT today\'s behaviour and if you are'
      + ' reading it here, something changed.') + ' PUP-WO-0108.');
}

/* 5b. THE OTHER HALF: a bad deploy must still fail loudly */
{
  const r = await install({ seed: [], httpFail: ['./icon-512.png'] });
  if (!r.rejected) {
    bad('A BAD DEPLOY INSTALLED SILENTLY — a 404 on a precached URL did not fail install',
        'the worker would activate over a cache it never provisioned; invariant 3');
  } else if (r.rejected.name === 'TypeError') {
    ok('a 404 on a precached URL still fails install loudly — the old worker keeps serving');
  } else {
    bad('install failed, but not as a fetch failure', `got ${r.rejected.name}: ${r.rejected.message}`);
  }
}

/* 5c and 5d ARE GONE WITH THE CODE THEY TESTED. They asserted that the reclaim never
 * deleted a urlsToCache entry, and that a fetch failure on the RETRY still failed
 * install loudly. After the revert there is no reclaim and no retry, so both would
 * pass BY NOT RUNNING — the exact shape this file exists to prevent. They travel to
 * PUP-WO-0108 with the code, along with the finding that the keep-list resolved
 * against registration.scope while addAll resolves against the script URL. */

console.log('  NOT ASSERTED: whether an opaque 200 and an opaque 404 can be told apart.');
console.log('                They cannot — both are status 0, type opaque, body unreadable —');
console.log('                so a failed tile is cached exactly as it is today.');
console.log('                THIS HAS NO WORK ORDER. An earlier version of this line said');
console.log('                "PUP-WO-0600", and architecture.md:391 rebuts that move BY NAME:');
console.log('                0600 scope is index.html:11-13, the two CDN tags, while the OSM');
console.log('                tiles "cannot be vendored at all" and "the tiles question needs');
console.log('                its own work order and does not have one."');

if (failures.length) {
  console.error(`\nCHECK FAILED — ${failures.length} assertion(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nCHECK PASSED — errors are not cached over good entries; 200 and opaque still are.');
