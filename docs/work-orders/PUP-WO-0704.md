# PUP-WO-0704 — Block Pop's perfect clear earns a real celebration

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0704-celebration`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P7. **Subject SHA:** cite **symbols**.

**Grounds:** northstar invariants 1, 6 · `docs/findings/PUP-WO-0000.md` §8 (the game-module
contract) · `PUP-WO-0400` · Scotty's report from the device, 2026-09-04.

> **What this is:** the perfect clear is **the only win condition Block Pop has** — easy
> mode cannot be lost, which this project ruled deliberately — so it carries the entire
> emotional payoff, and Scotty says it underdelivers on the device. **But §0 comes first,
> because the effects it is missing ARE ALREADY IN THE CODE.**

**Cadence:** **§0 IS A MEASUREMENT, AND IT COMES BEFORE ANY NEW EFFECT.** Then build. One
PR, left unmerged.

## 0. FIRST FIND OUT WHY NOTHING SHOWS — DO NOT START BY ADDING

**Scotty reports: "no colour, no flash, no fireworks, nothing explosive or popping."**

**Verified at source before this work order was written: `celebrate()` already calls
`flash(...)` and already fires `burstAt(...)` in volleys.** The fanfare is not absent from
the code. **So something is suppressing it, or it is too weak to read on that screen — and
adding more to a suppressed path produces another round of "still nothing."**

*(Recorded because it nearly went the other way: reading the opening of `celebrate()`
shows a text node appended and no sparks, and stopping there would have produced a work
order to "add the missing fireworks" that already exist. §6.1 member 7 — resolving the
reference and stopping one frame short — in a fresh costume.)*

**Two candidate mechanisms. Measure, do not reason:**

1. **`api.prefersReducedMotion` is TRUE on the S10+.** `burstAt` returns `0` immediately
   when `reduced` is set — **every spark, by construction** — and Samsung's power saving
   is one of several things that can set it. **This single flag would explain the whole
   report except the flash**, and `flash()` is NOT guarded by it, which is itself worth
   understanding rather than assuming.
2. **The effects run and do not read** at that size, brightness and duration on a 412 px
   viewport in a child's hands.

**AND THERE IS A CHECK TO RE-EXAMINE.** `PUP-WO-0400` acceptance §1 asserts the win is
legible **with every painted word masked**. If `reduced` is true on Buddy's device and the
harness runs with it false, **that check has been passing in a world the child does not
live in** — *a number is only correct at the viewport it was measured at*, generalised
from a viewport to a media query. **Say which world it runs in.**

**Report §0's answer in `FEEDBACK.md` before building on it.** If the answer is (1), the
fix is largely "make the reduced path carry a real celebration" and the work is different
from what §1 assumes.

## 1. SCOPE — once §0 is answered

**A perfect clear should be unmistakable to a three-year-old across the room.** Colour,
flash, and something that reads as explosive or popping.

- **Borrow from Gyre's particle work.** *(The shared-path question is already ruled: a
  game module gets its effects through the module contract, not by reaching into another
  module. `games/gyre.js` is a reference to READ, not a dependency to import — Block Pop
  owns its own effects.)*
- **`burstAt` is already index-arithmetic rather than `Math.random`**, deliberately,
  because check 21 pins `Math.random`. **Keep that property in anything new** — a random
  effect collapses to one ring under the instrument and looks nothing like what ships.
- **REDUCED MOTION STILL GETS A CELEBRATION.** Stillness is allowed; *nothing* is not.
  The win must remain unmistakable with motion reduced — colour, scale and light can all
  carry it. **If §0 finds this is Buddy's actual path, this line is the work order.**
- **`CELEB_MS` is 3400 and `CELEB_MS_REDUCED` is 1600.** Scotty has not asked to change
  either; **one constant if he does.** Do not retune them on your own judgement.

## 2. INVARIANTS
- **1 — a non-reader must be able to work it.** "Good Job!" is text Buddy cannot read.
  **The celebration must be a win with every word covered** — the existing comment already
  makes that claim, and this work order is what makes it true.
- **6 — a game is a module.** No new global, no reach into another module, no
  `urlsToCache` line.
- **2 — one tap back**, including during the celebration.

## 3. ACCEPTANCE
1. **The fence holds** — `index.html`, `sw.js`, `manifest.json`, icons and `games/gyre.js`
   all diff to empty; **only `games/blockpop.js` and `.github/` change.**
2. **§0's answer is stated as a measurement**, with which world the harness runs in.
3. **The win is unmistakable with every painted word masked** — the existing check,
   re-run, **and re-run in the reduced-motion world too.**
4. **The reduced-motion celebration is still a celebration**, asserted, not assumed.
5. **One tap back during the celebration**, pressed with a finger.
6. **No timer, node or element outlives the game session** — the celebration owns a layer
   and `teardown` must reclaim it. §8.1's release guarantee.
7. **A losing or terminal state still does not call `celebrate()`.**
8. Every demonstration asserts the commit and the failing step name.

## 4. SCOPE FENCE — NOT here
- **The voice panel** — `PUP-WO-0702`, `0703`.
- **`games/gyre.js`** — read it; do not edit it.
- **Any new game-module API.** If the effect genuinely needs one, that is a **flag-and-stop
  and an architecture decision**, not a build step.
- **Retuning `CELEB_MS`.**

## 5. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze, corrections held until it returns.
Probes: exit mid-celebration · a perfect clear immediately after another · reduced motion ·
a perfect clear that is also a terminal state · **a plant that applies without reproducing**
· the words-covered assertion passing on leftover sparks from the line clear that triggered
the win rather than on the celebration's own effects.

## 6. UPWARD FEEDBACK — `docs/feedback/PUP-WO-0704.md`
Include **what §0 found**, and say plainly if the honest answer is that the celebration was
fine on a desktop and invisible on the device — that distinction is the whole value here.

## 7. FLAG-AND-STOP
- A need to touch `sw.js`, `manifest.json`, an icon, `index.html`, or another game module.
- **An effect that cannot be made to work under reduced motion.**
- A celebration that cannot be shown legible with words masked.

## 8. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
