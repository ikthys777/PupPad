# PUP-WO-0603 — The zoom lockout: a trap a three-year-old cannot leave

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `3379937`; **verify live HEAD**).
**Branch:** `build/wo-0603`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P6 — shipped-app remediation. **This reaches the device Buddy uses.**
**Subject SHA:** citations resolved at **`3379937`**, paired with symbols.

**Grounds:** **northstar invariant 5** and invariant 2 · architecture §3 (the fleet) ·
roadmap P6 · **Scotty, on the S10+.**

> **What this is:** on the S10+ a long press zooms the page far enough that the controls
> leave the screen, **and there is no way back.** Buddy is locked out until an adult
> force-quits the app. **This goes first in the queue.**

**Cadence:** build. **§1 IS A QUESTION, NOT CODE — ANSWER IT BEFORE BUILDING ANYTHING.**

---

## 0. THE PRIORITY RULING, AND THE PREMISE IT RESTS ON IS WRONG

**It goes first. It is NOT small, and that is not why.**

The co-architect put it first *"unless you can show me it is not small."* **I can, and the
ordering survives anyway — because size was never the right comparison.**

**Everything else queued is a thing that DOES NOT WORK. This is a thing that TRAPS HIM.**
Northstar invariant 5 requires a one-tap way back out of any state; **here the back
affordance is off-screen, so the tap does not exist.** A three-year-old cannot recover
and cannot articulate what happened — he hands back a broken toy and nobody knows why.
**Recoverability outranks joy and it outranks breadth.** The voice changer and the radar
X are both real; neither makes the app unusable.

**AND THE OBVIOUS FIX IS THE DANGEROUS ONE, WHICH IS WHY THE SIZE MATTERS.** The
candidate is *"a universal `touch-action` rule rather than 16 hand-placed ones."*
**Verified: that would break at least nine live surfaces.**

| | |
|---|---|
| `touch-action:pan-y` scrollers | **4** — `index.html:2223`, `:2316`, `:2393`, `:3155` |
| among them | the **panel drawer**, whose pan is **already MANDATORY** on the fleet and already parked work — a universal rule freezes the one gesture that reaches its last row |
| and | the **picker grid**, which scrolls once the tiles overflow |
| `overflow-x:auto` strips carrying **NO** `touch-action` | **≥5** — the camera filter row `:1094`, the gallery strip `:1110`, the sticker bar `:1111`, the map tool strip `:1780`, a toolbar `:613` |

**A blanket `touch-action:none` freezes every one of them**, and the five horizontal
strips would break *silently*, because they rely on the browser default today and no
check asserts they scroll. **That is a lockout fix that creates five smaller lockouts.**

## 1. ANSWERED — THE S10+ IS THE INSTALLED PWA, AND IT STILL ZOOMS

**Scotty, 2026-09-03: the S10+ is running the INSTALLED app, not a browser tab.**

**THE INSTALL HYPOTHESIS IS DEAD. Do not scope any part of this as a setup issue and do
not let this work order conclude "install it properly."** It is installed, `display` is
`fullscreen`, and it still zooms.

**That makes the fix NARROWER, not wider**, and it eliminates one whole branch:

- **`user-scalable=no` (`index.html:5`) is inert and standalone does not rescue it.**
  Chrome's accessibility override ignores the directive **regardless of display mode**.
  **ADDING `maximum-scale` IS A FLAG-AND-STOP** — it would look like a fix, change
  nothing, and close the ticket.
- **So the only effective in-page defence is `touch-action`, which Chrome DOES honour,
  plus an explicit multi-touch guard.** That is the whole surface. Everything else is
  either inert or out of reach.

**AND IT KILLS THE SAME HYPOTHESIS IN `PUP-WO-0602`.** The radar's context menu was
reported **on this same S10+**, so it is firing **in the installed PWA too** — that work
order's §0 alternative is closed by this answer and must be struck rather than tested
again.

## 2. THE CODE HOLE — `touch-action` IS NOT INHERITED

Sixteen declarations in the file, on `html`/`body` and fifteen elements. **`touch-action`
does not inherit**, so every panel and overlay without one leaves the browser free to
interpret a gesture — and a long press with a second contact becomes a pinch.

**Do it by ENUMERATION, not by a universal selector.** Apply `touch-action:none` to the
full-bleed **panel and overlay containers** — the surfaces that should never scroll — and
**leave every scroller's existing `pan-x`/`pan-y` alone.** The five `overflow-x:auto`
strips must **gain `touch-action:pan-x`**, not lose their gesture: they are unprotected
today *and* would be frozen by a blanket rule, so they need the opposite of both.

**AND PROVE IT WITH A CHECK THAT CAN GO RED — "we added it everywhere" is a convention,
and conventions are what this codebase keeps paying for.**

> **THE TRAP: a hand-maintained list of containers is the convention wearing a check's
> clothes.** It goes stale exactly the way the sixteen hand-placed declarations went
> stale, and the next panel added is the one missing from both. **Derive the set from a
> STRUCTURAL property** — walk the live DOM and assert that every element which is
> full-bleed and positioned, or which hosts the app's own pointer wiring, has a computed
> `touch-action` that is not `auto`. **Then plant a new container without it and show the
> check goes red.** If the set cannot be derived structurally, say so and stop — a check
> over a list someone must remember to update is not a check.

**And add the multi-touch guard.** `touches.length` is tested in exactly **2** places
today *(not 3)*. A guard that `preventDefault`s when `touches.length > 1` on the
non-scrolling surfaces is the direct answer to "a long press with a second contact
becomes a pinch" — **and a three-year-old always has a second contact.**

## 3. THE RECOVERY PATH — AND BE HONEST ABOUT WHAT IT CAN DO

**A page cannot force its own zoom level back to 1.** There is no API for it and
pretending otherwise is how this ships looking fixed.

**But invariant 5 does not require unzooming. It requires A WAY BACK.** So:

**Detect `visualViewport.scale > 1`** *(`visualViewport` occurs **0** times in the file
today; `gesturestart` also 0)* **and restore `scrollTo(0,0)`.** The exit lives at the
top-left — `#gameBack` and `#pickerBack` both sit at `max(10px, env(safe-area-inset-left))`
— **so bringing the viewport home brings the way out back within reach even while the
page is still zoomed.** That satisfies invariant 5 with the capability the platform
actually gives us.

**THE RECOVERY PATH IS NOT OPTIONAL AND IT IS NOT SECOND.** *(Scotty, explicitly.)*
**Prevention that is 99% correct still locks him out on the hundredth time, and he cannot
tell anyone what happened.** Build both, and treat a zoom that slips through as a case
the app must survive rather than one it must prevent.

**Assert the property, not the mechanism:** after a synthetic zoom, **the exit's rect
intersects the visual viewport** and **a tap at its centre still hits it.** A check that
asserts `scale === 1` asserts something the page cannot deliver.

## 4. Acceptance — ON THE S10+, WHICH IS THE DEVICE THAT SHOWS IT

**A fix verified only on the S25 is the exact failure mode `PUP-WO-0602` exists to
avoid.** On the S10+, installed **and** in a tab:

1. A long press anywhere on the console **does not zoom**, or if it does, **the exit is
   reachable within one gesture**.
2. **Every scroller still scrolls** — the drawer, the picker grid, and all five
   horizontal strips. **Name them individually in the check; a count is not a list.**
3. A two-finger touch on a non-scrolling surface does not pinch.
4. Nothing on the adult surfaces loses text selection or its own gestures.
5. The whole of `PUP-WO-0602`'s five items still pass — **these two work orders touch the
   same gestures on the same screen.**

## 5. Fence · 6. Pass · 7. Feedback

**Only `index.html` and `.github/ci/demo-*.mjs`.** `sw.js`, `manifest.json`, the icons
and all three of `games/` **diff to empty.** *(If the answer to §1 is "install it", say
so and stop — do not add a manifest change to this work order.)*

**`index.html` is served from `main:/`, so this merge reaches the root build.**

**No security lens** — no byte here comes from off-device. Right-sized pass. **Every new
check red with a plant that is a real defect and parses.** Probe: a long press that
slides; three fingers; a pinch that starts on a scroller and ends on a panel; zoom while
a game is mounted; and zoom while the celebration is up.

`FEEDBACK.md` parked with the work. Order: build → freeze → pass → disposition → feedback
→ PR. **Flag-and-stop:** a universal `touch-action` selector; adding `maximum-scale`; a
document-level `preventDefault`; **any claim about the S10+ measured on a desktop**; a
check you cannot show going red.
