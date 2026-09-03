#!/usr/bin/env node
/**
 * CHECK 24 — the inbound gate.  PUP-WO-0701 §S.2/§S.3/§S.4.
 *
 * A broadcast payload is the only byte this app accepts that the device did not create.
 * PUP-WO-0700 closed the MARKUP sink — assigned, never concatenated — WHICH CLOSES
 * INJECTION AND NOTHING ELSE. Assignment still FETCHES: a payload naming an attacker's
 * origin makes the child's device request it, and northstar invariant 3 breaks with no
 * script running at all.
 *
 * THE ASSERTION IS THE NETWORK, NOT THE REGEX. A check that fed strings to
 * `safeMediaUrl` and compared return values would be grading the validator against
 * itself. This one routes a hostile payload through the REAL receive path and asserts
 * THE BROWSER MADE NO REQUEST — the property the invariant is about.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) { console.error('::error::CHECK 24 cannot identify the commit it is testing.'); process.exit(1); }
console.log(`CHECK 24 — the inbound gate. subject ${COMMIT.slice(0, 12)}\n`);

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
/* Every request this server sees is recorded. The beacon is a request that should never
 * be made, so the evidence is the log. */
const hits = [];
const server = createServer(async (req, res) => {
  hits.push(req.url);
  if (req.url.startsWith('/__beacon')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(Buffer.alloc(8)); return; }
  try {
    const u = new URL(req.url, 'http://x');
    const f = join(REPO, u.pathname === '/' ? '/index.html' : u.pathname);
    const b = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
}).listen(0);
await new Promise((r) => server.once('listening', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 869, height: 412 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
try {
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await page.waitForTimeout(200);

  const present = await page.evaluate(() => typeof window.safeMediaUrl === 'function' || typeof safeMediaUrl === 'function');
  if (!present) { bad('there is no inbound gate at all', 'safeMediaUrl is not defined'); }
  else {
    /* 1. THE BEACON. A hostile payload driven through the real sink. */
    const before = hits.length;
    const beacon = `${ORIGIN}/__beacon?id=1`;
    await page.evaluate((b) => {
      const url = safeMediaUrl(b, 'image');
      if (url) showRemotePhoto(url);
    }, beacon);
    await page.waitForTimeout(600);
    const fetched = hits.slice(before).filter((h) => h.startsWith('/__beacon'));
    if (fetched.length) bad(`the child's device fetched an attacker-named origin (${fetched.length} request(s))`,
      'no script ran and nothing was stolen — and invariant 3 is broken anyway, because a core surface reached the network');
    else ok('a payload naming a remote origin causes NO network request — the sink refused it');

    /* 2. AND THE GATE MUST STILL PASS REAL MEDIA, or it is a feature that was removed. */
    const good = await page.evaluate(() => {
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
      const wav = 'data:audio/wav;base64,UklGRiQAAABXQVZF';
      return { img: safeMediaUrl(png, 'image') === png, aud: safeMediaUrl(wav, 'audio') === wav,
        crossed: safeMediaUrl(png, 'audio') === '' };
    });
    if (!good.img || !good.aud) bad('the gate rejects legitimate media — the feature is disabled, not secured',
      `image ${good.img}, audio ${good.aud}`);
    else if (!good.crossed) bad('the gate accepts an image where audio is expected — the kind is not enforced');
    else ok('a real data:image and data:audio pass, and an image offered as audio is refused');

    /* 3. THE RECEIVING HALF OF THE BOUND. */
    const capped = await page.evaluate(() => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024);
      return safeMediaUrl(huge, 'image') === '';
    });
    if (!capped) bad('an oversized inbound payload is accepted', 'the designed bound is recorder-side only — it bounds what this device SENDS, not what it ACCEPTS');
    else ok('an oversized inbound payload is refused — the bound has its receiving half');

    /* 4. THE GALLERY IS BOUNDED, and evicts the OLDEST. */
    const cap = await page.evaluate(() => {
      if (typeof galleryPush !== 'function') return null;
      cameraGallery = [];
      for (let i = 0; i < 200; i++) galleryPush('u' + i);
      return { len: cameraGallery.length, max: typeof GALLERY_MAX === 'number' ? GALLERY_MAX : -1, first: cameraGallery[0], last: cameraGallery[cameraGallery.length - 1] };
    });
    if (!cap) bad('there is no galleryPush — the two push sites can still drift apart');
    else if (cap.len > cap.max) bad(`the gallery grew to ${cap.len} against a cap of ${cap.max}`);
    else if (cap.first === 'u0') bad('the gallery is capped but evicts the NEWEST', 'oldest-evicted is the ruling; this keeps the first 24 forever');
    else ok(`the gallery is bounded at ${cap.len} and evicts the oldest (holds ${cap.first}..${cap.last})`);
  }

  /* 5. THE RECEIVER DIES WITH THE PANEL — ALL THREE PANELS, AND BY EFFECT.
   *
   * THIS ASSERTION WAS A FALSE GREEN AND IT WAS DEMONSTRATED, NOT SUSPECTED. It read
   * `String(closeCamera)` for /removeChannel|unsubscribe/ — and `closeCamera` carries a
   * long comment that NAMES BOTH WORDS while describing the bug it fixed. Deleting the
   * release outright and keeping only `cameraChannel = null` left this check GREEN,
   * because the evidence it read was prose. A DESCRIBED BUG READS LIKE A FIXED ONE, and
   * a source-text grep cannot tell the difference.
   *
   * So it now asserts the EFFECT: a fake client records what is handed to
   * `removeChannel`, each panel's real teardown is CALLED, and the check asks whether
   * THAT channel was released and its handle cleared. Comments cannot satisfy it, and
   * neither can a helper's name — which is what makes it survive the refactor below.
   *
   * ALL THREE, because closeCamera's own comment says three channels were subscribed and
   * zero released, part 1 released one, and PUP-WO-0701 §S2.2 released the other two.
   * Asserting only camera is asserting the panel that was never the problem. */
  const panels = [
    { name: 'camera', close: 'closeCamera', handle: 'cameraChannel', overlay: 'cameraOverlay' },
    { name: 'canvas', close: 'closeCanvas', handle: 'canvasChannel', overlay: 'canvasOverlay' },
    { name: 'map',    close: 'closeTreasureMap', handle: 'mapChannel', overlay: 'mapOverlay' },
  ];
  for (const p of panels) {
    const r = await page.evaluate(({ close, handle }) => {
      /* `var` at the top level of a classic script IS a window property, so both the
       * teardown and its handle are reachable by name with no eval anywhere. */
      if (typeof window[close] !== 'function') return { missing: true };
      const released = [];
      const token = { __fake: true, unsubscribe() { released.push('unsubscribe'); } };
      /* The teardown reaches its client through getSupabaseClient(), so that is the seam
       * to stand in front of. Restored in the finally, because a stub that outlives its
       * assertion is a defect the NEXT section inherits. */
      const realGet = window.getSupabaseClient;
      try {
        window.getSupabaseClient = () => ({ removeChannel: (c) => { released.push(c === token ? 'removeChannel(this)' : 'removeChannel(OTHER)'); } });
        window[handle] = token;
        window[close]();
        return { released, cleared: window[handle] === null };
      } catch (e) {
        return { threw: String((e && e.message) || e) };
      } finally { window.getSupabaseClient = realGet; }
    }, p);
    if (r.missing) { bad(`${p.close} does not exist`); continue; }
    if (r.threw) { bad(`${p.close} threw while tearing down`, r.threw); continue; }
    if (!r.released.length) bad(`${p.close} NEVER RELEASES its channel`,
      `the receiver stays live for the rest of the session — open ${p.name} once and its broadcasts keep arriving over the console, over a game, over anything`);
    else if (r.released[0] === 'removeChannel(OTHER)') bad(`${p.close} released a DIFFERENT channel than the one it held`);
    else if (!r.cleared) bad(`${p.close} releases the channel but leaves the handle set`,
      'the next open sees a non-null handle, returns early, and never re-subscribes');
    else ok(`${p.close} releases its own channel (${r.released[0]}) and clears the handle`);
  }
} finally { await browser.close(); server.close(); }

if (failures.length) {
  console.error(`\n::error::CHECK 24 FAILED — ${failures.length} — the inbound gate is not closed.`);
  console.error(`\nCHECK 24 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 24 PASSED at ${COMMIT.slice(0, 12)} — a payload naming a remote origin causes no network request, real media of the expected kind still passes, an oversized payload is refused, the gallery is bounded and evicts the oldest, and all three panels release their own channel and clear the handle.`);
