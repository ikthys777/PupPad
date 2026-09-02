#!/usr/bin/env node
/**
 * CHECK 12 — the positive controls for check 11.
 *
 * PUP-WO-0200 §3.2 requires check 11 demonstrated RED "against a module carrying each
 * forbidden token, each removed one at a time so the check is shown to detect EACH
 * rather than ANY". A demonstration run once and written into a feedback file is
 * evidence about a tree that no longer exists — architecture §6.1 member 5, a record
 * trusted because it stayed unchanged. So the demonstration lives here instead, and
 * runs on every commit.
 *
 * The property under test is NOT "check 11 passes". It is "check 11 FAILS when it
 * should, on each construct individually, and PASSES when it should". A check nobody
 * has watched go red is indistinguishable from one that cannot — roadmap P1 gate items
 * 1 and 2 exist for exactly that reason, and this is the same discipline one level
 * down.
 *
 * Each case is run against a THROWAWAY games/ directory in a temp dir, never against
 * the repository's own. Check 11 is invoked as a subprocess exactly as CI invokes it,
 * so what is tested is the shipped file and not a copy of its logic.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = join(HERE, 'check-games-offline.mjs');

const results = [];
function run(label, { files, expect, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-games-'));
  try {
    if (files !== null) {
      mkdirSync(join(dir, 'games'), { recursive: true });
      for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, 'games', name), src);
    }
    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { code = e.status ?? 1; out = (e.stdout || '') + (e.stderr || ''); }
    const observed = code === 0 ? 'GREEN' : 'RED';
    /* THE EXIT CODE IS NOT THE VERDICT — PUP-WO-0103's finding B, one work order on.
     * A RED for the wrong reason is not evidence that the construct under test is
     * detected: a fixture with a typo would be red too, and would score as proof. So
     * a RED case must also name the construct it was built to catch. */
    const matched = observed !== 'RED' || !expectText || out.includes(expectText);
    const pass = observed === expect && matched;
    if (observed === expect && !matched) {
      console.log(`        RED, but NOT on the expected construct: wanted ${JSON.stringify(expectText)}`);
    }
    results.push({ label, expect, observed, pass, code });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${observed.padEnd(5)} ${label}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const wrap = (body) => `export default function mount(host, api) {\n  ${body}\n  return function teardown() {};\n}\n`;
const CLEAN = wrap("host.textContent = 'hello';");

console.log('=== PART A — fail closed. Scanning nothing is a FAILURE, never a pass ===');
console.log('(this is the shape that hid the check\'s absence: games/ did not exist, so a');
console.log(' check that scanned nothing would have reported success and nobody would know)');
run('no games/ directory at all', { files: null, expect: 'RED', expectText: 'cannot be read' });
run('games/ exists but holds no modules', { files: {}, expect: 'RED', expectText: 'no .js modules' });
run('a module that does not parse', { files: { 'x.js': 'export default function f({ \n' }, expect: 'RED', expectText: 'does not parse' });

console.log('\n=== PART B — each forbidden construct, ALONE, must go RED and be NAMED ===');
console.log('(alone, so the check is shown to detect EACH rather than ANY)');
const SOLO = [
  ['fetch(',                "const r = fetch('/x');",                 'fetch('],
  ['XMLHttpRequest',        'const x = new XMLHttpRequest();',        'XMLHttpRequest'],
  ['import(',               "const m = import('./o.js');",            'import('],
  ['EventSource',           "const e = new EventSource('/s');",       'EventSource'],
  ['new WebSocket',         "const w = new WebSocket('wss://x');",    'new WebSocket'],
  ['eval(',                 "eval('1+1');",                           'eval('],
  ['new Function(',         "const f = new Function('return 1');",    'new Function('],
  ['importScripts(',        "importScripts('x.js');",                 'importScripts('],
  ['navigator.sendBeacon',  "navigator.sendBeacon('/b','d');",        'navigator.sendBeacon'],
  ['window[',               "window['fet'+'ch']('/x');",              'window['],
  ['globalThis[',           "globalThis['x']();",                     'globalThis['],
  ['self[',                 "self['x']();",                           'self['],
];
for (const [name, body, text] of SOLO) run(`${name} alone`, { files: { 'x.js': wrap(body) }, expect: 'RED', expectText: text });
run("static import of a REMOTE specifier alone", {
  files: { 'x.js': "import z from 'https://evil.example/m.js';\n" + CLEAN },
  expect: 'RED', expectText: 'non-relative specifier',
});

console.log('\n=== PART C — the removal ladder. Removing ONE must retire ONLY its finding ===');
const FIVE = [
  ["const r = fetch('/x');",              'fetch('],
  ['const x = new XMLHttpRequest();',     'XMLHttpRequest'],
  ["const m = import('./o.js');",         'import('],
  ["const e = new EventSource('/s');",    'EventSource'],
  ["const w = new WebSocket('wss://x');", 'new WebSocket'],
];
for (let skip = 0; skip < FIVE.length; skip++) {
  const body = FIVE.filter((_, i) => i !== skip).map(([b]) => b).join('\n  ');
  const dir = mkdtempSync(join(tmpdir(), 'puppad-games-'));
  mkdirSync(join(dir, 'games'), { recursive: true });
  writeFileSync(join(dir, 'games', 'x.js'), wrap(body));
  let out = '';
  try { out = execFileSync(process.execPath, ['--experimental-vm-modules', CHECK, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  rmSync(dir, { recursive: true, force: true });
  const gone = !out.includes(`— ${FIVE[skip][1]}`);
  const remaining = (out.match(/ {2}FAIL {2}games\//g) || []).length;
  const pass = gone && remaining === FIVE.length - 1;
  results.push({ label: `removing ${FIVE[skip][1]}`, expect: 'ladder', observed: pass ? 'ladder' : 'broken', pass, code: 1 });
  console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} removed ${FIVE[skip][1].padEnd(16)} its finding GONE=${gone}, others still reported=${remaining}`);
}

console.log('\n=== PART D — it must also be able to PASS. A check that only fails is not a check ===');
run('a clean module', { files: { 'x.js': CLEAN }, expect: 'GREEN' });
run('a forbidden token inside a COMMENT or STRING only', {
  files: { 'x.js': '// not calling fetch( here\n' + wrap('const s = "do not use fetch( please"; host.textContent = s;') },
  expect: 'GREEN',
});
run('a RELATIVE static import', { files: { 'x.js': "import z from './helper.js';\n" + CLEAN, 'helper.js': 'export default 1;\n' }, expect: 'GREEN' });
run('a token inside a template SUBSTITUTION is CODE, not string', {
  files: { 'x.js': wrap("host.textContent = `x${fetch('/leak')}`;") },
  expect: 'RED', expectText: 'fetch(',
});

console.log('\n' + '='.repeat(78));
const bad = results.filter((r) => !r.pass);
if (bad.length) {
  console.error(`::error::CHECK 12 FAILED — ${bad.length} control(s) did not behave as predicted.`);
  console.error(`\nCHECK 12 FAILED — ${bad.length} control(s):`);
  for (const r of bad) console.error(`  ${r.label}: expected ${r.expect}, got ${r.observed}`);
  console.error('\n  A control that stops working means check 11 is no longer known to be able');
  console.error('  to go red on that construct. Do NOT delete the control to make this green.');
  process.exit(1);
}
console.log(`CHECK 12 PASSED — ${results.length} controls, all as predicted.`);
console.log('  PART A: three fail-closed conditions. Scanning nothing is a FAILURE.');
console.log('  PART B: 13 constructs, each ALONE, each RED and each NAMED — so check 11');
console.log('          is shown to detect EACH rather than ANY.');
console.log('  PART C: the removal ladder — retiring one construct retires exactly one');
console.log('          finding and leaves the other four standing.');
console.log('  PART D: four cases that must stay GREEN, because a check that cannot pass');
console.log('          is not a check either.');
