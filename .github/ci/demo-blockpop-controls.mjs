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
const LANES = Math.max(2, Math.min(6, (cpus() || { length: 4 }).length - 2));

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
  const pass = observed === 'RED';
  results.push({ section, label, observed, pass, detail });
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
  expectText: 'a legal drop did not fill exactly one cell',
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
    out = sub(out, `        if (isDying) toClear.push(st.candy);
        else if (st.shown === 0) toPop.push(st.candy);
        else st.candy.classList.remove('bp-clear');`, `        if (isDying) toClear.push(st.candy);
        else toPop.push(st.candy);`);
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

plan(1, 'the tray renders 1px pieces — three empty boxes', {
  mutate: (s) => sub(s, '      var cell = Math.max(8, Math.floor((room > 0 ? room : 88) / span));',
    '      var cell = 1;'),
  expectText: 'tray piece cell',
});

plan(2, 'grabCell divides the SLOT, not the piece — a 3-wide piece is unaimable', {
  mutate: (s) => sub(s, `    var pbox = target.querySelector('.bp-piece');
    var rect = (pbox || target).getBoundingClientRect();
    if (!rect.width || !rect.height) rect = target.getBoundingClientRect();`,
    '    var rect = target.getBoundingClientRect();'),
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

console.log(`  ${QUEUE.length} planted defects, ${LANES} at a time.\n`);
{
  let next = 0;
  const ordered = new Array(QUEUE.length);
  const lane = async () => {
    for (;;) {
      const i = next++;
      if (i >= QUEUE.length) return;
      const before = results.length;
      await scenario(QUEUE[i].section, QUEUE[i].label, QUEUE[i].spec);
      ordered[i] = results[before];
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
  results.length = 0;
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
