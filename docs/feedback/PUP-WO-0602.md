# PUP-WO-0602 — the radar's long press — builder feedback

**Subject:** `build/wo-0602`, branched from live `main` at `1ef325c`.
**Built:** `index.html` (the radar's pointer wiring), `.github/ci/demo-radar.mjs`
(check 23, new), `.github/ci/demo-radar-controls.mjs` (5 red proofs, new).
**Fence:** `sw.js`, `manifest.json`, the icons and all three of `games/` **diff to empty**.

---

## 0. THE HARNESS QUESTION, ASKED FIRST — AND THE ANSWER IS BETTER THAN 0603's

CC-A's instruction was to ask, before building, whether this harness can produce the
gesture at all. It cannot — **and that turned out to matter far less here than it did for
the zoom, because the two halves separate cleanly:**

| | |
|---|---|
| **produce a long-press `contextmenu`** | **NO.** A 1400ms hold yields **zero** — and not just on this app: on a plain page with selectable text and no `touch-action` it is also zero. *The control is the point:* the harness cannot raise one **anywhere**. |
| **deliver and observe a `contextmenu`** | **YES.** A right-click raises a real event at the same coordinates, and the app's handler sees exactly what Android's finger-raised event would deliver. |

**So the TRIGGER is unverified and the SUPPRESSION is fully verified.** §1 delivers a real
`contextmenu` to the radar and asserts it is cancelled, delivers one to an adult surface
and asserts it is **not**, and both go red against plants. What remains unproven is
narrow and named: *that an Android long press raises the event this handler waits for.*

**§2 needs no hedge at all.** `pointercancel` is dispatchable, so the defect the S25 most
likely shows is reproduced and fixed **under measurement**.

*This is what 0603 could not have: there, the property itself was unfalsifiable. Here only
the trigger is.*

---

## 1. `wireTap` DOES NOT FIT, RULED WITH THE CODE IN FRONT OF ME

CC-A asked for evidence, not family resemblance. `wireTap` (`:2099`) already handles the
three gestures a three-year-old makes, so reaching for it is the obvious move. It does not
fit, for reasons that are properties of the gesture:

1. **`wireTap` fires on `pointerup`.** A long press must fire **while the finger is still
   down**, at `LONG_PRESS_MS`, with no pointerup in sight. `wireTap` owns no timer. *A long
   press is not a tap that took longer.*
2. **One gesture here has two outcomes** — a paw on a short tap, an X on a long press — and
   `wireTap`'s contract is one function per element.
3. **`fn()` takes no arguments.** Both marks are placed at the press coordinates and there
   is nowhere in that signature for them.

So the three properties are **built deliberately**. What is borrowed is the discipline —
one owner per press, and every way the press can end releases it.

---

## 2. THE THIRD INSTANCE OF THE SAME CLASS

`wireTap` binds `pointercancel` at `:2111`. The settings slider binds it at `:2485`. **The
radar bound none** — so *the one event the browser sends when it takes a gesture away* was
the one event the app's central feature ignored, and the timer outlived the gesture and
stamped an X the child never finished.

**The remedy was already in the file, applied to the newer code, and the older code never
came back for it.** That is `.bp-drag[hidden]`'s family and PUP-WO-0603's passive-listener
guard's family. **Three instances now, and the generalisation is worth more than any of
them:** when a rule is extracted into a helper, *the code that predates the helper is
exactly the code that will not have it* — and it is never the code anyone re-reads.

**Also fixed, and it was not in the work order:** a second `pointerdown` **restarted the
press and overwrote the position**, so the X landed under the second finger and the press
the child was actually holding was discarded. A three-year-old always has a second contact.

---

## 3. WHAT WAS DELIBERATELY NOT ADDED

**`-webkit-touch-callout:none`.** It is a WebKit property Chrome does not implement, and
the fleet is three Android phones. Adding it would read as a second layer of defence and
be **inert on every device we ship to** — the `maximum-scale` trap from PUP-WO-0603, one
work order later. Named in the code at the point someone would add it.

**A document-level `contextmenu` suppression.** It would fix the radar and take text
selection off every adult surface — the settings panel, the PIN entry, the Supabase fields.
`§5` names it a flag-and-stop, and **§1's second assertion measures the scope**: a
`contextmenu` away from the radar must survive, and the plant that moves the listener to
`document` goes red.

---

## 4. TWO DEFECTS IN MY OWN CHECK, BOTH CAUGHT BY IT FAILING A CORRECT FIX

- **I read `defaultPrevented` in the CAPTURE phase**, on `window` — which runs *before* the
  radar's own handler, so it was always `false` and the section reported the suppression
  missing on a build that has it. Moved to the bubble phase at `window`, the last hop.
- **I dispatched a hand-made `PointerEvent('pointercancel', {pointerId: 1})`** and the
  radar's owner-guard **correctly rejected it**, because the browser had assigned the live
  touch a different id. *Guessing an id is the same mistake as pasting a constant.* The
  check now asks the platform for a real `touchCancel`, and falls back to a synthetic event
  carrying **the id the page actually saw**, recorded on `pointerdown` — never a guessed one.

Both are the same lesson: **a check that fails a correct build is as expensive as one that
passes a broken one**, and both of these would have been "the fix doesn't work".

---

## 5. Verdict

| | |
|---|---|
| check 1 (syntax) | **PASS** |
| **check 23** | **PASS** — 6 assertions across 3 sections |
| **check 23 controls** | **PASS — 5 of 5 planted defects red**, each the shipped defect restored |
| **Fence** | `sw.js`, `manifest.json`, icons, all three `games/` — **empty** |

**Not vacuous:** §2 asserts that an *uninterrupted* long press still stamps its X, because
every "nothing went wrong" assertion above it is satisfied by a radar that does nothing —
and the plant that sets the timer to 999999ms goes red on exactly that.

**Acceptance is Scotty's, on both phones, installed and in a tab.** Item 4 — an interrupted
long press leaving no X, no stuck timer, and a working next tap — is measured here. Item 1,
that an Android long press no longer opens the menu, **is the one this desktop cannot
answer.**

---

## 6. The watchdog fires again — both blockers, and they are the same class as §2

CC-A found two, verified both, and correctly did not edit an unversioned file outside the
repo. Both fixed:

- **The unclaimed-PR block sat below the park exit.** `[ "$VERDICT" = "park" ] && exit 0`
  ran first — and **`park` is exactly the state that co-occurs with an unclaimed PR**: the
  builder finishes, parks, and waits. *The one check written for that situation exited
  before reaching it, every time.* Moved above the park exit.
- **`command -v gh` found nothing under the timer.** `~/bin` is on the **login**-shell PATH
  only and a systemd user service does not get it. Resolved via `$GH_BIN` →
  `command -v gh` → `$HOME/bin/gh`, the order `CLAUDE.md` prescribes. Verified with
  `env -i`: it now resolves and the query runs clean.

**That is three instances of unreachable code in one script**, which is an argument for the
script asserting its own reachability the way these checks now do. Recorded, not yet built.
