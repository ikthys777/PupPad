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
 * the gate and compared return values would be grading the validator against
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
/* --only, so a controls file can aim one plant at one section instead of running the
 * whole check and hoping the red it gets is the red it meant. */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const run = (n) => !ONLY || ONLY.split(',').includes(String(n));

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

  const present = await page.evaluate(() => typeof window.safeImageUrl === 'function');
  if (!present) { bad('there is no inbound gate at all', 'safeImageUrl is not defined'); }
  else {
    /* 1. THE BEACON. A hostile payload driven through the real sink. */
    if (run(1)) {
    const before = hits.length;
    const beacon = `${ORIGIN}/__beacon?id=1`;
    /* THROUGH THE APP'S OWN REGISTERED HANDLER, NOT A RE-IMPLEMENTATION OF IT.
     *
     * This used to call the gate itself and only invoke the sink if it passed
     * — so it demonstrated that the VALIDATOR refuses a URL, which was never in doubt, and
     * said nothing about whether the SINK IS GATED. Deleting the gate from
     * joinCameraChannel's handler left this section green: the check was performing the
     * very validation whose absence it was supposed to detect.
     *
     * Now a fake client is stood in front of joinCameraChannel so the app registers ITS
     * OWN callback, and that captured callback is handed the hostile payload. */
    const staged = await page.evaluate((b) => {
      let handler = null;
      const realGet = window.getSupabaseClient;
      window.getSupabaseClient = () => ({
        channel: () => ({ on(_t, _f, cb) { handler = cb; return this; }, subscribe() { return this; }, send() {} }),
        removeChannel() {},
      });
      try {
        window.cameraChannel = null;
        joinCameraChannel();
        if (!handler) return false;
        handler({ payload: { dataUrl: b } });
        return true;
      } finally { window.getSupabaseClient = realGet; }
    }, beacon);
    if (!staged) bad('the camera registered no inbound handler', 'this section proved nothing');
    await page.waitForTimeout(600);
    const fetched = hits.slice(before).filter((h) => h.startsWith('/__beacon'));
    if (fetched.length) bad(`the child's device fetched an attacker-named origin (${fetched.length} request(s))`,
      'no script ran and nothing was stolen — and invariant 3 is broken anyway, because a core surface reached the network');
    else ok('a payload naming a remote origin causes NO network request — the sink refused it');
    }

    /* 2. AND THE GATE MUST STILL PASS REAL MEDIA, or it is a feature that was removed. */
    if (run(2)) {
    /* THE AUDIO HALF IS GONE WITH THE VOICE TRANSPORT -- PUP-WO-0702 §1.1a. The `kind`
     * parameter had one caller left and the function is now `safeImageUrl(raw)`. So this
     * asserts the narrowing rather than quietly dropping the audio case: a gate that
     * still accepted audio would be a limb with no body, and a check that simply stopped
     * asking would pass because ITS SUBJECT IS GONE rather than because a property holds. */
    const good = await page.evaluate(() => {
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
      const wav = 'data:audio/wav;base64,UklGRiQAAABXQVZF';
      return { img: safeImageUrl(png) === png, audRefused: safeImageUrl(wav) === '',
               arity: safeImageUrl.length, oldName: typeof window.safeMediaUrl };
    });
    if (!good.img) bad('the gate rejects a legitimate image — the feature is disabled, not secured');
    else if (!good.audRefused) bad('the gate still accepts audio after the voice transport was removed',
      'a branch with no caller is a limb a future reader treats as live');
    else if (good.oldName !== 'undefined') bad('safeMediaUrl still exists alongside safeImageUrl',
      'two names for one gate is the next drift');
    else if (good.arity !== 1) bad(`the gate still takes ${good.arity} parameters`, 'the `kind` argument has no caller');
    else ok('the gate is safeImageUrl(raw): a real data:image passes, audio is refused, and the old name and its `kind` argument are gone');
    }

    /* 3. THE RECEIVING HALF OF THE BOUND. */
    if (run(3)) {
    const capped = await page.evaluate(() => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024);
      return safeImageUrl(huge) === '';
    });
    if (!capped) bad('an oversized inbound payload is accepted', 'the designed bound is recorder-side only — it bounds what this device SENDS, not what it ACCEPTS');
    else ok('an oversized inbound payload is refused — the bound has its receiving half');
    }

    /* 4. THE GALLERY IS BOUNDED, and evicts the OLDEST. */
    if (run(4)) {
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
  /* THE MAP IS NO LONGER IN THIS TABLE, AND ITS ABSENCE IS ASSERTED RATHER THAN ASSUMED.
   * PUP-WO-0702 removed the map transport outright, so "closeTreasureMap releases its
   * channel" has no subject — and silently dropping the row would be a check passing
   * because the thing it asserted is GONE rather than because a property holds, which is
   * the exact failure that work order names. The row below replaces it with the stronger
   * claim: there is no handle to release. */
  /* BY EFFECT, NOT BY A LIST OF NAMES.
   *
   * This asked `typeof window.broadcastMapStroke` against a HARDCODED list — so a working
   * transport under different names passed it, which is a name search wearing a runtime
   * costume. And its geolocation half read `typeof navigator.geolocation.watchPosition`:
   * A BROWSER API THAT NO MUTATION OF THIS APP CAN TURN RED, so it asserted nothing at all.
   *
   * Both are founded on effect now: OPEN THE MAP with a recording client and a spied
   * geolocation, and ask what it did. Leaflet is stubbed minimally — the map only has to
   * get far enough to take a channel, which it did before any Leaflet call. */
  const noChannel = await page.evaluate(async () => {
    const asks = [], sends = [];
    let geoCalls = 0;
    const realGet = window.getSupabaseClient, realCfg = window.isSupabaseConfigured;
    const realL = window.L, realGeo = navigator.geolocation;
    const RealWS = window.WebSocket;
    const sockets = [];
    window.WebSocket = function (u, pr) { sockets.push(String(u)); return new RealWS(u, pr); };
    window.WebSocket.prototype = RealWS.prototype;
    window.getSupabaseClient = () => ({
      channel: (n) => { asks.push(n);
        return { on() { return this; }, subscribe() { return this; }, send(m) { sends.push(m && m.event); return this; } }; },
      removeChannel() {},
    });
    window.isSupabaseConfigured = () => true;
    const ll = (a, b) => (typeof a === 'object' ? { lat: a.lat, lng: a.lng } : { lat: a, lng: b });
    const off = { enable() {}, disable() {} };
    window.L = {
      map: () => ({ setView() { return this; }, on() { return this; }, remove() {},
                    latLngToContainerPoint: () => ({ x: 0, y: 0 }),
                    containerPointToLatLng: () => ll(0, 0),
                    dragging: off, touchZoom: off, doubleClickZoom: off, scrollWheelZoom: off }),
      tileLayer: () => ({ addTo() { return this; } }), divIcon: () => ({}),
      marker: () => ({ addTo() { return this; }, setLatLng() { return this; }, getLatLng: () => ll(0, 0) }),
      latLng: ll, point: (x, y) => ({ x, y }),
    };
    const fix = { coords: { latitude: 1, longitude: 2 } };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok2) => { geoCalls++; setTimeout(() => ok2(fix), 0); },
      watchPosition: (ok2) => { geoCalls++; setTimeout(() => ok2(fix), 0); return 3; },
      clearWatch() {},
    }});
    try {
      openTreasureMap();
      await new Promise((r) => setTimeout(r, 250));
      const marker = !!window.mapLocationMarker;
      closeTreasureMap();
      return { asks, sends, sockets, geoCalls, marker };
    } finally {
      window.getSupabaseClient = realGet; window.isSupabaseConfigured = realCfg;
      window.L = realL; window.WebSocket = RealWS;
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: realGeo });
    }
  });
  if (noChannel.asks.length || noChannel.sends.length || noChannel.sockets.length)
    bad('opening the map still takes a transport',
      `channels=[${noChannel.asks.join(', ')}], sends=[${noChannel.sends.join(', ')}], sockets=${noChannel.sockets.length} — it carried REAL WGS84 coordinates beside a stable device id on an unscoped global channel`);
  else if (!noChannel.geoCalls) bad('the map never asked for a location',
    'it is meant to keep knowing where it is and stop telling anyone — local FUNCTION, not local ignorance');
  else if (!noChannel.marker) bad('the map asked for a location and did not place the marker');
  else ok(`opening the map takes NO channel, sends nothing and opens no socket, while still calling geolocation ${noChannel.geoCalls}x and placing the marker`);

  const panels = [
    { name: 'camera', close: 'closeCamera', handle: 'cameraChannel', overlay: 'cameraOverlay' },
    { name: 'canvas', close: 'closeCanvas', handle: 'canvasChannel', overlay: 'canvasOverlay' },
  ];
  for (const p of (run(5) ? panels : [])) {
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
console.log(`\nCHECK 24 PASSED at ${COMMIT.slice(0, 12)} — a payload naming a remote origin causes no network request, a real image still passes and audio is now refused, an oversized payload is refused, the gallery is bounded and evicts the oldest, the map has no transport at all while keeping geolocation, and both remaining channel panels release their own channel and clear the handle.`);
