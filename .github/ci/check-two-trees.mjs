#!/usr/bin/env node
/**
 * THE TWO PUBLISHED WORKERS, EXERCISED AS A PAIR.
 *
 * PUP-WO-0103 §1.5, carried from PUP-WO-0101's F8 and named there as the hardest
 * acceptance item in the work order.
 *
 * WHAT WAS MISSING, PRECISELY. Check 6 registers ONE sw.js at two scopes. That is
 * the deployed pair only while the two copies are IDENTICAL — and the state that
 * matters is exactly the one where they are not. Promotion lag is the normal
 * condition of this deployment, not an edge case: the root copy advances on every
 * merge and /stable/ advances only when a human promotes it, so for most of this
 * project's life the origin carries TWO DIFFERENT WORKERS, each with its own cache
 * version, running against each other's caches. Nothing had ever run that.
 *
 * Northstar invariant 7's falsification test is stated for exactly this situation —
 * "load the promoted copy after the test copy has been cached; find any asset served
 * from the other build" — and it cannot be run at all without two different builds.
 *
 * HOW THE DIFFERENCE IS CREATED, and why it is manufactured rather than found. In a
 * healthy deployment the two published trees are often the same commit, so a check
 * that only ran when they happened to differ would silently do nothing most of the
 * time — a check that passes because it stopped looking, which is the timing form of
 * the same defect PUP-WO-0101's F9 named. So this check GUARANTEES the condition: it
 * copies both trees to scratch and, if their workers are identical, advances the ROOT
 * copy the way a merge would — a changed index.html and the CACHE_VERSION bump that
 * check 3 mandates alongside it. That is promotion lag reproduced, not simulated.
 *
 * The real published trees are never modified. Everything happens in a temp dir.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const ROOT_TREE = resolve(process.argv[2] || 'dist');
const STABLE_TREE = resolve(process.argv[3] || 'dist/stable');
/* F0 — THE REAL DEPLOYED PATHS, not '/' and '/stable/'.
 *
 * This harness served the two copies at '/' and '/stable/', deriving prefixes
 * `puppad|%2F|` and `puppad|%2Fstable%2F|`. The site serves /PupPad/ and
 * /PupPad/stable/, whose prefixes are `puppad|%2FPupPad%2F|` and
 * `puppad|%2FPupPad%2Fstable%2F|`. So this check — and check 6 — exercised paths that
 * DO NOT EXIST, while check 5 used the real ones. A reap keyed to the real path
 * literal was invisible to all three.
 *
 * And the real shape is the one sw.js singles out as load-bearing: "/PupPad/" IS a
 * prefix of "/PupPad/stable/", which is the whole reason the trailing-| delimiter
 * exists. Testing at '/' and '/stable/' skipped the nesting case entirely. */
const BASE = '/PupPad/';
const STABLE_BASE = BASE + 'stable/';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

const fails = [];
const ok  = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { fails.push({ m, d }); console.log(`  FAIL  ${m}${d ? `\n          ${d}` : ''}`); };

const work = await mkdtemp(join(tmpdir(), 'puppad-two-trees-'));
const ROOT = join(work, 'root');
const STABLE = join(work, 'stable');

try {
  /* Copy both published trees, excluding the promoted copy from inside the root one
   * so the two are disjoint on disk exactly as they are on the site. */
  await cp(ROOT_TREE, ROOT, { recursive: true, filter: (s) => !s.startsWith(join(ROOT_TREE, 'stable')) });
  await cp(STABLE_TREE, STABLE, { recursive: true });
  await rm(join(ROOT, 'stable'), { recursive: true, force: true });

  const rootSw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const stableSw = await readFile(join(STABLE, 'sw.js'), 'utf8');

  /* F4 — BOTH COPIES ARE MARKED, ALWAYS. The cross-serving assertions used to be
   * gated on `manufactured`, which was true only when the two workers were
   * BYTE-IDENTICAL — so in the deployment's normal state, which this file's own
   * docblock calls "the state that matters", the titles were computed, printed and
   * dropped. A value measured and printed reads, in a green run, exactly like a value
   * asserted. Marking both copies in the scratch trees makes the test unconditional. */
  const html = async (dir, mark) => {
    const f = join(dir, 'index.html');
    await writeFile(f, (await readFile(f, 'utf8')).replace('</title>', ` ${mark}</title>`));
  };
  await html(ROOT, 'ROOTBUILD');
  await html(STABLE, 'STABLEBUILD');

  let manufactured = false;
  if (rootSw === stableSw) {
    /* Advance the root copy the way a merge would: a cached asset changes, and
     * CACHE_VERSION is bumped alongside it because check 3 requires exactly that. */
    const m = rootSw.match(/var CACHE_VERSION = '([^']+)';/);
    if (!m) {
      bad('cannot manufacture promotion lag: no `var CACHE_VERSION = \'…\';` in the root copy\'s sw.js',
          'this check would otherwise run two IDENTICAL workers and prove nothing');
    } else {
      await writeFile(join(ROOT, 'sw.js'),
        rootSw.replace(m[0], `var CACHE_VERSION = '${m[1]}-rootlag';`));
      manufactured = true;
      console.log(`  promotion lag manufactured: root CACHE_VERSION ${m[1]} -> ${m[1]}-rootlag`);
    }
  } else {
    console.log('  the two published trees already carry different workers — real promotion lag');
  }

  /* One origin, two DIFFERENT trees — which is the whole point. */
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === BASE + '__seed.html') { res.writeHead(200, {'Content-Type':'text/html'}).end('<!doctype html><title>seed</title>'); return; }
      const underStable = p.startsWith(STABLE_BASE);
      const base = underStable ? STABLE : ROOT;
      p = underStable ? '/' + p.slice(STABLE_BASE.length) : '/' + p.slice(BASE.length);
      if (p.endsWith('/')) p += 'index.html';
      const body = await readFile(join(base, p));
      res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream',
                           'Service-Worker-Allowed': BASE }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ORIGIN = `http://127.0.0.1:${server.address().port}`;

  const opts = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.PUPPAD_CHROMIUM) opts.executablePath = process.env.PUPPAD_CHROMIUM;
  else opts.channel = 'chromium';
  const browser = await chromium.launch(opts);
  const context = await browser.newContext();
  const keys = (pg) => pg.evaluate(() => caches.keys());
  const register = async (pg, url) => {
    await pg.goto(url, { waitUntil: 'load' });
    await pg.evaluate(async () => {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
    });
    await pg.reload({ waitUntil: 'load' });
    /* OBSERVATION WINDOW — 1500ms, stated rather than chosen (PUP-WO-0103 §1.6).
     * install -> activate -> claim is three event-loop hops plus cache.addAll over
     * loopback, measured at well under 400ms on this runner. 1500ms is ~4x the
     * observed worst case. It is a floor on how long we WAIT, never a bound on what
     * counts: every assertion below re-reads live state at the moment it asserts, so
     * a slow worker fails on the assertion rather than passing because we stopped
     * looking. A reap that has not happened by then is a reap that has not happened. */
    await pg.waitForTimeout(1500);
  };

  /* ---- bring both published copies up, in the order a device meets them ---- */
  /* F0 — THE ORDER IS THE TEST.
   *
   * This used to register root first, then stable, then sample the baseline. So the
   * root worker's only `activate` ran when /stable/'s cache DID NOT YET EXIST, and it
   * never activated again. A root worker that deletes the promoted copy's cache on
   * every activation passed — here and in check 6 — while check 5 caught it. The
   * harness built to backstop check 6 had check 6's defect.
   *
   * So: the PROMOTED copy comes up first and its cache exists. Only then does the root
   * worker register and activate, with the thing it might eat already on the origin.
   * The baseline is sampled BEFORE that activation, so a cache destroyed during it is
   * inside the observation window rather than never having been seen. */
  const stablePage = await context.newPage();
  await register(stablePage, `${ORIGIN}${STABLE_BASE}index.html`);
  const baseline = await keys(stablePage);
  console.log('  promoted copy up first; caches before the root worker exists:', baseline.join(', '));
  if (baseline.length) ok('the promoted copy created its cache before the root worker registered');
  else bad('the promoted copy created no cache', 'nothing for the root worker to threaten — this check would prove nothing');

  const rootPage = await context.newPage();
  await register(rootPage, `${ORIGIN}${BASE}index.html`);

  /* THE ASSERTION F0 EXISTS FOR: everything the promoted copy had must still be here
   * after the root worker has installed, activated and claimed. */
  const afterRoot = await keys(rootPage);
  for (const n of baseline) {
    if (afterRoot.includes(n)) ok(`the promoted copy's cache survived the root worker activating: ${n}`);
    else bad('THE ROOT WORKER DESTROYED THE PROMOTED COPY\'S CACHE', `${n} is gone — invariant 3 on the copy the child uses, and invariant 7 for the pair`);
  }

  const names = afterRoot;
  console.log('  caches after both published workers installed:', names.join(', '));
  if (names.length >= 2) ok(`both published workers created caches (${names.length} on the origin)`);
  else bad('the two published copies did not produce two caches', names.join(', ') || '(none)');
  /* `>= 2` matters: Set(one).size === 1 === length, so this printed `ok ... distinct`
   * on the very input where one build's cache had been destroyed. */
  if (names.length >= 2 && new Set(names).size === names.length)
    ok('the two published copies\' cache names are distinct');
  else if (names.length < 2)
    bad('fewer than two caches exist, so distinctness is vacuous', names.join(', ') || '(none)');
  else bad('the two published copies COLLIDE on a cache name', names.join(', '));

  /* ---- invariant 7, in its own stated words, with two genuinely different builds ----
   * "Load the promoted copy after the test copy has been cached; find any asset
   * served from the other build." Both are cached above. Now cut the network and ask
   * each copy for its OWN index.html: each must get its own bytes. */
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));

  const offlineRoot = await context.newPage();
  const offlineStable = await context.newPage();
  let rootTitle = null, stableTitle = null, err = null;
  try {
    await offlineRoot.goto(`${ORIGIN}${BASE}index.html`, { waitUntil: 'load', timeout: 15000 });
    rootTitle = await offlineRoot.title();
    await offlineStable.goto(`${ORIGIN}${STABLE_BASE}index.html`, { waitUntil: 'load', timeout: 15000 });
    stableTitle = await offlineStable.title();
  } catch (e) { err = e.message.split('\n')[0]; }

  console.log(`  offline: root title=${JSON.stringify(rootTitle)}  stable title=${JSON.stringify(stableTitle)}`);
  if (rootTitle && stableTitle) ok('both copies load offline, each from its own worker');
  else bad('a copy failed to load offline — invariant 3', err || `root=${rootTitle} stable=${stableTitle}`);

  {
    /* Each copy carries its own marker, so a mixture is always detectable. */
    if (rootTitle && !rootTitle.includes('ROOTBUILD'))
      bad('the ROOT copy served the PROMOTED build\'s bytes offline — invariant 7', `title=${JSON.stringify(rootTitle)}`);
    else if (rootTitle) ok('the root copy served its own build offline');
    if (stableTitle && !stableTitle.includes('STABLEBUILD'))
      bad('THE PROMOTED COPY SERVED THE ROOT BUILD\'S BYTES OFFLINE — invariant 7 by its own stated test',
          `/stable/ returned ${JSON.stringify(stableTitle)}, which is the newer build`);
    else if (stableTitle) ok('the promoted copy served its own build offline, not the root\'s');
  }

  /* Read the end state from whichever page is still alive.
   *
   * A page whose offline navigation failed has had its execution context destroyed,
   * so evaluating in it throws. The first version of this check called keys() on the
   * root page unconditionally and CRASHED with a stack trace on precisely the input
   * this check exists to reject — a promoted copy carrying the origin-wide reaper,
   * whose reap had just emptied the root copy's cache so the root could not load.
   * The defect was found, and then reported as an uncaught exception instead of as a
   * finding. A check that dies on its own headline case is not reporting; it is
   * failing to. */
  let finalNames = null;
  for (const pg of [offlineRoot, offlineStable, rootPage, stablePage]) {
    try { finalNames = await keys(pg); break; } catch { /* context gone; try the next */ }
  }
  if (finalNames === null) {
    bad('could not read the origin\'s caches from ANY page at the end of the run',
        'every page\'s execution context was destroyed — typically because no copy could load offline at all');
  } else {
    console.log('  caches at end:', finalNames.join(', ') || '(none)');
    for (const n of names) {
      if (finalNames.includes(n)) ok(`cache survived the whole exercise: ${n}`);
      else bad('a cache was DELETED while both published workers ran', `${n} is gone — the reap crossed copies`);
    }
  }

  await context.close(); await browser.close();
} finally {
  await rm(work, { recursive: true, force: true });
}

if (fails.length) {
  console.error(`\nTWO-TREE CHECK FAILED — ${fails.length}:`);
  for (const f of fails) console.error(`  ${f.m}${f.d ? `\n    ${f.d}` : ''}`);
  console.error('\n  northstar invariant 7: a device serves exactly one build\'s assets, never a mixture.');
  process.exit(1);
}
console.log('\nTWO-TREE CHECK PASSED — two DIFFERENT published workers coexist on one origin:');
console.log('  distinct caches, neither reaps the other, and each serves its own build offline.');
