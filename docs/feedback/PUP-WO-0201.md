# PUP-WO-0201 — builder feedback

**Branch:** `build/wo-0201` · **Base:** `main` at `55bc89e` · **Cadence:** build, parked
with a PR open. Written by CC-B (builder-2f).

**Read `docs/findings/PUP-WO-0201-adversarial.md` alongside this.** The pass found four
SERIOUS defects in the picker and two DISQUALIFYING ones in a check I had written that
morning. The sharpest is in §3 below and it is mine.

---

## 1. §0 — the fence, run at HEAD

```
MUST diff to empty: sw.js, manifest.json, icon-192.png, icon-512.png, games/
  git diff --stat 55bc89e HEAD -- sw.js manifest.json icon-192.png icon-512.png games/
  (no output)

MAY change: index.html, .github/, docs/   — and only those moved.
```

**No flag-and-stop was triggered.** `sw.js` did not move at all, which §0 predicted: no new
asset and no new game. Nothing was cached that was not cached before.

## 2. What was built

**The picker** — a full-screen surface of large tiles rendered from `GAMES`, knowing nothing
about any game. Demonstrated in a browser: an entry added at runtime becomes a tile with no
picker edit, and entries failing §9.1 become no tile. **It opens even with one game** (§2.2):
a non-reader learns by consistency of gesture, and a button that sometimes chooses and
sometimes launches means two things.

**§2.3, which is §1.6 applied to the surface being added.** The way back is appended and
live before a single tile exists. Check 17 proves it by **replacing the renderer with one
that throws**: no tiles, a working exit, one finger tap to a reachable console.

**Back from a game returns to the CONSOLE, not to the picker** — invariant 5 says the
console is one tap from every reachable state, and a picker in between makes it two.

## 3. §1a.1, and then the thing I missed while fixing it

**The exit's two properties are now separate.** Hit box 64×64, paint a 40 px disc — 39% of
the area it used to cover — centred inside it. The arrow is an **SVG path symmetric about
its own centre**: `←` centres its text *box* while the ink sits off to one side, and no
amount of flex centring fixes a font metric.

**And then I hardened the room and left the door.** The tiles and both exits went through a
new shared `wireTap`, against a tap with a second finger down and a tap that slides. **The
seven console pad buttons stayed on bare `click`** — including the Games button, the picker's
only door. Measured: a thumb resting anywhere, or a tap that slid 25 px, and **nothing
happened at all.**

`wireTap`'s own header said *"EVERY TOUCH CONTROL IN THIS APP GOES THROUGH HERE, AND THAT IS
THE POINT."* It did not, and the exception was the entry point — a comment claiming coverage
it does not have, inside the function written to fix the defect it was claiming coverage of.
All seven now go through it, and **the comment names what it still does not cover**: Draw,
Camera, Map, settings and the PIN keypad are `PUP-WO-0106`'s.

**This is the second time the same defect has been found somewhere new.** It should now be
assumed present in every control this project has not deliberately converted.

## 4. Three more the pass found in the picker

- **The corpse latch, reopened one function above where it was closed.** `openGames` recovers
  from a session whose DOM is gone; `openGamePicker` did not, so a module that removes its own
  host killed the Games button until an app restart. A three-year-old cannot restart an app.
- **Tiles unreachable from the fifth game onward.** `align-content: center` on an overflowing
  flex container pushes rows above the scroll origin and `scrollTop` cannot go negative: two
  games lost at five entries on an 800×480 tablet. **That falsifies invariant 6 outright** —
  adding the fifth game would silently delete two, and fixing it would be surgery on the
  picker. `safe center` now.
- **`registryEntryIsValid` enforced two of §9.1's nine constraints**, and the picker splices
  two of the other seven into inline CSS. A `color` of `red;position:fixed;inset:0;z-index:9999`
  painted a full-bleed tile **above the picker's own exit**. Now enforced.

## 5. §2.4 — gate 2 as a mutation, and it took three attempts to make it see anything

Check 18 synthesises a game in a throwaway repo on every run, counts, and runs the repo's own
checks against the result. **The pass found it blind to the exact defect it was commissioned
to catch**, twice over:

- **It staged only the files a game is supposed to touch.** `PUP-WO-0200`'s real fourth thing
  lived in `.github/ci/check-mutations.mjs` — the one directory the staging excluded. A path
  never copied is a path the count can never name. The pass replayed A14 pinned to the tail:
  **check 7 red on that tree, check 18 printing PASSED.**
- **Staging the whole tree was not enough.** It still passed — because I had also moved my own
  insertion to the *head* of `urlsToCache`, and **a check that only ever inserts at one end
  cannot disturb an anchor pinned to the other.** It now runs the positive scenario twice, at
  both ends of both lists.
**And on its first full run after the fix, it found a real fourth thing.** `PUP-WO-0200`
moved A14's anchor from the tail of `urlsToCache` to the head; asserting *both* ends showed
the head is not immune either. A14 now binds to `'./manifest.json'` — a non-game entry in the
middle, which no game addition at either end can move. **That is the check doing exactly what
§2.4 commissioned it for, on the first run where it could.**

- **Three paths, three kinds, both checks green, and the app cannot install** — the registry
  named a module one character different from the file written. `check-assets` asks whether an
  asset is *cached*, never whether it *exists*. Now asserted directly.

## 6. What was proven RED, because a fix I cannot fail is not a fix

Six defects planted in scratch trees; six caught. Full table in the findings document. **One
of my new assertions failed to fail on the first attempt** — the tile-reachability test
compared rectangles taken at two different scroll positions and stayed green against the
defect it was written for. Rewritten to the question that matters, then believed.

## 7. Gate 3 — OPEN, and it is a flag-and-stop

I cannot run it. `PUP-WO-0201` §7 makes simulating a naive viewer a flag-and-stop, and it is
right: a model predicting what a stranger would say reports its own priors. **The screenshot
with every word covered has been handed to the operator, and my prediction is committed at
`docs/feedback/PUP-WO-0201-gate3-prediction.md` — written before the artifact was sent, so it
cannot be adjusted afterwards.** In short: 👋 likely passes, 🌀 likely fails, because a spiral
is a weather symbol before it is a toy and naming the picture is not naming the function.

**If 🌀 fails, the fix is one registry field and no picker edit** — §2.1's contract doing its
job, which is worth something either way.

## 8. The COMMIT='unknown' sweep, taken here

CC-A ruled it belonged to the next work order that opens `.github/ci/`, and this one does. Six
checks fell open on a tree they could not name; all now fail closed, with `PUPPAD_SUBJECT` for
a git-less archive. **The cost surfaced immediately and correctly:** check 12 runs check 11
against throwaway directories and went red until it passed the subject through.

## 9. Open, and named rather than half-built

- **Gate 3.** Needs a human. Open.
- **Every other console control is still on `click`** — Draw, Camera, Map, settings, the PIN
  keypad. `PUP-WO-0106`'s surface, and now a known-present defect rather than a suspected one.
- **A game wanting a NEW sound** needs a thirteenth key in `doSound`'s bank — a second concern
  inside a file the gate-2 diff already counts. Not a fourth thing today **only because
  `api.tone` exists**, which is what it was ratified for.
- **A hostile `icon` paints outside its tile.** §9.1 forbids it and the validator now bounds
  its length; the layout still has no floor of its own.
- **`check-assets` cannot tell whether a referenced asset exists** — only whether it is cached.
  Check 18 now covers that for games; nothing covers it generally.
