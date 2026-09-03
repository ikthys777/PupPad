#!/usr/bin/env node
/**
 * CHECK 22 — the zoom lockout, and the way back out of it.  PUP-WO-0603.
 *
 * On the S10+ a gesture zooms the page far enough that the controls leave the screen and
 * a three-year-old cannot get back. Two halves: the page should not zoom, and WHEN IT
 * DOES ANYWAY the way out must still be reachable.
 *
 * WHAT THIS FILE ASSERTS AND WHAT IT DELIBERATELY DOES NOT
 * -------------------------------------------------------
 * THE PRIMARY ASSERTION IS THAT A PINCH DOES NOT ZOOM — not that containers carry a
 * `touch-action` declaration. Those are not the same claim and the difference is the
 * whole of PUP-WO-0603 §2's correction. The declarations on `#root`, `#alertFlash` and
 * `#cameraOverlay` were MEASURED NOT TO CHANGE ZOOM BEHAVIOUR: `index.html:17` already
 * carries `html,body{touch-action:none}`, and for a document-level gesture the effective
 * value is the intersection up the ancestor chain, so the root declaration decides it
 * whatever a panel computes. Asserting the declarations would be asserting the hedge —
 * architecture §6.1 member 6, a proxy the property does not follow from. So §1 pinches
 * the real app and looks at `visualViewport.scale`, and its plant is the removal of the
 * line that actually works.
 *
 * TWO INSTRUMENTS, AND ONLY ONE OF THEM CAN ANSWER §1
 * --------------------------------------------------
 * `Input.synthesizePinchGesture` injects at the compositor and IGNORES `touch-action`
 * entirely — it zooms a page with `touch-action:none` on every element. Measured before
 * it was trusted, which is the only reason this file does not use it for §1: it would
 * have reported the app zoomable no matter what the CSS said, and the fix would have
 * looked impossible. It IS the right instrument for §4, where a zoom must be forced past
 * the defences on purpose so the recovery has something to recover from.
 *
 * §1 therefore dispatches REAL two-point touch events, which go through hit testing and
 * `touch-action` the way a finger does. That path is only meaningful because the null
 * result was taken first: an all-`auto` fixture zooms 1 → 5 under it (§1's own control),
 * so a "blocked" reading is a fact about the page rather than about the harness.
 *
 * AND THE GAP IS NOT INCIDENTAL — IT IS THE PROPERTY UNDER TEST. The one thing that makes
 * Android Chrome behave differently here is that it IGNORES `user-scalable=no` as an
 * accessibility policy. This harness appears to honour it. A test bed that honours the
 * directive cannot reproduce a defect whose cause is the directive being ignored, which
 * is why five separate plants below leave §1 green and why no amount of harness work will
 * change that. It is not a bug in the plants.
 *
 * WHAT IT CANNOT DO: THIS IS A DESKTOP, NOT THE S10+. The reported symptom has never been
 * reproduced off-device, and `PUP-WO-0603` §5 makes a desktop result dressed as a device
 * result a flag-and-stop. Nothing here claims the S10+ is fixed. It claims the page does
 * not zoom under a pinch in Chromium, that the recovery restores reach when something
 * else zooms it, and that both can be shown failing.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));

let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 22 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}
console.log(`CHECK 22 — the zoom lockout and the way back. subject ${COMMIT.slice(0, 12)}\n`);

const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith('--only='));
  return a ? new Set(a.slice(7).split(',').map(Number)) : null;
})();
const want = (n) => !ONLY || ONLY.has(n);

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const info = (m) => console.log(`  ....  ${m}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

/* The app, plus two throwaway fixtures §1 needs for its own control. */
const FIXTURES = {
  '/__all-auto.html': `<meta name=viewport content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}
#p{position:absolute;inset:0;background:#123}</style><div id=p>x</div>`,
};

const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (FIXTURES[u.pathname]) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(FIXTURES[u.pathname]); return; }
    const f = join(REPO, u.pathname === '/' ? '/index.html' : u.pathname);
    const b = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
await new Promise((r) => server.once('listening', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* The S10+ in landscape — architecture §3. A zoom lockout is a claim about a viewport,
 * and a number is only ever correct at the viewport it was measured at. */
const S10 = { width: 869, height: 412 };

const browser = await chromium.launch({ channel: 'chromium' });

async function shape() {
  const ctx = await browser.newContext({ viewport: S10, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const scale = () => page.evaluate(() => (window.visualViewport ? +window.visualViewport.scale.toFixed(3) : -1));

  /* A PINCH MADE OF REAL TOUCH POINTS, so it is subject to hit testing and touch-action
   * exactly as a finger is. Twelve steps because a two-frame gesture is not recognised. */
  async function pinch(cx, cy) {
    await touch('touchStart', [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }]);
    for (let i = 1; i <= 12; i++) {
      const d = 40 + i * 14;
      await touch('touchMove', [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }]);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
    await page.waitForTimeout(400);
  }

  /* THE OTHER INSTRUMENT, and it took two attempts to find one that works on THIS page.
   *
   * `Input.synthesizePinchGesture` injects at the compositor and ignores `touch-action` —
   * it zooms a fixture whose every element is `touch-action:none`. It does NOT zoom this
   * app, because `index.html:5` declares `user-scalable=no`, which pins the page's own
   * min/max scale at 1 and constrains even a compositor gesture. So the first version of
   * §4 reported "the harness could not force a zoom" — correctly, and it said so instead
   * of quietly testing nothing.
   *
   * `Emulation.setPageScaleFactor` sets the scale directly and is subject to neither, so
   * it stands in for "something outside the page's control zoomed it" — which is exactly
   * the case §3 of the work order exists to survive, and the only case in which the
   * recovery ever runs. */
  const forceZoom = async (x, y, factor) => {
    try { await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: factor, relativeSpeed: 800 }); } catch (e) {}
    await page.waitForTimeout(250);
    let sc = await scale();
    if (!(sc > 1.05)) {
      try {
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: factor });
        await page.waitForTimeout(120);
        /* Pan away from the origin, so the way out really is off the glass — a zoom
         * centred on the exit is not the lockout Scotty described. */
        await page.evaluate(([px, py]) => { try { window.scrollTo(px, py); } catch (e) {} }, [x, y]);
      } catch (e) {}
      await page.waitForTimeout(300);
    }
  };

  const openApp = async () => {
    await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    await page.waitForTimeout(250);
  };
  return { ctx, page, cdp, touch, scale, pinch, forceZoom, openApp };
}

try {
/* ------------------------------------------------------------------ */
if (want(1)) {
  console.log('--- 1. a two-finger pinch does not zoom the app, and the instrument can see one that does ---');
  const s = await shape();

  /* THE NULL RESULT FIRST. Without it, "the app did not zoom" is indistinguishable from
   * "this harness cannot zoom anything", and that is the shape of a green that proves
   * nothing. */
  await s.page.goto(ORIGIN + '/__all-auto.html', { waitUntil: 'domcontentloaded' });
  await s.page.waitForTimeout(120);
  const ctrlBefore = await s.scale();
  await s.pinch(Math.round(S10.width / 2), Math.round(S10.height / 2));
  const ctrlAfter = await s.scale();
  if (!(ctrlAfter > ctrlBefore + 0.05)) {
    bad('the harness cannot zoom a page that has no touch-action at all',
      `control fixture went ${ctrlBefore} -> ${ctrlAfter}; every "blocked" below would be meaningless`);
  } else {
    ok(`the instrument can see a zoom: a page with no touch-action goes ${ctrlBefore} -> ${ctrlAfter} under the same gesture`);

    await s.openApp();
    const before = await s.scale();
    await s.pinch(Math.round(S10.width / 2), Math.round(S10.height / 2));
    const after = await s.scale();
    if (after > before + 0.05) bad(`a two-finger pinch zoomed the console to ${after}`,
      'index.html:17 html,body{touch-action:none} is what blocks this — check it is still there');
    else {
      ok(`a two-finger pinch on the console leaves the page at scale ${after}`);
      /* AND THE HONEST LABEL ON IT, because a green nobody can turn red is not evidence.
       * I tried to falsify this and could not: removing `html,body{touch-action:none}`,
       * removing `#root`'s declaration, removing `user-scalable=no`, removing the
       * multi-touch guard, and ALL FOUR TOGETHER each leave the app refusing to zoom,
       * while the control fixture in the same run zooms 1 -> 5. Something else about this
       * page makes it unzoomable in Chromium and I have not identified it.
       *
       * So this reading is TRUE AND UNFALSIFIED, which are not the same as PROVEN. It is
       * reported rather than trusted, and the controls file carries no §1 plant because
       * there is none to carry. PUP-WO-0603 §5 calls a check you cannot show going red a
       * flag-and-stop; this is that, declared at the point of the claim. */
      info('NOT FALSIFIED, AND THE REASON IS UNKNOWN — not a weak property, an unexplained one. The page');
      info('   genuinely does not zoom here. No plant could make this section fail: the root touch-action,');
      info('   #root\'s declaration, user-scalable=no and the multi-touch guard, removed singly and ALL FOUR');
      info('   TOGETHER, each leave the app unzoomable while the control fixture zooms 1 -> 5 in the same run.');
      info('   AND THE HARNESS DIFFERS FROM THE DEVICE IN EXACTLY THE PROPERTY UNDER TEST: Chromium here');
      info('   honours user-scalable=no; Android Chrome IGNORES it, which is the whole of Scotty\'s defect.');
      info('   A test bed that honours the directive cannot reproduce a defect caused by it being ignored.');
    }

    /* And on a panel, because a panel is a different hit-test target and the whole of the
     * refuted §2 was about what panels compute. */
    await s.page.evaluate(() => { const b = document.querySelector('.pad-btn[data-id="6"]'); if (b) b.click(); });
    await s.page.waitForTimeout(600);
    const panel = await s.page.evaluate(() => !!document.getElementById('cameraOverlay'));
    if (!panel) info('the camera panel did not open, so the panel pinch was not exercised');
    else {
      const pb = await s.scale();
      await s.pinch(Math.round(S10.width / 2), Math.round(S10.height / 2));
      const pa = await s.scale();
      if (pa > pb + 0.05) bad(`a two-finger pinch on the camera panel zoomed to ${pa}`);
      else ok(`a two-finger pinch on a full-bleed panel leaves the page at scale ${pa}`);
    }
  }
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
if (want(2)) {
  console.log('\n--- 2. every full-bleed container is DISCOVERED, not remembered, and none of them is touch-action:auto ---');
  const s = await shape();
  await s.openApp();

  /* DERIVED FROM A STRUCTURAL PROPERTY. A hand-written list of ids is the convention
   * wearing a check's clothes: it goes stale exactly the way the sixteen hand-placed
   * declarations went stale, and THE NEXT PANEL SOMEONE ADDS IS THE ONE MISSING FROM BOTH
   * THE CODE AND THE LIST. This walks the live DOM instead, so a container that did not
   * exist when this was written is still graded. */
  const sweep = () => s.page.evaluate(() => {
    const W = innerWidth, H = innerHeight, out = [];
    for (const e of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width < W * 0.9 || r.height < H * 0.9) continue;
      out.push({ id: e.id || '(no id)', tag: e.tagName.toLowerCase(), ta: cs.touchAction });
    }
    return out;
  });

  const surfaces = [['console', null], ['camera', 6], ['map', 1], ['draw', 2]];
  const seen = new Map();
  for (const [name, id] of surfaces) {
    if (id !== null) {
      await s.page.evaluate((i) => { const b = document.querySelector(`.pad-btn[data-id="${i}"]`); if (b) b.click(); }, id);
      await s.page.waitForTimeout(600);
    }
    for (const c of await sweep()) if (!seen.has(c.id)) seen.set(c.id, { ...c, where: name });
  }
  const found = [...seen.values()];
  const autos = found.filter((c) => c.ta === 'auto');
  if (!found.length) bad('the structural sweep found no full-bleed positioned container at all',
    'it cannot have graded anything — the derivation is broken, not the app');
  else if (autos.length) bad(`${autos.length} full-bleed container(s) compute touch-action:auto`,
    autos.map((c) => `#${c.id} (${c.tag}, seen on the ${c.where})`).join(' · '));
  else ok(`${found.length} full-bleed container(s) discovered by walking the DOM, none of them auto: ${found.map((c) => `#${c.id}=${c.ta}`).join(', ')}`);
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
if (want(3)) {
  console.log('\n--- 3. every scroller still scrolls, and each one is NAMED ---');
  const s = await shape();
  await s.openApp();

  /* A COUNT IS NOT A LIST. Each of these is named, and each reports one of three
   * outcomes: it scrolled, it could not be made to overflow here (so nothing is claimed
   * about it), or it is present, overflowing, and FROZEN — which is the only failure. */
  const NAMED = [
    { name: 'the camera filter row', open: 6, sel: '#cameraOverlay [style*="overflow-x"]', axis: 'x' },
    { name: 'the camera gallery strip', open: 6, sel: '#camGalleryStrip', axis: 'x' },
    { name: 'the camera sticker bar', open: 6, sel: '#camStickerBar', axis: 'x' },
    { name: 'the map tool strip', open: 1, sel: '#mapToolStrip', axis: 'x' },
    { name: 'the draw toolbar', open: 2, sel: '[style*="overflow-x:auto"]', axis: 'x' },
  ];

  for (const t of NAMED) {
    await s.page.evaluate((i) => { const b = document.querySelector(`.pad-btn[data-id="${i}"]`); if (b) b.click(); }, t.open);
    await s.page.waitForTimeout(700);
    const st = await s.page.evaluate((sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return { ta: cs.touchAction, ox: cs.overflowX, sw: e.scrollWidth, cw: e.clientWidth,
        vis: r.width > 0 && r.height > 0, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    }, t.sel);
    if (!st) { info(`${t.name}: not present on this surface, so nothing is claimed about it`); continue; }
    /* THE DECLARATION IS ASSERTED EVEN WHEN THE SCROLL CANNOT BE, because a strip that
     * does not overflow today will overflow as soon as it has content, and the gesture it
     * will need then is decided now. */
    if (st.ta !== 'pan-x' && st.ta !== 'auto' && st.ta.indexOf('pan-x') < 0) {
      bad(`${t.name} has touch-action:${st.ta}, which forbids the horizontal pan it exists for`);
      continue;
    }
    if (!st.vis || st.sw <= st.cw + 2) {
      info(`${t.name}: touch-action:${st.ta}, present but not overflowing here (${st.sw}<=${st.cw}) — the declaration is asserted, the scroll is not`);
      continue;
    }
    await s.touch('touchStart', [{ x: st.cx + 60, y: st.cy, id: 1 }]);
    for (let i = 1; i <= 10; i++) { await s.touch('touchMove', [{ x: st.cx + 60 - i * 9, y: st.cy, id: 1 }]); await s.page.waitForTimeout(16); }
    await s.touch('touchEnd', []);
    await s.page.waitForTimeout(300);
    const moved = await s.page.evaluate((sel) => Math.round(document.querySelector(sel).scrollLeft), t.sel);
    if (moved > 2) ok(`${t.name} scrolls under a finger (scrollLeft ${moved}, touch-action:${st.ta})`);
    else bad(`${t.name} is overflowing and does NOT scroll under a finger`, `touch-action:${st.ta}, scrollLeft stayed ${moved}`);
  }
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
let recoveryUnverified = false;
if (want(4)) {
  console.log('\n--- 4. the way back out of a zoom — installed and inert at rest; REACH IS UNVERIFIED OFF-DEVICE ---');
  const s = await shape();
  await s.openApp();

  /* CHROMIUM WILL NOT ZOOM THIS PAGE, AND FOUR INSTRUMENTS AGREE. Real two-point touch
   * is blocked by `touch-action`; `Input.synthesizePinchGesture` is blocked by
   * `user-scalable=no`, which pins the page's min/max scale at 1;
   * `Emulation.setPageScaleFactor` leaves `visualViewport.scale` at 1 with and without a
   * device-metrics override; and relaxing the viewport meta at runtime does not make the
   * compositor gesture take either.
   *
   * SO THE END-TO-END PROPERTY — "after a zoom the exit is back within reach" — CANNOT BE
   * MEASURED HERE, AND THIS SECTION SAYS SO RATHER THAN ASSERTING SOMETHING WEAKER AND
   * CALLING IT DONE. PUP-WO-0603 §5 makes a desktop result dressed as a device result a
   * flag-and-stop, and a section that quietly downgraded its own claim would be exactly
   * that. What IS observable is asserted; the rest is reported UNVERIFIED and needs the
   * S10+. */
  const before = await s.scale();
  await s.forceZoom(Math.round(S10.width * 0.8), Math.round(S10.height * 0.8), 3);
  const zoomed = await s.scale();

  const handle = await s.page.evaluate(() => {
    const r = window.__zoomRecovery;
    if (!r) return null;
    return { fns: ['schedule', 'goHome', 'lockedOut'].filter((k) => typeof r[k] === 'function'), settleMs: r.settleMs };
  });
  if (!handle) { bad('there is no zoom recovery installed at all', 'window.__zoomRecovery is undefined'); }
  else if (handle.fns.length !== 3) { bad('the zoom recovery is installed but incomplete', `has ${handle.fns.join(',')}`); }
  else {
    ok(`the recovery is installed and observable (${handle.fns.join(', ')}, settle ${handle.settleMs}ms)`);

    /* IT MUST BE LISTENING, AND IT MUST BE INERT WHEN NOTHING IS WRONG. A recovery that
     * snapped the viewport home on every visualViewport event would fight an adult who
     * panned a zoomed page deliberately — so "does nothing at rest" is a requirement,
     * not the absence of one, and dispatching the real event is how it is measured. */
    const quiet = await s.page.evaluate(async (settle) => {
      let calls = 0;
      const real = window.scrollTo;
      window.scrollTo = function () { calls++; return real.apply(this, arguments); };
      window.visualViewport.dispatchEvent(new Event('scroll'));
      window.visualViewport.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, settle + 250));
      window.scrollTo = real;
      return { calls, locked: window.__zoomRecovery.lockedOut() };
    }, handle.settleMs);
    if (quiet.locked) bad('the recovery believes the app is locked out while it is at rest and unzoomed',
      'it would snap the viewport home under an adult who is panning on purpose');
    else if (quiet.calls > 0) bad(`the recovery scrolled the page ${quiet.calls} time(s) while nothing was wrong`,
      'this fires on every visualViewport event and makes a zoomed page impossible to pan');
    else ok('it is listening on visualViewport and correctly does nothing while the page is not locked out');

    if (zoomed > before + 0.05) {
      /* If a future Chromium DOES let one of the injectors through, this runs for real
       * rather than being dead code. */
      await s.page.evaluate(() => window.__zoomRecovery.goHome());
      await s.page.waitForTimeout(300);
      const reach = await s.page.evaluate(() => {
        const vv = window.visualViewport;
        const b = document.querySelector('.pad-btn[data-id="7"]') || document.querySelector('.pad-btn');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const inside = r.left < vv.offsetLeft + vv.width && r.right > vv.offsetLeft
          && r.top < vv.offsetTop + vv.height && r.bottom > vv.offsetTop;
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { inside, hit: !!(top && (top === b || b.contains(top) || top.contains(b))), scale: +vv.scale.toFixed(2) };
      });
      if (!reach || !reach.inside) bad('after recovery the way out is still outside the visual viewport');
      else if (!reach.hit) bad('the way out intersects the viewport but a tap at its centre does not reach it');
      else ok(`after recovery the way out is inside the visual viewport at scale ${reach.scale} and a tap at its centre hits it`);
    } else {
      recoveryUnverified = true;
      info('UNVERIFIED — Chromium will not zoom this page by any of four instruments (real touch, synthesizePinchGesture,');
      info('   setPageScaleFactor, relaxed viewport meta), so "after a zoom the exit is back within reach" CANNOT be');
      info('   measured here. It is asserted by construction and NOT by observation. THIS NEEDS THE S10+.');
    }
  }
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
if (want(5)) {
  console.log('\n--- 5. a second finger on a non-scrolling surface is cancelled; on a scroller it is not ---');
  const s = await shape();
  await s.openApp();

  const guard = await s.page.evaluate(() => !!window.__multiTouchGuard);
  if (!guard) bad('there is no multi-touch guard installed at all', 'window.__multiTouchGuard is undefined');
  else {
    /* OBSERVED, NOT ASSUMED: listen for the same event and record whether the default was
     * prevented by the time it reaches us. A guard that silently no-ops — because a
     * document-level touch listener is passive by default and cannot preventDefault —
     * looks identical to a working one from the outside. */
    await s.page.evaluate(() => {
      window.__seen = [];
      document.addEventListener('touchstart', (e) => {
        window.__seen.push({ n: e.touches.length, prevented: e.defaultPrevented });
      }, { capture: false, passive: true });
    });

    const two = async (x, y) => {
      await s.touch('touchStart', [{ x: x - 20, y, id: 1 }, { x: x + 20, y, id: 2 }]);
      await s.page.waitForTimeout(60);
      await s.touch('touchEnd', []);
      await s.page.waitForTimeout(80);
    };
    await two(Math.round(S10.width / 2), Math.round(S10.height / 2));
    const onPanel = await s.page.evaluate(() => window.__seen.filter((r) => r.n > 1));
    if (!onPanel.length) bad('the two-finger touch produced no multi-touch event at all — this section cannot measure the guard');
    else if (!onPanel.some((r) => r.prevented)) bad('a two-finger touch on the console was NOT cancelled',
      'a document-level touch listener is passive by default and cannot preventDefault; without {passive:false} the guard is a no-op that reads as installed');
    else ok(`a two-finger touch on the console is cancelled (${onPanel.length} multi-touch event(s), default prevented)`);

    /* AND THE OTHER HALF, which is what stops this being a blanket suppression: a
     * two-finger gesture that begins on something scrollable must be left alone. */
    const sc = await s.page.evaluate(() => {
      const d = document.createElement('div');
      d.id = '__probeScroller';
      d.style.cssText = 'position:fixed;left:40px;top:40px;width:200px;height:120px;overflow-x:auto;white-space:nowrap;z-index:9999';
      d.innerHTML = '<span style="display:inline-block;width:900px;height:80px"></span>';
      document.body.appendChild(d);
      const r = d.getBoundingClientRect();
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, overflows: d.scrollWidth > d.clientWidth };
    });
    if (!sc.overflows) info('the probe scroller did not overflow, so the scroller half was not exercised');
    else {
      await s.page.evaluate(() => { window.__seen = []; });
      await two(Math.round(sc.cx), Math.round(sc.cy));
      const onScroller = await s.page.evaluate(() => window.__seen.filter((r) => r.n > 1));
      if (!onScroller.length) info('no multi-touch event observed on the probe scroller');
      else if (onScroller.some((r) => r.prevented)) bad('a two-finger gesture starting on a SCROLLER was cancelled',
        'that is a blanket suppression — the drawer, the picker grid and the five strips all lose their gesture');
      else ok('a two-finger gesture starting on a scroller is left alone, so scrollers keep their pan');
    }
  }
  await s.ctx.close();
}

} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n::error::CHECK 22 FAILED — ${failures.length} — the zoom lockout is not closed.`);
  console.error(`\nCHECK 22 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 22 PASSED at ${COMMIT.slice(0, 12)} — a real two-finger pinch does not zoom the app (OBSERVED, not proved: see the NOT FALSIFIED note in §1), every full-bleed container is discovered by walking the DOM rather than remembered, each named scroller keeps its gesture, the recovery is installed and correctly inert at rest, and a second finger is cancelled on the panels without ever being cancelled on a scroller.`);
if (recoveryUnverified) {
  console.log(`\n  NOT VERIFIED BY THIS CHECK: that the way out is reachable AFTER a zoom. Chromium will not`);
  console.log(`  zoom this page by any instrument tried, so the recovery path has never been observed doing`);
  console.log(`  its job. It needs the S10+, and PUP-WO-0603 §4 is where that is recorded as open.`);
}
