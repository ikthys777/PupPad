/* CHECK 21's CONTROLS — every section of demo-blockpop.mjs shown going RED.
 * PUP-WO-0400 §3 item 9: "A check never seen red is not a check."
 *
 * Each scenario copies the app into a temp directory, plants ONE defect, and runs the
 * REAL check file against it with --only=<section>. A scenario passes when the check
 * goes red AND says the thing it was supposed to say — a check that fails for an
 * unrelated reason has not been shown to catch anything (`expectText`).
 *
 * The defects are the ones the port was written to avoid, not inventions: the missing
 * exit gutter that PUP-WO-0301's adversarial pass found, the source's own `dist < 14`
 * tap gate, its scoring formula, its permanently-true `popping` prop, its stranded
 * `clearing` window, and module-scope state surviving a remount.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-blockpop.mjs');
const MODULE = join('games', 'blockpop.js');

console.log('CHECK 21 CONTROLS — every section of demo-blockpop.mjs, shown red against a planted defect.\n');

const results = [];
/* EACH SCENARIO BOOTS ITS OWN CHROMIUM, and there are two dozen of them. Run serially
 * that is ten minutes of wall clock to prove twenty-four one-line defects, and every one
 * of them is independent: a private temp directory, its own browser, no shared state.
 * Bounded by cores so a CI runner is not oversubscribed. */
/* Lanes, not cores. These scenarios are BROWSER-BOUND, not CPU-bound — each one spends
 * its life waiting on Chromium to boot, paint and answer, so a 2-core CI runner still
 * profits from more of them in flight than it has cores. `cores - 2` gave the floor of 2
 * on GitHub's 2-core runner and the step took long enough to blow the job's timeout.
 * Four Chromium instances is ~1.2GB against the runner's 7GB. */
/* FOUR, NOT EIGHT, AND THE REASON IS THE CHECK ITSELF. Each scenario now runs its own
 * fleet viewports concurrently, so a lane is up to three browsers rather than one — at
 * eight lanes that is twenty-four, and the sections with real time in them (§6 places a
 * piece INSIDE a 280ms window, §13 samples a 620ms sweep at 90ms) started slipping under
 * the contention. TWO CONSECUTIVE RUNS FAILED ON DIFFERENT SCENARIOS, which is the
 * signature of a flaky harness rather than a defect — and a gate that is red at random is
 * one people learn to ignore. */
const LANES = 4;

/* Replace exactly once, and fail loudly if the anchor moved — a control that silently
 * plants nothing reports GREEN and reads as "the check cannot catch this". */
function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}

async function scenario(section, label, { mutate, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c21-'));
  let observed = 'GREEN';
  let detail = '';
  try {
    for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
      if (existsSync(join(REPO, f))) copyFileSync(join(REPO, f), join(dir, f));
    }
    mkdirSync(join(dir, 'games'), { recursive: true });
    for (const g of ['hello.js', 'gyre.js', 'blockpop.js']) copyFileSync(join(REPO, 'games', g), join(dir, 'games', g));

    const before = readFileSync(join(dir, MODULE), 'utf8');
    const after = mutate(before, dir);
    if (after === before) throw new Error('the mutation changed nothing');
    writeFileSync(join(dir, MODULE), after);

    const run = await new Promise((res) => {
      execFile(process.execPath, [CHECK, dir, `--only=${section}`], {
        encoding: 'utf8', timeout: 420000, maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PUPPAD_SUBJECT: 'deadbeefcafe0' },
      }, (err, stdout, stderr) => res({ code: err ? (err.code ?? 1) : 0, out: (stdout || '') + (stderr || '') }));
    });
    const out = run.out;
    const code = run.code;
    observed = code === 0 ? 'GREEN' : 'RED';
    if (observed === 'RED' && !out.includes(expectText)) {
      observed = 'RED-WRONG-REASON';
      detail = `wanted ${JSON.stringify(expectText)}`;
    }
  } catch (e) {
    observed = 'HARNESS-BROKE';
    detail = String(e && e.message ? e.message : e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  /* RETURNED, NOT PUSHED. The lanes run concurrently and the first version read
   * `results.length` to find where its own record landed — a shared counter two lanes
   * can read the same value of, which duplicated one scenario's row five times and lost
   * four others. A race in the harness that reports on races. */
  return { section, label, observed, pass: observed === 'RED', detail };
}

/* Collected first, run in lanes, reported in declaration order so the output is stable
 * whatever order they finish in. */
const QUEUE = [];
/* --only=N,M plants only those sections' defects. The check file has had this since it
 * was written and this one did not, which meant proving one new plant cost a full run of
 * every other. It changes nothing about a CI run, which passes no argument. */
const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith('--only='));
  return a ? new Set(a.slice(7).split(',').map(Number)) : null;
})();
const plan = (section, label, spec) => { if (!ONLY || ONLY.has(section)) QUEUE.push({ section, label, spec }); };

/* 1 — the exit's column. PUP-WO-0301's worst defect was #gameBack swallowing a control;
 * this is the same defect in the same place, and section 1 is the converse question. */
plan(1, 'the left gutter is a bare 8px, so the board runs under #gameBack', {
  mutate: (s) => sub(s, "'padding-left:max(84px,calc(env(safe-area-inset-left) + 74px));',", "'padding-left:8px;',"),
  expectText: "intersect #gameBack's column",
});

/* 2 — a drop that reports itself illegal everywhere. */
plan(2, 'hitCell never reports a legal drop', {
  mutate: (s) => sub(s, 'return { row: row, col: col, valid: canPlace(board, d.piece.cells, row, col) };',
    'return { row: row, col: col, valid: false };'),
  expectText: 'not the cells the ghost previewed',
});

/* 3 — the source's own gate, restored. */
plan(3, "the tap slop is the source's 14 again", {
  mutate: (s) => sub(s, '  var TAP_SLOP = 32;', '  var TAP_SLOP = 14;'),
  expectText: 'the tap slop is too narrow',
});

/* 4 — the scoring formula, wrong in the line-bonus term. */
plan(4, 'scorePlacement drops the line bonus', {
  mutate: (s) => sub(s, '      s += 10 * lines * Math.max(1, combo);', '      s += 1 * lines;'),
  expectText: 'the score did not rise by the formula',
});

/* 5 — THE INVISIBLE ONE. The naive port: repaint everything on every pointer move and
 * re-animate every filled cell, which is what `popping={!!color && !dying}` does the
 * moment the reconciler stops preserving the node. */
plan(5, 'every pointermove repaints the board and re-pops every candy', {
  mutate: (s) => {
    /* Replace the WHOLE if/else-if/else chain. Rewriting only its middle arm orphans
     * the trailing `else`, and the module then fails to parse — which the control
     * harness correctly refused to score as "the check caught the defect". */
    let out = sub(s, '      if (st.shown !== show || st.dying !== isDying) {', '      if (show !== 0) {');
    out = sub(out, '        else if (st.shown === 0) toPop.push(st.candy);', '        else if (true) toPop.push(st.candy);');
    out = sub(out, `    moveDragEl(ev.clientX, ev.clientY);
    drag.hover = hitCell(ev.clientX, ev.clientY, drag);
    renderGhost();`, `    moveDragEl(ev.clientX, ev.clientY);
    drag.hover = hitCell(ev.clientX, ev.clientY, drag);
    render();`);
    return out;
  },
  expectText: 'pop animation(s) restarted during a drag',
});

/* 6 — THE OTHER INVISIBLE ONE. The source's exact lifecycle: an empty burst cancels the
 * TIMER and leaves the dying set armed, so those cells stay at opacity 0 forever. */
plan(6, "the source's stranded clearing window, restored", {
  mutate: (s) => sub(s, `  function beginClear(cellsToClear) {
    cancelClear();
    if (!cellsToClear || !cellsToClear.length) return;`, `  function beginClear(cellsToClear) {
    if (!cellsToClear || !cellsToClear.length) {
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = 0; }
      return;
    }
    cancelClear();`),
  expectText: 'invisible',
});

/* 7 — the §0.4 hazard itself: state hoisted out of mount, so one module URL serving two
 * registry entries carries the first entry's game into the second. */
plan(7, 'the board is retained at module scope across mounts', {
  mutate: (s) => {
    let out = sub(s, 'var DOT = SHAPES[0];', 'var DOT = SHAPES[0];\nvar __retainedBoard = null;');
    out = sub(out, `  } else {
    tray = dealTray(board, mode);
  }`, `  } else if (__retainedBoard && __retainedBoard.length === N) {
    board = __retainedBoard;
    tray = dealTray(board, mode);
  } else {
    tray = dealTray(board, mode);
  }`);
    out = sub(out, '    persist(true);', '    __retainedBoard = board;\n    persist(true);');
    return out;
  },
  expectText: 'module state survived the teardown',
});

/* 8 — an observer that outlives the game. */
plan(8, 'the ResizeObserver is never disconnected', {
  mutate: (s) => sub(s, '    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }', '    if (ro) { ro = null; }'),
  expectText: 'never disconnected',
});

/* ------------------------------------------------------------------------
 * THE SECOND WAVE. An adversarial pass planted 17 defects against the first
 * version of check 21 and it went GREEN on all 17: a 39x39 board, a tray of 1px
 * pieces, a game with no animation at all, a place() that never places, a ghost
 * that shows green over illegal drops, a combo stuck at 1, columns that never
 * clear, a leaked interval, a stylesheet left in document.head, and the score
 * leaking across mounts through module scope. Every one of those is a control
 * below. A check is only as good as the defects it has been SHOWN to catch, and
 * the count of those was eight when it should have been twenty-three.
 * ---------------------------------------------------------------------- */

plan(1, 'the board is a tenth of its height — 39x39, still "on screen"', {
  mutate: (s) => sub(s, '    var side = Math.floor(Math.min(availH, availW));',
    '    var side = Math.floor(Math.min(availH, availW) * 0.1);'),
  expectText: 'the board is',
});

plan(1, 'a word is painted inside host', {
  mutate: (s) => sub(s, "  root.className = 'bp-root';",
    "  root.className = 'bp-root';\n  var lbl = document.createElement('div'); lbl.textContent = 'Score'; root.appendChild(lbl);"),
  expectText: 'painted word(s) inside host',
});

plan(1, 'the tray renders 1px pieces — three empty boxes', {
  mutate: (s) => sub(s, '      if (cell < 8) cell = 8;', '      cell = 1;'),
  expectText: 'tray piece cell',
});

/* The original plant here reverted grabCell to dividing the SLOT rather than the piece.
 * IT NO LONGER MANIFESTS, and that is a result rather than a problem: §1a's tray sizing
 * grew the piece box from ~114px to ~264px of a 371px slot, so the slot's own column
 * boundaries now fall inside the piece and the grab lands in the right column either way.
 * The §1a fix incidentally cured it. Planted instead is the defect the assertion is
 * actually written against — a grab offset that ignores where the finger went. */
plan(2, 'the grab always takes the piece\'s first cell, wherever the finger landed', {
  mutate: (s) => sub(s, '    var g = grabCell(rect, piece, ev.clientX, ev.clientY);',
    '    var g = { r: piece.cells[0][0], c: piece.cells[0][1] };'),
  expectText: 'the ghost did not move with the grab point',
});

plan(2, 'the ghost shows green over an illegal drop', {
  mutate: (s) => sub(s, `        st.ghost.className = 'bp-ghost ' + (next === 'ok' ? 'bp-ghost-ok' : 'bp-ghost-no');`,
    `        st.ghost.className = 'bp-ghost bp-ghost-ok';`),
  expectText: 'ghost',
});

plan(3, 'the tap slop is unbounded, so every abandoned drag arms a piece', {
  mutate: (s) => sub(s, '  var TAP_SLOP = 32;', '  var TAP_SLOP = 1e9;'),
  expectText: 'no upper bound',
});

plan(4, 'the combo never advances past 1', {
  mutate: (s) => sub(s, '    combo = lines > 0 ? combo + 1 : 0;', '    combo = lines > 0 ? 1 : 0;'),
  expectText: 'combo',
});

plan(4, 'columns never clear, only rows', {
  mutate: (s) => sub(s, `    for (c = 0; c < n; c++) {
      full = true;
      for (r = 0; r < n; r++) if (b[r][c] === 0) { full = false; break; }
      if (full) cols.push(c);
    }`, '    /* column scan removed */'),
  expectText: 'column 0 did not clear',
});

plan(5, 'nothing animates at all — the keyframes are empty', {
  mutate: (s) => sub(s, `    '.bp-pop{animation:bp-pop ' + POP_MS + 'ms cubic-bezier(.34,1.36,.64,1) both}',`,
    `    '.bp-pop{}',`),
  expectText: 'does not animate',
});

plan(6, 'lines never clear at all', {
  mutate: (s) => sub(s, `    if (rows.length === 0 && cols.length === 0) return { board: b, rows: rows, cols: cols, cells: [] };`,
    `    return { board: b, rows: [], cols: [], cells: [] };`),
  expectText: 'clear',
});

plan(7, 'the score is retained at module scope across mounts', {
  mutate: (s) => {
    let out = sub(s, 'var DOT = SHAPES[0];', 'var DOT = SHAPES[0];\nvar __retainedScore = 0;');
    out = sub(out, '  var score = 0;', '  var score = __retainedScore;');
    out = sub(out, '    persist(true);', '    __retainedScore = score;\n    persist(true);');
    return out;
  },
  expectText: 'the seam did not',
});

plan(8, 'the removeEventListener loop is deleted', {
  mutate: (s) => sub(s, `    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]); } catch (e) {}
    }`, '    /* listeners deliberately left attached */'),
  expectText: 'listener(s) not removed',
});

plan(8, 'a setInterval is armed at mount and never cleared', {
  mutate: (s) => sub(s, '  relayout();\n  render();',
    '  setInterval(function () { void N; }, 250);\n  relayout();\n  render();'),
  expectText: 'interval(s) armed by the game still running',
});

plan(8, 'the stylesheet is appended to document.head and never removed', {
  mutate: (s) => {
    let out = sub(s, '  host.appendChild(style);', '  document.head.appendChild(style);');
    out = sub(out, '    if (style.parentNode) style.parentNode.removeChild(style);', '');
    return out;
  },
  expectText: 'bp- stylesheet(s) still in the document',
});

plan(9, 'the resumed score is validated by a colour-id predicate and zeroed above 7', {
  mutate: (s) => sub(s, '      score: validCount(raw.score) ? raw.score : 0,',
    '      score: validCell(raw.score) ? raw.score : 0,'),
  expectText: 'the score did not survive the resume',
});

plan(10, 'the play-again affordance closes the game instead of resuming it', {
  mutate: (s) => sub(s, '      fired = true;\n      restart();', '      fired = true;\n      api.close();'),
  expectText: 'must not call api.close()',
});

plan(10, 'the terminal state paints a word', {
  mutate: (s) => sub(s, `    again.textContent = '\u{1F504}';`, `    again.textContent = 'Play again';`),
  expectText: 'paints a word',
});

/* ------------------------------------------------------------------------
 * PUP-WO-0402 §1 — the defect a human found and no check could see.
 * §5 requires the plant to BE a defect: a plant that changes whether the file
 * parses is testing the loader, not the check.
 * ---------------------------------------------------------------------- */

plan(11, 'the drop resolves at the finger while the piece is painted above it', {
  mutate: (s) => sub(s, '    var ly = y - dragLiftPx(y);', '    var ly = y;'),
  expectText: 'lands in',
});

plan(11, 'the picture is lifted and the hit point is lifted by a DIFFERENT amount', {
  mutate: (s) => sub(s, '    var ly = y - dragLiftPx(y);', '    var ly = y - dragLiftPx(y) * 0.5;'),
  expectText: 'lands in',
});

plan(11, 'the lift does not taper, so the bottom row loses its touch band', {
  mutate: (s) => sub(s, '    var f = (vh - y) / span;', '    var f = 1;'),
  expectText: 'answer within only',
});

/* THE INVERSION THE MONOTONICITY WALK EXISTS FOR — and note the SIGN, because the work
 * order had it the other way. A taper that SHEDS lift as the finger descends gives the
 * mapping slope 1 + base/span, which can never invert however steep it is. It only runs
 * backwards when the lift GROWS toward the bottom faster than the finger travels: slope
 * 1 - base/span, negative once span < base. That is what is planted — growth over the
 * last half-cell, base 57.6 against span 32. Confined inside one row, so the row-level
 * clause cannot see it; the picture's own y can. */
plan(11, 'the lift grows toward the bottom faster than the finger travels', {
  mutate: (s) => {
    let out = sub(s, '  var TAPER_CELLS = 2.6;', '  var TAPER_CELLS = 0.5;');
    out = sub(out, '    var f = (vh - y) / span;', '    var f = (y - (vh - span)) / span;');
    return out;
  },
  expectText: 'moves UP the board as the finger moves DOWN',
});

plan(11, 'moveDragEl and hitCell pass different y to the one derivation', {
  mutate: (s) => sub(s, '    var ly = y - dragLiftPx(y);', '    var ly = y - dragLiftPx(y - 40);'),
  expectText: 'lands in',
});

/* ------------------------------------------------------------------------
 * PUP-WO-0402 §2 (the voice) and §3 (the flair).
 * ---------------------------------------------------------------------- */

plan(12, 'a cue names a bank that does not exist, so it never plays', {
  mutate: (s) => sub(s, "    clear: 'twinkle',", "    clear: 'sparkle',"),
  expectText: 'name a bank that does not exist',
});

plan(12, 'the line clear is silent', {
  mutate: (s) => sub(s, '      cue(CUE.clear);', '      void CUE;'),
  expectText: 'does not play the reward cue',
});

/* THE ANCHOR MOVED WHEN THE BUZZ JOINED THE LADDER. PUP-WO-0404 made the buzz's LENGTH
 * one of the four dimensions the combo drives, so the flat `api.vibrate(18)` that used to
 * sit beside the clear cue is now inside comboReact with the sparks, the flash and the
 * pitch — one function owning the child's whole channel, so its dimensions cannot drift
 * apart at separate call sites. The plant follows it. A stale anchor here does not fail
 * quietly: the harness reports HARNESS-BROKE rather than counting the section green,
 * which is the only reason this was found rather than silently stopping. */
plan(12, 'the line clear does not buzz', {
  mutate: (s) => sub(s, '    try { api.vibrate(BUZZ_MS_BASE + BUZZ_MS_STEP * (rank - 1)); } catch (e) {}', '    /* no buzz */'),
  expectText: 'did not buzz',
});

plan(12, 'the refusal bites — a square-wave error cue', {
  mutate: (s) => sub(s, "    refuse: 'lock',", "    refuse: 'error',"),
  expectText: 'harsh cue',
});

plan(12, 'the refused drop is silent, so nothing tells him it was refused', {
  mutate: (s) => sub(s, '    else cue(CUE.refuse);', '    else void CUE;'),
  expectText: 'no refusal cue at all',
});

plan(12, 'the module builds its own AudioContext', {
  mutate: (s) => sub(s, '  function cue(name) {\n    if (dead) return;',
    '  var ownCtx = null;\n  function cue(name) {\n    if (dead) return;\n    try { if (!ownCtx) ownCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}'),
  expectText: 'constructed 1 AudioContext',
});

plan(13, 'the paw stamp is never drawn', {
  mutate: (s) => sub(s, '    if (typeof pawSVG !== \'function\') return \'\';', '    return \'\';'),
  expectText: 'stamped no paw',
});

plan(13, 'the sweep never runs on a clear', {
  mutate: (s) => sub(s, '      sweep();', '      void 0;'),
  expectText: 'ran no sweep',
});

plan(13, 'the sweep is left on the board instead of being cleaned up', {
  mutate: (s) => sub(s, '    sweepTimer = setTimeout(function () { sweepTimer = 0; clearSweep(); }, 700);', '    sweepTimer = 0;'),
  expectText: 'outlived the clear',
});

plan(13, 'reduced motion is ignored and the sweep runs anyway', {
  mutate: (s) => sub(s, '    if (dead || reduced) return;', '    if (dead) return;'),
  expectText: 'ran with prefers-reduced-motion set',
});

plan(13, 'the ground texture bleeds through the empty cells', {
  mutate: (s) => sub(s, "    '-webkit-appearance:none;background:#e3cfa8;border-radius:22%;',",
    "    '-webkit-appearance:none;background:rgba(227,207,168,.55);border-radius:22%;',"),
  expectText: 'translucent',
});

/* ------------------------------------------------------------------------
 * THE THIRD WAVE. A three-lens pass planted nine more defects against the 0402
 * sections and check 21 went GREEN on every one — including an INVISIBLE DRAGGED
 * PIECE, which turned out not to be a plant at all but the shipped state.
 * ---------------------------------------------------------------------- */

plan(11, 'the dragged piece draws nothing — an empty box follows the finger', {
  mutate: (s) => sub(s, "    '.bp-drag{position:absolute;left:0;top:0;display:grid;pointer-events:none;z-index:5;',",
    "    '.bp-drag{position:absolute;left:0;top:0;pointer-events:none;z-index:5;',"),
  expectText: 'draws no cells at all',
});

plan(11, 'the picture is desynced from the drop HORIZONTALLY only', {
  mutate: (s) => sub(s, '    var ox = x - rr.left - (drag.grabC + 0.5) * cellPx;',
    '    var ox = x - rr.left - (drag.grabC + 0.5) * cellPx - 20;'),
  expectText: 'the picture lands',
});

plan(11, 'the drag proxy is always one cell, whatever the piece', {
  mutate: (s) => sub(s, '    var w = drag.piece.w * cellPx;\n    var h = drag.piece.h * cellPx;',
    '    var w = cellPx;\n    var h = cellPx;'),
  expectText: 'box against a',
});

plan(11, 'the ghost is painted a cell away from the well it marks', {
  mutate: (s) => sub(s, "    '.bp-ghost{position:absolute;inset:8%;border-radius:22%;pointer-events:none}',",
    "    '.bp-ghost{position:absolute;inset:8%;border-radius:22%;pointer-events:none;transform:translateY(-72%)}',"),
  expectText: 'from the centre of the cell it marks',
});

plan(11, 'the last column is unreachable by drag', {
  mutate: (s) => sub(s, '    var col = Math.floor(((x - rect.left) / rect.width) * N) - d.grabC;',
    '    var col = Math.floor(((x - rect.left) / rect.width) * N) - d.grabC;\n    if (col >= N - 1) col = N - 2;'),
  expectText: 'cannot be reached with the piece visible',
});

plan(12, 'the piece landing makes no sound of its own', {
  mutate: (s) => sub(s, '    } else {\n      cue(CUE.drop);\n    }', '    }'),
  expectText: 'makes no sound of its own',
});

plan(12, 'a cue is scheduled 2.5s out and speaks after the child has gone', {
  mutate: (s) => sub(s, '    else cue(CUE.refuse);',
    "    else { cue(CUE.refuse); setTimeout(function () { try { api.sound('chime'); } catch (e) {} }, 2500); }"),
  expectText: 'after teardown',
});

plan(13, 'the stamp is a blank SVG rather than the paw', {
  mutate: (s) => sub(s, 'encodeURIComponent(pawSVG(100, ramp.light))', "encodeURIComponent('<svg/>')"),
  expectText: 'do not carry a paw',
});

plan(13, 'the radar ground is painted ON TOP of the board as a green haze', {
  mutate: (s) => sub(s, "    '.bp-grid{display:grid;width:100%;height:100%;gap:3px}',",
    "    '.bp-grid{display:grid;width:100%;height:100%;gap:3px}',\n" +
    "    '.bp-boardwrap::after{content:\"\";position:absolute;inset:0;z-index:9;pointer-events:none;' +\n" +
    "      'background:repeating-radial-gradient(circle at 50% 50%,rgba(0,255,136,.55) 0 2px,rgba(0,255,136,.42) 2px 40px)}',"),
  expectText: 'decorative layer is drawn over the board',
});

plan(13, 'a paw is left stranded over a cell that came back to life', {
  mutate: (s) => sub(s, `          st.stamp.classList.remove('bp-stamped');
          st.stamp.hidden = true;
        }`, '        }'),
  expectText: 'stranded over it',
});

plan(14, 'the tray divides both axes by one span, as the source did', {
  mutate: (s) => sub(s, '      var cell = Math.floor(Math.min(innerW / p.w, innerH / p.h));',
    '      var cell = Math.floor(Math.min(innerW, innerH) / Math.max(p.w, p.h, 3));'),
  expectText: 'half the slot',
});

{
  /* SECTIONS WITH REAL TIME IN THEM DO NOT SHARE THE MACHINE.
   * §6 lands a piece INSIDE a 280ms window and §13 samples a 620ms sweep — both are wall
   * clock, and under lane contention on a 2-core CI runner the CDP round trips alone
   * outlast the window. They went red at random: two local runs failed on different
   * scenarios, and CI failed on a third combination while CHECK 21 ITSELF PASSED. That is
   * a harness defect, not a build one, and a gate that is red at random is one people
   * learn to ignore. Everything else runs in lanes; these run alone, afterwards. */
  /* ------------------------------------------------------------------------
 * PUP-WO-0403 — the regression PUP-WO-0402 introduced, found on the device.
 * ---------------------------------------------------------------------- */

/* THE DEFECT ITSELF: remove the third [hidden] rule and display:grid beats the UA
 * stylesheet again, so dragEl.hidden = true does nothing and the piece stays on the board
 * after the child lets go. This is the state Scotty photographed. */
plan(15, 'display:grid defeats [hidden] and the piece stays painted after release', {
  mutate: (s) => sub(s, "    '.bp-drag[hidden]{display:none}',", ''),
  expectText: 'still painted after',
});

/* And the assertion must not be satisfiable by the ATTRIBUTE, which was set throughout
 * the defect. Set it and hide nothing: still red. */
plan(15, 'the hidden attribute is set but nothing is actually hidden', {
  mutate: (s) => sub(s, "    '.bp-drag[hidden]{display:none}',", "    '.bp-drag[hidden]{display:grid}',"),
  expectText: 'still painted after',
});


/* ============================ PUP-WO-0404 ==================================
 * Sixteen plants for sections 16-19. Every one is a REAL defect that PARSES —
 * a constant that stops rising, a guard removed, a channel given an opposite —
 * and every one is required to go red for its OWN stated reason. A plant that
 * merely breaks the module proves nothing about the check that catches it.
 * ========================================================================= */

/* --- §16 the child's channel ------------------------------------------- */

plan(16, 'the particle count stops rising with the combo', {
  mutate: (s) => sub(s, '  var SPARKS_PER_CELL_STEP = 1;', '  var SPARKS_PER_CELL_STEP = 0;'),
  expectText: 'particle count does not rise',
});

plan(16, 'the flash is the same brightness at every combo', {
  mutate: (s) => sub(s, '  var FLASH_PEAK_STEP = 0.07;', '  var FLASH_PEAK_STEP = 0;'),
  expectText: 'does not get brighter',
});

/* THE FAILURE THE LADDER IS BOUNDED AGAINST, and it is silent in the product: playTone
 * pins hz into [40,3000], so a step this size makes ranks 4 and 5 the SAME note while
 * every line of the module still reads as though they differ. */
plan(16, 'the pitch ladder walks past the shell\'s 3000 Hz clamp', {
  mutate: (s) => sub(s, '  var COMBO_HZ_STEP = 210;', '  var COMBO_HZ_STEP = 900;'),
  expectText: 'clamp',
});

/* NORTHSTAR §5's WHOLE OBJECTION TO SCORES, BUILT: a placement that clears nothing is
 * given a low note of its own, and the channel that could only say "good" and "better"
 * can now say "bad". */
plan(16, 'a placement that clears nothing is given a sad note', {
  mutate: (s) => sub(s, '    } else {\n      cue(CUE.drop);\n    }',
    '    } else {\n      cue(CUE.drop);\n      try { api.tone(180, 140, \'sine\'); } catch (e) {}\n    }'),
  expectText: 'spoke in the child',
});

/* --- §17 the ruling's own falsification test ---------------------------- */

/* THE FEATURE REDUCED TO WHAT IT REPLACED: the combo still rises, still scores, still
 * plays its rising note — and the BOARD reacts identically at every multiplier, so the
 * only thing that carries it to a person is the numeral a three-year-old cannot read. */
plan(17, 'the combo reaches the child only as a digit', {
  mutate: (s) => sub(sub(s, '  var SPARKS_PER_CELL_STEP = 1;', '  var SPARKS_PER_CELL_STEP = 0;'),
    '  var FLASH_PEAK_STEP = 0.07;', '  var FLASH_PEAK_STEP = 0;'),
  expectText: 'pixel-identical',
});

/* AND THE INSTRUMENT'S OWN NULL RESULT MUST STILL HOLD. If the module is made
 * non-deterministic the two baseline captures stop matching, and §17 must say THAT
 * rather than going on to report a difference it can no longer interpret. */
plan(17, 'the burst is randomised, so no two frames are alike', {
  mutate: (s) => sub(s, '      var dist = spread * (0.42 + 0.58 * (((i * 37) % 100) / 100));',
    '      var dist = spread * (0.42 + 0.58 * ((Date.now() + i * 37) % 100) / 100);'),
  expectText: 'cannot tell a real change from noise',
});

/* --- §18 the adult's readout -------------------------------------------- */

plan(18, 'the readout is laid over the tray slots', {
  mutate: (s) => sub(s, "    '.bp-score{flex:0 0 auto;pointer-events:none;text-align:right;padding:0 8px 4px 0;',",
    "    '.bp-score{position:absolute;right:10px;top:50%;pointer-events:none;text-align:right;padding:0 8px 4px 0;',"),
  expectText: 'overlaps',
});

plan(18, 'the readout sits in the exit\'s column', {
  mutate: (s) => sub(s, "    '.bp-score{flex:0 0 auto;pointer-events:none;text-align:right;padding:0 8px 4px 0;',",
    "    '.bp-score{position:fixed;left:12px;top:210px;pointer-events:none;text-align:right;padding:0 8px 4px 0;',"),
  expectText: "exit's column",
});

plan(18, 'the readout takes pointer events and can eat a tap', {
  mutate: (s) => sub(s, "    '.bp-score{flex:0 0 auto;pointer-events:none;text-align:right;padding:0 8px 4px 0;',",
    "    '.bp-score{flex:0 0 auto;pointer-events:auto;text-align:right;padding:0 8px 4px 0;',"),
  expectText: 'takes pointer events',
});

/* A NUMBER THAT IS PAINTED ONCE AND NEVER AGAIN. The readout exists, is the right size,
 * is in the right place, and is wrong — which is exactly the shape a geometry-only
 * check passes. */
plan(18, 'the readout is painted once and never updated', {
  mutate: (s) => sub(s, "    scoreEl.textContent = String(score);", "    scoreEl.textContent = scoreEl.textContent || '0';"),
  expectText: 'not the score',
});

/* --- §19 the win --------------------------------------------------------- */

plan(19, 'clearing the whole board is not detected at all', {
  mutate: (s) => sub(s, '    var perfect = lines > 0 && boardEmpty(board);', '    var perfect = false;'),
  expectText: 'passed unnoticed',
});

/* THE DEFECT THIS SECTION WAS WRITTEN AFTER FINDING, PLANTED AS THE HALF-FIX SOMEONE
 * WOULD ACTUALLY WRITE. Deleting the guard outright is a worse plant than it looks: the
 * celebration is then destroyed before the section's FIRST assertion samples it, so the
 * check goes red saying "clearing the whole board passed unnoticed" and the settle-window
 * assertion is never reached — red, for the wrong reason, proving nothing about the line
 * it exists to defend. Measured, not guessed; that is what this control reported first.
 *
 * So plant the plausible mistake instead. "The problem is the synthesised CLICK, so guard
 * the click" leaves a real finger's touchend dismissing the celebration instantly, which
 * is the same bug for the child and invisible to a check that only watches for clicks. */
plan(19, 'the settle window guards only the synthesised click, not a finger', {
  mutate: (s) => sub(s, '      if (!fromTimer && (Date.now() - openedAt) < CELEB_ARM_MS) return;',
    "      if (ev && ev.type === 'click' && (Date.now() - openedAt) < CELEB_ARM_MS) return;"),
  expectText: 'settle window',
});

plan(19, 'the celebration never ends on its own', {
  mutate: (s) => sub(s, '    fxAfter(reduced ? CELEB_MS_REDUCED : CELEB_MS, function () { leave(null, true); });',
    '    void CELEB_MS_REDUCED; void CELEB_MS;'),
  expectText: 'never ends on its own',
});

/* A WIN FIRED BY OPENING THE GAME. The board is empty because he won it yesterday. */
plan(19, 'a resumed empty board celebrates on mount', {
  mutate: (s) => sub(s, '  renderScore();\n  if (over) showOver();', '  renderScore();\n  if (boardEmpty(board)) celebrate();\n  if (over) showOver();'),
  expectText: 'already empty fires a celebration',
});

/* THE FIRST VERSION OF THIS PLANT WAS A NO-OP AND THE HARNESS REPORTED IT GREEN, WHICH
 * IS THE CORRECT VERDICT ON A CHECK THAT WAS NEVER GIVEN A DEFECT. It inserted
 * `if (0) endCelebration();` and left the real call standing three lines below, so the
 * module was unchanged and §19 rightly passed. A plant must remove the behaviour, not
 * add a statement near it. */
/* AND IT IS THE TIMERS THAT SURVIVE, NOT THE NODES — measured, after this control first
 * reported RED-WRONG-REASON against `expectText: 'survived teardown'`. release() removes
 * `root` from the document, and the celebration and the spark layer are inside it, so the
 * NODES go whether or not endCelebration ran. What outlives the game is the staggered
 * volley and the 3.4s self-return: "the game left 2 timer(s) and 0 interval(s) armed
 * mid-celebration". Worth stating because it means §19's node assertion CANNOT catch this
 * defect — it is there for a different one, an effect that escapes its container — and
 * only the timer assertion stands between a teardown and a callback firing into a dead
 * closure. Pointing this plant at the message it actually produces is what makes that
 * visible instead of leaving two assertions that look interchangeable. */
plan(19, 'teardown leaves the fireworks running', {
  mutate: (s) => sub(s, 'body sweep to report. */\n    endCelebration();\n    if (ro) {', 'body sweep to report. */\n    if (ro) {'),
  expectText: 'armed mid-celebration',
});

/* Anchored on the function header too: `if (dead || celebEl) return;` is armFxSweep's
 * guard as well, and an anchor that matches twice plants nothing. */
plan(19, 'reduced motion removes the win instead of stilling it', {
  mutate: (s) => sub(s, '  function celebrate() {\n    if (dead || celebEl) return;',
    '  function celebrate() {\n    if (dead || celebEl || reduced) return;'),
  expectText: 'the win disappears',
});

/* ---- PUP-WO-0704: THE WIN ITSELF ------------------------------------------ *
 * §20 IS THE CHECK A COMMENT HAD BEEN STANDING IN FOR. blockpop.js claimed "with it
 * covered, the win is still a screenful of fireworks ... Acceptance §1 measures that
 * with every painted word masked", and no check anywhere photographed a celebration
 * with words masked. So these five plants are the first evidence that section can catch
 * anything, and they are chosen to hit ONE CLAUSE EACH — the win has two carriers now,
 * and two carriers is exactly the arrangement in which a one-at-a-time plant passes. */

/* THE DEFECT §0 ACTUALLY MEASURED, PUT BACK. The light is real, it is built with the
 * right peak, and it is painted into a layer that the celebration's own z-index-12 scrim
 * covers — which delivered 13 of 765 to the glass in both motion worlds. Nothing about
 * the element is wrong; only where it hangs. */
plan(20, "the win's light is painted under the celebration's own scrim again", {
  mutate: (s) => sub(s, '    celebEl.appendChild(burst);', '    boardWrap.appendChild(burst);'),
  expectText: "the win's light is not inside the celebration",
});

/* THE HALF-BUILD. The layer is assembled and never attached, so `celebrate()` reads as
 * if it paints and paints nothing — AND THE 48 SPARKS FROM THE LINE CLEAR THAT WON THE
 * GAME ARE STILL FLYING while this frame is taken. That is the trap PUP-WO-0704 §5 names
 * by name: a words-covered assertion that passes on leftover sparks rather than on the
 * celebration's own effects. If §20 were built the naive way — photograph the win, check
 * it differs from the idle board — this plant would be GREEN. */
plan(20, 'the celebration builds its whole light layer and never attaches it', {
  mutate: (s) => sub(s, '    celebEl.appendChild(burst);\n', ''),
  expectText: 'the win painted no light layer at all',
});

/* THE LIGHT GOES OUT AND THE BLOOMS STAY. Peak 0 is a live possibility rather than an
 * invention: it is what a refactor that stopped resolving FLASH_PEAK_BASE would produce.
 * The blooms alone still repaint ~10-18% of the screen, so this is the plant that proves
 * the per-carrier clause is doing work the headline cannot do. */
plan(20, "the win's light is built at zero brightness", {
  mutate: (s) => sub(s, "    wash.style.setProperty('--bp-peak', String(Math.round((FLASH_PEAK_BASE + FLASH_PEAK_STEP * (COMBO_TOP - 1)) * 1000) / 1000));",
    "    wash.style.setProperty('--bp-peak', '0');"),
  expectText: "the win's light on its own repaints",
});

/* AND THE CONVERSE, WHICH IS THE ONE THE HEADLINE CANNOT SEE AT ALL. Sixteen blooms are
 * built, sized, inside the celebration and completely transparent. Every structural
 * clause in §20 passes, the headline stays at 99% because the light is still up, and the
 * only thing standing between this and a green check is the number measured for the
 * blooms on their own. Redundant signals make a one-at-a-time plant green; this is that
 * shape, planted deliberately. */
plan(20, 'the blooms are built, sized, and paint nothing', {
  mutate: (s) => sub(s, "    'rgb(255 255 255 / .92) 0%,var(--bp-c) 44%,rgb(255 255 255 / 0) 74%);',",
    "    'rgb(255 255 255 / 0) 0%,rgb(255 255 255 / 0) 44%,rgb(255 255 255 / 0) 74%);',"),
  expectText: 'putting no ink on the glass',
});

/* AND A BLOOM WITH NO SIZE, WHICH IS WHAT A GEOMETRY REFACTOR PRODUCES. `--bp-sz` feeds
 * the width, the height AND the two negative margins that centre the disc on its point;
 * a zero there leaves sixteen elements in the DOM, inside the celebration, with the
 * right colour and the right animation, occupying nothing. A rect comes from style, not
 * from ink — and here even the rect is honest, which is why the clause that catches this
 * is a rect clause rather than a pixel one. */
plan(20, 'every bloom is built at zero size', {
  mutate: (s) => sub(s, "        Math.round((34 + ((bi * 23) % 5) * 11) * (reduced ? BLOOM_CALM_SCALE : 1)) + 'px');",
    "        '0px');"),
  expectText: 'in the DOM with no size',
});

/* THE DEFECT §0 MEASURED, RESTORED EXACTLY — AND THE FIRST VERSION OF §20 STAYED GREEN
 * AGAINST IT. The clause meant to catch this read `celebEl.querySelectorAll('.bp-flash')`,
 * and `flash()` appends into `.bp-fx` inside `boardWrap`, which is a SIBLING of
 * `.bp-celeb`. The count was structurally zero for every build that could ever exist, and
 * three comments claimed it was standing guard. The adversarial pass planted this line and
 * §20 printed 99.65% and passed. It is the highest-value plant in this file, because the
 * thing it caught was a described guarantee written INTO the fix for a described
 * guarantee. */
plan(20, "the win's light is painted with flash() again, under the celebration's own scrim", {
  mutate: (s) => sub(s, '    var per = SPARKS_PER_CELL_BASE + SPARKS_PER_CELL_STEP * (COMBO_TOP - 1) + 3;',
    '    var per = SPARKS_PER_CELL_BASE + SPARKS_PER_CELL_STEP * (COMBO_TOP - 1) + 3;\n'
    + '    flash(FLASH_PEAK_BASE + FLASH_PEAK_STEP * (COMBO_TOP - 1), FLASH_MS * 2);'),
  expectText: '.bp-flash elements are on the glass',
});

/* THE MODULE STOPS BELIEVING IN THE REDUCED WORLD, WHICH IS A ONE-WORD MISTAKE AND
 * INVISIBLE TO A CHECK THAT ASKS THE BROWSER. §20's world clause used to call
 * `matchMedia`, so with this planted BOTH of its worlds printed byte-identical unreduced
 * numbers — 38 travelling sparks in the run labelled "reduce" — and it passed, declaring
 * itself green "in the reduced-motion world as well as the other one". §21 caught it, but
 * reported it as a transform defect. Both are fixed and both are proved by this one line:
 * §20 now reads `.bp-celeb-calm`, which is the module's own expression of the snapshot,
 * and §21 asks the cause before the symptom. */
plan(20, 'the module never believes it is in the reduced-motion world', {
  mutate: (s) => sub(s, '  var reduced = !!api.prefersReducedMotion;', '  var reduced = false;'),
  expectText: 'the MODULE thinks it is in the unreduced world',
});

/* AND THE SAME PLANT AIMED AT §21, which must now name the CAUSE rather than the rect it
 * happens to notice first. */
plan(21, 'the module never believes it is in the reduced-motion world', {
  mutate: (s) => sub(s, '  var reduced = !!api.prefersReducedMotion;', '  var reduced = 0 === 1;'),
  expectText: 'not wearing .bp-celeb-calm',
});

/* §21 — REDUCED MOTION. Both halves of acceptance §4, and each has its own plant,
 * because "it is there" and "it is still" are satisfied by opposite defects. */

/* THE DEFECT THAT SHIPPED, IN THE NEW EFFECT'S CLOTHES. `burstAt` returned 0 when
 * `reduced` was set and the calm world got a scrim and a word; this is the same decision
 * made one function along. It is also why §20 runs in both worlds — if §21 were the only
 * reduced-motion section, this plant would need to be caught by a count alone. */
plan(21, 'the reduced-motion win builds no blooms, exactly as burstAt built no sparks', {
  mutate: (s) => sub(s, '    for (var bi = 0; bi < BLOOM_N; bi++) {', '    for (var bi = 0; bi < (reduced ? 0 : BLOOM_N); bi++) {'),
  expectText: 'the win paints no blooms at all',
});

/* AND THE OPPOSITE MISTAKE, WHICH IS THE EASIER ONE TO MAKE. "Reduced motion still gets
 * a celebration" is satisfied by handing the calm world the travelling animation, and
 * that is a worse outcome than stillness — the preference exists to prevent exactly that
 * motion. Deleting the calm rule is how it would happen: the selector goes, the base
 * `.bp-bloom` animation applies to both worlds, every count §21 takes is unchanged, and
 * only the rect comparison notices. */
plan(21, 'the calm world is handed the travelling bloom', {
  mutate: (s) => sub(s, "    '.bp-celeb-calm .bp-bloom{animation:bp-bloom-calm var(--bp-dur) ease-in-out var(--bp-del) both}',\n", ''),
  expectText: 'changed rect between',
});

/* RUN ALONE, AFTER THE REST. 6 and 13 land inside a 280ms window and sample a 620ms
 * sweep; 16 counts particles and measures screenshot luminance; 17 compares whole frames
 * for byte equality; 19 waits out a 3.4s self-return and a 350ms settle window. All of
 * them are wall-clock assertions, and CI's runners are 2-core: three separate CI failures
 * were bought learning that a browser-bound lane count is not a CPU count. */
/* 20 and 21 join them: each runs a perfect clear in BOTH motion worlds, and §20 takes
 * six full-viewport screenshots per world and decodes them in-page. Nothing in either is
 * a wall-clock ASSERTION — both freeze the animations and drop the game's pending timers
 * first, so the numbers are the same on a fast box and a slow one — but they are the two
 * heaviest sections in the file, and putting them in a lane with three others is how a
 * heavy section starves a timed one next door. */
const TIMED = new Set([6, 13, 16, 17, 19, 20, 21]);

/* THE BANNER MOVED, AND IT WAS WRONG WHERE IT WAS. It printed `QUEUE.length` from a
 * position PART WAY DOWN THE LIST OF plan() CALLS, so it reported the number of defects
 * declared ABOVE that line rather than the number about to run — 52 of 70 here, and it
 * had been under-reporting before this work order added any. A count taken before the
 * thing it counts is finished is the same defect as a count typed by hand: it reads as
 * authoritative and rots without anyone touching it. Printed here, after the last
 * plan(), where QUEUE is complete. */
console.log(`  ${QUEUE.length} planted defects, ${LANES} at a time (the timing-sensitive ones alone, afterwards).\n`);
  /* ---- PRE-FLIGHT: VALIDATE THE PLANT LIST BEFORE SPENDING TEN MINUTES ON IT -------
   * Three ways a plant can be worthless, all of them silent, all of them findable in
   * under a second — and every one of them has actually shipped in this repo's sibling
   * control file:
   *
   *   STALE   its anchor no longer matches, or matches twice. `sub` already throws on
   *           that, but only when its lane gets there — which is after four browsers
   *           have booted and, for a TIMED section, after everything else has finished.
   *   NO-OP   it applies and changes nothing. The scenario runner catches this too, and
   *           equally late.
   *   TWIN    two plants that produce a byte-identical mutated file. Nothing catches
   *           this at all: the pair runs, both go red, and the report claims two
   *           independent defects were demonstrated when one defect was demonstrated
   *           twice and some other clause has no coverage. THIS IS THE ONE THE RUNNER
   *           CANNOT SEE, and it is why this block exists rather than being left to the
   *           two guards that were already here.
   *
   * `--dry` stops after this, which is the whole point: the list can be validated in a
   * second before anyone pays for the browsers. */
  {
    const src = readFileSync(join(REPO, MODULE), 'utf8');
    const seen = new Map();
    const problems = [];
    for (const { section, label, spec } of QUEUE) {
      let out;
      try { out = spec.mutate(src, REPO); }
      catch (e) { problems.push(`§${section} ${label} — anchor: ${String(e && e.message ? e.message : e)}`); continue; }
      if (out === src) { problems.push(`§${section} ${label} — applies and changes nothing`); continue; }
      const h = createHash('sha256').update(out).digest('hex');
      if (seen.has(h)) problems.push(`§${section} ${label} — produces a file byte-identical to ${seen.get(h)}, so one of the two is proving nothing`);
      else seen.set(h, `§${section} ${label}`);
    }
    if (problems.length) {
      console.error(`\n::error::CHECK 21 CONTROLS — ${problems.length} plant(s) are invalid before a single browser was started.`);
      for (const m of problems) console.error(`  ${m}`);
      process.exit(1);
    }
    console.log(`  pre-flight: ${QUEUE.length} plants, every one applying to a distinct file.\n`);
    if (process.argv.includes('--dry')) process.exit(0);
  }

  const parallel = QUEUE.map((q, i) => ({ q, i })).filter((x) => !TIMED.has(x.q.section));
  const serial = QUEUE.map((q, i) => ({ q, i })).filter((x) => TIMED.has(x.q.section));
  const ordered = new Array(QUEUE.length);
  let next = 0;
  const lane = async () => {
    for (;;) {
      const k = next++;
      if (k >= parallel.length) return;
      const { q, i } = parallel[k];
      ordered[i] = await scenario(q.section, q.label, q.spec);
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
  for (const { q, i } of serial) ordered[i] = await scenario(q.section, q.label, q.spec);
  for (const r of ordered) if (r) results.push(r);
}

for (const r of results) {
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'}  ${r.observed.padEnd(17)} §${r.section}  ${r.label}`);
  if (r.detail) console.log(`        ${r.detail}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length} of ${results.length} planted defect(s) demonstrated red.`);
if (failed.length) {
  console.error(`\n::error::CHECK 21 CONTROLS FAILED — ${failed.length} section(s) of demo-blockpop.mjs cannot be shown catching the defect they exist for.`);
  for (const f of failed) console.error(`  §${f.section} ${f.label} — observed ${f.observed}${f.detail ? ' — ' + f.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 21 CONTROLS PASSED — ${results.length} planted defects, every one red for its own stated reason.`);
