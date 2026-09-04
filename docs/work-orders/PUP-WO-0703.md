# PUP-WO-0703 — Voice slots, more to move, and a recording a child can SEE

**Repo:** ikthys777/PupPad · **Base:** `main` — **verify live HEAD, and it must already
contain `PUP-WO-0702`.** **Branch:** `build/wo-0703-slots`. **Author:** CC-A ·
**Builder:** `builder-61`. **Phase:** P7.
**Subject SHA:** cite **symbols**, not line numbers.

**Grounds:** northstar invariants 1, 2 · `docs/architecture.md` §5 · Scotty's direction
of 2026-09-04, from watching Buddy use the panel.

> **What this is:** three things Scotty asked for on the voice panel — **multiple clips in
> slots**, **more sliders and more modularity**, and **visual feedback that tells a
> non-reader what is happening.** The third is not polish. It is an invariant-1 defect
> with a design Scotty already supplied.

**Depends on `PUP-WO-0702` being merged** — voice is local-only by then, so **nothing here
touches a wire and there is no audience question to reopen.** That is why it is second.

**Cadence:** build. One PR, left unmerged.

## 0a. THE FENCE
**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.

## 1. THE FEEDBACK IS FIRST, BECAUSE IT IS THE DEFECT

**Scotty, verbatim: the record button dims everything else and stays bright — and NOTHING
TELLS A NON-READER THAT RECORDING IS HAPPENING**, nothing shows a clip was saved, and
nothing shows a slot holds anything.

**That is invariant 1 failing, not a missing flourish.** A three-year-old cannot read a
label and cannot infer "recording" from the rest of the screen going dim. **Dimming says
what is UNAVAILABLE. Nothing says what is HAPPENING.**

### 1.1 THE SINE WAVE — Scotty's design, and take it as specified

**A sine-wave animation on each slot. It runs on the slot being recorded INTO while
recording, and on the slot being played FROM during playback.**

**Same animation, two meanings, both legible without words.** That is precisely what
invariant 1 asks for, and it is better than two different animations would be: the child
learns one thing — *this slot is the live one* — rather than two.

- **Animate it, do not merely draw it.** A static wave is a decoration; a moving one is a
  state.
- **It must be visible at arm's length on a 412 px-tall landscape viewport.** *A number is
  only correct at the viewport it was measured at* — measure on all three fleet sizes.
- **Reduced motion must still distinguish the state.** Stillness is allowed; ambiguity is
  not. Do not let `prefers-reduced-motion` erase the only signal a non-reader has.

### 1.2 A FILLED SLOT MUST NOT LOOK LIKE AN EMPTY ONE

Three states, distinguishable **at a glance and with every word covered**: empty ·
holding a clip · live (recording into / playing from). **Do not carry the difference on
colour alone** — shape or fill as well, because it must survive a dim screen outdoors.

## 2. SLOTS

**Three slots.** *(Ruled: the panel already carries a preset row and a slider on a 412 px
viewport; three fit as a row, three is enough to choose between, and a fourth costs the
row its size before it earns anything. Change it if measurement says otherwise — and say
so.)*

Per Scotty: **record into a slot · delete a slot · record over a slot.**

- **Every control on `wireTap`, never bare `click`.** *A synthetic click is not a finger.*
- **DELETE IS AN EXPLICIT, VISIBLE CONTROL ON A FILLED SLOT — not a long press.** *(Ruled.
  `PUP-WO-0602` is still carrying an unverified Android long-press item, a long press is
  unreliable for a three-year-old, and a destructive action behind a hidden gesture is the
  worst pairing of the two.)* At least 44 px, and **it appears only on a filled slot**, so
  an empty slot has nothing to press by mistake.
- **Recording over a slot replaces it.** No confirm dialog — a confirm is a word.
- **Every slot's clip is released on teardown.** `PUP-WO-0701`'s teardown discipline now
  has three times as much to release: no buffer, no node and **no microphone** survives
  the panel. **§12/§15/§21 stay green.**

## 3. MORE TO MOVE — sliders and modularity

**Scotty wants MORE to move, not fewer.** He watched Buddy enjoy moving a control and
hearing it change; that is the feature.

**Give each preset a second axis where its mechanism honestly has one** — e.g. cave's
delay time and its wet mix; robot's ring frequency and its depth. **Do not invent a
control that changes nothing**: a slider a child moves with no audible result teaches that
the panel is broken.

**Every value stays clamped, and the sweep stays honest.** `clampNum` bounds every
AudioParam; the no-clipping / no-silence sweep must cover **the new grid, not the old
one** — more sliders means more positions, and the peak must stay below 1 across all of
them. **A requirement and its backstop must not be the same number.**

## 4. ACCEPTANCE — proven, not asserted

1. **The fence holds**, checked as a command.
2. **THE WORDS-COVERED TEST IS THE CENTRAL ONE.** With every painted word masked: it is
   apparent that recording is happening, which slot it is going into, that a clip was
   saved, and which slot is playing. **Measured with the text masked, not argued.**
3. **Three slots: record, record over, delete** — each pressed with a finger, each from
   the panel's real state.
4. **The three slot states are distinguishable with words masked** — and **not by colour
   alone**, asserted as a property.
5. **The sine wave is ANIMATING while recording and while playing** — assert motion
   (sampled at two times), not the presence of an element. *Check the effect, never the
   installation.*
6. **Reduced motion still distinguishes the live slot.**
7. **No clipping and no silence across the full new preset × slider grid.**
8. **No microphone survives teardown**, from every state, with three slots in play.
9. **One tap back from every state**, including mid-record and mid-playback.
10. Every demonstration asserts the commit and the failing step name.

## 5. SCOPE FENCE — NOT here
- **Any wire.** `PUP-WO-0702` removed it and this does not reintroduce it.
- **Block Pop's celebration** — `PUP-WO-0704`.
- **The camera.**

## 6. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze, corrections held until it returns.
Probes: delete a slot mid-playback of that slot · record over the slot that is playing ·
fill all three then exit mid-record · press two slots at once · **a plant that applies
without reproducing** (architecture §5) · the words-covered test with the animation
running but conveying nothing.

## 7. FLAG-AND-STOP
- A live microphone that outlives the panel.
- **A feedback design that cannot be shown to work with the words covered.** Say so and
  stop — that is the whole point of the work order, and a pretty animation that fails it
  is a failure, not a partial success.
- `sw.js`, `manifest.json`, an icon, or `games/`.

## 8. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
