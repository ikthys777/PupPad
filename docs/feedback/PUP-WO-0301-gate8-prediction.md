# PUP-WO-0301 acceptance 8 — the prediction, recorded BEFORE the test

**Committed by CC-B before any human saw the control panel.** `PUP-WO-0200` §1.2's
discipline and `PUP-WO-0201` §3.2's: a prediction written after the result is not a
prediction, and the value of this file is entirely in its date.

**The gate:** with all text covered, **a real person who has not seen the app** operates
the control surface — **changes something, undoes it, and gets out.** The tester is a
human and may be Scotty. **A model predicting what a stranger would do is not evidence
about a stranger** (§7), so nothing below is a result and none of it closes the gate.

**What the tester is shown:** Gyre running, drawer open, no words on screen at all.
There is nothing to cover — that is itself a claim this work order makes and check 19
asserts. Ask them, in this order:

1. Make the picture change. *(anything)*
2. Now put it back the way it was.
3. Now get out of this and back to the buttons screen.

---

## The predictions, each falsifiable

| # | claim | how it fails |
|---|---|---|
| 1 | **The first thing they touch is a slider**, not a button. Six of them, each 56px tall and the width of half the screen, against sixteen small squares. | They touch a swatch or the dice first. |
| 2 | **They discover "drag" without being told.** A tap anywhere on the bar jumps the value there, so a tap teaches the mapping even if they never drag. | They tap once, see the fill move, and stop — treating it as a button. |
| 3 | **They name the colour strips correctly on sight** — "those pick the colours" — with no prompting. This is §2.3's whole bet: the tile IS the colour. | They ask what the coloured squares are. |
| 4 | **The two strips are confused with each other.** Palette and background are both a row of coloured squares, distinguished only by which colours are in them. I expect at least one tester to press a background swatch expecting the particles to change. | They separate them immediately. |
| 5 | **The dice is understood as "random", not as "roll for a score".** | They describe it as a game mechanic or a play button. |
| 6 | **`▶◀` / `◀▶` is the weakest control on the surface.** I expect "arrows", not "pull versus push". It is the one control whose meaning has to be learned from what it does, and §2.2 forbids a slider or a word here. | They read it as in-vs-out unprompted. |
| 7 | **The crossed-out icons read as off.** 🌊 with a red bar is a convention adults have; the question is whether it survives having no word beside it. | They think the slash means "broken" or "not allowed here". |
| 8 | **"Put it back the way it was" is answered with ↺ (reset) rather than by dragging the slider back**, and that is the outcome I want — undo by one tap. | They drag back, or they cannot find any way to undo. |
| 9 | **Nobody fails step 3.** The red disc is top-left, alone, the only red thing on the screen, and it has been the exit since `PUP-WO-0200`. | Any hesitation at all on the exit is a finding and it outranks everything above. |
| 10 | **At least one control will be called uninterpretable.** With sixteen of them and no words, I do not believe every one lands. §2.2b's ruling is that this costs one row and is the correct trade; the tester's answer is the evidence for or against that ruling, and I am predicting the ruling holds. | Every control is understood, in which case the surface is more legible than I think. |

## What I am NOT predicting

Whether Buddy likes it. He is three, he cannot be interviewed, and §2.2b is Scotty's
observation of him rather than a claim I can test. **Acceptance 8's tester is a
stranger who can talk**; whether the toy is fun is a separate, longer question and it
is answered on the tablet, not here.

## Status

**OPEN and UNRUN.** No human has operated this surface as of the commit that adds this
file. If none is available, the gate stays open — it is not simulated, and this file is
not a substitute for it.
