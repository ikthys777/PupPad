#!/usr/bin/env node
/**
 * CHECK 11 — a game module cannot reach the network.
 *
 * WHY THIS EXISTS. `docs/findings/PUP-WO-0000.md` §8.3 says, as a correction its own
 * adversarial pass forced (finding F8), that omitting `fetch` from the `api` object is
 * A CONVENTION AND NOT ENFORCEMENT, and that what enforces it is a CI check that can go
 * red — greping `games/*.js` for `fetch(`, `XMLHttpRequest`, `import(`, `EventSource`
 * and `new WebSocket`. **It was never built.** Nobody noticed because `games/` did not
 * exist, so it would have scanned nothing and reported success.
 *
 * ================= WHAT THIS CHECK IS, AFTER THE ADVERSARIAL PASS =================
 *
 * THE FIRST VERSION OF THIS FILE CLAIMED MORE THAN A TOKEN SCANNER CAN DELIVER, and a
 * reviewer proved it in a browser: **18 distinct ways to reach the network containing
 * none of the twelve tokens**, every one green and silent. `const f = fetch; f(url)`.
 * `new Image().src = 'https://…'`. `Reflect.get(globalThis, 'fet'+'ch')`. A `<link
 * rel=prefetch>`. An `<iframe>`. `location.assign`. A `<form>.submit()`. Half of them
 * need no computed property access at all — **an `<img>` tag is not an exotic bypass,
 * it is how you put a picture on a page.**
 *
 * So the claim is now bounded, and the boundary is stated in the verdict rather than
 * implied by silence:
 *
 *   THIS CHECK RAISES THE COST OF REACHING THE NETWORK. IT IS NOT A SANDBOX.
 *   A module that WANTS to reach the network can, and no textual check can stop it,
 *   because a game module runs in the shell's own realm with `window` in scope.
 *   What it does reliably catch is the HONEST MISTAKE and the OBVIOUS deliberate
 *   case, and it refuses constructs that cannot be analysed at all.
 *
 *   The structural answers are a Content-Security-Policy or running modules in an
 *   iframe/worker. Both are architecture decisions with real costs (the shell loads
 *   Leaflet and Supabase from CDNs today, so `default-src 'self'` would break the Map
 *   panel), and both are flagged to CC-A rather than smuggled in here.
 *
 * WHAT THE PASS FIXED, all reproduced before and after:
 *   - THE GRAPH WAS NOT FOLLOWED. `games/hello.js` importing `./sub/evil.js` scanned
 *     one file and passed while the subdirectory reached the network. The glob was
 *     flat and non-recursive, so a `.mjs` file or a subdirectory was invisible.
 *     Now: every module under `games/` at any depth, any of .js/.mjs/.cjs, IS scanned,
 *     and every relative import must resolve INSIDE `games/`.
 *   - THE TEMPLATE STRIPPER SWALLOWED CODE. A template with TWO `${}` substitutions
 *     hid the second one entirely — including tier-2 tokens, with no note. That is the
 *     ordinary shape of a two-slot HTML template.
 *   - STATIC IMPORT EVASIONS. `import{x}from'https://…'` (no space) and a specifier on
 *     the next line both passed. The detector now works on the whole source.
 *   - NOTES COVERED TIER 1 ONLY, so a token hidden by the stripper left no trace at
 *     all if it was a tier-2 token. The file claimed it was "not silently hiding it".
 *   - FALSE REDS. `retrieval(` matched `eval(`; `itself[0]` matched `self[`. Word
 *     boundaries now. And a purely local `import('./levels/2.js')` — the one construct
 *     a large offline game most wants — was refused outright; it is now allowed when
 *     the specifier is a literal that resolves inside `games/`.
 *
 * FAIL CLOSED. A missing `games/`, an unreadable one, a directory with no modules, or
 * a module that will not parse is a FAILURE and never a pass. "Scanned nothing, found
 * nothing, therefore green" is the shape that hid this check's own absence.
 */
import vm from 'node:vm';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = resolve(process.argv[2] || process.cwd());
const GAMES_DIR = join(REPO, 'games');

/* Architecture §5: a demonstration asserts the COMMIT it ran against. A green with no
 * subject is a claim about a tree nobody can identify. The pass found this rule was
 * obeyed by one of four new checks; it is obeyed by all of them now. */
let COMMIT = 'unknown';
try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}

const failures = [];
const notes = [];
const bad = (m, detail) => { failures.push({ m, detail }); console.log(`  FAIL  ${m}`); if (detail) console.log(`        ${detail}`); };
const ok = (m) => console.log(`  ok    ${m}`);

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

/* The flag is load-bearing and its absence used to be misreported as every module
 * failing to parse — a RED for the wrong reason, which is not evidence of anything
 * (PUP-WO-0103 finding B). Detect it once, up front, and call it what it is. */
if (typeof vm.SourceTextModule !== 'function') {
  noVerdict('vm.SourceTextModule is unavailable — run node with --experimental-vm-modules');
}

/* ---------------------------------------------------------------- *
 * The forbidden set. Each entry carries a REGEX with a word boundary, because
 * substring matching produced false reds on ordinary code: `retrieval(` contains
 * `eval(`, and `itself[0]` contains `self[`.
 * ---------------------------------------------------------------- */
const B = '(?<![A-Za-z0-9_$])';           // not preceded by an identifier character
const BD = '(?<![A-Za-z0-9_$.])';         // …and not a property access either

/* TIER 1 — the five §8.3 names. Quoted from the spec, not paraphrased. */
const TIER1 = [
  /* `fetch` as an IDENTIFIER, not `fetch(`. §8.3 names `fetch(`, and the pass showed
   * why that is not enough: `const f = fetch; f(url)` contains no `fetch(` at all and
   * reached the network. Matching the bare name costs a false red on a module that
   * names a local helper `fetch` — in a dog app that is plausible — and that trade is
   * worth taking, because the alias is one keystroke and the false red is loud. */
  { name: 'fetch',          re: new RegExp(B + 'fetch(?![A-Za-z0-9_$])'), why: 'network request, including `const f = fetch`' },
  { name: 'XMLHttpRequest', re: new RegExp(B + 'XMLHttpRequest'),          why: 'network request' },
  { name: 'EventSource',    re: new RegExp(B + 'EventSource'),             why: 'server-sent events' },
  { name: 'WebSocket',      re: new RegExp(B + 'WebSocket'),               why: 'websocket' },
];
/* TIER 2 — MINE, and labelled as mine: §8.3 does not require these. They are the
 * constructs that either execute a string the stripper has already removed, or reach a
 * global by a name the scanner cannot read. */
const TIER2 = [
  { name: 'eval(',           re: new RegExp(B + 'eval\\s*\\('),            why: 'executes a string the scanner cannot read' },
  { name: 'new Function(',   re: /new\s+Function\s*\(/,                    why: 'executes a string the scanner cannot read' },
  { name: 'importScripts(',  re: new RegExp(B + 'importScripts\\s*\\('),   why: 'worker-scope script load' },
  { name: 'sendBeacon',      re: /sendBeacon\s*\(/,                        why: 'network request that is not fetch()' },
  { name: 'Reflect.get(',    re: /Reflect\s*\.\s*get\s*\(/,                why: 'reaches a global by a computed name' },
  { name: 'window[',         re: new RegExp(BD + 'window\\s*\\['),         why: 'computed global access' },
  { name: 'globalThis[',     re: new RegExp(BD + 'globalThis\\s*\\['),     why: 'computed global access' },
  { name: 'self[',           re: new RegExp(BD + 'self\\s*\\['),           why: 'computed global access' },
  { name: 'navigator[',      re: new RegExp(BD + 'navigator\\s*\\['),      why: 'computed global access' },
  { name: 'document.defaultView', re: /document\s*\.\s*defaultView/,       why: 'another name for window' },
  { name: 'new Worker(',     re: /new\s+(Shared)?Worker\s*\(/,             why: 'a worker can fetch, and its body is a string this check never sees' },
];
/* TIER 3 — ACCIDENTAL NETWORK REACH. Found by the adversarial pass: half its 18
 * vectors were ordinary DOM, not clever. These fire ONLY on a non-relative string
 * literal, so `img.src = './ball.png'` — a game showing a local picture — is fine and
 * `img.src = 'https://…'` is not. A non-literal assignment cannot be judged from text
 * and becomes a NOTE, visible to a reviewer, rather than a build break. */
const REMOTE_LIT = `['"\`](?!\\.{1,2}/)(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?//`;
const TIER3 = [
  { name: '.src = <remote>',    re: new RegExp(`\\.\\s*src\\s*=\\s*${REMOTE_LIT}`),    why: 'an element with a remote src fetches it' },
  { name: '.href = <remote>',   re: new RegExp(`\\.\\s*href\\s*=\\s*${REMOTE_LIT}`),   why: 'a link/anchor with a remote href fetches it' },
  { name: '.action = <remote>', re: new RegExp(`\\.\\s*action\\s*=\\s*${REMOTE_LIT}`), why: 'a form posts to it' },
  { name: 'new Image(<remote>)',re: new RegExp(`new\\s+(Image|Audio)\\s*\\(\\s*${REMOTE_LIT}`), why: 'constructs and fetches' },
  { name: 'location.assign(',   re: /location\s*\.\s*(assign|replace)\s*\(/,           why: 'navigates away from the app' },
];
const SOFT = [   // notes, never failures
  { name: '.src = <non-literal>',  re: /\.\s*src\s*=\s*[A-Za-z_$]/,  why: 'assigned from a variable — this check cannot tell where it points' },
  { name: 'innerHTML',             re: /\.\s*innerHTML\s*=/,          why: 'can inject <img>/<iframe>; not judged here, but a reviewer should look' },
];

/* ---------------------------------------------------------------- *
 * Strip comments and string BODIES, char-for-char with spaces so every hit still
 * reports a true line and column. `${…}` substitutions are KEPT, because they are code.
 *
 * REWRITTEN AFTER THE PASS. The first version handled the first substitution and then,
 * on its closing `}`, blanked everything to the closing backtick — swallowing the
 * second substitution entirely, tier-2 tokens included. This is an explicit state
 * machine over a stack instead.
 *
 * KNOWN LIMIT, stated rather than implied: this is a scanner, not a parser, and a
 * REGEX LITERAL is not tracked. `const RE = /'/g;` opens a string as far as this is
 * concerned and can blank real code after it. That case is reported as a NOTE on every
 * module containing a regex literal, so a hidden token is never fully silent — the
 * previous version claimed it was "not silently hiding" tokens while its notes loop
 * covered tier 1 only.
 * ---------------------------------------------------------------- */
function strip(src, { keepStrings = false } = {}) {
  const out = src.split('');
  const n = src.length;
  const blank = (from, to) => { for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '; };
  /* stack entries: 'tmpl' = inside template text, 'subst' = inside ${ } */
  const stack = [];
  let i = 0;
  while (i < n) {
    const mode = stack[stack.length - 1];
    const c = src[i], d = src[i + 1];
    if (mode === 'tmpl') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '`') { stack.pop(); i++; continue; }
      if (c === '$' && d === '{') { stack.push('subst'); i += 2; continue; }
      if (!keepStrings) blank(i, i + 1);
      i++; continue;
    }
    // code context (top level, or inside a ${ } substitution)
    if (c === '/' && d === '/') { let j = i; while (j < n && src[j] !== '\n') j++; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; blank(i, Math.min(j + 2, n)); i = Math.min(j + 2, n); continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      if (!keepStrings) blank(i + 1, j);
      i = j + 1; continue;
    }
    if (c === '`') { stack.push('tmpl'); i++; continue; }
    if (c === '}' && mode === 'subst') { stack.pop(); i++; continue; }
    i++;
  }
  return out.join('');
}

/* Every import specifier in the source, static or dynamic, with whether it was a
 * literal. Runs on the STRIPPED source for position fidelity but reads the specifier
 * from the raw text, and is line-agnostic so `import{x}from'…'` and a specifier on the
 * next line are both seen — both evaded the previous line-based detector. */
function imports(raw) {
  const found = [];
  const push = (spec, literal, idx) => found.push({ spec, literal, line: raw.slice(0, idx).split('\n').length });
  const staticRe = /(?:^|[;}\s])import\s*(?:[\s\S]*?\bfrom\s*)?(['"`])([^'"`]*)\1/g;
  for (let m; (m = staticRe.exec(raw)); ) push(m[2], true, m.index);
  const dynRe = /(?<![A-Za-z0-9_$.])import\s*\(\s*(?:(['"`])([^'"`]*)\1)?/g;
  for (let m; (m = dynRe.exec(raw)); ) push(m[2] ?? null, m[2] !== undefined, m.index);
  return found;
}

const isRelative = (s) => s.startsWith('./') || s.startsWith('../');

/* Every module under games/, at ANY depth, with any module extension. The previous
 * version globbed `games/*.js` — flat, and .js only — so a subdirectory or a .mjs was
 * never read while being perfectly loadable. */
function collectModules(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) collectModules(full, acc);
    else if (/\.(js|mjs|cjs)$/i.test(e.name)) acc.push(full);
  }
  return acc;
}

function scanModule(full) {
  const rel = relative(REPO, full).split(sep).join('/');
  let src;
  try { src = readFileSync(full, 'utf8'); }
  catch (e) { bad(`${rel} — cannot be read`, e.code || e.message); return; }

  try { new vm.SourceTextModule(src, { identifier: rel }); }
  catch (e) { bad(`${rel} — does not parse as an ES module`, `${e.constructor.name}: ${e.message}`); return; }

  const stripped = strip(src);
  /* TIER 3 NEEDS THE STRING BODIES AND TIERS 1-2 MUST NOT HAVE THEM. A remote URL IS a
   * string literal, so matching `.src = 'https://…'` against the stripped source can
   * never fire — the first version of tier 3 was dead on arrival for exactly that
   * reason, and passed `new Image().src = 'https://evil/'` green. Comments are removed
   * for both; strings are removed only for tiers 1 and 2, where a token inside a
   * string is not reachable on its own. */
  const noComments = strip(src, { keepStrings: true });
  const rawLines = src.split('\n');
  const strippedLines = stripped.split('\n');
  const noCommentLines = noComments.split('\n');
  const hits = [];
  for (const t of [...TIER1, ...TIER2]) {
    strippedLines.forEach((line, idx) => {
      if (t.re.test(line)) hits.push({ name: t.name, why: t.why, line: idx + 1, text: (rawLines[idx] || '').trim().slice(0, 88) });
    });
  }
  for (const t of TIER3) {
    noCommentLines.forEach((line, idx) => {
      if (t.re.test(line)) hits.push({ name: t.name, why: t.why, line: idx + 1, text: (rawLines[idx] || '').trim().slice(0, 88) });
    });
  }

  /* Imports. A relative literal that resolves INSIDE games/ is fine — it is scanned
   * too, because collectModules walked the whole tree. Anything else is refused:
   * a non-relative specifier is remote or bare, an escaping one leaves the scanned
   * set, and a non-literal dynamic specifier cannot be judged from text at all. */
  for (const im of imports(src)) {
    if (!im.literal) {
      hits.push({ name: 'import(<non-literal>)', why: 'a computed specifier cannot be checked; use a literal relative path', line: im.line, text: (rawLines[im.line - 1] || '').trim().slice(0, 88) });
      continue;
    }
    if (!isRelative(im.spec)) {
      hits.push({ name: `import '${im.spec}'`, why: 'not a relative path — remote or bare specifiers reach outside games/', line: im.line, text: (rawLines[im.line - 1] || '').trim().slice(0, 88) });
      continue;
    }
    const target = resolve(dirname(full), im.spec);
    if (!target.startsWith(GAMES_DIR + sep)) {
      hits.push({ name: `import '${im.spec}'`, why: 'resolves OUTSIDE games/, where nothing scans it', line: im.line, text: (rawLines[im.line - 1] || '').trim().slice(0, 88) });
    }
  }

  if (hits.length) for (const h of hits) bad(`${rel}:${h.line} — ${h.name}`, `${h.why}\n        ${h.text}`);
  else ok(`${rel}`);

  /* Residual signal. Now over TIER 1 AND TIER 2 — the previous version covered tier 1
   * only, so a token the stripper hid left no trace whatsoever if it was tier 2. */
  for (const t of [...TIER1, ...TIER2]) {
    if (t.re.test(src) && !t.re.test(stripped)) {
      notes.push(`${rel}: "${t.name}" appears in the source but only inside a comment or string — not a finding, but shown so the stripper is not silently hiding it`);
    }
  }
  if (/(^|[^\\])\/(?![/*])[^\n]*[^\\]\//.test(stripped) || /=\s*\/[^/*\n]/.test(src)) {
    notes.push(`${rel}: contains what looks like a REGEX LITERAL. This scanner does not track regex literals, so a token after one on the same line can be hidden. Read this module by eye.`);
  }
  for (const t of SOFT) {
    if (t.re.test(noComments)) notes.push(`${rel}: ${t.name} — ${t.why}`);
  }
}

console.log(`CHECK 11 — game modules cannot reach the network. subject ${COMMIT.slice(0, 12)}\n`);

let modules;
try {
  const st = statSync(GAMES_DIR);
  if (!st.isDirectory()) throw Object.assign(new Error('not a directory'), { code: 'ENOTDIR' });
  modules = collectModules(GAMES_DIR).sort();
} catch (e) {
  console.log(`  FAIL  games/ cannot be read at ${GAMES_DIR}`);
  console.log(`        ${e.code || e.message}`);
  console.error('::error::CHECK 11 FAILED — games/ cannot be read, so nothing was scanned.');
  console.error('::error::That is a FAILURE and not a pass: a check that scans nothing and');
  console.error('::error::reports success is the defect this check was built to close.');
  process.exit(1);
}
if (modules.length === 0) {
  console.log('  FAIL  games/ contains no modules');
  console.error('::error::CHECK 11 FAILED — games/ holds no modules, so nothing was scanned.');
  console.error('::error::Fail-closed by design: see the comment at the top of this file.');
  process.exit(1);
}
console.log(`  scanning ${modules.length} module(s) under games/, at any depth\n`);
for (const m of modules) scanModule(m);

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error(`\nCHECK 11 FAILED at ${COMMIT.slice(0, 12)} — ${failures.length} finding(s):\n`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.detail}`);
  console.error('\n  northstar invariant 3: every core surface works with no network.');
  console.error(`::error::CHECK 11 FAILED — ${failures.length} forbidden construct(s) in games/.`);
  process.exit(1);
}

console.log(`\nCHECK 11 PASSED at ${COMMIT.slice(0, 12)} — ${modules.length} module(s) scanned.`);
console.log('  WHAT THIS ESTABLISHES: no module contains a construct from the checked set,');
console.log('  every relative import resolves inside games/ and was itself scanned, and');
console.log('  no import names a remote or bare specifier.');
console.log('');
console.log('  WHAT IT DOES NOT ESTABLISH, stated because the first version of this file');
console.log('  implied otherwise and a reviewer proved it wrong with 18 working vectors:');
console.log('  THIS IS NOT A SANDBOX. A game module runs in the shell\'s own realm with');
console.log('  `window` in scope, so a module that WANTS the network can have it —');
console.log('  `const f = fetch`, an <img> built from fragments, a Blob worker. No');
console.log('  textual check can prevent that. This raises the cost and catches the');
console.log('  honest mistake; the structural answers are a Content-Security-Policy or');
console.log('  running modules in an iframe/worker, and both are architecture calls.');
