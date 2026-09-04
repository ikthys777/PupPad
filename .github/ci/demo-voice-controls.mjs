#!/usr/bin/env node
/**
 * CHECK 26'S CONTROLS — every section of demo-voice.mjs shown going RED.  PUP-WO-0701 §S2.
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
const CHECK = join(REPO, '.github', 'ci', 'demo-voice.mjs');
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
console.log(`CHECK 26 CONTROLS — every section of demo-voice.mjs, shown red. subject ${COMMIT.slice(0, 12)}\n`);

function sub(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`anchor matched ${n} times, expected 1: ${JSON.stringify(from.slice(0, 70))}`);
  return src.replace(from, to);
}
const QUEUE = [];
const plan = (section, label, spec) => QUEUE.push({ section, label, spec });

async function scenario(section, label, { mutate, expectText }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c26-'));
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

/* §1 — THE GRID. A ninth button re-flows the pad at a 412px CSS viewport, which is the
 * only device that counts, and that is why the door is an EXISTING button. */
plan(1, 'a ninth button is added to the pad', {
  mutate: (s) => sub(s, "var BTNS_RIGHT=[\n", "var BTNS_RIGHT=[\n  {id:8,label:'Extra',color:'#fff',glow:'#fff',emoji:'\\u2B50',sound:'tap',msg:'x',bg:'#000'},\n"),
  expectText: 'no longer 4+4',
});

/* AND THE DOOR ITSELF: a satellite dish does not say "talk to Grampa" to a non-reader. */
plan(1, "button 0 keeps the old decorative glyph", {
  mutate: (s) => sub(s, "emoji:'\\uD83C\\uDFA4',sound:'ping',msg:'Say something!'", "emoji:'\\uD83D\\uDCE1',sound:'ping',msg:'Say something!'"),
  expectText: 'not a microphone',
});

/* §2 — THE MEASUREMENT. Two presets made to do the SAME THING must be caught, or
 * acceptance item 3's spectra can come out the same by accident and nobody hears it. */
plan(2, 'two presets are given the same mechanism', {
  mutate: (s) => sub(s, "  { id:'robot', icon:'\\uD83E\\uDD16', label:'Robot voice',   color:'#A78BFA',\n    min:RING_HZ_MIN, max:RING_HZ_MAX, def:70 },",
                        "  { id:'up', icon:'\\uD83E\\uDD16', label:'Robot voice',   color:'#A78BFA',\n    min:1.25, max:VOICE_RATE_MAX, def:1.70 },"),
  expectText: 'NOT audibly distinct',
});

/* AND THE INSTRUMENT ITSELF. If buildGraph ignores the preset, every render is identical
 * -- which the NULL RESULT cannot catch, because identical is what it asserts. This is
 * the section that proves the pairwise half is doing work. */
plan(2, 'the graph builder ignores the preset entirely', {
  mutate: (s) => sub(s, "  if (presetId === 'up' || presetId === 'down') {\n    /* Resampling: pitch and tempo move together. That IS the chipmunk/monster effect. */",
                        "  if (false) {\n    /* PLANT: every preset falls through to dry. */"),
  expectText: 'NOT audibly distinct',
});

/* §3 — THE CLAMP. An unbounded playbackRate is a bang in a three-year-old's ear. */
plan(3, 'playbackRate is set from the raw slider value', {
  mutate: (s) => sub(s, "    src.playbackRate.value = clampNum(value, VOICE_RATE_MIN, VOICE_RATE_MAX);",
                        "    src.playbackRate.value = value;"),
  expectText: 'reached an AudioParam unclamped',
});

/* A FEEDBACK GAIN >= 1 IS A DELAY LINE THAT NEVER DECAYS. It does not stop when the clip
 * stops, and it is the one parameter deliberately kept off the slider. */
plan(3, 'the cave feedback gain is raised to 1.2', {
  mutate: (s) => sub(s, "var CAVE_FEEDBACK = 0.45;", "var CAVE_FEEDBACK = 1.2;"),
  expectText: 'never decays',
});

/* §4 — THE FLAG-AND-STOP THIS WORK ORDER CARES MOST ABOUT. Dropping the reference does
 * NOT turn a microphone off. This is the plant that matters. */
/* BOTH HALVES, BECAUSE THE PROPERTY IS NOW JOINTLY HELD. Since rec.onstop stops the
 * stream IT owns rather than whatever voiceStream points at, removing closeVoice's stop
 * alone no longer leaks -- the recorder's own path releases it. That is defence in depth
 * working, and a plant that removes one half of it correctly reports green. Removing both
 * is what demonstrates the property is asserted at all. */
plan(4, 'nothing stops the microphone tracks — neither teardown nor the recorder', {
  mutate: (s) => sub(sub(s,
      "    voiceStream.getTracks().forEach(function(t) { t.stop(); });\n    voiceStream = null;\n  }\n  clearVoiceTimers();",
      "    voiceStream = null;\n  }\n  clearVoiceTimers();"),
      "      if (stream) { stream.getTracks().forEach(function(t) { t.stop(); }); }\n", ""),
  expectText: 'SURVIVED teardown',
});

/* THE SHARED CONTEXT. Closing it is not fatal -- getAudioCtx re-creates -- but every node
 * still connected dies with it, including a clip mid-playback. */
plan(4, 'teardown closes the shared AudioContext', {
  mutate: (s) => sub(s, "  stopVoicePlayback();          /* disconnects nodes. NEVER audioCtx.close(). */",
                        "  stopVoicePlayback();\n  try { audioCtx.close(); } catch (e) {}"),
  expectText: 'was closed',
});

/* §5 — THE RACE. getUserMedia resolves asynchronously, so closeVoice can run BEFORE the
 * track exists. Removing the on-arrival guard is the whole defect. */
plan(5, 'the on-arrival guard is removed — a grant that lands after teardown', {
  mutate: (s) => sub(s, "    if (gen !== voiceGen || !document.getElementById('voiceOverlay')) {", "    if (false) {"),
  expectText: 'LIVE after closing the panel',
});

/* §6 — ONE TAP BACK. An exit that is not there, from the state that needs it most. */
/* A PLANT MUST REMOVE THE BEHAVIOUR. The first version of this scheduled the removal
 * 50ms after openVoice -- BEFORE any recording had started -- so `voiceRecorder` was
 * still null, nothing was removed, and the section reported GREEN entirely correctly.
 * The plant was the no-op, not the check. It now removes the exit at the moment the
 * recorder actually starts, which is the state acceptance item 6 names. */
plan(6, 'the exit is removed while a recording is running', {
  mutate: (s) => sub(s, "    rec.start();\n    voiceSetStage('recording');",
    "    rec.start();\n    voiceSetStage('recording');\n    var b = document.getElementById('voiceBack'); if (b && b.parentNode) b.parentNode.removeChild(b);"),
  expectText: 'the exit is not present in mid-record',
});

/* §7 — THE HARD STOP. A three-year-old will hold the button; the timer is the only thing
 * that does not care. */
plan(7, 'the cap never fires — nothing stops the recorder but a finger', {
  mutate: (s) => sub(s, "    voiceTimers.push(setTimeout(function() { stopVoiceRecording(); }, MAX_RECORD_MS));",
                        "    /* PLANT: no timed stop at all. */"),
  expectText: 'STILL RUNNING past its own cap',
});

/* AND THE REQUIREMENT MUST NOT COLLAPSE INTO ITS BACKSTOP. */
plan(7, 'the duration cap is derived from the byte cap', {
  mutate: (s) => sub(s, "var MAX_RECORD_MS = 15000;", "var MAX_RECORD_MS = MAX_INBOUND_BYTES;"),
  expectText: 'not 15000',
});

/* §9 — INVARIANT 1. A preset a non-reader cannot identify from its icon is not a preset,
 * and two presets wearing one glyph are one preset painted twice. */
plan(9, 'two presets are given the same glyph', {
  mutate: (s) => sub(s, "  { id:'down',  icon:'\\uD83D\\uDC18'", "  { id:'down',  icon:'\\uD83D\\uDC2D'"),
  expectText: 'share a glyph',
});

/* §10 — THE PADDING-BOX RULE. Reading getBoundingClientRect where the paint resolves
 * against the padding box put the knob up to 4px from where a tap at that same position
 * landed. It needs BOTH halves to reproduce: a border to make the boxes differ, and the
 * wrong box to read it with. A one-line plant here would be a no-op. */
plan(10, 'the hit test reads the border box while the paint uses the padding box', {
  mutate: (s) => sub(sub(s,
      "    + 'overflow:hidden;touch-action:none;cursor:pointer;min-width:0';\n  var fill = document.createElement('div');\n  fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;pointer-events:none;'",
      "    + 'overflow:hidden;touch-action:none;cursor:pointer;min-width:0;border:8px solid #333';\n  var fill = document.createElement('div');\n  fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;pointer-events:none;'"),
      "    var pad = track.clientWidth;                 /* the padding box, by definition. */\n    var edge = (r.width - pad) / 2;",
      "    var pad = r.width;\n    var edge = 0;"),
  expectText: 'from the finger',
});

/* §12 — THE ORPHAN. Restoring the single guard is the code as first written: voiceRecorder
 * is not assigned until the grant lands, so every tap in that window opens a microphone
 * that nothing will ever hold a reference to. */
plan(12, 'the pending-grant guard is removed — taps during the window orphan microphones', {
  mutate: (s) => sub(s, "  if (voiceRecorder || voicePending) return;", "  if (voiceRecorder) return;"),
  expectText: 'LIVE after the child left',
});

/* AND THE OTHER HALF: a grant belonging to a panel that has been closed and REOPENED. */
plan(5, 'the generation token is dropped — a stale grant is adopted by the new panel', {
  mutate: (s) => sub(s, "    if (gen !== voiceGen || !document.getElementById('voiceOverlay')) {",
                        "    if (false) {"),
  expectText: 'LIVE after closing the panel',
});

/* §15 — the stale continuation clearing a live panel's guard: the code as first written. */
plan(15, "a stale grant clears voicePending before checking its generation", {
  mutate: (s) => sub(s, "      return;\n    }\n    voicePending = false;\n    voiceStream = stream;",
                        "      voicePending = false;\n      return;\n    }\n    voiceStream = stream;"),
  expectText: 'LIVE after a grant crossed a teardown',
});

/* §17 — two expressions of "is this panel busy" that do not agree, restored. */
plan(17, 'the preset tiles stop asking whether the microphone is open', {
  mutate: (s) => sub(s, "      /* The same question the painting asks, asked the same way. */\n      if (voiceCapturing()) return;\n", ""),
  expectText: 'STARTED PLAYBACK',
});

/* §18 — an overlay check standing in for a generation check. */
/* BOTH GENERATION CHECKS ON THE RECORD PATH. rec.onstop now returns early for a stale
 * generation, so reverting only the inner check leaves the outer one protecting -- green,
 * and correctly so. The plant restores the state the defect actually had: an overlay check
 * standing in for a generation check, with nothing above it. */
plan(18, "the record path checks the overlay instead of the generation", {
  mutate: (s) => sub(sub(s,
      "      if (gen !== voiceGen) return;\n      if (voiceRecorder === rec) voiceRecorder = null;", "      voiceRecorder = null;"),
      "        if (gen !== voiceGen || !document.getElementById('voiceOverlay')) return;\n        voiceBuffer = buf;",
      "        if (!document.getElementById('voiceOverlay')) return;\n        voiceBuffer = buf;"),
  expectText: "PREVIOUS session's clip was installed",
});

/* §7 — THE BRANCH THAT COULD NOT FIRE. Its whole point is the rule this repo repeats most,
 * and until now no plant could reach it: it sat behind an `else if` that required
 * MAX_INBOUND_BYTES to equal 15000. */
plan(7, 'the duration requirement is derived from the byte backstop', {
  mutate: (s) => sub(s, "var MAX_RECORD_MS = 15000;", "var MAX_RECORD_MS = MAX_INBOUND_BYTES;\nvar MAX_RECORD_MS_UNUSED = 15000;"),
  expectText: 'not 15000',
});

plan(7, 'the two caps are collapsed into one number', {
  mutate: (s) => sub(s, "var MAX_INBOUND_BYTES = 3 * 1024 * 1024;", "var MAX_INBOUND_BYTES = 15000;"),
  expectText: 'SAME NUMBER',
});

/* §9 — THE PIXEL BRANCH, WHICH ABSTAINS ON EVERY CI RUN AND SO HAS NEVER BEEN SHOWN RED.
 * The abstention is honest, but a branch never seen red is not a branch. This plant swaps
 * every glyph -- the eight shipping pad ones AND the four presets -- for ASCII that any
 * machine can render, so the baseline passes and the comparison actually runs, with two
 * presets given the same character. It demonstrates the branch without faking a verdict. */
plan(9, 'the pixel comparison is made reachable, and two presets are given one shape', {
  mutate: (s) => {
    let out = s;
    const pads = ['\\uD83C\\uDFA4', '\\uD83D\\uDDFA', '\\uD83C\\uDFA8', '\\uD83D\\uDEA8',
                  '\\uD83D\\uDD27', '\\u26C5', '\\uD83D\\uDCF7', '\\uD83C\\uDFAE'];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    pads.forEach((g, i) => { out = sub(out, "emoji:'" + g + "'", "emoji:'" + letters[i] + "'"); });
    /* DIFFERENT CODE POINTS THAT RENDER IDENTICALLY -- Latin A (U+0041) and CYRILLIC A
     * (U+0410). Two copies of one character would trip the earlier STRING check and never
     * reach the pixel branch, which is the branch this plant exists to demonstrate.
     *
     * THE PAIR WAS MEASURED, NOT ASSUMED. My first choice was Greek capital Alpha and it
     * renders DIFFERENTLY from Latin A in this font stack, so the plant came out green and
     * I would have concluded the branch worked. Latin/Cyrillic A are pixel-identical here;
     * Latin A against B is not, which is the null control for the same measurement. This
     * pair is the ASCII form of the dog-face-against-dog case the design exists to avoid. */
    out = sub(out, "{ id:'up',    icon:'\\uD83D\\uDC2D'", "{ id:'up',    icon:'A'");
    out = sub(out, "{ id:'down',  icon:'\\uD83D\\uDC18'", "{ id:'down',  icon:'\\u0410'");
    out = sub(out, "{ id:'robot', icon:'\\uD83E\\uDD16'", "{ id:'robot', icon:'Y'");
    out = sub(out, "{ id:'cave',  icon:'\\uD83C\\uDFD4\\uFE0F'", "{ id:'cave',  icon:'X'");
    return out;
  },
  expectText: 'render IDENTICALLY despite differing code points',
});

/* §20 — the openVoice re-entry guard, which nothing asserted. */
plan(20, 'openVoice stops guarding against a second panel', {
  mutate: (s) => sub(s, "  if (document.getElementById('voiceOverlay')) return;\n  voicePreset = 'up';", "  voicePreset = 'up';"),
  expectText: 'overlay(s) after two openVoice calls',
});

/* §20 — and the fallback that was a `catch` where it should have been an `else`. */
plan(20, 'the channel release fallback goes back into the catch', {
  mutate: (s) => sub(s, [
    '  var released = false;',
    '  try {',
    '    var c = getSupabaseClient();',
    '    if (c && c.removeChannel) { c.removeChannel(ch); released = true; }',
    '  } catch (e) { released = false; }',
    '  if (!released) { try { ch.unsubscribe(); } catch (e2) {} }',
  ].join('\n'), [
    '  try { var c = getSupabaseClient(); if (c && c.removeChannel) c.removeChannel(ch); }',
    '  catch (e) { try { ch.unsubscribe(); } catch (e2) {} }',
  ].join('\n')),
  expectText: 'released NOTHING and threw nothing',
});

/* §21 — THE `.catch` HALF OF THE GENERATION GUARD, which the whole suite left unasserted:
 * deleting it stayed green while reintroducing a live orphaned microphone. A DENIED
 * permission is the likeliest first-use path of all. */
plan(21, 'a rejected grant stops checking its generation', {
  mutate: (s) => sub(s, "    /* Same rule on the failure path, which had no generation check at all. */\n    if (gen !== voiceGen) return;\n    voicePending = false;",
                        "    voicePending = false;"),
  expectText: 'LIVE after a REJECTED grant',
});

/* §17 — F6: a failed capture painting over a clip that is still there. The getUserMedia
 * catch already asked `voiceBuffer ? 'ready' : 'empty'`; these two transitions did not,
 * and a stage of 'empty' with a live buffer leaves the tiles able to play it. */
plan(17, 'a failed decode paints empty over a surviving clip', {
  mutate: (s) => sub(s, "        voiceSetStage(voiceBuffer ? 'ready' : 'empty'); doSound('error');",
                        "        voiceSetStage('empty'); doSound('error');"),
  expectText: 'says EMPTY',
});

/* §7 — THE ABSENCE MUST BE ASSERTED, NOT ASSUMED. Re-declaring a cap the transport used
 * to need is exactly the shape a future edit takes: a bound with no subject, which a
 * reader then treats as live. */
plan(7, 'an inbound audio cap is re-introduced with nothing to bound', {
  mutate: (s) => sub(s, "var MAX_RECORD_MS = 15000;", "var MAX_INBOUND_SECONDS = 40;\nvar MAX_RECORD_MS = 15000;"),
  expectText: 'still exist after the transport was removed',
});

/* §8 — THE EQUALITY IS THE PROPERTY THIS WORK ORDER BUYS. Anything that makes the panel
 * behave differently when Supabase is configured breaks it -- here, a control that only
 * appears when there is a client, which is precisely the old send button returning. */
plan(8, 'a control appears only when Supabase is configured', {
  mutate: (s) => sub(s, "  row.appendChild(playBtn); row.appendChild(recWrap);",
    "  if (isSupabaseConfigured()) { var extra = document.createElement('button'); extra.id = 'voiceExtraBtn'; row.appendChild(extra); }\n  row.appendChild(playBtn); row.appendChild(recWrap);"),
  expectText: 'BEHAVES DIFFERENTLY with Supabase unconfigured',
});

/* §23 — THE WIRE COMING BACK. This is the defect the whole work order exists to prevent,
 * and it must be caught AT THE NETWORK rather than by a name search: the plant below uses
 * a DIFFERENT function name from the one that was deleted, so a source grep for
 * `joinVoiceChannel` would sail past it. */
plan(23, 'the voice panel takes a channel again, under a new name', {
  mutate: (s) => sub(s, "  voicePreset = 'up';\n  voiceBuffer = null;\n  doSound('ping');",
    "  voicePreset = 'up';\n  voiceBuffer = null;\n  try { var c = getSupabaseClient(); if (c) c.channel('puppad-voice-v2').subscribe(function(){}); } catch (e) {}\n  doSound('ping');"),
  expectText: 'asked for 1 Supabase channel',
});

/* AND THE INSTRUMENT'S OWN CONTROL. If the channel recorder cannot fire, the zero it
 * reports is a silence rather than a measurement -- so breaking the camera's join must
 * make the section red for THAT reason, not for the voice one. */
plan(23, 'the channel recorder is left unable to fire', {
  mutate: (s) => sub(s, "  cameraChannel = client.channel('puppad-camera', {", "  cameraChannel = ({}) || client.channel('puppad-camera', {"),
  expectText: 'never fired for a path that DOES take a channel',
});

/* §24 — THE MAP LEAK, RESTORED. Real WGS84 beside a stable device id on a global channel:
 * the code as it shipped for months. */
plan(24, 'the map broadcasts a stamp again — real coordinates on a global channel', {
  mutate: (s) => sub(s, "      mapStamps.push(stamp);",
    "      mapStamps.push(stamp);\n      try { var mc = getSupabaseClient(); if (mc) mc.channel('puppad-treasuremap').send({ type:'broadcast', event:'map-stamp', payload:{ lat:stamp.lat, lng:stamp.lng, did:deviceId } }); } catch (e) {}"),
  expectText: 'asked for 1 Supabase channel',
});

/* AND GEOLOCATION MUST NOT BE THE THING THAT GETS DELETED. "Local function only" means the
 * map still knows where it is; removing the tracking is the wrong fix in the other
 * direction and the section must catch that too. */
/* BOTH CREATION PATHS, because getCurrentPosition and watchPosition each create the
 * marker and either alone keeps the map tracking. Removing one is defence in depth
 * working, and a plant that removes one half correctly reports green. */
plan(24, 'the location marker is removed along with the transport', {
  mutate: (s) => sub(sub(s,
      "    mapLocationMarker = L.marker([lat, lng], {icon: pawIcon}).addTo(treasureMap);\n  }, function() {",
      "  }, function() {"),
      "    if (mapLocationMarker) mapLocationMarker.setLatLng([lat, lng]);\n    else mapLocationMarker = L.marker([lat, lng], {icon: pawIcon}).addTo(treasureMap);",
      "    if (mapLocationMarker) mapLocationMarker.setLatLng([lat, lng]);"),
  expectText: 'did not track the fix',
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
  console.error(`\n::error::CHECK 26 CONTROLS FAILED — ${failed.length} section(s) cannot be shown catching the defect they exist for.`);
  for (const r of failed) console.error(`  §${r.section} ${r.label} — observed ${r.observed}${r.detail ? ' — ' + r.detail : ''}`);
  process.exit(1);
}
console.log(`\nCHECK 26 CONTROLS PASSED — ${results.length} planted defects, every one red for its own stated reason.`);
