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
const plan = (section, label, spec) => QUEUE.push({ section, label, spec });

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

plan(12, 'the line clear does not buzz', {
  mutate: (s) => sub(s, '      try { api.vibrate(18); } catch (e) {}', '      /* no buzz */'),
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

console.log(`  ${QUEUE.length} planted defects, ${LANES} at a time.\n`);
{
  let next = 0;
  const ordered = new Array(QUEUE.length);
  const lane = async () => {
    for (;;) {
      const i = next++;
      if (i >= QUEUE.length) return;
      ordered[i] = await scenario(QUEUE[i].section, QUEUE[i].label, QUEUE[i].spec);
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
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
