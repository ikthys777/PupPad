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
 * Both 1 and 2 shrink when PUP-WO-0600 vendors the CDN libraries. Do not
 * pre-empt that here.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

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
const launchOpts = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
if (process.env.PUPPAD_CHROMIUM) launchOpts.executablePath = process.env.PUPPAD_CHROMIUM;
else launchOpts.channel = 'chromium';
const browser = await chromium.launch(launchOpts);
const context = await browser.newContext();

const ownErrors = [];      // fails the check
const foreignBlocked = []; // expected, reported only
const warnings = [];
const foreignErrors = [];  // the CDN failures a naive check would go red on

const isOurs = (url) => !url || url.startsWith(ORIGIN);

// The browser requests /favicon.ico on its own initiative for every document.
// PupPad never references it, so its 404 is same-origin but is NOT "an error
// originating in PupPad's own code" — the criterion this check is specified on.
// Narrow by construction: this exact path only, and it is still reported.
const isBrowserInitiatedFavicon = (url) => url === `${ORIGIN}/favicon.ico`;
const ignored = [];

// Hermetic: nothing leaves the machine.
await context.route('**', (route) => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) return route.continue();
  foreignBlocked.push(url);
  return route.abort();
});

const page = await context.newPage();
page.on('pageerror', (err) => {
  ownErrors.push({ kind: 'uncaught exception', text: err.stack || String(err), where: 'page script' });
});
page.on('console', (msg) => {
  const loc = msg.location() || {};
  const where = loc.url ? `${loc.url}:${loc.lineNumber ?? '?'}` : '(inline)';
  if (msg.type() === 'error') {
    if (isBrowserInitiatedFavicon(loc.url)) ignored.push(`${where} ${msg.text()}`);
    else if (isOurs(loc.url)) ownErrors.push({ kind: 'console.error', text: msg.text(), where });
    else foreignErrors.push(`${where} ${msg.text()}`);   // blocked CDN loads: deterministic, ignored
  } else if (msg.type() === 'warning' && isOurs(loc.url)) {
    warnings.push(`${where} ${msg.text()}`);
  }
});
// Service worker script errors do not surface on the page.
context.on('serviceworker', (worker) => {
  console.log(`  service worker registered: ${worker.url()}`);
});

const resp = await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load', timeout: 30000 });
if (!resp || !resp.ok()) {
  console.error(`\nCHECK 4 FAILED — index.html did not load (HTTP ${resp ? resp.status() : 'no response'}).`);
  process.exit(1);
}

// Let deferred work run: SW registration, startPolling, orientation lock.
await page.waitForTimeout(SETTLE_MS);

// Evidence the HTTP requirement is real and the worker actually took.
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'none';
  return (reg.active && 'active') || (reg.installing && 'installing') || (reg.waiting && 'waiting') || 'registered';
});
const title = await page.title();

await context.close();
await browser.close();
server.close();

// ---------- report ----------
console.log(`  document title: ${JSON.stringify(title)}`);
console.log(`  service worker: ${swState}`);
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

if (swState !== 'active' && swState !== 'registered' && swState !== 'installing' && swState !== 'waiting') {
  console.error(`\nCHECK 4 FAILED — the service worker did not register (state: ${swState}).`);
  console.error('  index.html:1935 registers it; offline capability (northstar invariant 3) depends on it.');
  process.exit(1);
}
console.log(`\nCHECK 4 PASSED — console clean of same-origin errors; service worker ${swState}.`);
