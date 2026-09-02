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
run('a REAL regex literal must still produce the note', {
  files: { 'x.js': wrap("const RE = /ab+c/g; host.textContent = RE.test('abc') ? 'y' : 'n';") },
  expect: 'GREEN',
  noteText: 'REGEX LITERAL',
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
