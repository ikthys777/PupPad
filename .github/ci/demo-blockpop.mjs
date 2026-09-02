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

const PIN_DOT = 0;
const PIN_TRI = 0.390625;

const FLEET = [
  { name: 'S10+', width: 869, height: 412 },
  { name: 'S20U', width: 915, height: 412 },
  { name: 'S25U', width: 883, height: 412 },
];

/* Pins the deal AND instruments teardown. Runs before any page script. */
const HARNESS = (pin) => {
  /* The deal pin. 0 makes pickWeighted return the first survivor of the mode filter —
   * `dot`. THAT HIDES THINGS, and the blindness pass proved it: a 1x1 is the one shape
   * whose grab offset cannot be wrong and whose ghost is one cell, so a hit test correct
   * for a dot and wrong for every polyomino passed. 0.390625 lands on `tri-h` in a full
   * easy pool (roll 25 of 64: 25-8-7-7 = 3, then -6 <= 0). Sections that need a
   * multi-cell piece ask for it. */
  Math.random = () => pin;
  const T = { addedWin: new Map(), timers: new Set(), intervals: new Set(), rafs: new Set(),
    ros: 0, roDisconnects: 0, anim: { pop: 0, clear: 0 } };
  window.__bp = T;
  const aEL = window.addEventListener.bind(window);
  const rEL = window.removeEventListener.bind(window);
  window.addEventListener = function (t, f, o) { T.addedWin.set(f, (T.addedWin.get(f) || 0) + 1); return aEL(t, f, o); };
  window.removeEventListener = function (t, f, o) {
    const n = (T.addedWin.get(f) || 0) - 1;
    if (n <= 0) T.addedWin.delete(f); else T.addedWin.set(f, n);
    return rEL(t, f, o);
  };
  /* ATTRIBUTE, DO NOT COUNT. The shell arms its own timers while the game is up — the
   * console's radar spawns a 2100ms paw print on pointerup (index.html:3280), and the
   * exit tap arms one. Counting every armed timeout made teardown look leaky when the
   * survivor was the SHELL's. Attribute by arming stack instead: a timer whose stack
   * names games/blockpop.js is the game's, and only those are the game's to clear. */
  const mine = (e) => String((e && e.stack) || '').indexOf('blockpop.js') >= 0;
  const sT = window.setTimeout.bind(window);
  const cT = window.clearTimeout.bind(window);
  window.setTimeout = function (fn, ms, ...a) {
    const own = mine(new Error());
    const id = sT(function () { T.timers.delete(id); return fn.apply(this, a); }, ms);
    if (own) T.timers.add(id);
    return id;
  };
  window.clearTimeout = function (id) { T.timers.delete(id); return cT(id); };
  /* setTimeout ALONE IS NOT "no timers left". A module leaking a 250ms setInterval ran
   * on happily past teardown while section 8 printed "0 armed timers" — demonstrated
   * green. rAF the same. */
  const sI = window.setInterval.bind(window);
  const cI = window.clearInterval.bind(window);
  window.setInterval = function (fn, ms, ...a) {
    const own = mine(new Error());
    const id = sI(fn, ms, ...a);
    if (own) T.intervals.add(id);
    return id;
  };
  window.clearInterval = function (id) { T.intervals.delete(id); return cI(id); };
  const rAF = window.requestAnimationFrame.bind(window);
  const cAF = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = function (fn) {
    const id = rAF(function (t) { T.rafs.delete(id); return fn(t); });
    T.rafs.add(id); return id;
  };
  window.cancelAnimationFrame = function (id) { T.rafs.delete(id); return cAF(id); };
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
async function shape(vp, pin = 0) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
  await ctx.addInitScript(HARNESS, pin);
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
    /* RECTANGLES ARE NOT PLAYABILITY. A 39x39 board and a tray of 1px pieces both
     * satisfied "on screen, not in the exit's column" and this section called them ok —
     * and sections 2-4 passed too, because a synthetic tap on the exact geometric centre
     * of a 2px cell lands, and no finger can do that. A synthetic tap on a mathematical
     * centre is not a finger either. */
    const play = await s.page.evaluate(() => {
      const bw = document.querySelector('.bp-boardwrap');
      const g = document.querySelector('.bp-grid');
      const w0 = document.querySelector('.bp-well');
      const pcs = [...document.querySelectorAll('.bp-piececell')].map((e) => e.getBoundingClientRect().width);
      const br = bw.getBoundingClientRect();
      const gr = g.getBoundingClientRect();
      const wr = w0.getBoundingClientRect();
      return { boardW: br.width, boardH: br.height, gridW: gr.width, cell: wr.width,
        pieceCells: pcs.length, minPieceCell: pcs.length ? Math.min(...pcs) : 0, vh: innerHeight };
    });
    /* THE PREMISE ROADMAP P4 GATE 4 RESTS ON. That gate — "with all text covered, the
     * board and tray are operable" — is a human one and simulating it is a flag-and-stop.
     * What CAN be asserted is that there is nothing to cover: no letter is painted
     * anywhere inside host. Check 19 holds the same line for the control panel. */
    const letters = await s.page.evaluate(() => {
      const h = document.getElementById('gameHost');
      if (!h) return ['no host'];
      const out = [];
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        /* A <style> element's rules are text nodes too, and they are full of letters.
         * What invariant 1 is about is a word the child can SEE. */
        const tag = n.parentNode && n.parentNode.nodeName;
        if (tag === 'STYLE' || tag === 'SCRIPT') continue;
        const t = (n.nodeValue || '').trim();
        if (t && /[A-Za-z]/.test(t)) out.push(t.slice(0, 40));
      }
      return out;
    });
    const MIN_TOUCH = 44;
    const offscreen = geo.out.filter((e) => e.x < 0 || e.y < 0 || e.x + e.w > geo.vw + 0.5 || e.y + e.h > geo.vh + 0.5);
    const inBack = geo.back
      ? geo.out.filter((e) => e.x < geo.back.x + geo.back.w && e.x + e.w > geo.back.x
          && e.y < geo.back.y + geo.back.h && e.y + e.h > geo.back.y)
      : [];
    if (offscreen.length) bad(`${vp.name} ${vp.width}x${vp.height}: ${offscreen.length} of ${geo.out.length} game control(s) lie outside the viewport`,
      offscreen.slice(0, 3).map((e) => `${e.q} at ${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}x${Math.round(e.h)}`).join(' · '));
    else if (inBack.length) bad(`${vp.name}: ${inBack.length} game control(s) intersect #gameBack's column (x ${Math.round(geo.back.x)}-${Math.round(geo.back.x + geo.back.w)})`,
      inBack.slice(0, 3).map((e) => `${e.q} at ${Math.round(e.x)},${Math.round(e.y)}`).join(' · '));
    else if (letters.length) bad(`${vp.name}: ${letters.length} painted word(s) inside host — invariant 1`,
      JSON.stringify(letters.slice(0, 3)))
    else if (Math.abs(play.boardW - play.boardH) > 1)
      bad(`${vp.name}: the board is not square (${play.boardW.toFixed(1)} x ${play.boardH.toFixed(1)})`);
    else if (play.boardH < play.vh * 0.8)
      bad(`${vp.name}: the board is ${play.boardH.toFixed(0)}px tall in a ${play.vh}px viewport — the height is meant to be what drives it`,
        'a board far smaller than the available height means the layout rule stopped binding');
    else if (play.cell < MIN_TOUCH)
      bad(`${vp.name}: a board cell is ${play.cell.toFixed(1)}px, under the ${MIN_TOUCH}px minimum touch target`);
    else if (!play.pieceCells)
      bad(`${vp.name}: the tray renders no piece cells at all — three empty boxes`);
    else if (play.minPieceCell < 8)
      bad(`${vp.name}: the smallest tray piece cell is ${play.minPieceCell.toFixed(1)}px — the tray reads as empty`);
    else ok(`${vp.name} ${vp.width}x${vp.height}: all ${geo.out.length} controls on screen, none in the exit's column; board ${Math.round(geo.board.w)}x${Math.round(geo.board.h)} square at x=${Math.round(geo.board.x)}, cell ${play.cell.toFixed(1)}px (>= ${MIN_TOUCH}), ${play.pieceCells} tray piece cells, smallest ${play.minPieceCell.toFixed(1)}px, and no painted word anywhere inside host`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(2, async () => {
  console.log('\n--- 2. a touch-drag from a tray slot to a cell fills it; an illegal drop does not ---');
  {
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    /* AIM THE PICTURE, NOT THE FINGER — and this section used to do the opposite.
     * It dragged to cell 2,2 and asserted 2,2 filled: the dispatched coordinate against
     * itself, which is precisely the shape that let the drag paint itself 58px above the
     * hole it fell into for a whole work order. Now it reads the GHOST just before the
     * drop and asserts the cells that fill are the cells that were previewed. §11 carries
     * the harder half — that the ghost is painted where it says it is. */
    const readGhostCells = () => s.page.evaluate(() =>
      [...document.querySelectorAll('.bp-ghost')].filter((g) => !g.hidden)
        .map((g) => { const w = g.closest('.bp-well'); return w.getAttribute('data-row') + ',' + w.getAttribute('data-col'); }).sort());

    const dragAndRead = async (tx, ty) => {
      const i = Math.max(0, await s.firstFullSlot());
      const g = await s.page.evaluate((k) => {
        const r = document.querySelector(`.bp-slot[data-slot="${k}"] .bp-piece`).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, i);
      const was = new Set((await s.boardState()).filter((c) => c.filled).map((c) => c.r + ',' + c.c));
      await s.touch('touchStart', [{ x: g.x, y: g.y, id: 1 }]);
      for (let n = 1; n <= 8; n++) {
        await s.touch('touchMove', [{ x: g.x + (tx - g.x) * (n / 8), y: g.y + (ty - g.y) * (n / 8), id: 1 }]);
        await s.wait(12);
      }
      const ghost = await readGhostCells();
      const kinds = await s.page.evaluate(() =>
        [...document.querySelectorAll('.bp-ghost')].filter((g2) => !g2.hidden).map((g2) => g2.className));
      await s.touch('touchEnd', []);
      await s.wait(150);
      const now = (await s.boardState()).filter((c) => c.filled && !was.has(c.r + ',' + c.c))
        .map((c) => c.r + ',' + c.c).sort();
      return { ghost, kinds, placed: now };
    };

    const mid = await s.rect('.bp-well[data-row="3"][data-col="2"]');
    const one = await dragAndRead(mid.cx, mid.cy);
    if (!one.ghost.length) bad('a drag over the board previewed nothing');
    else if (JSON.stringify(one.placed) !== JSON.stringify(one.ghost))
      bad('the cells that filled are not the cells the ghost previewed',
        `previewed ${JSON.stringify(one.ghost)}, filled ${JSON.stringify(one.placed)}`);
    else ok(`a drag placed exactly the cell(s) it previewed: ${JSON.stringify(one.placed)}`);

    /* An illegal drop: aim the picture at the cell just filled. */
    const occupied = one.placed[0].split(',');
    const occRect = await s.rect(`.bp-well[data-row="${occupied[0]}"][data-col="${occupied[1]}"]`);
    const two = await dragAndRead(occRect.cx, occRect.cy + (mid.cy - (await s.rect(`.bp-well[data-row="${occupied[0]}"][data-col="${occupied[1]}"]`)).cy));
    if (two.placed.length) bad(`a drop onto an occupied cell placed anyway`, `filled ${JSON.stringify(two.placed)}`);
    else if (two.kinds.length && two.kinds.every((k) => k.indexOf('bp-ghost-ok') >= 0))
      bad('the ghost showed a legal preview over an occupied cell');
    else ok('a drop whose preview covered an occupied cell placed nothing');    await s.ctx.close();

    /* THE GHOST IS THE ONLY THING THAT TELLS HIM WHERE IT WILL LAND, and nothing here
     * asserted it. A renderGhost that paints every hovered cell green — a green preview
     * over an illegal drop — passed the whole check. So did no ghost at all. Done with a
     * THREE-WIDE piece, because a dot's ghost is one cell and its grab offset cannot be
     * wrong: the grabCell defect this found was invisible to a dot by construction. */
    const t = await shape(FLEET[0], PIN_TRI);
    await t.openBlocks({ clearStorage: true });
    const shp = await t.page.evaluate(() => {
      const h = document.getElementById('gameHost');
      return [...document.querySelectorAll('.bp-slot')].map((sl) => sl.querySelectorAll('.bp-piececell').length);
    });
    /* Each grab must leave the board and the tray EXACTLY as it found them, or the
     * second grab is measuring a different piece. So the finger leaves the grid before
     * lifting — far enough that it is not a tap either. */
    const readGhost = () => t.page.evaluate(() =>
      [...document.querySelectorAll('.bp-ghost')].filter((g) => !g.hidden)
        .map((g) => { const w = g.closest('.bp-well'); return w.getAttribute('data-row') + ',' + w.getAttribute('data-col'); }).sort());
    const dragFrom = async (frac) => {
      const b = await t.page.evaluate((f) => {
        const bb = document.querySelector('.bp-slot[data-slot="0"] .bp-piece').getBoundingClientRect();
        const c = document.querySelector('.bp-well[data-row="3"][data-col="3"]').getBoundingClientRect();
        const tr = document.querySelector('.bp-tray').getBoundingClientRect();
        return { sx: bb.x + bb.width * f, sy: bb.y + bb.height / 2,
          cx: c.x + c.width / 2, cy: c.y + c.height / 2,
          awayX: tr.x + tr.width - 12, awayY: tr.y + tr.height - 12 };
      }, frac);
      await t.touch('touchStart', [{ x: b.sx, y: b.sy, id: 1 }]);
      for (let i = 1; i <= 6; i++) {
        await t.touch('touchMove', [{ x: b.sx + (b.cx - b.sx) * (i / 6), y: b.sy + (b.cy - b.sy) * (i / 6), id: 1 }]);
        await t.wait(14);
      }
      const g = await readGhost();
      await t.touch('touchMove', [{ x: b.awayX, y: b.awayY, id: 1 }]);
      await t.wait(20);
      await t.touch('touchEnd', []);
      await t.wait(120);
      return g;
    };
    const gLeft = await dragFrom(0.15);
    const gRight = await dragFrom(0.85);
    if (!shp.some((n) => n >= 3)) bad('the deal pin did not produce a multi-cell piece', `tray piece cell counts ${JSON.stringify(shp)}`);
    else if (!gLeft.length || !gRight.length) bad('a three-wide piece dragged over the board showed no ghost at all',
      `left grab ${JSON.stringify(gLeft)} right grab ${JSON.stringify(gRight)}`);
    else if (JSON.stringify(gLeft) === JSON.stringify(gRight)) bad('the ghost did not move with the grab point — the piece is unaimable',
      `grabbing the left end and the right end of a 3-wide piece both previewed ${JSON.stringify(gLeft)}; the grab column is being computed against the wrong rectangle`);
    else ok(`a 3-wide piece: grabbing its left end previews ${JSON.stringify(gLeft)} and its right end ${JSON.stringify(gRight)} — the ghost follows the grab`);

    /* AND IT MUST TELL THE TRUTH ABOUT LEGALITY. A renderGhost that paints every
     * hovered cell green passed everything above: the positions were right, the colour
     * was a lie. Hang the 3-wide piece off the right edge — columns 5,6,7 of a 6-wide
     * board — so the drop is illegal and the preview must say so. */
    const illegalGhost = await t.page.evaluate(async () => {
      const b = document.querySelector('.bp-slot[data-slot="0"] .bp-piece').getBoundingClientRect();
      const c = document.querySelector('.bp-well[data-row="3"][data-col="5"]').getBoundingClientRect();
      return { sx: b.x + b.width * 0.15, sy: b.y + b.height / 2, cx: c.x + c.width / 2, cy: c.y + c.height / 2 };
    });
    await t.touch('touchStart', [{ x: illegalGhost.sx, y: illegalGhost.sy, id: 1 }]);
    for (let i = 1; i <= 6; i++) {
      await t.touch('touchMove', [{ x: illegalGhost.sx + (illegalGhost.cx - illegalGhost.sx) * (i / 6),
        y: illegalGhost.sy + (illegalGhost.cy - illegalGhost.sy) * (i / 6), id: 1 }]);
      await t.wait(14);
    }
    const kinds = await t.page.evaluate(() =>
      [...document.querySelectorAll('.bp-ghost')].filter((g) => !g.hidden).map((g) => g.className));
    await t.touch('touchEnd', []);
    await t.wait(140);
    if (!kinds.length) bad('a 3-wide piece hanging off the right edge previewed nothing at all');
    else if (kinds.some((k) => k.indexOf('bp-ghost-ok') >= 0))
      bad('the ghost showed a LEGAL preview for a drop that hangs off the board',
        `classes ${JSON.stringify(kinds)} — a green preview over an illegal drop is worse than no preview`);
    else ok(`a 3-wide piece hung off the right edge previews as illegal (${kinds.length} cell(s), all bp-ghost-no)`);

    /* And the ghost must be gone once the drag ends. */
    const truth = await t.page.evaluate(async () => {
      const wells = [...document.querySelectorAll('.bp-well')];
      const filled = wells.filter((w) => { const c = w.querySelector('.bp-candy'); return c && !c.hidden; }).length;
      return { filled };
    });
    const illegal = await t.page.evaluate(() => {
      const g = [...document.querySelectorAll('.bp-ghost')].filter((x) => !x.hidden);
      return g.map((x) => x.className);
    });
    if (illegal.length) bad('a ghost is still painted after the drag ended', JSON.stringify(illegal));
    else ok(`the ghost is cleared when the drag ends (board holds ${truth.filled})`);
    await t.ctx.close();
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

    /* THE OTHER DIRECTION, AND ONLY THE CONTROL FOUND IT MISSING. Planting
     * TAP_SLOP = 14 goes red; planting TAP_SLOP = 1e9 went GREEN. An unbounded slop
     * makes every abandoned drag arm a piece, so a child who drags somewhere illegal and
     * lifts has silently selected it — and his next touch anywhere on the board places
     * it. A slop gate needs both ends asserted. */
    await s.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    const sel0 = await s.page.evaluate(() =>
      [...document.querySelectorAll('.bp-slot')].map((x) => x.getAttribute('data-active')).join(''));
    /* FROM A SLOT THAT STILL HOLDS A PIECE. The placement just above consumed slot 0,
     * so dragging from it started no drag at all and this clause passed whatever the
     * slop was — green against TAP_SLOP = 1e9. */
    const fullIdx = Math.max(0, await s.firstFullSlot());
    const far = await s.page.evaluate((i) => {
      const b = document.querySelector(`.bp-slot[data-slot="${i}"]`).getBoundingClientRect();
      const tr = document.querySelector('.bp-tray').getBoundingClientRect();
      /* End OFF THE GRID — inside the tray column, far corner. A long drag that ends on
       * a legal cell simply places, which tells us nothing about the slop gate. */
      return { x: b.x + b.width / 2, y: b.y + b.height / 2,
        ex: tr.x + tr.width - 10, ey: tr.y + tr.height - 10 };
    }, fullIdx);
    await s.touch('touchStart', [{ x: far.x, y: far.y, id: 1 }]);
    for (let i = 1; i <= 8; i++) {
      await s.touch('touchMove', [{ x: far.x + (far.ex - far.x) * (i / 8), y: far.y + (far.ey - far.y) * (i / 8), id: 1 }]);
      await s.wait(12);
    }
    await s.touch('touchEnd', []);
    await s.wait(140);
    const sel1 = await s.page.evaluate(() =>
      [...document.querySelectorAll('.bp-slot')].map((x) => x.getAttribute('data-active')).join(''));
    if (sel1.indexOf('1') >= 0 && sel0.indexOf('1') < 0)
      bad('a long drag that ended nowhere legal still selected the piece — the slop gate has no upper bound',
        `slot active flags went ${sel0} -> ${sel1}; his next touch on the board would place it`);
    else ok('a long drag ending off the grid selected nothing');
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

    /* A COLUMN, because deleting the column scan outright left the whole check green. */
    await s.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    for (let r = 0; r < 6; r++) await s.placeAt(r, 0);
    await s.page.waitForTimeout(400);
    const col = (await s.boardState()).filter((c) => c.c === 0 && c.filled);
    if (col.length) bad(`column 0 did not clear — ${col.length} of 6 cells still filled`,
      'rows clear and columns do not; clearFullLines is only scanning one axis');
    else ok('six dots filled column 0 and it cleared too');

    /* A COMBO ABOVE 1, because `combo = 0` in place of `combo + 1` left it green: the
     * multiplier is 1 at combo 1, so one clearing placement can never tell them apart.
     * Two CONSECUTIVE clearing placements — no non-clearing move between, or combo
     * resets — put the multiplier at 2. */
    const t2 = await shape(FLEET[0], PIN_DOT);
    await t2.openBlocks({ clearStorage: true });
    for (let c = 0; c < 5; c++) await t2.placeAt(0, c);
    for (let c = 0; c < 5; c++) await t2.placeAt(1, c);
    await t2.placeAt(0, 5);
    const preCombo = (await t2.seam()).score;
    await t2.placeAt(1, 5);
    await t2.page.waitForTimeout(400);
    const post = await t2.seam();
    /* 1 placed cell + 10 * 1 line * combo 2 = 21. At a stuck combo of 1 it would be 11. */
    if (post.combo < 2) bad(`the combo did not advance on consecutive clears (combo ${post.combo})`);
    else if (post.score - preCombo !== 21) bad('the combo multiplier is not reaching the score',
      `second consecutive clear scored ${post.score - preCombo}, expected 21 (1 cell + 10x1 line at combo 2); 11 means the multiplier is stuck at 1`);
    else ok(`two consecutive clears: combo reached ${post.combo} and the second scored +21 (1 cell + 10x1 line x combo 2)`);
    await t2.ctx.close();
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
    /* LIVENESS FIRST. "0 pops during the drag" is a one-sided counter, and zero is what
     * an inert game reports too: a build whose keyframes were emptied, a build whose
     * place() always returns false, and a build where no candy is ever shown ALL passed
     * this section. Establish that candies pop at all, and that there are candies, before
     * asserting that none popped. */
    const popsWhilePlacing = await s.page.evaluate(() => window.__bp.anim.pop);
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
    if (filledNow !== 8) bad(`the board holds ${filledNow} candies, not the 8 placed — nothing can be concluded about re-popping`,
      'an inert game reports 0 pops during a drag for the wrong reason');
    else if (popsWhilePlacing < 8) bad(`only ${popsWhilePlacing} pop animation(s) ran while placing 8 candies — this game does not animate`,
      'a build with no pop animation at all passes the assertion below, so it is asserted first');
    else if (during.pop !== 0) bad(`${during.pop} candy pop animation(s) restarted during a drag across a filled board`,
      `${filledNow} candies on the board; every one of them re-popping at pointer rate is the defect neither naive port survives`);
    else ok(`${popsWhilePlacing} pops while placing ${filledNow} candies, then a 28-step drag across them started 0`);
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
    const anim = await s.page.evaluate(() => ({ ...window.__bp.anim }));
    /* PRECONDITIONS, BECAUSE THE ASSERTION BELOW IS SATISFIED BY A GAME THAT NEVER
     * CLEARS. With row 0 still full the second placement is simply rejected, the target
     * cell is filled from the EARLIER placement, opacity is 1, and this section reports
     * ok — it was section 4 doing the work. Establish that a clear ran and that row 0
     * emptied before concluding anything about stranding. */
    const row0 = st.filter((c) => c.r === 0 && c.c > 0 && c.filled);
    /* Order matters: a STRANDED clear leaves its cells present-but-invisible, so the
     * row-0 precondition below would fire on them and report "did not clear" for what is
     * really "cleared and never let go". Diagnose the strand first. */
    if (!anim.clear) bad('no clear animation ran at all — this section cannot speak to a stranded clear',
      'a build that never clears a line, and a build with no clear animation, both satisfy the visibility assertion');
    else if (invisible.length) bad(`${invisible.length} candy/candies are on the board but invisible`,
      invisible.slice(0, 4).map((c) => `${c.r},${c.c} opacity ${c.opacity}`).join(' · ')
        + ' — .bp-clear is forwards to opacity 0 and the dying set was never released');
    else if (row0.length) bad(`row 0 did not clear (${row0.length} of its other 5 cells still filled) — nothing was ever in the clear window`);
    else if (!target || !target.filled) bad('the piece placed inside the clear window never landed');
    else if (target.opacity < 0.9) bad(`the candy placed inside the clear window is invisible (opacity ${target.opacity})`,
      'this is the source\'s stranded `clearing` state: .candy-clear is forwards to opacity 0 and nothing ever nulls it');
    else ok(`row 0 cleared (${anim.clear} clear animations), then a candy placed into just-cleared 0,0 inside the window is visible (opacity ${target.opacity}); all ${filled.length} candies on the board are`);
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
    /* THE BOARD IS NOT THE ONLY STATE. A module-scope `__retainedScore` written in
     * release() and read back at mount carried the score across entries and this section
     * went green, because it only counted candies. Ask the seam. */
    const seamAgain = await s.seam();
    if (played < 3) bad(`the first mount did not take the placements (${played} filled)`);
    else if (again !== 0) bad(`remounting with storage cleared brought back ${again} candy/candies — module state survived the teardown`);
    else if (!seamAgain || seamAgain.score !== 0 || seamAgain.combo !== 0 || seamAgain.over)
      bad(`the board came back empty but the seam did not`, `score ${seamAgain && seamAgain.score}, combo ${seamAgain && seamAgain.combo}, over ${seamAgain && seamAgain.over} — something outlived the teardown`);
    else ok(`played ${played} cells, left, cleared storage, came back to an empty board with score 0 and combo 0 — nothing retained in the module`);

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
    /* THE BASELINE MUST PREDATE THE GAME. Taken after openBlocks it already CONTAINS the
     * module's listeners, so `post.win > baseline.win` can never fire — deleting the
     * whole removeEventListener loop left this clause green. The comparison has to be
     * against a page that has never mounted the game. */
    await s.page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await s.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await s.page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    const baseline = await s.page.evaluate(() => ({
      win: window.__bp.addedWin.size, ros: window.__bp.ros, dis: window.__bp.roDisconnects,
      intervals: window.__bp.intervals.size,
    }));
    await s.openBlocks({ clearStorage: false });
    const live = await s.page.evaluate(() => ({ win: window.__bp.addedWin.size }));
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
    /* ORDER IS THE WHOLE TEST, AND THE FIRST VERSION HAD IT BACKWARDS.
     * `Input.dispatchTouchEvent{type:'touchEnd', touchPoints:[P]}` RELEASES P. Lifting id
     * 1 first ended the drag — onUp ran, the capture was released — and the exit then
     * fired against a finished drag holding zero captures. Green, against a state this
     * section was not written to test. The EXIT finger (id 2) must lift while the
     * dragging finger (id 1) is still down. */
    const dragLive = await s.page.evaluate(() => {
      const d = document.querySelector('.bp-drag');
      return !!(d && !d.hidden);
    });
    if (!dragLive) bad('no drag was live when the exit was pressed — this section is not testing teardown mid-drag',
      '.bp-drag is hidden, so onSlotDown never took a capture and the assertions below prove nothing');
    await s.touch('touchEnd', [{ x: back.cx, y: back.cy, id: 2 }]);
    await s.wait(80);
    await s.touch('touchEnd', [{ x: c.cx, y: c.cy, id: 1 }]);
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
      intervals: window.__bp.intervals.size,
      win: window.__bp.addedWin.size,
      ros: window.__bp.ros, dis: window.__bp.roDisconnects,
      /* ANYWHERE, not just in body. games/blockpop.js states the hazard itself: a <style>
       * appended to document.head survives endGameSession's body-only sweep unreported.
       * Moving the append to the head and dropping its removal left CHECK 21 green. */
      bpSheets: [...document.querySelectorAll('style')].filter((e) => (e.textContent || '').indexOf('.bp-') >= 0).length,
    }));
    const gripes = [];
    if (post.host || post.chrome) gripes.push('the host/chrome is still in the document');
    if (post.bpNodes) gripes.push(`${post.bpNodes} game node(s) still in the document`);
    if (post.anims) gripes.push(`${post.anims} bp- animation(s) still running`);
    if (post.timers > 0) gripes.push(`${post.timers} timeout(s) armed by the game still live`);
    if (post.intervals > baseline.intervals) gripes.push(`${post.intervals - baseline.intervals} interval(s) armed by the game still running`);
    if (post.bpSheets > 0) gripes.push(`${post.bpSheets} bp- stylesheet(s) still in the document`);
    if (live.win <= baseline.win) gripes.push(`the listener wrapper never observed the module adding any (baseline ${baseline.win}, with the game up ${live.win}) — this clause proves nothing`);
    if (post.win > baseline.win) gripes.push(`${post.win - baseline.win} window listener(s) not removed`);
    if (post.ros > post.dis) gripes.push(`${post.ros - post.dis} ResizeObserver(s) never disconnected`);
    if (gripes.length) bad('teardown from mid-drag left something live', gripes.join(' · '));
    else ok(`left mid-drag with a pointer captured: host gone, 0 game nodes, 0 bp- animations, 0 bp- stylesheets, 0 armed timeouts, 0 leaked intervals, window listeners ${baseline.win} -> ${live.win} with the game up -> ${post.win} after, ${post.dis} of ${post.ros} observers disconnected`);

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

  /* ------------------------------------------------------------------ */
  await section(9, async () => {
  console.log('\n--- 9. the board he put down is the board he picks up ---');
  {
    /* EVERY OTHER SECTION OPENS WITH clearStorage: true, so until this one existed the
     * save/resume path was never run with a non-empty save at all — and that is the path
     * Scotty asked for: the board is durable between app closes "in a way that
     * everything else doesn't", so it can be picked up and put back down. A resumed
     * score above 7 was silently zeroed by a colour-id validator and nothing saw it. */
    const s = await shape(FLEET[0]);
    await s.openBlocks({ clearStorage: true });
    for (let c = 0; c < 6; c++) await s.placeAt(0, c);
    for (const [r, c] of [[2, 1], [2, 2], [3, 1]]) await s.placeAt(r, c);
    await s.page.waitForTimeout(400);
    const beforeCells = (await s.boardState()).filter((x) => x.filled).map((x) => x.r + ',' + x.c).sort();
    const beforeSeam = await s.seam();
    const blob = await s.page.evaluate(() => { try { return localStorage.getItem('pupgame:blocks'); } catch (e) { return null; } });

    await s.fingerTap('#gameBack');
    await s.page.waitForTimeout(200);
    await s.fingerTap('.pad-btn[data-id="7"]');
    await s.page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await s.fingerTap('.pickerTile[data-game="blocks"]');
    await s.page.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await s.page.waitForTimeout(150);
    const afterCells = (await s.boardState()).filter((x) => x.filled).map((x) => x.r + ',' + x.c).sort();
    const afterSeam = await s.seam();

    if (!blob) bad('nothing was written to pupgame:blocks at all');
    else if (beforeSeam.score <= 7) bad(`the setup only reached a score of ${beforeSeam.score}`,
      'the resume bug this guards was a colour-id validator capping the score at 7, so the fixture must exceed it');
    else if (JSON.stringify(afterCells) !== JSON.stringify(beforeCells))
      bad('the board he put down is not the board he picked up',
        `left ${JSON.stringify(beforeCells)}, came back to ${JSON.stringify(afterCells)}`);
    else if (afterSeam.score !== beforeSeam.score)
      bad(`the score did not survive the resume (${beforeSeam.score} -> ${afterSeam.score})`,
        afterSeam.score === 0 ? 'zeroed entirely — a counter is being validated by a colour-id predicate bounded at COLOR_COUNT' : '');
    else ok(`left with ${beforeCells.length} candies and a score of ${beforeSeam.score}, came back to the same board and the same score`);
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(10, async () => {
  console.log('\n--- 10. the terminal state has exactly one way out, and it is not the exit ---');
  {
    /* DRIVE THE FILTER, DO NOT BYPASS IT. Game over is the state where
     * pickFittingPiece's hard filter comes back empty and the DOT fallback still does not
     * fit — which is only true of a completely full board. The fixture is therefore a
     * full board handed to api.load(), and everything downstream is the real code path:
     * dealTray runs the real filter, it returns empty, the fallback is a dot, and
     * anyTrayFits says no. Nothing here calls the seam to force a state.
     *
     * ARRIVING HERE BY PLAY IS IMPOSSIBLE IN EASY MODE and that is a property of the
     * design, not of this check: rescueUnplaceable swaps any unplaceable tray piece for
     * one that fits, and a dot fits wherever a single cell is free, so the board must be
     * entirely full — but the placement that fills a row clears it. Little Hands is
     * unlosable on purpose. See FEEDBACK.md. */
    const s = await shape(FLEET[0]);
    await s.page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await s.page.evaluate(() => {
      const full = [];
      for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 6; c++) row.push(1 + ((r + c) % 7)); full.push(row); }
      try { localStorage.setItem('pupgame:blocks', JSON.stringify({ v: 1, board: full, tray: [null, null, null], score: 40, combo: 0 })); } catch (e) {}
    });
    await s.page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    await s.fingerTap('.pad-btn[data-id="7"]');
    await s.page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await s.fingerTap('.pickerTile[data-game="blocks"]');
    await s.page.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await s.page.waitForTimeout(200);

    const over = await s.page.evaluate(() => {
      const h = document.getElementById('gameHost');
      const ov = document.querySelector('.bp-over');
      if (!ov) return { present: false, seam: h && h.blocks ? h.blocks.get() : null };
      const btns = [...ov.querySelectorAll('button')];
      const text = (ov.textContent || '').trim();
      return { present: true, controls: btns.length, text,
        inHost: !!(h && h.contains(ov)), seam: h.blocks.get() };
    });
    if (!over.present) bad('a full board did not raise the terminal state', `seam ${JSON.stringify(over.seam)}`);
    else if (!over.seam.over) bad('the overlay is up but the seam does not report the game as over');
    else if (!over.inHost) bad('the terminal affordance is not inside host — §8.5 requires it there');
    else if (over.controls !== 1) bad(`the terminal state offers ${over.controls} controls, not exactly one`);
    else if (/[a-zA-Z]/.test(over.text)) bad(`the terminal state paints a word: ${JSON.stringify(over.text)}`,
      'invariant 1 — every control operable by a non-reader');
    else ok(`a full board raised the terminal state: exactly one control inside host, no letters, glyph ${JSON.stringify(over.text)}`);

    if (over.present) {
      await s.fingerTap('#bpAgain');
      await s.page.waitForTimeout(300);
      const back = await s.page.evaluate(() => {
        const h = document.getElementById('gameHost');
        return { chrome: !!document.getElementById('gamesChrome'), host: !!h,
          overlay: !!document.querySelector('.bp-over'),
          filled: [...document.querySelectorAll('.bp-candy')].filter((c) => !c.hidden).length,
          seam: h && h.blocks ? h.blocks.get() : null };
      });
      if (!back.chrome || !back.host) bad('the play-again affordance closed the game — it must not call api.close()',
        'invariant 5: the way out of the STATE is not the way out of the game');
      else if (back.overlay) bad('one tap did not leave the terminal state');
      else if (back.filled !== 0 || back.seam.score !== 0) bad(`one tap left the state but not to a fresh board`,
        `${back.filled} candies, score ${back.seam.score}`);
      else ok('one tap on it resumed play with a fresh board, and the game is still open — api.close() was not called');
    }
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(11, async () => {
  console.log('\n--- 11. the cell the piece is PAINTED over is the cell that fills, and every row is reachable ---');
  {
    /* THE CHECK THAT WOULD HAVE CAUGHT IT, AND WHY THE OTHER TEN DID NOT.
     *
     * Every drag assertion above dispatches a touch at (x, y) and then asserts the cell
     * at (x, y) filled. BOTH HALVES READ THE SAME NUMBER. The drag proxy could be painted
     * 58px up, off the edge, or in another corner, and they would still agree, because
     * neither of them ever looks at a pixel. Architecture §6.1 member 7: a verification
     * that resolves the reference and stops one layer short of the frame it is expressed
     * in. A human with a hand on the glass found it in minutes.
     *
     * So this measures in a THIRD FRAME belonging to neither: SCREEN PIXELS. It reads the
     * painted rect of `.bp-drag` — the picture under the child's eye — while the finger
     * is still down, then drops, then reads the bounding rect of the cells that actually
     * filled, and asserts they are centred on the same place. Neither side is a
     * coordinate this file chose.
     *
     * THE LIFT IS MEASURED, NOT ASSUMED. Writing `cellPx * 0.9` here would recreate the
     * exact defect being fixed — two expressions that must agree, one of them in the
     * test. It is derived from the picture: lift = fingerY - paintedCentreY. */
    for (const vp of FLEET) {
      const s = await shape(vp, PIN_DOT);
      await s.openBlocks({ clearStorage: true });
      const geom = await s.page.evaluate(() => {
        const g = document.querySelector('.bp-grid').getBoundingClientRect();
        return { cell: g.width / 6, top: g.y, bottom: g.y + g.height, vh: innerHeight };
      });

      const grabPoint = async () => {
        const i = Math.max(0, await s.firstFullSlot());
        return s.page.evaluate((k) => {
          const r = document.querySelector(`.bp-slot[data-slot="${k}"] .bp-piece`).getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, i);
      };
      /* Drag to a finger point, report the painted rect there, then drop and report what
       * filled. One helper so coherence and reachability read the same machinery. */
      const dragTo = async (tx, ty, abort) => {
        const g = await grabPoint();
        const before = new Set((await s.boardState()).filter((x) => x.filled).map((x) => x.r + ',' + x.c));
        await s.touch('touchStart', [{ x: g.x, y: g.y, id: 1 }]);
        for (let i = 1; i <= 8; i++) {
          await s.touch('touchMove', [{ x: g.x + (tx - g.x) * (i / 8), y: g.y + (ty - g.y) * (i / 8), id: 1 }]);
          await s.wait(12);
        }
        const painted = await s.page.evaluate(() => {
          const d = document.querySelector('.bp-drag');
          if (!d || d.hidden) return null;
          const r = d.getBoundingClientRect();
          return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
        });
        /* The lift probe must not consume a tray piece or occupy a cell a later phase
         * aims at — it leaves the grid before lifting, so it measures and changes nothing.
         * (Its first version dropped a dot on the cell the coherence test then aimed at,
         * and reported "the drop placed nothing" against a correct build.) */
        if (abort) {
          const away = await s.page.evaluate(() => {
            const t = document.querySelector('.bp-tray').getBoundingClientRect();
            return { x: t.x + t.width - 10, y: t.y + t.height - 10 };
          });
          await s.touch('touchMove', [{ x: away.x, y: away.y, id: 1 }]);
          await s.wait(20);
        }
        await s.touch('touchEnd', []);
        await s.wait(150);
        const landed = (await s.boardState()).filter((x) => x.filled && !before.has(x.r + ',' + x.c));
        return { painted, landed };
      };

      /* 1. Derive the lift from the picture itself. */
      const probe = await dragTo((await s.rect('.bp-well[data-row="3"][data-col="3"]')).cx, geom.top + geom.cell * 3.5, true);
      if (!probe.painted) { bad(`${vp.name}: nothing was painted under the finger — .bp-drag was hidden mid-drag`); await s.ctx.close(); continue; }
      const LIFT = (geom.top + geom.cell * 3.5) - probe.painted.cy;

      /* 2. Coherence, at three arbitrary points that are NOT cell centres. */
      let worst = { d: -1, label: '', dx: 0, dy: 0 };
      let broke = null;
      for (const t of [
        { label: 'mid board', r: 2, c: 3, dx: 0.31, dy: -0.22 },
        { label: 'near the top', r: 0, c: 1, dx: -0.18, dy: 0.28 },
        { label: 'near the bottom', r: 5, c: 4, dx: 0.24, dy: -0.3 },
      ]) {
        /* Aim the PICTURE at the cell, which is what the child does — so the finger goes
         * a lift lower. Clamped into the viewport; a finger cannot leave the glass. */
        const wx = geom.top; void wx;
        const w = await s.rect(`.bp-well[data-row="${t.r}"][data-col="${t.c}"]`);
        const tx = w.x + w.w * (0.5 + t.dx);
        const ty = Math.min(geom.vh - 3, Math.max(3, w.y + w.h * (0.5 + t.dy) + LIFT));
        const r = await dragTo(tx, ty);
        if (!r.painted) { broke = `${t.label}: .bp-drag was hidden mid-drag`; break; }
        if (!r.landed.length) { broke = `${t.label}: the drop placed nothing, so there is no landed rect to compare`; break; }
        /* CONTAINMENT, NOT CENTRE-TO-CENTRE. The picture floats continuously with the
         * finger; a cell is discrete. Their centres differ by wherever inside the cell
         * the finger happens to be — up to half a cell, inherently, on a correct build.
         * The coherent statement is the one the work order asks for: THE CELL THE GHOST
         * VISUALLY COVERS IS THE CELL THAT FILLS. So: is the painted piece's centre
         * inside the rect of the cell that filled? At the old 58px lift it sat a full
         * cell height above it. */
        const cell0 = await s.page.evaluate((k) =>
          (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(
            document.querySelector(`.bp-well[data-row="${k.r}"][data-col="${k.c}"]`).getBoundingClientRect()),
          { r: r.landed[0].r, c: r.landed[0].c });
        const outX = Math.max(cell0.x - r.painted.cx, r.painted.cx - (cell0.x + cell0.w), 0);
        const outY = Math.max(cell0.y - r.painted.cy, r.painted.cy - (cell0.y + cell0.h), 0);
        const dist = Math.hypot(outX, outY);
        if (dist > worst.d) worst = { d: dist, label: t.label, dx: outX, dy: outY };
      }
      /* Zero, with 2px of slack for sub-pixel layout. The picture is either over the
       * cell it fills or it is not. */
      const TOL = 2;
      if (broke) bad(`${vp.name}: ${broke}`);
      else if (worst.d > TOL) bad(`${vp.name}: the piece is painted ${worst.d.toFixed(1)}px OUTSIDE the cell it lands in`,
        `worst ${worst.label}: ${worst.dx.toFixed(1)}px horizontally, ${worst.dy.toFixed(1)}px vertically off a ${geom.cell.toFixed(1)}px cell — he aims at the picture and the block goes elsewhere`);
      else ok(`${vp.name}: lift measured at ${LIFT.toFixed(1)}px; at mid-board, near the top and near the bottom the painted piece sits INSIDE the cell it fills`);

      /* 3. REACHABILITY, which is what a lift can quietly take away. A lifted hit point
       * leaves the grid at the extremes: to put the picture on the bottom row the finger
       * must go a lift BELOW it, and the finger cannot leave the glass. */
      const unreachable = [];
      const bands = [];
      for (let r = 0; r < 6; r++) {
        const w = await s.rect(`.bp-well[data-row="${r}"][data-col="0"]`);
        const lo = Math.max(3, w.y + LIFT);
        const hi = Math.min(geom.vh - 3, w.y + w.h + LIFT);
        bands.push(Math.max(0, hi - lo));
        const res = await dragTo(w.cx, Math.min(geom.vh - 3, Math.max(3, w.cy + LIFT)));
        if (!res.landed.some((x) => x.r === r)) unreachable.push(r);
      }
      /* AND THE CAP IS ASSERTED, NOT JUST ITS EFFECT. Every row stays "reachable" even
       * at an uncapped lift — the bottom one just shrinks to a 15px band — so
       * reachability alone cannot see the cap disappear. The cap's own rule can:
       * the applied lift may never exceed the room between the last row's centre and the
       * bottom of the glass. Derived from geometry, not from a number I chose. */
      const ROOM = geom.vh - (geom.bottom - geom.cell * 0.5);
      if (LIFT > ROOM + 1) bad(`${vp.name}: the drag lift is ${LIFT.toFixed(1)}px against ${ROOM.toFixed(1)}px of room below the last row`,
        `the finger cannot leave the glass, so every pixel over that is a pixel off the bottom row's touch band`);
      else if (unreachable.length) bad(`${vp.name}: row(s) ${unreachable.join(', ')} cannot be reached with the piece visible`,
        `the lift is ${LIFT.toFixed(1)}px on a ${geom.cell.toFixed(1)}px cell and the finger cannot leave the glass`);
      else ok(`${vp.name}: every one of the 6 rows is reachable; touch bands ${bands.map((b) => b.toFixed(0)).join('/')}px (narrowest ${Math.min(...bands).toFixed(0)}px)`);
      await s.ctx.close();
    }
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
