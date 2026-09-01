#!/usr/bin/env node
/**
 * DEMONSTRATION — can the fix ARRIVE? PUP-WO-0105 §0a, acceptance 7.
 *
 * check-error-caching.mjs asserts this class in a Node sandbox, which is fast and
 * mutation-testable. It cannot see the one thing that actually decides whether a
 * child's tablet gets the fix: THE SERVICE WORKER LIFECYCLE. `installed` means the
 * update arrived; `redundant` means it was discarded and the OLD worker is still
 * serving. That transition only exists in a browser, so this runs there.
 *
 * TWO SCENARIOS IN ONE RUN, AND NEITHER IS SUFFICIENT ALONE:
 *   A. SQUEEZED — origin quota capped over CDP and filled, shell poisoned by the
 *      unguarded worker. The guarded worker must reach `activated` and repair the
 *      shell. Before round 3 it reached `redundant` and the shell stayed poisoned.
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
     * precache cannot fit until the reclaim frees those entries. Capping before the
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

/* ---- A. squeezed device: the update must still arrive ---- */
/* The PREDECESSOR is this same worker with a comment appended: byte-different, so
 * the browser genuinely offers an update, and behaviourally identical, so nothing in
 * the result depends on which worker preceded it. An explicit third argument still
 * overrides it, which is how the red-first demonstration against the un-reclaiming
 * install is driven. */
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
  say(false, 'A: NO UPDATE OCCURRED — this scenario tested nothing',
      'the browser saw no new worker, so "did not go redundant" is vacuously true');
} else {
  say(!a.life.seen.some((x) => x.endsWith(':redundant')),
      'A: a squeezed device installs the update — the worker did not go redundant',
      'redundant means the update was discarded and the OLD unguarded worker still serves');
  /* `reg.active.state === 'activated'` is TRUE OF THE OLD WORKER TOO — it printed ok
   * in the red run, where the update had been discarded and the old worker was still
   * serving. The property needed is that THE NEW worker activated, which is the
   * statechange the update itself emitted. Asserting the state of "whatever is
   * active" cannot distinguish the fix arriving from the fix being discarded. */
  say(a.life.seen.includes('statechange:activated'),
      'A: the NEW worker reached activated (not merely: some worker is active)',
      `lifecycle was ${JSON.stringify(a.life.seen)}`);
  say(a.shell.status === 200 && a.shell.isApp === true,
      'A: the poisoned shell was repaired on a squeezed device', `got ${JSON.stringify(a.shell)}`);
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
console.log('\nDEMO GREEN — the fix arrives on a squeezed device, and a bad deploy still fails loudly.');
