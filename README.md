# PupPad

A pretend command console for a three-year-old — a tablet PWA he can operate on his
own, without reading and without reaching anything that isn't his.

**Status:** shipped and in daily use. The console and its eight panels work. A games
surface is being added: the Power button becomes Games, opening a picker for
Gyre (a particle field) and Block Pop (a block-placing puzzle). As of 2026-08-31
that work is planned but not built.

## What's here

```
index.html        the whole app — markup, styles, behaviour
sw.js             service worker: offline cache and asset manifest
manifest.json     PWA install metadata
docs/             the steering documents
```

No build step, no dependencies, no package manager. Open `index.html` and it runs.

## Where to go

- **`docs/northstar.md`** — why this exists and what must stay true. Read first.
  Invariants are defined there and cited by number everywhere else.
- **`docs/architecture.md`** — what it is and how it's shaped: measured ground
  truth, ratified rulings and their reasons, the deploy topology.
- **`docs/roadmap.md`** — what order it gets built in and how each phase proves
  it's done.
- **`docs/work-orders/`** — individual buildable units.

## Deploying

GitHub Pages. The site root serves the newest build for testing; `/stable/` serves
the build a human has promoted, and that is the one installed on Buddy's tablet.
The distinction is load-bearing rather than cosmetic — `docs/architecture.md` §6
explains why, and it is the reason merging is safe to delegate.

---

This README points; it does not define. Anything stated here in more detail than
above is a second copy of a fact one of the documents above owns, and copies drift.
