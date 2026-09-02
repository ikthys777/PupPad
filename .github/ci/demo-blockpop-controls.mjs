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

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-blockpop.mjs');
const MODULE = join('games', 'blockpop.js');

console.log('CHECK 21 CONTROLS — every section of demo-blockpop.mjs, shown red against a planted defect.\n');

const results = [];

/* Replace exactly once, and fail loudly if the anchor moved — a control that silently
 * plants nothing reports GREEN and reads as "the check cannot catch this". */
function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}

function scenario(section, label, { mutate, expectText }) {
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

    let out = '';
    let code = 0;
    try {
      out = execFileSync(process.execPath, [CHECK, dir, `--only=${section}`], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000,
        env: { ...process.env, PUPPAD_SUBJECT: 'deadbeefcafe0' },
      });
    } catch (e) { code = e.status ?? 1; out = (e.stdout || '') + (e.stderr || ''); }
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
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${observed.padEnd(17)} §${section}  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/* 1 — the exit's column. PUP-WO-0301's worst defect was #gameBack swallowing a control;
 * this is the same defect in the same place, and section 1 is the converse question. */
scenario(1, 'the left gutter is a bare 8px, so the board runs under #gameBack', {
  mutate: (s) => sub(s, "'padding-left:max(84px,calc(env(safe-area-inset-left) + 74px));',", "'padding-left:8px;',"),
  expectText: "intersect #gameBack's column",
});

/* 2 — a drop that reports itself illegal everywhere. */
scenario(2, 'hitCell never reports a legal drop', {
  mutate: (s) => sub(s, 'return { row: row, col: col, valid: canPlace(board, d.piece.cells, row, col) };',
    'return { row: row, col: col, valid: false };'),
  expectText: 'a legal drop did not fill exactly one cell',
});

/* 3 — the source's own gate, restored. */
scenario(3, "the tap slop is the source's 14 again", {
  mutate: (s) => sub(s, '  var TAP_SLOP = 32;', '  var TAP_SLOP = 14;'),
  expectText: 'the tap slop is too narrow',
});

/* 4 — the scoring formula, wrong in the line-bonus term. */
scenario(4, 'scorePlacement drops the line bonus', {
  mutate: (s) => sub(s, '      s += 10 * lines * Math.max(1, combo);', '      s += 1 * lines;'),
  expectText: 'the score did not rise by the formula',
});

/* 5 — THE INVISIBLE ONE. The naive port: repaint everything on every pointer move and
 * re-animate every filled cell, which is what `popping={!!color && !dying}` does the
 * moment the reconciler stops preserving the node. */
scenario(5, 'every pointermove repaints the board and re-pops every candy', {
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
scenario(6, "the source's stranded clearing window, restored", {
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
scenario(7, 'the board is retained at module scope across mounts', {
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
    out = sub(out, '    persist();\n    try { delete host[entry.id]; }', '    __retainedBoard = board;\n    persist();\n    try { delete host[entry.id]; }');
    return out;
  },
  expectText: 'module state survived the teardown',
});

/* 8 — an observer that outlives the game. */
scenario(8, 'the ResizeObserver is never disconnected', {
  mutate: (s) => sub(s, '    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }', '    if (ro) { ro = null; }'),
  expectText: 'never disconnected',
});

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length} of ${results.length} section(s) demonstrated red against a planted defect.`);
if (failed.length) {
  console.error(`\n::error::CHECK 21 CONTROLS FAILED — ${failed.length} section(s) of demo-blockpop.mjs cannot be shown catching the defect they exist for.`);
  for (const f of failed) console.error(`  §${f.section} ${f.label} — observed ${f.observed}${f.detail ? ' — ' + f.detail : ''}`);
  process.exit(1);
}
console.log('\nCHECK 21 CONTROLS PASSED — all 8 sections go red, each for its own stated reason.');
