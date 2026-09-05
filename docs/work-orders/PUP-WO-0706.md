# PUP-WO-0706 — The camera: a close that destroys, and the retention the code already admits is wrong

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0706-camera`. **Author:** CC-A · **Builder:** the PupPad builder.
**Phase:** P7. **Subject SHA:** cite **symbols**, not line numbers.

**Grounds:** northstar invariants **1, 2, 5** · `PUP-WO-0701` §1.0a (the retention ruling)
and §S.4 (which gave the bare-`click` controls their own number) · `docs/architecture.md`
§6.1 **member 5** · Scotty's device report and ruling, 2026-09-05.

> **What this is:** two defects Scotty found on the S10+. The first **destroys the child's
> photos through a control that looks like a dismiss**. The second is a retention the code
> **already documents as wrong in a comment and never applied** — and Scotty is now making
> the decision that comment says was not made.

**Cadence:** **§2 IS A MEASUREMENT BEFORE IT IS A BUILD.** §1 is a build and does not wait
for it. One PR, left unmerged.

## 0a. THE FENCE
**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.

---

# §1 — THE CLOSE THAT EXITS THE WHOLE CAMERA AND EMPTIES THE GALLERY

**Symptom (Scotty, on the device):** tap a thumbnail to expand it, press **CLOSE**, and you
are dumped to the main screen **with every picture gone**.

## 1.1 THE MECHANISM IS NOT THE ONE THE SYMPTOM SUGGESTS — READ THIS BEFORE YOU FIX ANYTHING

**The obvious reading is that the viewer's CLOSE is wired to the panel's close. IT IS NOT.**
Verified at source: `.gClose`'s `wireTap` handler does exactly one thing —
`if (full.parentNode) full.parentNode.removeChild(full)`. **It never calls `closeCamera`.**

**So a builder implementing the symptom's obvious fix would find the code already correct.**

**What actually happens is a PASS-THROUGH CLICK, and `wireTap`'s own comment names the
hazard:**

1. `.gClose` fires on **`pointerup`** and removes the `full` overlay.
2. The browser then dispatches the **trailing compatibility click**, hit-tested against
   **the DOM AS IT EXISTS AFTER that handler ran** — and `full` is gone.
3. `.gClose` sits at `top:6px; right:10px` of a full-screen overlay. **`#camCloseBtn` is the
   last child of a right-aligned flex row in the camera panel's header — the same corner.**
   The click lands on it.
4. **`#camCloseBtn` is wired on BARE `click`** — `addEventListener('click', …)`, with no
   `detail === 0` guard. A touch click carries `detail >= 1`, so **it fires.**
5. `closeCamera()` runs: the panel is destroyed and **`cameraGallery = []`.**

**`wireTap`'s comment describes this for a control CREATED during the handler. This is the
inverse — a control REVEALED by a removal — and it is the same defect.**

## 1.2 THIS IS THE PARKED ITEM, NOW LIVE AND DESTRUCTIVE

**`PUP-WO-0701` §S.4 ruled "the bare `click` controls — ITS OWN NUMBER".** That number was
never issued. **It is this one, and the item is no longer cosmetic:** the single control in
that panel still on bare `click` is now the one that eats a three-year-old's photographs.

> **RULED: every control in the camera panel goes through `wireTap`.** Not just
> `#camCloseBtn` — **all of them**, because the next pass-through will land on whichever one
> is still bare. *A synthetic click is not a finger.*

**AND THE VIEWER MUST NOT BE THE ONLY THING STANDING BETWEEN A TAP AND A DELETION.** Fixing
the click path is necessary and not sufficient — see §1.3.

## 1.3 INVARIANT 5 SAYS ONE TAP BACK. THIS WAS ONE TAP BACK TOO FAR

**Scotty's framing is the ruling:** the expanded viewer's CLOSE returns to **the tray**; only
the panel's own close leaves the camera. **That is already the code's intent and §1.1 is why
it is not the behaviour.**

**And the destructive half is invisible.** Nothing tells a child that dismissing one photo
throws away all of them — **and by invariant 1 nothing can, because a warning is a word.**
So the answer is not a confirmation dialog. **The answer is that the destruction stops being
attached to a dismiss**, which §2 delivers.

## 1.4 ACCEPTANCE — §1

1. **Expand a thumbnail, press CLOSE with a FINGER, and land back on the tray** with the
   camera open and **every photo still present.** Pressed as a real gesture — `pointerdown`,
   `pointerup`, and **the trailing click the browser actually sends** — not a synthetic
   `click`. *The defect is invisible to a synthetic click by construction.*
2. **A plant that reverts `#camCloseBtn` to bare `click` reproduces the defect** and the
   check goes red for its own stated reason. *Plant the repair.*
3. **No control in the camera panel is on bare `click`** — asserted as a property, not a
   list, so a control added later is covered.
4. **The panel's own close still leaves the camera**, pressed with a finger.

---

# §2 — RETENTION: SCOTTY IS MAKING THE DECISION THE COMMENT SAYS WAS NOT MADE

## 2.1 THE COMMENT IS THE FINDING, AND IT IS ALREADY IN THE FILE

The capture comment says, in the file, unprompted:

> *"§1.0a rules SESSION-scoped — 'everything is reaped on PWA close or reset' — and a store
> `closeCamera()` empties **dies sooner than that**." … "Making it outlive the panel would be
> a different decision with a different risk, and §2 makes that a flag-and-stop rather than a
> quiet `setItem`. **It is not made here.**"*

**The builder was right to refuse to widen its own scope and right to flag it.** That is the
discipline working.

**AND IT IS ALSO ARCHITECTURE §6.1 MEMBER 5, IN THE FILE THAT NAMES IT.** The comment records
that *"the correction reached the feedback doc and not this line."* **A deviation flagged and
then left is only half the discipline working** — the flag has been sitting in a comment
since `PUP-WO-0700`, correct and unacted-on. **Say this in `FEEDBACK.md`.**

## 2.2 THE RULING

**Scotty, 2026-09-05: images retain until the PWA is ACTUALLY CLOSED. Not on camera exit.
Not on backgrounding.**

**This is not a change to `PUP-WO-0701` §1.0a — it is bringing the implementation TO it.**
§1.0a already ruled session-scoped, *"everything is reaped on PWA close or reset."* The
current store is **stricter than the ruling**, and that gap is what Scotty is closing.

## 2.3 §2 IS A MEASUREMENT FIRST, AND THIS IS THE PART THAT MATTERS

**BACKGROUNDING IS NOT CLOSING.** Android reclaims a backgrounded PWA, **and a pure
in-memory array dies with the process.** From Buddy's side that is *losing his photos because
someone rang the phone* — and it would be a retention that **quietly fails on the exact
device it is for.**

> **MEASURE, THEN PRICE, THEN BUILD. Report the answer in `FEEDBACK.md` BEFORE building on
> it.**

**Answer with evidence:**

1. **Does an in-memory array survive backgrounding on the S10+?** *(Expected: no, on reclaim.
   Prove it rather than assuming — and if it cannot be tested without the device, SAY SO,
   build the harness, and mark it UNVERIFIED.)*
2. **If it does not, what does?** `sessionStorage` is the candidate whose semantics match the
   ruling almost exactly — it survives backgrounding and reclaim, and **dies when the PWA
   actually closes**, which is §1.0a's sentence. **Price it honestly:**
   - **The quota.** `sessionStorage` is small (commonly ~5 MB) and a captured snap is not.
     **Measure a real capture's size** and say how many fit. `GALLERY_MAX` already caps the
     count — **a cap that was chosen for memory may be the wrong cap for a quota.**
   - **What happens when it is exceeded** — it must **fail closed and visibly degrade**,
     never throw and never silently drop the newest.
   - **Whether it is still "cache-only… because kids."** *(It is: `sessionStorage` is cleared
     by the same PWA close §1.0a names. **`localStorage` is NOT and remains forbidden** — the
     comment's "never `localStorage` either way" stands.)*
3. **If neither works within the constraints, say so and stop.** *A retention that looks like
   it works and loses photos on a phone call is worse than one that honestly ends at camera
   exit.* **That is a flag-and-stop, not a compromise to ship.**

## 2.4 ACCEPTANCE — §2

1. **§2.3's measurement is reported before any store change**, with which parts are
   UNVERIFIED for want of the device.
2. **Photos survive closing the camera panel and reopening it** — the defect Scotty reported.
3. **Photos survive a backgrounding**, or the feedback states plainly that they do not and
   why, with the alternative priced.
4. **Photos DO NOT survive an actual PWA close.** *(§1.0a. Assert the reaping, not just the
   retention — a store that never clears is a different defect.)*
5. **`localStorage` is not used.** Asserted at the mechanism.
6. **Over-quota fails closed and visibly**, never throws.
7. Every demonstration asserts the commit and the failing step name.

---

## 3. SCOPE FENCE — NOT here
- **The camera's audience** — Scotty ruled photos stay on the wire, 2026-09-04. Closed.
- **`PUP-WO-0705`** — the tile allowlist, in flight.
- **The voice panel and Block Pop.**
- **Any `localStorage` write.** That is a flag-and-stop, not a fallback.

## 4. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze **into a NEW directory** *(a fixture that carries state
from a previous step is not the fixture its label names — architecture §5)*, corrections held
until it returns.
Probes: the pass-through click at every control in the panel · a second finger during the
viewer's close · expand, close, expand, close repeatedly · fill the gallery to `GALLERY_MAX`
and past the quota · background mid-capture · **a plant that applies without reproducing** ·
the reaping assertion passing because nothing was ever stored.

## 5. UPWARD FEEDBACK — `docs/feedback/PUP-WO-0706.md`
**Lead with §2.3's measurement.** Include the member-5 note from §2.1 — *a deviation flagged
in a comment and never applied is half the discipline* — because that is the transferable
part.

## 6. FLAG-AND-STOP
- **Any `localStorage` write.**
- **A retention that cannot survive backgrounding and cannot be honestly priced** — say so
  and stop rather than shipping one that fails on Buddy's phone.
- `sw.js`, `manifest.json`, an icon, or `games/`.

## 7. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
