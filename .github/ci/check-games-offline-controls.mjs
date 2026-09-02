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
let COMMIT = 'unknown';
try { COMMIT = execFileSync('git', ['-C', join(HERE, '..', '..'), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}

const results = [];
function run(label, { files, expect, expectText }) {
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
      out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { code = e.status ?? 1; out = (e.stdout || '') + (e.stderr || ''); }
    const observed = code === 0 ? 'GREEN' : 'RED';
    /* THE EXIT CODE IS NOT THE VERDICT (PUP-WO-0103 finding B). A RED for the wrong
     * reason is not evidence that the construct under test is detected — a fixture with
     * a typo would be red too and would score as proof. A RED case must NAME what it
     * was built to catch. */
    const matched = observed !== 'RED' || !expectText || out.includes(expectText);
    const pass = observed === expect && matched;
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
  try { out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
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
console.log('  PART A  three fail-closed conditions; scanning nothing is a FAILURE.');
console.log('  PART B  21 constructs, each ALONE and each NAMED — detect EACH, not ANY.');
console.log('  PART B2 seven cases the adversarial pass got through the first version:');
console.log('          an unscanned subdirectory, a .mjs sibling, an escaping import, a');
console.log('          second template substitution, two static-import evasions, and a');
console.log('          non-literal dynamic specifier.');
console.log('  PART C  the removal ladder: retiring one construct retires exactly one');
console.log('          finding and leaves the other three standing.');
console.log('  PART D  six cases that must stay GREEN, including the two the pass showed');
console.log('          were wrongly refused: local code-splitting, and a local image.');
