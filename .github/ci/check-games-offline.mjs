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
/* FAILS CLOSED. This used to initialise to 'unknown' and pass — architecture §5 says
 * every demonstration asserts the commit it ran against, and a green with no
 * identifiable subject is a claim about a tree nobody can name. PUP-WO-0300 fixed it in
 * one check and recorded the rest; PUP-WO-0201 is the next work order to open this
 * directory, which is where CC-A ruled the sweep belongs. PUPPAD_SUBJECT lets a tree
 * with no .git — a `git archive` export, which the freeze protocol hands a read-only
 * adversarial pass — state its own subject instead. */
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 11 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}

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
  /* A REMOTE `url(`, WHICH IS HOW A FONT GETS FETCHED. PUP-WO-0300 §3 states that this
   * check "will red on" a remote font — and it did not, by either natural form: a
   * stylesheet whose text contains `@font-face{src:url(https://…)}` and
   * `new FontFace('g','url(https://…)')` both matched nothing, because the `.src =`
   * patterns need an assignment and `src:url(` is not one. Both were demonstrated
   * fetching from an off-origin server through a module this check passed GREEN. The
   * ground-truth document was right about the requirement and wrong about the coverage;
   * this is the coverage. It also catches `style.backgroundImage = "url('https://…')"`,
   * which was through by the same gap. */
  { name: 'url(<remote>)',      re: /url\(\s*['"`]?(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//, why: 'a stylesheet, background-image or @font-face fetches it' },
];
const SOFT = [   // notes, never failures
  { name: '.src = <non-literal>',  re: /\.\s*src\s*=\s*[A-Za-z_$]/,  why: 'assigned from a variable — this check cannot tell where it points' },
  /* THE FORM THE NOTE ABOVE PROMISED AND DID NOT COVER. `[A-Za-z_$]` requires an
   * IDENTIFIER after the `=`, so `i.src = 'https:' + '//evil/x.png'` — which starts with
   * a quote — matched neither this note nor TIER 3's literal pattern, whose REMOTE_LIT
   * needs the `//` inside ONE literal. Total silence on the single most likely way to
   * write a URL you do not want scanned, under a comment promising a visible note for
   * exactly that. Demonstrated fetching off-origin from a green module. */
  { name: '.src/.href/.action = <concatenation>', re: /\.\s*(?:src|href|action)\s*=\s*[^;\n]*\+/, why: 'built by concatenation — this check cannot tell where it points' },
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
 * REGEX LITERALS ARE TRACKED, AND THEY DID NOT USED TO BE. The header here used to say
 * so as a "KNOWN LIMIT, stated rather than implied" — `const RE = /'/g;` opened a string
 * as far as this was concerned and blanked real code after it — and that was an honest
 * limit for as long as the IMPORT scan ran on the raw source, because a stripper blind
 * spot could then only ever cost a false NOTE. PUP-WO-0113 moved the import scan onto
 * the stripped source to stop it reading English, and THE MOMENT IT DID, every blind
 * spot in here became a way for a real remote import to go GREEN. Measured, four of
 * them, each a genuine `import z from 'https://…'` that this gate stopped catching:
 *
 *     const RE = /`/;      the backtick opened a template and blanked to END OF FILE
 *     const RE = /[/*]/;   the `/` `*` pair opened a block comment, likewise
 *     const RE = /'/g;     the quote opened a string and blanked the rest of the line
 *     // …<U+2028>import   U+2028 ENDS a line comment in JavaScript; this stopped at \n
 *
 * A fail-closed gate that passes is worse than one that fires on prose, so the limit had
 * to close rather than be documented harder. A regex literal is CODE whose contents are
 * not, which is exactly a string's shape: keep the delimiters, blank the body.
 *
 * WHETHER `/` OPENS A REGEX OR DIVIDES IS THE ONE THING A LEXER CANNOT DECIDE LOCALLY,
 * and the heuristic is the same one this file already used for its regex NOTE: a regex
 * can only start where an operator, an opening bracket, or one of a handful of keywords
 * can be followed by one. It is a heuristic and it can be wrong in both directions, so
 * it is not the only thing standing here — see `broke` below.
 *
 * AND THE STRIPPER NOW REPORTS WHEN IT LOSES ITS PLACE. Callers get `.broke`, set when a
 * string, template, block comment or regex literal ran to end of file without closing.
 * `scanModule` has ALREADY proved the module parses as an ES module before it strips, so
 * in a file that parses, an unterminated anything is impossible — it means this scanner
 * mis-lexed, and the honest response is to refuse a verdict on that module rather than
 * to report the green that a blanked file always produces.
 * ---------------------------------------------------------------- */
/* A LINE COMMENT ENDS AT ANY LINE TERMINATOR, AND JAVASCRIPT HAS FOUR. U+2028 and
 * U+2029 are line terminators in the grammar; stopping only at \n let a `//` comment
 * swallow the real statement that followed one. `\r` matters for a CRLF checkout. */
const LINE_END = (ch) => ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029';

/* Where a `/` can begin a REGEX rather than divide: after an operator, an opening
 * bracket, or one of these keywords. After an identifier, a literal, `)` or `]` it is
 * division.
 *
 * THIS IS A HEURISTIC AND IT CANNOT BE MADE CORRECT. Whether `/` opens a regex is a
 * GRAMMAR question — `a = b\n/re/.test(c)` and `a = b / c / d` differ only in what the
 * parser decided `b` was, and ASI can insert the boundary that changes the answer. No
 * amount of lookbehind settles it. It is kept because the tier scans need SOME lexer;
 * it is not what the import findings rest on any more.
 *
 * AND THE FIRST VERSION OF THIS COMMENT ARGUED A SAFETY PROPERTY THE CODE DOES NOT HAVE.
 * It said being wrong in the `if (x) /re/.test(y)` direction "leaves a regex unblanked —
 * a false RED, which is loud — rather than blanking real code, which would be a silent
 * green." THAT IS BACKWARDS, and it was the safety argument of the gate itself. An
 * unblanked regex has its BODY LEXED AS CODE, so a `/*` inside it opens a block comment
 * that closes at the next one anywhere later in the file and blanks everything between —
 * a real remote import went green through exactly that, with no finding and no note.
 * NEITHER DIRECTION IS INHERENTLY LOUD. What makes this one loud is the parse-oracle
 * cross-check in `scanModule`: V8 knows the specifiers, `strip()` is char-for-char, so a
 * statement this lexer swallowed is detectable rather than argued about. A mechanism,
 * not a claim. Check 12 proves that class refuses. */
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'instanceof']);
const REGEX_PREV = '(,=:[!&|?{};+-*%~^<>';

function strip(src, { keepStrings = false } = {}) {
  const out = src.split('');
  const n = src.length;
  let broke = null;
  const blank = (from, to) => { for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '; };
  /* stack entries: 'tmpl' = inside template text, 'subst' = inside ${ }. `substDepth`
   * counts the braces nested INSIDE a substitution, and its absence was a defect: an
   * object literal or a block body inside `${…}` — `${xs.map((r) => { return r; })}` —
   * closed the substitution on its own `}`, and the rest of the real code in it was then
   * blanked as template TEXT. A `new WebSocket('wss://evil…')` after that brace went
   * green, and the note that fired said it "appears only inside a comment or string"
   * about executable code. Found by the adversarial pass. */
  const stack = [];
  const substDepth = [];
  let i = 0;
  /* The last significant character and the last complete word seen in CODE context —
   * enough to answer the regex-or-division question without a parser. */
  let prevSig = '';
  let word = '';
  /* WHITESPACE ENDS A WORD; IT MUST NOT ERASE IT. The first version cleared `word` here,
   * so `regexAllowed()` reached `REGEX_KEYWORDS.has('')` — false — for every keyword
   * written with a space after it. `return/re/` worked and `return /re/` did not, which
   * is to say the keyword set was dead in all real code. Found by the adversarial pass. */
  const advance = (c) => {
    if (/\s/.test(c)) return;
    if (/[A-Za-z0-9_$]/.test(c)) { if (prevSig !== 'w') word = ''; word += c; prevSig = 'w'; return; }
    word = ''; prevSig = c;
  };
  const regexAllowed = () => {
    if (prevSig === '') return true;
    if (prevSig === 'w') return REGEX_KEYWORDS.has(word);
    return REGEX_PREV.includes(prevSig);
  };
  while (i < n) {
    const mode = stack[stack.length - 1];
    const c = src[i], d = src[i + 1];
    if (mode === 'tmpl') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '`') { stack.pop(); prevSig = '`'; word = ''; i++; continue; }
      if (c === '$' && d === '{') { stack.push('subst'); substDepth.push(0); prevSig = ''; word = ''; i += 2; continue; }
      if (!keepStrings) blank(i, i + 1);
      i++; continue;
    }
    // code context (top level, or inside a ${ } substitution)
    if (c === '/' && d === '/') { let j = i; while (j < n && !LINE_END(src[j])) j++; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      if (j >= n) broke = broke || 'a block comment';
      blank(i, Math.min(j + 2, n)); i = Math.min(j + 2, n); continue;
    }
    /* A REGEX LITERAL. `/` in expression position, consumed to its closing `/` with a
     * character class treated as opaque — inside `[...]` a `/` is an ordinary character
     * and does NOT end the literal, which is the whole of why `/[/*]/` used to open a
     * block comment here. The body is blanked like a string's; the delimiters stay. */
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false, closed = false;
      for (; j < n; j++) {
        const e = src[j];
        if (e === '\\') { j++; continue; }
        if (LINE_END(e)) break;                 /* a regex cannot span a line */
        if (cls) { if (e === ']') cls = false; continue; }
        if (e === '[') { cls = true; continue; }
        if (e === '/') { closed = true; break; }
      }
      if (!closed) { broke = broke || 'a regex literal'; blank(i + 1, j); i = j; prevSig = '/'; word = ''; continue; }
      if (!keepStrings) blank(i + 1, j);
      let k = j + 1;
      while (k < n && /[a-z]/.test(src[k])) k++;  /* flags */
      i = k; prevSig = 'w'; word = ''; continue;  /* a regex is a value: `/` after it divides */
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let closed = false;
      while (j < n && !LINE_END(src[j])) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) { closed = true; break; } j++; }
      if (!closed) broke = broke || 'a string literal';
      if (!keepStrings) blank(i + 1, j);
      i = j + 1; prevSig = 'w'; word = ''; continue;
    }
    if (c === '`') { stack.push('tmpl'); i++; continue; }
    if (c === '{' && mode === 'subst') { substDepth[substDepth.length - 1]++; advance(c); i++; continue; }
    if (c === '}' && mode === 'subst') {
      if (substDepth[substDepth.length - 1] > 0) { substDepth[substDepth.length - 1]--; advance(c); i++; continue; }
      stack.pop(); substDepth.pop(); prevSig = 'w'; word = ''; i++; continue;
    }
    advance(c);
    i++;
  }
  if (stack.length) broke = broke || 'a template literal';
  return { text: out.join(''), broke };
}

/* THE STATIC IMPORTS COME FROM V8, NOT FROM A REGULAR EXPRESSION, AND THAT IS A CHANGE
 * OF MECHANISM RATHER THAN A FIFTH REFINEMENT OF ONE.
 *
 * PUP-WO-0113 moved this scan from the raw source onto the stripped source so it would
 * stop reading English. That was right, and it made the STRIPPER load-bearing for the
 * gate: every place the lexer could lose its place became a way for a real remote import
 * to pass. Two rounds of adversarial review found SEVEN such inputs. Four were closed by
 * refining the lexer. Then the next pass found three more, and the decisive one showed
 * the refinements were being argued from a property the code did not have — see the
 * header of `strip()`. The pattern was not converging.
 *
 * THE HONEST FINDING IS THAT `/` VERSUS DIVISION CANNOT BE DECIDED BY A SCANNER. It is a
 * grammar question — `a = b\n/re/.test(c)` and `a = b / c / d` differ only in what the
 * parser thinks `b` was — and no amount of lookbehind settles it, because ASI can insert
 * the boundary that changes the answer. A heuristic here is not a rough edge to sand
 * down; it is a wrong tool, and each refinement bought one input and cost another.
 *
 * SO STOP GUESSING AND ASK THE PARSER THAT IS ALREADY RUNNING. `scanModule` constructs a
 * `vm.SourceTextModule` on the line above this one, to prove the file parses at all. That
 * object carries `dependencySpecifiers`: V8's own list of every static specifier in the
 * module, produced by the same parser the browser will use. It cannot be fooled by a
 * regex literal, a template, a comment or a piece of prose, because it is not reading
 * text — it is reading a parse.
 *
 * WHAT IT ALSO FIXES, FOR FREE AND WITHOUT A REGEX:
 *   - the unbounded `[\s\S]*?` gap is GONE from the enforcement path. The work order was
 *     right that the gap must not be BOUNDED — bounding it reintroduces the evasions it
 *     exists to close — and it turns out the gap did not need bounding OR keeping: with a
 *     parse in hand there is nothing for it to do. `import{x}from'y'`, a specifier on the
 *     next line and every whitespace variant are the same three tokens to V8.
 *   - `import.meta.url` followed by a side-effect `import '…';` — the lazy gap used to
 *     consume the whole statement between them and `lastIndex` skipped it. Not a gap
 *     problem: a `lastIndex` problem, and it does not exist without the regex.
 *   - an escaped specifier. `dependencySpecifiers` returns the DECODED string, so
 *     `import z from "./a/../../evil.js"` arrives here as
 *     `./a/../../evil.js` and resolves out of games/ like any other escaping path. The
 *     previous commit refused these as unjudgeable; they are judgeable now, correctly,
 *     and the refusal is gone.
 *
 * WHAT IT DOES NOT COVER, STATED RATHER THAN LEFT TO BE FOUND:
 *   - DYNAMIC `import(...)`, which is a call expression and not a module dependency. That
 *     is still a text scan, below, and it is still the one place a mis-lex could hide an
 *     import. The cross-check in `scanModule` is aimed at exactly that.
 *   - SCOPE NOTE, FLAGGED AND NOT BURIED: `dependencySpecifiers` includes `export … from`
 *     re-exports, which the previous text scan could not see at all and which CC-A has
 *     taken for its own work order. There is no way to tell them apart from a parse
 *     without going back to text, and writing code whose only purpose is to NOT report
 *     `export * from 'https://evil'` in a gate built to stop remote code is not a thing
 *     this file should contain. So they are reported. If that collides with the other
 *     work order, the collision is that its subject is already closed. */
function staticSpecifiers(mod, raw) {
  /* THE LINE IS BEST-EFFORT AND SAYS SO WHEN IT IS NOT FOUND. V8 gives the specifier, not
   * its position, so the line comes from locating the quoted literal in the raw text —
   * which is a search for a string we already know, not a scan that has to recognise
   * syntax. A decoded specifier (one written with escapes) will not appear verbatim; that
   * is reported as line 0 rather than guessed at, and the finding still stands because
   * the finding came from the parse. */
  return mod.dependencySpecifiers.map((spec) => {
    let line = 0;
    for (const q of ["'", '"', '`']) {
      const at = raw.indexOf(q + spec + q);
      if (at >= 0) { line = raw.slice(0, at).split('\n').length; break; }
    }
    return { spec, literal: true, line, fromParse: true };
  });
}

/* DYNAMIC `import()` ONLY. V8 does not list these — a dynamic import is a call, not a
 * module dependency — so this is the one construct still recognised from text, and it
 * runs on the stripped source. There is no `[\s\S]*?` here and never was: the specifier
 * of a dynamic import is its first argument and nothing may come between. */
function dynamicImports(raw, stripped) {
  const found = [];
  const dynRe = /(?<![A-Za-z0-9_$.])(import)\s*\(\s*(?:(['"`])([^'"`]*)\2)?/dg;
  for (let m; (m = dynRe.exec(stripped)); ) {
    const g = m.indices[3];
    found.push({ spec: g ? raw.slice(g[0], g[1]) : null, literal: !!g,
                 line: raw.slice(0, m.indices[1][0]).split('\n').length, fromParse: false });
  }
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

  /* THE PARSE IS KEPT NOW, NOT THROWN AWAY. It used to be constructed only to prove the
   * file is an ES module and then discarded — while, four lines below, a regular
   * expression tried to work out from text what this object already knows exactly. */
  let mod;
  try { mod = new vm.SourceTextModule(src, { identifier: rel }); }
  catch (e) { bad(`${rel} — does not parse as an ES module`, `${e.constructor.name}: ${e.message}`); return; }

  /* THE STRIPPER'S OWN VERDICT ON ITSELF, AND IT IS FAIL-CLOSED. The parse above has
   * proved this file is a valid ES module, so an unterminated string, template, block
   * comment or regex literal is IMPOSSIBLE in it — if the stripper reports one, the
   * stripper lost its place, and everything downstream is reading a file blanked to end
   * of file. A blanked file scans clean. Refusing is the only honest answer. */
  const _stripped = strip(src);
  if (_stripped.broke) {
    bad(`${rel} — this scanner lost its place: ${_stripped.broke} was never closed`,
      'the module PARSES, so it cannot really contain one — this file mis-lexed it and everything after that point was blanked. No verdict is possible; nothing is established about this module in either direction.');
    return;
  }
  const stripped = _stripped.text;

  /* AND A SECOND, SHARPER CHECK ON THE STRIPPER, USING THE PARSE AS AN ORACLE.
   *
   * `.broke` catches a mis-lex that runs off the end of the file. It does NOT catch one
   * that closes tidily — and that is the shape the last adversarial pass used: a `/*`
   * inside a regex literal the heuristic read as division opens a block comment, which
   * then closes at the next `*​/` anywhere later in the file. Everything between is
   * blanked, `.broke` never fires, and the module reports clean. A real remote import
   * went green that way with no finding and no note.
   *
   * The static findings no longer depend on the stripper, so that particular input can no
   * longer hide an import. But the TIER SCANS still read `stripped`, and a `fetch(` in
   * the blanked region would be just as invisible — the same defect, one column over.
   *
   * So: V8 knows where every static specifier is. `strip()` is char-for-char, and it
   * keeps a string's own quote characters while blanking a comment entirely. Therefore,
   * at the offset of a specifier's opening quote, an INTACT module still shows that quote
   * in the stripped text, and a module whose statement was swallowed by a bogus comment
   * shows a space. That is a cheap, exact test for "did this lexer eat real code", and it
   * costs one indexOf per import.
   *
   * It is not a proof that the stripping is correct everywhere — nothing short of a
   * parser is — but it converts the whole class the pass exploited into a REFUSAL, using
   * the one authoritative fact available for free. The residual class is named in
   * docs/feedback/PUP-WO-0113.md rather than left to be discovered: a mis-lex that
   * swallows a tier token and no import at all is still silent, and closing that needs
   * this file to scan a parse rather than a string. */
  for (const spec of mod.dependencySpecifiers) {
    /* EVERY OCCURRENCE, AND THE TEST IS "DID ANY SURVIVE". The first version took
     * `indexOf` — the FIRST occurrence — and a module that mentions its own import path
     * in a comment above the import has its first occurrence inside that comment, which
     * is blanked by design. It refused every such module. Found by the control written
     * for it, which is what that control is for: a mis-lex hides an import ANYWHERE it
     * is written, so the question is whether the specifier survives SOMEWHERE, not
     * whether the first place it appears does. */
    const sites = [];
    for (const q of ["'", '"', '`']) {
      for (let at = src.indexOf(q + spec + q); at >= 0; at = src.indexOf(q + spec + q, at + 1)) sites.push(at);
    }
    if (sites.length && !sites.some((at) => stripped[at] === src[at])) {
      bad(`${rel} — this scanner blanked a real import: '${spec}'`,
        'V8 parsed that specifier out of this module and the stripped source has every occurrence of it overwritten — so a comment or string boundary was mis-read and an unknown amount of real code went with it. The tier scans read that same text, so no verdict is possible on this module.');
      return;
    }
  }

  /* TIER 3 NEEDS THE STRING BODIES AND TIERS 1-2 MUST NOT HAVE THEM. A remote URL IS a
   * string literal, so matching `.src = 'https://…'` against the stripped source can
   * never fire — the first version of tier 3 was dead on arrival for exactly that
   * reason, and passed `new Image().src = 'https://evil/'` green. Comments are removed
   * for both; strings are removed only for tiers 1 and 2, where a token inside a
   * string is not reachable on its own. */
  const noComments = strip(src, { keepStrings: true }).text;
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
  for (const im of [...staticSpecifiers(mod, src), ...dynamicImports(src, stripped)]) {
    const where = im.line ? `${rel}:${im.line}` : rel;
    const text = im.line ? (rawLines[im.line - 1] || '').trim().slice(0, 88)
                         : '(written with an escape, so it does not appear verbatim — V8 decoded it)';
    if (!im.literal) {
      hits.push({ name: 'import(<non-literal>)', why: 'a computed specifier cannot be checked; use a literal relative path', line: im.line, text });
      continue;
    }
    if (!isRelative(im.spec)) {
      hits.push({ name: `import '${im.spec}'`, why: 'not a relative path — remote or bare specifiers reach outside games/', line: im.line, text });
      continue;
    }
    /* THE BACKSLASH REFUSAL IS GONE, AND IT WAS RIGHT TO ADD AND RIGHT TO REMOVE. It
     * existed because `im.spec` used to be the RAW source text between the quotes, so
     * `"./a\u002f..\u002f..\u002fevil.js"` passed `isRelative` and then `resolve()`
     * treated the escape as ordinary filename characters and cleared it. A specifier that
     * cannot be decoded cannot be judged, and refusing was the honest answer THEN.
     * `dependencySpecifiers` hands over the DECODED string, so it is judgeable now and is
     * judged: that one arrives as `./a/../../evil.js` and resolves out of games/ like any
     * other escaping path. A dynamic specifier still comes from text and still may not. */
    if (!im.fromParse && im.spec.includes('\\')) {
      hits.push({ name: `import '${im.spec}'`, why: 'a dynamic specifier written with an escape cannot be decoded from the source text; write the path plainly', line: im.line, text });
      continue;
    }
    const target = resolve(dirname(full), im.spec);
    if (!target.startsWith(GAMES_DIR + sep)) {
      hits.push({ name: `import '${im.spec}'`, why: 'resolves OUTSIDE games/, where nothing scans it', line: im.line, text });
    }
    void where;
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
  /* AND THE SAME COURTESY FOR IMPORTS, WHICH IS NEW AND IS THE PRICE OF SCANNING THE
   * STRIPPED SOURCE. Matching stripped is what stops prose being read as code; the
   * mirror-image risk is that the stripper blanks something that WAS code and an import
   * disappears. The stripper's one stated blind spot is the regex literal — see its
   * header — so this is not hypothetical. Nothing here is a finding: an import visible
   * on raw and not on stripped is either a genuine mention in prose, which is the whole
   * point, or a real one the stripper ate, which nobody would otherwise learn. The note
   * says which pair to look at and leaves the judgement with a person. */
  /* THE RAW-VERSUS-STRIPPED NOTE IS GONE TOO, AND THE REASON IS THE SAME ONE THAT
   * RETIRED THE REGEX NOTE ONE COMMIT AGO: a gate replaced it. It said "these lines match
   * before stripping and not after — read them", which is a request that a person notice
   * something. The oracle cross-check above answers the same question with V8's own parse
   * and REFUSES A VERDICT, which is not a request. Keeping both would leave a note that
   * fires only in cases the check above has already failed on. */
  /* THE REGEX-LITERAL NOTE IS GONE, AND ITS ABSENCE IS THE POINT. It said "This scanner
   * does not track regex literals, so a token after one on the same line can be hidden.
   * Read this module by eye." That sentence was true when it was written and this change
   * made it FALSE — `strip()` tracks them now and blanks their bodies like a string's.
   * Leaving it would be a comment describing a behaviour its code no longer has, which
   * is the exact defect PUP-WO-0113 exists to remove; a note telling a reader to check
   * by eye for a hazard that has been closed trains them to ignore notes.
   *
   * What replaced it is not another note. It is `strip().broke` — the stripper says so
   * when it loses its place, and `scanModule` REFUSES A VERDICT rather than reporting the
   * green a blanked file always gives. A fail-closed signal instead of a request that
   * somebody read 900 lines carefully. Check 12 pins both directions. */
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
