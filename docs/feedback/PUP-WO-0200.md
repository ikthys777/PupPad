# PUP-WO-0200 — upward feedback

**Branch** `build/wo-0200`, based on `origin/main` `13acf9f`.
**Verbatim adversarial exchange:** `docs/findings/PUP-WO-0200-adversarial.md`.

---

## GATES — as checkable facts, not assertions

| | fact |
|---|---|
| **Fence** | 9 files, all inside `index.html`, `games/`, `sw.js`, `.github/`, `docs/`. **Outside that set: 0.** |
| **`manifest.json`** | diffs to empty |
| **`icon-192.png`, `icon-512.png`** | diff to empty |
| **`sw.js`** | `2` insertions, `1` deletion — one added `urlsToCache` entry and the comma before it. **`CACHE_VERSION` occurrences in that diff: 0.** |

```
-  './icon-512.png'
+  './icon-512.png',
+  './games/hello.js'
```

**Gate 1 (property, as reworded 2026-09-02).** `grep -ri power index.html` → **2**
matches: the sound-bank definition at `:84` and the deliberate `sound:'powerUp'`
reassignment at `:105`. No button label, icon, handler or registry entry names Power.

**Gate 2, run as written. The count is the evidence:**

```
 games/shapes.js | 10 ++++++++++
 index.html      |  4 +++-
 sw.js           |  3 ++-
 3 files changed, 15 insertions(+), 2 deletions(-)
```

**Exactly three things** — its own module, one registry entry, one `urlsToCache` line —
with `CACHE_VERSION` untouched. Both checks stayed green at two modules
(`scanning 2 module(s) in games/`). The second placeholder was then **reverted**: §1.4
ships one, and gate 2 is a measurement rather than a deliverable.

**Gate 4 / acceptance §3.5** — cold start, no network, proven in a browser as check 14.

**Gate 5 baseline — and it is NOT the gate's number.** Five fresh contexts, cold, on
this machine: `141, 144, 152, 164, 227 ms`, **median 152**. Gate 5 asks for the number
*"on the test device"* — a tablet, not a CI-runner-class box — so this is a reference
point and **the device measurement is Scotty's**. The threshold stays architecture
§10's open question either way; the gate requires the measurement, not a verdict.

**Gate 3 — the icon — is NOT run.** See below; it needs a person.

---

## THE ICON PREDICTION, STATED BEFORE THE TEST (§1.2)

The button is 🎮 (U+1F3AE, video game controller), label `Games`, on the existing
`id:7` colours.

**My prediction:** a person who has not seen the app, shown a screenshot with all text
covered, will call it *"games"* or *"the game controller"*.

**What the naive viewer actually said: NOT YET KNOWN.** Gate 3 is a person, and I am
not one. This is recorded as an open item rather than as a pass, because the whole
point of §1.2 is that the prediction is falsifiable and the test is what settles it.

**The prediction I am least sure of, said plainly:** 🎮 is unambiguous *to an adult*.
Buddy is three and may never have seen a game controller. The label is text he cannot
read, so the icon carries the whole signal for him — and an icon that an adult names
instantly is not the same thing as an icon a non-reader recognises. If the naive
viewer says "games", gate 3 passes and invariant 1 may still be weakly served for the
actual user. The honest alternatives, if it fails: 🧩 (puzzle) or 🎲 (die), both of
which name a *kind of play* rather than a *device for playing*.

---

## §1.1 — THE CHECK INVARIANT 3 RESTS ON, AND WHY IT WAS BUILT FIRST

`PUP-WO-0000` §8.3 says, as a correction its own adversarial pass forced (F8), that
omitting `fetch` from the `api` object is *a convention and not enforcement*, and that
*"invariant 3 and architecture §5's 'strictly offline' rest on that check."* **It was
never built.** Nobody noticed because `games/` did not exist, so it would have scanned
nothing and reported success — a false green arriving before there was anything to be
green about.

### The red demonstrations — permanent CI, not a paragraph here

Written and demonstrated red **before** the first module existed. The demonstration is
**check 12**, which runs on every commit, because a demonstration written into a
feedback file is evidence about a tree that no longer exists — architecture §6.1
member 5 applied to itself.

**Subject `0d353b5`. Failing step name: `Check 11 — a game module cannot reach the
network`.** Check 12's own failing step name is `Check 12 — check 11 can actually go
red, on each construct separately`.

**PART A — fail closed. Scanning nothing is a FAILURE, never a pass:**

| condition | verdict |
|---|---|
| no `games/` directory at all | RED — `games/ cannot be read` |
| `games/` exists, holds no modules | RED — `games/ contains no .js modules` |
| a module that does not parse | RED — `does not parse as an ES module` |

**PART B — 13 constructs, each ALONE, each RED and each NAMED.** Alone, so the check is
shown to detect **each** rather than **any**; named, because *a RED for the wrong
reason is not evidence* — a fixture with a typo would be red too and would score as
proof (`PUP-WO-0103` finding B, one work order on).

`fetch(` · `XMLHttpRequest` · `import(` · `EventSource` · `new WebSocket` · `eval(` ·
`new Function(` · `importScripts(` · `navigator.sendBeacon` · `window[` ·
`globalThis[` · `self[` · a static import of a remote specifier.

**PART C — the removal ladder.** Removing one construct retires **exactly** its finding
and leaves the other four standing:

```
  removed fetch(           its finding: GONE   remaining findings: 4   exit=1
  removed XMLHttpRequest   its finding: GONE   remaining findings: 4   exit=1
  removed import(          its finding: GONE   remaining findings: 4   exit=1
  removed EventSource      its finding: GONE   remaining findings: 4   exit=1
  removed new WebSocket    its finding: GONE   remaining findings: 4   exit=1
```

**PART D — four cases that must stay GREEN**, because a check that cannot pass is not a
check either: a clean module; a forbidden token inside a comment or string only; a
relative static import; and — RED, deliberately — a token inside a template
`${substitution}`, which is code, not string.

### Two tokens beyond §8.3's five, labelled as mine

§8.3's enumeration is **defective, not merely short**, and both holes were reachable in
the time it took to write the check:

1. The scanner strips string literals to avoid false reds — so a module could hide
   `fetch(` in a string and hand it to `eval`. Forbidding the things that execute
   strings closes what removing strings opens.
2. **A STATIC import of a remote specifier reaches the network containing none of the
   five tokens.** §8.3 names `import(` — the *dynamic* form — only.

**What neither tier catches is stated in the check's own verdict rather than implied:**
a bypass through computed property access that never spells a forbidden token. No
textual check can. This raises the cost of reaching the network; it does not make it
impossible, and invariant 3 also rests on review of what `games/` contains.

### A standing note that reaches past this work order

**`node --check` is not a reliable parse gate for module syntax in a `.js` file**, and
the measurement is narrower than I first reported it. On Node 24:

```
node --check x.js   containing `export default function f({`  -> exit 0   (MISSES it)
node --check x.mjs  containing the same bytes                 -> exit 1   (correct)
```

The hole is **extension-dependent**. `games/*.js` are `.js` files carrying module
syntax — exactly the case it gets wrong — so check 11 uses `vm.SourceTextModule`, which
also parses **without executing**, the property that matters when the file under test
is untrusted by construction.

**I reported this to CC-A as reaching past check 11 before measuring the `.mjs` half.
It does not.** `check-syntax.mjs` writes module sources to a `.mjs` temp file before
calling `--check`, deliberately, with a comment saying why. The correction is recorded
in both comments rather than the claim quietly narrowed.

---

## §3.4 — THE WAY BACK, WHICH IS THE POINT OF THE WORK ORDER

`PUP-WO-0000` §1.6: all three existing openers append a full-bleed overlay **early** and
wire CLOSE **last** — Draw 152 lines later, Camera 287, Map 189 — and Map is a
**confirmed live trap**: an unreachable Leaflet CDN aborts the opener before CLOSE is
ever given a listener, and there is no `keydown`, `popstate` or `visibilitychange`
handler anywhere in the file. Recovery is killing the app, with a three-year-old
holding the tablet.

**Check 13, in a real browser, subject `0d353b5`, seven cases, all passing:**

| case | result |
|---|---|
| ordinary path | back present, thumb-sized, returns to console |
| **`mount()` throws** | the shell tore down by itself; nothing left on screen |
| module 404s | tore down by itself |
| module will not parse | tore down by itself |
| `mount` returns no teardown | tore down by itself |
| **`teardown()` throws** | the host is removed **anyway** — the removal is in a `finally`, never on the line after the call |
| **the module never arrives** (hangs 30s) | back present and working throughout |

The last case is **§1.6's own shape**: if the way back were wired after the `await`,
that is the case that would strand a child indefinitely.

**Asserting instead that the source contains an `addEventListener` before a `mount`
call would be satisfied by source that reads correctly and behaves otherwise.** So the
property is asserted against the cases that actually produce it.

The z-index band is **500** (host) / **501** (back), assigned here per finding F4 —
above every shell surface (200 remote photo and gallery, 100 settings and PIN, 90
`alertFlash`, 80 panels) and below `#portraitBlock` at 9999, which must stay on top
because a rotated tablet is a real state. §1.5 establishes that a remote photo or alert
can fire **while a game is open**, and either would otherwise paint over the game *and*
over the way back.

---

## WHAT DID NOT WORK, AND WHY

**I asked for a `CACHE_VERSION` bump I should not have asked for.** I cited
`PUP-WO-0000` §6.1's "two edits" **without reading §6.1's own next paragraph**, which
says edit 2 is *not* what makes a new asset land — the bump evicts stale copies of
**changed** assets, and a new asset has none. CC-A refused it and supplied a second,
independent reason I had missed entirely: **gate 2 counts three things and a bump is a
fourth**, so bumping would have falsified invariant 6 by the very test this work order
exists to make pass. Same shape as the tar-flags error one work order ago: **quoting a
document without reading its qualification.**

**My first gate-2 count said two things, not three**, because `git diff` does not see
an untracked file. `git add -N` first — otherwise the gate measures whatever git
happens to be tracking rather than what a change consists of.

**Three test-harness bugs of my own, all of which made a green look real:**

1. I measured `$?` through a pipe — again — so a run where all 13 constructs *were*
   detected printed `GREEN` for every one of them. Third time today.
2. A bash function's internal `for i` clobbered the caller's `i`, because bash
   functions share scope, so five removal-ladder iterations all removed the same token
   and four of them printed a misleading verdict.
3. My first differential oracle was newline-framed, which is the exact defect the thing
   under test exists to prevent.

**`playwright` resolves from `.github/ci/`, not the repo root**, so a measurement script
run from `/tmp` died with `ERR_MODULE_NOT_FOUND` that reads like a missing dependency.

---

## WHAT WAS DELIBERATELY NOT DONE

- **The picker overlay** — `PUP-WO-0201`. The Games button mounts `GAMES[0]` directly.
  That is a wire-up, not a chooser, and the code comment says so; with a second entry
  present, the second is unreachable until 0201 renders tiles.
- **Any real game** — P3, P4.
- **The three existing openers' trap** — `PUP-WO-0106`. Not fixed here, and
  deliberately not copied.
- **`PUP-WO-0104`, `0106`, `0108`, the cross-origin tiles question, the
  publication-concurrency redesign** — all parked behind this phase.
- **The naive-viewer icon test** — gate 3 needs a person.

---

## ONE THING FOR CC-A THAT IS NOT A DEFECT

`PUP-WO-0200` §2 now ends with `manifest.json` and both icons are also protected.
twice — once at the top of the amended block and once as the original trailing line.
Harmless and the meaning is unambiguous; noted only because the amendment that fixed a
duplicated constraint left a duplicated sentence.
