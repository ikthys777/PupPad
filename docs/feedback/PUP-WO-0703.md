# PUP-WO-0703 — upward feedback

**Branch `build/wo-0703-slots`, based on `main` at `b33ad20` (verified live).**
Disposition: `docs/findings/PUP-WO-0703-adversarial.md`.

**The fence holds** — `sw.js`, `manifest.json`, both icons and `games/` diff to empty,
checked as a command.

## The feedback design, built as specified

**One animation, two meanings.** The wave runs on the slot being recorded INTO and the slot
being played FROM, so the child learns one thing — *this slot is the live one*. Movement
means live and nothing else: an empty slot and a filled-but-idle slot are both still, and
check 26 §27 asserts that in both directions.

**Three states, and never on colour alone**: empty is a flat line with a dashed outline,
holding is a still wave with a solid one, live is a moving wave with a thick ring. Shape,
outline and the presence of a control carry it; colour is the fourth signal.

**Reduced motion stills the wave without erasing it** — full amplitude, thick ring,
brightest stroke.

## Two interpretations I made, both reversible

**1. THE LIVE SLOT IS ALSO THE STOP BUTTON.** Not in the work order. A probe found the
second tap on a recording slot was swallowed by the capturing guard, leaving the only stop
on the microphone button — **which is not where the child is looking, because the wave is
on the slot.** One line to revert.

**2. RECORD-OVER IS THE MICROPHONE BUTTON, not a mode.** With an empty slot it fills the
first one; with all three full it replaces the last-used one, and the wave starts on that
slot so the child sees which is being replaced. No confirm, no long press, no selection
state.

## THE SECOND AXIS ON up/down IS A SECOND MECHANISM, AND I AM NOT DRESSING IT UP

§3 says give each preset a second axis **where its mechanism honestly has one**.
Resampling has exactly one parameter — pitch and tempo move together, that *is* the effect
— so a second axis of that mechanism does not exist. The brightness slider is **a lowpass
stacked on top**: a different mechanism, chosen because it passes the only test that
matters (a 700 Hz → 8 kHz sweep is dramatically audible on a squeaky voice) and because a
preset with one slider beside three with two is worse for the child. **Robot's depth and
cave's wet mix are genuine second parameters of their own mechanisms.**

## What went wrong, because it is the useful part

**Eight product defects. One I found by reading; seven came from a probe or the pass.**

- **The delete control sat on the slot the microphone was filling**, and deleting it left
  the microphone open for fourteen seconds with the wave gone, the button repainted idle
  and the ring reset — then wrote the clip back into the slot the child had just emptied.
  **The work order's central acceptance, failing without even needing the words masked.**
- **The countdown ring — whose comment says the child can SEE the end coming — was painted
  entirely underneath the record button.** Pre-existing; this work order removed the last
  half-pixel of it.
- **My comment claimed a lowpass cannot boost.** `Q` defaults to **1**, read in dB: a
  +1.96 dB peak, measured 1.2533. **Not setting a parameter is not the absence of it.**
- **Double-tapping delete opened the microphone** — a control that *disappears* mid-gesture,
  the mirror of `PUP-WO-0404`'s.
- And **a comment of mine claimed a mechanism I had not written**: that the delete control
  stopped its tap reaching the slot. It stopped nothing.

**And four of my own assertions were blind**, including the central one: **§25 framed the
slot row, and the panel's only painted word is outside that frame** — so the mask changed
nothing in the compared image while the pass line said *"with 1 painted word(s) hidden"*.

## Acceptance

| # | state |
|---|---|
| 1 | **MET** — fence diffs to empty, checked as a command. |
| 2 | **MET** — §25 photographs the whole panel with words masked; empty / recording / holding / playing all differ, and the mask is proven to change the picture. |
| 3 | **MET** — §29: three slots recorded, recorded over and deleted with a finger. |
| 4 | **MET** — §26: the three states differ in border style, border width, wave amplitude and control presence, not colour. |
| 5 | **MET** — §27 samples the path at two times while recording and while playing. |
| 6 | **MET** — §28. |
| 7 | **MET** — §3 sweeps the full 144-position grid; worst peak 0.84, and §33 asserts no filter boosts. |
| 8 | **MET** — §4/§12/§15/§21/§30 kept and green; the pass measured 95 streams across 47 teardowns with 0 live tracks. |
| 9 | **MET** — §6. |
| 10 | every check asserts the commit and names its failing step. |

---

# Round 2 — after CC-A's review at `835c04d`

Full disposition: `docs/findings/PUP-WO-0703-review-round2.md`. The review is recorded
durably as a comment on PR #67 rather than only in a message, which is the project's own
rule finally applied to the one artefact that had never obeyed it.

**Five HIGH findings, and three of them were created by the repair for an earlier one.**
That is structural rather than careless, and it is the thing worth carrying forward:
repairing an unfalsifiable assertion means asserting something *nearby*, and nearby is
exactly where the same degeneracy lives — same scenario, same arrange, same handful of
values. **A repair is a new assertion and inherits none of the old one's credibility.**

## The product defects

- **Deleting the slot the microphone was filling left the panel permanently dead.** Not
  broken-looking — the slots still played. Every preset tile, both sliders and the play
  button were `pointer-events:none` and **nothing ever lifted it**, because the one call
  that would have was inside the continuation my own earlier fix makes return early.
- **The only non-colour signal that says "recording is happening" was the countdown ring,
  and a countdown empties.** By the last seconds of a fifteen-second clip the microphone is
  open with an 11-of-255 colour step left to say so. **The record button now holds a solid
  white square for the whole recording** — a shape, constant, and it also states that the
  button will now stop.
- **A slot waved "live" while silent through the whole permission bubble.** Play a clip,
  tap the microphone: the playback stops and the marker stayed. On first use that window is
  as long as the adult takes on the prompt.
- **Deleting during the permission bubble was undone by the grant.** The guard covered the
  recording half of the window and not the arming half — the same defect as the headline
  one, on the more reachable half of its own window.
- **One hard-stop timer per recording ever started.** A recording stopped early left its
  fifteen-second timer running, and it would later stop a *different* recording at a moment
  that recording's own ring said was not yet.
- **A finished robot playback left an oscillator running** into the destination until the
  next play or teardown.
- **The settle window after a delete could swallow a stop.** It sat above the stop branch,
  so the child's tap on the slot that was waving at them did nothing.

## The assertions that could not fail

Four, and all four were repairs from the previous round: the wave-loop guard sampled where
the answer is 0 in every build; record-over targeting compared against slot 0, which is
*simultaneously* the slot played, the first slot and the default target; an overlay-removal
result computed and never read; and a clamp bound that had already drifted 11% from the
constant it was pinning. **Plus one I removed in this pass that I had added in the last
one** — a `target` assertion the arrangement already guaranteed. Same defect, same hand,
one line later.

## Where I disagree with the review

**The settle window stays.** `wireTap`'s `detail === 0` guard closes the trailing
compatibility click from the delete's own touch — that half is genuinely covered. It does
not close a **second real finger** landing where the control just vanished: ordinary
pointer events, `detail` of at least 1, indistinguishable from a deliberate press. The rest
of ST1 is right, and moving the check below the stop branch is done.

## The ruling you asked for

**The countdown ring does not honour `prefers-reduced-motion` by stopping, and that is a
decision.** It is an essential indicator and, under the finding above, one of only two
non-colour carriers of "recording"; a ring frozen at its starting value states something
false. It steps once per second instead of crawling, writes nothing between steps, and its
loop is bounded by the recording — at most fifteen seconds — where the wave's loop is
unbounded, which is why that one stops outright and this one does not.

## The check's own housekeeping

The plant list now **validates itself before it runs**: every plant must apply, must change
the file, and must not duplicate another. It found the byte-identical pair CC-A named — 51
plants were 50 defects — plus five anchors this round's edits had staled, in under a second
against an hour for the full run. And **the pass banner can no longer print a claim about
assertions that did not run**: a run that asserts nothing fails, and the full prose is
reserved for a full run.

## Still yours, unchanged

Acceptance item 5 — the four glyphs in front of a person who has not seen the app, with 🏔
recorded in advance as an expected failure — and the OpenStreetMap tile egress.

## Acceptance, restated where round 2 changed the evidence

| # | state after round 2 |
|---|---|
| 2 | **MET, and for the first time falsifiably.** §25 stills the wave through the shipping reduced-motion path and proves its camera can report *both* a difference and a sameness before comparing anything; all six whole-panel pairs differ. **§35 is new** and asserts the part §25 structurally cannot see: that a carrier of "recording" is unchanged from 0.7 s to the last seconds of the clip while the ring empties beneath it. |
| 4 | **MET** — unchanged (§26). |
| 5 | **MET, and the loop now has to stop.** §27 samples the path while recording and while playing, checks a *filled* neighbouring slot stays still, and asserts the rAF stops itself once nothing is live — asked after a live slot goes away, where the answer can be no. |
| 6 | **MET, with a ruling.** §28 keeps the wave-stilling assertions and adds the countdown: under reduced motion it steps rather than freezes, because it is an essential indicator and one of only two non-colour carriers of "recording". |
| 7 | **MET, and the bound is now pinned.** §3 reads every clamped parameter by name from the graph rather than by position, and asserts its own literals against the constants the app clamps with — a bound that moves in either direction is reported as a disagreement instead of silently widening the probe. |
| 8 | **MET, and wider.** §36 covers the arming window — a delete during the permission bubble is not undone by the grant that follows it, and no microphone opens for a slot that no longer exists. §37 covers what outlives its owner: the hard-stop timer and a finished playback's graph. |

## Round 2 final state

**71 of 71 plants red for their own stated reason; check 26 green at 51 assertions; the
full 27-check regression sweep green; the fence diffs to empty against `b33ad20` and
against `835c04d`.**

## Round 3 — CI caught what this machine could not

**Check 26 PASSED in CI and its CONTROLS failed**, which is the plant discipline doing its
job off this machine for the first time. §25 still compared screenshots for exact equality,
and **byte-identity is a property of the renderer rather than of the panel**: the plant
built to make two photographs identical did not make them identical there.

The cause is specific and worth keeping. **The control that had to see movement ran with
motion ON, and this panel is translucent over a live console** — so "these two photographs
differ" was true of the background whatever the wave did, and every assertion that control
was guarding went unguarded. Measured: 4.9% of the row's pixels change between two captures
with motion on, 0.000% with it reduced.

§25 now compares **the fraction of pixels that visibly changed**, decoded in the browser
that drew them, and **both controls run in the same regime as the assertions they
calibrate** — a null result (one unchanged state must measure below the floor) and a
positive one (a live slot must photograph differently from a merely filled one). Margins:
0.000% for an unchanged state, a 0.050% floor, 0.107% for the word mask, 1.192% for the
closest real pair.

**70 of 70 plants red for their own stated reason; check 26 green at 51 assertions.**
