/* CHECK 21 — Block Pop, played with a finger.  PUP-WO-0400 §3.
 *
 * AT THE FLEET VIEWPORTS AND NOWHERE ELSE. Architecture §3: three phones, no tablet,
 * 869x412 / 915x412 / 883x412. Checks 19 and 20 carry a tablet viewport list that
 * describes a device nobody owns; PUP-WO-0111 owns correcting them and this file does
 * not copy them.
 *
 * Real touch throughout, via CDP Input.dispatchTouchEvent on a hasTouch context. A
 * synthetic click is not a finger (architecture §6.1 member 6).
 *
 * DETERMINISM: Math.random is pinned to 0 before the module loads. In pickWeighted a
 * roll of 0 always returns the first survivor of the mode filter — `dot` — and
 * randomColor yields colour 1. Every deal is therefore a single red candy, which is what
 * makes "fill a row and watch it clear" a thing this file can actually do with a finger
 * rather than assert about. It changes no production code.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';
import { chromium } from 'playwright';
import { requireSubject } from './lib/subject.mjs';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));
const COMMIT = requireSubject(REPO, 'CHECK 21');
console.log(`CHECK 21 — Block Pop, played with a finger. subject ${COMMIT.slice(0, 12)}\n`);

/* --only=N runs a single section. The red-proof companion (demo-blockpop-controls.mjs)
 * plants one defect per section and needs the section it targets, not all eight — eight
 * full browser runs per scenario would cost twelve minutes to prove one line. CI runs
 * this file with no argument, i.e. everything. */
const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith('--only='));
  return a ? new Set(a.slice(7).split(',').map(Number)) : null;
})();
const want = (n) => !ONLY || ONLY.has(n);

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const info = (m) => console.log(`  ....  ${m}`);
/* A section that throws used to abort every section after it and exit with a stack
 * trace, which is a crash, not a verdict — and a planted-defect run could not tell
 * "the check caught it" from "the check fell over". Contain each section. */
async function section(n, run) {
  if (!want(n)) return;
  try { await run(); }
  catch (e) { bad(`section ${n} could not complete`, String(e && e.message ? e.message : e).split('\n')[0]); }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store' }).end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const FLEET = [
  { name: 'S10+', width: 869, height: 412 },
  { name: 'S20U', width: 915, height: 412 },
  { name: 'S25U', width: 883, height: 412 },
];

/* Pins the deal AND instruments teardown. Runs before any page script. */
const HARNESS = () => {
  Math.random = () => 0;
  const T = { addedWin: new Map(), timers: new Set(), ros: 0, roDisconnects: 0, anim: { pop: 0, clear: 0 } };
  window.__bp = T;
  const aEL = window.addEventListener.bind(window);
  const rEL = window.removeEventListener.bind(window);
  window.addEventListener = function (t, f, o) { T.addedWin.set(f, (T.addedWin.get(f) || 0) + 1); return aEL(t, f, o); };
  window.removeEventListener = function (t, f, o) {
    const n = (T.addedWin.get(f) || 0) - 1;
    if (n <= 0) T.addedWin.delete(f); else T.addedWin.set(f, n);
    return rEL(t, f, o);
  };
  const sT = window.setTimeout.bind(window);
  const cT = window.clearTimeout.bind(window);
  window.setTimeout = function (fn, ms, ...a) {
    const id = sT(function () { T.timers.delete(id); return fn.apply(this, a); }, ms);
    T.timers.add(id); return id;
  };
  window.clearTimeout = function (id) { T.timers.delete(id); return cT(id); };
  const RO = window.ResizeObserver;
  if (RO) {
    window.ResizeObserver = class extends RO {
      constructor(cb) { super(cb); T.ros++; }
      disconnect() { T.roDisconnects++; return super.disconnect(); }
    };
  }
  document.addEventListener('animationstart', (e) => {
    if (e.animationName === 'bp-pop') T.anim.pop++;
    else if (e.animationName === 'bp-clear') T.anim.clear++;
  }, true);
};

const browser = await chromium.launch({ channel: 'chromium' });

/* Builds a fresh touch context at one fleet shape. */
async function shape(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
  await ctx.addInitScript(HARNESS);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const wait = (ms) => page.waitForTimeout(ms);

  const rect = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, sel);

  async function tapTarget(sel) {
    return page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = e.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return { x: r.x, y: r.y, w: r.width, h: r.height, cx, cy,
        onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        topmost: !!(top && (top === e || e.contains(top) || top.contains(e))) };
    }, sel);
  }

  async function fingerTap(sel, { slide = 0 } = {}) {
    const r = await tapTarget(sel);
    if (!r || !r.onScreen || !r.topmost) return false;
    await touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
    await wait(40);
    if (slide) { await touch('touchMove', [{ x: r.cx + slide, y: r.cy, id: 1 }]); await wait(40); }
    await touch('touchEnd', []);
    await wait(120);
    return true;
  }

  /* A drag from one element's centre to another's, in steps, as a finger does it. */
  async function fingerDragTo(fromSel, toSel, { steps = 10, holdEnd = 0 } = {}) {
    const a = await tapTarget(fromSel);
    const b = await tapTarget(toSel);
    if (!a || !b || !a.onScreen || !a.topmost) return false;
    await touch('touchStart', [{ x: a.cx, y: a.cy, id: 1 }]);
    await wait(16);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [{ x: a.cx + (b.cx - a.cx) * (i / steps), y: a.cy + (b.cy - a.cy) * (i / steps), id: 1 }]);
      await wait(12);
    }
    if (holdEnd) await wait(holdEnd);
    await touch('touchEnd', []);
    await wait(140);
    return true;
  }

  const openBlocks = async ({ clearStorage = false } = {}) => {
    await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    if (clearStorage) { await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload({ waitUntil: 'domcontentloaded' }); }
    await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    await fingerTap('.pad-btn[data-id="7"]');
    await page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await fingerTap('.pickerTile[data-game="blocks"]');
    await page.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await wait(120);
  };

  /* THE TRAY ONLY REFILLS WHEN ALL THREE SLOTS ARE EMPTY, so "tap slot 0" is a tap on
   * nothing for two placements out of every three. The first version of this file did
   * exactly that and reported the GAME as broken when the fault was in the check: one
   * candy landed out of six and section 4 read it as "the row did not clear". Pick the
   * slot that actually holds a piece, the way a child looking at the tray does. */
  const firstFullSlot = () => page.evaluate(() =>
    [...document.querySelectorAll('.bp-slot')].findIndex((s) => s.getAttribute('data-empty') === '0'));

  async function placeAt(r, c) {
    const i = await firstFullSlot();
    if (i < 0) return false;
    if (!await fingerTap(`.bp-slot[data-slot="${i}"]`)) return false;
    return fingerTap(`.bp-well[data-row="${r}"][data-col="${c}"]`);
  }

  const boardState = () => page.evaluate(() => {
    const wells = [...document.querySelectorAll('.bp-well')];
    return wells.map((w) => {
      const c = w.querySelector('.bp-candy');
      const cs = c ? getComputedStyle(c) : null;
      return {
        r: +w.getAttribute('data-row'), c: +w.getAttribute('data-col'),
        filled: !!(c && !c.hidden),
        opacity: cs ? +cs.opacity : 0,
        display: cs ? cs.display : 'none',
      };
    });
  });

  const seam = () => page.evaluate(() => {
    const h = document.getElementById('gameHost');
    return h && h.blocks ? h.blocks.get() : null;
  });

  return { ctx, page, cdp, touch, wait, rect, tapTarget, fingerTap, fingerDragTo, firstFullSlot, placeAt, openBlocks, boardState, seam, errs };
}

try {
  /* ------------------------------------------------------------------ */
  await section(1, async () => {
  console.log('--- 1. every game-owned control is on the screen, and none of it is in the exit\'s column ---');
  for (const vp of FLEET) {
    const s = await shape(vp);
    await s.openBlocks({ clearStorage: true });
    const geo = await s.page.evaluate(() => {
      const sel = ['.bp-well', '.bp-slot'];
      const out = [];
      for (const q of sel) {
        for (const e of document.querySelectorAll(q)) {
          const r = e.getBoundingClientRect();
          out.push({ q, x: r.x, y: r.y, w: r.width, h: r.height });
        }
      }
      const gb = document.getElementById('gameBack');
      const g = gb ? gb.getBoundingClientRect() : null;
      const bw = document.querySelector('.bp-boardwrap');
      const br = bw ? bw.getBoundingClientRect() : null;
      return { out, back: g ? { x: g.x, y: g.y, w: g.width, h: g.height } : null,
        board: br ? { w: br.width, h: br.height, x: br.x } : null,
        vw: innerWidth, vh: innerHeight };
    });
    const offscreen = geo.out.filter((e) => e.x < 0 || e.y < 0 || e.x + e.w > geo.vw + 0.5 || e.y + e.h > geo.vh + 0.5);
    const inBack = geo.back
      ? geo.out.filter((e) => e.x < geo.back.x + geo.back.w && e.x + e.w > geo.back.x
          && e.y < geo.back.y + geo.back.h && e.y + e.h > geo.back.y)
      : [];
    if (offscreen.length) bad(`${vp.name} ${vp.width}x${vp.height}: ${offscreen.length} of ${geo.out.length} game control(s) lie outside the viewport`,
      offscreen.slice(0, 3).map((e) => `${e.q} at ${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}x${Math.round(e.h)}`).join(' · '));
    else if (inBack.length) bad(`${vp.name}: ${inBack.length} game control(s) intersect #gameBack's column (x ${Math.round(geo.back.x)}-${Math.round(geo.back.x + geo.back.w)})`,
      inBack.slice(0, 3).map((e) => `${e.q} at ${Math.round(e.x)},${Math.round(e.y)}`).join(' · '));
    else ok(`${vp.name} ${vp.width}x${vp.height}: all ${geo.out.length} controls on screen, none in the exit's column; board ${Math.round(geo.board.w)}x${Math.round(geo.board.h)} at x=${Math.round(geo.board.x)}`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(2, async () => {
  console.log('\n--- 2. a touch-drag from a tray slot to a cell fills it; an illegal drop does not ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    const before = (await s.boardState()).filter((c) => c.filled).length;
    const moved = await s.fingerDragTo('.bp-slot[data-slot="0"]', '.bp-well[data-row="2"][data-col="2"]');
    const after = await s.boardState();
    const filled = after.filter((c) => c.filled);
    if (!moved) bad('the drag could not start — slot 0 was not reachable by a finger');
    else if (filled.length !== before + 1) bad(`a legal drop did not fill exactly one cell (${before} -> ${filled.length})`);
    else if (!after.find((c) => c.r === 2 && c.c === 2 && c.filled)) bad('a legal drop filled a cell, but not the one under the finger',
      `filled: ${filled.map((c) => c.r + ',' + c.c).join(' ')}`);
    else ok(`a drag from slot 0 to cell 2,2 filled 2,2 and nothing else`);

    /* An illegal drop: onto the cell just filled. */
    const n0 = (await s.boardState()).filter((c) => c.filled).length;
    await s.fingerDragTo('.bp-slot[data-slot="1"]', '.bp-well[data-row="2"][data-col="2"]');
    const n1 = (await s.boardState()).filter((c) => c.filled).length;
    if (n1 !== n0) bad(`a drop onto an occupied cell placed anyway (${n0} -> ${n1} filled)`);
    else ok('a drop onto an occupied cell placed nothing');
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(3, async () => {
  console.log('\n--- 3. tap-select then tap-cell places, and the tap survives a finger that slides ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    /* A tap that slides 20px — routine for a three-year-old, and REJECTED by the
     * source's dist < 14 gate (BlockPopGame.tsx:142/:153). The widened value is 32. */
    await s.fingerTap('.bp-slot[data-slot="0"]', { slide: 20 });
    const active = await s.page.evaluate(() => document.querySelector('.bp-slot[data-slot="0"]').getAttribute('data-active'));
    if (active !== '1') bad('a tap that slid 20px did not select the piece — the tap slop is too narrow for a small hand');
    else ok('a tap that slid 20px still selected the piece (slop widened from the source\'s 14 to 32)');
    const before = (await s.boardState()).filter((c) => c.filled).length;
    await s.fingerTap('.bp-well[data-row="4"][data-col="1"]');
    const after = await s.boardState();
    if (!after.find((c) => c.r === 4 && c.c === 1 && c.filled)) bad('tap-select then tap-cell did not place',
      `${before} -> ${after.filter((c) => c.filled).length} filled`);
    else ok('tap-select then tap-cell placed at 4,1');
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(4, async () => {
  console.log('\n--- 4. a completed row clears, and the score rises by engine.ts:131-139\'s formula ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    /* Every deal is a single dot (Math.random pinned to 0), so filling row 0 takes six
     * placements and the sixth completes the line. */
    let sc = null;
    for (let c = 0; c < 6; c++) {
      if (c === 5) sc = (await s.seam()).score;
      await s.placeAt(0, c);
    }
    await s.page.waitForTimeout(400);
    const st = await s.boardState();
    const row0 = st.filter((c) => c.r === 0 && c.filled);
    const after = await s.seam();
    /* Five dots placed = 5 points (1 each, no lines). The sixth places 1 cell and clears
     * 1 line at combo 1: 1 + 10*1*max(1,1) = 11. */
    const expected = sc + 11;
    if (row0.length !== 0) bad(`row 0 did not clear — ${row0.length} of 6 cells still filled`);
    else if (after.score !== expected) bad(`the score did not rise by the formula`,
      `before the clearing move ${sc}, after ${after.score}, expected ${expected} (1 placed cell + 10*1 line*combo 1)`);
    else ok(`six dots filled row 0, it cleared, and the score went ${sc} -> ${after.score} (+11 = 1 cell + 10x1 line at combo 1)`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(5, async () => {
  console.log('\n--- 5. THE INVISIBLE ONE: dragging across a filled board re-pops nothing ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    /* Put eight candies down, well short of a line so nothing clears. */
    const spots = [[1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [3, 3]];
    for (const [r, c] of spots) await s.placeAt(r, c);
    await s.page.waitForTimeout(500);
    const filledNow = (await s.boardState()).filter((c) => c.filled).length;
    await s.page.evaluate(() => { window.__bp.anim.pop = 0; window.__bp.anim.clear = 0; });
    /* Now drag a piece back and forth across every one of those candies. */
    const a = await s.tapTarget(`.bp-slot[data-slot="${Math.max(0, await s.firstFullSlot())}"]`);
    const g0 = await s.rect('.bp-well[data-row="1"][data-col="0"]');
    const g1 = await s.rect('.bp-well[data-row="3"][data-col="5"]');
    await s.touch('touchStart', [{ x: a.cx, y: a.cy, id: 1 }]);
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      await s.touch('touchMove', [{ x: g0.cx + (g1.cx - g0.cx) * t, y: g0.cy + (g1.cy - g0.cy) * t, id: 1 }]);
      await s.wait(14);
    }
    for (let i = 14; i >= 0; i--) {
      const t = i / 14;
      await s.touch('touchMove', [{ x: g0.cx + (g1.cx - g0.cx) * t, y: g0.cy + (g1.cy - g0.cy) * t, id: 1 }]);
      await s.wait(14);
    }
    const during = await s.page.evaluate(() => ({ ...window.__bp.anim }));
    await s.touch('touchEnd', []);
    await s.wait(150);
    if (filledNow !== 8) info(`board held ${filledNow} candies, not the 8 expected — the measurement below still stands`);
    if (during.pop !== 0) bad(`${during.pop} candy pop animation(s) restarted during a drag across a filled board`,
      `${filledNow} candies on the board; every one of them re-popping at pointer rate is the defect neither naive port survives`);
    else ok(`a 28-step drag across ${filledNow} settled candies started 0 pop animations`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(6, async () => {
  console.log('\n--- 6. THE OTHER INVISIBLE ONE: a placement inside the 280ms clear window leaves nothing stranded ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    /* Geometry first: every page.evaluate below would cost time we do not have. */
    const slot0 = await s.rect('.bp-slot[data-slot="0"]');
    const cell00 = await s.rect('.bp-well[data-row="0"][data-col="0"]');
    for (let c = 0; c < 6; c++) await s.placeAt(0, c);
    /* INSIDE CLEAR_MS, AND THE FIRST VERSION OF THIS SECTION WAS NOT.
     * placeAt goes through fingerTap twice, and fingerTap alone waits 40ms + 120ms per
     * tap — over 320ms before the second placement lands, by which time the 280ms timer
     * has already fired and nulled the dying set. The section asserted "placed inside
     * the clear window" while placing outside it, and went GREEN against the source's
     * own stranded-clearing bug replanted verbatim. Raw touches with 10ms waits and
     * pre-measured rects land in roughly 40ms.
     *
     * Six placements empty the tray twice over, so slot 0 is guaranteed refilled here.
     * The target is a cell that was JUST CLEARED — a stranded dying set keeps .bp-clear
     * (forwards, opacity 0) on exactly those cells, so the new candy lands in a node
     * still animating itself invisible. Placing anywhere else would pass against it. */
    await s.touch('touchStart', [{ x: slot0.cx, y: slot0.cy, id: 1 }]);
    await s.wait(10);
    await s.touch('touchEnd', []);
    await s.wait(10);
    await s.touch('touchStart', [{ x: cell00.cx, y: cell00.cy, id: 1 }]);
    await s.wait(10);
    await s.touch('touchEnd', []);
    await s.page.waitForTimeout(700);
    const st = await s.boardState();
    const filled = st.filter((c) => c.filled);
    const invisible = filled.filter((c) => c.opacity < 0.9);
    const target = st.find((c) => c.r === 0 && c.c === 0);
    if (!target || !target.filled) bad('the piece placed inside the clear window never landed');
    else if (target.opacity < 0.9) bad(`the candy placed inside the clear window is invisible (opacity ${target.opacity})`,
      'this is the source\'s stranded `clearing` state: .candy-clear is forwards to opacity 0 and nothing ever nulls it');
    else if (invisible.length) bad(`${invisible.length} candy/candies are on the board but invisible`,
      invisible.slice(0, 4).map((c) => `${c.r},${c.c} opacity ${c.opacity}`).join(' · '));
    else ok(`placed inside the clear window: the new candy is visible (opacity ${target.opacity}) and all ${filled.length} candies on the board are`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(7, async () => {
  console.log('\n--- 7. REMOUNT: no state survives in the module, and two entries do not share a game ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    for (let c = 0; c < 3; c++) await s.placeAt(1, c);
    const played = (await s.boardState()).filter((c) => c.filled).length;
    await s.fingerTap('#gameBack');
    await s.page.waitForTimeout(200);
    /* Storage cleared between the two mounts, so anything that comes back came back
     * through the MODULE, which is the hazard §0.4 names. */
    await s.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    /* #gameBack closes gamesChrome outright — it returns to the CONSOLE, not the
     * picker — so the way back in is the pad button and then the tile. */
    await s.fingerTap('.pad-btn[data-id="7"]');
    await s.page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await s.fingerTap('.pickerTile[data-game="blocks"]');
    await s.page.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await s.page.waitForTimeout(150);
    const again = (await s.boardState()).filter((c) => c.filled).length;
    if (played < 3) bad(`the first mount did not take the placements (${played} filled)`);
    else if (again !== 0) bad(`remounting with storage cleared brought back ${again} candy/candies — module state survived the teardown`);
    else ok(`played ${played} cells, left, cleared storage, came back to an empty board — nothing retained in the module`);

    /* The reachable §0.4 failure, tested directly: two entry ids, one module URL. */
    const cross = await s.page.evaluate(async () => {
      const mod = await import('./games/blockpop.js');
      const mk = (id, params) => {
        const h = document.createElement('div');
        h.style.cssText = 'position:absolute;left:-9999px;width:400px;height:300px';
        document.body.appendChild(h);
        const api = { entry: { id, params }, close() {}, sound() {}, tone() {}, vibrate() {},
          save() {}, load() { return null; }, prefersReducedMotion: true };
        const td = mod.default(h, api);
        return { h, td, seam: h[id] };
      };
      const a = mk('t-easy', { mode: 'easy' });
      const b = mk('t-classic', { mode: 'classic' });
      const out = { a: a.seam.get(), b: b.seam.get(),
        aCells: a.h.querySelectorAll('.bp-well').length, bCells: b.h.querySelectorAll('.bp-well').length };
      a.td(); b.td();
      a.h.remove(); b.h.remove();
      return out;
    });
    if (cross.a.size !== 6 || cross.b.size !== 8) bad(`two entries against one module did not honour their own params`,
      `t-easy reported size ${cross.a.size} (want 6), t-classic ${cross.b.size} (want 8)`);
    else if (cross.aCells !== 36 || cross.bCells !== 64) bad(`two entries against one module built the wrong boards`,
      `t-easy ${cross.aCells} cells (want 36), t-classic ${cross.bCells} (want 64)`);
    else ok(`two entry ids against one module URL: 6x6 with 36 cells and 8x8 with 64, neither overriding the other`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(8, async () => {
  console.log('\n--- 8. TEARDOWN: nothing live, mid-drag, with a pointer captured ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    const baseline = await s.page.evaluate(() => ({ win: window.__bp.addedWin.size, ros: window.__bp.ros, dis: window.__bp.roDisconnects }));
    /* Leave mid-drag, with a finger still down and a pointer capture taken. */
    const a = await s.tapTarget(`.bp-slot[data-slot="${Math.max(0, await s.firstFullSlot())}"]`);
    const c = await s.rect('.bp-well[data-row="2"][data-col="2"]');
    await s.touch('touchStart', [{ x: a.cx, y: a.cy, id: 1 }]);
    await s.wait(30);
    await s.touch('touchMove', [{ x: c.cx, y: c.cy, id: 1 }]);
    await s.wait(30);
    /* THE EXIT IS PRESSED BY A SECOND FINGER WHILE THE FIRST IS STILL DRAGGING.
     * Reusing touch id 1 here is not a harsher test, it is an INVALID touch sequence —
     * the first version of this file did exactly that and reported the game as leaking
     * 76 nodes when in truth the exit had never been pressed at all. Id 1 stays on the
     * board; id 2 goes to #gameBack; then both lift. */
    const back = await s.rect('#gameBack');
    await s.touch('touchStart', [{ x: c.cx, y: c.cy, id: 1 }, { x: back.cx, y: back.cy, id: 2 }]);
    await s.wait(40);
    await s.touch('touchEnd', [{ x: c.cx, y: c.cy, id: 1 }]);
    await s.wait(60);
    await s.touch('touchEnd', []);
    await s.page.waitForTimeout(500);
    const post = await s.page.evaluate(() => ({
      host: !!document.getElementById('gameHost'),
      chrome: !!document.getElementById('gamesChrome'),
      styles: document.querySelectorAll('style').length,
      bpNodes: document.querySelectorAll('.bp-root,.bp-well,.bp-slot,.bp-candy').length,
      anims: document.getAnimations().filter((x) => {
        try { return String(x.animationName || '').indexOf('bp-') === 0; } catch (e) { return false; }
      }).length,
      timers: window.__bp.timers.size,
      win: window.__bp.addedWin.size,
      ros: window.__bp.ros, dis: window.__bp.roDisconnects,
    }));
    const gripes = [];
    if (post.host || post.chrome) gripes.push('the host/chrome is still in the document');
    if (post.bpNodes) gripes.push(`${post.bpNodes} game node(s) still in the document`);
    if (post.anims) gripes.push(`${post.anims} bp- animation(s) still running`);
    if (post.timers > 0) gripes.push(`${post.timers} timer(s) still armed`);
    if (post.win > baseline.win) gripes.push(`${post.win - baseline.win} window listener(s) not removed`);
    if (post.ros > post.dis) gripes.push(`${post.ros - post.dis} ResizeObserver(s) never disconnected`);
    if (gripes.length) bad('teardown from mid-drag left something live', gripes.join(' · '));
    else ok(`left mid-drag with a pointer captured: host gone, 0 game nodes, 0 bp- animations, 0 armed timers, window listeners back to ${post.win}, ${post.dis} of ${post.ros} observers disconnected`);

    const backHome = await s.page.evaluate(() => {
      const p = document.querySelector('.pad-btn[data-id="7"]');
      if (!p) return false;
      if (document.getElementById('gamesChrome')) return false;
      const r = p.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!(e && p.contains(e));
    });
    if (!backHome) bad('after leaving mid-drag the console was not reachable');
    else ok('and the console is reachable in one tap from there');

    if (s.errs.length) bad(`${s.errs.length} uncaught page error(s)`, s.errs.slice(0, 3).join(' | '));
    else ok('no uncaught page errors throughout');
    await s.ctx.close();
  }
  });

} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n::error::CHECK 21 FAILED — ${failures.length} — Block Pop does not do what PUP-WO-0400 §3 requires.`);
  console.error(`\nCHECK 21 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 21 PASSED at ${COMMIT.slice(0, 12)} — Block Pop lays out inside three real phones, places by drag and by tap, clears a line and scores it, re-pops nothing while a finger crosses the board, strands nothing inside the clear window, retains no state across a remount, and leaves nothing live when the child walks away mid-drag.`);
