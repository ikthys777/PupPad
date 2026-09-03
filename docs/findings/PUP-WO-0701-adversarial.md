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
