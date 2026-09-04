#!/usr/bin/env node
/**
 * CHECK 28 — check 27's positive controls.  PUP-WO-0705 §3.
 *
 * The property under test is NOT "check 27 passes". It is **"check 27 goes RED when a
 * third-party origin arrives that nobody approved, and stays GREEN on the one that was"**.
 *
 * IT DOES NOT RESTATE THE ALLOWLIST. §1 of the work order: two copies of an allowlist
 * drift, and then one is wrong while both look authoritative. So every assertion here is
 * against check 27's own OUTPUT — its message text — never against a second copy of the
 * list it is grading.
 *
 * AND ACCEPTANCE §4 IS THE POINT OF THIS FILE: *a plant that applies is not a plant that
 * reproduces.* Each scenario asserts the mutation CHANGED THE FILE, that check 27 went
 * red, AND that it went red saying the thing it exists to say. A red for an unrelated
 * reason — a syntax error in the fixture, a browser that failed to start — is not evidence
 * that anything was caught, and this repository has shipped that mistake before.
 */
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-thirdparty.mjs');

let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 28 cannot identify the commit it is testing.');
  process.exit(1);
}

console.log(`CHECK 28 — check 27's positive controls. subject ${COMMIT.slice(0, 12)}\n`);

/* Replace exactly once and fail loudly if the anchor moved — a control that silently
 * plants nothing reports GREEN and reads as "the check cannot catch this". */
function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 60))}`);
  return src.replace(from, to);
}

const results = [];
const QUEUE = [];
const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith('--only='));
  return a ? new Set(a.slice(7).split(',').map(Number)) : null;
})();
const plan = (section, label, spec) => { if (!ONLY || ONLY.has(section)) QUEUE.push({ section, label, spec }); };

/* The whole product is copied, the mutation is applied to a COPY, and the REAL check file
 * is run against that directory — so what is graded is the shipped check, not a copy of
 * its logic. */
async function scenario(section, label, { mutate, expectText, expectGreen = false }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c27-'));
  let observed = 'GREEN';
  let detail = '';
  try {
    for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
      if (existsSync(join(REPO, f))) copyFileSync(join(REPO, f), join(dir, f));
    }
    mkdirSync(join(dir, 'games'), { recursive: true });
    for (const g of ['hello.js', 'gyre.js', 'blockpop.js']) copyFileSync(join(REPO, 'games', g), join(dir, 'games', g));

    const before = readFileSync(join(dir, 'index.html'), 'utf8');
    const after = mutate(before);
    if (after === before) throw new Error('the mutation changed nothing');
    writeFileSync(join(dir, 'index.html'), after);

    const run = await new Promise((res) => {
      execFile(process.execPath, [CHECK, dir, `--only=${section}`], {
        encoding: 'utf8', timeout: 420000, maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PUPPAD_SUBJECT: 'deadbeefcafe0' },
      }, (err, stdout, stderr) => res({ code: err ? (err.code ?? 1) : 0, out: (stdout || '') + (stderr || '') }));
    });
    observed = run.code === 0 ? 'GREEN' : 'RED';
    const wanted = expectGreen ? 'GREEN' : 'RED';
    if (observed === wanted && expectText && !run.out.includes(expectText)) {
      observed = observed + '-WRONG-REASON';
      detail = `wanted ${JSON.stringify(expectText)}`;
    }
  } catch (e) {
    observed = 'HARNESS-BROKE';
    detail = String(e && e.message ? e.message : e);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const wanted = expectGreen ? 'GREEN' : 'RED';
  return { section, label, observed, pass: observed === wanted, detail };
}

/* ---------------------------------------------------------------- *
 * §1 — A SECOND THIRD-PARTY ORIGIN MUST GO RED. This is the work order.
 * ---------------------------------------------------------------- */

/* THE PLAIN CASE: a new CDN added to the head, exactly the way the three that are already
 * there were added. This is not an exotic attack; it is how a second exception actually
 * arrives — somebody needs a library and reaches for a script tag. */
plan(1, 'a NEW third-party script on the cold-load path', {
  mutate: (s) => sub(s, '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>\n<script src="https://unpkg.com/some-lib@1/dist/x.js"></script>'),
  expectText: 'NOT on the allowlist',
});

/* AN ORIGIN REACHED ONLY AFTER A PANEL OPENS — the work order's §5 probe by name. A check
 * that only measures the cold load reports clean on this, which is why check 27 walks all
 * eight pads instead of loading the page and stopping. */
plan(1, 'a new origin reached ONLY when the Map panel opens', {
  mutate: (s) => sub(s, "  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {",
    "  try { new Image().src = 'https://telemetry.example.net/pin.gif'; } catch (e) {}\n  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {"),
  expectText: 'NOT on the allowlist',
});

/* AND ONE REACHED FROM A PANEL THE MAP IS NOT — so a check that walks only the pad whose
 * origin it cares about would miss it. */
plan(1, 'a new origin reached only when the Voice panel opens', {
  mutate: (s) => sub(s, 'function openVoice() {',
    "function openVoice() {\n  try { new Image().src = 'https://beacon.example.org/v.gif'; } catch (e) {}"),
  expectText: 'NOT on the allowlist',
});

/* THE LOOK-ALIKE. `evil-openstreetmap.org.attacker.net` CONTAINS the approved name, so an
 * allowlist written with `includes` clears it. This plants a real request to one, which is
 * the difference between asserting the predicate is anchored (§3 does that in isolation)
 * and asserting the CHECK rejects a live one. */
plan(1, 'a look-alike hostname that CONTAINS the approved name', {
  mutate: (s) => sub(s, "  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {",
    "  try { new Image().src = 'https://evil-openstreetmap.org.attacker.net/{z}/1/1.png'; } catch (e) {}\n  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {"),
  expectText: 'NOT on the allowlist',
});

/* AND THE APPROVED ORIGIN ON ITS OWN MUST STAY GREEN, or the check is not an allowlist,
 * it is a ban — and a red on approved behaviour is how a suite gets ignored, which is the
 * northstar amendment's own argument. Removing the two CDNs leaves the shipped app
 * reaching only origins that are on the list. */
plan(1, 'the shipped app, with the two CDN loads removed, is still GREEN', {
  mutate: (s) => sub(s, '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>', ''),
  expectGreen: true,
  expectText: 'every origin contacted is on the allowlist',
});

/* ---------------------------------------------------------------- *
 * §2 — THE INSTRUMENT. Both halves must be able to fail.
 * ---------------------------------------------------------------- */

/* THE ARRANGE FAILING SILENTLY — the work order's §5 probe. Break the pads and the walk
 * visits nothing; "no unapproved origin" is then true of an app nobody exercised, which
 * is exactly what a clean result looks like. §2 exists so that reports as a failure. */
plan(2, 'the pads do not respond, so the walk visits nothing', {
  mutate: (s) => sub(s, "      var id = parseInt(el.dataset.id);", "      var id = parseInt(el.dataset.id); if (id >= 0) return;"),
  expectText: 'fewer than one each',
});

/* AND THE MAP SPECIFICALLY — the one pad whose origin this check exists for. A build where
 * every other pad works and the Map does not would pass a cue count and prove nothing
 * about the basemap. */
plan(2, 'the Map panel does not open', {
  mutate: (s) => sub(s, "      if (btn.id === 1) { openTreasureMap(); return; }", "      if (btn.id === 1) { return; }"),
  expectText: 'no surface opened',
});

/* ---------------------------------------------------------------- */
{
  const src = readFileSync(join(REPO, 'index.html'), 'utf8');
  const seen = new Map();
  const problems = [];
  for (const { section, label, spec } of QUEUE) {
    let out;
    try { out = spec.mutate(src); }
    catch (e) { problems.push(`§${section} ${label} — anchor: ${String(e && e.message ? e.message : e)}`); continue; }
    if (out === src) { problems.push(`§${section} ${label} — applies and changes nothing`); continue; }
    const h = createHash('sha256').update(out).digest('hex');
    if (seen.has(h)) problems.push(`§${section} ${label} — byte-identical to ${seen.get(h)}, so one of the two proves nothing`);
    else seen.set(h, `§${section} ${label}`);
  }
  if (problems.length) {
    console.error(`\n::error::CHECK 28 — ${problems.length} plant(s) are invalid before a browser was started.`);
    for (const m of problems) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log(`  pre-flight: ${QUEUE.length} plants, every one applying to a distinct file.\n`);
  if (process.argv.includes('--dry')) process.exit(0);
}

for (const q of QUEUE) results.push(await scenario(q.section, q.label, q.spec));

for (const r of results) {
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'}  ${r.observed.padEnd(18)} §${r.section}  ${r.label}`);
  if (r.detail) console.log(`        ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length} of ${results.length} planted case(s) behaved as predicted.`);
if (!results.length) {
  console.error('\n::error::CHECK 28 asserted NOTHING.');
  process.exit(1);
}
if (failed.length) {
  console.error(`\n::error::CHECK 28 FAILED — ${failed.length} case(s) did not behave as predicted.`);
  for (const f of failed) console.error(`  §${f.section} ${f.label} — observed ${f.observed}${f.detail ? ' — ' + f.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 28 PASSED at ${COMMIT.slice(0, 12)} — ${results.length} planted cases, every one behaving as predicted: a new third-party origin goes RED whether it is reached on the cold load, only when the Map opens, or only when another panel does; a hostname that merely CONTAINS the approved name is rejected; the approved origin alone stays GREEN; and both halves of the instrument — the pad walk and the Map panel opening — go red when they stop working, so a clean result cannot come from an app nobody exercised.`);
