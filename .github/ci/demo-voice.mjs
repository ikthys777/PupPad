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
 * BUILDER — window.__voice.buildGraph, the same function live playback and the send
 * render call — into an OfflineAudioContext, and their band energies are compared. A
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
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const run = (n) => !ONLY || ONLY.split(',').includes(String(n));

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
    const spec = await page.evaluate(async () => {
      if (!window.__voice || !window.__voice.buildGraph) return { missing: true };
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
      async function render(id, value) {
        const probe = new OfflineAudioContext(1, 8, SR);
        const buf = makeBuf(probe);
        const secs = window.__voice.renderSeconds(buf, id, value);
        const off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR);
        const src = makeBuf(off);
        const g = window.__voice.buildGraph(off, src, id, value);
        g.out.connect(off.destination);
        g.source.start();
        const out = await off.startRendering();
        return { spec: spectrum(out.getChannelData(0), SR), secs: out.duration };
      }
      const ps = window.__voice.presets;
      const rendered = {};
      for (const p of ps) rendered[p.id] = await render(p.id, p.def);
      /* THE NULL RESULT, FIRST. The same preset rendered twice must come out identical;
       * an instrument that has never reported "same" cannot be trusted to report
       * "different". */
      const again = await render(ps[0].id, ps[0].def);
      const nullDist = cosDist(rendered[ps[0].id].spec, again.spec);
      const pairs = [];
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        pairs.push({ a: ps[i].id, b: ps[j].id, d: cosDist(rendered[ps[i].id].spec, rendered[ps[j].id].spec) });
      }
      return { nullDist, pairs, secs: ps.map((p) => ({ id: p.id, s: rendered[p.id].secs })) };
    });

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
      const probes = [
        { id: 'up', v: 1e6, read: (g) => g.source.playbackRate.value, lo: 0.55, hi: 2.2 },
        { id: 'down', v: -1e6, read: (g) => g.source.playbackRate.value, lo: 0.55, hi: 2.2 },
        { id: 'up', v: NaN, read: (g) => g.source.playbackRate.value, lo: 0.55, hi: 2.2 },
        { id: 'robot', v: 1e9, read: (g) => g.nodes.find((n) => n.frequency).frequency.value, lo: 20, hi: 220 },
        { id: 'cave', v: 99, read: (g) => g.nodes.find((n) => n.delayTime).delayTime.value, lo: 0.06, hi: 0.40 },
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
          const g = window.__voice.buildGraph(off, buf, p.id, p.v);
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
      const cg = window.__voice.buildGraph(off, buf, 'cave', 0.2);
      const fb = cg.nodes.filter((n) => n.gain && n !== cg.out).map((n) => n.gain.value);
      return { out, fb };
    });
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
    const peaks = await page.evaluate(async () => {
      const SR = 24000, DUR = 0.4;
      const out = [];
      for (const p of window.__voice.presets) {
        for (let i = 0; i <= 8; i++) {
          const v = p.min + (p.max - p.min) * (i / 8);
          const probe = new OfflineAudioContext(1, 8, SR);
          const mk = (c) => { const b = c.createBuffer(1, Math.floor(SR * DUR), SR); const d = b.getChannelData(0);
            for (let k = 0; k < d.length; k++) { const t = k / SR;
              d[k] = 0.5 * Math.sin(2 * Math.PI * 200 * t) + 0.3 * Math.sin(2 * Math.PI * 400 * t) + 0.2 * Math.sin(2 * Math.PI * 800 * t); }
            return b; };
          const secs = window.__voice.renderSeconds(mk(probe), p.id, v);
          const off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR);
          const g = window.__voice.buildGraph(off, mk(off), p.id, v);
          g.out.connect(off.destination); g.source.start();
          const r = await off.startRendering();
          const d = r.getChannelData(0);
          let pk = 0, sum = 0;
          for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > pk) pk = a; sum += d[k] * d[k]; }
          out.push({ id: p.id, v: Number(v.toFixed(3)), peak: pk, rms: Math.sqrt(sum / d.length) });
        }
      }
      return out;
    });
    const clipped = peaks.filter((x) => x.peak > 1);
    const silent = peaks.filter((x) => x.rms < 0.005);
    if (clipped.length) bad(`${clipped.length} of ${peaks.length} preset/slider positions CLIP (peak > 1)`,
      clipped.slice(0, 4).map((x) => `${x.id}@${x.v} peak ${x.peak.toFixed(2)}`).join(' | ') + ' — hard clipping is a buzz in a child\'s ear');
    else if (silent.length) bad(`${silent.length} position(s) are effectively SILENT`,
      silent.slice(0, 4).map((x) => `${x.id}@${x.v} rms ${x.rms.toFixed(4)}`).join(' | '));
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
    /* THE ASSERTION FOR "A REQUIREMENT AND ITS BACKSTOP MUST NOT BE THE SAME NUMBER" COULD
     * NOT FIRE. It was an `else if` behind `rec !== 15000`, so reaching it required
     * rec === 15000 AND rec === inbound — i.e. MAX_INBOUND_BYTES === 15000, which it never
     * is. The one place this repo checks its own most-repeated rule was unfalsifiable, and
     * its plant demonstrated the OTHER branch. Independent assertions now, and each named
     * value is asserted rather than merely printed: MAX_INBOUND_BYTES was interpolated
     * into the pass line without being checked, so deleting it read "is undefined bytes"
     * and still passed. */
    const named = [['MAX_RECORD_MS', nums.rec], ['MAX_INBOUND_BYTES', nums.inbound],
                   ['MAX_INBOUND_AUDIO_BYTES', nums.audio], ['MAX_INBOUND_SECONDS', nums.secs]];
    const missing = named.filter(([, v]) => typeof v !== 'number' || !isFinite(v) || v <= 0);
    if (missing.length) bad(`${missing.length} bound(s) are not live numbers`, missing.map(([n, v]) => `${n}=${v}`).join(', '));
    else ok(`all four bounds are live numbers: ${named.map(([n, v]) => `${n}=${v}`).join(', ')}`);

    if (nums.rec !== 15000) bad(`MAX_RECORD_MS is ${nums.rec}, not 15000`);
    else ok('MAX_RECORD_MS is 15000 — the requirement');
    if (nums.rec === nums.inbound) bad('the requirement and its backstop are the SAME NUMBER',
      'a duration cap and a byte cap must fail differently; one derived from the other is one guard wearing two hats');
    else if (nums.audio >= nums.inbound) bad(`the audio cap (${nums.audio}) is not tighter than the general one (${nums.inbound})`,
      'then it bounds nothing the general cap did not already bound');
    else ok(`the caps are independent: a ${nums.rec} ms duration, a ${nums.inbound} B general cap, a tighter ${nums.audio} B audio cap, and a ${nums.secs} s decoded-duration cap`);

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

  /* ---- §8. ACCEPTANCE 7 — SUPABASE UNCONFIGURED ------------------------- */
  if (run(8)) {
    const degraded = await page.evaluate(async () => {
      const realGet = window.getSupabaseClient, realCfg = window.isSupabaseConfigured;
      window.getSupabaseClient = () => null;
      window.isSupabaseConfigured = () => false;
      try {
        openVoice();
        const st = window.__voice.state();
        let threw = null;
        /* sendVoice() RETURNS EARLY WITH NO CLIP, so calling it on an empty panel walks
         * none of the code this section is about -- a plant that broke broadcastVoice
         * went green because nothing ever reached it. Give the panel a clip, and drive
         * the wire call directly as well. */
        try {
          const probe = new OfflineAudioContext(1, 2400, 24000);
          window.voiceBuffer = probe.createBuffer(1, 2400, 24000);
          sendVoice();
          broadcastVoice('data:audio/webm;base64,AAAA');
        } catch (e) { threw = String((e && e.message) || e); }
        try { playVoice(); } catch (e) { threw = threw || String((e && e.message) || e); }
        const after = window.__voice.state();
        closeVoice();
        return { open: st.open, channel: st.channel, threw, stillOpen: after.open };
      } finally { window.getSupabaseClient = realGet; window.isSupabaseConfigured = realCfg; }
    });
    if (!degraded.open) bad('the panel does not open at all with Supabase unconfigured');
    else if (degraded.channel) bad('a channel was created with no client');
    else if (degraded.threw) bad('sending with Supabase unconfigured throws', degraded.threw);
    else ok('with Supabase unconfigured the panel opens, no channel is created, and send is a silent no-op — exactly as the camera degrades');
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
        return { knobX: kr.left + kr.width / 2, v: Number(t.getAttribute('aria-valuenow')), lo: p.min, hi: p.max };
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
  /* ---- §11. ACCEPTANCE 4 — A SENT CLIP ARRIVES ON A SECOND DEVICE ------
   *
   * TWO PAGES, AND NEITHER SIDE IS SIMULATED WHERE IT MATTERS. Page A records through a
   * fake microphone and calls the real sendVoice, which renders the chosen effect and
   * produces the bytes it would broadcast. Page B stands a fake CLIENT in front of
   * joinVoiceChannel — so the app registers ITS OWN inbound handler on it — and that
   * captured handler is then invoked with page A's actual payload.
   *
   * What is stubbed is Supabase's delivery. What is exercised is everything this work
   * order is responsible for: render, encode, gate, decode, play. Feeding a payload to a
   * function the check chose would prove nothing about which function the app listens
   * with; this drives the callback the app itself installed.
   *
   * AND THE NEGATIVE CONTROL RUNS THROUGH THE SAME DOOR. A hostile payload delivered to
   * that same handler must produce nothing. An arrival test with no refusal test cannot
   * tell "it works" from "it accepts anything". */
  if (run(11)) {
    const sent = await page.evaluate(async () => {
      if (!document.getElementById('voiceOverlay')) openVoice();
      let captured = null;
      const realGet = window.getSupabaseClient;
      window.getSupabaseClient = () => ({
        channel: () => ({ on() { return this; }, subscribe() { return this; },
                          send(m) { captured = m && m.payload && m.payload.dataUrl; } }),
        removeChannel() {},
      });
      try {
        window.voiceChannel = null;
        joinVoiceChannel();
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        document.getElementById('voiceRecBtn').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 700));
        stopVoiceRecording();
        await new Promise((r) => setTimeout(r, 700));
        if (!window.__voice.state().stage || window.__voice.state().stage !== 'ready') return { noClip: true };
        sendVoice();
        await new Promise((r) => setTimeout(r, 2500));
        closeVoice();
        return { url: captured, len: captured ? captured.length : 0,
                 passesOwnGate: !!(captured && safeMediaUrl(captured, 'audio')) };
      } finally { window.getSupabaseClient = realGet; }
    });

    if (sent.noClip) bad('page A never produced a clip to send', 'this section proved nothing');
    else if (!sent.url) bad('sendVoice broadcast nothing at all',
      'it rendered, encoded, and then refused its own payload — check the media type against the gate');
    else if (!sent.passesOwnGate)
      /* ASKED OF THE SHIPPING GATE, NOT OF A REGEX WRITTEN HERE. The first version of
       * this line carried its own looser pattern and would have passed the very payload
       * safeMediaUrl was rejecting — a check disagreeing with the code it checks, in the
       * direction that hides the defect. */
      bad('the payload this device SENDS is refused by the gate this device RUNS',
        `type ${JSON.stringify(sent.url.slice(0, 48))} — every clip is refused on the sending side and nothing ever crosses`);
    else {
      ok(`page A rendered and broadcast a ${Math.round(sent.len / 1024)} KiB data:audio payload`);

      const page2 = await ctx.newPage();
      try {
        await page2.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
        await page2.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
        const got = await page2.evaluate(async (url) => {
          let handler = null;
          const realGet = window.getSupabaseClient;
          window.getSupabaseClient = () => ({
            channel: () => ({ on(_t, _f, cb) { handler = cb; return this; }, subscribe() { return this; }, send() {} }),
            removeChannel() {},
          });
          try {
            window.voiceChannel = null;
            joinVoiceChannel();
            if (!handler) return { noHandler: true };
            const count = () => document.querySelectorAll('body > div').length;
            /* The negative control FIRST, so a popup that was already there cannot be
             * mistaken for the real arrival. */
            const base = count();
            handler({ payload: { dataUrl: 'https://example.invalid/evil.mp3' } });
            handler({ payload: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } });
            await new Promise((r) => setTimeout(r, 500));
            const afterHostile = count();
            handler({ payload: { dataUrl: url } });
            await new Promise((r) => setTimeout(r, 1200));
            return { base, afterHostile, afterReal: count() };
          } finally { window.getSupabaseClient = realGet; }
        }, sent.url);

        if (got.noHandler) bad('the second device registered no inbound handler', 'joinVoiceChannel never called .on()');
        else if (got.afterHostile > got.base) bad('a hostile payload produced a reaction on the second device',
          'a remote URL and an image offered as audio must both be refused at the gate');
        else if (got.afterReal <= got.afterHostile) bad('the real clip produced NOTHING on the second device',
          'it was sent, it passed the gate, and nothing played — acceptance item 4 is not met');
        else ok('the clip arrives on a second device and plays, while a remote URL and an image-as-audio are both refused at the same door');
      } finally { await page2.close(); }
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

  /* ---- §13. THE SEND MUST SURVIVE THE CHILD, AND NOT SURVIVE THE EXIT ----
   *
   * Two opposite failures with one cause: the render graph sharing a node list with
   * playback, and its stop timer sharing a list with everything teardown clears. */
  if (run(13)) {
    const trunc = await page.evaluate(async () => {
      let captured = null;
      const realGet = window.getSupabaseClient;
      window.getSupabaseClient = () => ({
        channel: () => ({ on() { return this; }, subscribe() { return this; },
                          send(m) { captured = m && m.payload && m.payload.dataUrl; } }),
        removeChannel() {},
      });
      try {
        closeVoice(); openVoice(); window.voiceChannel = null; joinVoiceChannel();
        const b = document.getElementById('voiceRecBtn');
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 1400));
        stopVoiceRecording();
        await new Promise((r) => setTimeout(r, 800));
        if (window.__voice.state().stage !== 'ready') return { noClip: true };
        const dur = window.voiceBuffer.duration;
        sendVoice();
        /* The child taps PLAY to hear it again while it is still going out. */
        await new Promise((r) => setTimeout(r, 350));
        playVoice();
        await new Promise((r) => setTimeout(r, 3000));
        closeVoice();
        return { dur, len: captured ? captured.length : 0 };
      } finally { window.getSupabaseClient = realGet; }
    });
    if (trunc.noClip) bad('no clip was produced', 'this section proved nothing');
    else {
      /* Compared against the clip's OWN duration, not a hard-coded byte count: a
       * threshold in bytes would be a number only correct at one bitrate. */
      const floor = Math.round(trunc.dur * 4000);
      if (trunc.len < floor) bad(`tapping PLAY during a send truncated the clip on the wire`,
        `${trunc.len} base64 chars for a ${trunc.dur.toFixed(2)}s clip — playback and the render shared a node list, so a playback control stopped the render's source mid-flight`);
      else ok(`a playback control pressed during a send does not truncate it (${trunc.len} chars for ${trunc.dur.toFixed(2)}s)`);
    }

    const orphanRec = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const b = document.getElementById('voiceRecBtn');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      stopVoiceRecording();
      await new Promise((r) => setTimeout(r, 800));
      if (window.__voice.state().stage !== 'ready') return { noClip: true };
      sendVoice();
      await new Promise((r) => setTimeout(r, 200));
      const during = window.__voice.state().sendRecorder;
      closeVoice();
      await new Promise((r) => setTimeout(r, 2000));
      const st = window.__voice.state();
      return { during, after: st.sendRecorder, sendNodes: st.sendNodes };
    });
    if (orphanRec.noClip) bad('no clip was produced for the exit-during-send probe');
    else if (orphanRec.during !== 'recording') bad('the render was not running when the exit was pressed', 'this probe proved nothing');
    else if (orphanRec.after !== 'none') bad(`the render's recorder is STILL ${orphanRec.after} after teardown`,
      'its only stop trigger was a timer in the list closeVoice clears, so it encodes silence on the shared context forever — once per send-then-exit');
    else ok(`the render's recorder was running, and teardown stopped it (${orphanRec.sendNodes} send nodes left)`);
  }

  /* ---- §14. A REMOTE CLIP IS AUDIO THE CHILD DID NOT START -------------- */
  if (run(14)) {
    const inb = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const ctx = getAudioCtx();
      /* TWO INSTRUMENTS THAT DO NOT DEPEND ON THE APP'S OWN BOOKKEEPING.
       *
       * The first version of this section used `state().inbound` both as the witness that
       * a clip had STARTED and as the test of whether the exit could REACH it — the same
       * variable for the subject and the instrument. Untracking the source therefore made
       * the section report "nothing ever played", not "nothing could stop it". So every
       * started BufferSource is recorded here, independently, and `onended` tells us which
       * are still sounding.
       *
       * The second instrument counts decodeAudioData calls, because the byte cap's whole
       * job is to prevent the ALLOCATION — and a payload the decoder rejects looks exactly
       * like a payload the cap refused if you only watch what plays. */
      const started = [];
      const realStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) {
        const rec = { node: this, ended: false };
        started.push(rec);
        this.addEventListener('ended', () => { rec.ended = true; });
        return realStart.apply(this, a);
      };
      let decodes = 0;
      const realDecode = ctx.decodeAudioData.bind(ctx);
      ctx.decodeAudioData = function (...a) { decodes++; return realDecode(...a); };
      /* A real, long, legitimate clip, encoded the way the app encodes. */
      const secs = 6;
      const off = new OfflineAudioContext(1, 48000 * secs, 48000);
      const buf = off.createBuffer(1, 48000 * secs, 48000);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin(2 * Math.PI * 300 * (i / 48000));
      const dest = ctx.createMediaStreamDestination();
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(dest); src.start();
      const rec = new MediaRecorder(dest.stream);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const url = await new Promise((res) => {
        rec.onstop = () => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(new Blob(chunks, { type: (chunks[0].type || 'audio/webm').split(';')[0] }));
        };
        rec.start(); setTimeout(() => rec.stop(), 2200);
      });
      try { src.stop(); src.disconnect(); } catch (e) {}

      const beforeStart = started.length;
      playRemoteVoice(url);
      await new Promise((r) => setTimeout(r, 900));
      const mine = started.slice(beforeStart);
      const playing = mine.filter((r) => !r.ended).length;
      closeVoice();
      await new Promise((r) => setTimeout(r, 400));
      const stillPlaying = mine.filter((r) => !r.ended).length;
      const after = window.__voice.state();

      /* The cap's job is to stop the ALLOCATION, so the evidence is that the decoder was
       * never reached — not that nothing played, which a corrupt payload also achieves. */
      const decodesBefore = decodes;
      playRemoteVoice('data:audio/webm;base64,' + 'A'.repeat(2 * 1024 * 1024));
      await new Promise((r) => setTimeout(r, 200));
      const refusedBeforeDecoding = decodes === decodesBefore;

      AudioBufferSourceNode.prototype.start = realStart;
      ctx.decodeAudioData = realDecode;
      return { playing, stillPlaying, popups: after.popups, overLong: refusedBeforeDecoding };
    });
    if (!inb.playing) bad('an inbound clip never started playing', 'this section proved nothing');
    else if (inb.stillPlaying > 0) bad(`${inb.stillPlaying} remote clip(s) STILL PLAYING after the exit`,
      'the child pressed the one control this app promises from every state and a stranger’s audio kept playing over the console with nothing able to stop it');
    else if (inb.popups > 0) bad(`${inb.popups} INCOMING popup(s) outlived the panel`);
    else if (!inb.overLong) bad('an oversized inbound audio payload was accepted for decoding',
      'decodeAudioData was reached — the byte cap bounds the STRING, and the decoder allocates the full PCM, which low-bitrate Opus expands by hundreds of times');
    else ok(`a remote clip plays, the exit stops it, no popup outlives the panel, and an oversized audio payload is refused before decoding`);
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
      let delay = 900;
      navigator.mediaDevices.getUserMedia = (c) => real(c).then((st) => {
        all.push(st);
        const d = delay;
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
        delay = 500;
        tap();                                   /* B issued */
        await new Promise((r2) => setTimeout(r2, 900));  /* A settles here */
        tap();                                   /* C — only possible if A unlocked the guard */
        await new Promise((r2) => setTimeout(r2, 1600));
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

  /* ---- §16. THE CAP MUST BOUND ALLOCATIONS, NOT JUST VOICES ------------- */
  if (run(16)) {
    const flood = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const ctx = getAudioCtx();
      let peak = 0, live = 0;
      const realDecode = ctx.decodeAudioData.bind(ctx);
      /* Count decodes IN FLIGHT. `decodeAudioData` is what allocates the PCM, so the
       * question is how many can be allocating at the same instant -- not how many end up
       * audible, which is all `voiceInbound.length` could ever have measured. */
      ctx.decodeAudioData = function (buf, ok2, err) {
        live++; if (live > peak) peak = live;
        const done = () => { live--; };
        return realDecode(buf, (b) => { done(); if (ok2) ok2(b); }, (e) => { done(); if (err) err(e); });
      };
      try {
        const url = 'data:audio/webm;base64,' + 'A'.repeat(2048);
        for (let i = 0; i < 40; i++) playRemoteVoice(url);
        await new Promise((r) => setTimeout(r, 700));
        return { peak, max: window.VOICE_MAX_INBOUND };
      } finally { ctx.decodeAudioData = realDecode; closeVoice(); }
    });
    if (flood.peak === 0) bad('no decode was ever started', 'this section proved nothing');
    else if (flood.peak > flood.max) bad(`${flood.peak} decodes ran at once against a cap of ${flood.max}`,
      'the guard counted clips that were SOUNDING, and nothing joins that list until a decode SUCCEEDS — so a burst all read zero, all passed, and all allocated. The multiplier is the message rate, which nothing bounds');
    else ok(`a 40-message burst never exceeds ${flood.peak} concurrent decode(s) against a cap of ${flood.max}`);
  }

  /* ---- §17. AN OPEN MICROPHONE LOCKS OUT PLAYBACK ----------------------- */
  if (run(17)) {
    const lock = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const b = document.getElementById('voiceRecBtn');
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      tap(b);
      await new Promise((r) => setTimeout(r, 900));
      tap(b);                                    /* stop — clip 1 exists */
      await new Promise((r) => setTimeout(r, 900));
      if (window.__voice.state().stage !== 'ready') return { noClip: true };
      tap(b);                                    /* record again */
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

  /* ---- §19. THE DECODED-DURATION CAP, WHICH NOTHING ASSERTED ------------ */
  if (run(19)) {
    const dur = await page.evaluate(async () => {
      closeVoice(); openVoice();
      const cap = window.MAX_INBOUND_SECONDS;
      const ctx = getAudioCtx();
      let started = 0;
      const realStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) { started++; return realStart.apply(this, a); };
      const realDecode = ctx.decodeAudioData.bind(ctx);
      /* The cap must hold WHATEVER the codec's expansion ratio turns out to be, so the
       * decoder is made to return an over-long buffer directly — which is the only way to
       * test the property without depending on a particular encoder's bitrate. */
      ctx.decodeAudioData = function (_b, ok2) {
        const long = ctx.createBuffer(1, Math.ceil(8000 * (cap + 5)), 8000);
        if (ok2) ok2(long);
        return Promise.resolve(long);
      };
      try {
        const before = started;
        playRemoteVoice('data:audio/webm;base64,' + 'A'.repeat(2048));
        await new Promise((r) => setTimeout(r, 400));
        return { cap, played: started - before };
      } finally {
        ctx.decodeAudioData = realDecode;
        AudioBufferSourceNode.prototype.start = realStart;
        closeVoice();
      }
    });
    if (dur.played > 0) bad(`a clip longer than MAX_INBOUND_SECONDS (${dur.cap}s) was PLAYED`,
      'the duration cap is the half of the inbound bound that stays true whatever the next codec expands by — and deleting the line left the whole suite green');
    else ok(`a decoded clip longer than ${dur.cap}s is refused before it sounds`);
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

} finally { await browser.close(); server.close(); }

if (failures.length) {
  console.error(`\n::error::CHECK 26 FAILED — ${failures.length} — the voice panel.`);
  console.error(`\nCHECK 26 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 26 PASSED at ${COMMIT.slice(0, 12)} — button 0 opens the panel to a real finger with the pad still 4+4, four presets are spectrally distinct through the shipping graph builder (null result first), every value is clamped, no microphone survives teardown from any state including a grant that arrives after the panel closed, one finger tap leaves from idle, mid-record and mid-playback, the recorder stops on its own timer, Supabase-unconfigured degrades silently, the four preset glyphs are distinct code points (whether they render distinctly is UNRESOLVED wherever the pad's own glyphs do not), nothing clips or goes silent across 36 preset/slider positions, no orphaned microphone survives repeated taps, a send survives a playback tap and does not survive the exit, a remote clip is stopped by the exit, the slider's knob lands under the finger, a rendered clip arrives and plays on a second device while a hostile payload at the same door is refused, a grant crossing a teardown leaves no live track, a 40-message burst cannot exceed the concurrent-decode cap, an open microphone locks out playback, an abandoned clip does not appear in the next panel, an over-long decoded clip is refused before it sounds, a second openVoice is a no-op, and a client without removeChannel still falls back to unsubscribe.`);
