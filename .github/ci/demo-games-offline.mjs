#!/usr/bin/env node
/**
 * CHECK 14 — the games surface opens COLD with no network, and the child gets back.
 *
 * PUP-WO-0200 acceptance §3.5: "Cold start, airplane mode: console → games →
 * placeholder → back to console." Roadmap P2 gate 4 is the same property, and it
 * falsifies northstar invariant 3 — every core surface works with no network.
 *
 * THIS IS THE CHECK THAT JUSTIFIES THE ONE LINE ADDED TO sw.js. CC-A authorised
 * exactly one `urlsToCache` entry for the placeholder module and refused the
 * CACHE_VERSION bump. Without that entry the module is absent from a cold install and
 * this check goes red — so the line is not taken on trust, it is the thing under test.
 * If a future edit drops it, this fails rather than the tablet failing.
 *
 * REAL OFFLINE MEANS CLOSING THE LISTENER — PUP-WO-0105's measured finding, and the
 * reason this file does not use `context.setOffline(true)`: that does not stop a
 * service worker's fetch to loopback, and a check built on it would pass while the
 * worker quietly served from the network. So the server is closed AND its keep-alive
 * sockets destroyed, and only then is the cold page opened.
 *
 * COLD means a NEW CONTEXT after the worker precached: a fresh page with no memory
 * cache, reaching a dead origin, served entirely by the service worker.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));

/* Architecture §5: a demonstration asserts the COMMIT that ran, never the conclusion
 * alone. A green with no subject is a claim about a tree nobody can identify. */
let COMMIT = 'unknown';
try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
console.log(`CHECK 14 — games offline, cold. subject ${COMMIT.slice(0, 12)}\n`);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const sockets = new Set();
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Service-Worker-Allowed': '/',
    }).end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext();

try {
  /* ---- 1. warm: let the worker install and precache ---- */
  const warm = await ctx.newPage();
  await warm.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  await warm.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active);
  }, { timeout: 20000 });
  /* The precache is what the added urlsToCache line lands in. Assert it is THERE
   * before going offline, so a failure below cannot be blamed on the wrong step. */
  const cached = await warm.evaluate(async () => {
    const names = await caches.keys();
    for (const n of names) {
      const keys = await (await caches.open(n)).keys();
      const urls = keys.map((k) => k.url);
      if (urls.some((u) => u.endsWith('/games/hello.js'))) return { name: n, count: urls.length };
    }
    return null;
  });
  if (cached) ok(`the worker precached games/hello.js (cache ${cached.name}, ${cached.count} entries)`);
  else bad('games/hello.js is NOT in any cache after install',
    'the urlsToCache line is missing or install failed — a cold device has no module');
  await warm.close();

  /* ---- 2. AIRPLANE MODE: kill the listener and every keep-alive socket ---- */
  await new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });
  ok('origin is gone — listener closed and keep-alive sockets destroyed');

  /* Prove the origin really is unreachable, so a pass below cannot be a live fetch. */
  const probe = await ctx.newPage();
  const reachable = await probe.evaluate(async (o) => {
    try { const r = await fetch(o + '/__probe__', { cache: 'no-store' }); return r.status; }
    catch { return 'unreachable'; }
  }, ORIGIN).catch(() => 'unreachable');
  await probe.close();
  if (reachable === 'unreachable') ok('a direct fetch to the origin now fails — offline is real');
  else bad(`the origin still answers (${reachable}) — this check would prove nothing`, 'offline was not achieved');

  /* ---- 3. COLD START in a fresh page ---- */
  const cold = await ctx.newPage();
  const consoleErrors = [];
  cold.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await cold.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await cold.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 })
    .then(() => ok('console rendered offline, and the Games button is there'))
    .catch(() => bad('the console did not render offline', 'the shell itself is not available cold'));

  /* ---- 4. console -> games -> placeholder ---- */
  await cold.click('.pad-btn[data-id="7"]');
  const mounted = await cold.waitForFunction(() => {
    const h = document.getElementById('gameHost');
    return !!(h && h.textContent && h.textContent.trim().length > 0);
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  if (mounted) ok('the placeholder MOUNTED offline — served from the precache');
  else bad('the placeholder did not mount offline',
    'the module was not available with no network: check the urlsToCache line');

  const back = await cold.evaluate(() => {
    const b = document.getElementById('gameBack');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (back && back.w >= 44 && back.h >= 44) ok(`the way back is present and ${back.w}x${back.h} — a thumb target`);
  else bad('no usable way back on the offline surface', JSON.stringify(back));

  /* ---- 5. back to console ---- */
  await cold.click('#gameBack');
  const returned = await cold.waitForFunction(() => !document.getElementById('gamesChrome')
    && !!document.querySelector('.pad-btn[data-id="7"]'), { timeout: 5000 })
    .then(() => true).catch(() => false);
  if (returned) ok('back returned to the console, offline');
  else bad('back did not return to the console offline');

  /* Third-party CDN failures are EXPECTED offline and are not this check's business —
   * they are the tiles/leaflet question, which has no work order. Only same-origin
   * errors indicate the shell itself broke. */
  const sameOrigin = consoleErrors.filter((t) => t.includes('127.0.0.1') && !t.includes('__probe__'));
  if (sameOrigin.length === 0) ok('no same-origin console errors during the offline run');
  else bad(`${sameOrigin.length} same-origin console error(s) offline`, sameOrigin.slice(0, 3).join('\n        '));
} finally {
  await browser.close();
  try { await new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); }); } catch {}
}

console.log('\n' + '='.repeat(78));
if (failures.length) {
  console.error(`::error::CHECK 14 FAILED — ${failures.length} — the games surface is not usable with no network.`);
  console.error(`\nCHECK 14 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.d || ''}`);
  console.error('\n  northstar invariant 3: every core surface works with no network.');
  console.error('  If games/hello.js is missing from the precache, the one urlsToCache line');
  console.error('  PUP-WO-0200 added to sw.js has been dropped. Restore it; do NOT bump');
  console.error('  CACHE_VERSION to force it (PUP-WO-0105 measured 24/24 map tiles before a');
  console.error('  bump and 0/24 after).');
  process.exit(1);
}
console.log(`CHECK 14 PASSED at ${COMMIT.slice(0, 12)} — cold start, no network:`);
console.log('  console rendered → Games opened → the placeholder mounted from the precache');
console.log('  → the way back was a thumb-sized target → back returned to the console.');
console.log('  Offline is real here: the listener was closed and its keep-alive sockets');
console.log('  destroyed, and a direct fetch to the origin was confirmed to fail first —');
console.log('  context.setOffline() does not stop a service worker (PUP-WO-0105).');
