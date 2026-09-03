# PUP-WO-0111 — The picker on the fleet, and the viewports every check has been wrong about

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `c2d6651`; **verify live HEAD**).
**Branch:** `build/wo-0111`.
**Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P1 · **Blocks:** `PUP-WO-0401`.
**Subject SHA:** every citation resolved at **`c2d6651`** and paired with its symbol.
*(Three drifted between drafting and committing this file — `:2584`/`:2610`/`:2611` for
the drawer state are now `:2586`/`:2612`/`:2613`. **Caught by auditing this document's
own citations before dispatch**, which is the only reason the line above is true rather
than decorative. The symbol is the anchor; the number is a hint.)*

**Grounds:** northstar invariants 1, 2, 6 · architecture §3 (the fleet), §5 (*a number is
only ever correct at the viewport it was measured at*), §6.1 members 1 and 6 ·
`PUP-WO-0000.md` §8.8 · roadmap §4a.

> **What this is:** the shell corrections the fleet exposed. Scotty's picker complaint,
> the viewport lists that made it invisible, `controlsOpen`, and the removal of `hello`
> from the child's picker. **It is NOT the CI job split** — that is `PUP-WO-0112`.

**Cadence:** build. One PR, left unmerged.

---

## 1. THE PICKER DOES NOT FIT, AND IT IS SIZED OFF THE WRONG AXIS

**Scotty, with screenshots:** *"the game picker icons need to be smaller… twice as big as
they need to be. you have to scroll down just to get to 'bricks'… cut them in half…
centre them into a grid that fits on the one screen until/unless we fill up more than one
grid can hold."*

**Measured off his screenshots — 2340×1080 physical at DPR 2.625 = an 891 × 411 CSS
viewport:**

| | |
|---|---|
| `pickerTile` | `width:min(42vw,240px); height:min(42vw,240px)` — **no `vh` term at all** |
| `#pickerGrid` | `padding:140px 20px 24px` |
| **the sum** | **140 + 240 + 24 = 404 of 411** — one row barely fits **and clips** |

**A square tile sized entirely off the axis that is plentiful (891) and never off the one
that binds (411).** And the `140px` is architecture §5's ruling in the wild: a number
correct at 768 and wrong at 411, sitting in the same file as the panel's **column** rule
(`x ≥ 84`) which holds at every height. **The height rule failed and the column rule
survived.**

**Requirements:**
1. **The tile is driven off the BINDING axis**, not off width. Halve it — ~120px is
   Scotty's "cut them in half" and it lets **two rows** fit.
2. **Keep the exit-clearance PROPERTY and stop expressing it as a height.** The `140px`
   exists to clear `#gameBack`'s hit box. **The panel already solved this with a column
   rule; use the same shape.**

   > **CORRECTED TWICE, AND BOTH ERRORS WERE MINE IN THE PARAGRAPH THAT CONDEMNS THEM.**
   >
   > **SECOND ERROR: I NAMED THE WRONG ELEMENT ON THE WRONG SURFACE.** This clause cited
   > `#gameBack`. **`#gameBack` (`index.html:2837`) belongs to `openGames` and does not
   > exist while the picker is up.** The picker's exit is **`#pickerBack`**
   > (`index.html:3071`). Same builder, same shape, different surface — and a clearance
   > rule written against an element that is not on screen is a rule about nothing. *(CC-B
   > found it while building. The two errors are the same mistake twice: I reasoned about
   > the picker from what I had learned about the games host.)*
   >
   > **FIRST ERROR, BELOW.**
   > This clause first said *"a tile must not intersect x 10–74 — which no viewport can
   > invalidate."* **`x 10–74` is a hardcoded column, which is architecture §5's defect
   > one axis over from the `140px` it replaces.** `makeBackButton` sets
   > `left: max(10px, env(safe-area-inset-left))` at `width:64px`, so the exit occupies
   > **x 10–74 only when the inset is zero** — and **on this fleet the inset is ~30px,
   > so it is actually x 30–94.**
   >
   > **I read the panel's DERIVED rule and wrote down its VALUE AT INSET ZERO.** The
   > panel spends `max(84px, calc(env(safe-area-inset-left) + 74px))` and was right all
   > along; I transcribed its output on a tablet and called it a relation.
   >
   > **The requirement is therefore DERIVED FROM THE EXIT, never written down:** CC-B
   > built `max(94px, calc(env(safe-area-inset-left) + 84px))`, which holds a uniform
   > 20px margin past the exit's right edge at every inset. **Any expression that
   > mentions a column position as a literal is wrong here.**
2a. **THE 150px TILE FLOOR MOVES TO 96px, AND THE BASIS GOES AT THE LINE.**
   *(Ruled 2026-09-03 after check 17 went red on the halved tiles. **This is replacing an
   unmeasured number with a stated one, not lowering a bar to pass** — and the difference
   has to be visible in the record or it reads as the latter.)*

   **`demo-picker.mjs:139` is `t.w < 150 || t.h < 150` — a BARE LITERAL with no comment,
   no derivation and no measurement**, whose failure message asserts *"below a
   three-year-old's aim."* **It names a property it never established.** The tile CSS
   carried the same 150 as `min-width`/`min-height`: two expressions holding one
   unjustified number.

   **What this project HAS measured, and it is all on the low side of 150:**

   | | |
   |---|---|
   | `MIN_TOUCH` (`demo-blockpop.mjs:84`) | **44px** — the platform floor, named and used |
   | Block Pop board cell | **64px** — and **Buddy plays it on the S10+**, confirmed on the device |
   | the halved tile | **132px** |

   **A picker tile is an EASIER target than a board cell** — isolated, no neighbour
   inside the gap, no drag, no adjacent legal/illegal distinction. **So a floor of 96px
   is 1.5× a target he demonstrably hits and better than 2× the platform minimum**, and
   132 clears it with room, so the check keeps its teeth against a genuinely small tile.

   **Write the basis at the line.** A floor whose justification lives in a work order is
   the same defect as the one being replaced. And **reconcile the CSS `min-width` /
   `min-height` to the same source** — one number, one place, or it is the family again.

3. **Keep `align-content:safe` and `justify-content:safe`.** They are what stop a centred
   overflowing grid pushing rows above `scrollTop: 0` where no gesture reaches them.
   **That is invariant 6 — the adversarial pass measured it breaking at the fifth entry
   on 800×480.**
4. **Scroll only when the count genuinely exceeds one screen.** Centred grid until then.
5. **`env(safe-area-inset-left)` is ~30 CSS px and NON-ZERO on this fleet** — verified in
   the screenshots as a black bar down the left edge. **Do not hard-code the gutter.**

## 2. `controlsOpen` — the shell half of §8.8's ruling

**`drawerOpen`** (`index.html:2586`) is initialised `true`, hard-coded open for every game. **On the
fleet that is 321px of 412 covered, leaving 91px.** §8.8 rules the default moves to the
seam and **the shell's fallback flips to CLOSED**, with `games/gyre.js` publishing
`controlsOpen: true` explicitly in the same change.

**THE PRECEDENCE IS THREE-WAY AND THE ONE-CHARACTER VERSION IS THE REGRESSION.**

| stored `'0'` / `'1'` | **the child's choice wins** |
| absent | `seam.controlsOpen === true`, else **closed** |

**`OPEN_KEY`** is `'pupctl:' + entry.id + ':open'` (`index.html:2599`) — **per entry, verified**, so `blocks` and
`blocks-big` keep separate state despite sharing one module URL. Flipping `!== '0'` to
`=== '1'` makes *absent* mean closed for every game, **silently discarding `controlsOpen`
and handing Gyre a closed drawer on a fresh install.**

**AND THERE ARE THREE `true`s, NOT ONE:** the initializer **`var startOpen = true`** (`index.html:2612`), the comparison
**`!== '0'`** and **its own `catch`**, which share `index.html:2613` — so a `localStorage` throw opens the drawer on
the one device class nobody tests. *(Only two are live today; the initializer is shadowed
because both paths assign. **This change promotes it** — a `try` that falls through to
`controlsOpen` puts it on a reachable path. "It is dead code" is the argument someone
will use for leaving it, and it is true right up until this lands.)*

**`controlsOpen` is module-supplied and therefore untrusted**, exactly as the seam is:
absent is not an error, a throwing getter must not take the panel down, and the test is
**`=== true`**, not truthiness.

## 3. `hello` LEAVES THE CHILD'S PICKER — RULED, AND IT IS A DELETION FROM `GAMES` ONLY

**Scotty:** *"not needed now that we have at least 2 games behind the games tab."* He is
right about the user-facing half. **The file stays.**

**I verified the objections at source rather than taking them, and one is decisive:**

- `index.html:228` — *"`hello` stays as the contract demonstration checks 13 and 14
  corrupt on purpose."* **Nine files under `.github/` reference it.**
- `index.html:2161` — *"A module that publishes nothing gets no panel and no error —
  `games/hello.js` is the live proof of that path."* **Confirmed: `games/hello.js`
  contains zero `host[…]` assignments.** It is `mountControlPanel`'s **first** guard,
  and `blockpop` cannot substitute — it publishes a seam and fails at the **fourth**
  guard. Different branches.
- **THE DECISIVE ONE:** `demo-controls.mjs:985-986` **waits for
  `.pickerTile[data-game="hello"]` and finger-taps it.** Hiding the tile **breaks that
  check outright**, and mounting hello directly instead would downgrade a
  finger-driven path to an internals call — on the very surface where *"a synthetic
  click is not a finger"* was learned.

**SO NOT A `hidden` FLAG. The check supplies its own fixture, and the precedent already
exists in this repo:** `demo-picker.mjs:351-355` does `page.evaluate(() => GAMES.push({…}))`
with eight synthetic entries pointing at `./games/hello.js`, then opens the picker and
drives it. **`demo-controls.mjs` §9 does the same for `hello` and keeps its finger path
end to end.**

**Why this beats a `hidden` field:** no new registry surface (§9.2's validators are
unimplemented and `registryEntryIsValid` checks six of nine fields, so a typo'd `hidden`
would silently show the tile); **no branch in the picker to get wrong**; and Buddy cannot
see it **by construction**, because it is not there.

**Required, and DEMONSTRATED not asserted:**
1. The picker renders **exactly two tiles** and none is `hello`.
2. **`demo-controls.mjs` §9 still goes RED** when `mountControlPanel`'s first guard is
   removed — with its finger path intact.
3. **Checks 13 and 14 still go RED** against their corruptions of `games/hello.js`.
4. **Rule the `urlsToCache` line with evidence.** `check-assets` derives its required set
   from string literals **in `index.html`**, so once the entry is gone `./games/hello.js`
   is no longer *required* — and I found nothing that forbids an extra. **Decide it by
   reading the checks that fetch the file, and say which way and why. An unreferenced
   precache entry is exactly the kind of thing that rots.**

## 4. THE VIEWPORT LISTS — the root cause of §1, and of the clipped dice

Check 19 runs `800×480 / 1024×600 / 640×480`; check 20 runs `1024×640 / 780×560 /
1920×500`. **The shortest either has seen is 480 and the fleet is 411** — and 411 is
exactly where `max-height:78vh` starts binding, **so every panel measurement this project
has reported was taken in the regime where the cap does not bind.**

**Correct both lists to the fleet — 869×412, 915×412, 883×412 — then fix what goes red.**
Already measured on the shipped panel and expected to go red: drawer **321px covering
78%**, content **406px in a 319px client so panning is MANDATORY**, **eight controls with
a rect outside the viewport at rest**, and **`randomize` at y=−7, clipped by the top of
the screen**.

**§2's fallback flip fixes the fleet and does NOT fix Gyre** — Gyre opts in, so it keeps
all of the above. *"The flip fixed the fleet" is true; "the flip fixed Gyre" is false,
and the first sentence invites the second.*

**AND CHECK 19 CANNOT SEE THE BAND GROW.** It *measures* the drawer's coverage
(`demo-controls.mjs:1048`) and **prints it without asserting anything**. Assert it at the
smallest supported viewport, and assert **separately** that content does not exceed
`78vh` there — that is the moment **a pan becomes mandatory rather than optional, and a
non-reader will not discover one.**

---

## 5. Scope fence

- **The CI job split** — `PUP-WO-0112`. Do not touch `publish`'s `needs` or the job graph.
- **`games/hello.js` itself** — the file stays, byte-for-byte.
- **`sw.js`** — untouched **unless §3.4 concludes the `urlsToCache` line must go**, which
  is then exactly one removed line and nothing else.
- **`games/blockpop.js`, `manifest.json`, the icons** — diff to empty.
- **The picker's tile CONTENT** — icon, colour, label are `PUP-WO-0201`'s. This is size,
  placement and which entries render.

## 6. Adversarial pass · 7. Feedback · 8. Flag-and-stop

Right-sized; **no security lens — this touches no byte the device did not create**
(architecture §5's trust-boundary rule). **Every new check shown red with a plant that is
a real defect and parses.** Probe: the smallest fleet viewport with insets forced
non-zero; a fresh install with no `pupctl:` key; `localStorage` throwing; a ninth
registry entry; and `controlsOpen` as a string, a number, and a throwing getter.

`FEEDBACK.md` parked with the work. Order: build → freeze → pass → disposition →
feedback → PR. **Flag-and-stop:** any change to the job graph; any edit to
`games/hello.js`; a picker tile that can intersect `#gameBack`'s column; a check you
cannot show going red.
