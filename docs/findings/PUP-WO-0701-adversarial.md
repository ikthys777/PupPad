# PUP-WO-0701 part 2 — adversarial pass and disposition

**Freeze:** `git archive` of `4646927`. `index.html` sha256
`ab4bdc97237e8000562c68c551c1582d24f47d9743fde1fa508a5536f51e98a3`.
**Pass:** black-box, fresh subagent, no git history, no access to the working tree.
It served a **copy** and left the freeze unmodified.

## Two disclosures about the process, before the findings

**1. THE ARTIFACT MOVED WHILE THE PASS WAS RUNNING, AND IT SHOULD NOT HAVE.** The
protocol is *freeze, then hold every correction until the pass returns.* I did not: my
own check 26 §11 found the send defect (finding 1) mid-pass and I fixed and committed it
at `5299dbb` before the report arrived. The freeze itself is untouched and every finding
below was re-verified against the **current** tree rather than assumed. But the pass
graded `4646927` and the disposition is against `5299dbb`+, and that gap is mine.

**2. THE PASS AND I FOUND FINDING 1 INDEPENDENTLY, WITHIN MINUTES OF EACH OTHER.** That
is corroboration, not duplication — two instruments, same defect, same mechanism. It is
recorded that way rather than claimed as mine.

## Findings and disposition

| # | finding | verdict | disposition |
|---|---|---|---|
| 1 | **`sendVoice` can never send.** `MediaRecorder` labels its output `audio/webm;codecs=opus`; `safeMediaUrl`'s pattern has no slot for a media-type parameter, so the app refused its own payload on every send. | **REAL — the panel's headline feature was 100% non-functional** | **FIXED** `5299dbb`. Normalised at the **sender**, not the gate: widening the gate would widen what this device accepts **from a stranger** to fix what it **sends**. Found independently by me and by the pass. |
| 2 | **Taps during the `getUserMedia` window orphan microphones.** `if (voiceRecorder) return` was the only guard and `voiceRecorder` is assigned *inside* the `.then`. Two taps left one mic live after exit; five taps during a permission prompt left four — **with the app's own reporter saying zero**, because an orphan is a stream no variable points at. | **REAL — this is the work order's named flag-and-stop** | **FIXED.** `voicePending` closes the window; a `voiceGen` generation token stops a grant that belongs to a panel already closed *or* closed-and-reopened. An `arming` stage now paints, so the second tap is never invited. Check 26 §12 holds **every** stream ever granted and asks the tracks. |
| 3 | **Exit during a send orphans a `MediaRecorder` that never stops.** Its only stop trigger was a timeout in `voiceTimers`, which `closeVoice` clears. Measured still `"recording"` 2.5 s after teardown, once per send-then-exit. | **REAL** | **FIXED.** `voiceSendRec` is held and stopped explicitly in teardown, before the timers are cleared. |
| 4 | **Any playback control during a send truncates the clip on the wire** — the render shared `voiceNodes` with playback, so PLAY, a preset tile or the slider stopped the render's source. Measured 2.4 s → 0.48 s. | **REAL** | **FIXED.** The render has its own `voiceSendNodes`, which only teardown touches. |
| 5a | **An inbound clip cannot be stopped by anything.** It was connected to the destination and held by nothing, so the exit — the one control this app promises from every state — could not reach it. | **REAL** | **FIXED.** Inbound sources are tracked in `voiceInbound` and stopped by teardown; the popups are tracked too. |
| 5b | **`MAX_INBOUND_BYTES` bounds the string, and the string is the cheap half.** `decodeAudioData` allocates full PCM: 3 MiB of 6 kbps Opus → **~1 GB and ~49 minutes** of unstoppable audio, times three. | **REAL, and the best finding in the pass** | **FIXED, in two layers.** `MAX_INBOUND_AUDIO_BYTES` (1 MiB) is checked **before any allocation**; `MAX_INBOUND_SECONDS` (40) is checked after decoding, because only a duration cap is true regardless of the next codec's expansion ratio. Check 26 §14 asserts the decoder **was never reached**, not merely that nothing played — a corrupt payload achieves the latter. |
| 6 | **`cave` clips hard on 7 of 9 slider positions** (peak 1.78 against a 0.70 source) and its loudness is non-monotonic. `CAVE_FEEDBACK < 1` bounds **decay**, which is not **headroom**. | **REAL** | **FIXED.** `CAVE_DRY 0.50` / `CAVE_WET 0.45` derived from the echo series, not tuned by ear: `0.50 + 0.45/(1−0.45) = 1.32`, and `1.32 × 0.70 = 0.92`. Check 26 §3 now sweeps **36 preset/slider positions** and asserts no clipping and no silence. Worst peak now **0.84**. |
| 7 | **Check 26 §2 proves distinctness at four default points only** — its 13-band Goertzel cannot resolve ring frequency or delay time at all. **§9 compared strings, so it would pass 🐕 against 🐶** — the exact pair the design says it exists to avoid. | **REAL — about my instruments** | **PARTLY FIXED, PARTLY DECLARED.** §2 now *prints what it does not prove* rather than letting its pass line overstate. §9 renders the glyphs and compares **pixels**, with the app's own eight shipping pad glyphs as the control: where those do not render, the section reports **UNRESOLVED** instead of a verdict. **This CI container is such a machine** — all eight pad emoji render as boxes here — so glyph identifiability is genuinely settled only by acceptance item 5. |
| 8 | **`openVoice` has no re-entry guard**; two calls stack two overlays and `closeVoice` removes one. Not reachable by a finger today. | **REAL but latent** | **FIXED** — one line, so the next caller need not know it was unreachable. |

### Design calls (B) — recorded, and mostly not changed

- **`puppad-voice` is a fixed global channel name, unscoped by any pairing id.** **NOT
  MINE TO FIX** — §S.5 rules the audience a design decision and Scotty's. Recorded in
  `FEEDBACK.md` as inherited, per that ruling. **The pass sharpens the cost**: §S.1's own
  framing is that this panel carries the first identifying data the app has ever handled.
- **The cave glyph lacked U+FE0F** where the file already knows the rule. **FIXED.**
- **The countdown ring froze on an early stop** (~90% of the arc still painted). **FIXED** —
  any stage that is not `recording` empties it.
- **`showIncomingWoof` outlived the panel by up to 6 s.** **FIXED** — popups are tracked.
- **A `getUserMedia` rejection painted nothing.** **FIXED** — the stage resets so the panel
  does not sit looking busy.
- **A mountain is not a cave to a non-reader.** Agreed, and unresolved — it is exactly what
  the item-5 prediction records as an **expected failure** with no candidate I believe in.
  Guessing twice is not better than guessing once and measuring.

### Null results the pass established — kept, because they are evidence

`safeMediaUrl` held against 23 adversarial strings (`javascript:`, `blob:`,
`data:text/html`, SVG on the audio gate, trailing LF, CR/TAB/NUL/U+2028, 3 MiB+1); the
regex is linear with no catastrophic backtracking; **no inbound value reaches any DOM
sink, `fetch`, `XHR`, `img.src` or `audio.src`**; nothing persists a clip anywhere; the
layout is clean at all three fleet viewports with no overflow and no collision; two-finger
presses on the pad, on record+exit together, and on the slider all behave; every control
goes through `wireTap`; `audioCtx.close()` is never called.

### What remains open

- **Whether any two presets sound alike to a three-year-old.** The pass's sub-threshold
  pairs are instrument artefacts, not perception. This needs acceptance item 5.
- **The real size of finding 2's race window on Samsung hardware.** The defect was
  unconditional and is now closed; only its former firing rate was device-dependent.

---

# ROUND 2 — CC-A's review of PR #65

**Reviewed at `dc0e26c`. Every claim was verified at source before I acted on it; all
eight reproduce exactly as described.** Fixed at `d2b63f7`. Freeze for the follow-up
pass: `d2b63f7`, `index.html` sha256
`e97b45783e2fcb0950950b7d7b48f7e409e2052b6d0469df39f1b272b3ee769b`.

## The five product findings

| # | finding | disposition |
|---|---|---|
| P1 | **`voicePending` was not generation-scoped**, so a dead panel's grant unlocked a live panel's guard. `voicePending = false` ran at the *top* of the `.then`, before the generation check; the `.catch` had no generation check at all. **This is round 1's finding 2 surviving its own fix**, reached by a longer gesture and most reachable on first use, where the first request waits on a permission bubble. | **FIXED.** A stale continuation now touches nothing belonging to the current generation — its only business is stopping the tracks it was handed. §15 stages a grant *across* a teardown, which §12 never did. |
| P2 | **`VOICE_MAX_INBOUND` counted clips that were SOUNDING, not clips that were ALLOCATING.** Nothing joins `voiceInbound` until a decode succeeds, so a burst all read zero, all passed, and all called `decodeAudioData` at once. **The same defect as the byte cap bounding the string, surviving its own fix in the one dimension the fix did not consider.** | **FIXED** — concurrent decodes counted. §16 floods 40 messages and watches decodes in flight. |
| P3 | **The one sink whose amplitude a stranger chooses was the one sink with no attenuator.** Local cave headroom was derived and lands at 0.84; inbound went to the destination at unity, up to three summing. | **FIXED** — a shared attenuated + limited bus. |
| P4 | **Two expressions of "is this panel busy" that did not agree.** `voiceSetStage` gated play/send on the stage; tiles and slider asked whether a buffer existed. Tapping a preset mid-record **played the old clip into the open microphone** and froze the ring while the timer ran. | **FIXED** — one `voiceCapturing()`, used by the painting *and* the handlers. |
| P5 | **An overlay check is not a generation check** — after close-then-reopen the overlay is back, so the previous session's clip installed into the fresh panel. `sendVoice`'s `finish()` and `fr.onload` had no guard at all. | **FIXED** — generation-scoped throughout. §18 asserts it. |

## The three about my instruments — and C1 is the sharpest thing in the review

**C1. The one assertion in this repo for *"a requirement and its backstop must not be the
same number"* could not fire.** It was an `else if` behind `rec !== 15000`, so reaching it
required `MAX_INBOUND_BYTES === 15000`. **The rule this project repeats most had its only
guard written unfalsifiable, and its plant demonstrated the other branch.** Now four
independent assertions — and every named bound is *asserted* rather than interpolated,
because deleting `MAX_INBOUND_BYTES` used to print "is undefined bytes" and pass.

**C2. `MAX_INBOUND_SECONDS` was asserted by nothing** — deleting the line left the whole
suite green. It is the half of the inbound bound I had argued is the only one that stays
true across codecs. §19 asserts it by making the decoder return an over-long buffer, which
is the only way to test the property without depending on one encoder's bitrate.

**C3. §9's abstention gate was `padTofu > 0`**, so one odd glyph would disable the
comparison on an otherwise fully-fonted machine; and a **missing** baseline read as a
licence to judge rather than as unresolved. Both abstain now, separately. **And the pixel
branch finally has a plant** — Latin `A` against Greek `Α`, different code points that
render identically, which is the ASCII form of the exact case the design exists to avoid.

## The cheaper ones, all taken

- **Check 24 had no controls file**, so its first four sections had never been shown red.
  Writing them **found another defect**: §1 called `safeMediaUrl` *itself* and only then
  invoked the sink, so it proved the validator refuses a URL — never in doubt — while
  saying nothing about **whether the sink is gated**. Deleting the gate from the real
  handler left it green. It now drives the app's own registered callback. **9 of 9 red.**
- **Check 25 counted a filename in a comment as a registration** — the
  described-bug-reads-like-a-fixed-one shape *inside the check built to stop it*, in a repo
  whose comments name files constantly. Comment lines dropped; the name must sit on a line
  that invokes `node`. Demonstrated with a commented-out run line.
- **`releaseChannel`'s fallback was a `catch` where it should be an `else`** — a client
  merely *lacking* `removeChannel` released nothing and threw nothing, across all four
  panels at once.
- **`ci.yml`'s hand-maintained "15 planted defects"** removed rather than corrected. No
  derived counts.
- **Two `boundingBox()` calls** given the treatment §6 already had — code that predates the
  helper, in the same file.
- **`did` dropped from the voice payload.** Eight send sites broadcast a stable device id
  and **zero read one**, verified by grep. The other seven are pre-existing and named in
  `FEEDBACK.md` rather than changed from inside a voice work order.

## One correction to my own round-1 record

CC-A adopted both deviations and ruled §S2.2 — the instruction to make three inline copies
— **their error, not mine**: the paragraph prescribing the copies justified the work by
saying a rule expressed in many places rots. I had recorded it as a deviation I might be
asked to revert. It is not; it ships.
