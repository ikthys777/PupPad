#!/usr/bin/env node
/**
 * CHECK 24'S CONTROLS — every section of demo-inbound.mjs shown going RED.
 *
 * A CHECK NEVER SEEN RED IS NOT A CHECK. Each plant below REMOVES A BEHAVIOUR rather
 * than editing a string the assertion happens to read — a no-op plant reports green
 * correctly and proves nothing about the assertion.
 *
 * The plants are the defects this panel would plausibly have: the microphone left
 * running, the async grant that arrives after teardown, the shared AudioContext closed,
 * an unclamped AudioParam, a runaway feedback line, a preset that cannot be told from
 * another, a ninth button, and a cap that never fires.
 */
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(join(import.meta.dirname, '..', '..'));
const CHECK = join(REPO, '.github', 'ci', 'demo-inbound.mjs');
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
console.log(`CHECK 24 CONTROLS — every section of demo-inbound.mjs, shown red. subject ${COMMIT.slice(0, 12)}\n`);

function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}
const QUEUE = [];
const plan = (section, label, spec) => QUEUE.push({ section, label, spec });

async function scenario(section, label, { mutate, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c24-'));
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


/* §1 — THE BEACON. Removing the gate at the sink is the code as PUP-WO-0700 left it:
 * assigned rather than concatenated, which closes injection and nothing else. */
plan(1, 'the photo sink stops validating — assignment still fetches', {
  mutate: (s) => sub(s, "    var url = safeMediaUrl(payload && payload.payload && payload.payload.dataUrl, 'image');\n    if (!url) return;\n    showRemotePhoto(url);",
                        "    showRemotePhoto(payload && payload.payload && payload.payload.dataUrl);"),
  expectText: 'fetched an attacker-named origin',
});

/* §2 — A GATE THAT REFUSES EVERYTHING PASSES EVERY "hostile payload was refused"
 * ASSERTION EVER WRITTEN. Disabling the feature is not securing it. */
plan(2, 'the gate refuses all media, legitimate included', {
  mutate: (s) => sub(s, "  return re.test(raw) ? raw : '';", "  return '';"),
  expectText: 'rejects legitimate media',
});

/* AND THE KIND MUST BE ENFORCED, not merely the scheme. */
/* THE PLANT MUST STILL PASS LEGITIMATE MEDIA, or it trips §2's FIRST branch instead of
 * its kind branch. Widening BOTH arms to accept either type is the real defect shape: the
 * scheme is still enforced, the KIND is not. */
plan(2, 'the gate stops distinguishing audio from image', {
  mutate: (s) => sub(
    sub(s, "/^data:audio\\/[a-z0-9.+-]+", "/^data:(audio|image)\\/[a-z0-9.+-]+"),
    "/^data:image\\/[a-z0-9.+-]+", "/^data:(audio|image)\\/[a-z0-9.+-]+"),
  expectText: 'accepts an image where audio is expected',
});

/* §3 — THE RECEIVING HALF OF THE BOUND. The recorder-side cap bounds what this device
 * SENDS and not one byte of what it ACCEPTS. */
plan(3, 'the inbound size cap is removed', {
  mutate: (s) => sub(s, "  if (raw.length > MAX_INBOUND_BYTES) return '';", "  /* PLANT: unbounded. */"),
  expectText: 'oversized inbound payload is accepted',
});

/* §4 — THE GALLERY. Both directions: no cap at all, and a cap that evicts the WRONG END. */
plan(4, 'the gallery grows without a bound', {
  mutate: (s) => sub(s, "  while (cameraGallery.length > GALLERY_MAX) cameraGallery.shift();", "  /* PLANT: no eviction. */"),
  expectText: 'the gallery grew to',
});

plan(4, 'the gallery evicts the NEWEST instead of the oldest', {
  mutate: (s) => sub(s, "  while (cameraGallery.length > GALLERY_MAX) cameraGallery.shift();",
                        "  while (cameraGallery.length > GALLERY_MAX) cameraGallery.pop();"),
  expectText: 'evicts the NEWEST',
});

/* §5 — the three releases, each named separately so a plant cannot pass by tripping
 * another panel's assertion. */
plan(5, 'closeCamera stops releasing, and its comment still names removeChannel', {
  mutate: (s) => sub(s, "  releaseChannel(cameraChannel);\n  cameraChannel = null;", "  cameraChannel = null;"),
  expectText: 'closeCamera NEVER RELEASES',
});

plan(5, 'closeCanvas stops releasing', {
  mutate: (s) => sub(s, "  releaseChannel(canvasChannel);\n  canvasChannel = null;", "  canvasChannel = null;"),
  expectText: 'closeCanvas NEVER RELEASES',
});

plan(5, 'closeTreasureMap releases but leaves the handle set', {
  mutate: (s) => sub(s, "  releaseChannel(mapChannel);\n  mapChannel = null;", "  releaseChannel(mapChannel);"),
  expectText: 'leaves the handle set',
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
  console.error(`\n::error::CHECK 24 CONTROLS FAILED — ${failed.length} section(s) cannot be shown catching the defect they exist for.`);
  for (const r of failed) console.error(`  §${r.section} ${r.label} — observed ${r.observed}${r.detail ? ' — ' + r.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 24 CONTROLS PASSED — ${results.length} planted defects, every one red for its own stated reason.`);
