# PUP-WO-0603 — the zoom lockout — builder feedback

**Subject:** `build/wo-0603`, branched from live `main` at `df502de`, merged forward through
`1046a3d`, `f390289` and `caa3a80` as §2, §3 and §3a were re-ruled mid-build.
**Built:** `index.html`, `.github/ci/demo-zoom.mjs` (check 22, new),
`.github/ci/demo-zoom-controls.mjs` (7 red proofs, new).
**Fence:** `sw.js`, `manifest.json`, the icons and all three of `games/` **diff to empty**,
confirmed with `git diff --stat origin/main --` against each.

---

## 0. WHAT THIS WORK ORDER DELIVERS, IN ONE SENTENCE, BECAUSE THE ALTERNATIVE IS THAT A READER INFERS SOMETHING BETTER

**This is hardening that is VERIFIED AS BUILT and UNVERIFIED AS EFFECTIVE. It does not
claim to fix Scotty's symptom.** That is a real category and it is worth shipping — but it
is not a fix, and nothing below should be read as one.

**The reported defect has never been reproduced off-device.** Not by a pinch, not by a long
press, not by four separate zoom injectors. Every claim here is about Chromium on a
desktop.

---

## 1. Premises — all verified at source before building

`index.html` is **byte-identical** between the work order's subject SHA and my base, so
every citation resolves. Confirmed: 16 `touch-action` declarations; the 4 `pan-y` scrollers
at `:2223`/`:2316`/`:2393`/`:3155`; **0** `pan-x`; the 5 `overflow-x:auto` strips at
`:613`/`:1094`/`:1110`/`:1111`/`:1780`; `touches.length` in exactly 2 places;
`visualViewport`, `gesturestart` and `contextmenu` all **0**; `:5` carrying
`user-scalable=no` and no `maximum-scale`.

---

## 2. §2's MECHANISM WAS REFUTED BEFORE IT WAS BUILT ON

`index.html:17` **already** carries `html,body{…touch-action:none…}`. Measured with real
two-point touch, and **the null result is what makes the rest mean anything**:

| fixture | scale |
|---|---|
| **all-`auto`, no `touch-action` anywhere** | **1 → 5, ZOOMED** — *the instrument can see a zoom* |
| root `none`, panel unspecified | 1 → 1 blocked |
| root `none`, panel explicitly `auto` | 1 → 1 blocked |
| root `auto`, panel `none` | 1 → 1 blocked |

For a **document-level** gesture the effective `touch-action` is the intersection up the
ancestor chain, so the root declaration decides it whatever a panel computes. *"`touch-action`
does not inherit"* is **true of the property and false of the behaviour.**

**And "the strips would break silently" was also wrong.** A root `none` does **not** freeze
descendant scrollers — the intersection stops at the scroll container, and all three
fixtures scroll. The strips are not unprotected-and-frozen today.

**Ruled (CC-A): ship the declarations as defence in depth, never as the fix.** They cost
nothing and `:17` is one line in a file that changes constantly. **This document states
plainly that they were not shown to change any behaviour.**

---

## 3. TWO THINGS THIS BUILD CANNOT DEMONSTRATE, DECLARED RATHER THAN IMPLIED

### 3.1 §1's assertion cannot be made to fail

The retargeted plant — remove `touch-action:none` from `html,body` — **leaves the check
green.** So does every other candidate:

```
remove html,body touch-action ....... still will not zoom
remove #root's touch-action ......... still will not zoom
remove user-scalable=no ............. still will not zoom
remove the multi-touch guard ........ still will not zoom
ALL FOUR removed together ........... still will not zoom
```

…while the control fixture zooms **1 → 5** in the same run.

**The property is true and the reason is unknown — not weak, unexplained.** §1 prints a
`NOT FALSIFIED` banner at the point of the claim and the controls file carries **no §1
plant**, because there is none to carry.

**AND CC-A NAMED THE THING THAT EXPLAINS ALL FIVE AT ONCE:** the one behaviour that makes
Android Chrome differ is that **it ignores `user-scalable=no`** — and this harness appears
to honour it. **A test bed that honours the directive cannot reproduce a defect whose cause
is the directive being ignored.** That is not a harness bug and not a weakness in the
plants; it is why this cannot be settled here at all.

### 3.2 The recovery path has never been observed doing its job

Four injectors, all leaving `visualViewport.scale` at **1** on the real app: real two-point
touch (blocked by `touch-action`), `Input.synthesizePinchGesture` (blocked by
`user-scalable=no`, which pins min/max scale at 1), `Emulation.setPageScaleFactor` with and
without a device-metrics override, and relaxing the viewport meta at runtime.

**So the lockout cannot be created, and therefore the escape from it cannot be measured.**
§4 prints `UNVERIFIED`, names all four instruments, and states the reach property is
asserted **by construction and not by observation**. CC-A's `scrollTo` blocker — `html,body`
carry `overflow:hidden`, `visualViewport` offsets are read-only, and the exits are
`position:fixed` — **remains unresolved in either direction.**

**What §4 does assert, against plants that went red:** the recovery is installed and
observable, and it is **correctly inert at rest**. A recovery that snapped the viewport home
on every `visualViewport` event would fight an adult panning a zoomed page, so *"does
nothing when nothing is wrong"* is a requirement, and it is measured by dispatching the real
events and watching `scrollTo`.

---

## 4. THE FINDING OF THIS BUILD: A GUARD THAT INSTALLS, RUNS, AND DOES NOTHING

**A document-level touch listener is PASSIVE BY DEFAULT in Chrome, and a passive listener
cannot `preventDefault`.** So a multi-touch guard that is installed, whose handler runs, and
which calls `preventDefault` on every multi-finger touch, **suppresses nothing at all** —
and `window.__multiTouchGuard` sits there to be found by anyone checking whether it is
there.

**It is identical to a working guard from every angle except the one the check takes.**
That is `.bp-drag[hidden]`'s family and it is now the **fourth** instance in this codebase:
*the remedy is present and inert, and presence is what everyone measures.*

**CHECK THE EFFECT, NEVER THE INSTALLATION.** Check 22 §5 dispatches a real two-finger touch
and reads `defaultPrevented` on the event as it arrives — and the plant that flips
`{passive: false}` to `{passive: true}` goes red for exactly that reason.

---

## 5. THE SWEEP FOUND A CONTAINER I HAD MISSED, INSIDE THIS WORK ORDER

I derived the container set by hand as `#root`, `#alertFlash`, `#cameraOverlay`. The
structural DOM walk returned **`#mapOverlay`** as well. **My list was already wrong on the
day I wrote it** — which is the entire argument for deriving the set structurally rather
than listing it. The sweep now discovers **six**.

**One guard is declared and never shown red:** §2 fails closed if the walk matches nothing,
so it cannot pass by not running. I could not plant it — making `#root` non-positioned still
leaves five containers, and emptying the set needs every panel destroyed at once, which is
not a defect anyone would write. **Asserted by construction, recorded here, and deliberately
not counted among the seven.**

---

## 6. Verdict

| | |
|---|---|
| check 1 (syntax) | **PASS** |
| **check 22** | **PASS** — §1 `NOT FALSIFIED`, §4 `UNVERIFIED`, both stated at the claim |
| **check 22 controls** | **PASS — 7 of 7 planted defects red, each for its own stated reason** |
| gate 2, assets, mutations, cache-name, load, error-caching, cache-isolation, games-offline | **PASS** |
| **Fence** | `sw.js`, `manifest.json`, icons, all three `games/` — **empty** |

**Shipped:** `touch-action:none` on the four full-bleed containers (defence in depth,
measured to change nothing), `pan-x` on the five horizontal strips (intent made explicit),
a scoped multi-touch guard (**effective and proven**), and a zoom-recovery path (**built,
inert at rest, effectiveness unverified**).

**Not shipped, and named as flag-and-stops in the work order:** `maximum-scale`, a universal
`touch-action` selector, a blanket document-level `preventDefault`.

---

## 7. THE ONE QUESTION THAT SETTLES THE SYMPTOM, AND IT IS NOT MINE TO ASK

**Is the S10+ doing page zoom, or Android system magnification?** One look at the device
separates them: **is the Android status bar magnified too, or only PupPad's own content?**

- **Only the app** → page zoom. `visualViewport.scale` moves, and the recovery can fire.
- **The whole screen** → system magnification. **`scale` never moves, no page can observe
  it, and the recovery cannot fire no matter what is built.** The answer would be an Android
  setting, not a commit.

CC-A is carrying this to Scotty under the shared-question protocol — *an operator question
is a shared resource*, and two sessions asking it in two framings is how the same person
gets quoted correctly saying two different things.
