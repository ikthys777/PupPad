#!/usr/bin/env node
/**
 * CHECK 4 — Headless load.
 * Serve the repo over HTTP, open it in Chromium, fail on a console error that
 * originates in PupPad's own code.
 *
 * HTTP, not file:// — a service worker will not register from a file:// origin,
 * and index.html:1935 registers one. A file:// run would silently skip the half
 * of the app this check most needs to exercise.
 *
 * THE DETERMINISM PROBLEM (work order §3.4), and how this answers it.
 * index.html:11-13 load Supabase and Leaflet from two third-party CDNs, and
 * index.html:1373 requests OpenStreetMap tiles. A naive "fail on any console
 * error" therefore goes red when a CDN is slow, rate-limits the runner, or is
 * briefly down — failures with nothing to do with the change under review. A
 * check that goes red at random gets muted, and a muted check is worse than no
 * check because it still looks like coverage (architecture §5).
 *
 * The mechanism: EVERY non-local request is aborted at the driver. The run is
 * hermetic — it touches no network at all, so the third-party outcome is
 * identical on every run rather than merely usually fine. What remains is judged
 * by origin:
 *
 *   page 'pageerror'            -> ALWAYS fails. An uncaught exception can only
 *                                  come from executed page script, and with the
 *                                  third parties blocked, the only script that
 *                                  executes is PupPad's own.
 *   console 'error', same-origin -> fails. Located in index.html or sw.js.
 *   console 'error', foreign url -> IGNORED and reported. This is the blocked
 *                                  CDN fetch, deterministic by construction.
 *
 * WHAT THIS CANNOT DISTINGUISH — stated rather than glossed:
 *   1. It exercises PupPad WITHOUT Leaflet and Supabase present. That is a real
 *      configuration (invariant 3 requires the app work with no network) but it
 *      is not the only one. A defect that appears only when Leaflet HAS loaded is
 *      invisible to this check.
 *   2. If PupPad's own code throws BECAUSE a third-party global is missing, this
 *      goes red and blames PupPad. That is the correct call under invariant 3 —
 *      the app must not throw when the network is absent — but the message will
 *      point at index.html rather than at the missing dependency.
 *   3. It cannot see anything that needs interaction. It loads the console; it
 *      does not press the buttons.
 *   4. It observes for SETTLE_MS (default 3000) after load, plus the controlled
 *      reload. An error thrown later — index.html:1931 starts a 3-second polling
 *      interval, so the second tick onward — is outside the window. No interaction
 *      is required to miss it, only patience, so this is a separate limit from 3.
 * Both 1 and 2 shrink when PUP-WO-0600 vendors the CDN libraries. Do not
 * pre-empt that here.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { attachServiceWorkerWatcher } from './lib/sw-cdp.mjs';

// Absolute: the containment guard below compares prefixes, and a relative root
// would reject every path.
const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const SETTLE_MS = Number(process.env.SETTLE_MS || 3000);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// ---------- static server ----------
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    // Contain the server to the repo: a traversal would make the check lie about
    // what it loaded.
    const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(full);
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      // A worker must be allowed to control the root scope.
      'Service-Worker-Allowed': '/',
    }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const ORIGIN = `http://127.0.0.1:${PORT}`;
console.log(`  serving ${REPO} at ${ORIGIN}`);

// ---------- browser ----------
// Browser selection. CI installs Playwright's pinned Chromium and uses it, so the
// version under test is pinned with the lockfile. PUPPAD_CHROMIUM overrides the
// executable for local runs on a machine that already has a Chromium — the check
// is about PupPad's console, not about which build renders it.
// FINDING 12: a FIXED debug port is a shared resource. Another Chromium — a
// concurrent run, an orphan from a timed-out run, a developer's browser — can
// answer on it, and the watcher would then observe a healthy worker in someone
// else's browser while the broken one under test went green. A random free port
// makes collision vanishingly unlikely; assertLiveAndOurs() makes it detectable.
const CDP_PORT = Number(process.env.CDP_PORT || 0) || await (async () => {
  const { createServer } = await import('node:net');
  return await new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
})();
const launchOpts = { args: ['--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${CDP_PORT}`] };
if (process.env.PUPPAD_CHROMIUM) launchOpts.executablePath = process.env.PUPPAD_CHROMIUM;
else launchOpts.channel = 'chromium';
const browser = await chromium.launch(launchOpts);
// Attach BEFORE any context exists, so the worker target cannot be created and run
// its first evaluation before the watcher is listening.
const context = await browser.newContext();

const ownErrors = [];      // fails the check
const foreignBlocked = []; // expected, reported only
const warnings = [];
const foreignErrors = [];  // the CDN failures a naive check would go red on

// A blob: URL minted by our own page is `blob:http://127.0.0.1:PORT/...`, so a
// bare startsWith(ORIGIN) calls PupPad's own code foreign. Same for data:.
const isOurs = (url) =>
  !url || url.startsWith(ORIGIN) || url.startsWith(`blob:${ORIGIN}`) || url.startsWith('data:');

// The browser requests /favicon.ico on its own initiative for every document.
// PupPad never references it, so its 404 is same-origin but is NOT "an error
// originating in PupPad's own code" — the criterion this check is specified on.
// Narrow by construction: this exact path only, and it is still reported.
// Only browser-initiated if the document never asks for it. If PupPad ever adds
// <link rel="icon">, a missing favicon becomes a genuine uncached local asset and
// must NOT be excused — so this is recomputed from the document, not hardcoded.
let documentRequestsFavicon = false;
const isBrowserInitiatedFavicon = (url) =>
  !documentRequestsFavicon && url === `${ORIGIN}/favicon.ico`;
const ignored = [];

// Hermetic: nothing leaves the machine.
await context.route('**', (route) => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) return route.continue();
  foreignBlocked.push(url);
  return route.abort();
});

// Listeners go on the CONTEXT, not the page. A page-level listener sees only the
// document's own output; sw.js runs in a service worker and its console output
// and uncaught exceptions never reach the page. Since sw.js is one of exactly two
// code files here and is the mechanism behind northstar invariant 3, a page-only
// listener leaves half the repository unwatched.
const seen = new Set();
function record(bucket, entry) {
  const key = `${entry.kind}|${entry.where}|${entry.text}`;
  if (seen.has(key)) return;          // context and page listeners can both fire
  seen.add(key);
  bucket.push(entry);
}

let swWatcher = null;
try {
  // ownErrors/record are declared above this point on purpose: an error arriving
  // during the attach would otherwise hit the temporal dead zone and throw a
  // ReferenceError inside the socket handler (finding 18).
  swWatcher = await attachServiceWorkerWatcher(CDP_PORT, {
    onError: (e) => record(ownErrors, e),
    originPrefix: ORIGIN,
  });
} catch (e) {
  console.error(`\nCHECK 4 FAILED — could not attach the service-worker watcher: ${e.message}`);
  console.error('  sw.js runtime coverage is not optional (PUP-WO-0102 §1.5). Failing rather than');
  console.error('  silently reverting to the blind behaviour PUP-WO-0100 shipped.');
  process.exit(1);
}

function onConsole(msg) {
  const loc = msg.location() || {};
  const where = loc.url ? `${loc.url}:${loc.lineNumber ?? '?'}` : '(inline)';
  const fromWorker = /\/sw\.js(\?|$)/.test(loc.url || '');
  if (msg.type() === 'error') {
    if (isBrowserInitiatedFavicon(loc.url)) { if (!seen.has('fav')) { seen.add('fav'); ignored.push(`${where} ${msg.text()}`); } }
    else if (isOurs(loc.url)) record(ownErrors, { kind: fromWorker ? 'service worker console.error' : 'console.error', text: msg.text(), where });
    else if (!seen.has('f|' + where + msg.text())) { seen.add('f|' + where + msg.text()); foreignErrors.push(`${where} ${msg.text()}`); }
  } else if (msg.type() === 'warning' && isOurs(loc.url)) {
    warnings.push(`${where} ${msg.text()}`);
  }
}
context.on('console', onConsole);
context.on('weberror', (webErr) => {
  const err = webErr.error?.() ?? webErr;
  record(ownErrors, { kind: 'uncaught exception', text: err?.stack || String(err), where: 'page or worker script' });
});

const page = await context.newPage();
page.on('pageerror', (err) => {
  record(ownErrors, { kind: 'uncaught exception', text: err.stack || String(err), where: 'page script' });
});
page.on('console', onConsole);
// SERVICE WORKER OBSERVABILITY — closed by PUP-WO-0102 (raised as F16 against
// PUP-WO-0101, whose sw.js half this work order carries forward).
// sw.js is one of exactly two code files here and is the mechanism behind northstar
// invariant 3. Playwright 1.56.1 cannot observe it — worker.on('console') is not an
// API, context.on('console'|'weberror') delivers page output only, and
// CDPSession.send takes no sessionId so browser-level auto-attach cannot be ROUTED
// to the worker session. This check therefore drives a RAW CDP socket alongside
// Playwright (lib/sw-cdp.mjs), which can carry a sessionId. A console.error or an
// uncaught exception inside sw.js now fails this check — including the throwing
// fetch handler that stayed green under PUP-WO-0100.
context.on('serviceworker', (worker) => {
  console.log(`  service worker registered: ${worker.url()}`);
});

const resp = await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load', timeout: 30000 });
if (!resp || !resp.ok()) {
  console.error(`\nCHECK 4 FAILED — index.html did not load (HTTP ${resp ? resp.status() : 'no response'}).`);
  process.exit(1);
}

// Does the document itself ask for a favicon? Decides whether a favicon 404 is
// the browser's own probe or a real missing asset (see isBrowserInitiatedFavicon).
documentRequestsFavicon = await page.evaluate(() =>
  !!document.querySelector('link[rel~="icon"], link[rel~="shortcut"]'));

// Let deferred work run: SW registration, startPolling, orientation lock.
await page.waitForTimeout(SETTLE_MS);

// Reload once so the page ends up CONTROLLED by the worker. On first load it is
// not (sw.js registers at index.html:1935, after the document is parsed), so this
// asserts a strictly stronger property than "a worker registered": that a worker
// actually takes control and serves a navigation — the state Buddy's tablet is in
// on every launch after the first.
//
// MEASURED LIMIT, so this is not mistaken for fetch-handler coverage: it does NOT
// catch a defective fetch handler. A handler that throws falls back to the network
// and the page loads fine; a handler returning a broken response is not caught
// either, because the reload is served by the already-controlling worker rather
// than the newly-installed one. Both were tested and both stayed green. What this
// does catch is a worker that never reaches control at all.
if (await page.evaluate(() => !!navigator.serviceWorker?.controller) === false) {
  const reloaded = await page.reload({ waitUntil: 'load', timeout: 30000 });
  if (!reloaded || !reloaded.ok()) {
    console.error(`\nCHECK 4 FAILED — reload under service-worker control failed (HTTP ${reloaded ? reloaded.status() : 'none'}).`);
    console.error('  The worker was active, so its fetch handler (sw.js:31-43) served this. That is the');
    console.error('  path every launch after the first takes — northstar invariant 3.');
    process.exit(1);
  }
  await page.waitForTimeout(1000);
}
const controlled = await page.evaluate(() => !!navigator.serviceWorker?.controller);

// Evidence the HTTP requirement is real and the worker actually took.
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'none';
  return (reg.active && 'active') || (reg.installing && 'installing') || (reg.waiting && 'waiting') || 'registered';
});
const title = await page.title();

// The worker's fetch handler runs on the reload; let its errors arrive over CDP
// before the socket is torn down.
await page.waitForTimeout(500);
if (swWatcher.sessionCount() === 0) {
  console.error('\nCHECK 4 FAILED — no service-worker CDP session attached, so sw.js ran unwatched.');
  console.error('  Green here would mean "nothing was looking", which is the gap this closes.');
  swWatcher.close(); await context.close(); await browser.close(); server.close();
  process.exit(1);
}
try {
  await swWatcher.assertLiveAndOurs();
  console.log(`  worker observation verified live at end of run: ${swWatcher.workerUrls().join(', ')}`);
} catch (e) {
  console.error(`\nCHECK 4 FAILED — service-worker observation was not trustworthy: ${e.message}`);
  console.error('  A session count proves an attach happened, not that anything was still watching');
  console.error('  the browser under test. Failing rather than reporting a green nobody was looking at.');
  swWatcher.close(); await context.close(); await browser.close(); server.close();
  process.exit(1);
}
swWatcher.close();
await context.close();
await browser.close();
server.close();

// ---------- report ----------
console.log(`  document title: ${JSON.stringify(title)}`);
console.log(`  service worker: ${swState}; page controlled by it after reload: ${controlled}`);
console.log(`  service worker CDP sessions watched: ${swWatcher.sessionCount()}`);
console.log(`  third-party requests blocked (expected, not failures): ${foreignBlocked.length}`);
for (const u of [...new Set(foreignBlocked)].slice(0, 10)) console.log(`    blocked  ${u}`);
console.log(`  third-party console errors IGNORED (a naive check would go red on these): ${foreignErrors.length}`);
for (const e of foreignErrors.slice(0, 5)) console.log(`    ignored  ${e}`);
if (ignored.length) {
  console.log(`  same-origin but browser-initiated, not failures: ${ignored.length}`);
  for (const i of ignored) console.log(`    ignored  ${i}`);
}
if (warnings.length) {
  console.log(`  same-origin warnings (not failures): ${warnings.length}`);
  for (const w of warnings.slice(0, 5)) console.log(`    warn  ${w}`);
}

if (ownErrors.length) {
  console.error(`\nCHECK 4 FAILED — ${ownErrors.length} error(s) originating in PupPad's own code:\n`);
  for (const e of ownErrors) console.error(`  [${e.kind}] ${e.where}\n    ${e.text.split('\n').slice(0, 6).join('\n    ')}\n`);
  console.error('  Third-party origins were blocked for the whole run, so none of these are CDN flakiness.');
  process.exit(1);
}

/* FINDING 14. This previously accepted `installing` and `waiting` as a pass, so a
 * worker whose install hangs — `event.waitUntil(new Promise(function(){}))`, which
 * throws nothing — went GREEN with offline capability dead. And `controlled` was
 * computed, printed, and never asserted, while PUP-WO-0100's F16 claimed the page
 * was "verified to end up controlled". Both are assertions now. */
if (swState !== 'active') {
  console.error(`\nCHECK 4 FAILED — the service worker never reached "active" (state: ${swState}).`);
  console.error('  A worker stuck installing or waiting throws nothing and serves nothing.');
  console.error('  index.html:1935 registers it; offline capability (northstar invariant 3) depends on it.');
  process.exit(1);
}
if (!controlled) {
  console.error('\nCHECK 4 FAILED — the worker is active but does not CONTROL the page.');
  console.error('  An uncontrolled page is served entirely from the network, so nothing this');
  console.error('  worker caches is ever used — invariant 3 fails silently.');
  process.exit(1);
}
console.log(`\nCHECK 4 PASSED — console clean of same-origin errors; service worker ${swState}.`);
