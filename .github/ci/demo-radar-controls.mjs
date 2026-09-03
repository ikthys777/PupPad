#!/usr/bin/env node
/**
 * CHECK 23'S CONTROLS — every section of demo-radar.mjs shown going RED.  PUP-WO-0602.
 *
 * The plants are the defects the radar actually had before this work order: no
 * `contextmenu` suppression at all, no `pointercancel`, and a second pointerdown that
 * restarts the press. Each is the code as it shipped, restored.
 */
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-radar.mjs');
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
console.log(`CHECK 23 CONTROLS — every section of demo-radar.mjs, shown red. subject ${COMMIT.slice(0, 12)}\n`);

function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}
const QUEUE = [];
const plan = (section, label, spec) => QUEUE.push({ section, label, spec });

async function scenario(section, label, { mutate, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c23-'));
  let observed = 'GREEN', detail = '';
  try {
    for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
      if (existsSync(join(REPO, f))) copyFileSync(join(REPO, f), join(dir, f));
    }
    mkdirSync(join(dir, 'games'), { recursive: true });
    for (const g of ['blockpop.js', 'gyre.js', 'hello.js']) {
      if (existsSync(join(REPO, 'games', g))) copyFileSync(join(REPO, 'games', g), join(dir, 'games', g));
    }
    writeFileSync(join(dir, 'index.html'), mutate(readFileSync(join(dir, 'index.html'), 'utf8')));
    const out = await new Promise((res) => {
      execFile(process.execPath, [CHECK, dir, `--only=${section}`],
        { cwd: REPO, encoding: 'utf8', timeout: 300000, env: { ...process.env, PUPPAD_SUBJECT: COMMIT || 'planted' } },
        (err, so, se) => res({ code: err ? (err.code ?? 1) : 0, text: `${so}\n${se}` }));
    });
    if (out.code === 0) observed = 'GREEN';
    else if (out.text.includes(expectText)) observed = 'RED';
    else { observed = 'RED-WRONG-REASON'; detail = `wanted ${JSON.stringify(expectText)}`; }
  } catch (e) { observed = 'HARNESS-BROKE'; detail = String(e && e.message ? e.message : e).slice(0, 200); }
  finally { rmSync(dir, { recursive: true, force: true }); }
  return { section, label, observed, detail, pass: observed === 'RED' };
}

/* THE S10+ SYMPTOM, RESTORED: `contextmenu` occurred zero times in this file before the
 * fix, so removing the listener is the shipped defect exactly. */
plan(1, 'the radar stops refusing the browser menu — the shipped S10+ defect', {
  mutate: (s) => sub(s, "    radar.addEventListener('contextmenu', function(e) { e.preventDefault(); });", '    /* no suppression */'),
  expectText: 'was NOT cancelled',
});

/* AND THE OTHER DIRECTION — the flag-and-stop. A document-level suppression fixes the
 * radar and takes text selection off every adult surface with it. */
plan(1, 'the suppression is moved to the document and becomes blanket', {
  mutate: (s) => sub(s, "    radar.addEventListener('contextmenu', function(e) { e.preventDefault(); });",
    "    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });"),
  expectText: 'was also cancelled',
});

/* THE MISSING EVENT, RESTORED. This is the code as it shipped: the browser takes the
 * gesture, nothing hears it, and the timer stamps an X the child never finished. */
plan(2, 'pointercancel goes unhandled again — the shipped S25 defect', {
  mutate: (s) => sub(s, `    radar.addEventListener('pointercancel', function(e) {
      if (radarPid !== -1 && e.pointerId !== radarPid) return;
      didLongPress = false;
      endRadarPress();
    });`, '    /* unhandled */'),
  expectText: 'still stamped an X',
});

/* A FIX THAT DISABLES THE FEATURE SATISFIES EVERY "NOTHING WENT WRONG" ASSERTION. */
plan(2, 'the long press never fires at all', {
  mutate: (s) => sub(s, '      }, LONG_PRESS_MS);', '      }, 999999);'),
  expectText: 'no longer stamps an X',
});

/* THE SECOND FINGER, RESTORED: a second pointerdown reopens the press, restarts the
 * timer and moves the mark to wherever the other hand landed. */
plan(3, 'a second finger restarts the press and moves the mark', {
  mutate: (s) => sub(s, '      if (radarPid !== -1) return;\n      radarPid = e.pointerId;', '      radarPid = e.pointerId;'),
  expectText: 'X marks',
});

console.log(`  ${QUEUE.length} planted defects, run one at a time.\n`);
const results = [];
for (const q of QUEUE) results.push(await scenario(q.section, q.label, q.spec));
for (const r of results) {
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'}  ${r.observed.padEnd(17)} §${r.section}  ${r.label}`);
  if (r.detail) console.log(`        ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length} of ${results.length} planted defect(s) demonstrated red.`);
if (failed.length) {
  console.error(`\n::error::CHECK 23 CONTROLS FAILED — ${failed.length} section(s) cannot be shown catching the defect they exist for.`);
  for (const r of failed) console.error(`  §${r.section} ${r.label} — observed ${r.observed}${r.detail ? ' — ' + r.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 23 CONTROLS PASSED — ${results.length} planted defects, every one red for its own stated reason.`);
