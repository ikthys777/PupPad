#!/usr/bin/env node
/**
 * CHARACTERISATION — can the fix ARRIVE? It cannot. PUP-WO-0108.
 *
 * THIS NO LONGER DEMONSTRATES A FIX; IT REPRODUCES AN OPEN DEFECT, which is why it is
 * kept. Round 3 built an install-path fix and it was REVERTED: the reclaim was total
 * rather than sufficient (~18.8 MB deleted to write a ~200 KB precache, taking leaflet
 * and supabase with it), and resolving on a second quota failure let the worker
 * ACTIVATE over an unprovisioned cache — at which point the activate handler's legacy
 * deletion removed the device's last good shell. Measured `shell NULL`, against a
 * working app under both predecessors.
 *
 * Scenario A therefore CHARACTERISES and does not assert: it prints what a squeezed
 * device actually does, so PUP-WO-0108 inherits a working reproduction instead of
 * rebuilding one. What it DOES assert is the harm boundary — the device must never be
 * left with an activated worker and no app shell. Failing to install is a reach
 * limitation and is tolerated; activating over nothing is a harm and is not.
 *
 * check-error-caching.mjs asserts this class in a Node sandbox, which is fast and
 * mutation-testable. It cannot see the one thing that actually decides whether a
 * child's tablet gets the fix: THE SERVICE WORKER LIFECYCLE. `installed` means the
 * update arrived; `redundant` means it was discarded and the OLD worker is still
 * serving. That transition only exists in a browser, so this runs there.
 *
 * TWO SCENARIOS IN ONE RUN, AND NEITHER IS SUFFICIENT ALONE:
 *   A. SQUEEZED — origin quota capped over CDP and filled, shell poisoned. The worker
 *      reaches `redundant` and the shell stays poisoned: THE FIX DOES NOT ARRIVE, and
 *      that is the open defect PUP-WO-0108 owns. Printed, not asserted.
 *   B. BAD DEPLOY — a 404 on a urlsToCache entry, quota fine. Install MUST fail and
 *      the old worker MUST keep control. A blanket `.catch(){}` passes A and fails
 *      B, which is why B is here: it is the assertion that stops the easy wrong fix.
 *
 * Usage: node demo-quota-install.mjs <dir with sw.js> [<dir with the OLD sw.js>]
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const NEW_DIR = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const BASE = '/PupPad/';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.png':'image/png', '.css':'text/css' };
const blob = (p) => { try { return execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim(); }
                      catch { return '(git unavailable)'; } };

let swSource = join(NEW_DIR, 'sw.js');   // swapped at runtime to simulate a deploy
let poison = false, breakPrecache = false;
const sockets = new Set();
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (!p.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let rel = p.slice(BASE.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  if (breakPrecache && rel === 'icon-512.png') { res.writeHead(404).end('gone'); return; }
  if (poison && rel === 'index.html') {
    res.writeHead(404, {'content-type':'text/html'}).end('<!DOCTYPE html><title>SITE-NOT-FOUND</title>');
    return;
  }
  if (rel === 'sw.js') {
    res.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});
    res.end(await readFile(swSource)); return;
  }
  if (rel.startsWith('pad/')) { res.writeHead(200,{'content-type':'image/png'}).end(Buffer.alloc(256*1024,9)); return; }
  try { const b = await readFile(join(NEW_DIR, rel));
        res.writeHead(200, {'content-type': MIME[extname(rel)] || 'application/octet-stream'}); res.end(b); }
  catch { res.writeHead(404).end(); }
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
const port = await new Promise((r) => server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const ORIGIN = `http://127.0.0.1:${port}`;
const SHELL = ORIGIN + BASE + 'index.html';

const opts = { args:['--no-sandbox','--disable-dev-shm-usage'] };
if (process.env.PUPPAD_CHROMIUM) opts.executablePath = process.env.PUPPAD_CHROMIUM; else opts.channel = 'chromium';
const browser = await chromium.launch(opts);
const problems = [];
const say = (ok, m, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${m}${d ? `\n          ${d}` : ''}`);
                            if (!ok) problems.push(m); };

async function scenario({ label, oldSw, newSw, squeeze, breakIt }) {
  swSource = oldSw;                       // the device is running the OLD worker
  breakPrecache = false; poison = false;
  const ctx = await browser.newContext();
  await ctx.route('**/*', (r) => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.goto(ORIGIN + BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await ctx.newCDPSession(page);

  let filled = null;
  if (squeeze) {
    /* runtime entries first, THEN cap the quota just above what is now used, so the
     * precache cannot fit. (Round 3 reclaimed here to make room; that was reverted, so
     * today the install simply fails.) Capping before the
     * app is cached squeezes the wrong thing and the scenario tests nothing. */
    filled = await page.evaluate(async ({ o }) => {
      const c = await caches.open('runtime-pad'); let n = 0;
      try { for (; n < 12; n++) await c.put(o + '/PupPad/pad/' + n + '.png', await fetch(o + '/PupPad/pad/' + n + '.png')); }
      catch (e) { return { n, stoppedBy: e.name }; }
      return { n, stoppedBy: null };
    }, { o: ORIGIN });
    const est = await page.evaluate(() => navigator.storage.estimate());
    await cdp.send('Storage.overrideQuotaForOrigin', { origin: ORIGIN, quotaSize: est.usage + 8 * 1024 });
    console.log(`  [${label}] seeded ${filled.n} runtime entries, quota capped at usage+8KB (usage ${est.usage})`);
    /* Poison the cache DIRECTLY instead of routing a 404 through an unguarded
     * predecessor. The earlier version needed origin/main's worker to do the
     * poisoning — a premise that EVAPORATES the moment this fix merges, at which
     * point the demo would have silently tested nothing. The property under test is
     * "a squeezed device with a poisoned shell receives the update and repairs it",
     * and how the entry got poisoned is not part of it. */
    await page.evaluate(async (u) => {
      const n = (await caches.keys()).find((k) => k.startsWith('puppad|'));
      const c = await caches.open(n);
      await c.put(u, new Response('<!DOCTYPE html><title>SITE-NOT-FOUND</title>', { status: 404 }));
    }, SHELL);
  }

  swSource = newSw;                        // the deploy
  breakPrecache = !!breakIt;
  const life = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const seen = [];
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      seen.push('updatefound:' + w.state);
      w.addEventListener('statechange', () => seen.push('statechange:' + w.state));
    });
    try { await reg.update(); } catch (e) { seen.push('update-threw:' + e.name); }
    await new Promise((r) => setTimeout(r, 3000));
    return { seen, active: reg.active && reg.active.state,
             activeUrlLen: reg.active ? reg.active.scriptURL.length : 0 };
  });
  breakPrecache = false;

  const shell = await page.evaluate(async (u) => {
    const n = (await caches.keys()).find((k) => k.startsWith('puppad|'));
    if (!n) return { noCache: true };
    const h = await (await caches.open(n)).match(u);
    if (!h) return { missing: true };
    const t = await h.clone().text();
    return { status: h.status, isApp: t.includes('<title>Pup Pad</title>') };
  }, SHELL);
  await ctx.close();
  return { life, shell, filled };
}

console.log(`demo-quota-install`);
console.log(`  NEW sw.js blob : ${blob(join(NEW_DIR,'sw.js'))}`);
console.log(`  origin         : ${ORIGIN}${BASE}\n`);

/* ---- A. squeezed device: CHARACTERISE what happens; assert only the harm ---- */
/* The PREDECESSOR is this same worker with a comment appended: byte-different, so
 * the browser genuinely offers an update, and behaviourally identical, so nothing in
 * the result depends on which worker preceded it. An explicit third argument still
 * overrides it — kept because PUP-WO-0108 will need to drive a DIFFERENT predecessor
 * to exercise the harm this file cannot currently construct. ci.yml passes one
 * argument, so the override is unused by the gate. */
const NEWSW = join(NEW_DIR, 'sw.js');
let OLDSW;
if (process.argv[3] && resolve(process.argv[3]) !== NEW_DIR) {
  OLDSW = join(resolve(process.argv[3]), 'sw.js');
} else {
  const tmp = await mkdtemp(join(tmpdir(), 'puppad-prev-'));
  OLDSW = join(tmp, 'sw.js');
  await writeFile(OLDSW, (await readFile(NEWSW, 'utf8')) + '\n/* predecessor build */\n');
}
console.log(`  OLD sw.js blob : ${blob(OLDSW)}\n`);

const a = await scenario({ label:'A', oldSw: OLDSW, newSw: NEWSW, squeeze: true });
console.log(`  [A] lifecycle ${JSON.stringify(a.life.seen)}  active=${a.life.active}`);
console.log(`  [A] shell     ${JSON.stringify(a.shell)}`);
/* POSITIVE CONTROL FIRST. An empty lifecycle means no update was ever offered, and
 * every assertion below is then satisfied by nothing having happened — which is what
 * the first version of this demo did: three `ok`s over `lifecycle []`. */
if (a.life.seen.length === 0) {
  say(false, 'A: NO UPDATE OCCURRED — this scenario characterised nothing',
      'the browser saw no new worker, so nothing below describes a squeezed install');
} else {
  const arrived = a.life.seen.includes('statechange:activated');
  console.log(`  CHARACTERISED: on a squeezed device the update ${arrived ? 'ARRIVES' : 'DOES NOT ARRIVE'}` +
              ` — lifecycle ${JSON.stringify(a.life.seen)}`);
  console.log(`  CHARACTERISED: the shell afterwards is ${JSON.stringify(a.shell)}.` +
              ' PUP-WO-0108 is where this becomes an assertion.');
  /* THE HARM BOUNDARY, AND THIS IS ASSERTED. A worker that activates while the device
   * holds no app shell is worse than one that never installs: the reach limitation
   * leaves the child a working offline app; this leaves nothing. It is the state the
   * reverted round-3 fix produced, so it is the one thing that must stay impossible. */
  const activatedWithNoShell = arrived && !(a.shell.status === 200 && a.shell.isApp === true);
  /* WHAT THIS CANNOT PRODUCE, so the ok is never read as coverage — and the reason is
   * the MEASURED one, not the one first written here. An earlier version said the harm
   * needs a legacy cache holding the only good shell. True, but the simpler fact is
   * that in this fixture the squeeze poisons THE SAME CACHE the new worker precaches
   * into, so any worker that reclaims repairs it. Measured reach of this assertion:
   *   reverted worker  arrived=false            -> ok, antecedent false, VACUOUS
   *   origin/main      arrived=false            -> ok, VACUOUS
   *   the round-3 fix  arrived=true, shell 200  -> ok  (it does NOT catch that)
   *   blanket .catch() arrived=true, shell 404  -> FAIL
   * So it discriminates the blanket-catch class ONLY. PUP-WO-0108 inherits the true
   * reach, not an overstatement of it. */
  say(!activatedWithNoShell,
      'A: the device is never left with an activated worker and no app shell',
      `lifecycle ${JSON.stringify(a.life.seen)} but shell ${JSON.stringify(a.shell)}`);
}

/* ---- B. bad deploy: install must still fail loudly ---- */
const b = await scenario({ label:'B', oldSw: OLDSW, newSw: NEWSW, breakIt: true });
console.log(`  [B] lifecycle ${JSON.stringify(b.life.seen)}  active=${b.life.active}`);
if (b.life.seen.length === 0) {
  say(false, 'B: NO UPDATE OCCURRED — this scenario tested nothing',
      'no new worker was offered, so "install failed" cannot be distinguished from "nothing tried"');
} else {
  say(b.life.seen.some((x) => x.endsWith(':redundant')),
      'B: a 404 on a precached URL still discards the new worker — install fails loudly',
      `a blanket catch would activate over an unprovisioned cache; got ${JSON.stringify(b.life.seen)}`);
  say(b.life.active === 'activated' && !b.life.seen.includes('statechange:activated'),
      'B: the OLD worker keeps control and the new one never activated',
      `active=${b.life.active} lifecycle=${JSON.stringify(b.life.seen)}`);
}

await browser.close(); server.close(); for (const s of sockets) s.destroy();
if (problems.length) { console.error(`\nDEMO RED — ${problems.length}:`); for (const p of problems) console.error('  ' + p); process.exit(1); }
console.log('\nDEMO GREEN — a bad deploy still fails loudly and no device is left with a worker\n              but no shell. The squeezed case is CHARACTERISED above, not asserted: the fix\n              does not arrive there, and that is PUP-WO-0108.');
