#!/usr/bin/env node
/**
 * CHECK 11 — a game module cannot reach the network.
 *
 * WHY THIS EXISTS, AND WHY IT IS THE FIRST THING PUP-WO-0200 BUILDS.
 *
 * `docs/findings/PUP-WO-0000.md` §8.3 says, as a correction its own adversarial pass
 * forced (finding F8), that omitting `fetch` from the `api` object is A CONVENTION AND
 * NOT ENFORCEMENT, and that what enforces it is a CI check that can go red:
 *
 *     "PUP-WO-0100 greps games/*.js for fetch(, XMLHttpRequest, import(, EventSource
 *      and new WebSocket and fails the build. Invariant 3 and architecture §5's
 *      'strictly offline' rest on that check, not on the shape of this object."
 *
 * IT WAS NEVER BUILT. Nothing under .github/ci/ grepped games/ for any of those
 * tokens. Nobody noticed because `games/` did not exist — so the check would have
 * scanned nothing, and the absence of a check that scans nothing is invisible. That is
 * a false green arriving BEFORE there is anything to be green about, and it becomes
 * load-bearing the moment PUP-WO-0200 creates the directory.
 *
 * A check written after the code it guards is a check shaped by the code it guards, so
 * this one was written and demonstrated RED against a throwaway module carrying each
 * forbidden token — each removed ONE AT A TIME, so it is shown to detect EACH rather
 * than ANY (architecture §6.1: a detector is proven by removing a sole detector).
 *
 * FAIL CLOSED. A missing games/, an unreadable games/, a directory with no modules in
 * it, or a module that will not parse is a FAILURE and never a pass. "Scanned nothing,
 * found nothing, therefore green" is the exact shape this check exists to refuse.
 */
import vm from 'node:vm';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.argv[2] || process.cwd();
const GAMES_DIR = join(REPO, 'games');

const failures = [];
const notes = [];
const bad = (m, detail) => { failures.push({ m, detail }); console.log(`  FAIL  ${m}`); if (detail) console.log(`        ${detail}`); };
const ok = (m) => console.log(`  ok    ${m}`);

/* Anything thrown here is a check that did not reach a verdict, and the exit-code
 * convention PUP-WO-0103 established distinguishes that from a real finding:
 *   0 the property holds · 1 it is VIOLATED · 3 no verdict was reached. */
const noVerdict = (what, err) => {
  console.error(`::error::CHECK 11 COULD NOT REACH A VERDICT — ${what}`);
  console.error('::error::Nothing is established about games/ in either direction.');
  console.error('::error::REMEDY: fix the check. The failure follows.');
  if (err && (err.stack || String(err))) console.error(err.stack || String(err));
  else console.error(`  (no value carried: ${Object.prototype.toString.call(err)})`);
  process.exit(3);
};
process.on('uncaughtException', (e) => noVerdict('the check threw', e));
process.on('unhandledRejection', (e) => noVerdict('a promise rejected unhandled', e));

/* ------------------------------------------------------------------ *
 * The forbidden set.
 *
 * TIER 1 is the five tokens §8.3 names. They are the contract and they are quoted
 * from it rather than paraphrased, so a reader can diff this list against the
 * sentence that requires it.
 *
 * TIER 2 is MINE, and it is labelled as mine because §8.3 does not require it.
 * Tier 1 alone has two holes I could reach through in the time it took to write it:
 *   - the scan below removes string literals to avoid false reds, so a module could
 *     hide `fetch(` in a string and hand it to eval. Forbidding the things that
 *     execute strings closes what removing strings opens.
 *   - a STATIC import of a remote specifier — `import x from 'https://…'` — reaches
 *     the network and contains none of the five tokens. §8.3 names `import(` only.
 * Neither tier can catch a determined bypass through computed property access, and
 * this file says so in its own verdict rather than implying coverage it lacks.
 * ------------------------------------------------------------------ */
const TIER1 = [
  { token: 'fetch(',         why: 'network request' },
  { token: 'XMLHttpRequest', why: 'network request' },
  { token: 'import(',        why: 'dynamic import can name a remote specifier' },
  { token: 'EventSource',    why: 'server-sent events' },
  { token: 'new WebSocket',  why: 'websocket' },
];
const TIER2 = [
  { token: 'eval(',                why: 'executes a string the scanner has already removed' },
  { token: 'new Function(',        why: 'executes a string the scanner has already removed' },
  { token: 'importScripts(',       why: 'worker-scope script load' },
  { token: 'navigator.sendBeacon', why: 'network request that is not fetch()' },
  { token: 'window[',              why: 'computed global access can spell any of tier 1' },
  { token: 'globalThis[',          why: 'computed global access' },
  { token: 'self[',                why: 'computed global access' },
];

/* Remove comments and string bodies so a token inside either does not produce a false
 * red — but keep `${…}` substitutions, because those are CODE and hiding a call there
 * would otherwise be free. Positions are preserved (replaced char-for-char with
 * spaces) so every hit still reports a true line and column.
 *
 * KNOWN LIMIT, stated rather than implied: this is a scanner, not a parser. A regex
 * literal containing quote or comment characters can desynchronise it. Modules are
 * parsed for syntax separately, above; that parse is authoritative for "is this valid
 * JS", and this pass is authoritative only for "where do the forbidden tokens appear". */
function stripCommentsAndStrings(src) {
  const out = src.split('');
  const blank = (from, to) => { for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  const n = src.length;
  const tmplStack = [];
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = i; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; blank(i, Math.min(j + 2, n)); i = j + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') break; j++; }
      blank(i + 1, j); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') { blank(i + 1, j); tmplStack.push(true); i = j + 2; break; }
        j++;
      }
      if (tmplStack.length && i === j + 2) continue;
      blank(i + 1, j); i = j + 1; continue;
    }
    if (c === '}' && tmplStack.length) {
      tmplStack.pop();
      let j = i + 1;
      while (j < n && src[j] !== '`') { if (src[j] === '\\') j++; j++; }
      blank(i + 1, j); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

function scan(label, source, rel) {
  const stripped = stripCommentsAndStrings(source);
  const lines = stripped.split('\n');
  const rawLines = source.split('\n');
  const hits = [];
  for (const { token, why } of [...TIER1, ...TIER2]) {
    lines.forEach((line, idx) => {
      let at = line.indexOf(token);
      while (at !== -1) {
        hits.push({ token, why, line: idx + 1, col: at + 1, text: rawLines[idx].trim().slice(0, 90) });
        at = line.indexOf(token, at + 1);
      }
    });
  }
  /* A STATIC import whose specifier is not relative. Tier 1 names `import(` only, and
   * `import x from 'https://evil/'` contains none of the five tokens. */
  lines.forEach((line, idx) => {
    const m = /(?:^|[^.\w])import\s+(?:[\s\S]*?\sfrom\s+)?['"`]?/.exec(line);
    if (!m) return;
    const spec = /from\s+["'`]([^"'`]*)["'`]|^\s*import\s+["'`]([^"'`]*)["'`]/.exec(rawLines[idx]);
    const s = spec && (spec[1] ?? spec[2]);
    if (s && !s.startsWith('./') && !s.startsWith('../')) {
      hits.push({ token: `import … from '${s}'`, why: 'static import of a non-relative specifier can be remote', line: idx + 1, col: 1, text: rawLines[idx].trim().slice(0, 90) });
    }
  });
  if (hits.length) {
    for (const h of hits) bad(`${rel}:${h.line}:${h.col} — ${h.token}`, `${h.why}\n        ${h.text}`);
  } else {
    ok(`${rel} — none of the forbidden constructs`);
  }
  /* Report, WITHOUT failing, tokens that survive only inside a comment or a string.
   * They are not reachable on their own — tier 2 forbids the constructs that would
   * execute them — but a reviewer should see them rather than have them silently
   * dropped by the stripper. */
  for (const { token } of TIER1) {
    const inRaw = source.includes(token);
    const inCode = stripped.includes(token);
    if (inRaw && !inCode) notes.push(`${rel}: "${token}" appears only inside a comment or string literal — not a finding, but visible here so the stripper is not silently hiding it`);
  }
}

console.log('CHECK 11 — game modules cannot reach the network\n');

let entries;
try {
  const st = statSync(GAMES_DIR);
  if (!st.isDirectory()) { bad('games/ exists but is not a directory', GAMES_DIR); entries = []; }
  else entries = readdirSync(GAMES_DIR);
} catch (e) {
  /* FAIL CLOSED. A missing or unreadable games/ is the condition under which this
   * check would scan nothing and report success — the exact false green it exists to
   * prevent, and the reason nobody noticed it had never been built. */
  console.log(`  FAIL  games/ cannot be read at ${GAMES_DIR}`);
  console.log(`        ${e.code || e.message}`);
  console.error('::error::CHECK 11 FAILED — games/ cannot be read, so nothing was scanned.');
  console.error('::error::That is a FAILURE and not a pass: a check that scans nothing and');
  console.error('::error::reports success is the defect this check was built to close.');
  console.error('::error::REMEDY: restore games/, or delete this check deliberately and say so.');
  process.exit(1);
}

const modules = entries.filter((f) => f.endsWith('.js')).sort();
if (modules.length === 0) {
  console.log('  FAIL  games/ contains no .js modules');
  console.error('::error::CHECK 11 FAILED — games/ holds no modules, so nothing was scanned.');
  console.error('::error::Fail-closed by design: see the comment at the top of this file.');
  console.error('::error::REMEDY: if games/ is deliberately empty, this check must be changed');
  console.error('::error::deliberately and the change reviewed — not left to pass vacuously.');
  process.exit(1);
}
console.log(`  scanning ${modules.length} module(s) in games/\n`);

for (const f of modules) {
  const rel = `games/${f}`;
  let src;
  try { src = readFileSync(join(GAMES_DIR, f), 'utf8'); }
  catch (e) { bad(`${rel} — cannot be read`, e.code || e.message); continue; }
  /* PARSE FIRST, and fail closed if it will not parse.
   *
   * vm.SourceTextModule parses WITHOUT EXECUTING, which is the property that matters
   * when the file under test is untrusted by construction — importing it to find out
   * whether it parses would run the very code this check exists to police.
   *
   * `node --check` is not used, and the reason is narrower than I first wrote it.
   * Measured on Node 24:
   *     node --check x.js   containing `export default function f({`  -> exit 0
   *     node --check x.mjs  containing the same bytes                 -> exit 1
   * The hole is EXTENSION-DEPENDENT. games/*.js are .js files carrying module syntax,
   * which is exactly the case --check gets wrong. Check 1 does NOT have this hole: it
   * writes module sources to a .mjs temp file first, deliberately. I reported this as
   * reaching past this check before measuring the .mjs half; it does not. */
  try { new vm.SourceTextModule(src, { identifier: rel }); }
  catch (e) {
    bad(`${rel} — does not parse as an ES module`, `${e.constructor.name}: ${e.message}`);
    continue;
  }
  scan('module', src, rel);
}

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error(`\nCHECK 11 FAILED — ${failures.length} finding(s):\n`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.detail}`);
  console.error('\n  northstar invariant 3: every core surface works with no network.');
  console.error('  PUP-WO-0000 §8.3: invariant 3 and architecture §5\'s "strictly offline"');
  console.error('  rest on THIS CHECK, not on the shape of the api object.');
  console.error(`::error::CHECK 11 FAILED — ${failures.length} forbidden construct(s) in games/. See the FAIL lines above.`);
  process.exit(1);
}

console.log(`\nCHECK 11 PASSED — ${modules.length} module(s) scanned, none reaches the network.`);
console.log('  Detected: ' + TIER1.map((t) => t.token).join(', ') + ' (PUP-WO-0000 §8.3),');
console.log('  plus eval/Function/importScripts/sendBeacon/computed-global access and');
console.log('  static imports of non-relative specifiers (added here, not in §8.3).');
console.log('  WHAT THIS DOES NOT CATCH, stated rather than implied: a determined bypass');
console.log('  through computed property access that never spells a forbidden token —');
console.log('  e.g. building an identifier from fragments at runtime. No textual check');
console.log('  can. This raises the cost of reaching the network; it does not make it');
console.log('  impossible, and invariant 3 also rests on review of what games/ contains.');
