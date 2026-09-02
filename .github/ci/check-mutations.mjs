/**
 * CHECK 7 — the checks can fail.
 *
 * Every other check answers "is sw.js correct?". This one answers "would we know if
 * it weren't?", which is a different question and the only one architecture §6.1
 * says a green suite cannot settle on its own: the origin-wide read shipped for
 * months under a fully green gate.
 *
 * WHY IT IS COMMITTED, having been argued the other way first. I kept this
 * uncommitted on the grounds that a mutation engine does not belong on the branch
 * that reaches Buddy's tablet. That conflated two things: this branch is
 * tablet-reaching only THROUGH sw.js, and Pages serves nothing under .github/, so a
 * mutation engine here reaches no device on any branch. Uncommitted it was worse
 * than useless — "every stub was shown able to fail" decays into something someone
 * once said, and the next person cannot check it. (CC-A's ruling, PUP-WO-0102.)
 *
 * WHY IT RUNS IN CI RATHER THAN SITTING IN THE TREE. Its mutations are anchored to
 * exact source text, so a legitimate edit to sw.js breaks an anchor. That already
 * happened once inside this work order. Committed-but-never-run, it would rot
 * silently and be discovered broken years later by whoever finally needed it; run,
 * a broken anchor is a red check and someone updates the mutation. A test of the
 * tests has to be maintained or it is a fossil.
 *
 * TWO HALVES, because "a stub can fail" means two different things:
 *   PART A — restore a real defect in sw.js; check 5 MUST go red. Fourteen of them,
 *            including invariant 7's own falsification test (A1) and the encoding
 *            fix that closed an attack while opening an invariant 3 violation (A6).
 *   PART B — neuter a harness stub while leaving a real defect in sw.js, and
 *            classify what happens:
 *              SILENT — the check goes GREEN. That stub was the ONLY thing between
 *                       the defect and a green run. This is the architecture §6.1
 *                       shape and it is the dangerous one.
 *              LOUD   — the check goes red anyway, because some OTHER assertion
 *                       contradicts the neutered stub's story. Still load-bearing,
 *                       but it fails safe.
 *
 * THE RULE THIS FILE CORRECTED, kept because the correction is the value. I wrote
 * that a stub fails silently "exactly when its neutered return value is also a
 * legitimate one" — and that rule made me miss the sandbox `fetch` (B7). A
 * RESOLVING fetch is not degenerate at all; it is what an online browser hands the
 * worker on every request. Neuter it and the worker never reaches its offline
 * branch, so THE ASSERTION PASSES BY NOT RUNNING. The hazard is not only a stub
 * that returns the wrong thing, nor only one that cannot express the input — it is
 * any fixture whose absence makes an assertion silently not apply.
 *
 * THIS FILE FAILS IF ANY MUTATION DOES NOT BEHAVE AS PREDICTED, in either
 * direction: a defect that escapes, or a stub that has quietly become decorative.
 */
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = process.argv[2] || process.cwd();
const results = [];

function run(label, { sw = [], harness = [], expect, expectFail }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-red-'));
  try {
    cpSync(join(REPO, 'sw.js'), join(dir, 'sw.js'));
    cpSync(join(REPO, '.github/ci'), join(dir, 'ci'), {
      recursive: true, filter: (s) => !s.includes('node_modules'),
    });
    /* ROUND 5, M2 — THE BEST DIAGNOSTIC IN THE REPO WAS UNREADABLE WHERE IT FIRES.
     * This text was thrown as an Error, so GitHub rendered it as a Node stack trace
     * with no annotation, and `${file}` named the file INSIDE THE TEMPORARY COPY —
     * a path that no longer exists by the time anyone reads the log, in a directory
     * the human cannot edit. So the one message in the pipeline that exists to stop
     * a maintainer deleting the check pointed at a file they could not open. It now
     * annotates, names the path IN THE REPO, and exits instead of unwinding. */
    const patch = (file, subs, realPath) => {
      if (!subs.length) return;
      let s = readFileSync(file, 'utf8');
      for (const [a, b] of subs) {
        if (!s.includes(a)) {
          console.error(`::error file=${realPath}::${label}: mutation anchor no longer matches ${realPath} — update the anchor, do not delete the mutation.`);
          console.error(`\n${label}: anchor not found in ${realPath}`);
          console.error(`  (searched the working copy at ${file}, which is a throwaway clone of ${realPath})\n`);
          console.error(`  THIS IS MAINTENANCE, NOT FLAKINESS, AND THE FIX IS NOT TO DELETE THIS CHECK.`);
          console.error(`  Mutations are anchored to exact source text. This anchor stopped matching`);
          console.error(`  BECAUSE the file it points into was edited — red precisely because of the`);
          console.error(`  change, which is the opposite of flaky. Update the anchor in`);
          console.error(`  .github/ci/check-mutations.mjs to the edited text, keeping the mutation's`);
          console.error(`  MEANING the same, and re-run.`);
          console.error(`  Deleting the mutation removes the only evidence that the defect it`);
          console.error(`  restores would still be caught (architecture §6.1).\n`);
          console.error(`  anchor:\n${a}`);
          /* rmSync the throwaway clone before exiting: this `process.exit` sits inside
           * the try{} whose finally{} does the cleanup, so every anchor failure leaked
           * one /tmp/puppad-red-* directory. Measured: exactly one per failure. */
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
          process.exit(1);
        }
        s = s.replace(a, b);
      }
      writeFileSync(file, s);
    };
    patch(join(dir, 'sw.js'), sw, 'sw.js');
    patch(join(dir, 'ci/lib/sw-harness.mjs'), harness, '.github/ci/lib/sw-harness.mjs');

    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, [join(dir, 'ci/check-cache-isolation.mjs'), dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      code = e.status ?? 1;
      out = (e.stdout || '') + (e.stderr || '');
    }
    const red = code !== 0;
    const observed = expect === 'RED' || expect === 'GREEN'
      ? (red ? 'RED' : 'GREEN')
      : (red ? 'LOUD' : 'SILENT');
    let pass;
    const fails = out.split('\n').filter((l) => l.includes('FAIL')).map((l) => l.trim());
    /* FINDING B — THE EXIT CODE IS NOT THE VERDICT.
     * This compared `code !== 0` and nothing else, so ANY red counted as "the defect
     * was caught" — including a red for a completely different reason. A mutation that
     * merely breaks sw.js with a syntax error would have scored as proof that the
     * assertion under test still works. `expectFail` names the assertion that must be
     * the one to fire; a red produced by anything else is now a misprediction, which
     * is what it always was. */
    const matched = !expectFail || fails.some((f) => f.includes(expectFail));
    pass = observed === expect && matched;
    if (observed === expect && !matched) {
      console.log(`        RED, but NOT on the expected assertion: wanted ${JSON.stringify(expectFail)}`);
    }
    results.push({ label, expect, got: observed, pass, fails, code });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${label}`);
    console.log(`        expected ${expect}, got ${observed} (exit ${code})`);
    for (const f of fails.slice(0, 4)) console.log(`        ${f}`);
    if (fails.length > 4) console.log(`        ... and ${fails.length - 4} more`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n=== BASELINE — the artifact as committed ===');
run('baseline: sw.js as committed', { expect: 'GREEN' });

console.log('\n=== PART A — restore the defect, check 5 must go RED ===');

/* §3.3 THE HEADLINE. Invariant 7's own falsification test. */
run('A1  origin-wide READ restored (invariant 7, architecture §6.1)', {
  expect: 'RED', expectFail: "SERVED the other deploy path",
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
});

run('A2  origin-wide REAP restored (architecture §6)', {
  expect: 'RED', expectFail: "reap DELETED",
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
});

run('A3  legacy exception becomes a PATTERN, not a literal', {
  expect: 'RED', expectFail: "NEAR MISS",
  sw: [[`name === LEGACY_CACHE_EXACT`, `name.indexOf('pup-pad-v1') === 0`]],
});

run('A4  /stable/ exclusion removed (root serves the promoted copy)', {
  expect: 'RED', expectFail: "SERVES /stable/",
  sw: [[`  if (FOREIGN_SUBTREE !== null) {`, `  if (false) {`]],
});

run('A5  prefix delimiter dropped — root\'s prefix nests inside stable\'s name', {
  expect: 'RED', expectFail: "STARTS WITH",
  sw: [[`  return 'puppad|' + encodeURIComponent(path) + '|';`,
        `  return 'puppad|' + encodeURIComponent(path);`]],
});

/* THE "WHAT DOES THIS FIX REFUSE" PROBE, made mechanical. This is F7: the
 * PUP-WO-0101 encoding fix that closed an attack and opened an invariant 3
 * violation. It must be caught by assertion 9, not by anyone remembering. */
run('A6  F7 regression: require paths to ARRIVE canonical (refuses /my%20photo.png)', {
  expect: 'RED', expectFail: "legitimately encoded asset",
  sw: [[`  var parts = pathname.split('/');`,
        `  try { if (pathname !== decodeURIComponent(pathname)) return null; } catch (e) { return null; }
  var parts = pathname.split('/');`]],
});

run('A7  stable worker allowed to delete the ROOT\'s legacy cache', {
  expect: 'RED', expectFail: "DELETED pup-pad-v16",
  sw: [[`if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;`,
        `if (name === LEGACY_CACHE_EXACT) return true;`]],
});

run('A8  non-canonical scope no longer unregisters (orphan cache)', {
  expect: 'RED', expectFail: "stayed registered",
  sw: [[`  if (CACHE_PREFIX === null || canonicalPath(SCOPE_PATH) !== SCOPE_PATH) {`,
        `  if (CACHE_PREFIX === null) {`]],
});

run('A9  bare foreign directory served (/PupPad/stable with no slash)', {
  expect: 'RED', expectFail: "foreign directory",
  sw: [[`    if (canon === FOREIGN_SUBTREE.slice(0, -1)) return false;`, ``]],
});

/* F9. The reap moved OUT of waitUntil onto a timer: every assertion above still
 * passes at the moment it measures, and the deletion lands afterwards. Requires the
 * sandbox to HAVE setTimeout — without it this mutant dies on a ReferenceError and
 * the check would appear to catch a defect it cannot actually host. */
run('A10 reap moved outside waitUntil onto a timer (F9)', {
  expect: 'RED', expectFail: "reap did NOT delete",
  sw: [[`  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {`,
        `  setTimeout(function() {
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {`],
       [`        }).map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();`,
        `        }).map(function(name) { return caches.delete(name); })
      );
    });
  }, 50);
  self.clients.claim();`]],
});

/* A10 above goes red on the PRE-EXISTING assertions — with the reap deferred,
 * nothing has been deleted at the moment they measure. So it does not yet prove the
 * post-settle trap earns its place. THIS one does: a perfectly correct
 * prefix-bounded reap inside waitUntil, PLUS a deferred origin-wide sweep. Every
 * assertion in sections 1-2 passes, because at the moment they measure the worker
 * has behaved impeccably. Only the trap sees what happens next. */
run('A11 correct reap PLUS a deferred origin-wide sweep — the exact F9 shape', {
  expect: 'RED', expectFail: "AFTER activate settled",
  sw: [[`  self.clients.claim();
});

self.addEventListener('fetch', function(event) {`,
        `  self.clients.claim();
  setTimeout(function() {
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n) { return n !== CACHE_NAME; })
        .map(function(n) { return caches.delete(n); }));
    });
  }, 50);
});

self.addEventListener('fetch', function(event) {`]],
});

/* ---- The four the adversarial pass found. A12-A14 and B7 each passed ALL SIX
 * checks before the fixes; they are here so that stops being true silently. ---- */

/* F4. The sandbox could not express a navigation, so a worker that exempts
 * top-level navigations from the /stable/ decline was structurally invisible. */
run('A12 navigations exempted from the /stable/ decline (pass F4)', {
  expect: 'RED', expectFail: "SERVES /stable/ for a top-level navigation",
  sw: [[`  if (!servesRequest(event.request.url)) return;`,
        `  if (!servesRequest(event.request.url) && event.request.mode !== 'navigate') return;`]],
});

/* F5. Check 5 ran the MIRROR of northstar invariant 7's stated test — it seeded
 * stable and read from root. The promoted copy's own offline read was unexercised. */
run('A13 the PROMOTED copy reads origin-wide (invariant 7 in its own direction, pass F5)', {
  expect: 'RED', expectFail: "PROMOTED COPY SERVED THE TEST BUILD",
  sw: [[`        return hit || new Response('', { status: 504, statusText: 'Offline and not cached' });`,
        `        if (hit) return hit;
        if (IS_STABLE_WORKER) return caches.match(event.request);
        return new Response('', { status: 504, statusText: 'Offline and not cached' });`]],
});

/* F7. install was never dispatched and addAll recorded nothing, so the precache —
 * a third way for a worker to touch what it does not own — was unobservable. */
run('A14 the precache reaches into the other deploy path (pass F7)', {
  expect: 'RED', expectFail: "precached OUTSIDE",
  sw: [[`  './icon-512.png'
];`, `  './icon-512.png',
  './stable/index.html'
];`]],
});

console.log('\n=== PART B — neuter the STUB, keep a real defect. SILENT = the stub was the only defence ===');

/* B1 IS THE HISTORICAL DEFECT ITSELF. architecture §6.1 point 2: the stub whose
 * match() returned undefined unconditionally is what blinded the check reporting
 * on cache isolation. Same sw.js defect as A1; only the stub changes. */
/* THE HEADLINE OF §3.7. Identical sw.js to A1. A1 is RED, B1 is SILENT — one stub
 * apart. That IS architecture §6.1 point 2, reproduced on demand. */
run('B1  FakeCacheStorage.match() -> undefined, WITH the origin-wide read (the §6.1 blindness)', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  harness: [[`    for (const [, store] of this.entries) if (store.has(url)) return store.get(url);
    return undefined;`, `    return undefined;`]],
});

/* Predicted SILENT, observed LOUD: "reap did NOT delete a stale cache of its OWN
 * prefix" — the check asserts what MUST go as well as what must stay, so a delete
 * that does nothing contradicts the first half. Symmetry is the defence. */
run('B2  FakeCacheStorage.delete() made a no-op, WITH the origin-wide reap', {
  expect: 'LOUD',
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
  harness: [[`  async delete(name) {
    this.deleted.push(name);
    return this.names.delete(name);
  }`, `  async delete(name) {
    this.deleted.push(name);
    return true;
  }`]],
});

/* Predicted SILENT, observed LOUD: an empty survivor list fails every expectKept
 * assertion at once. [] is not a legitimate value here — the store was seeded. */
run('B3  FakeCacheStorage.keys() -> [], WITH the origin-wide reap', {
  expect: 'LOUD',
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
  harness: [[`  async keys() { return [...this.names]; }`, `  async keys() { return []; }`]],
});

/* Predicted SILENT, observed LOUD: "root worker declined its OWN path". The check
 * asserts the worker SERVES what it owns as well as declining what it does not, so
 * a stub that makes everything look declined cannot hide an over-broad exclusion.
 * This is the "what does the fix refuse?" discipline built into the check itself. */
run('B4  dispatch() drops respondWith, WITH the /stable/ exclusion removed', {
  expect: 'LOUD',
  sw: [[`  if (FOREIGN_SUBTREE !== null) {`, `  if (false) {`]],
  harness: [[`        respondWith: (p) => responses.push(p),`, `        respondWith: () => {},`]],
});

/* Predicted SILENT, observed LOUD: two workers at one scope derive one prefix, and
 * "the two deploy paths derive different cache prefixes" denies it immediately. */
run('B5  registration.scope ignored (both workers get one scope), WITH nesting prefixes', {
  expect: 'LOUD',
  sw: [[`  return 'puppad|' + encodeURIComponent(path) + '|';`,
        `  return 'puppad|' + encodeURIComponent(path);`]],
  harness: [[`    registration: { scope },`, `    registration: { scope: 'https://ikthys777.github.io/PupPad/' },`]],
});

/* SILENT, as predicted, and for B1's reason: a put that stores nothing makes the
 * seeded foreign bytes never exist, so the read has nothing to wrongly serve. Both
 * of assertion 8's supporting stubs are of the dangerous shape — which makes the
 * origin-wide-read assertion the least-defended one in check 5. Flagged upward. */
run('B6  cache handle put/match made inert, WITH the origin-wide read', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  /* Anchor updated by PUP-WO-0105 round 3, which gave put() a write-attempt counter
   * and a simulated-quota throw. THE MUTATION IS UNCHANGED — an inert put, with the
   * origin-wide read present. Updating the anchor is the maintenance this check's own
   * error message asks for; deleting the mutation would remove the only evidence that
   * the cache handle is load-bearing. */
  harness: [[`      put: async (req, res) => {
        const url = this._key(req);
        this.putAttempts.push(url);
        this._admit(store, url);
        store.set(url, res);
      },`,
             `      put: async () => {},`]],
});

/* F6 — THE STUB THE SIX-STUB AUDIT MISSED, and the reason it missed it: the rule
 * was "audit the stubs whose DEGENERATE value is also legitimate", and a RESOLVING
 * fetch is not degenerate at all — it is what an online browser hands the worker on
 * every request. The dangerous value here is the NORMAL one. Neutering it used to
 * let the architecture §6.1 defect through green, because the worker never reached
 * its offline branch and the assertion passed by not running. */
run('B7  sandbox fetch RESOLVES, WITH the origin-wide read (the audit\'s own blind spot)', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  harness: [[`    fetch: async () => {
      network.attempted++; network.rejected++;
      throw new Error('network disabled in harness');
    },`, `    fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; },`]],
});

console.log('\n' + '='.repeat(78));
const escaped = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? 'ok          ' : 'MISPREDICTED'} ${r.expect.padEnd(6)} ${r.label}`);
const silent = results.filter((r) => r.got === 'SILENT');

/* ROUND 5, M1 — THE EXIT CODE CONVENTION IS ASSERTED HERE, NOT PROMISED IN A COMMENT.
 * check-cache-isolation.mjs now distinguishes 1 (the property is VIOLATED — a real
 * verdict) from 3 (NO VERDICT — the check itself broke), because ci.yml's /stable/
 * call site reads nothing but the exit code and used to print "NOT PREFIX-BOUNDED"
 * plus "fast-forward stable" for both. That convention is only worth anything if a
 * defect actually produces 1, so PART A asserts it: a mutation that CRASHES the check
 * is not demonstrating that the assertion under test fires — it is demonstrating that
 * the harness fell over, which is the §6.1 member-3 defect (a failure whose cause is
 * not the one under test) wearing a green tick.
 * A baseline of 0 and PART B are excluded: B-mutations blind the harness deliberately
 * and may legitimately reach no verdict. */
const partA = results.filter((r) => /^A\d/.test(r.label));
const crashedA = partA.filter((r) => r.code === 3);
console.log(`\n  exit codes observed — PART A: ${[...new Set(partA.map((r) => r.code))].sort().join(', ')}` +
            `  |  PART B: ${[...new Set(results.filter((r) => /^B\d/.test(r.label)).map((r) => r.code))].sort().join(', ')}`);
if (crashedA.length) {
  console.error(`::error::CHECK 7 FAILED — ${crashedA.length} PART A mutation(s) CRASHED check 5 (exit 3)`);
  console.error('  rather than making it reach a verdict. Each proves only that the harness broke:');
  for (const r of crashedA) console.error(`    ${r.label}`);
  process.exit(1);
}

if (escaped.length) {
  console.error(`::error::CHECK 7 FAILED — ${escaped.length} mutation(s) did not behave as predicted.`);
  console.error(`\nCHECK 7 FAILED — ${escaped.length} mutation(s) did not behave as predicted:`);
  for (const r of escaped) console.error(`  ${r.label}: expected ${r.expect}, got ${r.got}`);
  process.exit(1);
}
console.log(`\nCHECK 7 PASSED — ${results.length - 1} mutations, all as predicted.`);
console.log('  PART A: all 14 defects check 5 screens for produce RED, including invariant 7\'s own');
console.log('          falsification test (A1) and the F7 "what does the fix refuse" regression (A6).');
console.log(`  PART B: every stub is load-bearing, and ${silent.length} of 7 now fail SILENT.`);
console.log('          B1 and B6 WERE silent — the two stubs whose degenerate value ("cache miss")');
console.log('          is also a legitimate one, and the pair assertion 8 rests on. The positive');
console.log('          control added to check-cache-isolation.mjs turned both LOUD.');
