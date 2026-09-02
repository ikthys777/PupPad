# PUP-WO-0201 — adversarial pass, findings and disposition

**Frozen subject:** `4cc3d95e2795c57ffa15772503fa94ba6242c2da`, frozen 2026-09-02T10:04:57Z.
**Protocol:** `PUP-WO-0201` §5 — a `git archive` export with **no `.git`**, so committing on
the frozen tree is inexpressible. Two lenses: *strand the child / make the picker render
what it should not*, and *defeat the gate-2 counter*. Both were told the builder's own
prose is a thing to falsify.

**No DISQUALIFYING trap was found in the picker** — neither lens could construct a state
where a child sits behind a full-bleed surface with no working exit. **Two DISQUALIFYING
findings landed on check 18**, which I had written that morning, and **four SERIOUS ones on
the picker**, one of which is the founding defect of this whole family sitting on the
control that reaches the surface I had just hardened.

Every finding below was **reproduced independently before anything was changed**, and every
fix was then **proven red against the defect it closes** — six planted regressions, listed
at the end.

---

## The one that matters most: I hardened the room and left the door

**The Games button was still wired on bare `click`.** `PUP-WO-0300` established that a
browser synthesises no click while a second finger is on the glass, and none for a tap that
slides past the touch slop. This work order put `wireTap` on the tiles and on both exits
against exactly those two gestures — and left the seven console pad buttons, one of which is
**the picker's only door**, on the path the whole exercise exists to replace.

```
plain tap                  -> the picker opens
a thumb resting elsewhere  -> nothing happens
a tap that slides 25px     -> nothing happens
```

And `wireTap`'s own header said **"EVERY TOUCH CONTROL IN THIS APP GOES THROUGH HERE, AND
THAT IS THE POINT."** It did not, and the exception was the entry point. That is a comment
claiming coverage it does not have, in the function written to fix the defect it was
claiming coverage of.

**Fixed:** all seven pad buttons go through `wireTap` (with a `repeat` option, because a pad
button survives its own press and the one-shot latch would have killed it). **The comment is
now scoped to what it actually covers**, and names what it does not: Draw, Camera, Map, the
settings panel and the PIN keypad are still on `click`, and they are `PUP-WO-0106`'s.

---

## The picker — three more

### The corpse latch, reopened one function above where it was closed — SERIOUS

`openGames` carries an explicit recovery with a comment naming the case: *"a session whose
chrome is gone is not a live game, it is wreckage… the Games button then refuses FOREVER."*
Routing the button through `openGamePicker` — which had a bare `if (gameSession) return;` —
**reintroduced that bug one function higher**. A module that removes its own host leaves the
Games button dead until an app restart, and a three-year-old cannot restart an app.
**Fixed** with the same recovery `openGames` already had.

### Tiles that can never be reached, from the fifth game onward — SERIOUS

`align-content: center` on an `overflow: auto` flex container pushes the first rows **above
the scroll origin**, and `scrollTop` cannot go negative. Measured: it breaks at the **fifth
registry entry on an 800×480 tablet** (two games lost, four at eight entries) and at the
tenth on 1024×768.

**That falsifies northstar invariant 6 outright.** Adding the fifth game would silently
delete two, and fixing it would be surgery on the picker rather than a data change — which
is the precise thing invariant 6 promises never happens. **Fixed** with `safe center`, which
degrades to `flex-start` exactly when centring would push content out of reach, plus a top
padding that clears the exit's **hit box** rather than its paint (the transparent margin
still hit-tests, and a tile overlapping it lost a strip of its left edge to the exit in 165
of 440 viewport-by-count configurations).

### `wireTap`'s click path could fire a control that did not exist when the press began — SERIOUS

`pointerup` was guarded by `armed`; `click` was not. The trailing compatibility click is
hit-tested against the DOM **as it exists after the pointerup handler has run**, so a control
created *during* that handler, at those coordinates, received it and fired itself —
demonstrated with a stack trace. The picker's exit and a game's exit share one rect by
design, so a tile tap landing there would launch a game and instantly close it: the child
taps a game and is bounced back to the console with no explanation.

**Fixed** by making the click path keyboard-only — `e.detail === 0`, which is what a keyboard
Enter produces and what a mouse or touch click never does. Both paths are covered and neither
can fire the other's control.

### `registryEntryIsValid` enforced two of §9.1's nine constraints, and the picker splices two of the other seven into CSS — SERIOUS

`color` and `glow` go straight into a tile's inline `cssText`. A `color` of
`red;position:fixed;inset:0;z-index:9999` terminated the background declaration and painted a
full-bleed tile **above the picker's own exit**; `elementFromPoint` at the button returned the
tile. The function's comment has always claimed *"§9.1's shape, ENFORCED rather than
documented."*

The registry is author-controlled, so this is a **typo surface** rather than an attack
surface — and the failure mode is a child looking at a coloured rectangle with the way back
underneath it. **Fixed:** `color`, `glow`, `label` and `icon` are now enforced. `sound` and
`players` deliberately are not, and the reason is in the code: an unknown sound is a silent
no-op, `players` is unread until architecture §7 seam 4 exists, and refusing a whole game
over a field with no visible consequence costs more than it buys.

**Clean under the same probe:** `label` and `icon` go through `textContent`, so an
`<img onerror>` in either produces text, not markup — confirmed, not assumed.

---

## Check 18 — two DISQUALIFYING findings against a check one morning old

### It could not see the defect it was commissioned to see

`stage()` copied only `index.html`, `sw.js`, the manifest, the icons and `games/`. **The
fourth thing `PUP-WO-0200` actually found did not live in any of those.** It lived in
`.github/ci/check-mutations.mjs`, whose A14 anchor had been pinned to the *last*
`urlsToCache` entry — so every added game moved it. A path the staging never copies is a path
the count can never name.

The pass replayed it: A14 re-anchored to the tail, a game added, **check 7 red on that tree
and check 18 printing `PASSED — three, demonstrated on this tree, on this run.`**

**AND ON ITS FIRST FULL RUN AFTER THE FIX IT FOUND A REAL FOURTH THING.** `PUP-WO-0200`
moved A14's anchor from the list's tail to its head; asserting BOTH ends showed the head is
not immune either — a builder inserting the cache line at the top displaces `'./',` and
breaks the anchor, so adding a game that way costs a fourth edit. Same defect, other end,
found the first time anything asserted both directions. A14 is now anchored to
`'./manifest.json'`, a non-game entry in the middle that no game addition can move.

**Fixed in two parts, and the first was not enough.** Staging the whole tree and running
`check-mutations` against the mutated result was the obvious half — and it *still* passed,
because I had also moved my own insertion to the head of `urlsToCache`, and **a check that
only ever inserts at one end cannot disturb an anchor pinned to the other.** The positive
scenario now runs twice, appending at the tail and inserting at the head of both lists.
Verified red on the replay, naming `check-mutations`.

### Three paths, three kinds, both checks green, and the app cannot install

The registry named `./games/synth-v2.js` while the file written was `./games/synth.js`.
`check-assets` asks whether a referenced asset is **cached**, never whether it **exists**;
`check-syntax` parses the files that are there. So: three paths, one per kind, both green —
and `install` does `cache.addAll(urlsToCache)`, one 404 rejects the whole call, install fails
and the new worker goes redundant. **The old check called that tree THREE.**

**Fixed** with a direct assertion: every registry `module` path and every `urlsToCache` entry
must resolve to a file in the staged tree.

### And four more on the same file, all fixed

- **A hard-coded game id.** A repo that one day ships `games/synth.js` would have turned a
  **negative control green** — the pass added exactly that game and watched a four-file
  addition report as THREE, with the summary telling the operator to escalate an architecture
  decision over a name collision. The id is now derived to collide with nothing.
- **A scenario whose comment claimed what it did not do.** *"Three paths change, the count is
  satisfied, only the checks can see it"* — it changed four paths and the count caught it. The
  claim moved to the two scenarios that actually demonstrate it, and a third was added.
- **Four of five negative controls were decided by the count**, so the `check-assets` branch
  was never exercised on a tree the count would pass — nothing would have noticed if it
  stopped working. There are now three controls named `ISOLATES`, one per assertion.
- **Brittle anchors that died with a raw stack trace** before a single control ran, including a
  tail anchor into `sw.js` — the very pattern `PUP-WO-0200` removed from `check-mutations`.
  Both anchors now bind to the list itself, and a miss is an `::error::` that says the anchor
  moved rather than an invitation to relax it. Plus: isolated git config (a `core.excludesFile`
  on the runner silently changed what the count saw), `resolve()` for an absolute path
  argument, and a computed red-scenario count instead of a hand-typed one.

---

## Proven red, not merely fixed

Each fix was reverted in a scratch tree and the check re-run:

| planted defect | caught by | result |
|---|---|---|
| the Games button back on bare `click` | check 17 | **RED**, 3 assertions |
| `#pickerBack` back on bare `click` | check 17 | **RED**, 4 assertions |
| every tile launches `GAMES[0]` | check 17 | **RED** |
| `align-content: center` restored | check 17 | **RED** at all three viewports |
| the corpse latch restored | check 17 | **RED**, 4 assertions |
| A14 re-anchored to the tail of `urlsToCache` | check 18 | **RED**, naming `check-mutations` |

**The grid one failed to fail on the first attempt.** My reachability assertion compared
rectangles taken at two different scroll positions and was simply wrong — it stayed green
against the defect it was written for. It was rewritten to the question that actually
matters (*at `scrollTop = 0`, is any tile above the box?*) and only then believed.

## What check 17 still cannot do

**Roadmap P2 gate 3.** A person who has not seen the app, naming each tile with every word
covered. `PUP-WO-0201` §7 makes simulating that a flag-and-stop and it is right to: a model
predicting a stranger reports its own priors. The screenshot is generated and handed to the
operator; the prediction is committed at `docs/feedback/PUP-WO-0201-gate3-prediction.md`
**before** the test, so it cannot be adjusted afterwards. **The gate is OPEN.**

## Named and not fixed

- **A game wanting a NEW sound needs a thirteenth key in `doSound`'s bank** — a second edit to
  `index.html` in a different concern, inside a file the diff already counts. It is not a
  fourth thing today only because `api.tone` exists and expresses any pitch and duration
  without touching the bank. Worth knowing that the `sound:` field indexes a closed
  enumeration whose misses are silent.
- **A hostile `icon` paints outside its tile** — no `overflow` bound on the icon element. §9.1
  forbids a multi-cluster icon and the validator now bounds its length, but the layout has no
  floor of its own.
- **Draw, Camera, Map, settings and the PIN keypad are still on `click`** and are therefore
  inert to the same two gestures. That is `PUP-WO-0106`'s surface, and this pass is the second
  time the same defect has been found somewhere new — it should be assumed present in every
  control this project has not deliberately converted.
