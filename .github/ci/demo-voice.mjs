#!/usr/bin/env node
/**
 * CHECK 26 — the voice panel.  PUP-WO-0701 §S2, acceptance items 3, 6, 7 and 8.
 *
 * FOUR OF THESE ASSERTIONS ARE THE WORK ORDER'S FLAG-AND-STOP SURFACE, and the one it
 * says it cares most about is §8: a live microphone that outlives the panel. That cannot
 * be checked by reading closeVoice — a track is stopped or it is not, and only
 * `readyState` knows. Every section below asks the runtime, never the source text.
 *
 * §3 IS MEASURED, NOT ASSERTED. Four presets are rendered through THE SHIPPING GRAPH
 * BUILDER — window.__voice.buildGraph, the same function live playback calls — into an
 * OfflineAudioContext, and their band energies are compared. A
 * check that built its own graph would be agreeing with itself: a check that recomputes
 * the formula agrees with a WRONG formula. And the null result runs FIRST: a preset is
 * compared against ITSELF and must come out identical, because an instrument that has
 * never reported "same" has not shown it can tell the difference.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) { console.error('::error::CHECK 26 cannot identify the commit it is testing.'); process.exit(1); }
console.log(`CHECK 26 — the voice panel. subject ${COMMIT.slice(0, 12)}\n`);

const failures = [];
/* EVERY ASSERTION IS COUNTED, BECAUSE THE PASS BANNER USED TO PRINT UNCONDITIONALLY.
 * `--only` on a retired section number exited 0 having asserted NOTHING and still printed
 * "NO MICROPHONE SURVIVES TEARDOWN ... WITH EVERY PAINTED WORD HIDDEN" -- check 25's own
 * defect class one level down, in the file that reports it. */
let asserted = 0;
const ok = (m) => { asserted++; console.log(`  ok    ${m}`); };
const bad = (m, d) => { asserted++; failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const run = (n) => !ONLY || ONLY.split(',').includes(String(n));

/* MOVED OUT OF index.html BY PUP-WO-0702. It computed how long a preset's rendered output
 * runs, and its only app caller was the send render. With that gone it was a function the
 * app exported and never called — a dead limb, by the same rule that deleted the audio
 * branch of the gate. It lives here now: nothing ships that computes duration, so there is
 * no shipping formula for this check to agree with, and owning it is honest rather than
 * duplicative. The GRAPH is still driven from the app, because live playback calls it. */
function renderSeconds(buffer, presetId, value) {
  const P = { up: [0.55, 2.20], down: [0.55, 2.20], cave: [0.06, 0.40] };
  const clamp = (v, lo, hi) => (!isFinite(Number(v)) ? lo : Math.min(Math.max(Number(v), lo), hi));
  const d = buffer.duration;
  if (presetId === 'up' || presetId === 'down') return d / clamp(value, ...P.up) + 0.05;
  if (presetId === 'cave') return d + clamp(value, ...P.cave) * 8 + 0.05;
  return d + 0.05;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const f = join(REPO, u.pathname === '/' ? '/index.html' : u.pathname);
    const b = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
}).listen(0);
await new Promise((r) => server.once('listening', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* A fake microphone, granted without a prompt. Without both flags getUserMedia either
 * hangs on a permission UI that CI cannot answer or rejects outright — and a §8 that
 * never obtained a track would pass by having nothing to leak, which is the shape this
 * project has now paid for repeatedly. §8 asserts a track was OBTAINED before it asserts
 * the track was stopped. */
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 869, height: 412 }, hasTouch: true, isMobile: true,
  permissions: ['microphone'],
});
const page = await ctx.newPage();

/* A real finger: a touch that lands and lifts. A synthesised click is not a finger, and
 * every control in this panel is on wireTap precisely because of that. */
async function finger(sel) {
  /* CODE THAT PREDATES THE HELPER. §6 learned that a locator on a missing element blocks
   * and then THROWS, killing the check instead of failing a line; these two calls were
   * written before that and never revisited. Same treatment, same reason. */
  const box = await page.locator(sel).boundingBox({ timeout: 2500 }).catch(() => null);
  if (!box) throw new Error(`no box for ${sel}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
}

try {
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await page.waitForTimeout(200);

  /* ---- §1. THE DOOR, AND THE GRID THAT MUST NOT REFLOW ------------------- */
  if (run(1)) {
    const door = await page.evaluate(() => {
      const b = BTNS_LEFT.concat(BTNS_RIGHT);
      const zero = b.find((x) => x.id === 0);
      const els = document.querySelectorAll('.pad-btn');
      const tops = new Set(Array.from(els).map((e) => Math.round(e.getBoundingClientRect().top)));
      return { count: b.length, label: zero && zero.label, emoji: zero && zero.emoji,
               pads: els.length, rows: tops.size, hasOpen: typeof window.openVoice === 'function' };
    });
    if (door.count !== 8 || door.pads !== 8) bad(`the pad is no longer 4+4 — ${door.count} descriptors, ${door.pads} rendered`,
      'a ninth button re-flows the grid at a 412px CSS viewport, which is the only device that counts');
    else if (door.rows !== 4) bad(`the pad rendered ${door.rows} rows, not 4`, 'the grid reflowed');
    else if (door.emoji !== '🎤') bad(`button 0's glyph is ${JSON.stringify(door.emoji)}, not a microphone`,
      'a non-reader identifies the panel from the glyph or not at all');
    else if (!door.hasOpen) bad('openVoice does not exist');
    else ok(`button 0 is ${door.label} 🎤 and the pad is still 4+4 in 4 rows`);

    await finger('.pad-btn[data-id="0"]');
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => !!document.getElementById('voiceOverlay'));
    if (!opened) bad('a real finger on button 0 does not open the panel',
      'multi-touch and a tap that slides emit no click at all — this is what wireTap is for');
    else ok('a real finger (touch, not a synthesised click) on button 0 opens the panel');
  }

  /* ---- §2. ACCEPTANCE 3 — FOUR PRESETS, MEASURED ------------------------- */
  if (run(2)) {
    const spec = await page.evaluate(async (RS_SRC) => {
      if (!window.__voice || !window.__voice.buildGraph) return { missing: true };
      const RS = new Function('return ' + RS_SRC)();
      const SR = 24000, DUR = 0.5;
      /* A voice-like source: a fundamental and two harmonics. */
      function makeBuf(ctx) {
        const b = ctx.createBuffer(1, Math.floor(SR * DUR), SR);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
          const t = i / SR;
          d[i] = 0.5 * Math.sin(2 * Math.PI * 200 * t)
               + 0.3 * Math.sin(2 * Math.PI * 400 * t)
               + 0.2 * Math.sin(2 * Math.PI * 800 * t);
        }
        return b;
      }
      /* Goertzel band energies — a real spectral measurement, no library. */
      const BANDS = [];
      for (let f = 100; f <= 4000; f *= 1.35) BANDS.push(f);
      function spectrum(data, sr) {
        const N = Math.min(data.length, 8192);
        return BANDS.map((f) => {
          const w = 2 * Math.cos(2 * Math.PI * f / sr);
          let s1 = 0, s2 = 0;
          for (let i = 0; i < N; i++) { const s0 = data[i] + w * s1 - s2; s2 = s1; s1 = s0; }
          return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - w * s1 * s2)) / N;
        });
      }
      function cosDist(a, b) {
        let d = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        if (na <= 0 || nb <= 0) return 1;
        return 1 - d / Math.sqrt(na * nb);
      }
      /* THE PRESET SHAPE CHANGED AND THIS SILENTLY PASSED `undefined`, WHICH clampNum
       * TURNS INTO THE MINIMUM. `p.def` became `p.a.def` when PUP-WO-0703 gave each preset
       * a second axis, and every render here then used the LOW END of every range -- so up
       * and down came out spectrally IDENTICAL, distance exactly 0.0000, which is what
       * caught it. §3's sweep had the same rot and reported "36 positions" while testing
       * ONE point per preset, green. A stale field name does not throw; it becomes a
       * default, and a default is the quietest possible wrong answer. */
      async function render(id, value, valueB) {
        const probe = new OfflineAudioContext(1, 8, SR);
        const buf = makeBuf(probe);
        const secs = RS(buf, id, value);
        const off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR);
        const src = makeBuf(off);
        const g = window.__voice.buildGraph(off, src, id, value, valueB);
        g.out.connect(off.destination);
        g.source.start();
        const out = await off.startRendering();
        return { spec: spectrum(out.getChannelData(0), SR), secs: out.duration };
      }
      const ps = window.__voice.presets;
      const rendered = {};
      for (const p of ps) rendered[p.id] = await render(p.id, p.a.def, p.b.def);
      /* THE NULL RESULT, FIRST. The same preset rendered twice must come out identical;
       * an instrument that has never reported "same" cannot be trusted to report
       * "different". */
      const again = await render(ps[0].id, ps[0].a.def, ps[0].b.def);
      const nullDist = cosDist(rendered[ps[0].id].spec, again.spec);
      const pairs = [];
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        pairs.push({ a: ps[i].id, b: ps[j].id, d: cosDist(rendered[ps[i].id].spec, rendered[ps[j].id].spec) });
      }
      return { nullDist, pairs, secs: ps.map((p) => ({ id: p.id, s: rendered[p.id].secs })) };
    }, renderSeconds.toString());

    if (spec.missing) bad('window.__voice.buildGraph does not exist', 'the check cannot drive the shipping graph');
    else {
      const NULL_MAX = 1e-9, DIST_MIN = 0.02;
      if (!(spec.nullDist <= NULL_MAX)) bad(`the instrument cannot report SAME — a preset differs from itself by ${spec.nullDist.toExponential(2)}`,
        'every "different" below is then meaningless; the measurement is noise, not a spectrum');
      else ok(`null result first: a preset rendered twice is identical (distance ${spec.nullDist.toExponential(2)})`);
      const same = spec.pairs.filter((p) => p.d < DIST_MIN);
      if (same.length) bad(`${same.length} preset pair(s) are NOT audibly distinct`,
        same.map((p) => `${p.a} vs ${p.b}: spectral distance ${p.d.toFixed(4)} < ${DIST_MIN}`).join(' | '));
      else {
        ok(`all ${spec.pairs.length} preset pairs differ spectrally (min ${Math.min(...spec.pairs.map((p) => p.d)).toFixed(3)}) — rendered through the SHIPPING graph builder`);
        /* WHAT THIS SECTION DOES NOT SHOW, SAID OUT LOUD RATHER THAN IMPLIED BY ITS PASS
         * LINE. Each preset is rendered at its DEFAULT slider value only. A 13-band
         * Goertzel on a 200/400/800 Hz source cannot resolve ring-modulation frequency or
         * delay time, so sweeping robot or cave across their own ranges registers as
         * "same" by this instrument's own criterion -- which is a limit of the instrument,
         * not evidence about the sound. Acceptance item 3 is proven at four points of a
         * continuous two-dimensional space, and item 5 (a human who has not seen the app)
         * is the thing that can speak to the rest. */
        console.log('        (proven at the four DEFAULT slider values only — this instrument cannot resolve ring frequency or delay time; see item 5)');
      }
    }
  }

  /* ---- §3. THE CLAMPS — a child's ears --------------------------------- */
  if (run(3)) {
    const cl = await page.evaluate(async () => {
      const off = new OfflineAudioContext(1, 128, 24000);
      const buf = off.createBuffer(1, 64, 24000);
      /* BOTH AXES, because PUP-WO-0703 added a second slider to every preset and a bound
       * that nothing probes is a bound nothing keeps. */
      /* READ BY NAME, WHICH IS NEITHER A VALUE FILTER NOR A POSITION.
       *
       * These once selected the node with a heuristic on its own gain -- `> 0 && < 0.5`
       * for cave's wet -- so AN UNCLAMPED VALUE FELL OUTSIDE THE FILTER AND WAS NEVER
       * READ: the probe skipped the very node the plant had broken and reported clean.
       * The repair was to read by POSITION, and position is the same defect in a different
       * hat: reordering cave's `nodes.push` is an ordinary refactor that changes no
       * behaviour and silently repoints `nodes[length - 1]` at the DRY gain, whose value
       * sits comfortably inside wet's bound. `buildVoiceGraph` now returns its parameters
       * by name and they are selected by identity, which a refactor cannot redirect.
       *
       * `lo`/`hi` ARE THE SPECIFICATION AND `key` IS WHAT MAKES THAT HONEST. They are
       * pinned literals, not conveniences -- and one of them had already drifted: this row
       * allowed cave's wet up to 0.50 while the app's derived headroom ceiling is 0.45, so
       * RAISING CAVE_WET_MAX BY 11% WAS GREEN SUITE-WIDE (the peak sweep does not catch it
       * either: 0.50 + 0.50/0.55 = 1.41 against a 0.70 source is 0.99, still under 1).
       * `key` names the bound the app exports, and the drift assertion below fails when
       * the pin and the app disagree. Two expressions that must agree, and now asked to. */
      const probes = [
        { id: 'up', v: 1e6, b: 3000, read: (g) => g.params.rate.value, key: 'rate', lo: 0.55, hi: 2.2 },
        { id: 'down', v: -1e6, b: 3000, read: (g) => g.params.rate.value, key: 'rate', lo: 0.55, hi: 2.2 },
        { id: 'up', v: NaN, b: NaN, read: (g) => g.params.rate.value, key: 'rate', lo: 0.55, hi: 2.2 },
        { id: 'up', v: 1.5, b: 1e9, read: (g) => g.params.tone.value, key: 'tone', lo: 700, hi: 8000 },
        { id: 'down', v: 0.8, b: -5, read: (g) => g.params.tone.value, key: 'tone', lo: 700, hi: 8000 },
        { id: 'robot', v: 1e9, b: 0.5, read: (g) => g.params.ringHz.value, key: 'ringHz', lo: 20, hi: 220 },
        { id: 'robot', v: 70, b: 1e6, read: (g) => g.params.depth.value, key: 'depth', lo: 0.25, hi: 1.0 },
        { id: 'cave', v: 99, b: 0.3, read: (g) => g.params.delay.value, key: 'delay', lo: 0.06, hi: 0.40 },
        { id: 'cave', v: 0.2, b: 99, read: (g) => g.params.wet.value, key: 'wet', lo: 0.05, hi: 0.45 },
      ];
      const out = [];
      for (const p of probes) {
        /* AN UNCLAMPED VALUE DOES NOT ALWAYS COME BACK AS A NUMBER -- it can be REFUSED.
         * Setting a non-finite value on an AudioParam THROWS, so a build with no clamp
         * killed this check with an uncaught TypeError instead of failing it: a stack
         * trace where a FAIL line belonged. A throw here IS the defect, so it is caught
         * and recorded as one rather than allowed to take the process down. */
        let got, threw = null;
        try {
          const g = window.__voice.buildGraph(off, buf, p.id, p.v, p.b);
          got = p.read(g);
        } catch (e) { threw = String((e && e.message) || e); }
        if (threw) { out.push({ id: p.id, v: String(p.v), got: 'THREW: ' + threw, inside: false }); continue; }
        /* AN AudioParam STORES float32, SO AN EXACT BOUND DOES NOT READ BACK EXACTLY.
         * A correct clamp to 2.2 reads 2.200000047683716 — 4.8e-8 over — and a 1e-9
         * tolerance failed a build whose clamp was working. The tolerance is a property
         * of the storage, not of the clamp; 1e-6 is far below any audible difference and
         * far above float32's error at these magnitudes. */
        const EPS = 1e-6;
        out.push({ id: p.id, v: String(p.v), got, inside: got >= p.lo - EPS && got <= p.hi + EPS });
      }
      /* The cave feedback gain is a CONSTANT below 1 and must not be reachable from any
       * slider: a feedback line at >= 1 never decays and does not stop when the clip does. */
      const cg = window.__voice.buildGraph(off, buf, 'cave', 0.2, 0.35);
      const fb = [cg.params.feedback.value];
      /* THE PIN AGAINST THE APP. Every lo/hi above is a copy of a constant the app owns;
       * a copy that is never compared is a copy that drifts. */
      const B = window.__voice.bounds || {};
      const drift = [];
      for (const p of probes) {
        const b = B[p.key];
        if (!b) { drift.push(`${p.key}: the app exports no such bound`); continue; }
        if (b[0] !== p.lo || b[1] !== p.hi) drift.push(`${p.key}: app [${b[0]}, ${b[1]}] vs pinned [${p.lo}, ${p.hi}]`);
      }
      return { out, fb, drift: [...new Set(drift)] };
    });
    if (cl.drift.length) bad(`${cl.drift.length} clamp bound(s) have DRIFTED from the app's own constants`,
      cl.drift.join(' | ') + " — the probe's literal is the specification; when the app moves, this line is the only thing that says so");
    else ok(`all ${cl.out.length} clamp bounds still match the constants the app clamps with`);
    const escaped = cl.out.filter((p) => !p.inside);
    if (escaped.length) bad(`${escaped.length} absurd value(s) reached an AudioParam unclamped`,
      escaped.map((p) => `${p.id}(${p.v}) -> ${p.got}`).join(' | '));
    else ok(`absurd, negative and NaN values are all clamped before reaching an AudioParam`);
    if (cl.fb.some((v) => v >= 1)) bad(`a feedback gain is ${Math.max(...cl.fb)} — a delay line that never decays`,
      'it grows until it clips and it does not stop when the clip ends');
    else ok(`the cave feedback gain stays below 1 (${cl.fb.map((v) => v.toFixed(2)).join(', ')}) — the delay line decays`);

    /* HEADROOM IS NOT DECAY, AND ASSERTING THE FEEDBACK CONSTANT CHECKED ONLY ONE OF THEM.
     * A bounded feedback gain guarantees the tail dies and says nothing about how loud the
     * SUM of dry and every echo gets. Measured on the first build: peak 1.78 against a 0.70
     * source, clipping on seven of nine cave slider positions. Swept across every preset's
     * whole range, because "a number is only correct at the value it was measured at". */
    const peaks = await page.evaluate(async (RS_SRC) => {
      const RS = new Function('return ' + RS_SRC)();
      const SR = 24000, DUR = 0.4;
      const out = [];
      /* THE FULL NEW GRID, NOT THE OLD ONE. Two axes per preset means the peak has to
       * stay below 1 across their PRODUCT, not along one edge of it -- and the old sweep
       * was reading `p.min`/`p.max`, which no longer exist, so every position collapsed to
       * the same clamped minimum and "36 positions" was one position tested 9 times. */
      for (const p of window.__voice.presets) {
        for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) {
          const v = p.a.min + (p.a.max - p.a.min) * (i / 5);
          const vb = p.b.min + (p.b.max - p.b.min) * (j / 5);
          const probe = new OfflineAudioContext(1, 8, SR);
          const mk = (c) => { const b = c.createBuffer(1, Math.floor(SR * DUR), SR); const d = b.getChannelData(0);
            for (let k = 0; k < d.length; k++) { const t = k / SR;
              d[k] = 0.5 * Math.sin(2 * Math.PI * 200 * t) + 0.3 * Math.sin(2 * Math.PI * 400 * t) + 0.2 * Math.sin(2 * Math.PI * 800 * t); }
            return b; };
          const secs = RS(mk(probe), p.id, v);
          const off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR);
          const g = window.__voice.buildGraph(off, mk(off), p.id, v, vb);
          g.out.connect(off.destination); g.source.start();
          const r = await off.startRendering();
          const d = r.getChannelData(0);
          let pk = 0, sum = 0;
          for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > pk) pk = a; sum += d[k] * d[k]; }
          out.push({ id: p.id, v: Number(v.toFixed(3)), b: Number(vb.toFixed(3)), peak: pk, rms: Math.sqrt(sum / d.length) });
        }
      }
      return out;
    }, renderSeconds.toString());
    const clipped = peaks.filter((x) => x.peak > 1);
    const silent = peaks.filter((x) => x.rms < 0.005);
    if (clipped.length) bad(`${clipped.length} of ${peaks.length} preset/slider positions CLIP (peak > 1)`,
      clipped.slice(0, 4).map((x) => `${x.id}@${x.v}/${x.b} peak ${x.peak.toFixed(2)}`).join(' | ') + ' — hard clipping is a buzz in a child\'s ear');
    else if (silent.length) bad(`${silent.length} position(s) are effectively SILENT`,
      silent.slice(0, 4).map((x) => `${x.id}@${x.v}/${x.b} rms ${x.rms.toFixed(4)}`).join(' | '));
    else ok(`no clipping and no silence at any of ${peaks.length} preset/slider positions (worst peak ${Math.max(...peaks.map((x) => x.peak)).toFixed(2)})`);
  }

  /* ---- §4. ACCEPTANCE 8 — NO MICROPHONE SURVIVES TEARDOWN --------------- */
  if (run(4)) {
    await page.evaluate(() => { if (!document.getElementById('voiceOverlay')) openVoice(); });
    await page.waitForTimeout(150);
    await finger('#voiceRecBtn');
    await page.waitForTimeout(700);

    const during = await page.evaluate(() => window.__voice.state());
    if (during.liveTracks < 1) {
      bad('no microphone track was ever obtained, so this section proves NOTHING',
        `recorder=${during.recorder} liveTracks=${during.liveTracks} — a §8 that never opened a microphone passes by having nothing to leak`);
    } else {
      ok(`a live microphone track exists while recording (${during.liveTracks}) — the instrument can see the thing it is about to look for`);
      /* Torn down MID-RECORD, which is the state the work order names. */
      const after = await page.evaluate(async () => {
        const s = window.voiceStream;
        const tracks = s ? s.getTracks() : [];
        /* THE CONTEXT'S IDENTITY, CAPTURED BEFORE TEARDOWN -- and this is the only thing
         * that can see the defect.
         *
         * A plant that called audioCtx.close() left this section GREEN, reporting a
         * "running" context, and the reason is the self-healing: closeVoice ends with
         * doSound('blip'), doSound reaches getAudioCtx(), and getAudioCtx RE-CREATES on
         * state === 'closed'. So a moment later the global holds a brand-new running
         * context and every state string agrees that all is well.
         *
         * THE SHELL HEALS AND THE DAMAGE IS ELSEWHERE: every node still connected to the
         * OLD context died with it, including a clip mid-playback. That is unobservable
         * from the new object, so the assertion is the OLD one -- same object, not
         * closed. */
        const before = audioCtx;
        closeVoice();
        /* AudioContext.close() RESOLVES ASYNCHRONOUSLY, so reading `state` on the very
         * next line can still say "running" about a context that is on its way out --
         * and a plant that closed it went GREEN here for exactly that reason. Settle
         * first, then ask; and then ask the question that actually matters, which is not
         * what the state string says but WHETHER THE CONTEXT STILL WORKS. */
        await new Promise((r) => setTimeout(r, 120));
        let usable = false;
        try { const n = before.createGain(); n.disconnect(); usable = true; } catch (e) { usable = false; }
        return {
          state: window.__voice.state(),
          usable,
          sameCtx: audioCtx === before,
          beforeState: before ? before.state : 'none',
          stillLive: tracks.filter((t) => t.readyState === 'live').length,
          held: tracks.length,
        };
      });
      if (after.stillLive > 0) bad(`${after.stillLive} of ${after.held} microphone track(s) SURVIVED teardown`,
        'dropping the reference does not turn a microphone off; the recording indicator stays lit and nothing holds a handle to stop it');
      else ok(`every microphone track is stopped by teardown mid-record (${after.held} track(s), 0 live)`);
      if (after.state.recorder) bad('the MediaRecorder survived teardown');
      if (after.state.open) bad('the panel is still in the DOM after closeVoice');
      if (after.beforeState === 'closed' || !after.usable || !after.sameCtx)
        bad(`the SHARED AudioContext did not survive teardown (was ${after.beforeState}, same object ${after.sameCtx}, still usable ${after.usable})`,
          'every node still connected to it died with it, including a clip mid-playback — and getAudioCtx re-creating on close means the state string reports "running" about a REPLACEMENT');
      else ok(`the shared AudioContext survived teardown — same object, still ${after.beforeState}, still builds nodes`);
    }
  }

  /* ---- §5. THE RACE: closed while getUserMedia is still pending --------- */
  if (run(5)) {
    const raced = await page.evaluate(async () => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let captured = null;
      /* Delay the grant so the panel can be closed underneath it — the window in which
       * closeVoice cannot stop a track because the track does not exist yet. */
      navigator.mediaDevices.getUserMedia = (c) => real(c).then((s) => {
        captured = s;
        return new Promise((r) => setTimeout(() => r(s), 400));
      });
      try {
        openVoice();
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 60));
        closeVoice();
        await new Promise((r) => setTimeout(r, 900));
        return captured ? { got: true, live: captured.getTracks().filter((t) => t.readyState === 'live').length } : { got: false };
      } finally { navigator.mediaDevices.getUserMedia = real; }
    });
    if (!raced.got) bad('the race could not be staged — getUserMedia never resolved', 'this section proved nothing');
    else if (raced.live > 0) bad(`${raced.live} microphone track(s) LIVE after closing the panel mid-request`,
      'getUserMedia resolves asynchronously: closeVoice ran before the track existed, so the only place this can be caught is on arrival');
    else ok('a microphone granted AFTER the panel closed is stopped on arrival — no track outlives the panel');
  }

  /* ---- §6. ACCEPTANCE 6 — ONE TAP BACK FROM EVERY STATE ----------------- */
  if (run(6)) {
    const states = [
      ['idle', async () => {}],
      ['mid-record', async () => { await finger('#voiceRecBtn'); await page.waitForTimeout(500); }],
      ['mid-playback', async () => {
        await finger('#voiceRecBtn'); await page.waitForTimeout(600);
        await finger('#voiceRecBtn'); await page.waitForTimeout(900);
        await finger('#voicePlayBtn'); await page.waitForTimeout(120);
      }],
    ];
    for (const [name, setup] of states) {
      await page.evaluate(() => { if (!document.getElementById('voiceOverlay')) openVoice(); });
      await page.waitForTimeout(150);
      await setup();
      /* A LOCATOR WAITS. `locator('#voiceBack').boundingBox()` on an exit that is not
       * there blocks for the default timeout and then THROWS -- which killed the whole
       * check instead of failing this line, so a plant that removed the exit came back
       * "red for the wrong reason". A missing exit is the defect this section exists for;
       * it has to be an assertion, not an exception. */
      const box = await page.locator('#voiceBack').boundingBox({ timeout: 2500 }).catch(() => null);
      if (!box) { bad(`the exit is not present in ${name}`, 'there is no way back from this state'); continue; }
      if (box.width < 44 || box.height < 44) bad(`the exit is ${box.width}x${box.height} in ${name}`, 'the hit box must stay 44px+');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => window.__voice.state());
      if (st.open) bad(`ONE TAP with a finger does not leave the panel in ${name}`);
      else if (st.liveTracks > 0) bad(`leaving in ${name} left ${st.liveTracks} live microphone track(s)`);
      else ok(`one finger tap on the exit leaves the panel from ${name} (nodes ${st.nodes}, tracks ${st.liveTracks})`);
    }
  }

  /* ---- §7. THE HARD STOP, AND THE BOUND THAT IS NOT THE BACKSTOP -------- */
  if (run(7)) {
    const nums = await page.evaluate(() => ({
      rec: window.MAX_RECORD_MS, inbound: window.MAX_INBOUND_BYTES,
      audio: window.MAX_INBOUND_AUDIO_BYTES, secs: window.MAX_INBOUND_SECONDS,
    }));
    /* THE AUDIO CAPS ARE GONE AND THIS SECTION MUST SAY SO RATHER THAN QUIETLY SHRINK.
     * PUP-WO-0702 removed the voice transport, so MAX_INBOUND_AUDIO_BYTES and
     * MAX_INBOUND_SECONDS have no subject. A check that simply stopped mentioning them
     * would pass because ITS SUBJECT IS GONE rather than because a property holds --
     * which is the exact failure the work order names. So their ABSENCE is asserted. */
    if (nums.audio !== undefined || nums.secs !== undefined)
      bad('the inbound audio caps still exist after the transport was removed',
        `MAX_INBOUND_AUDIO_BYTES=${nums.audio}, MAX_INBOUND_SECONDS=${nums.secs} — a bound with no subject is a limb a future reader treats as live`);
    else ok('the inbound audio caps are gone with the transport they bounded');
    /* THE ASSERTION FOR "A REQUIREMENT AND ITS BACKSTOP MUST NOT BE THE SAME NUMBER" COULD
     * NOT FIRE. It was an `else if` behind `rec !== 15000`, so reaching it required
     * rec === 15000 AND rec === inbound — i.e. MAX_INBOUND_BYTES === 15000, which it never
     * is. The one place this repo checks its own most-repeated rule was unfalsifiable, and
     * its plant demonstrated the OTHER branch. Independent assertions now, and each named
     * value is asserted rather than merely printed: MAX_INBOUND_BYTES was interpolated
     * into the pass line without being checked, so deleting it read "is undefined bytes"
     * and still passed. */
    const named = [['MAX_RECORD_MS', nums.rec], ['MAX_INBOUND_BYTES', nums.inbound]];
    const missing = named.filter(([, v]) => typeof v !== 'number' || !isFinite(v) || v <= 0);
    if (missing.length) bad(`${missing.length} bound(s) are not live numbers`, missing.map(([n, v]) => `${n}=${v}`).join(', '));
    else ok(`both surviving bounds are live numbers: ${named.map(([n, v]) => `${n}=${v}`).join(', ')}`);

    if (nums.rec !== 15000) bad(`MAX_RECORD_MS is ${nums.rec}, not 15000`);
    else ok('MAX_RECORD_MS is 15000 — the recording requirement');
    if (nums.rec === nums.inbound) bad('the recording cap and the inbound photo cap are the SAME NUMBER',
      'a duration and a size must fail differently; one derived from the other is one guard wearing two hats');
    else ok(`the two remaining caps are independent: a ${nums.rec} ms recording duration and a ${nums.inbound} B inbound photo cap`);

    /* The mechanism, at a shortened value, because a three-year-old holding the button
     * is exactly the case a 15-second CI wait would test. The CONSTANT is asserted above;
     * this asserts the TIMER actually stops the recorder without anyone lifting a finger. */
    const stopped = await page.evaluate(async () => {
      const real = window.MAX_RECORD_MS;
      window.MAX_RECORD_MS = 350;
      try {
        if (!document.getElementById('voiceOverlay')) openVoice();
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 300));
        const mid = window.__voice.state().recorder;
        await new Promise((r) => setTimeout(r, 900));
        const end = window.__voice.state();
        return { mid, recorder: end.recorder, live: end.liveTracks, stage: end.stage };
      } finally { window.MAX_RECORD_MS = real; }
    });
    if (!stopped.mid) bad('the recorder was not running before the timer was due', 'this section proved nothing');
    else if (stopped.recorder) bad('the recorder is STILL RUNNING past its own cap', 'nobody lifted a finger, which is exactly the case the cap exists for');
    else if (stopped.live > 0) bad(`the timed stop left ${stopped.live} live microphone track(s)`);
    else ok(`the recorder was running, then stopped by its own timer with nobody lifting a finger (stage now ${stopped.stage}, 0 live tracks)`);
    await page.evaluate(() => closeVoice());
  }

  /* ---- §8. ACCEPTANCE 6 — CONFIGURED AND UNCONFIGURED MUST BE IDENTICAL --
   *
   * THIS EQUALITY IS THE PROPERTY THIS WORK ORDER BUYS. Before, Supabase-unconfigured
   * meant a DEGRADED voice panel: it opened and recorded but could not send. Now there is
   * nothing to degrade, so the two configurations must be INDISTINGUISHABLE — and that is
   * a far stronger statement than "it does not throw".
   *
   * It is asserted by RUNNING THE SAME SCRIPT TWICE and comparing the observable state,
   * rather than by asserting a list of things that should be absent. A list is a list of
   * the ones someone thought of. */
  if (run(8)) {
    const scenario = async (unconfigured) => page.evaluate(async (off) => {
      const realGet = window.getSupabaseClient, realCfg = window.isSupabaseConfigured;
      /* BOTH SIDES ARE STUBBED, and that is the fix rather than tidiness. Only the
       * unconfigured side used to be forced, so the "configured" run used whatever CI
       * happened to have — which is nothing. Two unconfigured runs are identical for a
       * reason that has nothing to do with the property, and a plant that added a
       * configured-only control stayed green because the control never appeared in
       * either run. AN EQUALITY BETWEEN TWO COPIES OF THE SAME STATE PROVES NOTHING. */
      if (off) { window.getSupabaseClient = () => null; window.isSupabaseConfigured = () => false; }
      else {
        window.isSupabaseConfigured = () => true;
        window.getSupabaseClient = () => ({
          channel: () => ({ on() { return this; }, subscribe() { return this; }, send() {} }),
          removeChannel() {},
        });
      }
      try {
        closeVoice();
        openVoice();
        const opened = window.__voice.state();
        const b = document.getElementById('voiceRecBtn');
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 900));
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 900));
        const recorded = window.__voice.state();
        let threw = null;
        try { playVoice(); } catch (e) { threw = String((e && e.message) || e); }
        await new Promise((r) => setTimeout(r, 200));
        const playing = window.__voice.state().nodes > 0;
        const controls = Array.from(document.querySelectorAll('#voiceOverlay button')).map((el) => el.id || el.className).sort();
        closeVoice();
        return { opened: opened.open, stage: recorded.stage, playing, controls, threw };
      } finally { window.getSupabaseClient = realGet; window.isSupabaseConfigured = realCfg; }
    }, unconfigured);

    const on = await scenario(false);
    const off = await scenario(true);
    if (!on.opened || !off.opened) bad(`the panel did not open (configured ${on.opened}, unconfigured ${off.opened})`);
    else if (on.stage !== 'ready' || off.stage !== 'ready')
      bad(`recording did not complete in both configurations (configured ${on.stage}, unconfigured ${off.stage})`,
        'this section proved nothing');
    else if (on.threw || off.threw) bad('playback threw', on.threw || off.threw);
    else if (JSON.stringify(on) !== JSON.stringify(off))
      bad('the voice panel BEHAVES DIFFERENTLY with Supabase unconfigured',
        `configured ${JSON.stringify(on)} vs unconfigured ${JSON.stringify(off)} — the whole point of removing the transport is that this difference cannot exist`);
    else ok(`the voice panel is INDISTINGUISHABLE configured and unconfigured — same controls (${on.controls.join(', ')}), records, plays back`);
  }

  /* ---- §9. INVARIANT 1 — four glyphs a non-reader can tell apart -------- */
  if (run(9)) {
    const g = await page.evaluate(() => {
      const ps = window.__voice.presets;
      return { icons: ps.map((p) => p.icon), ids: ps.map((p) => p.id),
               labels: ps.map((p) => p.label), n: ps.length };
    });
    const uniq = new Set(g.icons);
    if (g.n < 4) bad(`only ${g.n} presets`);
    else if (uniq.size !== g.icons.length) bad('two presets share a glyph', JSON.stringify(g.icons));
    else {
      ok(`${g.n} presets, ${uniq.size} distinct code points, no word painted at the child (aria only: ${g.labels.join(', ')})`);

      /* STRING INEQUALITY IS NOT VISUAL DISTINCTNESS, AND INVARIANT 1 IS ABOUT WHAT A
       * NON-READER SEES. `new Set(icons).size` would pass 🐕 against 🐶 — the exact pair
       * the design says it exists to avoid — and it would pass four glyphs that all render
       * as the SAME EMPTY BOX on a device whose font lacks them. So the glyphs are drawn
       * and the PIXELS compared.
       *
       * AND THE INSTRUMENT DECLARES WHETHER IT CAN SEE. A deliberate never-a-glyph control
       * (U+10FFFF, unassigned, guaranteed to render as the missing-glyph box) is drawn
       * alongside. If every preset matches that box, this machine has no emoji font and
       * the comparison is meaningless — which is reported as UNRESOLVED, not as a pass and
       * not as a failure. THIS CI CONTAINER IS SUCH A MACHINE: every glyph already
       * shipping on the console pad renders as a box here too, so a red would be about
       * fontconfig and nothing else. */
      const pix = await page.evaluate((icons) => {
        const PAD = (typeof BTNS_LEFT !== 'undefined')
          ? BTNS_LEFT.concat(BTNS_RIGHT).map((b) => b.emoji) : [];
        const draw = (ch) => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const x = c.getContext('2d');
          x.clearRect(0, 0, 64, 64);
          x.font = '44px sans-serif';
          x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(ch, 32, 32);
          return Array.from(x.getImageData(0, 0, 64, 64).data).join(',');
        };
        const tofu = draw('\u{10FFFF}');
        return { shots: icons.map(draw), tofu, pad: PAD.map(draw) };
      }, g.icons);

      /* THE BASELINE IS THE APP'S OWN SHIPPING GLYPHS, NOT AN ABSOLUTE.
       *
       * The eight console-pad emoji are in daily use on the fleet and are not in dispute.
       * If THEY do not render here, this machine's font set is not the fleet's and nothing
       * it says about glyphs is evidence -- a red would be about fontconfig. So the pad is
       * the control, and it decides whether this section can speak at all. AN INSTRUMENT
       * MUST DEMONSTRATE IT WOULD HAVE SEEN THE THING. */
      const padTofu = pix.pad.filter((h) => h === pix.tofu).length;
      const asTofu = pix.shots.filter((h) => h === pix.tofu).length;
      /* A MISSING BASELINE IS NOT A LICENCE TO JUDGE. `PAD` falls back to [] when
       * BTNS_LEFT is not there, and an empty baseline has padTofu === 0 — which read as
       * "this machine's fonts are fine, go ahead and rule". A control that could not be
       * taken must abstain exactly as a failed one does.
       *
       * And the gate is `=== pad.length`, not `> 0`: one unusual glyph on an otherwise
       * fully-fonted machine should not switch the comparison off. Partial coverage is
       * its own answer and is reported as such. */
      if (!pix.pad.length) {
        console.log('  ----  UNRESOLVED: the baseline could not be taken — BTNS_LEFT was not readable,');
        console.log('        so there is nothing to say whether this machine can render glyphs at all.');
      } else if (padTofu === pix.pad.length) {
        console.log(`  ----  UNRESOLVED: ${padTofu} of ${pix.pad.length} glyphs ALREADY SHIPPING on the console pad`);
        console.log(`        render as the missing-glyph box on this machine, so its font set is not the fleet's.`);
        console.log(`        (${pix.shots.length - asTofu} of ${pix.shots.length} preset glyphs did render here — information, not a verdict.)`);
        console.log('        A red here would be about fontconfig. Acceptance item 5 — a person who has not seen');
        console.log('        the app, on the fleet — is what settles glyph identifiability.');
      } else if (padTofu > 0) {
        console.log(`  ----  UNRESOLVED: ${padTofu} of ${pix.pad.length} shipping pad glyphs render as boxes here —`);
        console.log('        partial font coverage, so this machine cannot speak to glyph distinctness either.');
      } else if (asTofu > 0) {
        bad(`${asTofu} of ${pix.shots.length} preset glyphs render as an empty box on a machine whose pad glyphs ALL render`,
          'a preset a non-reader cannot see is not a preset, and here it is not even a shape');
      } else {
        const dupes = pix.shots.length - new Set(pix.shots).size;
        if (dupes) bad(`${dupes} preset glyph(s) render IDENTICALLY despite differing code points`,
          'string inequality is not visual distinctness — this is the 🐕-against-🐶 case');
        else ok(`all ${pix.shots.length} preset glyphs render as visually distinct bitmaps`);
      }
    }
  }

  /* ---- §10. THE SLIDER PAINTS WHERE IT VALUES -------------------------- */
  if (run(10)) {
    await page.evaluate(() => { if (!document.getElementById('voiceOverlay')) openVoice(); });
    await page.waitForTimeout(150);
    const box = await page.locator('#voiceSlider').boundingBox({ timeout: 2500 }).catch(() => null);
    if (!box) bad('there is no slider');
    else {
      const frac = 0.75;
      await page.touchscreen.tap(box.x + box.width * frac, box.y + box.height / 2);
      await page.waitForTimeout(200);
      /* AIM BY OBSERVATION, NOT BY PREDICTION.
       *
       * The first version of this compared the painted percentage against the value's
       * percentage -- and those are THE SAME NUMBER, because the paint is computed FROM
       * the value. It agreed with itself under every plant, including one that
       * deliberately read the wrong box. A check that recomputes the formula agrees with
       * a wrong formula.
       *
       * So the assertion is now the KNOB'S ACTUAL PIXELS against WHERE THE FINGER LANDED
       * -- two things measured independently, neither derived from the other. That is
       * the property a child experiences: the marker sits under the thumb. */
      const s = await page.evaluate(() => {
        const t = document.getElementById('voiceSlider');
        const knob = t.lastChild;
        const p = window.__voice.presets.find((x) => x.id === window.__voice.state().preset);
        const kr = knob.getBoundingClientRect();
        return { knobX: kr.left + kr.width / 2, v: Number(t.getAttribute('aria-valuenow')), lo: p.a.min, hi: p.a.max };
      });
      const tapX = box.x + box.width * frac;
      const drift = Math.abs(s.knobX - tapX);
      /* 1.5px, AND BOTH ENDS OF THAT WERE MEASURED RATHER THAN RECALLED. The correct
       * build lands at 0.0px; the planted border-box read lands at exactly 4.0px. The
       * first threshold here was 4 -- taken from the prose "up to 4px" in buildSlider's
       * comment -- and it let the plant through by a hair, because a number quoted from
       * another measurement is not a measurement. */
      if (drift > 1.5) bad(`the knob settled ${drift.toFixed(1)}px from the finger`,
        `tapped x=${tapX.toFixed(1)}, knob centre x=${s.knobX.toFixed(1)} — the marker is not under the thumb`);
      else if (s.v < s.lo || s.v > s.hi) bad(`the slider produced ${s.v}, outside [${s.lo}, ${s.hi}]`);
      else ok(`a finger at 75% of the track leaves the knob ${drift.toFixed(1)}px from where it landed, value ${s.v.toFixed(3)}`);
      await page.evaluate(() => closeVoice());
    }
  }
  /* ---- §12. THE ORPHANED MICROPHONE -------------------------------------
   *
   * THE STATE REPORTER CANNOT SEE THIS AND NEITHER COULD §4 OR §5. `state().liveTracks`
   * reads `voiceStream` -- the SURVIVING reference -- and an orphan is by definition a
   * stream that variable no longer points at. It reported 0 while four microphones were
   * live. So this section holds EVERY stream getUserMedia ever handed out and asks the
   * TRACKS, which are the only witnesses that cannot be orphaned.
   *
   * The gesture is the ordinary one: the child taps the microphone, nothing on screen
   * changes yet because the grant has not landed, so he taps again. On first use a parent
   * is reading the permission bubble and he taps five times. */
  if (run(12)) {
    for (const [label, taps, delayMs] of [['two taps', 2, 300], ['five taps during a permission prompt', 5, 1200]]) {
      const r = await page.evaluate(async ({ taps, delayMs }) => {
        const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        const all = [];
        navigator.mediaDevices.getUserMedia = (c) => real(c).then((st) => {
          all.push(st);
          return new Promise((res) => setTimeout(() => res(st), delayMs));
        });
        try {
          closeVoice(); openVoice();
          const b = document.getElementById('voiceRecBtn');
          for (let i = 0; i < taps; i++) {
            b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            await new Promise((r2) => setTimeout(r2, 40));
          }
          await new Promise((r2) => setTimeout(r2, delayMs + 500));
          closeVoice();
          await new Promise((r2) => setTimeout(r2, 500));
          return {
            granted: all.length,
            liveAfterClose: all.reduce((n, st) => n + st.getTracks().filter((t) => t.readyState === 'live').length, 0),
            reported: window.__voice.state().liveTracks,
          };
        } finally { navigator.mediaDevices.getUserMedia = real; }
      }, { taps, delayMs });

      if (!r.granted) bad(`${label}: no microphone was granted at all`, 'this section proved nothing');
      else if (r.liveAfterClose > 0) bad(`${label}: ${r.liveAfterClose} microphone track(s) LIVE after the child left`,
        `${r.granted} stream(s) were granted and the panel's own reporter says ${r.reported} — an orphan is a stream no variable points at, so nothing in the app can ever stop it`);
      else ok(`${label}: ${r.granted} grant(s), 0 tracks live after teardown — no orphan`);
    }
  }

  /* ---- §15. A DEAD PANEL'S GRANT MUST NOT UNLOCK A LIVE PANEL'S GUARD ---
   *
   * §12 closes and reopens ONCE, BEFORE the taps, so it never has a grant in flight ACROSS
   * a teardown. That is exactly the gap: `voicePending` was cleared before the generation
   * was checked, so a stale continuation opened the door for the panel that replaced it.
   * The gesture is longer than §12's but every step is a finger. */
  if (run(15)) {
    const r = await page.evaluate(async () => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const all = [];
      /* PER-CALL DELAYS, BECAUSE THE ORPHAN NEEDS A SPECIFIC INTERLEAVING AND A SINGLE
       * SHARED DELAY CANNOT PRODUCE IT. The stale grant (A) must settle WHILE the live
       * one (B) is still in flight — that is the moment it wrongly clears the guard — and
       * the third tap (C) must land before B settles, so that B's stream is the one
       * overwritten and orphaned. With one delay for all three, B always completed before
       * A and the third tap became a STOP instead of a new request: the plant applied
       * cleanly and the section still went green, because the scenario could not reach the
       * defect. A PLANT THAT APPLIES IS NOT A PLANT THAT REPRODUCES. */
      const delays = [700, 2600, 2600];
      let nth = 0;
      navigator.mediaDevices.getUserMedia = (c) => real(c).then((st) => {
        all.push(st);
        const d = delays[Math.min(nth++, delays.length - 1)];
        return new Promise((res) => setTimeout(() => res(st), d));
      });
      const tap = () => {
        const b = document.getElementById('voiceRecBtn');
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      };
      try {
        closeVoice(); openVoice();
        tap();                                   /* A issued — a slow permission bubble */
        await new Promise((r2) => setTimeout(r2, 80));
        closeVoice();                            /* back, while A is still in flight */
        openVoice();                             /* Voice again */
        tap();                                   /* B issued, still in flight */
        await new Promise((r2) => setTimeout(r2, 900));  /* A settles here, B does not */
        tap();                                   /* C — only possible if A unlocked the guard */
        await new Promise((r2) => setTimeout(r2, 3200));  /* B then C settle */
        closeVoice();
        await new Promise((r2) => setTimeout(r2, 600));
        return {
          granted: all.length,
          live: all.reduce((n, st) => n + st.getTracks().filter((t) => t.readyState === 'live').length, 0),
        };
      } finally { navigator.mediaDevices.getUserMedia = real; }
    });
    if (r.granted < 2) bad(`the race could not be staged — only ${r.granted} grant(s) issued`, 'this section proved nothing');
    else if (r.live > 0) bad(`${r.live} microphone track(s) LIVE after a grant crossed a teardown`,
      `${r.granted} grants were issued; a stale continuation cleared voicePending before checking its generation, so a dead panel's grant unlocked the live panel's guard`);
    else ok(`a grant that crosses a teardown leaves no live track (${r.granted} grants staged)`);
  }

  /* ---- §17. AN OPEN MICROPHONE LOCKS OUT PLAYBACK ----------------------- */
  if (run(17)) {
    const lock = await page.evaluate(async () => {
      /* ALL THREE FILLED FIRST, THEN A RECORD-OVER -- because the branch below was
       * UNREACHABLE in the old arrangement. Recording into the first EMPTY slot makes that
       * slot the target, and playVoice() plays the target, which is empty while it is being
       * recorded into: no playback could ever start, so "a preset STARTED PLAYBACK" could
       * not fire however unguarded the tiles were. Recording OVER a full slot leaves the
       * old clip in place for the duration, which is the state that makes the hazard real
       * -- and it is also the ordinary gesture once the panel has been used. */
      closeVoice(); openVoice();
      const b = document.getElementById('voiceRecBtn');
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      for (let i = 0; i < 3; i++) {
        const el = document.getElementById('voiceSlot' + i);
        tap(el); await new Promise((r) => setTimeout(r, 650));
        tap(el); await new Promise((r) => setTimeout(r, 900));
      }
      if (!window.__voice.state().slots.every(Boolean)) return { noClip: true };
      tap(b);                                    /* record OVER a slot that still holds a clip */
      await new Promise((r) => setTimeout(r, 500));
      const capturing = window.__voice.state().capturing;
      const before = window.__voice.state().nodes;
      const tile = document.querySelectorAll('.voice-preset')[2];
      tap(tile);                                 /* a preset, mid-record */
      await new Promise((r) => setTimeout(r, 250));
      const st = window.__voice.state();
      const ring = document.getElementById('voiceRing');
      const ringMoving = ring ? Number(ring.style.strokeDashoffset || 0) : -1;
      /* READ BEFORE TEARDOWN. getComputedStyle on a DETACHED element returns an empty
       * string, so reading this after closeVoice() reported "the tiles are still live"
       * about a tile that no longer existed -- a check failing a correct build because it
       * measured the wrong moment. */
      const pe = getComputedStyle(tile).pointerEvents;
      closeVoice();
      return { capturing, before, after: st.nodes, ringMoving, pe };
    });
    if (lock.noClip) bad('no first clip was produced', 'this section proved nothing');
    else if (!lock.capturing) bad('the panel does not report itself as capturing while recording', 'this section proved nothing');
    else if (lock.after > lock.before) bad('a preset tapped mid-record STARTED PLAYBACK',
      `${lock.before} playback node(s) before, ${lock.after} after — the old clip plays out of the speakers INTO the open microphone, and cancelling the animation frame freezes the countdown ring while the 15s timer keeps running`);
    else if (lock.pe !== 'none') bad('the preset tiles are still live during a recording', `pointer-events is ${lock.pe}`);
    else ok(`the preset tiles and slider are inert while the microphone is open (pointer-events ${lock.pe}, no playback started)`);

    /* AND THE SAME INCOHERENCE ON A DIFFERENT EDGE. A capture that fails must not paint
     * 'empty' over a clip that is STILL THERE: play and send dim on the stage while the
     * preset tiles ask only whether a buffer exists, so the panel says "nothing recorded"
     * and a tile still plays the previous clip. The getUserMedia catch already asked
     * `voiceBuffer ? 'ready' : 'empty'`; the two recording-failure transitions did not. */
    const failed = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const b = document.getElementById('voiceRecBtn');
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      tap(b); await new Promise((r) => setTimeout(r, 900));
      tap(b); await new Promise((r) => setTimeout(r, 900));
      if (window.__voice.state().stage !== 'ready') return { noClip: true };
      const kept = window.voiceBuffer;
      const ctx = getAudioCtx();
      const realDecode = ctx.decodeAudioData.bind(ctx);
      ctx.decodeAudioData = () => Promise.reject(new Error('planted decode failure'));
      try {
        tap(b); await new Promise((r) => setTimeout(r, 700));
        tap(b); await new Promise((r) => setTimeout(r, 1200));
        const st = window.__voice.state();
        const tile = document.querySelectorAll('.voice-preset')[1];
        const pe = getComputedStyle(tile).pointerEvents;
        const before = window.__voice.state().nodes;
        tap(tile);
        await new Promise((r) => setTimeout(r, 250));
        const after = window.__voice.state().nodes;
        return { stage: st.stage, stillHave: window.voiceBuffer === kept, pe, before, after };
      } finally { ctx.decodeAudioData = realDecode; closeVoice(); }
    });
    if (failed.noClip) bad('no first clip for the failed-decode probe', 'this section proved nothing');
    else if (!failed.stillHave) ok('a failed decode discards the previous clip outright — nothing to be incoherent about');
    else if (failed.stage === 'empty' && failed.after > failed.before)
      bad('after a failed capture the panel says EMPTY and a preset still plays the old clip',
        `stage=${failed.stage}, tiles pointer-events=${failed.pe}, playback nodes ${failed.before} -> ${failed.after} — the stage and the tiles disagree about whether a clip exists`);
    else if (failed.stage === 'empty')
      bad('after a failed capture the panel says EMPTY while a clip is still loaded', `voiceBuffer survived but stage=${failed.stage}`);
    else ok(`a failed capture leaves the panel coherent — stage ${failed.stage} with the previous clip still loaded`);
  }

  /* ---- §18. THE CLIP DIES WITH THE PANEL -- §S.1, on identifying data --- */
  if (run(18)) {
    const carry = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const b = document.getElementById('voiceRecBtn');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 900));
      /* Back mid-record, then straight back in -- faster than the decode. */
      closeVoice();
      openVoice();
      await new Promise((r) => setTimeout(r, 1800));
      const st = window.__voice.state();
      const buf = !!window.voiceBuffer;
      closeVoice();
      return { stage: st.stage, buf };
    });
    if (carry.buf || carry.stage === 'ready') bad("the PREVIOUS session's clip was installed into the fresh panel",
      `stage=${carry.stage}, buffer present=${carry.buf} — an overlay check is not a generation check, and after close-then-reopen the overlay is back. This contradicts "the clip dies with the panel" on the only identifying data this app handles`);
    else ok(`a clip whose recording was abandoned does not appear in the next panel (stage ${carry.stage})`);
  }

  /* ---- §20. TWO GUARDS NOTHING ASSERTED -------------------------------- */
  if (run(20)) {
    const re = await page.evaluate(() => {
      closeVoice();
      openVoice(); openVoice();
      const n = document.querySelectorAll('#voiceOverlay').length;
      closeVoice();
      const left = document.querySelectorAll('#voiceOverlay').length;
      /* Clean up whatever a broken guard left behind, so later sections start honest. */
      document.querySelectorAll('#voiceOverlay').forEach((el) => el.remove());
      return { n, left };
    });
    if (re.n !== 1) bad(`${re.n} overlay(s) after two openVoice calls`,
      'closeVoice removes the one getElementById returns, so the other stays forever with its own exit button over the console');
    /* AND THE SECOND HALF OF THE SENTENCE WAS COMPUTED AND NEVER READ. `re.left` was
     * measured, returned, and then not asserted, while the pass line said "and teardown
     * removes it": deleting the overlay removal from closeVoice was GREEN with this line
     * printing the claim. A described guarantee reads exactly like a kept one. */
    else if (re.left !== 0) bad(`${re.left} overlay(s) SURVIVED closeVoice`,
      'the panel is gone from the app\'s point of view and still painted over the console, with its own exit button on top of the shell\'s');
    else ok('a second openVoice is a no-op — one panel, and teardown removes it');

    /* THE FALLBACK WAS A `catch` WHERE IT SHOULD HAVE BEEN AN `else`. It only ran when
     * removeChannel THREW. A client that simply LACKS the method — a different
     * supabase-js build, an offline client — made the `if` false, so nothing released and
     * nothing threw either: silent, and silent across all four panels at once now that
     * they share this function. */
    const fb = await page.evaluate(() => {
      const realGet = window.getSupabaseClient;
      const released = [];
      window.getSupabaseClient = () => ({ /* no removeChannel at all */ });
      try {
        releaseChannel({ unsubscribe() { released.push('unsubscribe'); } });
        return { released };
      } catch (e) { return { threw: String((e && e.message) || e) }; }
      finally { window.getSupabaseClient = realGet; }
    });
    if (fb.threw) bad('releaseChannel threw on a client without removeChannel', fb.threw);
    else if (!fb.released.length) bad('a client without removeChannel released NOTHING and threw nothing',
      'the fallback sat in a catch, so it ran only when removeChannel threw — an absent method is not an exception');
    else ok('a client without removeChannel falls back to unsubscribe — the fallback is an else, not a catch');
  }

  /* ---- §21. A REJECTION CROSSING A TEARDOWN --------------------------- */
  if (run(21)) {
    /* §15 stages a race in which every grant SUCCEEDS, so the `.catch` half of the
     * generation guard was load-bearing and asserted by nothing: deleting it left the
     * whole suite green while reintroducing a live orphaned microphone. And a REJECTION is
     * the likelier first-use path -- the adult reads the bubble and denies it. */
    const r = await page.evaluate(async () => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const all = [];
      let nth = 0;
      navigator.mediaDevices.getUserMedia = (c) => {
        const which = nth++;
        if (which === 0) {
          /* A: denied, slowly — the adult looking at the permission bubble. */
          return new Promise((_res, rej) => setTimeout(() => rej(new Error('NotAllowedError')), 700));
        }
        return real(c).then((st) => { all.push(st); return new Promise((res) => setTimeout(() => res(st), 2600)); });
      };
      const tap = () => {
        const b = document.getElementById('voiceRecBtn');
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      };
      try {
        closeVoice(); openVoice();
        tap();                                   /* A — will be denied at t=700 */
        await new Promise((r2) => setTimeout(r2, 80));
        closeVoice(); openVoice();
        tap();                                   /* B — in flight */
        await new Promise((r2) => setTimeout(r2, 900));  /* A's REJECTION lands here */
        tap();                                   /* C — only issues if the rejection unlocked the guard */
        await new Promise((r2) => setTimeout(r2, 3200));
        closeVoice();
        await new Promise((r2) => setTimeout(r2, 600));
        return { requests: nth, granted: all.length,
                 live: all.reduce((n, st) => n + st.getTracks().filter((t) => t.readyState === 'live').length, 0) };
      } finally { navigator.mediaDevices.getUserMedia = real; }
    });
    if (r.requests < 2) bad(`the rejection race could not be staged — ${r.requests} request(s)`, 'this section proved nothing');
    else if (r.live > 0) bad(`${r.live} microphone track(s) LIVE after a REJECTED grant crossed a teardown`,
      `${r.requests} requests issued — a denied permission belonging to a dead panel cleared the live panel's guard, which is the likeliest first-use path of all`);
    else ok(`a rejected grant belonging to a torn-down panel leaves no live track (${r.requests} requests, ${r.granted} granted)`);
  }

  /* ---- §23. NO VOICE TRAFFIC EXISTS — ASSERTED AT THE NETWORK ----------
   *
   * PUP-WO-0702 acceptance 2. THE ASSERTION IS THE NETWORK, NOT THE SOURCE. A grep for a
   * deleted symbol goes green the moment the NAME changes rather than when the BEHAVIOUR
   * does — the `String(closeCamera)` defect in a new costume, and this project has
   * already paid for that once.
   *
   * Three independent witnesses, none of them the app's own bookkeeping: every HTTP
   * request the browser makes, every WebSocket it opens, and every `.channel()` the app
   * asks a Supabase client for. The panel is then driven end to end with a finger. */
  if (run(23)) {
    const requests = [];
    const onReq = (r) => requests.push(r.url());
    page.on('request', onReq);
    try {
      /* THE SOCKET WITNESS IS THE CONSTRUCTOR, NOT page.on('websocket').
       *
       * Playwright's event fires on a CONNECTED socket. A connection that fails before
       * the handshake — which is exactly what CI produces, offline, against an
       * unresolvable Supabase host — emits nothing. Measured: the event recorded 0 while
       * the page console showed three `wss://…supabase.co/realtime/v1/websocket`
       * failures, and a constructor hook caught all three. "Zero sockets" from that event
       * was a SILENCE, not a measurement.
       *
       * And `supabaseUrl` is '' in CI, so `supabaseFetch` resolves against the test origin
       * and the same-origin filter below discarded it. The stub therefore hands the app a
       * REAL-LOOKING off-origin URL, so a REST-shaped re-add is visible as outbound. */
      await page.evaluate(() => {
        window.__sockets = [];
        const RealWS = window.WebSocket;
        window.WebSocket = function (u, p) { window.__sockets.push(String(u)); return new RealWS(u, p); };
        window.WebSocket.prototype = RealWS.prototype;
        window.__realWS = RealWS;
        window.supabaseUrl = 'https://voice-probe.invalid';
        window.supabaseKey = 'probe-key';
      });
      /* A REAL client that records, rather than a null one. A null client makes "no
       * channel was created" true for the wrong reason — the app never had one to ask.
       * This one would hand over a channel if anything asked. */
      await page.evaluate(() => {
        window.__chanAsks = [];
        window.__sends = [];
        window.getSupabaseClient = () => ({
          channel: (name) => { window.__chanAsks.push(name);
            /* `send` RECORDS. An empty send() meant a re-add that piggybacked on the
             * camera's or canvas's ALREADY-OPEN channel asked for zero new channels and
             * went unseen — the suite would have stopped exercising a transport without
             * forbidding one. */
            return { on() { return this; }, subscribe() { return this; },
                     send(m) { window.__sends.push(m && m.event); return this; } }; },
          removeChannel() {},
        });
        window.isSupabaseConfigured = () => true;
      });
      const before = requests.length;
      /* AN OPEN CHANNEL TO PIGGYBACK ON, or the piggyback assertion cannot reach its own
       * state. `cameraChannel` is null throughout a voice session, so "the panel SENT a
       * broadcast on an existing channel" was unreachable — a plant that applies is not a
       * plant that reproduces, in this very file, one work order after we wrote that rule. */
      /* THE ARRANGE MUST NOT BE ABLE TO KILL THE CHECK. A plant that breaks
       * joinCameraChannel made this throw an uncaught TypeError — a stack trace where a
       * FAIL line belonged, which is the third time this file has learned that lesson. A
       * failed arrange is a REPORTABLE condition, not an exception. */
      const staged = await page.evaluate(() => {
        closeVoice(); window.cameraChannel = null;
        let err = null;
        try { joinCameraChannel(); } catch (e) { err = String((e && e.message) || e); }
        /* The arrange's OWN channel must not be counted as the voice panel's. Reset after
         * opening it, so what follows measures only the voice session. */
        window.__chanAsks = []; window.__sends = []; window.__sockets = [];
        return { err, channel: !!window.cameraChannel };
      });
      if (staged.err) bad('the arrange could not open a channel to piggyback on', `joinCameraChannel threw: ${staged.err} — the piggyback assertion below cannot reach its own state`);
      await finger('.pad-btn[data-id="0"]');
      await page.waitForTimeout(250);
      await finger('#voiceRecBtn');
      await page.waitForTimeout(900);
      await finger('#voiceRecBtn');
      await page.waitForTimeout(900);
      /* A PRESET TAP, because the drive was record/play/exit and a transport planted in a
       * preset handler was never executed. */
      await finger('.voice-preset[data-preset="robot"]');
      await page.waitForTimeout(300);
      await finger('#voiceSlider');
      await page.waitForTimeout(300);
      await finger('#voicePlayBtn');
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => window.__voice.state());
      const probe = await page.evaluate(() => ({ asks: window.__chanAsks.slice(), sends: window.__sends.slice(), sockets: window.__sockets.slice() }));
      await page.evaluate(() => closeVoice());

      const outbound = requests.slice(before).filter((u) => !u.startsWith(ORIGIN));
      if (st.stage !== 'ready') bad(`the panel did not record (stage ${st.stage})`, 'this section proved nothing — the drive must reach the code that would have sent');
      else if (probe.asks.length) bad(`the voice panel asked for ${probe.asks.length} Supabase channel(s)`, probe.asks.join(', '));
      else if (probe.sends.length) bad(`the voice panel SENT ${probe.sends.length} broadcast(s) on an existing channel`, probe.sends.join(', '));
      else if (outbound.length) bad(`${outbound.length} outbound request(s) during a voice session`, outbound.slice(0, 4).join(' | '));
      else if (probe.sockets.length) bad(`${probe.sockets.length} WebSocket(s) opened during a voice session`, probe.sockets.slice(0, 4).join(' | '));
      else ok(`record → play → exit asks for ZERO channels, sends ZERO broadcasts, makes ZERO outbound requests and opens ZERO sockets — with a client standing by that would have given one`);

      /* AND THE INSTRUMENT MUST SHOW IT CAN SEE. A witness that has never fired is not a
       * witness: the camera DOES take a channel, on the same recorder, in the same page. */
      const control = await page.evaluate(() => {
        window.__chanAsks = []; window.__sends = []; window.__sockets = [];
        window.cameraChannel = null;
        try { joinCameraChannel(); } catch (e) {}
        try { broadcastPhoto('data:image/png;base64,AAAA'); } catch (e) {}
        /* AND THE SOCKET WITNESS MUST BE SHOWN TO FIRE TOO. It never was: only the
         * channel recorder had a control, so "zero sockets" was the one claim in this
         * section with no evidence behind it. */
        try { new WebSocket('ws://127.0.0.1:9/probe'); } catch (e) {}
        const out = { asks: window.__chanAsks.slice(), sends: window.__sends.slice(), sockets: window.__sockets.slice() };
        window.cameraChannel = null;
        return out;
      });
      if (!control.asks.length) bad('the channel recorder never fired for a path that DOES take a channel',
        'it cannot be trusted to report zero for voice — an instrument must demonstrate it would have seen the thing');
      else if (!control.sends.length) bad('the broadcast recorder never fired for a path that DOES broadcast');
      else if (!control.sockets.length) bad('the socket recorder never fired for a socket that WAS opened',
        'page.on("websocket") misses a connection that fails before the handshake, which is exactly what CI produces');
      else ok(`all three recorders fire on paths that do the thing (camera took ${control.asks.join(', ')}, sent ${control.sends.join(', ')}, ${control.sockets.length} socket) — the zeros above are measurements, not silences`);
    } finally {
      page.off('request', onReq);
      /* EVERY STUB RESTORED. This section installed four globals and put back one, which
       * this file's own prose forbids — and the one it did not restore (`supabaseUrl`) was
       * then silently depended on by §24, so §24's REST detection worked only when §23 had
       * run first. A section that leaves state behind is a section the next one's result
       * depends on. */
      await page.evaluate(() => {
        if (window.__realWS) { window.WebSocket = window.__realWS; delete window.__realWS; }
        delete window.getSupabaseClient; delete window.isSupabaseConfigured;
        window.supabaseUrl = ''; window.supabaseKey = '';
        window.cameraChannel = null;
        delete window.__chanAsks; delete window.__sends; delete window.__sockets;
      });
    }
  }

  /* ---- §24. THE MAP KNOWS WHERE IT IS AND TELLS NOBODY ------------------
   *
   * PUP-WO-0702 acceptance 3, and §1.2's leak: stamps and strokes carried REAL WGS84
   * coordinates — Leaflet's own lat/lng — beside a stable device id, on an unscoped
   * global channel, from a map re-centred on getCurrentPosition at zoom 16.
   *
   * LEAFLET IS A CDN SCRIPT AND IS UNREACHABLE IN CI, so it is stubbed — and THE FIRST
   * VERSION OF THIS SECTION DEFENDED THAT STUB WITH AN ARGUMENT THAT WAS WRONG ON ITS OWN
   * TERMS. It said "Leaflet is the dependency, not the subject; nothing below asserts
   * anything about Leaflet" — while its outbound witness measured precisely Leaflet's
   * traffic, which the stub had removed. So it reported ZERO OUTBOUND and passed a line
   * reading "it tells nobody", about a map that fetches OpenStreetMap tiles.
   *
   * A TILE URL IS A COORDINATE. Re-centred on the fix at zoom 16 the requested tile bounds
   * the child to roughly a 500 m square, and maxZoom 19 takes that to about 60 m. That
   * egress is PRE-EXISTING and already logged as an open northstar re-ratification for
   * Scotty; this work order neither created it nor closes it.
   *
   * SO THE SECTION ASSERTS THE CLAIM IT CAN AND NAMES THE ONE IT CANNOT. What it proves:
   * no Supabase channel, no broadcast, no coordinates to another PupPad device. What it
   * REFUSES to certify: that the map is silent. The tile layer is recorded and asserted to
   * be PRESENT, so nobody can quietly conclude from a green run that nothing leaves. */
  if (run(24)) {
    const requests = [];
    const onReq = (r) => requests.push(r.url());
    page.on('request', onReq);
    try {
      const res = await page.evaluate(async () => {
        const asks = [], sends = [], sockets = [];
        /* ITS OWN WITNESSES, BECAUSE BORROWED ONES ARE NOT WITNESSES.
         *
         * §24 had NO socket hook at all — page.on('request') does not fire for sockets,
         * and §23 restores window.WebSocket in its own last line, so under --only=24 (which
         * is exactly how the controls harness runs it) a raw socket carrying {lat,lng,did}
         * on the stamp path passed green. THE ISOLATION MODE THAT PROVES A SECTION CAN SEE
         * WAS THE MODE IN WHICH IT COULD NOT.
         *
         * And it never set `supabaseUrl`, so `supabaseFetch` resolved against '' — same
         * origin — and the outbound filter discarded it. A REST write of the child's
         * coordinates walked straight past. Both are set here and restored below. */
        const RealWS = window.WebSocket;
        window.WebSocket = function (u, pr) { sockets.push(String(u)); return new RealWS(u, pr); };
        window.WebSocket.prototype = RealWS.prototype;
        const realUrl = window.supabaseUrl, realKey = window.supabaseKey;
        window.supabaseUrl = 'https://map-probe.invalid';
        window.supabaseKey = 'probe-key';
        const realGet = window.getSupabaseClient, realCfg = window.isSupabaseConfigured;
        window.getSupabaseClient = () => ({
          channel: (n) => { asks.push(n);
            return { on() { return this; }, subscribe() { return this; },
                     send(m) { sends.push(m && m.event); return this; } }; },
          removeChannel() {},
        });
        window.isSupabaseConfigured = () => true;
        /* The stub. Only what index.html actually calls. */
        const pt = (x, y) => ({ x: x, y: y });
        const ll = (a, b) => (typeof a === 'object' ? { lat: a.lat, lng: a.lng } : { lat: a, lng: b });
        const off = { enable() {}, disable() {} };
        const mapObj = {
          setView() { return this; }, on() { return this; }, remove() {},
          latLngToContainerPoint: (l) => pt((l.lng + 180) * 10, (90 - l.lat) * 10),
          containerPointToLatLng: (p) => ll(90 - p.y / 10, p.x / 10 - 180),
          dragging: off, touchZoom: off, doubleClickZoom: off, scrollWheelZoom: off,
        };
        const realL = window.L;
        const tiles = [];
        window.L = {
          map: () => mapObj,
          tileLayer: (url) => { tiles.push(String(url)); return { addTo() { return this; } }; },
          divIcon: () => ({}),
          marker: (a) => ({ _ll: ll(a[0], a[1]), addTo() { return this; },
                            setLatLng(v) { this._ll = ll(v[0], v[1]); return this; },
                            getLatLng() { return this._ll; } }),
          latLng: ll, point: pt,
        };
        /* A geolocation that resolves, so the marker path actually runs. */
        const realGeo = navigator.geolocation;
        const fix = { coords: { latitude: 35.7796, longitude: -78.6382 } };
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
          getCurrentPosition: (ok) => setTimeout(() => ok(fix), 0),
          watchPosition: (ok) => { setTimeout(() => ok(fix), 0); return 7; },
          clearWatch() {},
        }});
        try {
          openTreasureMap();
          await new Promise((r) => setTimeout(r, 300));
          const opened = !!document.getElementById('mapOverlay');
          const tracked = !!window.mapLocationMarker;
          /* Draw, stamp and clear through the app's OWN handlers. */
          const cv = document.getElementById('mapDrawCanvas') || document.querySelector('#mapOverlay canvas');
          let strokes = 0, stamps = 0;
          if (cv) {
            window.mapIsDrawMode = true;
            const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
            ev('pointerdown', 120, 120); ev('pointermove', 160, 150); ev('pointerup', 160, 150);
            /* AND THE STAMP PATH, which the default tool ('pen') never reaches. A drive
             * that exercises one of two send paths leaves the other untested, and the
             * stamp is the one that carried {lat, lng, did} — the payload this whole work
             * order is about. A plant on the stamp broadcast stayed green because nothing
             * ever stamped. */
            /* COUNTED SEPARATELY, BECAUSE A SUM CANNOT TELL YOU WHICH PATH RAN.
             * `drew = strokes + stamps >= 2` was satisfied by TWO PEN STROKES: rename the
             * branch value 'stamp' to 'sticker' — an ordinary refactor — and the stamp
             * gesture degrades into a second stroke, 1+1 === 2+0, and the section passes
             * with a live {lat,lng,did} broadcast on the stamp path. Its own failure
             * message named the requirement it could not enforce. */
            const beforeStamps = (window.mapStamps || []).length;
            window.mapDrawTool = 'stamp';
            ev('pointerdown', 200, 200); ev('pointerup', 200, 200);
            strokes = (window.mapStrokes || []).length;
            stamps = (window.mapStamps || []).length - beforeStamps;
          }
          const clearBtn = document.getElementById('mapClearBtn');
          if (clearBtn) clearBtn.click();
          closeTreasureMap();
          return { opened, tracked, strokes, stamps, asks, sends, sockets, tiles, canvas: !!cv };
        } finally {
          window.L = realL;
          Object.defineProperty(navigator, 'geolocation', { configurable: true, value: realGeo });
          window.getSupabaseClient = realGet; window.isSupabaseConfigured = realCfg;
          window.WebSocket = RealWS;
          window.supabaseUrl = realUrl; window.supabaseKey = realKey;
        }
      });

      const outbound = requests.filter((u) => !u.startsWith(ORIGIN));
      if (!res.opened) bad('the map did not open under the stub', 'this section proved nothing');
      else if (!res.tracked) bad('mapLocationMarker did not track the fix',
        'geolocation must STAY — the map knows where it is; it just stops telling anyone');
      else if (!res.canvas) bad('the drawing canvas was not found', 'the draw and stamp paths were never driven — this section proved nothing');
      else if (!res.strokes) bad('the STROKE path was never driven', 'this section proved nothing about it');
      else if (!res.stamps) bad('the STAMP path was never driven',
        'the stamp is the one that carried {lat, lng, did} — and a plant on it is invisible if nothing stamps. A SUM CANNOT TELL YOU WHICH PATH RAN');
      else if (res.asks.length) bad(`the map asked for ${res.asks.length} Supabase channel(s)`, res.asks.join(', '));
      else if (res.sends.length) bad(`the map SENT ${res.sends.length} broadcast(s)`, res.sends.join(', '));
      else if (res.sockets.length) bad(`${res.sockets.length} WebSocket(s) opened while drawing on the map`, res.sockets.slice(0, 4).join(' | '));
      else if (outbound.length) bad(`${outbound.length} outbound request(s) while drawing on the map`, outbound.slice(0, 4).join(' | '));
      else if (!res.tiles.length) bad('the tile layer was not created', 'this section cannot speak to the tile egress it exists to name — and the map would show no map');
      else {
        ok(`the map opens, tracks a real fix, draws ${res.strokes} stroke(s) AND ${res.stamps} stamp(s) and clears — ZERO channels, ZERO broadcasts, ZERO sockets, ZERO PupPad outbound. It no longer tells another device where the child is`);
        console.log(`        AND IT IS NOT SILENT, WHICH THIS SECTION REFUSES TO CERTIFY PAST: the tile layer is`);
        console.log(`        ${res.tiles[0]}`);
        console.log('        — a tile URL IS a coordinate, and at zoom 16 it bounds the child to ~500 m. Stubbed');
        console.log('        here for determinism; PRE-EXISTING, and an open northstar re-ratification for Scotty.');
      }
    } finally { page.off('request', onReq); }
  }

  /* ---- §25. THE WORDS-COVERED TEST — PUP-WO-0703 acceptance 2 -----------
   *
   * THE CENTRAL ONE, and it is measured rather than argued. Scotty, from watching Buddy:
   * the record button dims everything else and stays bright, and NOTHING TELLS A
   * NON-READER THAT RECORDING IS HAPPENING. DIMMING SAYS WHAT IS UNAVAILABLE; NOTHING SAID
   * WHAT WAS HAPPENING.
   *
   * So every painted word is hidden and the SLOT ROW IS PHOTOGRAPHED in each state. The
   * four questions the work order asks — is it recording, into which slot, was a clip
   * saved, which slot is playing — are each answered by the row LOOKING DIFFERENT with no
   * text on screen. Byte-comparing the images is the whole assertion: if two states
   * photograph identically with words covered, a child cannot tell them apart. */
  if (run(25)) {
    /* THE WHOLE PANEL, NOT THE SLOT ROW.
     *
     * This framed only the slot row -- and the panel's one painted word ("PAW TALK") is
     * the absolutely-positioned title, OUTSIDE that frame. So the mask changed nothing in
     * the compared image: measured, the row hashed identically before and after masking,
     * while the guard `if (!hidden.length)` passed on a word that was never in shot. The
     * check reported "with 1 painted word(s) hidden" about a picture the hiding could not
     * touch.
     *
     * And the row alone CANNOT carry the recording/playing distinction, because the design
     * is deliberately one animation for both -- "this slot is the live one". What separates
     * them is the countdown ring, which lives in the transport row. Framing the row was
     * therefore asking the wrong rectangle a question only the panel can answer. */
    const shot = async () => (await page.locator('#voiceOverlay').screenshot()).toString('base64');
    /* TWO RECTANGLES, TWO QUESTIONS, because one answer cannot serve both.
     *
     * The PANEL must distinguish all four states -- that is the work order's acceptance.
     * The SLOT ROW must distinguish the three states IT is responsible for (empty,
     * holding, live), because that is the signal the child looks at. Asserting only the
     * panel let a plant flatten the slots entirely and still pass, since the ring and the
     * record button carried the difference on their own. */
    const rowShot = async () => (await page.locator('#voiceSlot0').locator('xpath=..').screenshot()).toString('base64');
    const maskWords = () => page.evaluate(() => {
      /* Hide every TEXT node's paint, leaving glyphs, shapes and strokes. Emoji are
       * pictographs and stay — a non-reader can use those; a word is what they cannot. */
      const ov = document.getElementById('voiceOverlay');
      const walk = document.createTreeWalker(ov, NodeFilter.SHOW_TEXT);
      const seen = [];
      let n;
      while ((n = walk.nextNode())) {
        const t = (n.textContent || '').trim();
        if (/[A-Za-z]{2,}/.test(t) && n.parentElement) { n.parentElement.style.visibility = 'hidden'; seen.push(t); }
      }
      return seen;
    });

    /* === THE INSTRUMENT, BEFORE THE SUBJECT ==============================
     *
     * A BYTE COMPARISON OF SCREENSHOTS COULD NOT REPORT `recording == playing`, WHICH IS
     * THE PAIR THIS SECTION EXISTS FOR. Both states have `voiceWaveRaf` advancing
     * `voiceWavePhase` between the two captures, so two photographs of a running
     * animation at different phases are NEVER byte-identical no matter how the panel is
     * painted. Of the six pairs only `empty == holding` was a genuine test; the headline
     * one was unreportable, and an assertion that cannot report the thing it names is a
     * described guarantee, not a kept one.
     *
     * SO THE ANIMATION IS STILLED THROUGH THE SHIPPING PATH -- prefers-reduced-motion,
     * which `paintVoiceSlots` and `voiceWaveTick` already honour -- rather than by a
     * test-only hook. That also makes this the HARDER case: under reduced motion the live
     * slot has one fewer signal than it does in normal use, so a panel that passes here
     * passes with motion too.
     *
     * TWO CONTROLS FIRST, and they are opposites. With motion ON, two captures of the
     * same live slot must DIFFER -- proving the camera can see change at all. With motion
     * REDUCED, two captures must be IDENTICAL -- proving the phase really is frozen, so
     * that an equality below means the states are the same rather than that the shutter
     * was quick. An instrument that has never reported "same" has not shown it can tell
     * the difference, and one that has never reported "different" has not shown it is
     * looking. */
    await page.evaluate(() => {
      closeVoice(); openVoice();
      const ctx = getAudioCtx();
      window.voiceSlots[0] = ctx.createBuffer(1, 2400, 24000);
      paintVoiceSlots();
      setVoiceLiveSlot(0);
    });
    await page.waitForTimeout(250);
    const moving1 = await rowShot();
    await page.waitForTimeout(260);
    const moving2 = await rowShot();
    const seesChange = moving1 !== moving2;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      await page.evaluate(() => paintVoiceSlots());
      await page.waitForTimeout(320);
      const still1 = await rowShot();
      await page.waitForTimeout(260);
      const still2 = await rowShot();
      const frozen = still1 === still2;

      await page.evaluate(() => { closeVoice(); openVoice(); });
      await page.waitForTimeout(200);
      const preMask = await shot();
      const hidden = await maskWords();
      const empty = await shot();
      const emptyRow = await rowShot();
      const maskChanged = preMask !== empty;

      await finger('#voiceSlot1');
      await page.waitForTimeout(700);
      await maskWords();
      const recording = await shot();
      const recordingRow = await rowShot();
      const liveDuring = await page.evaluate(() => window.__voice.state().liveSlot);

      await finger('#voiceSlot1');
      await page.waitForTimeout(1100);
      await maskWords();
      const holding = await shot();
      const holdingRow = await rowShot();

      await finger('#voiceSlot1');
      await page.waitForTimeout(250);
      await maskWords();
      const playing = await shot();
      const livePlay = await page.evaluate(() => window.__voice.state().liveSlot);
      await page.evaluate(() => closeVoice());

      const named = { empty, recording, holding, playing };
      const pairs = [];
      const keys = Object.keys(named);
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        if (named[keys[i]] === named[keys[j]]) pairs.push(`${keys[i]} == ${keys[j]}`);
      }
      if (!seesChange) bad('two photographs of a MOVING wave came out byte-identical',
        'the camera cannot see change, so every "these two states differ" below is meaningless — this section proved nothing');
      else if (!frozen) bad('two photographs of a stilled wave came out DIFFERENT',
        'prefers-reduced-motion did not freeze the phase, so no pair of states can ever be reported identical and recording == playing is unfalsifiable — this section proved nothing');
      else if (!hidden.length) bad('no painted words were found to hide', 'the mask did nothing, so this proved nothing');
      else if (liveDuring !== 1) bad(`recording did not mark slot 1 live (liveSlot ${liveDuring})`, 'this section proved nothing');
      else if (livePlay !== 1) bad(`playback did not mark slot 1 live (liveSlot ${livePlay})`);
      /* AND THE MASK MUST BE PROVEN TO CHANGE THE PICTURE. A no-op mask makes every
       * comparison below a comparison of unmasked images. */
      else if (maskChanged === false) bad('hiding the words did not change the photograph',
        'the masked element is outside the frame being compared, so this section is comparing unmasked pictures');
      else if (pairs.length) bad(`${pairs.length} state pair(s) are PHOTOGRAPHICALLY IDENTICAL with words covered`,
        `${pairs.join(', ')} — a child cannot read the label, so if the picture is the same the state is invisible`);
      else {
        const rows = { empty: emptyRow, live: recordingRow, holding: holdingRow };
        const rk = Object.keys(rows);
        const same = [];
        for (let i = 0; i < rk.length; i++) for (let j = i + 1; j < rk.length; j++)
          if (rows[rk[i]] === rows[rk[j]]) same.push(`${rk[i]} == ${rk[j]}`);
        if (same.length) bad(`the SLOT ROW cannot tell ${same.length} of its own state pair(s) apart`,
          `${same.join(', ')} — the row is the thing the child looks at, and the panel differing elsewhere does not help them find WHICH slot`);
        else ok(`with the wave STILLED and ${hidden.length} painted word(s) hidden, empty / recording / holding / playing all photograph DIFFERENTLY, the SLOT ROW distinguishes its own three states, and the live slot is identified (slot ${liveDuring})`);
      }
    } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }); }
  }

  /* ---- §26. THE THREE STATES, AND NOT ON COLOUR ALONE ------------------- */
  if (run(26)) {
    const st = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const amp = (i) => {
        const d = document.querySelector('#voiceSlot' + i + ' .voice-wave').getAttribute('d') || '';
        const ys = d.split(/[ML]/).filter(Boolean).map((seg) => parseFloat(seg.trim().split(/\s+/)[1]));
        return Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10;
      };
      const read = (i) => {
        const el = document.getElementById('voiceSlot' + i);
        const cs = getComputedStyle(el);
        return { state: el.dataset.state, borderStyle: cs.borderTopStyle, borderWidth: cs.borderTopWidth,
                 amp: amp(i), del: getComputedStyle(el.querySelector('.voice-slot-del')).display };
      };
      const out = { empty: read(0) };
      /* Fake a filled slot without a microphone: the STATES are what is under test here. */
      const ctx = getAudioCtx();
      window.voiceSlots[0] = ctx.createBuffer(1, 2400, 24000);
      paintVoiceSlots();
      out.holding = read(0);
      setVoiceLiveSlot(0);
      out.live = read(0);
      setVoiceLiveSlot(-1);
      closeVoice();
      return out;
    });

    /* NOT ON COLOUR ALONE: the assertion is that the states differ in properties that
     * survive a washed-out screen outdoors — the outline's STYLE, its WIDTH, the wave's
     * AMPLITUDE, and whether a control is present. Colour may also differ; it may not be
     * the only thing that does. */
    const nonColour = (a, b) => ['borderStyle', 'borderWidth', 'amp', 'del'].filter((k) => a[k] !== b[k]);
    const ehc = nonColour(st.empty, st.holding);
    const hlc = nonColour(st.holding, st.live);
    const elc = nonColour(st.empty, st.live);
    if (st.empty.state !== 'empty' || st.holding.state !== 'holding' || st.live.state !== 'live')
      bad('the three states were not reached', JSON.stringify(st));
    else if (!ehc.length || !hlc.length || !elc.length)
      bad('two states differ by COLOUR ALONE',
        `empty/holding [${ehc}], holding/live [${hlc}], empty/live [${elc}] — it must survive a dim screen outdoors`);
    else if (st.empty.del !== 'none' || st.holding.del === 'none')
      bad('the delete control is not exactly on the filled slots',
        `empty shows ${st.empty.del}, holding shows ${st.holding.del} — an empty slot must have nothing to press by mistake`);
    else ok(`three states differ without relying on colour — empty/holding by [${ehc.join(',')}], holding/live by [${hlc.join(',')}]; delete appears only when filled`);
  }

  /* ---- §27. THE WAVE IS ANIMATING, SAMPLED AT TWO TIMES ----------------- */
  if (run(27)) {
    /* CHECK THE EFFECT, NEVER THE INSTALLATION. A static wave is a decoration and a moving
     * one is a state, so the assertion is that the PATH CHANGES between two samples — not
     * that an element, a class or a rAF handle exists. */
    const move = await page.evaluate(async () => {
      closeVoice(); openVoice();
      /* SLOT 1 IS FILLED FIRST, so the "not live" sample below covers a FILLED slot and
       * not only empty ones. An empty slot's path is phase-invariant -- WAVE_AMP_EMPTY is
       * 0 and wavePath(0, p) is the same line at every phase -- so a build that waved
       * every slot could only ever be caught on a filled one.
       *
       * AND THIS REPLACES A BRANCH THAT COULD NOT FAIL. There used to be a separate
       * assertion that a merely FILLED slot does not move, sampled when NOTHING was live
       * -- which is exactly when the loop is legitimately stopped, so the path cannot
       * change in any build. Unfalsifiable in the same way the empty-slot half was. The
       * property is real; it just has to be asked while the loop is running. */
      const ctx0 = getAudioCtx();
      window.voiceSlots[1] = ctx0.createBuffer(1, 24000, 24000);
      paintVoiceSlots();
      const d = () => document.querySelector('#voiceSlot0 .voice-wave').getAttribute('d');
      const sample = async () => { const a = d(); await new Promise((r) => setTimeout(r, 220)); return [a, d()]; };
      const b = document.getElementById('voiceSlot0');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const rec = await sample();
      /* AND THE OTHER SLOTS MUST BE STILL WHILE ONE IS LIVE -- slot 1 filled, slot 2
       * empty. Asserting only "the rAF is off when idle" left a plant that made EVERY slot
       * wave reporting green, because an idle panel has no loop running either way.
       * Movement has to mean THIS slot, not merely that something somewhere is animating. */
      const others = () => [1, 2].map((i) => document.querySelector('#voiceSlot' + i + ' .voice-wave').getAttribute('d'));
      const o1 = others();
      await new Promise((r) => setTimeout(r, 220));
      const othersMoved = others().some((d2, k) => d2 !== o1[k]);
      const recLive = window.__voice.state().liveSlot;
      stopVoiceRecording();
      await new Promise((r) => setTimeout(r, 1100));
      playVoice(0);
      await new Promise((r) => setTimeout(r, 200));
      const play = await sample();
      const playLive = window.__voice.state().liveSlot;
      /* THE FRAME GUARD, ASKED WHERE IT CAN ANSWER NO.
       *
       * This used to be sampled on a FRESH PANEL, and `voiceWaveTick` is only ever called
       * from `setVoiceLiveSlot(i >= 0)` while `closeVoice` zeroes the handle -- so on a
       * fresh panel the answer is 0 in EVERY build, and deleting the loop's
       * `voiceLiveSlot < 0` guard (the rAF then rescheduling forever with nothing live,
       * which is the exact battery cost its comment names) was green suite-wide. The
       * question has to be asked where a running loop has to decide to stop: AFTER a live
       * slot goes away. The `while` sample is the positive control -- a build whose loop
       * never runs must not pass this by having nothing to stop. */
      /* Driven by setVoiceLiveSlot rather than by letting the playback end, because a
       * 0.7s clip at the default preset's 1.70x is over in about 0.4s -- the positive
       * control would then be sampling a playback that had already finished and this
       * section would fail for a reason that is not the one it is about. Same shipping
       * function either way; it is the marker the loop watches. */
      setVoiceLiveSlot(0);
      await new Promise((r) => setTimeout(r, 150));
      const rafWhileLive = !!window.__voice.state().waveRaf;
      setVoiceLiveSlot(-1);
      await new Promise((r) => setTimeout(r, 300));
      const rafAfterLive = !!window.__voice.state().waveRaf;
      closeVoice();
      return { rec, play, recLive, playLive, rafWhileLive, rafAfterLive, othersMoved };
    });
    const moving = (pair) => pair[0] !== pair[1];
    if (move.recLive !== 0) bad(`recording did not go into slot 0 (liveSlot ${move.recLive})`, 'this section proved nothing');
    else if (!moving(move.rec)) bad('the wave is NOT MOVING while recording',
      'a static wave is a decoration; a moving one is a state, and this is the only signal a non-reader has');
    else if (move.playLive !== 0) bad(`playback did not go from slot 0 (liveSlot ${move.playLive})`);
    else if (!moving(move.play)) bad('the wave is NOT MOVING while playing');
    /* THE EMPTY-SLOT HALF USED TO BE UNFALSIFIABLE: WAVE_AMP_EMPTY is 0 and wavePath(0, p)
     * is phase-invariant, so an empty slot's path could not change no matter what the loop
     * did -- measured, one distinct path across six phases. The real property is that the
     * LOOP IS NOT RUNNING when nothing is live, which a battery on a tablet cares about
     * and which a plant can actually break. */
    else if (move.othersMoved) bad('the slots that are NOT live are waving too',
      'movement then does not mean "this slot is the live one" and the signal carries nothing — which is the entire design');
    else if (!move.rafWhileLive) bad('the wave loop is NOT running while a slot is live',
      'nothing is animating, so "the loop stops when nothing is live" would pass by having no loop at all — this section proved nothing');
    else if (move.rafAfterLive) bad('the wave loop KEEPS RUNNING after the live slot goes away',
      'a rAF rescheduling forever on an idle panel is a battery cost on a tablet, and movement that is not tied to LIVE carries no information');
    else ok('the wave moves while recording AND while playing, a filled slot beside it stays still, and the loop stops itself the moment nothing is live');
  }

  /* ---- §28. REDUCED MOTION STILLS THE WAVE AND KEEPS THE STATE ---------- */
  if (run(28)) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      const rm = await page.evaluate(async () => {
        closeVoice(); openVoice();
        const ctx = getAudioCtx();
        window.voiceSlots[0] = ctx.createBuffer(1, 2400, 24000);
        window.voiceSlots[1] = ctx.createBuffer(1, 2400, 24000);
        paintVoiceSlots();
        setVoiceLiveSlot(0);
        const d = (i) => document.querySelector('#voiceSlot' + i + ' .voice-wave').getAttribute('d');
        const a0 = d(0);
        await new Promise((r) => setTimeout(r, 320));
        const b0 = d(0);
        const el = (i) => { const e = document.getElementById('voiceSlot' + i); const cs = getComputedStyle(e);
          return { w: cs.borderTopWidth, s: cs.borderTopStyle, d: d(i) }; };
        const live = el(0), other = el(1);
        setVoiceLiveSlot(-1);
        /* AND THE COUNTDOWN RING DOES NOT STOP, WHICH IS A DECISION RATHER THAN AN
         * OMISSION. The wave can honour the preference by standing still because a live
         * slot keeps full amplitude, a thick ring and the brightest stroke -- stillness
         * costs it nothing. The countdown has no spare signal: it IS the answer to "how
         * much longer", and under the ruling that recording needs non-colour carriers it
         * is one of only two. A ring frozen at its starting value states something false
         * about the clip. So it keeps updating and the preference is honoured the way that
         * is available -- fifteen one-second steps instead of a continuous crawl -- and
         * its loop is bounded by the recording it belongs to, which is why this one does
         * not stop and the wave's, which is unbounded, does. */
        /* THE RECORD BUTTON, not a slot: slots 0 and 1 are filled here, so a tap on one
         * would PLAY it. Slot 2 is the first empty one and is where this lands. */
        const s0 = document.getElementById('voiceRecBtn');
        s0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        s0.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 700));
        const recording = window.__voice.state().recorder;
        const ring = () => { const e = document.getElementById('voiceRing');
          return e ? parseFloat(e.style.strokeDashoffset || '0') : -1; };
        const r1 = ring();
        await new Promise((r) => setTimeout(r, 1700));
        const r2v = ring();
        stopVoiceRecording();
        await new Promise((r) => setTimeout(r, 1100));
        closeVoice();
        return { moved: a0 !== b0, live, other, recording, r1, r2: r2v };
      });
      if (rm.moved) bad('the wave still animates under prefers-reduced-motion');
      else if (rm.live.d === rm.other.d && rm.live.w === rm.other.w)
        bad('under reduced motion the LIVE slot is indistinguishable from a merely filled one',
          'stillness is allowed; ambiguity is not — reduced motion must not erase the only signal a non-reader has');
      else if (!rm.recording) bad('no recording was running, so the countdown could not be asked anything', 'this section proved nothing about the ring');
      else if (!(rm.r2 > rm.r1)) bad(`the countdown ring FROZE under reduced motion (${rm.r1} then ${rm.r2})`,
        'a ring stopped at its starting value says the clip has just begun for the whole fifteen seconds — an essential indicator, not a flourish, and the one non-colour carrier that answers "how much longer"');
      else ok(`under reduced motion the wave is still, the live slot is still distinguishable (border ${rm.live.w} vs ${rm.other.w}, different path), and the countdown still advances in steps (${rm.r1.toFixed(0)} -> ${rm.r2.toFixed(0)})`);
    } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }); }
  }

  /* ---- §29. THREE SLOTS: RECORD, RECORD OVER, DELETE — with a finger ---- */
  if (run(29)) {
    await page.evaluate(() => { closeVoice(); openVoice(); });
    await page.waitForTimeout(200);
    const rec = async (sel) => { await finger(sel); await page.waitForTimeout(700); await finger(sel); await page.waitForTimeout(1000); };
    await rec('#voiceSlot0');
    await rec('#voiceSlot1');
    await rec('#voiceSlot2');
    const full = await page.evaluate(() => window.__voice.state());
    if (full.slots.filter(Boolean).length !== 3) bad(`only ${full.slots.filter(Boolean).length} of 3 slots filled with a finger`, JSON.stringify(full.slots));
    else {
      ok('three slots each recorded into with a finger');
      /* RECORD OVER: with every slot full the microphone replaces the last one used, and
       * the wave runs on THAT slot so the child sees which is being replaced. */
      /* AFTER A PLAY, and against the slot that was PLAYED rather than against `target`
       * read back from the app. The old version read `before = state().target` and then
       * asserted `liveSlot === before` -- and `nextVoiceSlot()` RETURNS `voiceTargetSlot`
       * when full, so both sides were the same variable. It bound nothing, and it never
       * exercised the record-over-from-playing gesture at all, which is where a race was
       * later found. */
      /* SLOT 1, AND THE CHOICE IS THE ASSERTION. The previous repair wrote `const before
       * = 0` -- and slot 0 is SIMULTANEOUSLY the slot that was played, the first slot, and
       * `voiceTargetSlot`'s initial value. Hardcoding `nextVoiceSlot()` to `return 0` was
       * GREEN across the whole suite while this line printed "replaces the last-used slot
       * (0)", and it is the only line in the file asserting record-over targeting at all,
       * so an upheld design decision had no enforcement.
       *
       * Slot 1 is produced by nothing else in this arrangement: the slots were filled in
       * order so `voiceTargetSlot` is 2, the first slot is 0, and the initial target is 0.
       * Only `playVoice` re-pointing the target and `nextVoiceSlot` honouring it can put
       * the recording on 1. The repair for "compares a value to itself" had landed on a
       * CONSTANT THE DEFECT ALSO PRODUCES, which is the same failure wearing a number. */
      await finger('#voiceSlot1');
      await page.waitForTimeout(250);
      const before = 1;
      await finger('#voiceRecBtn');
      await page.waitForTimeout(500);
      const over = await page.evaluate(() => window.__voice.state());
      await finger('#voiceRecBtn');
      await page.waitForTimeout(1000);
      const afterOver = await page.evaluate(() => window.__voice.state());
      if (over.liveSlot !== before) bad(`record-over went to slot ${over.liveSlot}, not the last-used slot ${before}`,
        `slot ${before} is the one that was just played and it is neither the first slot nor the initial target — a build that always picks slot 0 lands here`);
      else if (afterOver.slots.filter(Boolean).length !== 3) bad('recording over lost a slot', JSON.stringify(afterOver.slots));
      else ok(`recording with all three full replaces the last-used slot (${before}, neither the first nor the default) and the wave runs on it`);

      /* Slot 2, because slot 1 is now the one that was recorded over and a delete probe
       * should not share a subject with the assertion above it. */
      const box = await page.locator('#voiceSlot2 .voice-slot-del').boundingBox({ timeout: 2500 }).catch(() => null);
      if (!box) bad('the delete control is not present on a filled slot');
      else if (box.width < 44 || box.height < 44) bad(`the delete control is ${box.width}x${box.height}`, 'at least 44px, and never a long press');
      else {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
        const del = await page.evaluate(() => window.__voice.state());
        if (del.slots[2]) bad('a finger on the delete control did not empty the slot');
        else if (del.slots.filter(Boolean).length !== 2) bad('delete removed the wrong number of slots', JSON.stringify(del.slots));
        else if (del.stage === 'recording') bad('deleting a slot STARTED A RECORDING',
          'the delete tap reached the slot underneath it — the two handlers ran on one pointerup');
        else ok(`a finger on the ${Math.round(box.width)}px delete control empties exactly that slot and starts nothing`);
      }
    }
    await page.evaluate(() => closeVoice());
  }

  /* ---- §30. DELETING THE SLOT THE MICROPHONE IS FILLING ----------------
   * A record-over target is FILLED and LIVE at once, so the delete control is painted on
   * the slot being recorded into — and the delete used to run a PLAYBACK-shaped teardown
   * against a RECORDING. §29 taps delete only from the `ready` stage and cannot see it. */
  if (run(30)) {
    const r = await page.evaluate(async () => {
      const streams = [];
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c) => real(c).then((st) => { streams.push(st); return st; });
      try {
        closeVoice(); openVoice();
        const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
        for (let i = 0; i < 3; i++) {
          const el = document.getElementById('voiceSlot' + i);
          tap(el); await new Promise((r2) => setTimeout(r2, 650));
          tap(el); await new Promise((r2) => setTimeout(r2, 900));
        }
        if (!window.__voice.state().slots.every(Boolean)) return { notFull: true };
        tap(document.getElementById('voiceRecBtn'));
        await new Promise((r2) => setTimeout(r2, 600));
        const live = window.__voice.state().liveSlot;
        if (live < 0) return { noRecord: true };
        /* EVERY CONTROL THE STAGE DIMS, READ AS THE CHILD MEETS IT. `voiceSetStage` sets
         * pointer-events:none on all four preset tiles, BOTH sliders and the play button
         * whenever `voiceCapturing()` is true, and only a later stage call lifts it. */
        const inert = () => {
          const ids = ['voiceSlider', 'voiceSliderB', 'voicePlayBtn'];
          const dead = ids.filter((id) => { const e = document.getElementById(id);
            return e && getComputedStyle(e).pointerEvents === 'none'; });
          const tiles = Array.from(document.querySelectorAll('.voice-preset'))
            .filter((t) => getComputedStyle(t).pointerEvents === 'none').map((t) => t.dataset.preset || 'tile');
          return dead.concat(tiles);
        };
        /* THE POSITIVE CONTROL. If nothing is inert DURING the recording, "nothing is
         * inert afterwards" is true of a panel that never dims anything and this half of
         * the section proves nothing. */
        const inertDuring = inert();
        const del = document.querySelector('#voiceSlot' + live + ' .voice-slot-del');
        if (getComputedStyle(del).display === 'none') return { noDel: true, live };
        tap(del);
        await new Promise((r2) => setTimeout(r2, 500));
        const after = window.__voice.state();
        await new Promise((r2) => setTimeout(r2, 2000));
        const later = window.__voice.state();
        const inertAfter = inert();
        const liveTracks = streams.reduce((n, st) => n + st.getTracks().filter((t) => t.readyState === 'live').length, 0);
        closeVoice();
        return { live, recorderAfter: after.recorder, slotsLater: later.slots, liveTracks,
                 inertDuring, inertAfter, stageLater: later.stage, filledLater: later.slots.filter(Boolean).length };
      } finally { navigator.mediaDevices.getUserMedia = real; }
    });
    if (r.notFull || r.noRecord) bad('the record-over state could not be staged', 'this section proved nothing');
    else if (r.noDel) bad(`the delete control is not shown on the slot being recorded over (slot ${r.live})`, 'this section proved nothing');
    else if (r.recorderAfter || r.liveTracks > 0)
      bad(`deleting the slot being recorded into left the microphone STILL RUNNING (recorder ${r.recorderAfter}, ${r.liveTracks} live track(s))`,
        'the wave is gone, the button is repainted idle and the ring is reset, so nothing on screen says the microphone is open');
    else if (r.slotsLater[r.live])
      bad(`the delete was UNDONE — the in-flight decode wrote a clip back into slot ${r.live}`,
        'the child watched it empty and it filled itself again');
    /* AND THE PANEL HAS TO COME BACK. This section asserted the recorder, the tracks and
     * the slots and never read `pointer-events` -- so the fix for the delete-mid-record
     * defect could leave all four preset tiles, both sliders and the play button
     * permanently dead and every line here still passed. It does not LOOK broken: the
     * slots still play when tapped. It looks like the panel stopped responding, and the
     * whole of the "more to move" this work order exists for is inert.
     *
     * A GUARD THAT SUPPRESSES A CONTINUATION SUPPRESSES EVERYTHING THAT CONTINUATION WAS
     * RESPONSIBLE FOR -- and the repair for one finding is a new assertion that inherits
     * none of the old one's credibility. */
    else if (!r.inertDuring.length)
      bad('nothing was dimmed DURING the recording, so this section cannot tell a restored panel from one that never dims',
        'the positive control failed — this half proved nothing');
    else if (r.inertAfter.length)
      bad(`${r.inertAfter.length} control(s) are STILL pointer-events:none after the delete settled`,
        `${r.inertAfter.join(', ')} at stage '${r.stageLater}' with ${r.filledLater} clip(s) held — the panel is not broken-looking, it is unresponsive, and nothing later lifts it`);
    else ok(`deleting the slot being recorded over stops the microphone, the delete STAYS (slots ${JSON.stringify(r.slotsLater)}), and all ${r.inertDuring.length} control(s) the recording dimmed come back`);
  }

  /* ---- §31. RECORD-OVER FROM A PLAYING SLOT ---------------------------- */
  if (run(31)) {
    /* Playing slot i makes it the target, so a record-over goes to i and the teardown stops
     * that playback — whose `onended` then fires and clears the live slot the RECORDING had
     * just set. 5 of 10 measured runs recorded with no wave anywhere. Six runs at spread
     * gaps, because a race asserted once is a coin. */
    let bad_ = 0, tried = 0;
    for (let k = 0; k < 6; k++) {
      const r = await page.evaluate(async (gap) => {
        closeVoice(); openVoice();
        const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
        for (let i = 0; i < 3; i++) {
          const el = document.getElementById('voiceSlot' + i);
          tap(el); await new Promise((r2) => setTimeout(r2, 620));
          tap(el); await new Promise((r2) => setTimeout(r2, 850));
        }
        if (!window.__voice.state().slots.every(Boolean)) return { notFull: true };
        tap(document.getElementById('voiceSlot1'));
        await new Promise((r2) => setTimeout(r2, gap));
        tap(document.getElementById('voiceRecBtn'));
        await new Promise((r2) => setTimeout(r2, 800));
        const d = () => [0, 1, 2].map((i) => document.querySelector('#voiceSlot' + i + ' .voice-wave').getAttribute('d'));
        const a = d();
        await new Promise((r2) => setTimeout(r2, 220));
        const b = d();
        const st = window.__voice.state();
        closeVoice();
        return { recorder: st.recorder, live: st.liveSlot, moving: a.some((p, i) => p !== b[i]) };
      }, 60 + k * 45);
      if (r.notFull) continue;
      tried++;
      if (!r.recorder) continue;
      if (r.live < 0 || !r.moving) bad_++;
    }
    if (tried < 4) bad(`only ${tried} run(s) reached the record-over state`, 'this section proved nothing');
    else if (bad_) bad(`${bad_} of ${tried} record-overs from a PLAYING slot recorded with no wave on any slot`,
      "the superseded playback's onended cleared the live slot the recording had just set — the microphone is open for 15s and the one signal this work order added is absent");
    else ok(`${tried} record-overs from a playing slot all kept a moving wave on the recording slot`);
  }

  /* ---- §32. THE COUNTDOWN RING MUST BE VISIBLE ------------------------- */
  if (run(32)) {
    /* Its own comment says the child can SEE the end coming. It was painted entirely
     * underneath the opaque record button — animating correctly, and invisible.
     * ASKED BY HIT TEST, not by reading the geometry back out of the code. */
    const ring = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const el = document.getElementById('voiceSlot0');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 800));
      const r0 = document.getElementById('voiceRing');
      if (!r0) return { missing: true };
      const svg = r0.ownerSVGElement, wrap = svg.parentElement;
      const wr = wrap.getBoundingClientRect();
      const cx = wr.left + wr.width / 2, cy = wr.top + wr.height / 2;
      const rr = parseFloat(r0.getAttribute('r')) * (wr.width / parseFloat(svg.getAttribute('width')));
      let covered = 0;
      for (let a = 0; a < 12; a++) {
        const t = a * Math.PI / 6;
        const hit = document.elementFromPoint(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
        if (hit && hit.id === 'voiceRecBtn') covered++;
      }
      const o1 = r0.style.strokeDashoffset;
      await new Promise((r) => setTimeout(r, 700));
      const o2 = r0.style.strokeDashoffset;
      const btn = document.getElementById('voiceRecBtn').getBoundingClientRect();
      stopVoiceRecording();
      await new Promise((r) => setTimeout(r, 900));
      closeVoice();
      return { covered, band: Math.round((rr - btn.width / 2) * 10) / 10, advancing: o1 !== o2 };
    });
    if (ring.missing) bad('there is no countdown ring');
    else if (ring.covered) bad(`the ring is hidden underneath the record button at ${ring.covered} of 12 points`,
      `visible band ${ring.band}px — it animates correctly and nobody can see it, which is the one signal that says how long is left`);
    else if (!ring.advancing) bad('the ring is visible but not advancing');
    else ok(`the countdown ring clears the record button by ${ring.band}px at all 12 points and is advancing`);
  }

  /* ---- §33. NO PRESET MAY BOOST — measured, not reasoned --------------- */
  if (run(33)) {
    /* The lowpass's Q was never set, and NOT SETTING Q IS NOT THE ABSENCE OF RESONANCE:
     * the default is 1, read in dB for a lowpass, a +1.96dB peak. Asked of the filter's own
     * frequency response rather than of the source comment, which asserted the opposite. */
    const g = await page.evaluate(() => {
      const off = new OfflineAudioContext(1, 128, 48000);
      const buf = off.createBuffer(1, 64, 48000);
      const out = [];
      for (const id of ['up', 'down', 'robot', 'cave']) {
        const gr = window.__voice.buildGraph(off, buf, id, window.__voice.presets.find((p) => p.id === id).a.def,
                                             window.__voice.presets.find((p) => p.id === id).b.def);
        const f = gr.nodes.find((n) => n.getFrequencyResponse);
        if (!f) { out.push({ id, peak: 1 }); continue; }
        const hz = new Float32Array(512), mag = new Float32Array(512), ph = new Float32Array(512);
        for (let i = 0; i < 512; i++) hz[i] = 20 * Math.pow(1000, i / 511);
        f.getFrequencyResponse(hz, mag, ph);
        out.push({ id, peak: Math.max(...mag), q: f.Q.value });
      }
      return out;
    });
    const boosting = g.filter((x) => x.peak > 1.001);
    if (boosting.length) bad(`${boosting.length} preset filter(s) BOOST`,
      boosting.map((x) => `${x.id} peak ${x.peak.toFixed(4)} at Q=${x.q}`).join(' | ') + ' — a filter that boosts costs headroom the sweep was not budgeting for');
    else ok(`no preset filter boosts (max response ${Math.max(...g.map((x) => x.peak)).toFixed(4)})`);
  }

  /* ---- §34. BOTH SLIDERS GO INERT WHILE THE MICROPHONE IS OPEN --------- */
  if (run(34)) {
    const sl = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const el = document.getElementById('voiceSlot0');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const read = (id) => { const e = document.getElementById(id); const c = getComputedStyle(e);
        return { id, pe: c.pointerEvents, op: c.opacity }; };
      const out = [read('voiceSlider'), read('voiceSliderB')];
      stopVoiceRecording();
      await new Promise((r) => setTimeout(r, 900));
      closeVoice();
      return out;
    });
    const live = sl.filter((x) => x.pe !== 'none');
    if (live.length) bad(`${live.length} slider(s) are not inert during a recording`,
      live.map((x) => `${x.id} pointer-events ${x.pe}, opacity ${x.op}`).join(' | ') + ' — two identical-looking controls contradicting each other and the "dimmed means unavailable" contract');
    else ok(`both sliders are inert while the microphone is open (${sl.map((x) => x.id + ' ' + x.op).join(', ')})`);
  }

  /* ---- §35. THE CARRIER OF "RECORDING" MUST NOT EMPTY AS THE CLIP RUNS ---
   *
   * "One animation, two meanings" is the right call for WHICH SLOT IS LIVE and it stands.
   * Its consequence is that the slot row cannot tell recording from playing AT ALL, so
   * acceptance 2(a) -- that it is apparent recording is happening -- rests entirely on the
   * transport row. There it rested on two things: the record button's COLOUR (measured
   * 11/255 of luminance between the idle pink and the recording red, which is nothing on a
   * dim screen outdoors) and the COUNTDOWN RING. The ring is a countdown, so IT EMPTIES AS
   * IT RUNS: by the last seconds of a fifteen-second clip the only non-colour
   * discriminator has faded to almost nothing while the microphone is still open.
   *
   * Every other state in this panel is carried twice by design. This one was carried once,
   * and it is the state the work order is named after.
   *
   * §25 CANNOT SEE THIS and it is worth saying why: it photographs at 700ms, when the ring
   * is nearly full, so removing the record button's shape entirely leaves §25 green. The
   * property here is not "the two states differ" -- it is that a carrier of the difference
   * is INVARIANT across the whole recording. Measured at 700ms and again at 90% of the
   * hard stop, with the ring's own decay asserted in between so the late sample is proven
   * to be late. */
  if (run(35)) {
    const car = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const MAX = window.__voice.MAX_RECORD_MS;
      /* NON-COLOUR PROPERTIES ONLY. Shape and size survive a washed-out screen; a
       * background colour does not, and it is the carrier this section exists to replace. */
      const read = () => {
        const g = document.getElementById('voiceRecGlyph');
        if (!g) return null;
        const cs = getComputedStyle(g);
        return { w: cs.width, h: cs.height, r: cs.borderTopLeftRadius, glyphs: (g.textContent || '').trim().length };
      };
      const ringOffset = () => {
        const el = document.getElementById('voiceRing');
        return el ? parseFloat(el.style.strokeDashoffset || '0') : -1;
      };
      const el = document.getElementById('voiceSlot0');
      const tap = (e) => { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                           e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      tap(el);
      await new Promise((r) => setTimeout(r, 700));
      if (!window.__voice.state().recorder) return { noRecord: true };
      const early = read(), ringEarly = ringOffset();
      /* 90% of the hard stop: deep into the countdown, and still comfortably before the
       * timer fires and changes the stage under us. */
      await new Promise((r) => setTimeout(r, MAX * 0.9 - 700));
      const stillRecording = !!window.__voice.state().recorder;
      const late = read(), ringLate = ringOffset();
      tap(el);
      await new Promise((r) => setTimeout(r, 1400));
      const idle = read();
      playVoice(0);
      await new Promise((r) => setTimeout(r, 250));
      const playingLive = window.__voice.state().liveSlot;
      const playing = read();
      closeVoice();
      return { early, late, idle, playing, ringEarly, ringLate, stillRecording, playingLive, MAX };
    });
    const diff = (a, b) => (!a || !b) ? ['missing'] : ['w', 'h', 'r', 'glyphs'].filter((k) => a[k] !== b[k]);
    if (car.noRecord) bad('the recording could not be staged', 'this section proved nothing');
    else if (!car.early || !car.late || !car.playing) bad('the record button has no glyph element to read',
      'there is nothing carrying "recording" but the button\'s colour and the countdown ring');
    else if (!car.stillRecording) bad(`the recorder had already stopped before the late sample (MAX_RECORD_MS ${car.MAX})`,
      'the two samples do not span the countdown, so invariance across it was never tested');
    /* THE POSITIVE CONTROL FOR "LATE": the ring must have visibly emptied between the two
     * samples, or the invariance claim is being made across two moments that are the same
     * moment and it costs nothing. */
    else if (!(car.ringLate > car.ringEarly + 50)) bad(`the countdown ring barely moved between the samples (${car.ringEarly.toFixed(1)} -> ${car.ringLate.toFixed(1)})`,
      'the late sample is not late, so "the carrier survives the countdown" was never asked');
    else if (car.playingLive !== 0) bad(`playback did not start (liveSlot ${car.playingLive})`, 'this section proved nothing');
    else if (!diff(car.early, car.playing).length)
      bad('RECORDING and PLAYING are identical in every non-colour property of the record button',
        `the only things left telling them apart are an 11/255 colour step and the ring — and the ring empties, so by ${(car.MAX * 0.9 / 1000).toFixed(1)}s the microphone is open with nothing on screen that says so`);
    else if (diff(car.early, car.late).length)
      bad(`the recording carrier CHANGES as the clip runs (${diff(car.early, car.late).join(', ')})`,
        `${JSON.stringify(car.early)} at 0.7s became ${JSON.stringify(car.late)} at ${(car.MAX * 0.9 / 1000).toFixed(1)}s — a signal that fades with the countdown is the countdown, not a second carrier`);
    else if (!diff(car.early, car.idle).length)
      bad('RECORDING and the idle panel are identical in every non-colour property of the record button');
    else ok(`the record button carries "recording" by shape (${diff(car.early, car.playing).join(', ')} vs playing) and carries it UNCHANGED from 0.7s to ${(car.MAX * 0.9 / 1000).toFixed(1)}s while the ring empties from ${car.ringEarly.toFixed(0)} to ${car.ringLate.toFixed(0)}`);
  }

  /* ---- §36. THE ARMING WINDOW — the half of "recording" nothing watched ---
   *
   * Between the tap and the grant there is no recorder and no live slot: only
   * `voicePending` and the slot the request was made FOR. On first use that window is as
   * long as the adult takes on the permission bubble, which is the longest and most
   * confusing moment in the panel's life and the one where a bored three-year-old presses
   * things. Two defects lived in it and neither had an assertion.
   *
   * The bubble is SLOWED rather than simulated: the real getUserMedia is called and its
   * resolution delayed, so every path under test is the shipping one. */
  if (run(36)) {
    const r = await page.evaluate(async () => {
      const streams = [];
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c) => real(c).then((st) => {
        streams.push(st);
        return new Promise((res) => setTimeout(() => res(st), 1200));
      });
      try {
        closeVoice(); openVoice();
        const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
        /* Filled without the microphone: this section is about the window BEFORE a
         * microphone exists, and three real grants at 1.2s each would only be slower. The
         * clip is four seconds so the playback below is still running when it is
         * interrupted -- a clip that had already finished would clear the live marker on
         * its own and the defect could not be reached. */
        const ctx = getAudioCtx();
        for (let i = 0; i < 3; i++) window.voiceSlots[i] = ctx.createBuffer(1, 24000 * 4, 24000);
        paintVoiceSlots(); voiceSetStage('ready');

        playVoice(0);
        await new Promise((r2) => setTimeout(r2, 250));
        const livePlaying = window.__voice.state().liveSlot;

        tap(document.getElementById('voiceRecBtn'));
        await new Promise((r2) => setTimeout(r2, 350));
        const arming = window.__voice.state();

        const del = document.querySelector('#voiceSlot0 .voice-slot-del');
        const delShown = del && getComputedStyle(del).display !== 'none';
        if (delShown) tap(del);
        await new Promise((r2) => setTimeout(r2, 1600));
        const after = window.__voice.state();
        const liveTracks = streams.reduce((n, st) => n + st.getTracks().filter((t) => t.readyState === 'live').length, 0);
        const inert = ['voiceSlider', 'voiceSliderB'].filter((id) => {
          const e = document.getElementById(id); return e && getComputedStyle(e).pointerEvents === 'none'; });
        closeVoice();
        return { livePlaying, armStage: arming.stage, armPending: arming.pending, armLive: arming.liveSlot,
                 armTarget: arming.target, delShown, after, liveTracks, inert, grants: streams.length };
      } finally { navigator.mediaDevices.getUserMedia = real; }
    });
    if (r.livePlaying !== 0) bad(`the playback that gets interrupted never started (liveSlot ${r.livePlaying})`, 'this section proved nothing');
    else if (!r.armPending) bad(`the arming window was not staged (stage '${r.armStage}', pending ${r.armPending})`, 'this section proved nothing');
    /* M2 — A SLOT WAVING "LIVE" WHILE SILENT, FOR THE WHOLE WINDOW. `stopVoicePlayback`
     * stopped the nodes and never cleared `voiceLiveSlot`, and the fix that made a
     * superseded `onended` a total no-op removed the last thing that happened to clear it
     * by accident. So the slot that had been playing kept waving at full amplitude inside
     * its amber ring while it was silent and the microphone was not yet open. MOVEMENT
     * MEANS LIVE is the whole design, and it was false for exactly this window. */
    else if (r.armLive >= 0) bad(`slot ${r.armLive} is still marked LIVE through the arming window`,
      'it waves at full amplitude in a thick ring while it is silent and the microphone is not yet open — on first use, for as long as the adult takes on the permission bubble');
    else if (!r.delShown) bad('the delete control is not shown on the slot being recorded over', 'this section proved nothing');
    /* M1 — DELETING DURING THE BUBBLE. `voiceDeletedDuringRecord` was set from a guard
     * reading `voiceRecorder && voiceLiveSlot === i`, and during arming both are unset --
     * so the grant opened a recorder for a slot the child had just emptied and the decode
     * wrote the clip back in. F1's shape on the half of the window F1's fix did not cover. */
    else if (r.after.slots[0]) bad('the delete was UNDONE by a grant that landed after it',
      'the child emptied the slot during the permission bubble and the microphone filled it again');
    else if (r.after.recorder || r.liveTracks > 0)
      bad(`a microphone opened for a slot that no longer exists (recorder ${r.after.recorder}, ${r.liveTracks} live track(s))`,
        'the request was abandoned before the grant arrived; a recording whose slot is gone must not start');
    else if (r.inert.length) bad(`${r.inert.length} control(s) are still pointer-events:none after the abandoned grant settled`, r.inert.join(', '));
    else ok(`through the permission bubble no slot claims to be live, and a delete during it is not undone by the grant (${r.grants} grant(s), ${r.liveTracks} live track(s), stage '${r.after.stage}')`);
  }

  /* ---- §37. NOTHING OUTLIVES THE THING IT BELONGS TO -------------------- */
  if (run(37)) {
    const r = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const MAX = window.__voice.MAX_RECORD_MS;
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      const s0 = document.getElementById('voiceSlot0');
      tap(s0);
      const t0 = Date.now();
      await new Promise((r2) => setTimeout(r2, 900));
      if (!window.__voice.state().recorder) return { noFirst: true };
      tap(s0);                                   /* stopped EARLY, well inside its cap */
      await new Promise((r2) => setTimeout(r2, 1300));
      const timersAfterStop = window.__voice.state().timers;

      tap(document.getElementById('voiceSlot1'));
      await new Promise((r2) => setTimeout(r2, 800));
      if (!window.__voice.state().recorder) return { noSecond: true, timersAfterStop };
      /* PAST THE MOMENT THE FIRST RECORDING'S CAP WOULD HAVE FIRED, and still well short
       * of the second recording's own. If an orphan timer is out there, this is when it
       * reaches in and stops a recording it has nothing to do with. */
      const waitFor = t0 + MAX + 600 - Date.now();
      await new Promise((r2) => setTimeout(r2, Math.max(200, waitFor)));
      const secondAlive = window.__voice.state().recorder;
      const elapsed = Date.now() - t0;
      stopVoiceRecording();
      await new Promise((r2) => setTimeout(r2, 1300));

      /* AND THE PLAYBACK GRAPH. A natural end only cleared the live marker, so a finished
       * `robot` playback left an oscillator running and connected to the destination. */
      window.voicePreset = 'robot';
      playVoice(0);
      await new Promise((r2) => setTimeout(r2, 250));
      const nodesDuring = window.__voice.state().nodes;
      await new Promise((r2) => setTimeout(r2, 2200));
      const nodesAfter = window.__voice.state().nodes;
      const live = window.__voice.state().liveSlot;
      closeVoice();
      return { timersAfterStop, secondAlive, elapsed, MAX, nodesDuring, nodesAfter, live };
    });
    if (r.noFirst || r.noSecond) bad('two recordings could not be staged', `first ${!r.noFirst}, second ${!r.noSecond} — this section proved nothing`);
    /* L1 — `clearVoiceTimers` has exactly one caller, `closeVoice`, so a recording stopped
     * EARLY left its hard-stop timer running with nothing to cancel it: one timer per
     * recording ever started in the session, each of them able to stop a LATER recording
     * at a moment its own ring says is not yet. `voiceRingTick`'s comment claims there is
     * only one clock. */
    else if (r.timersAfterStop !== 0) bad(`${r.timersAfterStop} timer(s) survived a recording that was stopped early`,
      'the hard-stop timer belongs to that recording and outlived it — it will stop whatever is recording when it fires');
    else if (!r.secondAlive) bad(`a later recording was stopped by an earlier one's orphaned timer at ${(r.elapsed / 1000).toFixed(1)}s`,
      `its own cap is ${(r.MAX / 1000).toFixed(0)}s away and its ring still shows time left — two clocks that disagree, and the child sees the one that is wrong`);
    else if (!r.nodesDuring) bad('the playback never built any nodes', 'this section proved nothing about releasing them');
    else if (r.nodesAfter) bad(`${r.nodesAfter} playback node(s) are still connected after the clip ended on its own`,
      'a finished robot playback leaves an oscillator running into the destination until the next play or teardown — inaudible, and exactly the leak the teardown discipline everywhere else in this file exists to prevent');
    else if (r.live >= 0) bad(`slot ${r.live} is still marked live after its playback ended`);
    else ok(`a recording stopped early takes its own hard-stop timer with it, a later one survives past ${(r.elapsed / 1000).toFixed(1)}s, and a playback that ends on its own releases all ${r.nodesDuring} of its nodes`);
  }

  /* ---- §38. THE SETTLE WINDOW MUST NOT SWALLOW A STOP -------------------
   *
   * The window after a delete exists because the delete control VANISHES from under the
   * finger and the second tap of a double-tap lands on the slot beneath it. It was checked
   * ABOVE the stop branch, where it also ate a first tap: delete a slot, tap the record
   * button -- `nextVoiceSlot` picks the slot just emptied -- the grant lands in well under
   * 400ms, and the child's tap on the now-live slot did nothing at all. A guard against a
   * second tap must never eat a first one. */
  if (run(38)) {
    const r = await page.evaluate(async () => {
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      const attempts = [];
      /* THREE TRIES AND THE FASTEST IS THE ONE THAT COUNTS. The gesture has to complete
       * inside the settle window to test anything, and a loaded runner can miss it; a
       * scenario that missed is reported as a miss, never as a pass. */
      for (let k = 0; k < 3; k++) {
        closeVoice(); openVoice();
        const ctx = getAudioCtx();
        window.voiceSlots[0] = ctx.createBuffer(1, 24000, 24000);
        window.voiceSlots[1] = ctx.createBuffer(1, 24000, 24000);
        paintVoiceSlots(); voiceSetStage('ready');
        const del = document.querySelector('#voiceSlot1 .voice-slot-del');
        if (!del || getComputedStyle(del).display === 'none') { attempts.push({ noDel: true }); continue; }
        tap(del);                                   /* slot 1 is now the first empty one */
        const t0 = Date.now();
        tap(document.getElementById('voiceRecBtn'));
        let waited = 0;
        while (!window.__voice.state().recorder && waited < 320) {
          await new Promise((r2) => setTimeout(r2, 20)); waited += 20;
        }
        const st = window.__voice.state();
        if (!st.recorder || st.liveSlot !== 1) { attempts.push({ notStaged: true, live: st.liveSlot }); continue; }
        const gap = Date.now() - t0;
        tap(document.getElementById('voiceSlot1'));  /* the child taps the waving slot to stop */
        await new Promise((r2) => setTimeout(r2, 500));
        attempts.push({ gap, stopped: !window.__voice.state().recorder });
        stopVoiceRecording();
        await new Promise((r2) => setTimeout(r2, 900));
      }
      closeVoice();
      return { attempts };
    });
    const inWindow = r.attempts.filter((a) => typeof a.gap === 'number' && a.gap < 380);
    if (!inWindow.length) bad('no attempt reached the live slot inside the settle window',
      `${JSON.stringify(r.attempts)} — this section proved nothing`);
    else if (!inWindow.some((a) => a.stopped)) bad(`the stop tap was SWALLOWED in all ${inWindow.length} attempt(s) inside the window`,
      `gaps ${inWindow.map((a) => a.gap + 'ms').join(', ')} — the slot is the stop button and the guard against a second tap ate the first one; the only way out is the record button, which is not where the child is looking`);
    else ok(`a tap on the live slot ${inWindow[0].gap}ms after a delete still stops the recording — the settle window guards the slot's own action, not the stop`);
  }

} finally { await browser.close(); server.close(); }

if (failures.length) {
  console.error(`\n::error::CHECK 26 FAILED — ${failures.length} — the voice panel.`);
  console.error(`\nCHECK 26 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
if (!asserted) {
  console.error(`\n::error::CHECK 26 asserted NOTHING${ONLY ? ` \u2014 --only=${ONLY} selected no live section` : ''}.`);
  console.error('A banner is a claim about assertions that ran. Zero of them ran.');
  process.exit(1);
}
/* THE FULL PROSE IS A CLAIM ABOUT A FULL RUN. Under --only it is a claim about sections
 * that did not execute, which is the same sentence check 25 exists to catch. */
if (ONLY) {
  console.log(`\nCHECK 26 PASSED at ${COMMIT.slice(0, 12)} \u2014 sections ${ONLY}, ${asserted} assertion(s).`);
  process.exit(0);
}
console.log(`\nCHECK 26 PASSED at ${COMMIT.slice(0, 12)} \u2014 button 0 opens the panel to a real finger with the pad still 4+4; four presets are spectrally distinct through the shipping graph builder, null result first; every value on BOTH axes is clamped and nothing clips or goes silent across the full 144-position preset x slider grid; NO MICROPHONE SURVIVES TEARDOWN from any state, including repeated taps during a pending grant and a grant \u2014 or a REJECTION \u2014 that crosses a teardown; one finger tap leaves from idle, mid-record and mid-playback; the recorder stops on its own timer; an open microphone locks out playback; an abandoned clip does not appear in the next panel; the panel is INDISTINGUISHABLE configured and unconfigured; a full voice session asks for ZERO channels and makes ZERO outbound requests; the map opens, tracks a real fix, draws and clears while telling no other device where the child is; AND \u2014 PUP-WO-0703 \u2014 WITH THE WAVE STILLED AND EVERY PAINTED WORD HIDDEN, empty / recording / holding / playing all photograph DIFFERENTLY and the live slot is identified, with the camera shown able to report both a difference and a sameness first; the three slot states differ WITHOUT relying on colour; the wave MOVES while recording and while playing and is still otherwise; reduced motion stills it without making it ambiguous; three slots record, record over and delete under a finger; deleting the slot the microphone is filling STOPS it and the delete stays; a record-over from a PLAYING slot keeps its wave across six runs; the countdown ring clears the record button and advances; no preset filter boosts; both sliders go inert while the microphone is open; the record button carries RECORDING by a SHAPE that is unchanged from 0.7s to the last seconds of the clip while the ring empties beneath it; no slot claims to be live through the permission bubble and a delete during that bubble is not undone by the grant that follows it; a recording stopped early takes its own hard-stop timer with it, a later recording survives past the moment that timer would have fired, and a playback that ends on its own releases every node it built; and the settle window after a delete guards the slot's own action without swallowing the tap that stops a recording.`);
