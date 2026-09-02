/* games/blockpop.js — Block Pop: easy 6x6, playable end to end.  PUP-WO-0400.
 *
 * Ported from /home/ikthys777/PupPad-sources/blockpop (React + Zustand + Tailwind) to
 * one shell-mounted module with no framework, no build step and no network.
 *
 * WHAT IS AT MODULE SCOPE AND WHY THAT IS NOT A §8.2 VIOLATION
 * -----------------------------------------------------------
 * Only FROZEN CONSTANT TABLES live out here — the shape catalogue and the colour ramps.
 * They are data, they are immutable, and they are identical for every mount. The hazard
 * §8.2 obligation 6 and PUP-WO-0400 §0.4 name is *mutable* state surviving a remount:
 * `blocks` and `blocks-big` are two registry entries against ONE module URL, the shell
 * imports with a bare specifier and no cache-buster, so the module object is evaluated
 * once and shared. Anything mutable up here would leak the first entry's game into the
 * second and silently override its params. Every mutable binding in this file is
 * therefore declared inside mount(). The source's `store.ts:156` module-scope create()
 * and its `store.ts:424` window.__blockPop debug global do not come across.
 *
 * Deliberately NOT ported (PUP-WO-0400 §4): the 8x8 entry, the four assists, particles,
 * audio, cheer text, shake, haptics, the score's presentation, and `Piece.id` — whose
 * only reader was a React key (`PieceTray.tsx:22`), which is not stable or unique (its
 * mint counter resets on module load) and would have imported a bug.
 */

/* --- the shape catalogue (pieces.ts) --------------------------------------- */

function defShape(name, pairs, easy, classic) {
  var cells = [];
  var maxR = 0;
  var maxC = 0;
  for (var i = 0; i < pairs.length; i += 2) {
    var r = pairs[i];
    var c = pairs[i + 1];
    cells.push(Object.freeze([r, c]));
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return Object.freeze({
    name: name, cells: Object.freeze(cells),
    w: maxC + 1, h: maxR + 1, easy: easy, classic: classic
  });
}

/* Block Blast-style polyominoes. Pieces do not rotate; each orientation is its own
 * shape. `easy`/`classic` are relative pick weights; a weight of 0 removes the shape
 * from that mode's pool entirely (shapesFor). Transcribed from pieces.ts:30-89. */
var SHAPES = Object.freeze([
  defShape('dot', [0, 0], 8, 3),
  defShape('duo-h', [0, 0, 0, 1], 7, 4),
  defShape('duo-v', [0, 0, 1, 0], 7, 4),
  defShape('tri-h', [0, 0, 0, 1, 0, 2], 6, 5),
  defShape('tri-v', [0, 0, 1, 0, 2, 0], 6, 5),
  defShape('square', [0, 0, 0, 1, 1, 0, 1, 1], 6, 5),
  defShape('ell-se', [0, 0, 1, 0, 1, 1], 5, 4),
  defShape('ell-sw', [0, 1, 1, 0, 1, 1], 5, 4),
  defShape('ell-ne', [0, 0, 0, 1, 1, 0], 5, 4),
  defShape('ell-nw', [0, 0, 0, 1, 1, 1], 5, 4),
  defShape('quad-h', [0, 0, 0, 1, 0, 2, 0, 3], 2, 5),
  defShape('quad-v', [0, 0, 1, 0, 2, 0, 3, 0], 2, 5),
  defShape('L-0', [0, 0, 1, 0, 2, 0, 2, 1], 0, 4),
  defShape('L-1', [0, 0, 0, 1, 0, 2, 1, 0], 0, 4),
  defShape('L-2', [0, 0, 0, 1, 1, 1, 2, 1], 0, 4),
  defShape('L-3', [1, 0, 1, 1, 1, 2, 0, 2], 0, 4),
  defShape('J-0', [0, 1, 1, 1, 2, 0, 2, 1], 0, 4),
  defShape('J-1', [0, 0, 1, 0, 1, 1, 1, 2], 0, 4),
  defShape('J-2', [0, 0, 0, 1, 1, 0, 2, 0], 0, 4),
  defShape('J-3', [0, 0, 0, 1, 0, 2, 1, 2], 0, 4),
  defShape('T-0', [0, 0, 0, 1, 0, 2, 1, 1], 0, 4),
  defShape('T-1', [0, 1, 1, 0, 1, 1, 2, 1], 0, 4),
  defShape('T-2', [0, 1, 1, 0, 1, 1, 1, 2], 0, 4),
  defShape('T-3', [0, 0, 1, 0, 1, 1, 2, 0], 0, 4),
  defShape('S-h', [0, 1, 0, 2, 1, 0, 1, 1], 0, 3),
  defShape('S-v', [0, 0, 1, 0, 1, 1, 2, 1], 0, 3),
  defShape('Z-h', [0, 0, 0, 1, 1, 1, 1, 2], 0, 3),
  defShape('Z-v', [0, 1, 1, 0, 1, 1, 2, 0], 0, 3),
  defShape('five-h', [0, 0, 0, 1, 0, 2, 0, 3, 0, 4], 0, 3),
  defShape('five-v', [0, 0, 1, 0, 2, 0, 3, 0, 4, 0], 0, 3),
  defShape('rect-23', [0, 0, 0, 1, 0, 2, 1, 0, 1, 1, 1, 2], 0, 4),
  defShape('rect-32', [0, 0, 0, 1, 1, 0, 1, 1, 2, 0, 2, 1], 0, 4),
  defShape('big-square', [0, 0, 0, 1, 0, 2, 1, 0, 1, 1, 1, 2, 2, 0, 2, 1, 2, 2], 0, 3),
  defShape('bigL-0', [0, 0, 1, 0, 2, 0, 2, 1, 2, 2], 0, 4),
  defShape('bigL-1', [0, 0, 0, 1, 0, 2, 1, 0, 2, 0], 0, 4),
  defShape('bigL-2', [0, 0, 0, 1, 0, 2, 1, 2, 2, 2], 0, 4),
  defShape('bigL-3', [0, 2, 1, 2, 2, 0, 2, 1, 2, 2], 0, 4),
  defShape('plus', [0, 1, 1, 0, 1, 1, 1, 2, 2, 1], 0, 3),
  defShape('U', [0, 0, 0, 2, 1, 0, 1, 1, 1, 2], 0, 3),
  defShape('bigT-0', [0, 0, 0, 1, 0, 2, 1, 1, 2, 1], 0, 3),
  defShape('bigT-1', [0, 1, 1, 1, 2, 0, 2, 1, 2, 2], 0, 3)
]);

var DOT = SHAPES[0];
var COLOR_COUNT = 7;
var TRAY_SIZE = 3;
var BOARD_SIZE = Object.freeze({ easy: 6, classic: 8 });

/* styles.css:93-127. Index 0 is colour id 1. */
var CANDY = Object.freeze([
  Object.freeze({ base: '#e15448', light: '#ff8074', dark: '#c23d36' }),
  Object.freeze({ base: '#3b88b0', light: '#68b4d6', dark: '#2b6a8c' }),
  Object.freeze({ base: '#2d9a74', light: '#55c49a', dark: '#217a5b' }),
  Object.freeze({ base: '#e09a32', light: '#f4bc62', dark: '#c07e20' }),
  Object.freeze({ base: '#d45d7a', light: '#ee86a0', dark: '#b3445f' }),
  Object.freeze({ base: '#4aa3a0', light: '#74c8c4', dark: '#35817e' }),
  Object.freeze({ base: '#c96b3c', light: '#e89568', dark: '#a85428' })
]);

export default function mount(host, api) {
  /* ===================================================================== *
   * EVERY MUTABLE BINDING BELOW THIS LINE. See the header.
   * ===================================================================== */

  var entry = api.entry;
  var params = (entry && entry.params) || {};
  var mode = params.mode === 'classic' ? 'classic' : 'easy';
  var N = BOARD_SIZE[mode];
  var reduced = !!api.prefersReducedMotion;

  /* The clear window and the pop, in ms. `CLEAR_MS` is also the window §3 check 6
   * places a second piece inside. */
  var CLEAR_MS = reduced ? 40 : 280;
  var POP_MS = reduced ? 60 : 320;

  /* TAP SLOP — WIDENED FROM THE SOURCE'S 14, DELIBERATELY, AND THE NUMBER IS ASSERTED.
   * BlockPopGame.tsx:142/:153 gates tap-to-select on `dist < 14` and drops anything
   * longer into playInvalid() plus a shake. A three-year-old's tap slides further than
   * 14px routinely, so on the fleet that gate turns ordinary taps into rejections. The
   * shell's own wireTap applies no distance gate at all for exactly this reason. 32px is
   * a little under half a 66px cell: wide enough that a wobbling finger still selects,
   * narrow enough that a deliberate drag across a cell boundary is still a drag. */
  var TAP_SLOP = 32;

  /* --- engine (engine.ts), pure, no DOM --------------------------------- */

  function emptyBoard(n) {
    var b = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(0);
      b.push(row);
    }
    return b;
  }

  function cloneBoard(b) {
    var out = [];
    for (var r = 0; r < b.length; r++) out.push(b[r].slice());
    return out;
  }

  function canPlace(b, cells, row, col) {
    var n = b.length;
    for (var i = 0; i < cells.length; i++) {
      var r = row + cells[i][0];
      var c = col + cells[i][1];
      if (r < 0 || c < 0 || r >= n || c >= n) return false;
      if (b[r][c] !== 0) return false;
    }
    return true;
  }

  function canPlaceAnywhere(b, cells) {
    var n = b.length;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) if (canPlace(b, cells, r, c)) return true;
    }
    return false;
  }

  function applyPiece(b, piece, row, col) {
    var next = cloneBoard(b);
    for (var i = 0; i < piece.cells.length; i++) {
      next[row + piece.cells[i][0]][col + piece.cells[i][1]] = piece.color;
    }
    return next;
  }

  /* engine.ts:53-95. Rows and columns are both collected against the ORIGINAL board
   * before anything is cleared, so a row and a column that cross still clear both and
   * the shared cell is marked once. */
  function clearFullLines(b) {
    var n = b.length;
    var rows = [];
    var cols = [];
    var r, c, full;
    for (r = 0; r < n; r++) {
      full = true;
      for (c = 0; c < n; c++) if (b[r][c] === 0) { full = false; break; }
      if (full) rows.push(r);
    }
    for (c = 0; c < n; c++) {
      full = true;
      for (r = 0; r < n; r++) if (b[r][c] === 0) { full = false; break; }
      if (full) cols.push(c);
    }
    if (rows.length === 0 && cols.length === 0) return { board: b, rows: rows, cols: cols, cells: [] };
    var next = cloneBoard(b);
    var cells = [];
    var marked = Object.create(null);
    function mark(rr, cc) {
      var key = rr + ',' + cc;
      if (marked[key]) return;
      marked[key] = true;
      if (next[rr][cc] !== 0) {
        cells.push({ r: rr, c: cc, color: next[rr][cc] });
        next[rr][cc] = 0;
      }
    }
    for (var i = 0; i < rows.length; i++) for (c = 0; c < n; c++) mark(rows[i], c);
    for (var j = 0; j < cols.length; j++) for (r = 0; r < n; r++) mark(r, cols[j]);
    return { board: next, rows: rows, cols: cols, cells: cells };
  }

  /* engine.ts:131-139, transcribed exactly. */
  function scorePlacement(placedCells, lines, combo) {
    var s = placedCells;
    if (lines > 0) {
      s += 10 * lines * Math.max(1, combo);
      if (lines >= 2) s += 8 * lines;
      if (lines >= 4) s += 20;
    }
    return s;
  }

  function shapesFor(m) {
    var out = [];
    for (var i = 0; i < SHAPES.length; i++) {
      if ((m === 'easy' ? SHAPES[i].easy : SHAPES[i].classic) > 0) out.push(SHAPES[i]);
    }
    return out;
  }

  function pickWeighted(list, m) {
    var total = 0;
    var i;
    for (i = 0; i < list.length; i++) total += (m === 'easy' ? list[i].easy : list[i].classic);
    var roll = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      roll -= (m === 'easy' ? list[i].easy : list[i].classic);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function makePiece(s, color) {
    return { name: s.name, cells: s.cells, w: s.w, h: s.h, color: color };
  }

  /* THE DEAL IS A HARD FILTER, NOT A BIAS. Shapes that fit nowhere are removed from the
   * pool outright and the mode weights renormalise over the survivors, because
   * pickWeighted sums the weights of the list it is handed. DOT is the floor: if even a
   * single cell will not fit, the board is full and the game is over anyway. */
  function pickFittingPiece(b, m) {
    var pool = shapesFor(m);
    var fitting = [];
    for (var i = 0; i < pool.length; i++) if (canPlaceAnywhere(b, pool[i].cells)) fitting.push(pool[i]);
    var chosen = fitting.length > 0 ? pickWeighted(fitting, m) : DOT;
    return makePiece(chosen, 1 + Math.floor(Math.random() * COLOR_COUNT));
  }

  function dealTray(b, m) {
    var out = [];
    for (var i = 0; i < TRAY_SIZE; i++) out.push(pickFittingPiece(b, m));
    return out;
  }

  /* engine.ts:168-181 — the recon omitted this and it is the difference between easy
   * being kind and easy being a dead end. Little Hands only. */
  function rescueUnplaceable(b, t, m) {
    if (m !== 'easy') return t;
    var out = [];
    for (var i = 0; i < t.length; i++) {
      var p = t[i];
      if (!p) { out.push(p); continue; }
      if (canPlaceAnywhere(b, p.cells)) { out.push(p); continue; }
      if (!canPlaceAnywhere(b, DOT.cells)) { out.push(p); continue; }
      out.push(pickFittingPiece(b, m));
    }
    return out;
  }

  function anyTrayFits(b, t) {
    for (var i = 0; i < t.length; i++) if (t[i] && canPlaceAnywhere(b, t[i].cells)) return true;
    return false;
  }

  function trayEmpty(t) {
    for (var i = 0; i < t.length; i++) if (t[i]) return false;
    return true;
  }

  /* --- game state ------------------------------------------------------- */

  var board = emptyBoard(N);
  var tray = [null, null, null];
  var score = 0;
  var combo = 0;
  var over = false;
  var selected = null;
  var drag = null;

  /* THE DYING SET HAS EXACTLY ONE OWNER AND ONE CANCELLATION PATH. See beginClear. */
  var clearingCells = null;
  var clearTimer = 0;

  var dead = false;
  var listeners = [];
  var captured = [];
  var ro = null;
  var cellPx = 0;
  var boardSide = 0;

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  }

  /* --- persistence ------------------------------------------------------ */

  function validCell(v) {
    return typeof v === 'number' && isFinite(v) && (v | 0) === v && v >= 0 && v <= COLOR_COUNT;
  }

  /* A COUNTER IS NOT A COLOUR ID. validCell is bounded by COLOR_COUNT because it
   * validates a board cell; the first version of loadSaved reused it for `score` and
   * `combo`, so every resumed score above 7 was silently zeroed — and a single line
   * clear scores 11, which means effectively every real session lost its score on
   * resume. The board and tray restored correctly, so it read as a working save. */
  function validCount(v) {
    return typeof v === 'number' && isFinite(v) && (v | 0) === v && v >= 0 && v <= 1e9;
  }

  function validPiece(p) {
    if (!p || typeof p !== 'object') return null;
    if (!Array.isArray(p.cells) || p.cells.length === 0 || p.cells.length > 9) return null;
    var cells = [];
    for (var i = 0; i < p.cells.length; i++) {
      var pair = p.cells[i];
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      if (!validCell(pair[0]) || !validCell(pair[1])) return null;
      if (pair[0] > 4 || pair[1] > 4) return null;
      cells.push([pair[0], pair[1]]);
    }
    if (!validCell(p.color) || p.color < 1) return null;
    var maxR = 0, maxC = 0;
    for (var j = 0; j < cells.length; j++) {
      if (cells[j][0] > maxR) maxR = cells[j][0];
      if (cells[j][1] > maxC) maxC = cells[j][1];
    }
    return { name: typeof p.name === 'string' ? p.name : 'saved',
      cells: cells, w: maxC + 1, h: maxR + 1, color: p.color };
  }

  /* api.load() may return null, {}, or a board of the wrong size, and the toy must come
   * up playable in every one of those cases. Anything that does not validate is
   * discarded whole rather than repaired in part — a half-trusted board is worse than a
   * fresh one, and a fresh one costs the child nothing he can perceive. */
  function loadSaved() {
    var raw = null;
    try { raw = api.load(); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return null;
    var b = raw.board;
    if (!Array.isArray(b) || b.length !== N) return null;
    var out = [];
    for (var r = 0; r < N; r++) {
      if (!Array.isArray(b[r]) || b[r].length !== N) return null;
      var row = [];
      for (var c = 0; c < N; c++) {
        if (!validCell(b[r][c])) return null;
        row.push(b[r][c]);
      }
      out.push(row);
    }
    if (!Array.isArray(raw.tray) || raw.tray.length !== TRAY_SIZE) return null;
    var t = [];
    for (var i = 0; i < TRAY_SIZE; i++) {
      if (raw.tray[i] === null) { t.push(null); continue; }
      var p = validPiece(raw.tray[i]);
      if (!p) return null;
      t.push(p);
    }
    return {
      board: out, tray: t,
      score: validCount(raw.score) ? raw.score : 0,
      combo: validCount(raw.combo) ? raw.combo : 0
    };
  }

  function persist(force) {
    if (dead && !force) return;
    var t = [];
    for (var i = 0; i < tray.length; i++) {
      var p = tray[i];
      t.push(p ? { name: p.name, cells: p.cells, color: p.color } : null);
    }
    /* A finished game is not resumable — saving it would bring the child back to a
     * board he cannot move on. Saving null board state means the next mount deals fresh. */
    try { api.save(over ? { v: 1 } : { v: 1, board: board, tray: t, score: score, combo: combo }); }
    catch (e) {}
  }

  /* --- DOM -------------------------------------------------------------- */

  var style = document.createElement('style');
  /* THE STYLE ELEMENT LIVES INSIDE `host`, AND THE SAFETY ARGUMENT IS NOT "BECAUSE IT IS
   * INSIDE host". A connected <style> applies to the WHOLE DOCUMENT wherever it sits;
   * putting it in `host` scopes its LIFETIME, not its selectors — it dies when
   * endGameSession removes chrome, which is the property §8.1 requires.
   *
   * It is safe because EVERY RULE IS CLASS-SCOPED under the `bp-` prefix and none of
   * those names collide with PupPad's own. The source's `@layer base` (styles.css:29-60)
   * is deliberately NOT ported: its selectors are `html`, `body`, `h1`, `h2`, `h3`,
   * `button`, `[role="button"]` and `#app` — and PupPad has a live `#app` that render()
   * owns. Porting it would repaint the console.
   *
   * document.head is off the table: endGameSession's leak sweep walks only
   * document.body.children (index.html:2743-2744), so a head <style> would survive
   * teardown UNREPORTED — a silent §8.1 violation that no check would see. */
  style.textContent = [
    '.bp-root{position:absolute;inset:0;display:flex;flex-direction:row;align-items:center;',
    'gap:10px;padding:8px;box-sizing:border-box;',
    /* THE LEFT INSET IS THE EXIT'S COLUMN, NOT PADDING. #gameBack is position:fixed at
     * x 10-74, 64px square, forever. Copied from the control panel's own gutter rather
     * than written as a bare 84: landscape phones put punch-holes and curved edges into
     * the SIDE insets, which a tablet does not, and env() is the only thing that knows. */
    'padding-left:max(84px,calc(env(safe-area-inset-left) + 74px));',
    'padding-right:max(8px,env(safe-area-inset-right));',
    '-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none;',
    '-webkit-user-select:none}',

    '.bp-boardwrap{position:relative;flex:0 0 auto;border-radius:22px;padding:6px;',
    'box-sizing:border-box;background:#f0dfc0;',
    'box-shadow:inset 0 1px 0 rgb(255 255 255 / .35),0 10px 24px rgb(80 50 20 / .16),',
    '0 2px 0 rgb(140 110 70 / .35)}',

    '.bp-grid{display:grid;width:100%;height:100%;gap:3px}',

    '.bp-well{position:relative;padding:0;margin:0;border:0;appearance:none;',
    '-webkit-appearance:none;background:#e3cfa8;border-radius:22%;',
    'box-shadow:inset 0 1px 2px rgb(70 45 12 / .2);overflow:hidden;touch-action:none}',

    '.bp-candy{position:absolute;inset:7%;display:block;border-radius:22%;',
    'background:linear-gradient(165deg,var(--bp-l) 0%,var(--bp-b) 46%,var(--bp-d) 100%);',
    'box-shadow:inset 0 2px 0 rgb(255 255 255 / .42),inset 0 -3px 3px rgb(0 0 0 / .14),',
    '0 2px 0 var(--bp-d)}',
    '.bp-candy::after{content:"";position:absolute;left:16%;top:12%;width:38%;height:22%;',
    'border-radius:999px;background:rgb(255 255 255 / .32);pointer-events:none}',
    '.bp-candy[hidden]{display:none}',

    '.bp-pop{animation:bp-pop ' + POP_MS + 'ms cubic-bezier(.34,1.36,.64,1) both}',
    '.bp-clear{animation:bp-clear ' + CLEAR_MS + 'ms ease-in forwards}',
    '@keyframes bp-pop{from{transform:scale(.6);opacity:.4}to{transform:scale(1);opacity:1}}',
    '@keyframes bp-clear{to{transform:scale(.15);opacity:0}}',

    '.bp-ghost{position:absolute;inset:8%;border-radius:22%;pointer-events:none}',
    '.bp-ghost-ok{background:rgb(90 190 130 / .38);box-shadow:inset 0 0 0 2px rgb(150 230 180 / .7)}',
    '.bp-ghost-no{background:rgb(210 90 90 / .34);box-shadow:inset 0 0 0 2px rgb(240 160 160 / .65)}',

    '.bp-tray{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;',
    'gap:8px;min-width:0;height:100%;box-sizing:border-box}',

    '.bp-slot{position:relative;flex:1 1 0;min-height:0;display:flex;align-items:center;',
    'justify-content:center;padding:0;margin:0;border:1px solid rgb(255 255 255 / .10);',
    'appearance:none;-webkit-appearance:none;border-radius:20px;',
    'background:rgb(255 255 255 / .06);touch-action:none;',
    'transition:background-color 150ms ease-out,box-shadow 150ms ease-out}',
    '.bp-slot[data-empty="1"]{opacity:.35}',
    '.bp-slot[data-active="1"]{background:rgb(125 211 252 / .18);',
    'box-shadow:0 0 0 3px rgb(125 211 252 / .45)}',
    '.bp-slot[data-lifted="1"] .bp-piece{opacity:.25}',

    '.bp-piece{display:grid;pointer-events:none}',
    '.bp-piececell{position:relative;border-radius:22%;',
    'background:linear-gradient(165deg,var(--bp-l) 0%,var(--bp-b) 46%,var(--bp-d) 100%);',
    'box-shadow:inset 0 2px 0 rgb(255 255 255 / .42),0 2px 0 var(--bp-d)}',

    '.bp-drag{position:absolute;left:0;top:0;pointer-events:none;z-index:5;',
    'will-change:transform;filter:drop-shadow(0 6px 10px rgb(0 0 0 / .35))}',

    /* THE TERMINAL STATE'S ONE WAY BACK. §8.5 and invariant 5: a single affordance
     * INSIDE host that resumes play. It does NOT call api.close() — the shell's own exit
     * is the way out of the game; this is the way out of the STATE. No text: one glyph. */
    '.bp-over{position:absolute;inset:0;display:flex;align-items:center;',
    'justify-content:center;background:rgb(15 29 58 / .74);z-index:10;touch-action:none}',
    '.bp-again{width:132px;height:132px;border-radius:50%;border:0;appearance:none;',
    '-webkit-appearance:none;font-size:62px;line-height:1;color:#0F1D3A;',
    'background:radial-gradient(circle at 34% 30%,#ffe08a,#f0a93c 70%,#d98a1f 100%);',
    'box-shadow:0 8px 22px rgb(0 0 0 / .4),inset 0 3px 0 rgb(255 255 255 / .5);',
    'touch-action:none;-webkit-tap-highlight-color:transparent}'
  ].join('');
  host.appendChild(style);

  var root = document.createElement('div');
  root.className = 'bp-root';

  var boardWrap = document.createElement('div');
  boardWrap.className = 'bp-boardwrap';

  var grid = document.createElement('div');
  grid.className = 'bp-grid';
  grid.setAttribute('data-grid', '');
  grid.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
  grid.style.gridTemplateRows = 'repeat(' + N + ',1fr)';
  boardWrap.appendChild(grid);

  var trayEl = document.createElement('div');
  trayEl.className = 'bp-tray';

  root.appendChild(boardWrap);
  root.appendChild(trayEl);
  host.appendChild(root);

  var dragEl = document.createElement('div');
  dragEl.className = 'bp-drag';
  dragEl.hidden = true;
  root.appendChild(dragEl);

  /* Cells, built once and PATCHED thereafter. Rebuilding the grid per update is the
   * defect §0 names: `popping={!!color && !dying}` is permanently true for every filled
   * cell in the source, and only looks right because React's keyed reconciler preserves
   * the node. Rebuild here and all 36 candies re-pop at pointer rate. */
  var cells = [];
  for (var ci = 0; ci < N * N; ci++) {
    var well = document.createElement('button');
    well.className = 'bp-well';
    well.type = 'button';
    well.setAttribute('data-cell', '');
    well.setAttribute('data-row', String(Math.floor(ci / N)));
    well.setAttribute('data-col', String(ci % N));
    var candy = document.createElement('span');
    candy.className = 'bp-candy';
    candy.hidden = true;
    well.appendChild(candy);
    var ghost = document.createElement('span');
    ghost.className = 'bp-ghost';
    ghost.hidden = true;
    well.appendChild(ghost);
    grid.appendChild(well);
    cells.push({ well: well, candy: candy, ghost: ghost, shown: 0, dying: false, ghostState: '' });
  }

  var slots = [];
  for (var si = 0; si < TRAY_SIZE; si++) {
    var slot = document.createElement('button');
    slot.className = 'bp-slot';
    slot.type = 'button';
    slot.setAttribute('data-slot', String(si));
    slot.setAttribute('data-empty', '1');
    var pieceBox = document.createElement('div');
    pieceBox.className = 'bp-piece';
    slot.appendChild(pieceBox);
    trayEl.appendChild(slot);
    slots.push({ slot: slot, box: pieceBox, sig: null });
  }

  var overlay = null;

  function paintCandyVars(el, color) {
    var ramp = CANDY[(color - 1) % CANDY.length];
    el.style.setProperty('--bp-b', ramp.base);
    el.style.setProperty('--bp-l', ramp.light);
    el.style.setProperty('--bp-d', ramp.dark);
  }

  /* --- layout ----------------------------------------------------------- */

  /* THE BOARD'S SIDE IS THE AVAILABLE HEIGHT; THE TRAY TAKES THE WIDTH THAT IS LEFT.
   * Driven off a MEASURED RECT, never a viewport unit — the source's
   * `max-w-[min(100%,72dvh)]` is exactly the number-that-happened-to-fit this rule
   * exists to avoid: at 412px of height that cap is 296.6px and it silently wins.
   * `cellPx` is the GRID's width / N. The source's boardCellSize (BlockPopGame.tsx:591)
   * is rect.width / n over the board frame; here the frame carries 6px of padding on
   * each side, so the grid is `side - 12` and cellPx is (side - 12) / N — 64.0px at
   * side 396, not the 396/6 = 66.0 the work order's table quotes. It stays the single
   * source of truth for the ghost's size and the grab offset. */
  function relayout() {
    if (dead) return;
    var hr = host.getBoundingClientRect();
    if (!hr.width || !hr.height) return;
    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { cs = null; }
    var padL = cs ? parseFloat(cs.paddingLeft) || 0 : 84;
    var padR = cs ? parseFloat(cs.paddingRight) || 0 : 8;
    var padY = cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 16;
    var availH = Math.max(0, hr.height - padY);
    /* The tray must keep a usable column even on the narrowest phone; only then does
     * width get a vote. On all three fleet devices height binds and this term is slack. */
    var availW = Math.max(0, hr.width - padL - padR - 10 - 150);
    var side = Math.floor(Math.min(availH, availW));
    if (side < 0) side = 0;
    boardSide = side;
    boardWrap.style.width = side + 'px';
    boardWrap.style.height = side + 'px';
    var inner = Math.max(0, side - 12);
    cellPx = inner / N;
    renderTray(true);
  }

  /* --- rendering: a transition classifier, not a rebuild ----------------- */

  /* Classify every cell against the painted state, then restart animations in ONE
   * batch: remove every class first, force a SINGLE reflow, then add. One reflow per
   * update, not one per cell — and a cell whose state did not change is never touched,
   * which is what stops the whole board re-popping at pointer rate. */
  function render() {
    if (dead) return;
    var dyingMap = Object.create(null);
    if (clearingCells) {
      for (var k = 0; k < clearingCells.length; k++) {
        dyingMap[clearingCells[k].r + ',' + clearingCells[k].c] = clearingCells[k].color;
      }
    }
    var toPop = [];
    var toClear = [];
    for (var i = 0; i < cells.length; i++) {
      var r = Math.floor(i / N);
      var c = i % N;
      var st = cells[i];
      var live = board[r][c];
      var dyingColor = dyingMap[r + ',' + c] || 0;
      var show = dyingColor || live;
      var isDying = !!dyingColor;

      if (show === 0) {
        if (st.shown !== 0) {
          st.candy.hidden = true;
          st.candy.classList.remove('bp-pop', 'bp-clear');
          st.shown = 0;
          st.dying = false;
        }
        continue;
      }
      if (st.shown !== show || st.dying !== isDying) {
        if (st.shown !== show) paintCandyVars(st.candy, show);
        st.candy.hidden = false;
        if (isDying) toClear.push(st.candy);
        else if (st.shown === 0) toPop.push(st.candy);
        else st.candy.classList.remove('bp-clear');
        st.shown = show;
        st.dying = isDying;
      }
    }
    if (toPop.length || toClear.length) {
      var m;
      for (m = 0; m < toPop.length; m++) toPop[m].classList.remove('bp-pop', 'bp-clear');
      for (m = 0; m < toClear.length; m++) toClear[m].classList.remove('bp-pop', 'bp-clear');
      void grid.offsetWidth;
      for (m = 0; m < toPop.length; m++) toPop[m].classList.add('bp-pop');
      for (m = 0; m < toClear.length; m++) toClear[m].classList.add('bp-clear');
    }
    renderGhost();
  }

  function renderGhost() {
    var want = Object.create(null);
    if (drag && drag.hover) {
      var p = drag.piece;
      for (var i = 0; i < p.cells.length; i++) {
        var r = drag.hover.row + p.cells[i][0];
        var c = drag.hover.col + p.cells[i][1];
        if (r >= 0 && c >= 0 && r < N && c < N) want[r * N + c] = drag.hover.valid ? 'ok' : 'no';
      }
    }
    for (var j = 0; j < cells.length; j++) {
      var st = cells[j];
      var next = want[j] || '';
      if (next && st.shown !== 0) next = '';
      if (next === st.ghostState) continue;
      st.ghostState = next;
      if (!next) {
        st.ghost.hidden = true;
        st.ghost.className = 'bp-ghost';
      } else {
        st.ghost.hidden = false;
        st.ghost.className = 'bp-ghost ' + (next === 'ok' ? 'bp-ghost-ok' : 'bp-ghost-no');
      }
    }
  }

  function pieceSignature(p) {
    if (!p) return null;
    var out = p.color + '|' + p.w + 'x' + p.h;
    for (var i = 0; i < p.cells.length; i++) out += '|' + p.cells[i][0] + ',' + p.cells[i][1];
    return out;
  }

  function fillPieceBox(box, piece, cell, gap) {
    while (box.firstChild) box.removeChild(box.firstChild);
    box.style.gridTemplateColumns = 'repeat(' + piece.w + ',' + cell + 'px)';
    box.style.gridTemplateRows = 'repeat(' + piece.h + ',' + cell + 'px)';
    box.style.gap = gap + 'px';
    box.style.width = (piece.w * cell + (piece.w - 1) * gap) + 'px';
    box.style.height = (piece.h * cell + (piece.h - 1) * gap) + 'px';
    var filled = Object.create(null);
    for (var i = 0; i < piece.cells.length; i++) filled[piece.cells[i][0] + ',' + piece.cells[i][1]] = true;
    for (var n = 0; n < piece.w * piece.h; n++) {
      var r = Math.floor(n / piece.w);
      var c = n % piece.w;
      var sp = document.createElement('span');
      if (filled[r + ',' + c]) {
        sp.className = 'bp-piececell';
        paintCandyVars(sp, piece.color);
      }
      box.appendChild(sp);
    }
  }

  function renderTray(force) {
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var p = tray[i];
      var sig = pieceSignature(p);
      s.slot.setAttribute('data-empty', p ? '0' : '1');
      s.slot.setAttribute('data-active', selected === i ? '1' : '0');
      s.slot.setAttribute('data-lifted', drag && drag.index === i ? '1' : '0');
      if (!force && sig === s.sig) continue;
      s.sig = sig;
      if (!p) {
        while (s.box.firstChild) s.box.removeChild(s.box.firstChild);
        s.box.style.width = '0px';
        s.box.style.height = '0px';
        continue;
      }
      var rect = s.slot.getBoundingClientRect();
      var span = Math.max(p.w, p.h, 3);
      var room = Math.min(rect.width || 120, rect.height || 120) - 16;
      var cell = Math.max(8, Math.floor((room > 0 ? room : 88) / span));
      fillPieceBox(s.box, p, cell, 3);
    }
  }

  /* --- the clear window: ONE OWNER, ONE CANCELLATION PATH ---------------- */

  /* THE SOURCE STRANDS THIS FOREVER AND THE STRANDED STATE IS UNLEAVEABLE.
   * BlockPopGame.tsx:118-135: the effect sets `clearing`, arms a 280ms timeout, and
   * returns a cleanup that CANCELS the timeout. When the next burst has no cells the
   * effect re-runs, the cleanup fires, and the `cells.length === 0` branch never nulls
   * the state. `.candy-clear` is `forwards` to opacity:0, so those cells render
   * PERMANENTLY INVISIBLE over a board that still holds candies — a state the toy can
   * enter and cannot leave.
   *
   * The fix is not a longer timeout. It is that beginClear is the ONLY writer of
   * clearingCells and it cancels before it decides, so an empty burst CLEARS the state
   * instead of leaving the previous one armed and orphaned. */
  function cancelClear() {
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = 0; }
    clearingCells = null;
  }

  function beginClear(cellsToClear) {
    cancelClear();
    if (!cellsToClear || !cellsToClear.length) return;
    clearingCells = cellsToClear;
    clearTimer = setTimeout(function () {
      clearTimer = 0;
      clearingCells = null;
      render();
    }, CLEAR_MS);
  }

  /* --- play ------------------------------------------------------------- */

  function place(index, row, col) {
    if (dead || over) return false;
    var piece = tray[index];
    if (!piece) return false;
    if (!canPlace(board, piece.cells, row, col)) return false;

    var placed = applyPiece(board, piece, row, col);
    var cleared = clearFullLines(placed);
    var lines = cleared.rows.length + cleared.cols.length;
    combo = lines > 0 ? combo + 1 : 0;
    score += scorePlacement(piece.cells.length, lines, combo);
    board = cleared.board;

    var t = [];
    for (var i = 0; i < tray.length; i++) t.push(i === index ? null : tray[i]);
    if (trayEmpty(t)) t = dealTray(board, mode);
    else t = rescueUnplaceable(board, t, mode);
    tray = t;

    selected = null;
    beginClear(cleared.cells);
    over = !anyTrayFits(board, tray);

    render();
    renderTray(true);
    persist();
    if (over) showOver();
    return true;
  }

  function restart() {
    cancelClear();
    board = emptyBoard(N);
    tray = dealTray(board, mode);
    score = 0;
    combo = 0;
    over = false;
    selected = null;
    drag = null;
    dragEl.hidden = true;
    hideOver();
    render();
    renderTray(true);
    persist();
  }

  function showOver() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'bp-over';
    var again = document.createElement('button');
    again.className = 'bp-again';
    again.type = 'button';
    again.id = 'bpAgain';
    /* A glyph, not a word. Invariant 1: every control operable by a non-reader. */
    again.textContent = '🔄';
    again.setAttribute('aria-label', 'Play again');
    overlay.appendChild(again);
    root.appendChild(overlay);
    var fired = false;
    function go(ev) {
      if (ev && ev.cancelable) ev.preventDefault();
      if (fired) return;
      fired = true;
      restart();
    }
    /* Bound on the overlay's own element and removed with it. `touchend` first so a
     * finger never waits on the synthesised click; `click` remains for a mouse. */
    again.addEventListener('touchend', go);
    again.addEventListener('click', go);
  }

  function hideOver() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  /* --- pointer ---------------------------------------------------------- */

  function gridRect() { return grid.getBoundingClientRect(); }

  function grabCell(rect, piece, x, y) {
    var cw = rect.width / piece.w;
    var ch = rect.height / piece.h;
    var c = Math.floor((x - rect.left) / cw);
    var r = Math.floor((y - rect.top) / ch);
    c = Math.max(0, Math.min(piece.w - 1, c));
    r = Math.max(0, Math.min(piece.h - 1, r));
    var i;
    for (i = 0; i < piece.cells.length; i++) {
      if (piece.cells[i][0] === r && piece.cells[i][1] === c) return { r: r, c: c };
    }
    var best = piece.cells[0];
    var bestD = 99;
    for (i = 0; i < piece.cells.length; i++) {
      var d = Math.abs(piece.cells[i][0] - r) + Math.abs(piece.cells[i][1] - c);
      if (d < bestD) { bestD = d; best = piece.cells[i]; }
    }
    return { r: best[0], c: best[1] };
  }

  function hitCell(x, y, d) {
    var rect = gridRect();
    var pad = 10;
    if (x < rect.left - pad || x > rect.right + pad || y < rect.top - pad || y > rect.bottom + pad) return null;
    var col = Math.floor(((x - rect.left) / rect.width) * N) - d.grabC;
    var row = Math.floor(((y - rect.top) / rect.height) * N) - d.grabR;
    return { row: row, col: col, valid: canPlace(board, d.piece.cells, row, col) };
  }

  function moveDragEl(x, y) {
    var rr = root.getBoundingClientRect();
    var w = drag.piece.w * cellPx;
    var h = drag.piece.h * cellPx;
    var ox = x - rr.left - (drag.grabC + 0.5) * cellPx;
    var oy = y - rr.top - (drag.grabR + 0.5) * cellPx - cellPx * 0.9;
    dragEl.style.width = w + 'px';
    dragEl.style.height = h + 'px';
    dragEl.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';
  }

  function releaseCaptures(pid) {
    for (var i = captured.length - 1; i >= 0; i--) {
      if (pid === undefined || captured[i][1] === pid) {
        try { captured[i][0].releasePointerCapture(captured[i][1]); } catch (e) {}
        captured.splice(i, 1);
      }
    }
  }

  function onSlotDown(index, ev) {
    if (dead || over) return;
    var piece = tray[index];
    if (!piece) return;
    if (ev.cancelable) ev.preventDefault();
    /* A SECOND FINGER ON ANOTHER SLOT REPLACES `drag`, so the first drag's pointer
     * capture had no owner left to release it and it accumulated until teardown — one
     * per two-finger gesture. Release the outgoing drag's captures, and repaint the
     * ghost, before the new drag overwrites it. */
    if (drag) releaseCaptures(drag.pointerId);
    var pid = ev.pointerId;
    var target = ev.currentTarget;
    if (target && target.setPointerCapture && pid !== undefined) {
      try { target.setPointerCapture(pid); captured.push([target, pid]); } catch (e) {}
    }
    /* MEASURE THE PIECE, NOT THE SLOT. grabCell divides the rect it is handed into
     * piece.w columns. The source hands it the slot because the source's slot is a
     * near-square 112px cell of a 3-column grid, so the piece very nearly fills it. This
     * port's slot is a WIDE LANDSCAPE PANEL (~417 x 127) and a 3-wide piece box is only
     * ~114px of it, sitting entirely inside column 1 — so every grab on a tri-h returned
     * grabC 1 whatever the child aimed at, and the piece jumped a full cell on pickup.
     * Measured at 12.5% of easy-mode deals by weight (tri-h 6 + quad-h 2 of 64). The
     * piece box is the thing the child is actually looking at. */
    var pbox = target.querySelector('.bp-piece');
    var rect = (pbox || target).getBoundingClientRect();
    if (!rect.width || !rect.height) rect = target.getBoundingClientRect();
    var g = grabCell(rect, piece, ev.clientX, ev.clientY);
    drag = {
      index: index, piece: piece, grabR: g.r, grabC: g.c,
      startX: ev.clientX, startY: ev.clientY, hover: null, pointerId: pid
    };
    fillPieceBox(dragEl, piece, Math.max(8, Math.floor(cellPx) - 3), 3);
    dragEl.hidden = false;
    moveDragEl(ev.clientX, ev.clientY);
    renderGhost();
    renderTray(false);
  }

  function onMove(ev) {
    if (!drag || dead) return;
    if (drag.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== drag.pointerId) return;
    if (ev.cancelable) ev.preventDefault();
    moveDragEl(ev.clientX, ev.clientY);
    drag.hover = hitCell(ev.clientX, ev.clientY, drag);
    renderGhost();
  }

  function onUp(ev) {
    if (!drag || dead) return;
    if (drag.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== drag.pointerId) return;
    var d = drag;
    drag = null;
    dragEl.hidden = true;
    releaseCaptures(d.pointerId);
    var x = ev.clientX;
    var y = ev.clientY;
    var dist = Math.hypot(x - d.startX, y - d.startY);
    var hover = hitCell(x, y, d);
    if (hover && hover.valid && place(d.index, hover.row, hover.col)) {
      /* No sound here. Audio is PUP-WO-0402's (§4), and the shell owns the only
       * AudioContext (§8.3) — a call to api.sound with a name outside doSound's twelve
       * banks is a silent no-op that reads like a feature. */
    } else if (dist < TAP_SLOP) {
      /* A TAP, NOT A FAILED DRAG. See TAP_SLOP. */
      selected = selected === d.index ? null : d.index;
    }
    renderGhost();
    renderTray(false);
  }

  function onCellDown(row, col, ev) {
    if (dead || over || drag) return;
    if (selected === null) return;
    var piece = tray[selected];
    if (!piece) return;
    if (ev.cancelable) ev.preventDefault();
    if (canPlace(board, piece.cells, row, col)) place(selected, row, col);
  }

  for (var wi = 0; wi < cells.length; wi++) {
    (function (idx) {
      on(cells[idx].well, 'pointerdown', function (ev) {
        onCellDown(Math.floor(idx / N), idx % N, ev);
      });
    })(wi);
  }
  for (var qi = 0; qi < slots.length; qi++) {
    (function (idx) {
      on(slots[idx].slot, 'pointerdown', function (ev) { onSlotDown(idx, ev); });
    })(qi);
  }
  on(window, 'pointermove', onMove, { passive: false });
  on(window, 'pointerup', onUp);
  on(window, 'pointercancel', onUp);

  /* --- boot ------------------------------------------------------------- */

  var saved = loadSaved();
  if (saved) {
    board = saved.board;
    tray = saved.tray;
    score = saved.score;
    combo = saved.combo;
    if (trayEmpty(tray)) tray = dealTray(board, mode);
    over = !anyTrayFits(board, tray);
  } else {
    tray = dealTray(board, mode);
  }

  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(function () { relayout(); render(); });
    ro.observe(host);
  }
  relayout();
  render();
  renderTray(true);
  if (over) showOver();

  /* THE SEAM. Published with NO `controls`, so mountControlPanel returns null at
   * index.html:2230 and no panel mounts at all — which is what gives the board its full
   * 412px of height. `controlsOpen:false` is inert in today's shell (PUP-WO-0111 owns
   * the change that makes it mean anything) and is published now so that landing 0111
   * needs no edit here. The four assists arrive in PUP-WO-0401 as `action` descriptors. */
  var seam = Object.freeze({
    controlsOpen: false,
    get: function () {
      return { score: score, combo: combo, over: over, mode: mode, size: N };
    },
    set: function () { return false; }
  });
  try { host[entry.id] = seam; } catch (e) {}

  /* --- teardown --------------------------------------------------------- *
   * The order is games/gyre.js:1319-1333's, for its stated reasons: the dead flag
   * first so nothing re-enters, then every acquired resource in the order it was
   * acquired, then the save, then the seam, then the DOM. */
  function release() {
    dead = true;
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = 0; }
    clearingCells = null;
    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]); } catch (e) {}
    }
    listeners.length = 0;
    releaseCaptures(undefined);
    drag = null;
    /* FORCED, because `dead` is already true by design and persist() guards on it —
     * the first version of this teardown called persist() four lines after setting the
     * flag that makes it a no-op, while the comment above listed "then the save" as a
     * step that ran. Harmless in effect (every mutation already persists at the call
     * sites) but the comment asserted coverage that did not exist. */
    persist(true);
    try { delete host[entry.id]; } catch (e) { host[entry.id] = undefined; }
    if (style.parentNode) style.parentNode.removeChild(style);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return release;
}
