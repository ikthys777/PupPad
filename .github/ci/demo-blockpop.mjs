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

/* THE THREE FLEET VIEWPORTS ARE INDEPENDENT — separate browser contexts, separate pages,
 * no shared state — and running them one after another was the largest single cost in this
 * file, which is what pushed the CI job past its budget. They run concurrently now, with
 * each viewport's lines buffered and flushed in fleet order so a green log still reads
 * top to bottom. */
function buffered() {
  const lines = [];
  return {
    ok: (m) => lines.push(['ok', m]),
    bad: (m, d) => lines.push(['bad', m, d]),
    info: (m) => lines.push(['info', m]),
    flush: () => { for (const [k, m, d] of lines) (k === 'ok' ? ok : k === 'bad' ? (x) => bad(x, d) : info)(m); },
  };
}
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

/* The project's minimum touch target, applied to a board cell in §1 and to a row's drag
 * band in §11. One name, because the game was contradicting its own floor across two
 * clauses when they were two numbers. */
const MIN_TOUCH = 44;

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
  /* §8.3 says the shell owns the ONE AudioContext and does not hand it out, so the
   * question is not "was one made" — the shell makes one — but "did the MODULE make one".
   * Attributed by construction stack, the same way the timers are. */
  T.audio = { shell: 0, game: 0 };
  T.vibrations = [];
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const C = window[k];
    if (!C) continue;
    window[k] = new Proxy(C, {
      construct(target, args) {
        (mine(new Error()) ? T.audio.game++ : T.audio.shell++);
        return Reflect.construct(target, args);
      },
    });
  }
  if (navigator.vibrate) {
    const v = navigator.vibrate.bind(navigator);
    navigator.vibrate = function (p) { T.vibrations.push(p); return v(p); };
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

  /* THE CUE NAMES, OBSERVED. api.sound is frozen inside the shell, but it resolves the
   * global `doSound` at call time, so replacing that records exactly what the module
   * asked for — including a name outside the twelve banks, which doSound silently
   * ignores and which is therefore invisible any other way. */
  const recordCues = () => page.evaluate(() => {
    window.__cues = [];
    window.__cueUnknown = [];
    /* THE BANK LIST IS READ OUT OF THE SHELL, NOT PASTED HERE. A hardcoded copy grades
     * the module against this file's idea of the twelve banks: delete `lock` from
     * doSound's own table and the refusal goes silent while the check still calls the
     * name valid. Two expressions that must agree, one of them in the test. doSound's
     * table is a local inside its try block, so it is probed by CALLING it — a name that
     * exists produces a sound path, one that does not is a no-op — which is not
     * observable either. So: read the source of the shipped function and take the keys of
     * the object literal it switches on. If that ever stops parsing, the check says so
     * rather than silently trusting a stale list. */
    const src = String(window.doSound);
    const banks = [...src.matchAll(/(\w+)\s*:\s*function\s*\(/g)].map((m) => m[1]);
    window.__banks = banks;
    const real = window.doSound;
    window.doSound = function (name) {
      window.__cues.push(name);
      if (banks.indexOf(name) < 0) window.__cueUnknown.push(name);
      try { return real.apply(this, arguments); } catch (e) {}
    };
  });
  const cues = () => page.evaluate(() => ({ all: window.__cues.slice(), unknown: window.__cueUnknown.slice(), banks: window.__banks.slice() }));

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

  return { ctx, page, cdp, touch, wait, rect, tapTarget, fingerTap, fingerDragTo, firstFullSlot, placeAt, openBlocks, boardState, seam, recordCues, cues, errs };
}

try {
  /* ------------------------------------------------------------------ */
  await section(1, async () => {
  console.log('--- 1. every game-owned control is on the screen, and none of it is in the exit\'s column ---');
  const reports1 = await Promise.all(FLEET.map(async (vp) => {
    const R = buffered();
    const ok = R.ok, bad = R.bad;
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
    return R;
  }));
  for (const R of reports1) R.flush();
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
    const reports11 = await Promise.all(FLEET.map(async (vp) => {
      const R = buffered();
      const ok = R.ok, bad = R.bad, info = R.info;
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
          /* AN EMPTY BOX STILL HAS A RECT. A build whose drag proxy draws NOTHING — no
           * cells, or cells at zero size — passed every assertion below, because all of
           * them measure this rectangle and a rectangle comes from style, not from ink.
           * The child would see nothing follow his finger. */
          const cs = [...d.querySelectorAll('.bp-piececell')].map((e) => e.getBoundingClientRect())
            .filter((b) => b.width > 0 && b.height > 0);
          let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
          for (const b of cs) { ix0 = Math.min(ix0, b.x); iy0 = Math.min(iy0, b.y);
            ix1 = Math.max(ix1, b.x + b.width); iy1 = Math.max(iy1, b.y + b.height); }
          return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height,
            drawn: cs.length, minCell: cs.length ? Math.min(...cs.map((b) => b.width)) : 0,
            inkW: cs.length ? ix1 - ix0 : 0, inkH: cs.length ? iy1 - iy0 : 0 };
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
      if (!probe.painted) { bad(`${vp.name}: nothing was painted under the finger — .bp-drag was hidden mid-drag`); await s.ctx.close(); return R; }
      if (!probe.painted.drawn) { bad(`${vp.name}: the dragged piece draws no cells at all — an empty box follows the finger`,
        'every measurement here reads that box\'s rect, and a rect comes from style, not from ink'); await s.ctx.close(); return R; }
      if (probe.painted.minCell < geom.cell * 0.5) { bad(`${vp.name}: the dragged piece renders at ${probe.painted.minCell.toFixed(1)}px against a ${geom.cell.toFixed(1)}px board cell`,
        'what follows the finger must be the size it will land at'); await s.ctx.close(); return R; }
      if (Math.abs(probe.painted.inkW - probe.painted.w) > geom.cell * 0.35 || Math.abs(probe.painted.inkH - probe.painted.h) > geom.cell * 0.35)
        bad(`${vp.name}: the drag proxy's box (${probe.painted.w.toFixed(0)}x${probe.painted.h.toFixed(0)}) is not the size of what it draws (${probe.painted.inkW.toFixed(0)}x${probe.painted.inkH.toFixed(0)})`,
          'the rect this section measures is not the picture the child sees');
      const LIFT = (geom.top + geom.cell * 3.5) - probe.painted.cy;

      /* AIM BY OBSERVATION, NOT BY PREDICTION. §1b makes the lift a function of y, so
       * "finger = target + LIFT" — a prediction from one constant — aims at the wrong
       * place wherever the taper is active, and it failed a CORRECT build by 11px. The
       * check must not carry a model of the lift at all: drag, read where the picture
       * actually is, correct by the residual, repeat. Three passes converge to under a
       * pixel and none of them places anything. */
      const aimPicture = async (tx, ty) => {
        let fy = Math.min(geom.vh - 3, Math.max(3, ty + LIFT));
        for (let k = 0; k < 3; k++) {
          const pr = await dragTo(tx, fy, true);
          if (!pr.painted) break;
          const err = ty - pr.painted.cy;
          if (Math.abs(err) < 1) break;
          fy = Math.min(geom.vh - 3, Math.max(3, fy + err));
        }
        return fy;
      };

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
        const ty = await aimPicture(tx, w.y + w.h * (0.5 + t.dy));
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
      /* AND ONE AIM WHERE THE ANSWER IS ZERO. Containment tolerates up to half a cell in
       * each axis on a CORRECT build, because the picture floats and the cell is discrete
       * — so a 20px horizontal desync and a 12px lift error both sat inside it and were
       * green. Aim the picture at an exact cell centre and the expected offset is 0, so
       * any desync shows up at its true size. */
      {
        const w3 = await s.rect('.bp-well[data-row="5"][data-col="2"]');
        const fy3 = await aimPicture(w3.cx, w3.cy);
        const r3 = await dragTo(w3.cx, fy3, true);
        if (!r3.painted) bad(`${vp.name}: nothing painted on the centred aim`);
        else {
          const ex = Math.abs(r3.painted.cx - w3.cx);
          const ey = Math.abs(r3.painted.cy - w3.cy);
          if (ex > 4 || ey > 4) bad(`${vp.name}: aimed at the BOTTOM row's centre, the picture lands ${ex.toFixed(1)},${ey.toFixed(1)}px off it`,
            'on a coherent build this is zero — the picture and the drop are computed from different points');
          else ok(`${vp.name}: aimed at the bottom row's centre — deep inside the taper — the picture sits ${ex.toFixed(1)},${ey.toFixed(1)}px off it`);
        }
        /* AND A BOUNDARY AIM, because a centre aim forgives a small desync: resolving the
         * drop a few pixels from where the picture is drawn still lands in the same cell
         * when the picture is mid-cell. Put the picture just inside a cell's top edge and
         * any disagreement between the two crosses into the row above. */
        const wb = await s.rect('.bp-well[data-row="3"][data-col="4"]');
        const fyb = await aimPicture(wb.cx, wb.y + 4);
        const rb = await dragTo(wb.cx, fyb);
        if (!rb.landed.length) bad(`${vp.name}: a drop aimed just inside a cell's top edge placed nothing`);
        else if (!rb.landed.some((x) => x.r === 3 && x.c === 4)) bad(`${vp.name}: the picture was drawn just inside cell 3,4 and the piece landed in ${JSON.stringify(rb.landed.map((x) => x.r + ',' + x.c))}`,
          'the drop is resolved from a different point than the picture is drawn at');
        else ok(`${vp.name}: a picture drawn 4px inside cell 3,4's top edge lands in 3,4`);
      }

      /* AND THE PROXY MUST BE THE PIECE'S SIZE, WHICH A 1x1 CANNOT SHOW. A build whose
       * proxy is always one cell is identical to a correct one for a dot. */
      {
        const t3 = await shape(vp, PIN_TRI);
        await t3.openBlocks({ clearStorage: true });
        const gp3 = await t3.page.evaluate(() => {
          const r = document.querySelector('.bp-slot[data-slot="0"] .bp-piece').getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        const mid3 = await t3.rect('.bp-well[data-row="3"][data-col="2"]');
        await t3.touch('touchStart', [{ x: gp3.x, y: gp3.y, id: 1 }]);
        for (let i = 1; i <= 6; i++) {
          await t3.touch('touchMove', [{ x: gp3.x + (mid3.cx - gp3.x) * (i / 6), y: gp3.y + (mid3.cy - gp3.y) * (i / 6), id: 1 }]);
          await t3.wait(12);
        }
        const px = await t3.page.evaluate(() => {
          const d = document.querySelector('.bp-drag');
          const r = d.getBoundingClientRect();
          const cs = [...d.querySelectorAll('.bp-piececell')].map((e) => e.getBoundingClientRect());
          const g = document.querySelector('.bp-grid').getBoundingClientRect();
          return { boxW: r.width, boxH: r.height, cells: cs.length, cell: g.width / 6 };
        });
        await t3.touch('touchEnd', []);
        await t3.wait(120);
        if (px.cells < 3) bad(`${vp.name}: a 3-wide piece drags as ${px.cells} cell(s)`);
        else if (px.boxW < px.cell * 2.5) bad(`${vp.name}: a 3-wide piece drags in a ${px.boxW.toFixed(0)}px box against a ${px.cell.toFixed(0)}px cell`,
          'the proxy is not the size of the piece — it will not look like what lands');
        else ok(`${vp.name}: a 3-wide piece drags as ${px.cells} cells in a ${px.boxW.toFixed(0)}x${px.boxH.toFixed(0)} box (cell ${px.cell.toFixed(0)})`);
        await t3.ctx.close();
      }

      const TOL = 2;
      if (broke) bad(`${vp.name}: ${broke}`);
      else if (worst.d > TOL) bad(`${vp.name}: the piece is painted ${worst.d.toFixed(1)}px OUTSIDE the cell it lands in`,
        `worst ${worst.label}: ${worst.dx.toFixed(1)}px horizontally, ${worst.dy.toFixed(1)}px vertically off a ${geom.cell.toFixed(1)}px cell — he aims at the picture and the block goes elsewhere`);
      else ok(`${vp.name}: lift measured at ${LIFT.toFixed(1)}px; at mid-board, near the top and near the bottom the painted piece sits INSIDE the cell it fills`);

      /* 2b. WHERE THE GHOST IS PAINTED. Nothing in this file asserted it: §2 reads the
       * ghost's DOM PARENT (`closest('.bp-well')`), never its geometry, so a ghost given
       * `transform: translateY(-72%)` — painted a cell away from the well it belongs to —
       * was green everywhere, and §2's comment claiming this section covered it was
       * false. A ghost is the child's only preview; where it is drawn IS the feature. */
      {
        const w2 = await s.rect('.bp-well[data-row="2"][data-col="2"]');
        const g2 = await grabPoint();
        await s.touch('touchStart', [{ x: g2.x, y: g2.y, id: 1 }]);
        for (let i = 1; i <= 8; i++) {
          await s.touch('touchMove', [{ x: g2.x + (w2.cx - g2.x) * (i / 8), y: g2.y + (w2.cy + LIFT - g2.y) * (i / 8), id: 1 }]);
          await s.wait(12);
        }
        const gp = await s.page.evaluate(() => [...document.querySelectorAll('.bp-ghost')]
          .filter((e) => !e.hidden).map((e) => {
            const r = e.getBoundingClientRect();
            const q = e.closest('.bp-well').getBoundingClientRect();
            return { dx: (r.x + r.width / 2) - (q.x + q.width / 2), dy: (r.y + r.height / 2) - (q.y + q.height / 2),
              w: r.width, h: r.height, pw: q.width };
          }));
        /* Leave the grid before lifting: this block measures, it must not occupy a cell
         * the reachability loop below then reports as unreachable. */
        const away2 = await s.page.evaluate(() => {
          const t = document.querySelector('.bp-tray').getBoundingClientRect();
          return { x: t.x + t.width - 10, y: t.y + t.height - 10 };
        });
        await s.touch('touchMove', [{ x: away2.x, y: away2.y, id: 1 }]);
        await s.wait(20);
        await s.touch('touchEnd', []);
        await s.wait(140);
        const strayed = gp.filter((q) => Math.abs(q.dx) > q.pw * 0.2 || Math.abs(q.dy) > q.pw * 0.2);
        const tiny = gp.filter((q) => q.w < q.pw * 0.4 || q.h < q.pw * 0.4);
        if (!gp.length) bad(`${vp.name}: the drag previewed no ghost at all`);
        else if (strayed.length) bad(`${vp.name}: a ghost is painted ${strayed[0].dx.toFixed(1)},${strayed[0].dy.toFixed(1)}px from the centre of the cell it marks`,
          'the preview is drawn somewhere other than the cell it claims');
        else if (tiny.length) bad(`${vp.name}: a ghost is drawn ${tiny[0].w.toFixed(1)}x${tiny[0].h.toFixed(1)} inside a ${tiny[0].pw.toFixed(1)}px cell — too small to read`);
        else ok(`${vp.name}: every ghost is painted centred in the cell it marks (worst offset ${Math.max(...gp.map((q) => Math.hypot(q.dx, q.dy))).toFixed(1)}px)`);
      }

      /* 2c. THE MAPPING MUST NEVER RUN BACKWARDS. §1b tapers the lift toward zero over
       * the last 1.5 cells of glass, and a taper is a function of y inside a mapping that
       * is also a function of y: the drop resolves at y - lift(y). If the lift shed faster
       * than the finger travels, THE PIECE WOULD CLIMB THE BOARD AS THE FINGER MOVED DOWN
       * — an inversion no bounding-rect check can see, because every rect involved would
       * still be self-consistent. So walk the whole glass in 2px steps with one live drag
       * and require the previewed row to be non-decreasing throughout. */
      const walkBands = [0, 0, 0, 0, 0, 0];
      {
        const gm = await grabPoint();
        await s.touch('touchStart', [{ x: gm.x, y: gm.y, id: 1 }]);
        const colX = (await s.rect('.bp-well[data-row="0"][data-col="2"]')).cx;
        /* RECORD IN THE PAGE, DO NOT POLL IT. The first version did one page.evaluate per
         * 2px step — 204 CDP round trips per viewport on top of the 204 touch dispatches,
         * and it was the single largest contributor to check 21 blowing CI's job budget.
         * A pointermove listener samples the same state at the same instants for one
         * round trip total. Same measurement, same resolution. */
        await s.page.evaluate(() => {
          window.__walk = [];
          window.__walkOn = (e) => {
            const g = [...document.querySelectorAll('.bp-ghost')].filter((x) => !x.hidden);
            const d = document.querySelector('.bp-drag');
            const dr = d && !d.hidden ? d.getBoundingClientRect() : null;
            window.__walk.push({
              y: e.clientY,
              row: g.length ? Math.min(...g.map((x) => +x.closest('.bp-well').getAttribute('data-row'))) : null,
              cy: dr ? dr.y + dr.height / 2 : null,
            });
          };
          window.addEventListener('pointermove', window.__walkOn);
        });
        for (let y = 4; y <= geom.vh - 2; y += 2) {
          await s.touch('touchMove', [{ x: colX, y, id: 1 }]);
        }
        await s.wait(60);
        const seen = await s.page.evaluate(() => {
          window.removeEventListener('pointermove', window.__walkOn);
          return window.__walk.slice();
        });
        /* Leave the grid before lifting so this measurement places nothing. */
        const awayM = await s.page.evaluate(() => {
          const t = document.querySelector('.bp-tray').getBoundingClientRect();
          return { x: t.x + t.width - 10, y: t.y + t.height - 10 };
        });
        await s.touch('touchMove', [{ x: awayM.x, y: awayM.y, id: 1 }]);
        await s.wait(20);
        await s.touch('touchEnd', []);
        await s.wait(120);
        const live = seen.filter((p) => p.row !== null);
        let backwards = null;
        for (let i = 1; i < live.length; i++) {
          if (live[i].row < live[i - 1].row) { backwards = [live[i - 1], live[i]]; break; }
        }
        /* ROW GRANULARITY IS TOO COARSE ON ITS OWN. An inversion confined inside a single
         * row shows no row change at all — a planted taper that ran the mapping backwards
         * across the last 32px of glass was green here for exactly that reason. The
         * PICTURE's y is continuous, so it sees what the row cannot. */
        const withCy = seen.filter((p) => p.cy !== null);
        let pxBack = null;
        for (let i = 1; i < withCy.length; i++) {
          if (withCy[i].cy < withCy[i - 1].cy - 0.5) { pxBack = [withCy[i - 1], withCy[i]]; break; }
        }
        const rowsSeen = [...new Set(live.map((p) => p.row))];
        if (live.length < 40) bad(`${vp.name}: the monotonicity walk previewed a row at only ${live.length} of ${seen.length} steps`,
          'too few samples to conclude anything about the mapping');
        else if (rowsSeen.length < 6) bad(`${vp.name}: walking the whole glass previewed only rows ${rowsSeen.join(',')}`,
          'the walk must cross every row for the monotonicity claim to mean anything');
        else if (pxBack) bad(`${vp.name}: the piece moves UP the board as the finger moves DOWN`,
          `finger y ${pxBack[0].y} painted the picture at ${pxBack[0].cy.toFixed(1)}, y ${pxBack[1].y} painted it at ${pxBack[1].cy.toFixed(1)} — the lift grows faster than the finger travels`);
        else if (backwards) bad(`${vp.name}: the piece moves UP the board as the finger moves DOWN`,
          `finger y ${backwards[0].y} previewed row ${backwards[0].row}, y ${backwards[1].y} previewed row ${backwards[1].row} — the taper sheds lift faster than the finger travels`);
        else ok(`${vp.name}: walking the glass in 2px steps, neither the previewed row nor the picture's own y ever runs backwards (${live.length} rows / ${withCy.length} pixel samples, all ${rowsSeen.length} rows crossed)`);
        /* THE BANDS COME FROM THIS WALK, NOT FROM ARITHMETIC. With the taper the lift is
         * a function of y, so a band derived from one constant lift is a band for a
         * mapping the game no longer has — it read 39px for a row that answers across a
         * different width. Count the samples that actually previewed each row. */
        for (const r of [0, 1, 2, 3, 4, 5]) {
          const n = live.filter((p) => p.row === r).length;
          walkBands[r] = n * 2;
        }
      }

      /* 3. REACHABILITY, which is what a lift can quietly take away. A lifted hit point
       * leaves the grid at the extremes: to put the picture on the bottom row the finger
       * must go a lift BELOW it, and the finger cannot leave the glass. */
      const unreachable = [];
      const bands = walkBands.slice();
      for (let r = 0; r < 6; r++) {
        /* THE COLUMN TOO, AND A DIFFERENT ONE EACH ROW. This loop asserted only the row
         * and used column 0 for all six, so a build clamping the last column out of
         * reach by drag was green. */
        const col = r % 6;
        const wc = await s.rect(`.bp-well[data-row="${r}"][data-col="${col}"]`);
        /* Aimed by observation, like everything else here — a constant-lift prediction
         * misses by the taper and reports a reachable cell as unreachable. */
        const fy = await aimPicture(wc.cx, wc.cy);
        const res = await dragTo(wc.cx, fy);
        if (!res.landed.some((x) => x.r === r && x.c === col)) unreachable.push(`${r},${col}`);
      }
      /* AND THE CAP IS ASSERTED, NOT JUST ITS EFFECT. Every row stays "reachable" even
       * at an uncapped lift — the bottom one just shrinks to a 15px band — so
       * reachability alone cannot see the cap disappear. The cap's own rule can:
       * the applied lift may never exceed the room between the last row's centre and the
       * bottom of the glass. Derived from geometry, not from a number I chose. */
      /* THE FLOOR IS ASSERTED ON MEASURED BANDS. The clause that stood here compared the
       * lift against the room below the last row, which is the right question ONLY for a
       * constant lift — under §1b's taper it condemns a build that reaches every row
       * comfortably. What matters was never the lift, it is the band, and the band is now
       * counted off the walk. */
      const thin = bands.map((b, i) => ({ b, i })).filter((x) => x.b < MIN_TOUCH);
      if (thin.length) bad(`${vp.name}: row(s) ${thin.map((x) => x.i).join(', ')} answer within only ${thin.map((x) => x.b.toFixed(0)).join('/')}px`,
        `under the ${MIN_TOUCH}px minimum touch target this check enforces on the cells themselves; the lift is ${LIFT.toFixed(1)}px and every pixel of it comes off the bottom row's band`);
      else if (unreachable.length) bad(`${vp.name}: cell(s) ${unreachable.join(' ')} cannot be reached with the piece visible`,
        `the lift is ${LIFT.toFixed(1)}px on a ${geom.cell.toFixed(1)}px cell and the finger cannot leave the glass`);
      else ok(`${vp.name}: every one of the 6 rows is reachable and answers within at least ${MIN_TOUCH}px; bands ${bands.map((b) => b.toFixed(0)).join('/')}px, lift ${LIFT.toFixed(1)}px`);
      await s.ctx.close();
      return R;
    }));
    for (const R of reports11) R.flush();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(12, async () => {
  console.log('\n--- 12. it has a voice, every cue is a real one, and none of it outlives the game ---');
  {
    const s = await shape(FLEET[0], PIN_DOT);
    await s.page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await s.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await s.page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    await s.recordCues();
    await s.fingerTap('.pad-btn[data-id="7"]');
    await s.page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await s.fingerTap('.pickerTile[data-game="blocks"]');
    await s.page.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await s.wait(150);
    await s.page.evaluate(() => { window.__cues.length = 0; window.__cueUnknown.length = 0; window.__bp.vibrations.length = 0; });

    /* Five dots into row 0 — placements only — then the sixth, which clears. */
    for (let c = 0; c < 5; c++) await s.placeAt(0, c);
    const beforeClear = await s.cues();
    const vibBefore = await s.page.evaluate(() => window.__bp.vibrations.length);
    await s.placeAt(0, 5);
    await s.page.waitForTimeout(400);
    const afterClear = await s.cues();
    const vibAfter = await s.page.evaluate(() => window.__bp.vibrations.length);
    const clearCues = afterClear.all.slice(beforeClear.all.length);

    if (afterClear.unknown.length) bad(`${afterClear.unknown.length} cue(s) name a bank that does not exist`,
      `${JSON.stringify([...new Set(afterClear.unknown)])} — doSound ignores an unknown name silently, so this ships a sound that never plays`);
    else if (afterClear.banks.length < 8) bad(`could not read the shell's sound banks (${afterClear.banks.length} found)`,
      'the bank list must come from doSound, not from a copy in this file');
    else if (!beforeClear.all.length) bad('placing a piece made no sound at all');
    else if (beforeClear.all.indexOf('tap') < 0) bad(`a piece LANDING makes no sound of its own`,
      `placing recorded ${JSON.stringify([...new Set(beforeClear.all)])} — those are the pickup and the tray refill; nothing marks the landing`);
    else if (!clearCues.length) bad('clearing a line made no sound at all');
    else if (clearCues.indexOf('twinkle') < 0) bad('the line clear does not play the reward cue', `it played ${JSON.stringify(clearCues)}`);
    else if (vibAfter <= vibBefore) bad('the line clear did not buzz', 'api.vibrate on the clear and nothing else');
    else if (vibBefore !== 0) bad(`${vibBefore} buzz(es) fired before any line cleared — the clear is meant to be the only one`);
    else ok(`placing speaks (${JSON.stringify([...new Set(beforeClear.all)])}), clearing speaks and buzzes (${JSON.stringify(clearCues)}), every name is one of the twelve banks`);

    /* The refusal must be gentler than the reward: never a square wave.
     *
     * AND IT MUST ACTUALLY REFUSE. The first version tapped an empty cell just after the
     * line cleared, so the piece PLACED and the recording came back ["keyTap","tap"] —
     * `tap` being the drop cue. It asserted "no harsh cue" against a move that succeeded:
     * a vacuous pass, the exact shape this file has now been bitten by three times. So a
     * cell is occupied first, and the refusal cue is required to have fired at all. */
    await s.placeAt(3, 3);
    await s.wait(120);
    const idx = Math.max(0, await s.firstFullSlot());
    const wasFilled = (await s.boardState()).filter((c) => c.filled).length;
    await s.fingerTap(`.bp-slot[data-slot="${idx}"]`);
    /* Recorded AFTER the select, so what is measured is what the REFUSAL said and not
     * the cue for picking the piece up. */
    await s.page.evaluate(() => { window.__cues.length = 0; });
    await s.fingerTap('.bp-well[data-row="3"][data-col="3"]');
    await s.wait(160);
    const refusal = (await s.cues()).all;
    const nowFilled = (await s.boardState()).filter((c) => c.filled).length;
    const HARSH = ['error', 'alert'];
    if (nowFilled !== wasFilled) bad('the setup for the refusal placed a piece instead of being refused',
      `${wasFilled} -> ${nowFilled} filled; nothing can be concluded about the refusal cue`);
    else if (refusal.some((c) => HARSH.indexOf(c) >= 0)) bad(`the illegal drop plays a harsh cue: ${JSON.stringify(refusal)}`,
      'error and alert are square waves — a buzz for "I changed my mind" teaches a three-year-old that the controls bite');
    else if (!refusal.length) bad('the refused drop made no refusal cue at all',
      'silence on a refusal leaves a child with no feedback that anything happened');
    else ok(`a genuinely refused drop plays ${JSON.stringify([...new Set(refusal)])} — soft descending sines, never error or alert`);

    /* And the module builds no AudioContext of its own. */
    const audio = await s.page.evaluate(() => ({ ...window.__bp.audio }));
    if (audio.game > 0) bad(`the module constructed ${audio.game} AudioContext(s) of its own`, '§8.3 — the shell holds the only one and does not hand it out');
    else ok(`the module constructed no AudioContext (the shell made ${audio.shell})`);

    await s.fingerTap('#gameBack');
    await s.page.waitForTimeout(300);
    await s.page.evaluate(() => { window.__cues.length = 0; });
    /* 3 SECONDS, NOT 700ms. A cue scheduled 2.5s out survived a 700ms window and both
     * this clause and section 8's timer clause — the timer wrapper only sees timeouts
     * armed from blockpop.js, and a straight `setTimeout(() => api.sound(...))` inside
     * the module is exactly that, so it was section 8's window that was short too. */
    await s.page.waitForTimeout(3000);
    const afterTeardown = (await s.cues()).all;
    if (afterTeardown.length) bad(`${afterTeardown.length} cue(s) fired in the 3s after teardown`, JSON.stringify(afterTeardown));
    else ok('nothing spoke in the 3 seconds after the child left');
    await s.ctx.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(13, async () => {
  console.log('\n--- 13. the flair is PupPad\'s own, it is transient, and it spends no contrast ---');
  {
    const s = await shape(FLEET[0], PIN_DOT);
    await s.openBlocks({ clearStorage: true });
    /* Baseline BEFORE any clear: the flair must not be sitting on the board. */
    const idle = await s.page.evaluate(() => ({
      sweeps: document.querySelectorAll('.bp-sweeparm').length,
      visibleStamps: [...document.querySelectorAll('.bp-stamp')].filter((e) => !e.hidden).length,
      wellBg: getComputedStyle(document.querySelector('.bp-well')).backgroundColor,
      rootBg: getComputedStyle(document.querySelector('.bp-root')).backgroundImage,
    }));
    for (let c = 0; c < 5; c++) await s.placeAt(0, c);
    await s.page.evaluate(() => { window.__bp.anim.pop = 0; });
    await s.placeAt(0, 5);
    await s.wait(90);
    /* Mid-clear: the paw is stamped and the arm is turning. */
    const during = await s.page.evaluate(() => {
      const st = [...document.querySelectorAll('.bp-stamp')].filter((e) => !e.hidden);
      return {
        stamps: st.length,
        /* `indexOf('svg')` matches the MIME string in EVERY svg data URI, so a blank
         * <svg></svg> passed as "a paw". pawSVG draws five ellipses; require them. */
        withPaw: st.filter((e) => {
          const u = getComputedStyle(e).backgroundImage || '';
          const n = (decodeURIComponent(u).match(/<ellipse/g) || []).length;
          return n >= 5;
        }).length,
        sweeps: document.querySelectorAll('.bp-sweeparm').length,
        stampOverFilled: st.filter((e) => {
          const c = e.parentNode.querySelector('.bp-candy');
          return c && !c.hidden && !c.classList.contains('bp-clear');
        }).length,
      };
    });
    await s.page.waitForTimeout(900);
    const after = await s.page.evaluate(() => ({
      sweeps: document.querySelectorAll('.bp-sweeparm').length,
      visibleStamps: [...document.querySelectorAll('.bp-stamp')].filter((e) => !e.hidden).length,
      wellBg: getComputedStyle(document.querySelector('.bp-well')).backgroundColor,
    }));
    if (idle.rootBg === 'none') bad('the radar ground texture is not painted at all');
    else if (idle.sweeps || idle.visibleStamps) bad('flair is on the board before anything happened',
      `${idle.sweeps} sweep(s), ${idle.visibleStamps} stamp(s)`);
    else if (!during.stamps) bad('a cleared line stamped no paw');
    else if (during.withPaw !== during.stamps) bad(`${during.stamps - during.withPaw} stamp(s) do not carry a paw`,
      'pawSVG draws five ellipses; a data URI without them is some other picture, or a blank one');
    else if (during.stampOverFilled) bad(`${during.stampOverFilled} paw(s) are over a cell that is NOT clearing`,
      'a stamp over a live candy masks it — invariant 1');
    else if (!during.sweeps) bad('the line clear ran no sweep');
    else if (after.sweeps || after.visibleStamps) bad('the flair outlived the clear',
      `${after.sweeps} sweep(s) and ${after.visibleStamps} stamp(s) still present ~1s later`);
    else if (after.wellBg !== idle.wellBg) bad('an empty cell changed colour during the flair', `${idle.wellBg} -> ${after.wellBg}`);
    else ok(`radar ground painted; a clear stamped ${during.stamps} paws and turned 1 sweep, both gone ~1s later, and the empty cell is still ${after.wellBg}`);

    /* THE STRAND, AND §13 HAD THE ASSERTION FOR IT ALL ALONG WITHOUT EVER SAMPLING AT
     * THE MOMENT IT HAPPENS. A stamp is released when its cell empties — but there is a
     * second way out of the dying state: a piece LANDS on the cell inside the 280ms
     * window and it goes straight back to live. That path left the paw parented over a
     * live candy. Invisible today only because the keyframe ends at opacity 0 with
     * `forwards`; end it visible and the paw masks the cell. So do the §6 move here and
     * then look. */
    {
      const s2 = await shape(FLEET[0], PIN_DOT);
      await s2.openBlocks({ clearStorage: true });
      const slot0 = await s2.rect('.bp-slot[data-slot="0"]');
      const cell00 = await s2.rect('.bp-well[data-row="0"][data-col="0"]');
      for (let c = 0; c < 6; c++) await s2.placeAt(0, c);
      await s2.touch('touchStart', [{ x: slot0.cx, y: slot0.cy, id: 1 }]);
      await s2.wait(10);
      await s2.touch('touchEnd', []);
      await s2.wait(10);
      await s2.touch('touchStart', [{ x: cell00.cx, y: cell00.cy, id: 1 }]);
      await s2.wait(10);
      await s2.touch('touchEnd', []);
      await s2.page.waitForTimeout(900);
      const stranded = await s2.page.evaluate(() => {
        const out = [];
        for (const e of document.querySelectorAll('.bp-stamp')) {
          if (e.hidden) continue;
          const c = e.parentNode.querySelector('.bp-candy');
          if (c && !c.hidden && !c.classList.contains('bp-clear')) {
            out.push(e.parentNode.getAttribute('data-row') + ',' + e.parentNode.getAttribute('data-col'));
          }
        }
        return out;
      });
      if (stranded.length) bad(`${stranded.length} paw(s) stranded over it — a cell that is NOT clearing: ${JSON.stringify(stranded)}`,
        'a piece landed there inside the clear window and the stamp was never released — it is transparent only because the keyframe ends at opacity 0');
      else ok('a piece landing inside the clear window leaves no paw stranded over it');
      await s2.ctx.close();
    }

    /* NOTHING MAY BE PAINTED OVER THE BOARD. The contrast clause below reads computed
     * style, which CANNOT SEE COMPOSITING: move the radar ground on top of the board as a
     * ::after with a green wash and `.bp-well`'s own backgroundColor is still opaque tan,
     * so the clause passes while the child looks at a green haze. Demonstrated green.
     * elementFromPoint answers the question computed style cannot — what is actually on
     * top at the pixel the child touches. */
    const onTop = await s.page.evaluate(() => {
      const out = [];
      for (const w of document.querySelectorAll('.bp-well')) {
        const r = w.getBoundingClientRect();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!e) { out.push('nothing'); continue; }
        if (e === w || w.contains(e)) continue;
        out.push(e.className || e.tagName);
      }
      return [...new Set(out)];
    });
    /* AND elementFromPoint IS NOT ENOUGH ON ITS OWN: a decorative overlay with
     * `pointer-events:none` is skipped by hit testing entirely, so a green haze laid over
     * the board as a ::after was green here. Pseudo-elements are invisible to both
     * elementFromPoint and querySelectorAll, so they are asked for by name. */
    const pseudo = await s.page.evaluate(() => {
      const out = [];
      for (const sel of ['.bp-boardwrap', '.bp-grid', '.bp-well', '.bp-root']) {
        const e = document.querySelector(sel);
        if (!e) continue;
        for (const which of ['::before', '::after']) {
          const cs = getComputedStyle(e, which);
          if (!cs || cs.content === 'none' || cs.content === '') continue;
          if (sel === '.bp-well') continue;
          out.push(`${sel}${which}`);
        }
      }
      return out;
    });
    if (onTop.length) bad(`something is painted over the board: ${JSON.stringify(onTop)}`,
      'the ground is meant to sit behind the wells; computed style cannot see compositing and this can');
    else if (pseudo.length) bad(`a decorative layer is drawn over the board: ${JSON.stringify(pseudo)}`,
      'pointer-events:none makes such a layer invisible to elementFromPoint, so it is asked for by name');
    else ok('every board cell is the topmost thing at its own centre, and no pseudo-layer is painted over it');

    /* CONTRAST, MEASURED WITH THE FLAIR PRESENT — a filled cell must stay plainly
     * different from an empty one, and a legal ghost from an illegal one. */
    const contrast = await s.page.evaluate(() => {
      const lum = (c) => {
        const m = (c || '').match(/[\d.]+/g);
        if (!m) return null;
        const [r, g, b, a] = [ +m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3] ];
        return { L: 0.2126 * r + 0.7152 * g + 0.0722 * b, a };
      };
      const well = document.querySelector('.bp-well');
      const filled = [...document.querySelectorAll('.bp-candy')].find((c) => !c.hidden);
      return {
        well: lum(getComputedStyle(well).backgroundColor),
        candyBase: getComputedStyle(filled || well).getPropertyValue('--bp-b').trim(),
        ghostOk: getComputedStyle(document.querySelector('.bp-ghost')).backgroundColor,
      };
    });
    if (!contrast.well) bad('could not read the empty cell colour');
    else if (contrast.well.a < 1) bad(`the empty cell is now translucent (alpha ${contrast.well.a}) — the ground texture is bleeding through it`,
      'invariant 1 is not decoration\'s to spend');
    else ok(`the empty cell is opaque (alpha 1, luminance ${contrast.well.L.toFixed(0)}) with the flair painted — the ground sits behind it`);

    await s.ctx.close();

    /* REDUCED MOTION: the sweep is not created at all. */
    const rm = await browser.newContext({ viewport: { width: FLEET[0].width, height: FLEET[0].height },
      hasTouch: true, reducedMotion: 'reduce' });
    await rm.addInitScript(HARNESS, PIN_DOT);
    const rp = await rm.newPage();
    const rcdp = await rm.newCDPSession(rp);
    const rtouch = (t, pts) => rcdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: pts });
    await rp.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await rp.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await rp.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
    const tapAt = async (sel) => {
      const r = await rp.evaluate((q) => { const e = document.querySelector(q); const b = e.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
      await rtouch('touchStart', [{ x: r.x, y: r.y, id: 1 }]);
      await rp.waitForTimeout(40);
      await rtouch('touchEnd', []);
      await rp.waitForTimeout(140);
    };
    await tapAt('.pad-btn[data-id="7"]');
    await rp.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
    await tapAt('.pickerTile[data-game="blocks"]');
    await rp.waitForFunction(() => {
      const h = document.getElementById('gameHost');
      return !!(h && h.blocks && h.querySelector('.bp-grid'));
    }, { timeout: 10000 });
    await rp.waitForTimeout(150);
    for (let c = 0; c < 6; c++) {
      const i = await rp.evaluate(() => [...document.querySelectorAll('.bp-slot')].findIndex((x) => x.getAttribute('data-empty') === '0'));
      await tapAt(`.bp-slot[data-slot="${Math.max(0, i)}"]`);
      await tapAt(`.bp-well[data-row="0"][data-col="${c}"]`);
    }
    await rp.waitForTimeout(120);
    const rmState = await rp.evaluate(() => ({
      sweeps: document.querySelectorAll('.bp-sweeparm').length,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      cleared: [...document.querySelectorAll('.bp-well[data-row="0"] .bp-candy')].filter((c) => !c.hidden).length,
    }));
    if (!rmState.reduced) bad('the reduced-motion context did not take — this assertion would pass vacuously');
    else if (rmState.sweeps) bad(`${rmState.sweeps} sweep(s) ran with prefers-reduced-motion set`);
    else ok('with prefers-reduced-motion set the sweep is never created, and the line still clears');
    await rm.close();
  }
  });

  /* ------------------------------------------------------------------ */
  await section(14, async () => {
  console.log('\n--- 14. the thing he grabs is not smaller than the thing he aims at ---');
  {
    /* §1a. The source divides both axes by max(w, h, 3) against a hardcoded 88px that
     * assumed ITS OWN 128px slot, so in this port's 357x123 landscape slot a 1x1 dot was
     * drawn at 35px beside a 64px board cell. Scotty saw it on the device; it was
     * predicted in the layout reconnaissance and never reached a work order.
     *
     * EVERY SHAPE, not the one the deal pin happens to give: the tray is seeded through
     * api.load, which is the real load path (loadSaved validates and rebuilds w/h from
     * the cells), so this drives the shipped renderTray rather than a stand-in. */
    const SHAPES = [
      { name: 'dot', cells: [[0, 0]] },
      { name: 'tri-h', cells: [[0, 0], [0, 1], [0, 2]] },
      { name: 'quad-v', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
      { name: 'square', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
      { name: 'quad-h', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
      { name: 'tri-v', cells: [[0, 0], [1, 0], [2, 0]] },
    ];
    const reports14 = await Promise.all(FLEET.map(async (vp) => {
      const R = buffered();
      const ok = R.ok, bad = R.bad, info = R.info;
      const s = await shape(vp, PIN_DOT);
      const rows = [];
      for (let g = 0; g < SHAPES.length; g += 3) {
        const trio = SHAPES.slice(g, g + 3);
        await s.page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
        await s.page.evaluate((t) => {
          const board = [];
          for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 6; c++) row.push(0); board.push(row); }
          try {
            localStorage.setItem('pupgame:blocks', JSON.stringify({ v: 1, board,
              tray: t.map((x) => ({ name: x.name, cells: x.cells, color: 2 })), score: 0, combo: 0 }));
          } catch (e) {}
        }, trio);
        await s.page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
        await s.fingerTap('.pad-btn[data-id="7"]');
        await s.page.waitForSelector('.pickerTile[data-game="blocks"]', { timeout: 10000 });
        await s.fingerTap('.pickerTile[data-game="blocks"]');
        await s.page.waitForFunction(() => {
          const h = document.getElementById('gameHost');
          return !!(h && h.blocks && h.querySelector('.bp-grid'));
        }, { timeout: 10000 });
        await s.wait(200);
        const got = await s.page.evaluate((names) => {
          const boardCell = document.querySelector('.bp-grid').getBoundingClientRect().width / 6;
          return [...document.querySelectorAll('.bp-slot')].map((sl, i) => {
            const sr = sl.getBoundingClientRect();
            const cs = [...sl.querySelectorAll('.bp-piececell')].map((e) => e.getBoundingClientRect());
            if (!cs.length) return { name: names[i], drawn: 0 };
            const x0 = Math.min(...cs.map((b) => b.x)), x1 = Math.max(...cs.map((b) => b.x + b.width));
            const y0 = Math.min(...cs.map((b) => b.y)), y1 = Math.max(...cs.map((b) => b.y + b.height));
            return { name: names[i], drawn: cs.length, cell: Math.min(...cs.map((b) => b.width)),
              extent: Math.max(x1 - x0, y1 - y0), shortAxis: Math.min(sr.width, sr.height),
              slotW: sr.width, slotH: sr.height, boardCell };
          });
        }, trio.map((x) => x.name));
        rows.push(...got);
      }
      const empty = rows.filter((r) => !r.drawn);
      const small = rows.filter((r) => r.drawn && r.extent < r.shortAxis * 0.5);
      if (empty.length) bad(`${vp.name}: ${empty.length} tray slot(s) drew no piece at all`, empty.map((r) => r.name).join(' '));
      else if (small.length) bad(`${vp.name}: ${small.length} shape(s) fill under half the slot's shorter axis`,
        small.map((r) => `${r.name} ${r.extent.toFixed(0)}px of ${r.shortAxis.toFixed(0)}`).join(' · '));
      else {
        const worst = rows.reduce((a, b) => (b.extent / b.shortAxis < a.extent / a.shortAxis ? b : a));
        const minCell = rows.reduce((a, b) => (b.cell < a.cell ? b : a));
        ok(`${vp.name}: all ${rows.length} shapes fill >= half the slot's short axis (worst ${worst.name} at ${(100 * worst.extent / worst.shortAxis).toFixed(0)}%)`);
        /* REPORTED, NOT ASSERTED, AND THE WORK ORDER SAYS WHY: a piece cell cannot always
         * reach the board cell. A 4-long piece at a 64px cell wants 256px of slot; three
         * such slots want 768px against a 396px tray column. CC-A verified the arrangement
         * space and struck the clause. The ghost resizing to the board cell on pickup is
         * what makes the shortfall safe, and §11 asserts that. */
        info(`${vp.name}: smallest tray cell is ${minCell.name} at ${minCell.cell.toFixed(0)}px against a ${minCell.boardCell.toFixed(0)}px board cell — a 4-long piece cannot reach it in a ${minCell.slotW.toFixed(0)}x${minCell.slotH.toFixed(0)} slot`);
      }
      await s.ctx.close();
      return R;
    }));
    for (const R of reports14) R.flush();
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
