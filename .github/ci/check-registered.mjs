#!/usr/bin/env node
/**
 * CHECK 25 — every demonstration in .github/ci/ actually runs.  PUP-WO-0701 §6.
 *
 * WHY THIS EXISTS, AND IT IS NOT A TIDINESS RULE.
 *
 * Four check files reached `main` across three work orders WITHOUT EVER BEING ADDED TO
 * ci.yml: demo-radar, demo-radar-controls, demo-zoom, demo-zoom-controls. Each was
 * written with its controls. Each was shown RED against a planted defect. None of them
 * ran anywhere but the builder's machine, so the radar fix and the zoom hardening sat on
 * main with no CI protection at all — and two merge commits praised checks that could
 * not run.
 *
 * A MISSING CHECK AND A PASSING ONE ARE THE SAME COLOUR. That is this project's
 * passes-by-not-running defect moved up one level: from the ASSERTION, where every
 * instinct we have built is pointed, to the REGISTRATION, where none of them look. The
 * builder's own sentence in PUP-WO-0400 was "a check never seen red is not a check, AND
 * AN UNREGISTERED ONE DOES NOT RUN" — written, then violated three times without notice,
 * because skipping the step leaves no trace. Nothing fails. CI stays green.
 *
 * IT ASSERTS THE EQUALITY, NOT A LIST. A hand-maintained list of expected checks is the
 * convention wearing a check's clothes — it goes stale exactly the way ci.yml did, and
 * THE NEXT FILE SOMEONE ADDS IS THE ONE MISSING FROM BOTH. The set is derived from the
 * directory, so a file that did not exist when this was written is still graded.
 *
 * No browser, no network, no fixture: it reads two files off disk.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 25 cannot identify the commit it is testing.');
  process.exit(1);
}
console.log(`CHECK 25 — every demonstration runs. subject ${COMMIT.slice(0, 12)}\n`);

const CI = join(REPO, '.github', 'workflows', 'ci.yml');
const DIR = join(REPO, '.github', 'ci');

let yml;
try { yml = readFileSync(CI, 'utf8'); }
catch (e) {
  console.error('::error::CHECK 25 cannot read .github/workflows/ci.yml — it cannot speak to registration in either direction.');
  process.exit(1);
}

/* THE SET IS THE DIRECTORY. Every demonstration, discovered, never listed. */
const files = readdirSync(DIR).filter((f) => f.startsWith('demo-') && f.endsWith('.mjs')).sort();
if (!files.length) {
  console.error('::error::CHECK 25 found no demo-*.mjs at all — the derivation is broken, not the repo.');
  console.error('  An empty set would satisfy "all of them are registered" and report ok.');
  process.exit(1);
}

/* Registered = the file name appears ON A LINE THAT INVOKES NODE, in ci.yml, outside a
 * comment. Still matching the NAME rather than a full command line, because the invocation
 * varies — some pass `.`, some take --experimental-vm-modules — and a check that demanded
 * one spelling would fail a correct registration.
 *
 * BUT `yml.includes(f)` ALONE COUNTED A MENTION IN A COMMENT AS A REGISTRATION. That is
 * this project's own defect one level up, inside the very check built to stop it: a
 * DESCRIBED registration reading like a real one, exactly as check 24 read the word
 * `removeChannel` out of a comment describing the bug it fixed. A comment naming
 * `demo-voice.mjs` would have satisfied the check that exists to prove `demo-voice.mjs`
 * actually runs — and comments here name files constantly, because that is how this repo
 * explains itself.
 *
 * So: comment lines are dropped first, and the name must sit on a line that also invokes
 * `node`. Both halves are needed — dropping comments alone would still count a filename in
 * a step NAME, and requiring `node` alone would still count a commented-out run line. */
const runLines = yml
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .filter((line) => line.includes('node'));
const missing = files.filter((f) => !runLines.some((line) => line.includes(f)));

for (const f of files) console.log(`  ${missing.includes(f) ? 'MISSING ' : 'ok      '} ${f}`);
console.log(`\n  ${files.length - missing.length} of ${files.length} demonstration(s) registered in ci.yml.`);

if (missing.length) {
  console.error(`\n::error::CHECK 25 FAILED — ${missing.length} demonstration(s) exist and never run.`);
  console.error(`\nCHECK 25 FAILED — ${missing.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of missing) console.error(`  .github/ci/${f} is not registered in ci.yml — it runs nowhere but a builder's machine`);
  console.error('\n  A missing check and a passing one are the same colour. Add a step to ci.yml.');
  process.exit(1);
}
console.log(`\nCHECK 25 PASSED at ${COMMIT.slice(0, 12)} — all ${files.length} demonstration(s) under .github/ci/ are registered in ci.yml, derived from the directory rather than a list.`);
