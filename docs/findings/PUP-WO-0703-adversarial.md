# PUP-WO-0703 — adversarial pass and disposition

**Freeze:** `git archive` of `751a962`. `index.html` sha256
`491f729f11b6b32db698ca22956c9dc4409847784d484b951bafb180e310639e` — **verified unchanged
by the pass before and after its work.** Corrections were held until it returned; the
protocol held.

**Twelve findings. Every product defect was mine, and not one was caught by reading.**

## The three that would have shipped

| # | finding | disposition |
|---|---|---|
| **F1** | **Deleting the slot the microphone is filling left it recording, with nothing on screen saying so — and silently undid the delete.** A record-over target is FILLED and LIVE at once, so the 44px delete control was painted on the slot being recorded into, and `deleteVoiceSlot` ran a **playback-shaped teardown against a recording**: it stopped nodes, cleared the live slot, and never touched `voiceRecorder`. The microphone stayed open for the remaining ~14 s with **the wave gone, the record button repainted idle and the ring reset**, and then the decode wrote the clip back into the slot the child had just emptied. **This is the work order's central acceptance failing without even needing the words masked.** §29 taps delete only from the `ready` stage, so it could not see it. | **FIXED.** Deleting a recording slot stops the recorder, and the in-flight decode refuses to write into a slot the child deleted. **§30** stages it with taps and asserts both halves. |
| **F2** | **Record-over from a PLAYING slot recorded with no wave on any slot — 5 of 10 measured runs.** Playing slot *i* makes it the target, so the record-over goes to *i*, and `startVoiceRecording`'s `stopVoicePlayback` stops that source — whose queued `onended` then clears the live slot the recording had just set. **The generation guard closed the cross-panel case; this is same-panel, same-slot.** | **FIXED** with a playback token: a superseded playback's ending is not news about the panel. **§31** runs six spread gaps, because a race asserted once is a coin. |
| **F3** | **The countdown ring was painted entirely underneath the record button.** Its own comment says *"a ring that empties, so the child can SEE the end coming"* — outer edge 28.3 px against a 32 px opaque button; `elementFromPoint` returned the button at all 12 angles. It animated correctly the whole time. **Pre-existing** (0.5 px of band at 92 px) and **this change's shrink to 80 took it to −3.7**. | **FIXED** — 1:1 viewBox, derived radius, **7 px clear band, hit-tested at 12 points**, and the circumference now comes from the same radius instead of being written out three times as a rounded literal. |

## F4 — the comment asserted the opposite of the measurement

**`BiquadFilterNode.Q` defaults to 1, and for a lowpass Web Audio reads Q in decibels** —
so the default is a **+1.96 dB resonant peak**, measured gain **1.2533**. My comment said
*"a lowpass never boosts (no resonance is set), so it cannot cost headroom."*

**Not setting Q is not the absence of resonance.** It made `up`/`down` — not `cave` — the
binding headroom constraint, and the sweep passed only because its synthetic source peaks
at 0.70. **FIXED**: `Q = -3.0103 dB`, Butterworth, measured peak **exactly 1.0000**, and
**§33 asks the filter's own frequency response** rather than the comment.

## The rest

| # | finding | disposition |
|---|---|---|
| F7 | **Double-tapping delete opened the microphone** — the mirror of `PUP-WO-0404`'s control that *appears* mid-gesture. The control sits inside the slot's rect; the moment the first tap empties the slot it becomes `display:none`, so the second tap — exactly what a three-year-old does to confirm a button worked — lands on the slot underneath. | **FIXED** — a settle window on the slot's own action. |
| F8 | Slider B was never dimmed during a recording while slider A was. Two identical controls contradicting each other and the "dimmed means unavailable" contract. | **FIXED**, derived from the axis list. §34. |
| F9 | Deleting the target slot left the play button **fully lit and dead**. An undimmed control that does nothing teaches that pressing things does not work. | **FIXED** — the target repoints to a filled slot. |
| F11 | Enabling reduced motion mid-recording left the rAF rescheduling forever with nothing changing — the exact battery cost the loop exists to avoid. | **FIXED** — re-checked every frame. |
| F5 | **§25, the central assertion, framed the SLOT ROW — and the panel's only painted word is the title, outside that frame.** The mask changed nothing in the compared image; measured, the row hashed identically before and after. It reported *"with 1 painted word(s) hidden"* about a picture the hiding could not touch. | **FIXED** — photographs the whole panel, **and asserts the mask actually changed it**. |
| F10 | **§27's empty-slot half was unfalsifiable.** `WAVE_AMP_EMPTY` is 0 and `wavePath(0, phase)` is phase-invariant, so an empty slot's path could not change however broken the loop was. | **FIXED** — asserts the rAF is **not running** when nothing is live, which is the real property and one a plant can break. |
| F12 | **§29's record-over assertion compared a value against itself** — `nextVoiceSlot()` returns `voiceTargetSlot` when full, so both sides were the same variable, and it never exercised record-over-from-playing, which is where F2 lived. | **FIXED** — records over after a **play**, against the slot that was played. |
| F6 | **`demo-voice-controls.mjs` was red at the freeze** — five stale anchors, two broken by this work order's own second axis. | **FIXED**, all five re-anchored. |

## What the pass found CLEAN — kept, because null results are results

**Teardown holds, with a positive control**: every stream `getUserMedia` ever returned was
captured and audited by `readyState` rather than by the app's reporter — and the instrument
was proven able to see, reading `liveTracks=1` on a deliberately staged orphan while
`__voice.state()` said 0. **95 streams across 47 teardowns, 0 live tracks**, including
exits inside the `getUserMedia` window at eight delays. **F1's runaway recorder was still
released on exit.** Clamps hold across 484 hostile combinations on both axes with 0 throws
and 0 escapes. The 144-point grid reproduces exactly, and a 1024-point grid at the same
source level is also clean. **Real CDP multi-touch**: two slots at once, slot + its own
delete, record + slot — one recording, one stream, released. Reduced motion is
unambiguous. Layout identical at all three fleet widths with no target under 44 px.

## Could not determine

Whether a real child's recorded clip peaks above 0.81 in practice — the pass measured the
graph's gain, not a capture. **F4 says the ceiling was 0.81 and is now 1.0**, not that it
was routinely crossed.

---

## After the fixes — two more plant rounds, and what they cost to get right

**The freeze protocol held for the pass itself** (`index.html` unchanged, hash verified both
ways by the pass). **The corrections then took two further rounds of the 51 plants**, and
the failures were worth more than the fixes.

**Eleven failed on the first re-run, then four on the second — and almost none were typos.**

**Most were my own fixes making the old plants insufficient, and green was the correct
answer every time.** Removing `stopPropagation` no longer reproduced the delete-bubbles
defect, because the per-slot settle window added for the *double-tap* case also swallows
that tap. Removing the tile handler's guard no longer reproduced, because the painting now
sets `pointer-events:none`. Removing the reduced-motion border difference no longer
reproduced, because the wave amplitude still separates the states. **Each plant had removed
one half of a property now held twice.**

**§25 took three attempts and taught the general lesson.** Its plants removed one painted
difference at a time — amplitude, then border width, then colour — and **each time the row
still told the states apart by a signal I had not thought of.** That is the design working:
the row deliberately carries four signals so no single one is load-bearing on a dim screen.
**Chasing them one at a time was the wrong SHAPE of plant.** Collapsing the state itself —
`var live = false` — collapses everything derived from it in one substitution, which is
what the claim actually means.

**And two arrangements made their own assertions unreachable.**

- **§17 recorded into the first EMPTY slot**, which becomes the target — and `playVoice()`
  plays the target, which is empty while being recorded into. So *"a preset tapped
  mid-record STARTED PLAYBACK"* **could not fire however unguarded the tiles were.** It now
  fills all three and records **over** one, leaving the old clip in place: the state that
  makes the hazard real, and the ordinary gesture once the panel has been used.
- **§3's clamp probe selected its node by a value filter** (`> 0 && < 0.5`), so an
  **unclamped** value of 99 fell outside the filter, was never read, and the probe reported
  clean. **A filter that hides the defect it is hunting** is the same shape as a check that
  recomputes the formula it is checking. Read by position now.

**Final state: 51 of 51 plants red for their own stated reason; check 26 green at 46
assertions; the full 21-check regression sweep green; the fence diffs to empty.**

## A process note that is mine, not the pass's

**I was polling for these runs by hand rather than arming a completion trigger**, which is
why progress reports landed when I happened to look rather than when a run finished. Fixed
mid-work: the waiters are harness-tracked now, **and they fire on a crash as well as on
success** — a watcher that only matches the success marker stays silent through a hang, and
silence is indistinguishable from still-running.
