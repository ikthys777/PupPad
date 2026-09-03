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
plan(4, 'teardown drops the stream reference without stopping its tracks', {
  mutate: (s) => sub(s, "    voiceStream.getTracks().forEach(function(t) { t.stop(); });\n    voiceStream = null;\n  }\n  clearVoiceTimers();",
                        "    voiceStream = null;\n  }\n  clearVoiceTimers();"),
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
  mutate: (s) => sub(s, "    if (gen !== voiceGen || !document.getElementById('voiceOverlay')) {\n      stream.getTracks().forEach(function(t) { t.stop(); });\n      return;\n    }",
                        "    /* PLANT: nothing checks whether the panel is still there. */"),
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

/* §8 — DEGRADATION. A panel that throws with Supabase unconfigured is a panel that is
 * broken for every device that was never paired. */
plan(8, 'send throws when there is no client', {
  mutate: (s) => sub(s, "  if (!voiceChannel) return;\n  voiceChannel.send(", "  voiceChannel.send("),
  expectText: 'throws',
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

/* §11 — THE DEFECT THIS SECTION WAS WRITTEN AND THEN IMMEDIATELY CAUGHT. Restoring the
 * un-normalised MediaRecorder label puts `;codecs=opus` back between the media type and
 * `;base64`, which safeMediaUrl's pattern has no room for -- so the device refuses its
 * own clip before it reaches the wire, and nothing ever crosses. */
const UNNORMALISE = (s) => sub(s, "    var rawType = (chunks[0].type || 'audio/webm').split(';')[0];\n    var blob = new Blob(chunks, { type: /^audio\\//i.test(rawType) ? rawType : 'audio/webm' });",
                                    "    var blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });");

plan(11, "the sender stops normalising its own media type", {
  mutate: UNNORMALISE,
  expectText: 'refused its own payload',
});

/* THE SECOND BRANCH NEEDS ITS OWN PLANT, because the first one can never reach it:
 * sendVoice gates before broadcasting, so an unacceptable payload stops there and
 * `captured` stays null. Remove that guard as well and the bad payload reaches the wire,
 * which is the arrangement `passesOwnGate` exists for. A BRANCH NEVER SEEN RED IS NOT A
 * BRANCH -- both of this section's failure paths are demonstrated, not just the reachable
 * one. */
plan(11, 'an unacceptable payload reaches the wire because sendVoice stops gating too', {
  mutate: (s) => sub(UNNORMALISE(s),
    "      if (safeMediaUrl(url, 'audio')) { broadcastVoice(url); doSound('powerUp'); }\n      else doSound('error');",
    "      broadcastVoice(url); doSound('powerUp');"),
  expectText: 'refused by the gate this device RUNS',
});

/* AND THE ARRIVAL ITSELF -- a gate that refuses everything satisfies every "hostile
 * payload was refused" assertion in this section while breaking the feature entirely. */
plan(11, 'the inbound handler drops every payload', {
  mutate: (s) => sub(s, "    var url = safeMediaUrl(payload && payload.payload && payload.payload.dataUrl, 'audio');\n    if (!url) return;\n    playRemoteVoice(url);",
                        "    return;"),
  expectText: 'produced NOTHING on the second device',
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

/* §13 — THE SHARED NODE LIST. Putting the render back in the playback list restores the
 * defect exactly: any playback control stops the send's source mid-flight. */
plan(13, 'the render graph shares the playback node list again', {
  mutate: (s) => sub(s, "  g.nodes.forEach(function(n) { voiceSendNodes.push(n); });\n  voiceSendNodes.push(g.out, dest);",
                        "  g.nodes.forEach(voiceTrack);\n  voiceTrack(g.out);"),
  expectText: 'truncated the clip on the wire',
});

/* AND THE RENDER'S RECORDER, whose only stop trigger used to be a timer teardown clears. */
plan(13, "teardown stops clearing the render's recorder", {
  mutate: (s) => sub(s, "  if (voiceSendRec) { try { voiceSendRec.stop(); } catch (e) {} voiceSendRec = null; }", "  /* PLANT: the render runs on. */"),
  expectText: 'STILL recording after teardown',
});

/* §14 — THE UNSTOPPABLE CLIP. Untracking the inbound source puts it beyond the reach of
 * the one control this app promises from every state. */
plan(14, 'an inbound clip is not tracked, so the exit cannot stop it', {
  mutate: (s) => sub(s, "    voiceInbound.push(s);", "    /* PLANT: held by nothing. */"),
  expectText: 'STILL PLAYING after the exit',
});

/* AND THE BOUND ON THE QUANTITY THAT COSTS. */
plan(14, 'the audio payload cap is removed — the decoder is handed the string cap', {
  mutate: (s) => sub(s, "  if (dataUrl.length > MAX_INBOUND_AUDIO_BYTES) return;", "  /* PLANT: unbounded. */"),
  expectText: 'oversized inbound audio payload was accepted',
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
