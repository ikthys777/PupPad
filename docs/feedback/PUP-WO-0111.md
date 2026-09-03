# PUP-WO-0111 — the picker on the fleet, and the viewports every check was wrong about

**Subject:** `build/wo-0111`, merged with live `main`.
**Built:** `index.html` (picker sizing, `controlsOpen`, `hello` deregistered, slider box),
`games/gyre.js` (opts in), `.github/ci/demo-controls.mjs`, `.github/ci/demo-sticker-share.mjs`.
**`sw.js` untouched** — see §4.

---

## 1. The picker, and a literal in the ruling that would have failed on the fleet

`pickerTile` was `min(42vw,240px)` on **both** sides of a square tile — measured entirely
against the plentiful axis (891px) and never against the one that runs out (411). With
`padding:140px` that is 140 + 240 + 24 = **404 of 411**: one row, clipping, "Blocks" below
the fold. Now `min(38vh,42vw,132px)` — the binding axis first — and **two rows fit centred
with no scrolling at all.**

**The work order says the clearance rule is "a tile must not intersect x 10–74". That
literal is only true when the left inset is zero.** `makeBackButton` puts the exit at
`left:max(10px, env(safe-area-inset-left))`, 64px wide, so on the fleet — where CC-A
measured the inset at ~30px — **it occupies x 30–94.** A hardcoded column is the same
defect as a hardcoded band, one axis over. Built as
`max(94px, calc(env(safe-area-inset-left) + 84px))`, derived from the exit. Verified at a
forced 30px inset: the exit moves to x 30–94 and **no tile intersects it.**

*(`#gameBack` belongs to `openGames`; the picker's exit is `#pickerBack`. Same builder,
different surface — worth stating because the WO's comment cites `#gameBack`.)*

## 2. `controlsOpen` — three states, not a boolean

Stored `'1'`/`'0'` → **the child's choice wins.** Absent → `seam.controlsOpen === true`,
else **closed**. The one-character version (`!== '0'` → `=== '1'`) makes *absent* mean
closed for every game and silently discards the seam. `gyre` opts in explicitly in the same
change. **The third `true` is now live**: the initializer was shadowed because both the try
and its catch assigned; letting the try fall through puts it on a reachable path, so it is
`false` — the ruled fallback — and the catch is explicit.

## 3. `hello` left the picker and the checks supply their own fixture

The registry entry is gone; **the file is byte-for-byte untouched.** `demo-controls.mjs` §9
pushes its own entry (precedent: `demo-picker.mjs:351-355`) and **keeps its finger path end
to end** — it still waits for a real tile and taps it. Demonstrated, not asserted: the
picker renders **exactly two tiles, neither `hello`**; **checks 13 and 14 still pass**
against their corruptions of the file; **check 19 §9 still exercises the no-panel path.**

## 4. The `urlsToCache` line stays, and the evidence decides it

**No check depends on `games/hello.js` being in the precache** — `demo-games-offline`
derives its module from the *first* registry entry (`gyre`), and no check goes offline and
loads `hello.js`. So the decision cannot rest on "does a check need it".

**It rests on what removing it costs.** `check-cache-name.mjs:262` treats an entry
**removed** from `urlsToCache` as a stranded cached copy and **requires a `CACHE_NAME`
bump** — and `sw.js:96` records that a bump cost the map panel its offline assets, 24→0
tiles on every already-installed device. **Removing an unused precache line would trade
invariant 3 against itself**, which is the exact trade `sw.js` exists to forbid. The honest
cost of keeping it is one precache entry no longer referenced from `index.html`; that is
the cheaper rot, and it is named here so it is not rediscovered.

## 5. Correcting the viewports found a defect that was always there

The shortest viewport either check had ever seen was 480; the fleet is 412. Correcting them
turned check 19 red exactly as predicted — dice at **y = −7**, content **406px in 319px**,
eight controls off-screen. Fixed:

- **`max-height:78vh` is gone.** A fraction of the screen is architecture §5's own
  anti-pattern — 500px where it was measured, 321px where the toy runs, and bar + drawer
  summed to 419 in a 412 box, which is why the dice was clipped. Now `flex:0 1 auto` with
  `min-height:0` inside a dock capped at `100%`: **the drawer absorbs the shortfall**, at
  any height, with no number to be wrong.
- **4px of bottom slack.** Rows are 48.76px and gaps 8px, so the last row overflowed by
  **0.38px** and two controls could not be brought fully on screen even fully panned. A
  third of a pixel is not a usability defect and it **is** a real clip; the slack removes it
  rather than the assertion being loosened to tolerate it.

### 5.1 A SLIDER HAS BEEN PAINTING A POSITION THAT IS NOT ITS VALUE, AT EVERY WIDTH

`fill`'s percentage width resolves against the track's **padding box**; the hit test read
`getBoundingClientRect`, the **border box**. The track had a 2px border, so **the knob sat
up to 4px from where a tap at that position would land.** Invisible because 4px of a 230px
column is 1.7% and the tolerance is 2%; narrowing the column to fit a 412px phone pushed the
same 4px to 2.8% and it went red. **The defect did not arrive with the narrow column — the
narrow column stopped hiding it.** Fixed by removing the border entirely and painting the
ring as an inset shadow, so there is **one box** and the two expressions cannot disagree.
Fifth instance of that family in this project.

### 5.2 The prediction was wrong and the fleet said so

I set the column to 132px, measured wrapped 100px cells, reasoned that 176px was better
because nothing wraps there — and **176 goes red at five assertions while 132 goes green.**
The wrapped cells are taller and every control still lands on the glass; at 176 they do not.
The comment now records the measurement rather than the reasoning.

### 5.3 The band is asserted, and the mandatory pan is reported

Check 19 **measured** the drawer's share of the field and asserted nothing about it, so the
panel could have grown control by control until it owned the screen with nothing going red.
It now fails over 80%. Currently **76%**.

**A pan is still mandatory** — 356–406px of content in 312px — and that is reported on its
own line rather than buried. A pan that *works* is proven; a pan that is *mandatory* is a
different claim, because a non-reader does not discover one. **Closing it needs a decision
about Gyre's two full-width swatch rows (ten options each), which is `PUP-WO-0301`'s surface
and not this work order's** — flagged rather than folded.
