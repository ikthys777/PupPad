# PUP-WO-0301 — Gyre's controls: the sliders are the toy

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0301`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P3 · **Phase exit gate:** `docs/roadmap.md` P3, items 1–5. **This work
order answers all five.**
**Depends on:** `PUP-WO-0300` merged (`544debb`).
**Grounds:** `docs/northstar.md` invariants 1, 3, 5 · `docs/architecture.md` §5, §6.1 ·
`docs/roadmap.md` P3 · **`docs/feedback/PUP-WO-0300.md` §9 — the exposure table,
which this work order DEFERS TO and does not restate.**

> **What this is:** the control surface for the engine `PUP-WO-0300` built. It is
> **NOT** the engine (done), not the picker (`PUP-WO-0201`), and not `sw.js`.

**Cadence:** build. One PR **opened at park**, left unmerged for review.

---

## 0. THE FENCE — stated ONCE, referenced everywhere, restated nowhere

**MAY change:** `games/gyre.js`, `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/hello.js`.
*(No new module and no new asset, so `urlsToCache` does not move. If you believe it
must, that is a flag-and-stop.)*

**The gate CC-A runs at merge is exactly this block**, pasted into the merge commit.

## 1. Scotty's direction has not changed, and it lands here

**"Buddy's actual engagement with Gyre is the sliders — he likes seeing what each one
changes."** `PUP-WO-0300` §3 granted latitude for the engine; **this is the work order
where the child actually touches it.** Additions are wanted, not tolerated. Where you
would trim for tidiness, do not.

**But invariant 1 is the whole difficulty here and it is not decoration.** Every
control must be operable by someone who cannot read. The northstar calls invariant 1
*"the project."* A slider a three-year-old cannot interpret is not a control, it is
furniture.

## 2. Scope

### 2.1 The exposure table is `docs/feedback/PUP-WO-0300.md` §9 — read it, do not re-derive it

The seam is **`host.gyre`**, frozen, and **dead after teardown** rather than merely
deleted — a captured reference used to overwrite the child's saved settings *after he
had left*, and every method now refuses. §9 lists what each control drives and the
shape it needs. **Defer to it.** Two copies of a specification drift.

**Three things §9 says you must know, restated here ONLY because getting them wrong is
silent** — the source is still §9:

- **Do not re-clamp.** Every setter clamps from both directions already; a second set
  of bounds is two specifications of one range.
- **A bad value is a no-op, not a reset.** Both setters now hold their ground.
- **Nothing that can throw may sit between the first listener and the returned
  closure.** The shell assigns `gameSession.teardown` only after `mount` *returns*, so
  a throw in that window leaves it reporting a clean recovery over a running sim.

### 2.2 The two controls that carry the most joy per tap

Both mechanisms exist; this work order gives them their affordance.

- **Attract/repel — ONE two-state affordance, not a slider.** An icon that reads as
  **in versus out** to a non-reader. *`PUP-WO-0300` measured that the sign flip alone
  does not visibly invert — 3% apart at 1.5s, 14% after eight seconds — so repel is
  shaped (×2.4 radial, ×0.4 swirl) and the visible difference is real: 37% inked
  becomes 0.0%.* The control must make that legible in **one tap**.
- **Randomize — one big button**, and it returns the settings it chose. *The highest
  joy-per-tap control available to a non-reader: no reading, no aiming, a different
  world every press.* **Make it the most obvious thing on the surface.**

### 2.3 Colour is the label

**`.palettes` and `.backgrounds` carry `hex`, so a tile can BE the colour it
selects.** That is invariant 1 satisfied with **no text at all**, and it is the best
idea in the exposure table. Build the swatch strips that way.

**And add more colour, per `PUP-WO-0300` §3's standing latitude** — it applies to this
half too.

### 2.4 Two obligations inherited, and neither is optional

- **`COMMIT = 'unknown'` falls open in every sibling check.** *Ruled 2026-09-02:
  required of **the next work order that touches `.github/ci/`**, and that is this
  one.* A green with no identifiable subject is **§6.1 member 1 wearing a provenance
  line**, and it falsifies §5's own rule that a demonstration asserts its commit.
  `PUP-WO-0300` made check 16 fail closed; **make the others match.**
- **Check 16 §3 measures ink PRESENCE, not ink-versus-ground contrast** — so a palette
  rendering near-black on a dark ground would pass. **It becomes testable here**,
  because this is where palettes and backgrounds get chosen together. Assert
  **contrast against the selected ground**, not that pixels were drawn.
  *That is §6.1 **member 6** — presence is a proxy and behaviour is the property.*

## 3. Acceptance — proven, not asserted

1. **The fence in §0 holds.** Run it, paste it, do not restate it.
2. **Roadmap P3 gate 1**: **every** parameter changes the field visibly within one
   second of being dragged — demonstrated **per parameter**, not as a class.
3. **P3 gate 2**: randomize, five consecutive taps, five visibly different fields,
   **all usable** — no all-black, no zero particles, nothing flung out of sight.
   *`PUP-WO-0300` found the field migrating into the 20px wrap margin and rendering an
   all-black screen on half of all presses; that is fixed, and this is the control
   that will exercise it hardest.*
4. **P3 gate 3**: attract/repel visibly inverts **in one tap**.
5. **P3 gate 4**: settings survive a full app restart, **and survive `api.load()`
   returning `null`**.
6. **P3 gate 5**: no reachable state from which returning to the console takes more
   than one tap — **including mid-drag, mid-animation, and with a second finger on the
   glass.** *That last clause is not hypothetical: `#gameBack` was inert for exactly
   that case until `PUP-WO-0300` fixed it, and every check passed throughout. **Press
   it with a finger, not `page.click`.***
7. **§2.4's two obligations demonstrated** — sibling checks failing closed on an
   unresolvable commit, and check 16 asserting contrast, each shown **red** first.
8. **Invariant 1, tested not assumed:** with all text covered, **a real person who has
   not seen the app** operates the surface — changes something, undoes it, gets out.
   **Record your prediction first.** *No human available means the gate stays open and
   unrun; do not simulate it (`PUP-WO-0201` §7's rule, and it is the same invariant).*
9. **Every demonstration asserts the commit and the failing step name.**

## 4. Scope fence — NOT in this work order

- **The engine** — `PUP-WO-0300`, merged. If a control needs a mechanism that does not
  exist, that is a flag-and-stop and a dependency, not an edit to `sim`.
- **The picker** — `PUP-WO-0201`.
- **`sw.js`** (§0), and the parked queue in `docs/roadmap.md` §4a — including the
  CSP/iframe question, `supabaseFetch`, and the tier-1-token ruling, **all of which
  `PUP-WO-0300` §10 correctly left open.**

## 5. Adversarial pass

Black-box, fresh subagent. **Freeze protocol (architecture §5):** `git archive` for a
read-only pass — no `.git`, so committing is inexpressible; `git clone` when
git-dependent checks must run; **never `cp -r` of a worktree.** SHA-256 at freeze,
re-verified at disposition, **and read the feedback file as a deliverable, measuring
its claims** (§6.1 member 5).

Probes:

- **Press every control with a finger, not a click.** Two fingers. A tap that slides.
  *(§6.1 member 6 — the case that named it was exactly this.)*
- **Strand the child**: mid-drag, mid-randomize, with a control panel open.
- **Make a control lie** — a slider whose visible position does not match the value,
  a swatch whose colour is not the palette it selects.
- **Make randomize produce something unusable**, or the same thing twice.
- **Reach the seam after teardown** and mutate the child's saved settings.
- **Ask what each addition refuses.** More controls cost screen; more colour costs
  contrast; a bigger randomize button costs something else its place.

## 6. Upward feedback

`docs/feedback/PUP-WO-0301.md`; verbatim exchange in
`docs/findings/PUP-WO-0301-adversarial.md`. Required: gate 8's prediction and what the
tester actually said; the red demonstrations with commit and failing step name; the
per-parameter gate-1 evidence; what did not work and why; and the §0 fence status as a
checkable fact.

## 7. Flag-and-stop

- **Any need to touch `sw.js`**, `manifest.json`, an icon, or `games/hello.js` (§0).
- **A control that cannot be made operable by a non-reader.** Better absent than
  present-and-uninterpretable — invariant 1 is the project.
- **A needed mechanism missing from the seam** (§4).
- **No human for gate 8.** It stays open and unrun. **Do not simulate it.**
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-02, immediately after `PUP-WO-0300` merged at `544debb`, from
that work order's own §9 — **the builder listed what the controls would need while the
mechanisms were still in its hands, which is the cheapest moment for that knowledge to
be written down and the one most often skipped.**

**§2.4 exists because two obligations were deliberately left open rather than
half-built**, and this is the work order they were assigned to. **§3.6's second-finger
clause exists because `#gameBack` was inert for two ordinary gestures since
`PUP-WO-0200` and every check passed throughout** — architecture §6.1 member 6.
