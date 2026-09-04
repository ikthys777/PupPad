# PUP-WO-0703 — CC-A's review at `835c04d`, and what it cost

The review is recorded durably as a comment on PR #67. It requested changes, upheld three
design calls, and found **five HIGH findings — three of which were created by the repair
for an earlier one.**

That is the finding worth keeping. **Repairing an unfalsifiable assertion means asserting
something *nearby*, and nearby is exactly where the same degeneracy lives** — same
scenario, same arrange, same handful of values. A repair is a new assertion and inherits
none of the old one's credibility.

So this round plants the repairs, and plants the repairs to the plants.

---

## H1 — the panel that never came back

Three taps: fill all three slots, tap the microphone to record over, tap the X on the slot
that is now waving.

`deleteVoiceSlot` ended with `voiceSetStage(...)`, and `rec.stop()` is **asynchronous** —
it does not null `voiceRecorder` on the success path. So `voiceCapturing()` was still true,
and `voiceSetStage` sets `pointer-events:none` on **all four preset tiles, both sliders and
the play button**. The one call that would have lifted it lives in the decode continuation,
and the F1 fix makes that continuation return early. **Nothing lifted it.**

It does not look broken. The slots still play when tapped. It looks like the panel stopped
responding — and the whole of §3, the *"more to move"* this work order exists for, was
inert. §30 asserted `recorderAfter`, `liveTracks` and `slotsLater` and never read
`pointerEvents`.

**A guard that suppresses a continuation also suppresses everything that continuation was
responsible for.** The repair is not another guard: the settlement of a recording now has
ONE expression — `voiceSettle()` — called on every exit (no chunks, decode failed, decode
succeeded, clip discarded because the slot was deleted), and `deleteVoiceSlot` no longer
paints a stage while a capture is still settling. §30 reads `pointerEvents` on every
control the stage dims, with a positive control that something *was* dimmed during the
recording.

## H2 — the only non-colour carrier of "recording" was the one that empties

*"One animation, two meanings"* stands for **which slot is live**. Its consequence had not
been paid for: **the slot row cannot tell recording from playing at all**, so acceptance
2(a) rested entirely on the transport row — on the record button's colour (**measured 11 of
255 in luminance**, nothing on a dim screen outdoors) and on the countdown ring. **The ring
is a countdown, so it empties as it runs.** Every other state in this panel is carried
twice by design; this one was carried once, and it is the state the work order is named
after.

**The record button's glyph is now a solid white SQUARE for the whole recording** — a
shape, held constant, independently true of the countdown, and the record/stop language of
every tape machine the child will ever meet. It also states what the button now does.

### And §25 could not report the pair it exists for

`if (named[i] === named[j])` is a byte comparison of screenshots. **Both** `recording` and
`playing` have `voiceWaveRaf` advancing the phase between captures, so two photographs of a
running animation are **never** byte-identical however the panel is painted. Of six pairs
only `empty == holding` was a genuine test.

The wave is now **stilled through the shipping path** — `prefers-reduced-motion`, which
`paintVoiceSlots` and `voiceWaveTick` already honour — rather than by a test-only hook.
That also makes it the harder case: under reduced motion the live slot has one signal
fewer, so a panel that passes here passes with motion too. **Two opposite controls run
first:** with motion ON two captures of a live slot must DIFFER (the camera can see
change); with motion REDUCED they must be IDENTICAL (the phase really is frozen). Both are
planted.

### §25 still cannot see the fading, and §35 is why

Measured, not assumed: **removing the square entirely leaves §25 green**, because §25
photographs at 700 ms when the ring is nearly full. The property H2 is about is not *"the
two states differ"* — it is that **a carrier of the difference is invariant across the
whole recording**. New §35 measures the record button's non-colour geometry at 0.7 s and
again at 90% of the hard stop, with the ring's own decay asserted in between so the late
sample is **proven** to be late. Two plants: never paint the square, and make it shrink
with the countdown.

## F-A — `idleRaf` could not be false

Sampled on a fresh panel — and `voiceWaveTick` is only ever called from
`setVoiceLiveSlot(i >= 0)` while `closeVoice` zeroes the handle, so the answer is 0 in
**every** build. Deleting the loop's `voiceLiveSlot < 0` guard (the rAF then rescheduling
forever with nothing live — the exact battery cost its own comment names) was **green
suite-wide**. The question is now asked where a running loop must decide to stop: **after**
a live slot goes away, with a positive control that the loop was running before it.

**And §27's `moving(held)` branch was the same defect one row down** — a filled slot
sampled when *nothing* is live, which is precisely when the loop is legitimately stopped,
so the path could not change in any build. Unfalsifiable exactly as the empty-slot half had
been. The property is real, so it moved to where a plant can break it: slot 1 is now filled
before the recording, and the *"slots that are not live must be still"* sample covers a
FILLED slot as well as an empty one.

## F-B — record-over targeting was asserted by a constant the defect also produces

`const before = 0` — and slot 0 is **simultaneously** the slot played, the first slot, and
`voiceTargetSlot`'s initial value. Hardcoding `nextVoiceSlot()` to `return 0` was **green
across the whole suite** while the line printed *"replaces the last-used slot (0)"*, and it
is the only place in the file asserting record-over targeting at all — so an upheld design
decision had no enforcement.

**The repair for "compares a value to itself" had landed on a constant the defect also
produces.** It plays **slot 1** now: the slots are filled in order so the target is 2, the
first slot is 0, and the initial target is 0. Only `playVoice` re-pointing the target and
`nextVoiceSlot` honouring it can put the recording on 1. Planted.

**And I removed my own repair's second half in the same pass.** I had added
`afterOver.target !== before` — which the arrangement already guarantees, because
`playVoice(1)` sets the target before the record-over ever happens. The same defect, made
by the same hand, one line later.

## F-C — `re.left` was computed and never read

Deleting the overlay removal from `closeVoice` was **green** while the pass line printed
*"and teardown removes it"*. Asserted, planted.

## F-D — the bound that had already drifted, and position replacing a value filter

§3's cave-wet bound read `hi: 0.50` while the app's derived headroom ceiling is
`CAVE_WET_MAX = 0.45`. **Raising the app's constant to 0.50 was green suite-wide** — the
peak sweep does not catch it either: `0.50 + 0.50/0.55 = 1.41` against a 0.70 source is
0.99, still under 1.

The probe's literals are the **specification** and the app's constants are the
implementation; that only works if a disagreement is reported. `window.__voice.bounds`
exports what the graph clamps to, and §3 now asserts every pinned bound against it. Two
plants, one in each direction: move the constant, and move the graph's clamp while the
constant stays put.

**And the positional read was the value filter wearing a different hat.** An earlier round
replaced `> 0 && < 0.5` — a filter that hid the defect it was hunting — with
`nodes[length - 1]`. Reordering cave's `nodes.push` is an ordinary refactor that changes no
behaviour and silently repoints that read at the **dry** gain, whose value sits comfortably
inside wet's bound. `buildVoiceGraph` returns its parameters **by name** now and they are
selected by identity.

## M2 — a slot waving "live" while silent, for the whole arming window

`stopVoicePlayback` stopped the nodes and never cleared `voiceLiveSlot` — and the F2 fix,
which makes a superseded `onended` a total no-op, removed the last thing that happened to
clear it by accident. Play slot 0, tap the microphone: **slot 0 waves at full amplitude
inside its amber ring while it is silent and the microphone is not yet open.** On first use
that window is however long the adult takes on the permission bubble — the longest and most
confusing moment in the panel's life, and the one moment where *movement means live* is a
lie.

## M1 — the guard covered only half its own window

`voiceDeletedDuringRecord` was set from `voiceRecorder && voiceLiveSlot === i`, and during
arming **both are unset**. Delete during the permission bubble and the decode wrote the clip
back into the slot the child had just emptied — F1's exact shape on the half of the window
F1's fix did not reach, and the *more* reachable half. The same tap also overwrote the
`'arming'` stage, destroying arming's only signal while the request was genuinely still in
flight.

Caught **on arrival** rather than at the decode, because catching it at the decode means
opening the microphone for fifteen more seconds and then throwing the bytes away.

New §36 stages both M1 and M2 on one rig: the real `getUserMedia`, resolution delayed by
1.2 s, which is what a permission bubble actually is.

## L1 — one clock per recording ever started

`clearVoiceTimers` has exactly one caller, `closeVoice`. A recording stopped **early** left
its 15-second hard stop running with nothing to cancel it. Record 3 s into slot 0 and stop;
start slot 1 at t = 5 s; at t = 15 s **the first recording's orphan timer stops the second
at 10 of its 15 seconds** while its ring still shows a third to go. `voiceRingTick`'s
comment claims *"only one clock"*.

New §37 reproduces it end to end — two recordings, and the later one must still be running
past the moment the earlier one's cap would have fired. **Two plants, because cancelling
the timeout and dropping it from the list are two effects** and a guard applied to one of
two effects is this repo's most-repeated defect family.

§37 also covers the other thing that outlived its owner: a natural playback end called only
`setVoiceLiveSlot(-1)`, so a finished `robot` playback left an **oscillator running into
the destination** until the next play or teardown.

## ST1 — and where I disagree with the review, with the reason

CC-A: the settle window *"was built for a synthesized-click hazard that `wireTap`'s
`detail === 0` guard already closes"*.

**Half of that is right and the half that matters is not.** `detail === 0` closes the
trailing **compatibility click** from the delete's own touch — a synthesized click, and
that half is genuinely already covered. What the window closes is a **second real finger**
landing where the control just vanished: ordinary `pointerdown` and `pointerup`, `detail`
of at least 1, indistinguishable at the event from a deliberate press. The window stays.

**The rest of ST1 is correct and it is a live defect.** Checked above the stop branch, the
window could eat a first tap: delete slot 1, tap the record button — `nextVoiceSlot` picks
the slot just emptied — the grant lands in well under 400 ms, and the child's tap on the
now-waving slot did nothing at all. Moved below the stop branch; new §38 stages the whole
gesture and reports a miss as a miss rather than as a pass.

## The countdown ring and `prefers-reduced-motion` — a ruling, not an omission

CC-A asked which it is. **It is load-bearing, so it does not stop — it steps.**

The wave can honour the preference by standing still because a live slot keeps full
amplitude, a thick ring and the brightest stroke; stillness costs it nothing. The countdown
has no spare signal: it *is* the answer to *"how much longer"*, and under the H2 ruling it
is one of only two non-colour carriers of "recording". A ring frozen at its starting value
states something false about the clip. So it keeps updating, quantised to fifteen
one-second steps instead of a continuous crawl, and it writes nothing between steps. **Its
loop is bounded by the recording it belongs to — at most fifteen seconds — while the wave's
is unbounded**, which is the reason one stops outright and the other does not. Asserted in
§28, planted.

## The plant list's own defects

**Two of the 51 plants were byte-identical** — same mutation, same expected text — so 51
plants were **50 defects**, and the duplicate's label claimed a close-then-reopen case its
scenario never staged. *A described defect reading like a demonstrated one, inside the list
of demonstrations.*

It is now a genuinely different defect with a label its scenario stages: keep the overlay
check and drop the **generation** half, and a grant issued by a panel that is gone is
adopted by the panel that replaced it — because after a reopen the overlay is back, so the
surviving half of the guard says yes. It runs against §15, which is the section that stages
a grant in flight across a teardown *and* a reopen. §5 never reopens and is right to stay
green there.

**And the list now checks itself before it runs.** A pre-flight applies every plant to the
current `index.html` and refuses to start if any of them **fails to apply** (a stale anchor,
which used to surface only as a lower number in the summary), **changes nothing** (a no-op
plant reports green correctly and proves nothing), or **duplicates another**. It found the
duplicate CC-A named plus five stale anchors in under a second, against an hour for the
full run.

## The banner that claimed a full run it had not made

`--only` on a retired section number exited 0 having asserted **nothing** and still printed
*"NO MICROPHONE SURVIVES TEARDOWN … WITH EVERY PAINTED WORD HIDDEN"*. **Check 25's own
defect class, one level down, in the file that reports it.** Assertions are counted now: a
run that asserts nothing fails, and the full prose only prints for a full run — under
`--only` the banner names the sections it actually executed and their count.

## What §25's `maskChanged` control cannot be planted from, and why that is stated

CC-A listed `maskChanged` among the live-but-unplanted branches. It is not reachable from
`index.html`: it fires when the masked words lie **outside the rectangle being compared**,
which is a property of the check's framing, not of the app. Every app-side change that
removes the words instead makes `hidden.length` zero and lands on a different branch. It
stays as a guard against a check-side regression that has happened once already, and it is
recorded here as unplanted rather than counted as planted.

## What is planted, and what is a control that cannot be

The list is **71 plants** now, up from 51 — and the 51 were 50 defects. Every assertion
added or repaired in this round is planted, in both directions where the property has two
(the clamp bound moving, and the graph's clamp moving away from it; the timer being
cancelled, and the timer being dropped from the list).

Three branches are **controls rather than assertions**, and they are recorded as unplanted
rather than counted:

- **§25's `maskChanged`** fires when the masked words lie outside the rectangle being
  compared. That is a property of the check's framing, not of the app; every app-side change
  that removes the words instead makes `hidden.length` zero and lands on a different branch.
  It guards a check-side regression that has already happened once.
- **§27's "the loop was running while a slot was live"** and **§30's "something was dimmed
  during the recording"** are positive controls. A build that breaks either one also breaks
  an assertion above it, so they cannot be reached in isolation. Their job is to stop the
  assertion below them from passing vacuously — a loop that never runs would otherwise
  satisfy "the loop stops", and a panel that dims nothing would satisfy "nothing is left
  dimmed".


## Two plants the first full run rejected, and both are findings

**The rewrite of the duplicate applied and did not reproduce.** The obvious repair for the
byte-identical pair was to remove the *other* half of the on-arrival guard — keep the
overlay check, drop the generation — and run it against §15, which does stage a grant in
flight across a teardown **and** a reopen. It reported **GREEN, correctly**: a stale grant
adopted by the reopened panel still cannot leak a microphone, because **the tracks are
protected unconditionally on three other paths** — `rec.onstop` stops the stream its own
recorder owns *before* it checks anything, and `closeVoice` stops whatever `voiceStream`
points at.

*A plant that applies is not a plant that reproduces.* This is defence in depth working,
not a missing assertion, so the plant is **removed rather than rewritten** and the gap is
stated: the generation half of the on-arrival guard defends **state, not tracks**, and has
no plant. §18 plants the generation half of the *decode* guard, where the consequence — the
previous session's clip installed into the fresh panel — is observable.

**And one plant's meaning changed when its section did.** `var live = false` — the
state-collapse plant CC-A called architecture §5 — used to demonstrate §25's slot-row
comparison. Now that §25 stills the wave and runs a camera control first, a build where no
slot ever paints as live **cannot produce a moving wave at all**, so the first thing this
plant reaches is that control. That is the right report: the section says its instrument has
nothing to see rather than pretending to compare states with it. The row comparison keeps
its own plant, which collapses `filled` and leaves the live paint intact, and the
state-collapse is still caught head-on by §26's *"the three states were not reached"*.

**Repairing an assertion can move which plant demonstrates it.** Re-pointing the label
quietly would have left the list saying something the run no longer showed.

---

## Final state

- **71 of 71 plants red, each for its own stated reason** (the list was 51, of which 50
  were distinct).
- **Check 26 green at 51 assertions**, up from 46: four new sections (§35 the recording
  carrier, §36 the arming window, §37 what outlives its owner, §38 the settle window) and
  repaired assertions in §3, §20, §25, §27, §28, §29 and §30.
- **The full 27-check regression sweep green**, `check-registered` included.
- **The fence diffs to empty** — `sw.js`, `manifest.json`, both icons and `games/` —
  against `b33ad20` and against `835c04d`, checked as a command in both directions.
- **The pass banner can no longer overstate a run**: zero assertions is a failure, and the
  full prose is reserved for a full run.

---

# Round 3 — what CI found that this machine could not

CI went red on `43e173a` at **check 26's CONTROLS**, not at check 26. Two plants, both §25:

```
FAIL  RED-WRONG-REASON  §25  the live slot paints exactly like a filled one
FAIL  GREEN             §25  the wave never advances, so two photographs are identical
```

**The plant designed to make two photographs identical did not make them identical there.**

## Byte-identity is a property of the renderer, not of the panel

H2's ruling was that a byte comparison cannot fail while anything animates. I stilled the
animation and **kept the comparison method**, which is architecture §5's third instance in
this work order: *a repair inherits the defect's shape.* This time the mechanism caught it
rather than a reviewer.

**And the cause is not noise, which is the part worth keeping.** The control that had to
see movement ran with motion **ON**, and this panel is **translucent over a live console**.
With motion on, everything behind the glass is moving too — so *"these two photographs
differ"* was true of the background whatever the wave did. The control passed by measuring
something that was not its subject, and the assertions it was guarding went unguarded.

Measured here after the fix: **4.9% of the row's pixels change between two captures with
motion on, and 0.000% with it reduced.** On this machine the wave happened to dominate; in
another container it did not, and the difference between those two facts is a scheduler.

## What replaced it

**The comparison is now a property of the painting:** the fraction of pixels that *visibly*
changed, decoded in the browser that drew them (an `Image` onto a canvas — arithmetic, no
new dependency) and thresholded per pixel so antialiasing on a glyph edge is not a state
change.

**Both controls now run in the same regime as the assertions they calibrate** — wave
stilled, page stilled — and **neither is about the wave any more**:

- **Null first:** two captures of one *unchanged* state must come out the same. A camera
  that invents differences cannot report that two states are alike.
- **Then positive:** a **live** slot and a merely **filled** one must come out different. A
  camera that returns a constant cannot report that two states differ — and with the wave
  taken away from both pictures, that is the acceptance in miniature.

Measured margins on this build: unchanged state **0.000%**, floor **0.050%**, the word mask
**0.107%**, closest real state pair **1.192%**. If a container is ever noisy enough to
break that, **the null control fails and the section abstains loudly** instead of passing
on noise.

## And one plant moved sections rather than being re-pointed

The plant that stops the phase advancing no longer belongs to §25 at all: §25 now measures
a **stilled** panel by design, so a defect in the animation is §27's business, where it is
already planted and red. Keeping it here would have meant a plant whose section cannot see
its defect — the same shape as the duplicate removed in round 2.

The `live = false` plant has now changed what it demonstrates **twice**, and both moves are
recorded rather than quietly re-labelled. It lands on the positive control, which is where
collapsing the live paint actually shows up once the wave is gone.

## Round 3 final state

- **70 of 70 plants red, each for its own stated reason** — one fewer than round 2 because
  the phase-advance plant moved to §27, where its defect is visible.
- **Check 26 green at 51 assertions**, unchanged in count: §25 kept its claim and changed
  its method.
- **The 27-check regression sweep is unchanged and still green** — `index.html` is
  byte-identical to `43e173a`; only `demo-voice.mjs` §25 and its two plants moved.
