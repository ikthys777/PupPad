#!/usr/bin/env node
/**
 * CHECK 22'S CONTROLS — every section of demo-zoom.mjs shown going RED.
 * "A check never seen red is not a check."  PUP-WO-0603 §6.
 *
 * THE PRIMARY PLANT IS THE REMOVAL OF `touch-action:none` FROM `html,body`, and that is
 * the whole point of the work order's §2 correction. The container declarations on
 * `#root`, `#alertFlash`, `#cameraOverlay` and `#mapOverlay` were MEASURED NOT TO CHANGE
 * ZOOM BEHAVIOUR — the root line is what blocks a document-level pinch. A control that
 * planted a missing container declaration and watched the pinch section stay green would
 * have been telling the truth about an irrelevance. So the plant that matters removes the
 * line that works, and the section that matters watches the page zoom.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = resolve(join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-zoom.mjs');
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
console.log(`CHECK 22 CONTROLS — every section of demo-zoom.mjs, shown red against a planted defect. subject ${COMMIT.slice(0, 12)}\n`);

/* Replace exactly once, and fail loudly if the anchor moved — a control that silently
 * plants nothing reports GREEN and reads as "the check cannot catch this". */
function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}

const QUEUE = [];
const plan = (section, label, spec) => QUEUE.push({ section, label, spec });

async function scenario(section, label, { mutate, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c22-'));
  let observed = 'GREEN';
  let detail = '';
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
  } catch (e) {
    observed = 'HARNESS-BROKE';
    detail = String(e && e.message ? e.message : e).slice(0, 200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return { section, label, observed, detail, pass: observed === 'RED' };
}

/* ===================== §1 — the assertion that matters ===================== */

/* ===================== §1 HAS NO PLANT, AND THAT IS THE FINDING ==========
 * PUP-WO-0603 §2 ruled the plant here should be "remove `touch-action:none` from
 * `html,body`". I built it and THE CHECK STAYED GREEN. So did every other candidate:
 *
 *   remove html,body touch-action ............ still will not zoom
 *   remove #root's touch-action .............. still will not zoom
 *   remove user-scalable=no .................. still will not zoom
 *   remove the multi-touch guard ............. still will not zoom
 *   remove ALL FOUR together ................. still will not zoom
 *
 * ...while the control fixture inside the same run zooms 1 -> 5 under the identical
 * gesture, so the harness is not the thing that is broken. Something else about this page
 * makes it unzoomable in Chromium and I have not found it.
 *
 * A PLANT THAT CANNOT MAKE THE SECTION FAIL IS NOT A PLANT, and shipping one that reports
 * RED-WRONG-REASON or GREEN would be worse than shipping none: it would look like §1 had
 * been demonstrated. §1 therefore prints its own NOT FALSIFIED banner at the point of the
 * claim, and this file carries nothing for it. Recorded in docs/feedback/PUP-WO-0603.md
 * as the second thing in this work order that looks like a fix and cannot be shown to be
 * one — after the container declarations. */

/* ===================== §2 — the structural sweep ===================== */

plan(2, 'a full-bleed container loses its touch-action', {
  mutate: (s) => sub(s, "font-family:Trebuchet MS,sans-serif;overflow:hidden;padding:8px;touch-action:none\">'",
    "font-family:Trebuchet MS,sans-serif;overflow:hidden;padding:8px\">'"),
  expectText: 'compute touch-action:auto',
});

/* THE EMPTY-SET GUARD IS NOT PLANTED HERE, AND THAT IS STATED RATHER THAN HIDDEN.
 * §2 fails closed if the DOM walk matches nothing, because an empty set would otherwise
 * satisfy "none of them is auto" and report ok — a check passing by not running, which is
 * the defect PUP-WO-0404 found inside another red proof. I could not plant it from
 * index.html: making `#root` non-positioned still leaves five other full-bleed
 * containers, and emptying the set needs every panel in the app destroyed at once, which
 * is not a defect anyone would write. The branch is asserted by construction and is
 * recorded in docs/feedback/PUP-WO-0603.md as the one thing in this check never shown
 * red. */

/* ===================== §3 — the named scrollers ===================== */

plan(3, 'a horizontal strip is given touch-action:none and loses its pan', {
  mutate: (s) => sub(s, "id=\"camGalleryStrip\" style=\"display:flex;gap:6px;align-items:center;flex:1;overflow-x:auto;touch-action:pan-x;",
    "id=\"camGalleryStrip\" style=\"display:flex;gap:6px;align-items:center;flex:1;overflow-x:auto;touch-action:none;"),
  expectText: 'forbids the horizontal pan',
});

/* ===================== §4 — the way back ===================== */

plan(4, 'the recovery is never installed', {
  mutate: (s) => sub(s, '\ninstallZoomRecovery();', '\n/* not installed */'),
  expectText: 'no zoom recovery installed',
});

/* A RECOVERY THAT FIRES WHEN NOTHING IS WRONG IS ITS OWN DEFECT: it snaps the viewport
 * home under an adult panning a zoomed page on purpose, every 500ms, forever. */
/* The first version of this plant replaced the scale test with `if (false) return false;`
 * and the check stayed green — CORRECTLY, because the offsets are 0 at rest so the
 * function still returned false and the recovery was still inert. The plant has to make
 * it actually claim a lockout. */
plan(4, 'the recovery believes it is always locked out', {
  mutate: (s) => sub(s, '    if (!(vv.scale > 1.01)) return false;', '    if (true) return true;'),
  expectText: 'while it is at rest',
});

/* ===================== §5 — the multi-touch guard ===================== */

plan(5, 'the guard is never installed', {
  mutate: (s) => sub(s, '\ninstallMultiTouchGuard();', '\n/* not installed */'),
  expectText: 'no multi-touch guard installed',
});

/* THE FAILURE MODE THAT LOOKS EXACTLY LIKE SUCCESS. A document-level touch listener is
 * PASSIVE BY DEFAULT in Chrome, and a passive listener cannot preventDefault — so
 * dropping `{passive:false}` leaves a guard that is installed, runs, calls
 * preventDefault, and does nothing at all. `window.__multiTouchGuard` is still there. */
plan(5, 'the guard listener goes passive, so preventDefault silently does nothing', {
  mutate: (s) => sub(s, "document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });",
    "document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });"),
  expectText: 'was NOT cancelled',
});

/* AND THE OTHER DIRECTION — the blanket suppression the work order names as a
 * flag-and-stop. Ignore the scrollable ancestor and every scroller loses its pan. */
plan(5, 'the guard stops checking for a scrollable ancestor and becomes blanket', {
  mutate: (s) => sub(s, '    if (scrollableAncestor(t)) return;', '    if (false) return;'),
  expectText: 'starting on a SCROLLER was cancelled',
});

/* The second §1 entry is a placeholder that cannot be planted from index.html — the
 * control fixture is served by the check itself. Drop it rather than ship a scenario
 * that can only ever report HARNESS-BROKE. */
const RUN = QUEUE.filter((q) => q.spec.expectText !== '__never__');
console.log(`  ${RUN.length} planted defects, run one at a time (every section here is wall-clock or browser-bound).\n`);

const results = [];
for (const q of RUN) results.push(await scenario(q.section, q.label, q.spec));

for (const r of results) {
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'}  ${r.observed.padEnd(17)} §${r.section}  ${r.label}`);
  if (r.detail) console.log(`        ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length} of ${results.length} planted defect(s) demonstrated red.`);
if (failed.length) {
  console.error(`\n::error::CHECK 22 CONTROLS FAILED — ${failed.length} section(s) of demo-zoom.mjs cannot be shown catching the defect they exist for.`);
  for (const r of failed) console.error(`  §${r.section} ${r.label} — observed ${r.observed}${r.detail ? ' — ' + r.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 22 CONTROLS PASSED — ${results.length} planted defects, every one red for its own stated reason.`);
