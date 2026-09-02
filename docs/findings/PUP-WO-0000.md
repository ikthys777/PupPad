# PUP-WO-0000 — Findings: initial state and seam investigation

**Work order:** `docs/work-orders/PUP-WO-0000.md` · **Phase:** P0
**Base:** `main` @ `4329c0c` (verified live; the WO header's `a4be019` was stale)
**Branch:** `investigate/wo-0000` · **Builder:** CC-EM (pup-b)
**Behaviour changed:** none. **Application code changed:** none.

> **Citation rule.** Every claim about `index.html` or `sw.js` below carries a
> `file:line`. Line numbers are against `4329c0c`, in which `index.html` is 1,942
> lines and `sw.js` is 43 — both re-measured, both matching architecture §3.

---

## 0. What this document establishes, in one paragraph

PupPad's shell has no lifecycle abstraction at all. It has three panels, each
opened by a bespoke `openX()` and closed by a `closeX()` that is reachable from
exactly one place — that panel's own CLOSE button (`index.html:649`, `:1113`,
`:1551`). The shell cannot close a panel it opened, registers no window or
document listener of any kind, and holds 127 names on `window`. Nothing here is a
seam a game can attach to, so §8's module contract is not an extraction of an
existing pattern — it is the first one, and it is specified to make structural the
two properties the current panels achieve only by luck: that teardown undoes
exactly what setup did, and that there is always a way out.

---

## 1. Panel lifecycle contract (as it actually is)

### 1.1 The three panels, and the shape they do *not* share

Three of the eight buttons open a panel (architecture §2, confirmed):

| Button | id | opener | closer | opener span |
|---|---|---|---|---|
| Map | 1 | `openTreasureMap()` `index.html:1292` | `closeTreasureMap()` `index.html:1555` | 262 lines |
| Draw | 2 | `openCanvas()` `index.html:436` | `closeCanvas()` `index.html:655` | 218 lines |
| Camera | 6 | `openCamera()` `index.html:768` | `closeCamera()` `index.html:1117` | 348 lines |

The other five (Comms 0, Alert 3, Tools 4, Weather 5, Power 7) have no panel:
they play a sound (`index.html:1685`) and set a toast (`index.html:1690-1698`).

**There is no shared contract across the three.** Each opener is a single long
function that inlines its own markup as a string, appends one overlay div to
`document.body`, then wires listeners by `getElementById` against ids only it
knows. The three agree on four incidental conventions and on nothing else:

- the overlay is `position:fixed`, full-bleed, `z-index:80`
  (`index.html:452`, `:782`, `:1310`);
- it is appended to `document.body`, never to `#app` (`index.html:493`, `:825`,
  `:1361`) — see §1.4, this turns out to be load-bearing;
- teardown is `overlay.parentNode.removeChild(overlay)` plus a `doSound('blip')`
  (`index.html:661-662`, `:1124-1125`, `:1569-1570`);
- panel-local state lives in module-level globals, not in the closure
  (`index.html:260-273` draw, `:667-673` camera, `:1129-1144` map).

### 1.2 What each `closeX()` actually releases

| Resource | Acquired | Released | Verdict |
|---|---|---|---|
| Map: geolocation watch | `index.html:1395` | `index.html:1556-1559` | released |
| Map: Leaflet instance | `index.html:1368` | `index.html:1560-1563` `treasureMap.remove()` | released |
| Map: overlay canvas ref | `index.html:1364` | `index.html:1564` | released |
| Map: stroke/stamp arrays | `index.html:1416`, `:1450` | `index.html:1566-1567` | released |
| Camera: `MediaStream` tracks | `index.html:753` | `index.html:1118-1121` | released |
| Camera: gallery data-URLs | `index.html:984` | `index.html:1122` | released |
| Draw: overlay + mapping | `index.html:493`, `:534` | `index.html:659-661` | released |
| **Draw: three monkey-patched globals** | `index.html:573-584` | `index.html:646-648` — **in the button handler, not in `closeCanvas()`** | **see §1.3** |
| **Realtime channel (all three)** | `:291`, `:690`, `:1152` | **never** | see §1.5 |
| Alert flash interval | `index.html:131` | self-clears at 20 blinks `:132-136` | see §1.6 |

### 1.3 The `openCanvas` monkey-patch — the single most instructive defect

`openCanvas()` reassigns three module-level *functions* so remote strokes are
recorded into a closure-local `strokeHistory` for zoom redraw:

- `drawRemoteStroke` — replaced `index.html:573-577`
- `drawRemoteStamp` — replaced `index.html:578-582`
- `clearLocalCanvas` — replaced `index.html:583-584`

The originals are restored at `index.html:646-648` — **inside the CLOSE button's
click handler**, immediately before it calls `closeCanvas()` at `index.html:649`.
`closeCanvas()` itself (`index.html:655-663`) restores nothing.

Today this is harmless, because `closeCanvas()` has exactly one call site
(`index.html:649`). It is recorded here because **the second call site is the
bug**: any future path that closes the draw panel — a shell-driven close, an
error path, a games button that dismisses the current panel first — leaves three
global functions permanently pointing at a closure over a dead canvas and a
`strokeHistory` array that can never be freed.

**This is the defect the module contract in §8 is shaped to make unwriteable.**
Setup and teardown are separated here by a button; §8 returns teardown *from*
mount, so it closes over the same scope and cannot drift from it.

### 1.4 What survives a re-render — the fact the games host depends on

`render()` (`index.html:1595`) rebuilds the console by assigning
`document.getElementById('app').innerHTML` (`index.html:1608`) and then calls
`attachEvents()` (`index.html:1675`).

- Everything inside `#app` is **destroyed**: `#root`, both rails, `#radarArea`,
  `#touchLayer`, `#xMarkLayer`, `#popup`, `#alertFlash`, `#lockBtn`,
  `#settingsBtn` (`index.html:1609-1673`).
- Every panel overlay **survives**, because all three are appended to
  `document.body`, not to `#app` (`index.html:493`, `:825`, `:1361`).

Because `innerHTML` replaces the nodes, the `attachEvents()` re-bind at
`index.html:1675` does **not** accumulate duplicate listeners on `.pad-btn`,
`#lockBtn` or `#settingsBtn` — a natural suspicion, and it is unfounded.

**Consequence for §8, stated as a requirement:** a game's host element must be
appended to `document.body`, never inside `#app`. A game mounted inside `#app`
is destroyed mid-play by any `render()` — and `render()` is called from the
settings save path (`index.html:1835`) and from the three PIN outcomes that
re-render (`index.html:1913`, `:1917`, `:1918`; the confirm-mismatch path at
`:1894` calls `buildOverlay()` instead), none of which a game controls.

### 1.5 What leaks, precisely

1. **Realtime channels are never left.** `joinCanvasChannel` (`index.html:287`),
   `joinCameraChannel` (`:686`) and `joinMapChannel` (`:1148`) each guard with
   `if (xChannel) return` and subscribe once; there is no `unsubscribe`,
   `removeChannel` or `leave` anywhere in the file (verified by exhaustive grep —
   zero occurrences). This is a deliberate join-once-reuse design, not an
   oversight, but it has a measured cost: while the map panel is **closed**, the
   `map-stroke` handler still pushes into `mapStrokes` (`index.html:1157`), which
   grows unbounded until the next `openTreasureMap()` resets it
   (`index.html:1298`).
2. **`state.pop` set on a panel-gate failure is sticky.** `openCanvas` sets
   `state.pop = 'Connect Supabase first!'` and calls `updateUI()`
   (`index.html:437-439`); the clearing timer is only armed on the *non-panel*
   branch (`index.html:1695-1698`). The toast persists until another button is
   pressed. Same shape at `index.html:770-771` (camera) and `:1294-1295` (map).
3. **`triggerAlertEffect` captures `#alertFlash` once** (`index.html:127`) and
   writes to it for up to 4s (`:131-146`). `#alertFlash` lives inside `#app`
   (`index.html:1672`), so a `render()` during an alert leaves the interval
   writing to a detached node while the live flash never fires.

### 1.6 The un-closable-overlay trap

`openTreasureMap()` appends its overlay at `index.html:1361`, then calls
`L.map('mapContainer', …)` at `index.html:1368`, and wires the CLOSE button at
`index.html:1550`. Leaflet is loaded from a CDN (`index.html:13`). If `L` is
undefined — CDN blocked, offline before Leaflet was ever cached, ad-blocker — the
throw at `:1368` aborts the function **before** `:1550` runs. The full-bleed
`z-index:80` overlay is already in the DOM and its CLOSE button has no listener.
There is no `keydown`, `popstate` or `visibilitychange` handler anywhere in the
file (verified: zero `window.addEventListener` and zero `document.addEventListener`
calls in 1,942 lines), so nothing else can dismiss it. **Recovery requires
killing and relaunching the app.**

This is the concrete failure the northstar's §6 bullet describes ("Buddy needs an
adult to get into or out of a game"). It is out of scope to fix here —
`index.html` is protected — and is logged in `FEEDBACK.md`. It is reproduced in
§8 as a **shell obligation**: the back affordance is wired *before* `mount()` is
called, never after.

**The trap is structural, not Leaflet-specific, and all three openers have its
shape.** Each appends its full-bleed overlay early and wires CLOSE last:

| Panel | Overlay appended | CLOSE wired | Unguarded span |
|---|---|---|---|
| Draw | `index.html:493` | `index.html:645` | 152 lines |
| Camera | `index.html:825` | `index.html:1112` | 287 lines |
| Map | `index.html:1361` | `index.html:1550` | 189 lines |

Map is the one with a *known* trigger — an undefined `L`. For the other two I
found no synchronous throw on the paths I traced (`openCanvas` gates and returns
early at `index.html:437-440`; `openCamera`'s failure path is an
already-`.catch()`-ed promise at `:844-867`), **but enumerating an opener's known
failure modes is not the same as proving no path exists**, and the camera's
287-line unguarded span includes a synchronous `startCameraStream` call
(`:844`), a `querySelectorAll` chain (`:869`) and `renderGallery()` (`:1109`).
Treat all three as carrying the hazard; only Map is confirmed reachable.
*(Scope corrected after the adversarial pass, finding F5 — an earlier draft
cleared the other two outright.)*

---

## 2. The router contract — there is no router

Architecture §2 already records this, corrected in `4329c0c`. Confirming it against
the code and answering the question the WO actually asks.

`attachEvents()` (`index.html:1679-1738`) binds a click handler to every `.pad-btn`
(`index.html:1680-1681`). Inside it:

```
index.html:1682   var id  = parseInt(el.dataset.id);
index.html:1683   var btn = BTNS_LEFT.concat(BTNS_RIGHT).find(function(b){return b.id===id});
index.html:1684   if (!btn) return;
index.html:1685   doSound(btn.sound);
index.html:1686   if (btn.id === 3) { triggerAlertEffect(); pushAlert(); }
index.html:1687   if (btn.id === 1) { openTreasureMap(); return; }
index.html:1688   if (btn.id === 2) { openCanvas();      return; }
index.html:1689   if (btn.id === 6) { openCamera();      return; }
index.html:1690-1698  /* default: set state, toast, auto-clear after 2500ms (4500 for id 3) */
```

**`data-id` is a lookup key, not a dispatch key.** Two things happen at
`index.html:1682-1685` and they are different in kind:

- **Data-driven, and already extensible:** the record lookup (`:1683`) and the
  sound (`:1685`) come from the button record. A ninth record would work
  unchanged.
- **Hardcoded, and not extensible:** the behaviour, an ordered `if` chain on four
  literal ids (`:1686-1689`), each with its own control flow — `3` falls through
  to the default toast branch, `1`/`2`/`6` return early.

**What adding a ninth id requires today:** one entry in `BTNS_RIGHT`
(`index.html:101-106`) *and* one new `if (btn.id === 8)` line at
`index.html:1689`, inside a function 1,600 lines from the data it branches on.
That second edit is the whole of northstar invariant 6's failure, and it is why
`PUP-WO-0200` must replace the chain with a per-record action rather than extend
it.

**The shape that removes the chain** — recorded here because §9's registry shape
depends on it being possible. Give every button record an `open` field naming
what it does, and `:1686-1689` collapses to one line:

```js
{id:1, label:'Map', …, open: openTreasureMap}     // panel buttons
{id:0, label:'Comms', …, open: null}              // toast-only buttons
…
if (btn.open) { btn.open(); return; }             // replaces index.html:1686-1689
```

Alert (id 3) is the awkward case and must not be waved past: it is the only
button that runs an effect *and* falls through to the toast
(`index.html:1686`, then `:1690`). Under the collapsed form it becomes
`open: null` plus an `effect: triggerAlertEffect` field, or its effect moves into
the record's own function and the toast becomes the default return. Either is a
one-record change; neither is in this work order's scope. **Recorded so
`PUP-WO-0200` inherits the awkward case rather than discovering it.**

## 3. State inventory

### 3.1 The `state` object — all five fields

`index.html:116` — `var state = {active:null, pid:-1, pop:'', isLocked:false, storedPin:null};`

| Field | Type | Written at | Read at | Survives `render()`? |
|---|---|---|---|---|
| `active` | button record or `null` | `:1691` set, `:1696` cleared | `:1596-1597` (`render`), `:1656`, `:1742-1743` (`updateUI`), `:1767` (`spawnPaw`) | yes — plain object, `render()` reads it |
| `pid` | int, `-1` = none | `:1690` set, `:1696` cleared | `:1586` (`btnHTML`), `:1749` (`updateUI`) | yes |
| `pop` | string, `''` = hidden | `:1692`, three gate-failure paths `:438`, `:770`, `:1294`, and the camera-retry `.catch` `:862` (not a gate — it is reached only after the panel is open) | `:1755-1758` (`updateUI`) | yes — see §1.5 item 2, the gate-failure writes are never cleared |
| `isLocked` | bool | `:1912`, `:1916` | `:1605`, `:1623`, `:1732` — **all three cosmetic or mode-selecting** | yes |
| `storedPin` | 4-char string or `null` | `:1912`, `:1916` | `:1915` only | yes in memory; **lost on reload** — never persisted |

**Nothing in `state` is persisted.** The only three `localStorage` keys in the
file are `puppad_sb_url`, `puppad_sb_key` and `puppad_device_id`
(`index.html:158-163`, `:172-173`). No PIN, no lock, no game state.

### 3.2 The other 59 globals — where the real state lives

`state` holds 5 fields; the file declares **64 top-level `var` bindings** and
**63 top-level function declarations** — 127 names on `window`. Panel state does
not live in `state`; it lives in flat globals grouped by panel:

| Group | Lines | Bindings |
|---|---|---|
| Audio | `index.html:53` | 1 |
| Button/blip data (`BTNS_LEFT`, `BTNS_RIGHT`, `BLIPS`) | `:95-113` | 3 |
| Console state + timers | `:116-121`, `:124` | 10 |
| Supabase config + polling | `:150-154`, `:216` | 6 |
| Realtime client + channels | `:260-261`, `:667`, `:1129` | 4 |
| Draw panel | `:262-276`, `:332-334` | 17 |
| Camera panel | `:668-675` | 7 |
| Map panel | `:1130-1146` | 16 |

Sums to 64. *(An earlier draft's version of this table summed to 63 and stranded
`canvasChannel`; corrected after the adversarial pass, finding F16.)*

**Five are declared and never read** — `tpId`, `xmId` (`:118`), `lastFetchTime`
(`:154`), `cameraReviewCanvas` (`:673`), and `canvasOpen` (`:262`, written at
`:441` and `:656`, read nowhere). Logged in `FEEDBACK.md`.

**Consequence for §8, stated as a requirement:** a game module loaded as a classic
`<script>` shares this 127-name namespace, and `pieces.ts:93`-style module
counters plus Block Pop's `window.__blockPop` debug global (`store.ts:421-431` in
the source workspace) show the source games are willing to create globals. The
module contract therefore specifies **ES modules** (`<script type="module">`),
which give each game its own scope for free, rather than an honour-system naming
convention.

## 4. The sound bank

`doSound(type)` — `index.html:59-92`. One switch-table object `S`
(`index.html:76-89`) built fresh on every call, dispatched by
`if(S[type])S[type]()` at `index.html:90`. Two synthesis primitives: `mk()`
(fixed pitch, `:62-68`) and `sw()` (linear sweep, `:69-75`).

**All twelve names, and nothing else is valid:**

| Name | Line | Character | Currently reachable from |
|---|---|---|---|
| `ping` | `:77` | 3-note rising sine arpeggio | Comms button (`:96`), remote photo (`:720`), photo saved (`:991`), gallery tap (`:1039`) |
| `chime` | `:78` | 4-note major arpeggio | Map button (`:97`), map open (`:1306`), map re-centre (`:1538`) |
| `scan` | `:79` | 200→1800 Hz sawtooth sweep | Draw button (`:98`), canvas open (`:446`), both clear buttons (`:643`, `:1546`) |
| `alert` | `:80` | 5-note square-wave two-tone siren | Alert button (`:99`), remote alert received (`:225`) |
| `tap` | `:81` | click + triangle body | **Tools button only** (`:102`, via `:1685`) |
| `twinkle` | `:82` | 5-note descending-then-rising sine | **Weather button only** (`:103`, via `:1685`) |
| `blip` | `:83` | short click + downward sweep | Camera button (`:104`), camera **open** (`:778`), all three panel closes (`:662`, `:1125`, `:1570`), shutter (`:898`) — 5 sites |
| `powerUp` | `:84` | 80→400→1200 Hz sweep + 3-note tail — the longest and richest cue in the bank | **Power button only** (`:105`, via `:1685`) |
| `lock` | `:85` | 2-note falling | PIN set (`:1913`) |
| `unlock` | `:86` | 2-note rising | PIN cleared (`:1917`), settings saved (`:1833`) |
| `keyTap` | `:87` | single 1800 Hz blip | **19** call sites — every tool/colour/size/emoji pick, plus both zoom buttons (`:632`, `:638`), camera flip (`:888`), filter pick (`:875`), sticker pick (`:947`), retake (`:958`), map mode toggle (`:1530`), and every PIN keypad press (`:1881`) |
| `error` | `:88` | 2-note falling square | PIN mismatch (`:1894`), wrong PIN (`:1918`) |

**Three properties the module contract relies on, all verified:**

1. **Unknown names are a silent no-op** (`index.html:90`) — `doSound('nonsense')`
   does nothing and throws nothing. A game may name a sound the bank does not
   have without breaking.
2. **Every failure is swallowed** by the `try`/`catch` at `index.html:60`/`:91` —
   no autoplay-policy rejection can propagate into a caller.
3. **One lazily-created `AudioContext`** (`index.html:53-58`), reused and resumed
   on every call (`:56`). It is never closed. A game must therefore **not** create
   its own context — see §8's `api.sound`.

**Confirming architecture §5's Power ruling is free:** `powerUp` is reachable
today from exactly one place, the Power button record at `index.html:105`.
Reassigning it to games-open costs one string in one record and orphans nothing.

## 5. The PIN/lock finding — architecture §3.1 re-verified independently

**Verdict: §3.1 is CONFIRMED, and it understates the problem.**

Re-derived from the code without relying on the architecture's claim. Exhaustive
grep: `state.isLocked` is read at exactly three lines and `state.storedPin` at
exactly one.

**Confirming §3.1's two claims:**

1. *"holds a PIN in `state.storedPin`, which is in-memory only and lost on
   reload"* — **true.** `storedPin` is a plain property of the object literal at
   `index.html:116`. It is written at `:1912` and `:1916` and read at `:1915`.
   It appears in no `localStorage` call; the only three keys written are at
   `index.html:163`, `:172`, `:173`, none of them PIN-related. A reload
   re-evaluates `index.html:116` and both `isLocked` and `storedPin` return to
   their defaults, so **reloading the page silently unlocks it.**
2. *"It gates no content whatsoever"* — **true.** All three reads of `isLocked`
   are non-gating: `:1605` picks an icon colour, `:1623` picks a background and a
   pulse animation, `:1732` picks which mode string to pass to `showPinOverlay`.
   No opener, no button handler, no radar handler and no settings handler
   consults it. The `.pad-btn` handler (`index.html:1680-1699`) contains no lock
   check, so all eight buttons and all three panels stay fully operable while
   "locked".

**Two things §3.1 does not say, both of which strengthen its ruling:**

3. **The unlock path rejects a wrong PIN but cannot re-prompt.** At
   `index.html:1901` the fourth digit triggers
   `closePinOverlay(); onPinComplete(entry);` — **the overlay is dismissed before
   the PIN is compared**. The comparison at `:1915` then does reject correctly:
   on a mismatch (`:1918`) `isLocked` stays `true`, `storedPin` is preserved and
   `exitFullscreen()` is not called. What is missing is the retry — the dialog is
   already gone, so a wrong entry silently returns the child to the console with
   an error tone. The lock button stays live, so **there is no retry prompt, no
   lockout and no rate limit: the PIN is brute-forceable with unbounded
   attempts.**
4. **The adult surface stays reachable while locked.** `#settingsBtn` is bound
   unconditionally at `index.html:1736-1737`, and `showSettings()` renders the
   Supabase **anon key** into a visible plain-text input at `index.html:1818`
   (`value="'+keyVal+'"`). So in the "locked" state, one tap on the gear reveals
   a credential and offers to edit it.

**The lock's only functional effect** is fullscreen: `goFullscreen()` at
`index.html:1913` and `exitFullscreen()` at `:1917`.

**Ruling for later work orders:** architecture §4's "the lock button is *not* part
of this boundary despite appearances" and §8's "no work order may treat it as
containment" both stand, and item 4 above means the reverse is also true — the
lock must not be presented to a parent as if it contained anything. Any adult-only
affordance the games surface needs (architecture §10's open question about
`classic`) must be built, and must not be built on this.

---

## 6. `sw.js` — what a new cached asset actually requires

All 43 lines read. Three handlers, one constant, one list.

### 6.1 The direct answer (WO §1.2)

To make `games/gyre.js` available offline from a **cold install**, two edits, both
in `sw.js`, and nothing else anywhere:

1. **One line in `urlsToCache`** (`sw.js:2-8`) — `'./games/gyre.js',`
2. **One bump of `CACHE_NAME`** (`sw.js:1`) — `'pup-pad-v16'` → `'pup-pad-v17'`

**Precisely why each, because they are not the same requirement:**

- Edit 1 is what `install` precaches: `caches.open(CACHE_NAME)` at `sw.js:12` then `cache.addAll(urlsToCache)` at `sw.js:13`.
- Edit 2 is **not** required for the new asset to land. Any byte-change to `sw.js`
  triggers `install`, and `caches.open()` on an unchanged name returns the
  *existing* cache, into which `addAll` writes the new entry. The bump is
  required to **evict stale copies of changed assets**, because `activate`
  (`sw.js:19-29`) reaps by name inequality (`name !== CACHE_NAME`, `sw.js:23`) —
  with no bump, nothing is reaped. It is also this repo's standing convention,
  and unusually strong evidence of one: `sw.js` has **17 commits, 13 of which are
  `chore: bump SW to vN`** and the other four are the initial uploads. Since the
  file settled, *every* change to it has been a version bump — the current value
  is `v16` at `sw.js:1`.
- `cache.addAll` is **all-or-nothing** (`sw.js:13`): one 404 in the list fails the
  whole install and the new service worker never activates. A `urlsToCache` entry
  for a file that does not exist bricks the update. This is the strongest argument
  for `PUP-WO-0100`'s asserted asset check, and it should assert **both**
  directions: every referenced local asset is listed, *and* every listed entry
  exists.

**This confirms northstar invariant 6 is achievable on the `sw.js` side**: one
manifest line, exactly as the invariant promises. Nothing in `sw.js` is
per-asset-typed, path-shaped or count-limited.

### 6.2 The fetch handler — network-first with unconditional runtime caching

`sw.js:31-43`. This is the most consequential thing in the file and the least
described anywhere in the documents:

```
sw.js:33   fetch(event.request).then(function(response) {
sw.js:34     var clone = response.clone();
sw.js:35-37    caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
sw.js:38     return response;
sw.js:39-41 }).catch(function() { return caches.match(event.request); })
```

Four properties follow, and three of them matter to later phases:

1. **Every response that `fetch` resolves is written into the cache**
   (`sw.js:34-37`), not just the five precached entries. **There is no
   `response.ok` or status filter** — `fetch` resolves for 404 and 500, so error
   responses are cached too. That is directly load-bearing on §6.1's asset check:
   a mistyped `games/<id>.js` path fetched once while online caches a 404 body,
   which is then served offline as a plausible-looking hit rather than failing
   loudly. This **contradicts architecture §3** — see §10.1.
   One boundary condition: `sw.js` is registered at `index.html:1935`, at the
   bottom of the inline script, so on the **very first** load the page is
   uncontrolled and the `<head>` CDN requests at `index.html:11-13` are not
   intercepted at all. Runtime caching begins from the second load.
2. **Network-first, cache-as-fallback.** The cache is only consulted when `fetch`
   *rejects* (`sw.js:39`). A response is served from the network whenever the
   network answers at all — so on a slow or captive connection the app waits for
   the network rather than serving the cached copy it already has. **This is a
   direct threat to the northstar §6 failure mode "cold start slows … he taps the
   icon and waits", and it will get worse per game added**, because architecture
   §5 rules that games load on demand: opening a game on a flaky network waits for
   a fetch timeout before falling back. Flagged for P2's cold-start gate; not
   fixable here.
3. **`cache.put` is neither awaited nor caught** (`sw.js:35-37`). It rejects for
   any non-`GET` request — and the app issues `POST`s to Supabase through the
   `fetch` at `index.html:194`, via `pushXMark` (`:202`) and `pushAlert` (`:210`),
   each of which produces an unhandled promise rejection inside the worker. Both
   POST paths are gated on `isSupabaseConfigured()` (`:201`, `:209`), so this
   occurs only on a device that has been configured. Logged in `FEEDBACK.md`.
4. **A cache miss while offline returns `undefined`** (`sw.js:40`), and
   `event.respondWith(undefined)` is a network error, not a fallback page. There
   is no offline document. Acceptable today; worth a decision before games rely
   on it.

### 6.3 The activate reap — out of scope, noted only

`sw.js:19-29` deletes every cache whose name is not its own, and `caches.keys()`
is origin-scoped. This is architecture §6's amended hazard, owned by
`PUP-WO-0101`. **Not re-litigated here and not a finding of this WO** — it was
already found by CC-A before dispatch.

One consequence is worth adding to `PUP-WO-0101`'s brief because it changes the
severity, not the diagnosis: because §6.2 means the CDN dependencies
(`index.html:11-13`) and OSM tiles (`index.html:1373`) are cached at runtime, a
cross-path reap does not merely "lose offline capability" — it also deletes the
cached Leaflet bundle, and a Leaflet-less Map button reproduces the un-closable
overlay of §1.6 rather than failing gracefully.

## 7. Disposition of the two Grok workspaces

**Method.** Two context-isolated subagents, one per workspace, each given the
PupPad target constraints and no access to the other's output. Their file counts
were reconciled against an independent `find` of each tree and match exactly:
`blockpop` 99 classified + 143 excluded = 242 files; `gyre` 87 + 158 = 245. All
22 line counts in the tables below were re-measured directly and are exact.

**What that verification did and did not cover.** I spot-checked 33 of their
`file:line` citations and all 33 resolved. **That is not the same as having
checked every claim I repeated from them**, and the adversarial pass found five
that do not hold — the pointer-capture line is in `particle-canvas.tsx:76`, not
`sim.ts:76` (`sim.ts` contains no `setPointerCapture` at all); `store.ts:244`'s
predicate is `!anyTrayFits` — *no tray piece fits* — not board-fullness;
`GameOver.tsx`'s three buttons span `:36-44` and are already visually weighted;
"21 selector subscriptions, 7 effects" is 29 and 8; and gyre's "13 bound
constants" is 16. All five are corrected in place below. Recorded because the
distinction between *spot-checked* and *verified* is the whole difference between
those two numbers.

**Excluded wholesale, by count, per the 2026-08-31 ruling (WO §1.3, §3.4):**

| Directory | blockpop | gyre | Reason |
|---|---|---|---|
| `.grok/` | 92 | 87 | Grok agent metadata, skills, references — generated |
| `.vercel/` | 36 | 52 | Vercel build output — generated |
| `screenshots/` | 15 | 19 | Agent capture artifacts — generated. **Excluded on the builder's judgement, not by ruling** — see note |
| `attachments/` | — | 2 | Agent-session reference images. Listed individually in §7.3 rather than excluded |
| `.tanstack/`, `artifacts/` | 0, 0 | 0, 0 | Empty directories |

> **Authority note.** The 2026-08-31 ruling names only `.grok/` and `.vercel/` as
> excludable wholesale, and WO §3.4 requires that scaffolding still be *listed and
> marked `discard`*. `screenshots/` (34 binary PNGs across the two workspaces) is
> excluded here on my own judgement as the same class of generated artifact, not
> on that ruling's authority. Flagged in `FEEDBACK.md` as a scope question rather
> than presented as covered. *(Raised by the adversarial pass, finding F23.)*

`~/PupPad-sources/_incoming/` holds the original zips, is a transfer artifact per
WO §9, and is excluded without being treated as an undescribed workspace.

**Totals — `port` / `rewrite` / `discard`:**

| Workspace | port | rewrite | discard | classified |
|---|---|---|---|---|
| blockpop | 5 | 8 | 86 | 99 |
| gyre | 3 | 10 | 74 | 87 |

**The whole of the wanted material is 22 files** — 8 `port` and 14 `rewrite`,
after §7.1's ruling below moves four of gyre's `ui/` files to `discard`. The other
465 of the **487** files across both workspaces (242 + 245) are platform
scaffolding. The per-workspace table above states the pre-ruling split; §7.1
states the post-ruling one.

*(Arithmetic corrected after the adversarial pass, finding F12: an earlier draft
read "26 files … 460 of 486", which mis-added 242+245 and was also stale by
§7.1's own correction, sitting above it and never restated.)*

> **Correction applied to a subagent's own summary.** The blockpop agent's
> closing line read "6 port, 7 rewrite"; its table marks
> `src/lib/game/store.ts` **rewrite**, which makes the split 5/8. Its discard
> count (86) and its per-file rows are correct — only the summary arithmetic was
> off, and the rows are what this table is derived from. Recorded rather than
> silently fixed, because the verbatim outputs are in `FEEDBACK.md` and a reader
> comparing the two would otherwise find a discrepancy with no explanation.

### 7.1 The one disposition the two sweeps disagreed on

The two agents were given the same rubric and never saw each other's output. They
classified **the same file, `src/components/ui/button.tsx`, oppositely** — 44
lines in blockpop, 49 in gyre, both a `cva`/Tailwind variant table over a React
`<button>`.

- blockpop agent: **discard** — *"PupPad supplies its own controls"*
- gyre agent: **rewrite** — *"PupPad needs a plain `<button>` with CSS classes,
  not the variant machinery"*

**This is a real disagreement about what `rewrite` means, and averaging it would
lose the point.** `rewrite` in this rubric means *the behaviour is wanted and
needs a vanilla equivalent*; `discard` means *nothing here is wanted*. The
question is whether the variant machinery carries any wanted behaviour.

**The two files are not the same file.** They differ by 86 diff lines over 44 and
49, and they are different implementations: blockpop's uses hand-rolled
`Record<Variant,string>` lookup tables with no `cva` and no Radix `Slot`; gyre's
uses `cva` + `@radix-ui/react-slot`. Their variant vocabularies do not overlap,
and blockpop's carries game-specific toy styling (`font-display`, a
`active:not-disabled:scale-[0.96]` press, a hard `0 3px 0` shadow).
*(An earlier draft argued the ruling from "identical boilerplate from the same
template", which is false — corrected after the adversarial pass, finding F13.)*

**Ruling: `discard`, for both workspaces — on a different reason than the one
that failed.** What PupPad wants from a button already exists and ships:
`btnHTML` at `index.html:1585-1592`. Neither file's variant machinery survives
contact with a no-build-step target — `cva`, `tailwind-merge` and Radix are npm
dependencies, and the hand-rolled table is a Tailwind class map with no Tailwind
to resolve it. Blockpop's toy styling is worth *reading* when authoring the
vanilla CSS, which is what `styles.css`'s `rewrite` row already covers. Marking
`button.tsx` `rewrite` would put a file on P3's and P4's port lists whose vanilla
equivalent is already written.

**But the gyre agent's instinct was right about a different file.** The same
argument does **not** apply to `src/components/ui/slider.tsx` (22 lines): PupPad
has **no** slider anywhere in `index.html`, Gyre's control surface *is* its
sliders per architecture §5's ruling, and the source's 44px touch target
(`after:size-11`) is exactly the kind of detail a rewrite must carry across. That
file stays `rewrite`, and it is the only one of the five `ui/` files that does.
`label.tsx`, `separator.tsx` and `tooltip.tsx` join `button.tsx` as `discard` —
a tooltip in particular is meaningless for a non-reader (northstar invariant 1).

**Net effect on the totals:** gyre moves 3 files from `rewrite` to `discard`
(`label`, `separator`, `tooltip`) and 1 more (`button`) — **gyre is port 3 /
rewrite 6 / discard 78**; blockpop is unchanged at 5 / 8 / 86, its agent having
already called `button.tsx` discard.

### 7.2 Block Pop — `~/PupPad-sources/blockpop/`

**`port` — pure logic, moves near 1:1**

| path | lines | reason |
|---|---|---|
| `src/lib/game/types.ts` | 56 | type aliases + `BOARD_SIZE`/`HELPERS`/`SHUFFLES`/`COLOR_COUNT`/`TRAY_SIZE` consts; zero imports |
| `src/lib/game/pieces.ts` | 124 | shape table + `makePiece`/`randomColor`/`shapesFor`/`pickWeighted`; one module counter `nextPieceId` (`pieces.ts:93`) to remove |
| `src/lib/game/engine.ts` | 230 | 18 pure board functions, injectable `rng`, no DOM/React/module state |
| `src/lib/game/save.ts` | 75 | pure `localStorage` read/write behind try/catch; re-point the key |
| `src/lib/game/audio.ts` | 169 | WebAudio synth, zero asset files; module singletons `ctx`/`master`/`enabled` (`audio.ts:13-15`) must be parameterised — but see §8, PupPad supplies `api.sound` and this file may be dropped entirely |

**`rewrite` — behaviour wanted, needs a vanilla equivalent**

| path | lines | reason |
|---|---|---|
| `src/lib/game/store.ts` | 431 | zustand `create()`; logic wanted verbatim, container/`set`/`get`/subscription model must become a plain object + emitter |
| `src/components/game/BlockPopGame.tsx` | 643 | 21 selector subscriptions, 7 effects, rAF particle loop, 5 window listeners, JSX shell |
| `src/components/game/Board.tsx` | 82 | `forwardRef` + JSX grid; the `data-row`/`data-col` hit-test contract is worth keeping |
| `src/components/game/Candy.tsx` | 55 | JSX `<span class="candy" data-color>` + `PieceGrid` CSS-grid renderer |
| `src/components/game/PieceTray.tsx` | 55 | JSX tray buttons; `trayCellSize()` is portable |
| `src/components/game/StartScreen.tsx` | 101 | JSX menu + `lucide-react` icons; PupPad's picker replaces most of it |
| `src/components/game/GameOver.tsx` | 49 | JSX modal; the score-tier title logic ports, the three-button shape must not — see §8.4 |
| `src/styles.css` | 256 | Tailwind layer discarded; `.candy` gradients, `.well`, `.board-frame` and the `candyPop`/`candyClear`/`hintPulse`/`cheerIn` keyframes (`:63-249`) are the game's whole look and must be re-authored as plain CSS |

**`discard` — 86 files.** `src/lib/auth/**` (16 — Better Auth, JWKS gate identity,
PGLite dialect, OAuth popup; **contains a credential, see §7.4**),
`src/lib/app-data/**` (7 — connector/MCP client and its tests),
`src/lib/multiplayer/**` (2 — 570-line WebRTC mesh needing an `/api/rtc`
signaller; **zero importers anywhere in `src/`**), `src/lib/db.ts`,
`src/lib/utils.ts`, `src/lib/og/site.json`, `src/lib/error-component.tsx`,
`src/lib/preview-embedder-origin.ts`, `src/lib/preview-host-bridge.ts`,
`src/components/preview-host-bridge.tsx`, `src/components/ui/button.tsx`,
`src/router.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`,
`src/routeTree.gen.ts` (37 under `src/`); `server/` (2 — Nitro PWA middleware +
ambient types); `scripts/` (26 — brand-check, browser-smoke, auth-invariant,
grok-pwa plugin/shared, migrate, preview, sign-out-plan, with-app-env,
write-atomic, and each one's `.test.mjs`); `migrations/auth/0001_auth.sql` (1);
`public/` (11 — favicon, OG/banner images, and the `__grok/install/` tutorial
assets); and the 9 top-level files (`AGENTS.md`, `eslint.config.mjs`,
`package.json`, `package-lock.json`, `.prettierrc`, `.node_modules.lock`,
`startup.sh`, `tsconfig.json`, `vite.config.ts`).

### 7.3 Gyre — `~/PupPad-sources/gyre/`

**`port` — pure logic, moves near 1:1**

| path | lines | reason |
|---|---|---|
| `src/components/field/sim.ts` | 322 | `GyreSim` class: `Float32Array` integration + canvas2d draw. No React, **no module-level mutable state** (only `TAU`, `HUE_BUCKETS`, `MAX_DPR` consts) — architecture §7 seam 1 already holds here |
| `src/components/field/palettes.ts` | 68 | data-only const array + derived map; straight copy minus `swatchClass` |
| `src/components/field/backgrounds.ts` | 85 | data-only const array + derived map; straight copy minus `swatchClass` and the four fields `sim.ts` never reads |

**`rewrite` — behaviour wanted, needs a vanilla equivalent**

| path | lines | reason |
|---|---|---|
| `src/components/field/store.ts` | 169 | zustand store; the clamp helpers and 13 bound constants are portable, the store shell and `subscribe` contract are not. The two `*Token` counters are an event channel that exists only because zustand has no event bus — delete them, call the sim directly |
| `src/components/field/particle-canvas.tsx` | 100 | `useRef`/`useEffect` + `useFieldStore.subscribe`; the listener wiring and sim lifecycle is exactly the shape PupPad needs, in plain JS |
| `src/components/field/controls.tsx` | 359 | the control surface — 6 sliders, 2 swatch radiogroups, 4 buttons. Wanted; the Radix/lucide markup is not |
| `src/components/field/field-app.tsx` | 23 | React composition root; becomes the `mount`/teardown pair of §8 |
| `src/components/ui/slider.tsx` | 22 | **the only `ui/` file that survives** — PupPad has no slider anywhere; preserve the 44px touch target (`after:size-11`) |
| `src/styles.css` | 91 | Tailwind layer discarded; the palette swatch gradients (`:70-84`) and background tokens (`:24-28`) are wanted data — though `backgrounds.ts` already carries `hex`, so most of it is redundant |

**`discard` — 78 files.** `src/lib/auth/**` (13 — **contains the same credential,
see §7.4**), `src/lib/multiplayer/**` (2), `src/lib/db.ts`, `src/lib/utils.ts`,
`src/lib/og/site.json`, `src/lib/error-component.tsx`,
`src/lib/preview-embedder-origin.ts`, `src/lib/preview-host-bridge.ts`,
`src/components/preview-host-bridge.tsx`, `src/router.tsx`,
`src/routes/index.tsx`, `src/routes/__root.tsx`, `src/routeTree.gen.ts`, and
`src/components/ui/{button,label,separator,tooltip}.tsx` (30 under `src/`);
`server/` (2); `scripts/` (22 — the same set as blockpop minus `preview*` and
`write-atomic*`); `migrations/auth/0001_auth.sql` (1); `public/` (11);
`attachments/` (2 — agent-session reference images, not app assets); and the 10
top-level files (blockpop's 9 plus `.project_id`).

### 7.4 §7 flag: a committed credential exists in **both** workspaces

**Reported, not copied, not echoed, not committed — as WO §7 requires.**

| Where | What |
|---|---|
| `~/PupPad-sources/blockpop/src/lib/auth/preview.ts:19` and `~/PupPad-sources/gyre/src/lib/auth/preview.ts:19` | a hardcoded **OAuth 2.0 client identifier** |
| `~/PupPad-sources/blockpop/src/lib/auth/preview.ts:21` and `~/PupPad-sources/gyre/src/lib/auth/preview.ts:21` | a hardcoded **OAuth 2.0 client secret** — a 64-character plaintext literal |

Found independently by both sweeps. **I verified it myself without reading the
values**, by measuring the shape of lines 19 and 21 in each file: both files carry
an identical 64-character quoted literal on line 21. The value is not reproduced
in this document, in `FEEDBACK.md`, or in any command that was logged.

**Assessment:**

- It is a **Grok-platform template credential, not a ClearForge one.** Identical
  in both workspaces, which is what you would expect from a shared scaffold. The
  file's own header describes it as a deliberately baked, preview-only,
  low-privilege client scoped to `*.grok-sandbox.com` callbacks.
- **Blast radius is contained.** Both sweeps confirmed by exact-string search that
  the value appears in that one file per workspace and **not** in the `.vercel/`
  build output — it was not shipped to any browser.
- **It cannot reach this repository.** `~/PupPad-sources/` is outside the git tree
  (`git ls-files` returns zero matches for `preview.ts`), WO §9 makes the
  workspaces reference material that is never committed, and `src/lib/auth/` is
  classified `discard` in both dispositions — so the file is deleted, not carried,
  by the ports P3 and P4 will do.

**Recommendation (decision needed — Scotty, not a builder call):** nothing here
blocks P0, and no action is required to keep PupPad clean. The open question is
whether to notify whoever owns the Grok preview broker, since a plaintext client
secret sits in a template that is presumably distributed to every sandbox export.
Rotation costs nothing and is not ours to perform.

**Everything else came back clean** in both sweeps: no `.env` files, no private
keys, no JWTs, no database connection strings with embedded credentials, and no
Supabase/Vercel/GitHub/AWS/npm keys. `BETTER_AUTH_SECRET` falls back to a runtime
`randomBytes(32)`, not a literal. All remaining `secret`/`token`/`password` grep
hits are identifier names, doc prose, a SQL column declaration, or third-party
library source.

---

## 8. The game-module contract

Architecture §4 describes this in the abstract: *"A game receives a container
element and a `close()` callback and owns nothing outside it."* Below is the
concrete form, the shell's half of the bargain, and the demonstration WO §3.5
requires.

### 8.1 The module side

**One file per game at `games/<id>.js`, an ES module, one default export.**

```js
// games/<id>.js
export default function mount(host, api) {
  // …build the game inside `host`…
  return function teardown() { /* release everything mount acquired */ };
}
```

| Term | Contract |
|---|---|
| `mount` | The default export. **Synchronous.** Called exactly once per session. Must not throw; if it does, the shell tears down and returns to the picker (§8.2 obligation 5). |
| `host` | An empty `HTMLDivElement`, already full-bleed and already in the DOM, created and owned by the shell. The module may do anything inside it and **must touch nothing outside it** — no `document.body` appends, no `window` globals, no listeners on `document` it does not remove. |
| `api` | A frozen object supplied by the shell. Its surface is fixed in §8.3. |
| return value | **A `teardown` function.** The shell calls it exactly once, then removes `host`. After it returns, the module must hold no live `requestAnimationFrame`, interval, timeout, event listener, observer, capture, or media resource. |

**Why `teardown` is *returned from* `mount` and not exported separately.** This is
the one design decision in the contract that is load-bearing, and it comes
directly from a measured defect rather than from taste:

- A returned closure **shares scope with the setup that created the handles**.
  There is nowhere else to put a `rAF` id or a listener reference, so the teardown
  cannot drift out of sync with the setup.
- A separate `export function unmount()` would need module-level variables to hold
  those handles — which is precisely the **module-level singleton state
  architecture §7 seam 1 forbids**, and precisely what makes Block Pop's
  `store.ts:156` singleton un-remountable today.
- It makes `openCanvas`'s defect (§1.3) unwriteable. There, the restore logic sits
  in a button handler at `index.html:646-648` while the teardown function at
  `index.html:655-663` restores nothing — the two drifted apart because the
  language let them live in different places. Under this contract they cannot.

**Consequence, and it is the point:** two instances of the same game can be
mounted simultaneously without interfering. That is not a feature anyone wants
today; it is the observable test that no module-level state exists, and it is
architecture §7 seam 1 enforced by shape rather than by review.

### 8.2 The shell side — six obligations

A contract with obligations on one side is a description. These are testable:

1. **`host` is appended to `document.body`, never inside `#app`.** `render()`
   replaces `#app`'s `innerHTML` wholesale (`index.html:1608`) and is called from
   the settings save path (`index.html:1835`) and the three re-rendering PIN
   outcomes (`:1913`, `:1917`, `:1918`) — none of which a game controls. A game mounted
   inside `#app` is destroyed mid-play. (§1.4.)
2. **The shell renders the way back, outside `host`, above it, before `mount` is
   called.** The back affordance is the shell's DOM, not the game's, so a game
   cannot cover, remove or fail to draw it. This is the property that keeps a
   child from being stranded — northstar §6's "needs an adult to get into or out
   of a game", and invariant 2's no-way-out concern. *(It is **not** invariant 5,
   which governs resuming play after a terminal state; §8.5 is where that
   applies. Mis-citation corrected after the adversarial pass, finding F18.)*
3. **`host` is its own stacking context** — `position:fixed; inset:0;
   isolation:isolate` — so a game's internal `z-index:9999` cannot escape it. But
   **the stacking context is not enough on its own**, because the shell's own
   surfaces sit well above the `z-index:80` the three panels use:

   | Shell surface | Line | `z-index` |
   |---|---|---|
   | `#portraitBlock` | `index.html:25` | 9999 |
   | remote-photo popup | `index.html:711` | 200 |
   | gallery viewer | `index.html:1050` | 200 |
   | `settingsOverlay` | `index.html:1801` | 100 |
   | `pinOverlay` | `index.html:1863` | 100 |
   | `#alertFlash` | `index.html:1672` | 90 |

   **And §1.5 establishes that two of these can fire while a game is open**: no
   realtime channel is ever left, so an incoming remote photo still calls
   `showRemotePhoto` (z-index 200) and a remote alert still calls
   `triggerAlertEffect` (z-index 90 — up to 4 seconds of full-screen red plus
   vibration, `index.html:131-146`). Both would paint over the game *and* over
   the back affordance obligation 2 exists to guarantee.

   **Requirement:** the games host and its chrome occupy a z-index band above
   every shell surface **except `#portraitBlock`**, which must stay on top — a
   rotated tablet is a real state and the rotate prompt is correct behaviour
   there. Assigning the band belongs to `PUP-WO-0200`. *(Found by the adversarial
   pass, finding F4. It is the finding I most regret missing: this document
   established both halves — the z-index of the overlays in §1.1 and the
   never-left channels in §1.5 — and never joined them.)*
4. **Exactly one close path — one shell function, two callers.** A single
   `endGameSession()` calls `teardown()` and removes `host`, and nothing else
   does. It has exactly two callers: the shell's back affordance, and
   `api.close()` (§8.3), which is a *request* that delegates to it rather than a
   second path of its own. §1.3 is what a genuinely second close path costs.
5. **`mount` is called inside `try`/`catch` — and so is `teardown`.** On a throw
   from `mount`, the shell runs `endGameSession()` and returns to the picker. On a
   throw from `teardown`, **`host` is still removed**: the removal belongs in a
   `finally`, never on the line after the call. A teardown that throws before the
   host is removed strands the child behind a full-bleed overlay — §1.6
   reproduced by the very contract written to prevent it. *(Teardown safety added
   after the adversarial pass, finding F9, which also caught that §8.4's own Gyre
   sketch ended `teardown` with a `localStorage` write that can throw.)*

   **`openTreasureMap` is the worked example of what obligations 2 and 5 exist to
   prevent** — it appends its overlay at `index.html:1361`, throws at `:1368`
   when the Leaflet CDN is unreachable, and never reaches the CLOSE wiring at
   `:1550`, leaving a full-screen overlay with no exit (§1.6).
6. **`teardown()` completes before any other game mounts.** No two games are ever
   live at once.

### 8.3 The `api` surface

| Member | Signature | Contract |
|---|---|---|
| `api.entry` | frozen registry entry | **The module's own registry entry (§9.1), frozen.** This is the configuration channel: `api.entry.params` carries per-entry config, `api.entry.players` carries architecture §7 seam 4 into the game rather than stopping at the picker badge. |
| `api.close()` | `() => void` | Idempotent. **A request**: it delegates to the shell's single `endGameSession()` (§8.2 obligation 4), it is not a second close path. For a *game-initiated* exit only; §8.5 rules when a game may not use it. |
| `api.sound(name)` | `(string) => void` | Plays one of the twelve bank names (§4). Unknown names are a silent no-op and nothing ever throws — verified at `index.html:90` and `:60`/`:91`. **Fire-and-forget: there is no handle and no stop.** See §8.6 for what that rules out. |
| `api.vibrate(ms)` | `(number\|number[]) => void` | Wraps `navigator.vibrate`, no-op where unsupported. |
| `api.save(obj)` / `api.load()` | `(object) => void` / `() => object\|null` | Synchronous, `localStorage`-backed, namespaced by `api.entry.id`. **`save` never throws** — the shell wraps it, matching its own three `localStorage` sites (`index.html:156-164`, `:170-174`) — so a quota-exhausted or private-mode device degrades silently rather than breaking `teardown`. **`load()` may return `null` and the game must run correctly when it does**: this is preference state, never identity, never required (northstar §5, invariant 3). |
| `api.prefersReducedMotion` | `boolean` | Sampled at mount. |

**`api.entry` is the fix for a hole this document shipped in draft.** Without it,
§9.3's ruling that Block Pop's two board sizes "ship as two registry entries, each
passing its own mode" was unimplementable — `mount(host, api)` had no config
parameter and `api` had no view of the registry, so the two entries would have
required two module files, breaking §9.5's "one entry" claim for the second of the
two games this contract was built around. It also stranded seam 4: a module could
never read `players`. *(Found by the adversarial pass, finding F1 — the most
serious defect it found, and one invisible from Gyre and Block Pop specifically,
because neither game as it exists needs configuration.)*

**What `api` does not contain, and how strong each absence actually is.** The
distinction matters, and an earlier draft overstated it:

- **No `AudioContext` — and this one is real.** The shell has exactly one, lazily
  created and never closed (`index.html:53-58`). Gyre needs none. Block Pop's
  `audio.ts` builds its own at `audio.ts:13-24` and **nothing in that workspace
  ever calls `ctx.close()`**. Handing a game a context is handing it a leak. The
  cost of withholding it is stated plainly in §8.6.
- **No `fetch`, no network, no Supabase — but this is a convention, not
  enforcement.** A `<script type="module">` has ambient access to `window.fetch`,
  `XMLHttpRequest`, `<img src>`, and every one of the 127 shell globals §3.2
  inventories. Omitting `fetch` from `api` is *exactly* asking a game not to use
  it. **What can actually enforce it is a CI check that can go red** — the
  mechanism architecture §5 already prefers over judgement: `PUP-WO-0100` greps
  `games/*.js` for `fetch(`, `XMLHttpRequest`, `import(`, `EventSource` and
  `new WebSocket` and fails the build. Invariant 3 and architecture §5's
  "strictly offline" rest on that check, not on the shape of this object.
  *(Corrected after the adversarial pass, finding F8, which was right that the
  draft gave this the same standing as §8.1's returned-closure argument. That one
  is structural; this one is not.)*
- **No DOM access outside `host`** — same status: a convention the module can
  violate, backed by the same CI grep and by obligation 3's stacking context,
  which does structurally prevent the case that matters (painting over the way
  back).

### 8.4 Demonstration — both games against the same contract (WO §3.5)

The contract constrains **lifetime**, not **structure**. It says *give back the
means to stop everything you started*, and says nothing about loops, boards or
turns. That is why the two games fit, and the demonstration is only convincing if
it is made against the two games' real, measured differences.

**Gyre — a continuous `requestAnimationFrame` loop.**

```js
export default function mount(host, api) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);

  const settings = loadSettings(api.load());        // api.load() may be null
  const sim = new GyreSim(canvas, () => settings);  // ports 1:1 from sim.ts:48
  sim.start();                                      // rAF starts at sim.ts:69

  const ro = new ResizeObserver(() => sim.resize());
  ro.observe(host);
  const onMove   = e => sim.setPointer(e.clientX, e.clientY);
  const onUp     = () => sim.setHeld(false);
  const onHidden = () => document.hidden ? sim.stop() : sim.start();
  window.addEventListener('pointermove', onMove, {passive:true});
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  document.addEventListener('visibilitychange', onHidden);

  host.appendChild(buildSliders(settings, api));    // writes `settings`, api.sound('keyTap')

  return function teardown() {
    api.save(settings);                             // first, and api.save never throws (§8.3)
    sim.stop();                                     // cancelAnimationFrame, sim.ts:74
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.removeEventListener('visibilitychange', onHidden);
    canvas.releasePointerCapture?.(heldPointerId);  // particle-canvas.tsx:76 never does
  };
}
```

Every handle — `sim`, `ro`, and the four listener references — is a `const` in
`mount`'s scope, closed over by `teardown`. The sweep of the source enumerated **nineteen** distinct
resources that leak if `field-app.tsx` is naively replaced by a function that
appends a div: one rAF loop, six `Float32Array(5000)` buffers, one
`ResizeObserver`, five window/document listeners, two store subscriptions, one
`matchMedia` listener, two uncleaned timeouts, one that *is* cleaned
(`controls.tsx:67`, cleared at `:70`), and one unreleased pointer capture
(`particle-canvas.tsx:76`). **Every one is a handle created inside `mount` and
released in `teardown`** — the contract has a place for all nineteen and needs no
additional concept for any of them.
*(Count corrected after the adversarial pass, finding F15 — an earlier draft said
"sixteen", counting the sweep's table rows rather than the resources in them.)*

Two source facts the port must carry, both of which the contract accommodates
without amendment: `sim` reads its settings through a **thunk** called once per
frame (`sim.ts:181`), so slider changes take effect on the next frame with no
subscription and no re-render — hence `() => settings` above, and hence a stable
mutable object rather than the fresh 8-key literal the React version allocates 60
times a second (`particle-canvas.tsx:14-23`). And the pointer capture taken at
`particle-canvas.tsx:76` is never released in the source — `sim.ts` contains no
`setPointerCapture` at all; here `teardown` is the place that exists to do it.

**Block Pop — turn-based, event-driven, no loop at all.**

```js
export default function mount(host, api) {
  const mode = api.entry.params.mode;              // 'easy' -> BOARD_SIZE 6, types.ts:40
  let g = newGame(mode);                            // pure, from engine.ts
  const view = buildBoard(host, g);                 // DOM, no rAF

  const onTap = e => {
    const cell = hitTest(view, e);
    if (!cell) return;
    g = reduce(g, {playerId: 0, action: {type:'place', slot: view.held, cell}});
    api.sound(g.lastEvent === 'clear' ? 'twinkle' : 'tap');
    if (g.lastEvent === 'clear') api.vibrate(20);
    render(view, g);
    if (g.stuck) offerAnotherGo();                  // !anyTrayFits — stays inside host, §8.5
  };
  host.addEventListener('pointerdown', onTap);

  function offerAnotherGo() { /* one large paw button → g = newGame(mode); render(view, g); */ }

  return function teardown() {
    host.removeEventListener('pointerdown', onTap);
  };
}
```

**No `requestAnimationFrame`, no observer, one listener, and a nearly empty
`teardown` — and that is the demonstration.** The contract does not require a
loop; it requires that whatever was started can be stopped. A game that starts
almost nothing returns a teardown that does almost nothing, and the signature is
unchanged.

**Where the two genuinely diverge, and how the one contract absorbs it:**

| | Gyre | Block Pop |
|---|---|---|
| drives itself | yes — rAF, `sim.ts:69` | no — event-driven only |
| teardown body | 7 releases | 1 release |
| terminal state | none exists | **no tray piece fits** — `!anyTrayFits(...)`, `store.ts:244` |
| calls `api.close()` | never | **never** — see §8.5 |
| persisted state | slider settings, via `api.save` | nothing — `mode` comes from `api.entry.params` |
| configuration | none; one registry entry | **two** registry entries, one module file, differing only in `params.mode` (§9.3) |
| host-visible surface | canvas + sliders | board + tray |

Neither game calls `api.close()`. Both exit through the shell's back affordance,
which obligation 2 guarantees is always present.

**When `api.close()` may legally be called — stated precisely, because the draft
left it contradictory.** It may be called **only in direct response to a
deliberate child action that means "I am done"** — a game's own home or paw
button, drawn inside `host`. It may **never** be called automatically: not on a
terminal state (§8.5 forbids exactly that), not on a timer, not on an error, and
not on a "well done" screen the child did not ask for. **It is not the way out of
a game** — obligation 2's back affordance is, always — and no game should be
written to depend on it being pressed.

*(The draft said `api.close()` "exists for a future game with a genuine
self-ending flow" while §8.5 forbade a terminal state from calling it, which left
it with no legal caller and two builders free to differ. Corrected after the
adversarial pass, finding F6.)*

### 8.5 The one place the contract has to overrule the source

Block Pop's terminal state cannot port as-is, and this is a contract requirement
rather than a style note. In the source the terminal condition is `!anyTrayFits(...)` — *no piece in the
tray fits anywhere* (`store.ts:244`), which the UI labels "Board full". It sets
`screen:"over"` (`store.ts:263`), **nulls the resume save** (`store.ts:270`) so
the run cannot be recovered, blocks `undo()` (`store.ts:291`), and presents a
modal with a headline reading **"Nice try"** below 60 points (`GameOver.tsx:16`)
above **three buttons** — Play again, switch mode, Home (`GameOver.tsx:36-44`).

That is a fail state with a three-way decision. The three buttons *are* already
visually weighted in the source (`size="lg"` default, then `size="md"
variant="soft"`, then `variant="ghost"`), so the problem is not that they look
alike — it is that there are three of them at all, plus a failure framing, at a
moment when the only thing a three-year-old wants is to keep playing. Northstar
invariant 5 forbids reaching a state that ends play without a one-tap way back
**into** it; a three-way choice is not that one tap.
*(Weighting claim corrected after the adversarial pass, finding F14 — an earlier
draft called the three buttons "equally-weighted", which the source contradicts.)* Architecture §5 already rules the screen is "softened to a single 'play
again' affordance" — this findings document makes that concrete as a **contract
obligation**: a game's terminal state, if it has one, is a **single** affordance
inside `host` that resumes play, and it must **not** call `api.close()`. **Ending
a run must never eject the child to the picker** — the difference between that and
the legal use in §8.4 is who decided: the child pressing a home button is done;
the board filling up is not the child deciding anything.

### 8.6 What the contract deliberately does not do

Stated so the limits are known rather than discovered, and so §5's adversarial
pass has the real edges to attack:

- **No pause/resume hook.** `rAF` self-throttles when the page is hidden;
  `setInterval` and audio do not. Gyre's own `visibilitychange` handling lives
  inside `mount` above, which is where it belongs. If a third game needs
  host-level pause, `api` gains an `onHidden` registration — **an additive change
  that does not alter any existing module's signature**, which is the test of
  whether a contract can grow.
- **`mount` is synchronous.** A game needing to decode an asset before first paint
  renders a placeholder and swaps. An `async mount` was rejected specifically
  because awaiting it re-creates the window where the surface is up and the
  controls are not — the exact shape of the `openTreasureMap` trap (§1.6).
- **No inter-game communication, no shared state between games.** By intent.
- **The contract does not make a game good.** It constrains lifetime and exit. It
  says nothing about whether the game is operable by a non-reader — that is
  invariant 1's job, and it is enforced at the registry (§9), not here.

**Four limits found by the adversarial pass, recorded as rulings rather than left
to be discovered (findings F2 and F25):**

- **Sound is the console's twelve cues and nothing else, and that rules out a
  whole class of game.** `api.sound` is fire-and-forget: `doSound` returns
  nothing, takes no pitch, and each cue hard-stops itself via `o.stop(t + dur)`
  (`index.html:67`, `:74`) in under a second — so nothing can outlive `teardown`,
  and §8.1's release guarantee is satisfiable. **What is not expressible** is any
  game whose *core* is sound: a lullaby or aquarium needing sustained audio, or a
  xylophone needing eight pitches. Adding voices means editing the switch table at
  `index.html:76-89`, ~1,500 lines from the registry — **which is structurally the
  same defect §2 condemns in `attachEvents`, and it breaks §9.5's "nothing
  else."** This is the contract's sharpest edge. It is **flagged upward as a
  decision** rather than solved here, because the fix — a small `api.tone(hz, ms)`
  primitive over the existing `mk()`/`sw()` at `index.html:62-75`, or a per-game
  voice table in the registry entry — is an architecture §4 question, not a
  builder's.
- **No confirmation before discard.** `teardown` is synchronous, has no veto and
  no async form, and the back affordance gives the game no notice. A build-a-thing
  toy cannot ask "are you sure?". **For this audience that is deliberate** — a
  confirm dialog is a reading task and a second decision, which is the failure
  northstar invariant 1 and §8.5 both aim at. A game that would want it should
  save continuously instead.
- **No safe-area or chrome inset.** `host` is `inset:0`, the full viewport, with
  the shell's back affordance painted above it. Nothing tells the game where that
  chrome is, so a game can place a control under an unpressable region.
  `PUP-WO-0200` should pass the inset — as `api.entry` is now the channel for
  everything else the shell knows, an `api.safeArea` rectangle is the natural
  place.
- **No asset channel.** No `fetch`, and §9.2 rejects a per-game image. A game
  needing a sprite sheet, a sampled sound or a custom font is excluded by
  construction. **Note this reading is narrower than the invariant it claims:**
  northstar invariant 6 says a new game touches "its own module, one registry
  entry, and **the asset manifest**" — several assets in one manifest are not
  obviously forbidden, and §9.2's rejection of a thumbnail over-read it. What is
  genuinely bounded is the *cold-start* cost every asset adds (§6.2's network-first
  handler, northstar §6). A decision for whoever scopes P3/P4, not a closed door.

### 8.7 Verdict on architecture §7's four seams

Assessed against the measured sources, because two of the four cost more than §7
implies:

| Seam | Status |
|---|---|
| 1 — engine pure, no module-level singleton state | **Gyre: already true.** `sim.ts` has no module-level mutable state, only three consts. **Block Pop: not true.** `store.ts:156` is a module singleton `useGame` that survives unmount, and `store.ts:421-431` writes a `window.__blockPop` global. §8.1's returned-closure shape forces the fix rather than relying on the porter to notice. |
| 2 — trays as an array keyed by player | **Net new.** The source has no player concept whatsoever: zero occurrences of `player`/`players`/`playerId` in `src/lib/game/` or `src/components/game/`, one `board`, one `tray` of 3, one `score` (`store.ts:44-47`). §7 calls this "the cheapest seam to install" — cheap it may be, but it is **written, not preserved**, and P4's estimate must say so. |
| 3 — all board mutations through one reducer taking `{playerId, action}` | **Net new, and the largest of the four.** Five distinct actions write `board`: `place` (`store.ts:220`), `useHelper` (`:332`), `undo` (`:288`), `start` (`:194`) and `continueGame` (`:214`). Only `place` is reducer-shaped. Consolidating five write paths is real work, not a seam left open. |
| 4 — registry entries declare `players` | **Installed by §9**, at a cost of one integer per entry — *and readable by the game*, via `api.entry.players` (§8.3). Without that channel the seam would have stopped at a picker badge and not been a seam into the game at all; the draft had exactly that hole. |

**None of this contradicts §7's ruling** — the seams are still worth installing
now and still cheaper now than later. It corrects the *cost*: two of the four are
construction, not preservation, and `PUP-WO-0400`'s scope should be written
against that.

### 8.8 The control-panel seam — the fifth channel, documented after it shipped

> **On the citations in this subsection.** Every line number below is paired with the
> **symbol** it sits in, and the symbol is the anchor. `index.html` is a mutable file
> and roadmap §4a records 108 `index.html:NNNN` citations across `docs/` of which
> seven already land on blank lines — architecture §6.1 member 4 at scale. This
> section adds to that count and says so rather than pretending otherwise;
> `PUP-WO-0106`'s symbol-first form is the precedent, and it is followed here.

**This subsection is a correction to this document, not a new design.** §8.1 names
four channels between a module and the shell — `mount`, `host`, `api`, and the
returned `teardown` — and says nothing about a fifth. But `PUP-WO-0300` built one
and `PUP-WO-0301` rendered sixteen controls from it, so a fifth channel has been
live since `a145734` while the contract that is supposed to enumerate the surface
described four. **An undocumented contract surface is architecture §6.1 member 4 —
a pointer that resolves in the author's head and not in the reader's tree** — and
it is worse here than usual, because the next game to be ported has four assist
buttons and two board sizes and its work order cannot say where they go.

**The seam.** After `mount` returns, the shell reads `host[api.entry.id]` in
**`mountControlPanel`** (`index.html:1932`). For Gyre, whose registry id is `gyre`, that reads `host.gyre`.
**The property name is not a name the shell knows** — it is the mounting entry's
own registry id, so a second game publishing `host.blockpop` gets a control panel
with no edit to the shell at all. That generality is why the name stays: a fixed
key like `host.controls` would be *less* general, not more, because two entries
sharing one module (§9.3's 6×6 and 8×8) would then share one seam name while
already having distinct ids.

**Publishing is optional and failing to publish is not an error.** The shell
requires an object carrying `get`, `set` and a non-empty `controls`; anything else
— absent, wrong type, throwing getter — yields **no panel and no error** —
four guards at the top of **`mountControlPanel`**, each returning `null`
(`index.html:1933-1936`). `games/hello.js` is the live proof of that
path. **A game that wants no control surface does nothing.**

| Member | Shape | Contract |
|---|---|---|
| `get()` | `() => object` | Returns the current values, keyed by control key. Called after every write and on every repaint. **May throw**; the shell falls back to the last known values. |
| `set(key, value)` | `(string, any) => void` | Writes one value. **May throw**; the shell swallows it and repaints. The module is responsible for clamping — `games/gyre.js` does it at the setter, and `clampNum`'s comment there records why every clamp must take its fallback from the caller. |
| `controls` | array of descriptors | The declarative manifest. Order is render order. Empty or absent means no panel. |
| `ranges` | `{[key]: [lo, hi, step?]}` | **Slider bounds live here and only here** — a range specified twice is `PUP-WO-0300` §9's first warning. A slider whose key has no valid range is skipped, not rendered broken. |

**Three descriptor kinds, and the vocabulary is closed** (the `desc.kind` dispatch in **`mountControlPanel`**, `index.html:2266-2268`):

- **`slider`** — `{kind, key, icon, label?}`, bounds from `ranges[key]`. The whole
  50px bar is the target, not a thumb: a three-year-old's aim is not an adult's.
- **`choice`** — `{kind, key, icon?, label?, single?, options:[{id, icon|hex}]}`,
  **or `from:'<property>'`** naming a property on the seam that holds the options
  instead of inlining them (**`buildChoice`**, `index.html:2138-2140`). Fewer than two options and the
  control is skipped. **`single:true` renders ONE cycle button that flips**, which
  is `PUP-WO-0301` §2.2's ruling that attract/repel is one two-state affordance —
  "a row of two would make the child choose between two things he cannot read";
  otherwise one button per option. Whether the row renders as swatches is decided
  by **`options[0].hex` alone, for the whole set** (**`buildChoice`**'s `isSwatch`,
  `index.html:2143`), and a swatch row spans
  the grid. **A hex swatch IS the colour it selects** — invariant 1 with no text.

  **`hex` is validated, and dropping that validation is a flag-and-stop.** It is
  concatenated into an inline `style`, so an unvalidated `"red;position:fixed;
  inset:0;z-index:2147483647"` builds a button covering the entire screen and every
  other control (**`buildChoice`**'s option loop, `index.html:2182-2196`).

  **The picker learned this exact lesson first**, on the registry's `color`, and
  `PUP-WO-0301` **reused its validator rather than writing a second one**:
  `GAMES_HEX_RE` (declared `index.html:2370`) is the single constant the picker
  tests `color` and `glow` against (`index.html:2395-2396`) and the panel tests
  `hex` against. **One typo surface, one validator.** It fails closed twice over —
  a hex that does not match falls back to the neutral gradient
  (`index.html:2188`), and a swatch whose hex does not match is dropped entirely
  (`index.html:2196`).
- **`action`** — `{kind, method, icon, label?, prominent?}`. `method` is a method
  name on the seam; the shell calls it and knows nothing else. `prominent` lifts it
  into the bar above the drawer.

`label` is used for `aria-label` **only**. Nothing in this layer paints a word — a
screen reader is a different audience from a non-reader and costs nothing.

**Two geometric rules the panel must not break, both independent of viewport**,
because the version that broke them shipped a child-trapping defect that every
check passed (§6.1 member 6, and the reason gate 1 is split):

1. **The left gutter is the exit's column.** `#gameBack` owns x 10–74 at every
   height and every scroll position, so the bar and the drawer both inset by
   `max(84px, calc(env(safe-area-inset-left) + 74px))`. Capping the drawer's
   *height* below the exit's band was the first fix and it held only until the
   drawer was scrolled, at which point its top rows slid back under the exit. **A
   column rule is one no scroll can defeat.**
2. **Nothing animates between shown and hidden.** `PUP-WO-0301` §3.6 forbids any
   state where getting out takes more than one tap, "including mid-drag,
   mid-animation". The cheapest way to hold that for a mid-animation state is not
   to have one.

**THE DRAWER'S BAND IS DEAD TO THE GAME, AND THAT IS WHAT DECIDES THE ASSISTS
QUESTION.** The panel root is `pointer-events:none` at `PANEL_Z = GAMES_Z + 1`
(`index.html:2042`, `:2180` — 501 against the host's 500), but **the drawer itself is
`pointer-events:auto`** and bottom-anchored. So anything a game paints in the bottom
band is not merely occluded: **`document.elementFromPoint` returns the drawer, and a
drop there never reaches the game at all.** And the drawer **ships open**.

**THE CEILING IS THE THING TO DESIGN AGAINST, AND IT IS A CONSTANT.** The band is
`min(contentHeight, 78vh)` — content-bound today, ceiling-bound eventually — so **78%
of screen height is a stable worst case no future control can exceed**, while today's
measured values sit at 59-71% and rise. *(CC-B's refinement, and it is the right one:
it converts a moving quantity into a fixed one without pretending the movement is not
real. The band grows until it saturates; 78vh is where it stops.)* **On the actual
fleet — three phones at ~412px tall, architecture §3 — that ceiling is 321px, leaving
91px of height outside it.**

**AND CI CANNOT SEE THE GROWTH.** Check 19 *measures* the drawer's coverage of the
field (`demo-controls.mjs:1048`) and **prints it in the `ok` line without asserting
anything about it** — CC-B found this in their own check. So the band can grow control
by control with nothing going red. Whichever work order next touches the panel should
assert it at the smallest supported viewport, and assert **separately** that content
does not exceed 78vh there, because that is the moment **scrolling becomes mandatory
rather than optional — and a non-reader is unlikely to discover a pan.**

**The band's size is CONTENT-BOUND, not capped, and that is the part to design
against.** The only declaration is `max-height:78vh` (`index.html:2296`) — at 480px
tall that is 374px, or **78% of the screen**. *(There is no `calc(100vh - 140px)` cap:
`100vh` does not occur anywhere in `index.html`. An earlier version did cap the
drawer's height below the exit's band, and `index.html:2290-2295` records that it was
**removed** — it "worked only until the drawer was scrolled, at which point its top
rows slid up under the exit again", and the left-gutter column rule replaced it
precisely because it "lets the drawer keep its full height".)* Measured drawer heights
below 78vh therefore mean the **content** is binding, and content is a function of how
many controls the module publishes — **so a game that adds a control grows the dead
band underneath it.** A layout that fits today can stop fitting because a slider was
added, with no layout change and nothing going red.

**RULING — THE DRAWER'S DEFAULT OPEN STATE MOVES TO THE SEAM, AND THE SHELL'S
FALLBACK FLIPS TO CLOSED.** *(CC-A, 2026-09-02. CC-B raised it and correctly declined
to assume it.)* Today `index.html:2584` is `var drawerOpen = true` — **hard-coded open
for every game that publishes a seam.** On the fleet that means every such game starts
with **78% of its field covered and 91px left**, measured at all three viewports and
corroborated here from geometry alone.

- **The module publishes `controlsOpen`, not the registry.** The seam is already an
  arbitrary object the module owns, so this needs **no registry field, no manifest
  change, and no addition to `registryEntryIsValid`** — which validates six of nine
  fields today and would have silently ignored a new one anyway.
- **The shell's fallback is CLOSED**, because *open* is right for exactly one game and
  wrong for every game whose subject is the field rather than the controls. **Gyre
  publishes `controlsOpen: true` explicitly in the same change** — Scotty's ruling that
  for Gyre "the controls are the toy" is the reason, and the game that depends on it
  should say so rather than inherit it by accident.
- **This is a deliberate behaviour change to merged work**, not an additive one, and it
  is recorded as such. The additive form — absent means open — was considered and
  rejected: it preserves today's bytes at the cost of making *every future game* opt
  out of a default that is wrong for it, which is the shape that produces a defect
  nobody chose.
- **A closed drawer is still reachable** — the handle is unaffected, and §8.2
  obligation 2's exit is outside `host` and untouched either way.

**HOW TO BUILD IT, BECAUSE THE ONE-CHARACTER VERSION IS THE REGRESSION.** *(CC-B
raised the precedence; CC-A verified it and found the count wrong.)* There is a
persisted layer the ruling above did not account for. `index.html:2597` defines
`OPEN_KEY = 'pupctl:' + entry.id + ':open'` — **per entry, verified, so there is no
cross-game bleed, and `blocks`/`blocks-big` get separate keys even though they share
one module URL.** The precedence must be:

| stored `'0'` or `'1'` | **the child's choice wins** |
| absent | `seam.controlsOpen === true`, else **closed** |

**This is the layering `games/gyre.js:956` already states one level down — "defaults <
entry params < what the child saved" — so cite it there rather than inventing it
twice.** The naive flip of `!== '0'` to `=== '1'` makes *absent* mean closed for every
game, **silently discarding `controlsOpen` and handing Gyre a closed drawer on a fresh
install** — the exact regression this ruling exists to prevent, arriving through the
one-character change that looks like the ruling.

**AND THERE ARE THREE `true`s, NOT ONE — BUT ONLY TWO ARE LIVE, AND THE CHANGE ITSELF
PROMOTES THE THIRD.** The initializer `var startOpen = true` (`index.html:2610`), the
comparison `!== '0'` (`:2611`), and **`:2611`'s own `catch`, which also sets `true`**.

*(CC-B's refinement, verified: the initializer is **shadowed today** — the `try`
assigns or the `catch` assigns, so its value is never observed. **It becomes
observable the moment the `try` body gains a fall-through branch, which is exactly
what "absent → `seam.controlsOpen`" introduces.** State it that way in the work order,
because **"it is dead code" is the argument someone will use for leaving it**, and it
is true right up until this change lands.)*

**The live one that matters is the `catch`**: a `localStorage` throw — private mode,
storage disabled, quota — opens the drawer regardless of what the seam said, **on the
one device class nobody tests**. A green suite on every normal machine says nothing
about it. *Same shape as the sticker agreeing at exactly 600px.* **All three resolve
to the seam's answer, or two of them disagree with the ruling in silence.**

**`controlsOpen` IS MODULE-SUPPLIED AND THEREFORE UNTRUSTED, exactly as the seam is.**
`mountControlPanel`'s four guards already tolerate an absent seam, a wrong type and a
throwing getter and return `null` for each; reading `controlsOpen` gets the same
discipline — **absent is not an error, a getter that throws must not take the panel
down with it, and the test is `=== true` rather than truthiness**, so a module
returning a string or a number does not accidentally opt in.

**AND THE SPLIT MATTERS, BECAUSE THE FIRST SENTENCE INVITES THE SECOND.** *"The flip
fixed the fleet"* is **true** — measured closed at 869x412: drawer `display:none`, 0%
coverage, the full 412 of field, **off-screen controls 8 → 0**, and the dice back
on-screen at 84,314. *"The flip fixed Gyre"* is **false**: Gyre opts in, so it still
carries the 321px band, the 406-in-319 mandatory pan, and the dice at y=-7.
**`PUP-WO-0111` still owns the entire open-state problem.**

**AND THE OPEN-DRAWER FIELD IS 91px, WHICH IS A DIFFERENT ANSWER FOR A BACKGROUND THAN
FOR A BOARD.** Gyre survives an open drawer because a particle field still reads as a
particle field in 91px. **A board game does not.** Even with the assists in the drawer,
Block Pop's board has to fit the open-drawer height or the child must close the drawer
to play — **which makes the drawer a mode rather than a panel**, and that is the thing
this ruling exists to prevent.

**What this means for `PUP-WO-0400`.** Block Pop's four assists (Undo, Hint, Help,
Mix) are `action` descriptors and its board size is `api.entry.params`, **not** a
`choice` — a control that changes the board mid-run is a different game, and §9.3
already ruled the two sizes ship as two registry entries. Whether the assists go
through this seam or the game's own DOM is a ruling that work order must make
explicitly, and it now has a documented surface to make it against.

---

---

## 9. The registry entry shape

### 9.1 The shape

One array in the shell, one entry per **tile**, **nine required fields and no
optional ones**:

```js
var GAMES = [
  {
    id:      'gyre',              // string /^[a-z][a-z0-9-]*$/, UNIQUE across the array.
    module:  './games/gyre.js',   // string, must match /^\.\/games\/[a-z0-9-]+\.js$/.
    label:   'Swirls',            // string, 1..12 chars. A word — never the only signal.
    icon:    '\u2728',            // string, ONE emoji cluster. No markup. Primary signal.
    color:   '#8B5CF6',           // string /^#[0-9a-fA-F]{6}$/. Tile background — second signal.
    glow:    '#A78BFA',           // string /^#[0-9a-fA-F]{6}$/. Accent.
    sound:   'powerUp',           // string, one of the twelve bank names (§4).
    players: 1,                   // integer >= 1. architecture §7 seam 4.
    params:  {}                   // object. Per-entry config, handed to the module. {} if none.
  },
  { id:'blocks', module:'./games/blockpop.js', label:'Blocks', icon:'\uD83E\uDDE9',
    color:'#10B981', glow:'#34D399', sound:'chime', players:1, params:{mode:'easy'} },
  { id:'blocks-big', module:'./games/blockpop.js', label:'Big Blocks', icon:'\uD83D\uDD37',
    color:'#0EA5E9', glow:'#38BDF8', sound:'chime', players:2, params:{mode:'classic'} }
];
```

**`id` is unique per entry; `module` is a path, and two entries may share one
module.** That is how Block Pop's two board sizes ship (§9.3) without a second
module file. An earlier draft required `id` to equal the module basename, which
made §9.3 unimplementable — see §8.3.

**`params` is required and may be `{}`.** Making it required rather than optional
keeps the no-optional-fields property while giving the module a configuration
channel it reads through `api.entry.params` (§8.3).

`color`, `glow`, `label` and `sound` are deliberately the same field names and
value shapes as the existing button records at `index.html:95-106`, so
`btnHTML` (`index.html:1585-1592`) is the working reference for how a tile
renders. **Two differences, stated because "same vocabulary" was overclaimed in
draft:** the button records name their glyph `emoji`, not `icon`, and store it as
an escaped surrogate pair; and they carry two fields a tile has no use for, `bg`
and `msg`. *(Corrected after the adversarial pass, finding F22.)*

### 9.2 Why every field is required — and what that does and does not buy

**Requiredness buys presence. It does not buy recognisability, and the draft
claimed otherwise.** The honest version:

- **What CI can assert** (`PUP-WO-0100`): every field present; `id` unique and
  matching its pattern; `module` matching `^\./games/[a-z0-9-]+\.js$` **and
  present in `sw.js`'s `urlsToCache`**; `label` 1–12 characters; `color` and
  `glow` valid six-digit hex; `icon` a single emoji grapheme cluster; `sound` a
  member of the twelve-name bank; `players` an integer ≥ 1; `params` an object.
  Also: **no two entries sharing the same `icon`**, and no two sharing the same
  `color`.
- **What CI cannot assert**, and no schema can: that `🎮` and `🕹️` are
  *distinguishable* to a three-year-old, or that a chosen colour has usable
  contrast against the picker's ground. Those stay a human judgement at review.

So the correct claim is narrower than the draft's: requiredness plus the
validators above **remove the silent-failure modes** — a missing icon, a
malformed colour, a sound that does not exist — and leave recognisability where it
has to live, with the person adding the game. *(Rewritten after the adversarial
pass, finding F10, which was right that the draft relocated the failure to a CI
check that cannot see the property that matters.)*

**Two failure modes that motivated the specific validators above:**

1. **A present-but-invalid `sound` is a silent tile.** `doSound` no-ops on unknown
   names (`index.html:90`) — which §4 records as a *feature* for the module
   contract, and which here means a mistyped `sound` gives a tile that taps
   silently while CI passes. Hence the bank-membership check.
2. **`icon` is emoji-only, and that is a security requirement, not a style
   choice.** `btnHTML` interpolates its record's fields **unescaped** into markup
   and a `style` attribute (`index.html:1587-1591`), and the picker will do the
   same. An earlier draft permitted "inline SVG markup" in `icon`, which makes it
   an `innerHTML` sink and makes it un-validatable by pattern. A game wanting a
   custom mark ships it as a named glyph in the shell's own SVG helpers alongside
   `pawSVG` (`index.html:41-43`). The same reasoning forces the hex pattern on
   `color`/`glow`: a malformed colour silently destroys the tile's CSS with
   nothing red.

**`players` is an integer, not a `multiplayer` boolean**, so architecture §7 seam
4's two-player badge is a comparison rather than a schema change — and, with
`api.entry` (§8.3), a value the game itself can read.

**Deliberately not fields:**

| Rejected | Reason |
|---|---|
| `description` | Nobody in the audience reads. Invariant 1. |
| `order`, `sortKey` | Array order is the order. |
| `enabled`, `hidden` | A game that should not ship is not in the array. A boolean invites a picker branch. |
| `thumbnail` / image path | A second asset per game. See §8.6's last bullet — this rejection is about cold-start cost, and it over-read invariant 6 in draft; it is a defensible default, not a closed door. |
| `minAge`, `tags`, `category` | Configurability, which northstar §5 names as how invariant 1 dies. |

### 9.3 Board sizes are two entries against one module

Block Pop's `easy` (6×6) and `classic` (8×8) are one `Mode` in the source
(`types.ts:39-42`), and mode also drives helper count, shuffle count, which shapes
appear, and the easy-only mercy rule at `engine.ts:174`. **They ship as two
registry entries pointing at the same `games/blockpop.js`**, differing only in
`params.mode` (and in `label`, `icon`, `color`, `players`), because the picker must
stay ignorant of any game's internals (architecture §4). It also makes architecture
§10's open question — whether `classic` appears in Buddy's picker at all — a
one-entry deletion rather than a code change.

### 9.4 What the picker must do, stated as requirements

| Case | Required behaviour |
|---|---|
| Missing/empty `icon` or `color` | **Cannot occur** — required and pattern-validated (§9.2). A malformed entry is a red build, not a runtime fallback. |
| Over-long `label` | Cannot occur — CI asserts 1–12 characters. The tile also clamps to one line; icon and colour are unaffected, so recognisability is not a function of label length. *(The 12 is a judgement against the existing 10px rail labels at `index.html:1590`, not a measurement — it should be checked on the real tablet during P2.)* |
| Twelve entries | The picker is a **scrolling grid**. The rails' fixed four-per-side layout — four records each in `BTNS_LEFT`/`BTNS_RIGHT` (`index.html:95-106`), laid out by two `space-evenly` columns (`:1629`, `:1665`) — must **not** be copied into the picker. That assumption is what would make the seventh game a layout change. |
| One entry | Renders one tile. No empty-state copy, no "more coming soon". |
| Zero entries | Renders an empty grid and does not throw. Nothing in the spec makes this unreachable — the games button always exists (architecture §5) — so it is a required behaviour, not a should-not-happen. |
| **Duplicate `id`** | **Cannot occur** — CI asserts uniqueness. It must, because `api.save` is namespaced by `id` (§8.3): two entries sharing an `id` would silently share one save store. |
| **`module` not matching `./games/<name>.js`** | **Cannot occur** — CI asserts the pattern. This is what stops a `../` or an `https://` module path, either of which would make the dynamic `import()` a third-party network call (invariant 3, northstar §5) and would not be in `urlsToCache`. |
| **`module` not listed in `urlsToCache`** | **Cannot occur** — CI asserts it, in both directions (§6.1). This is the check that makes invariant 6's manifest line real rather than remembered. |
| **`sound` not in the bank** | **Cannot occur** — CI asserts membership. Otherwise a silent tile that CI passes. |
| **`players` of `0`, `2.5`, or `"two"`** | **Cannot occur** — CI asserts integer ≥ 1. Without it, `players > 1` badges a 2.5-player game and is silently false for `"two"`. |
| **`icon` containing markup** | **Cannot occur** — emoji-only, pattern-validated (§9.2). |
| `module` fails to load at tap | The picker **stays up**, the tile plays `error` from the bank and returns to its resting state — **not** a blank surface and not a silent no-op. A tile that does nothing when tapped is indistinguishable from a broken tablet to a non-reader, which is invariant 1's failure mode. Note the wait can be long: `import()` failure is asynchronous and `sw.js` is network-first (§6.2), so on a flaky connection the tap does nothing for a full fetch timeout. **The tile must show it is working within ~300ms** — a pressed state or a spinner — or the child taps it again. |

*(The six "cannot occur" rows and the load-failure requirement were added after the
adversarial pass, finding F11. The draft considered none of them, and answered the
load failure with "the child taps something else".)*

### 9.5 Invariant 6, tested against this shape

The invariant's own falsification test is "add a trivial game; count files changed
outside those three". Under §8 and §9:

| File | Change |
|---|---|
| `games/<name>.js` | new file — the game |
| `index.html` | **one entry** appended to the `GAMES` array |
| `sw.js` | **one line** in `urlsToCache` (§6.1), plus the `CACHE_NAME` bump the repo already does on every asset change |

**Nothing else.** No picker edit — it renders whatever the array holds. No
dispatch edit — the picker's tap handler reads `entry.module` and dynamic-imports
it, so there is no `if (id === …)` chain to extend. **This is the specific
improvement over the console's existing `attachEvents` chain (§2), where adding a
ninth button today requires editing a branch ~1,580 lines from the data it
branches on.**

**A second *variant* of an existing game is cheaper still: one entry, no new
file, no manifest line** — that is what `params` buys, and it is how Block Pop's
two board sizes ship (§9.3). The draft could not express this at all: without a
parameter channel the second board size needed a second module file, so the table
above was false for the second of the two games this contract was built around.

**Invariant 6 holds under this contract**, with two honest caveats:

1. It holds for the *games* surface. The rail buttons stay on the old id-chain
   until `PUP-WO-0200` converts them, so the invariant is satisfied for what this
   phase builds, not yet for the console as a whole.
2. It holds **only for games the twelve-cue sound bank can serve.** A game needing
   a voice the bank lacks requires an edit to `index.html:76-89` — a fourth file
   change, and the "nothing else" above becomes false. §8.6 states this as the
   contract's sharpest edge and flags it upward.

---

## 10. Contradictions found against `docs/architecture.md`

**The list is not empty.** One hard contradiction against §3, one confirmed-but-
understated §3.1 finding, one material error outside §3, and three staleness
items that are not contradictions and are marked as such.

### 10.1 §3 "Cached assets" — CONTRADICTED

> **Architecture §3 states:** *"`sw.js:2-8` — `urlsToCache` lists five entries;
> **anything not listed is not cached and will not work offline.**"*

**The second clause is false.** `sw.js:31-43`'s fetch handler clones every
successful response and writes it into the same cache unconditionally
(`sw.js:34-37`). Anything fetched once while online **is** cached and **does**
work offline. `urlsToCache` is the **cold-install precache set**, not the boundary
of the cache's contents.

**Why it is load-bearing, not pedantic.** Three later decisions rest on the wrong
version:

1. It makes the CDN dependencies at `index.html:11-13` and the OSM tiles at
   `index.html:1373` look permanently uncacheable when they are in fact cached
   after first use — which changes what "works offline" means for the Map panel
   today.
2. It therefore changes the **severity** of architecture §6's cross-path reap
   hazard: the reap does not only cost the precached five, it evicts the runtime-
   cached Leaflet bundle, and a Leaflet-less Map button reproduces the
   un-closable overlay of §1.6 rather than degrading. (Severity note for
   `PUP-WO-0101`; the diagnosis and the fix are CC-A's and are not disputed.)
3. It hides the property that actually threatens the cold-start budget:
   **the handler is network-first** (`sw.js:33`, cache consulted only in
   `.catch()` at `:39`), so a cached asset is still waited on when the network is
   slow. With games loading on demand (architecture §5), this lands squarely on
   P2's cold-start gate.

**Recommended amendment to §3's "Cached assets" row:** *"`sw.js:2-8` lists five
entries precached at install. The fetch handler (`sw.js:31-43`) is network-first
and additionally caches every successful response at runtime, so the cache's
contents are a superset of this list. Only the listed five are guaranteed present
after a cold install."*

### 10.2 §3.1 lock/PIN row — CONFIRMED, and understated

Re-verified independently per WO §5's last probe, without relying on the
architecture's assertion. Both of its claims hold: the PIN is memory-only and lost
on reload, and it gates no content. §5 above records the derivation.

Two additions that strengthen the ruling rather than change it: the unlock path
**dismisses the overlay before comparing the PIN** (`index.html:1901` closes,
`:1915-1918` then compares), so a wrong entry is rejected but never re-prompted —
there is no retry, no lockout and no rate limit; and the Settings button stays
live while locked (`index.html:1736-1737`), one tap from a plain-text input
containing the Supabase anon key (`index.html:1818`).

**Recommended amendment:** append to the §3.1 row — *"and the unlock path
dismisses the dialog before comparing (`index.html:1901`), so a wrong PIN is
rejected but never re-prompted — no retry, no lockout, no rate limit. Nor does the
locked state gate the settings panel, which displays the Supabase key in cleartext
(`index.html:1818`)."*

> **Correction.** An earlier draft of this section claimed the unlock check
> "cannot reject" a wrong PIN, and proposed amending architecture §3.1 with that
> sentence. **It is false** — `index.html:1918` leaves `isLocked` true and
> `storedPin` intact. Caught by the adversarial pass (§5 of `FEEDBACK.md`,
> finding F3), which is the single most valuable thing that pass produced: the
> claim was on its way into a ratified document.

### 10.3 §2 "no dependencies" — FALSE, and it touches a northstar non-goal

Outside §3, so outside WO §1.6's literal scope, but reported because it is
material and because §2 is cited by later work orders.

> **Architecture §2 states:** *"No build step, no package manager, no framework,
> no dependencies."*

The first three are true. **The fourth is false.** `index.html` loads two
third-party runtime dependencies from CDNs in its `<head>`, unconditionally, on
every page load:

- `index.html:11` — `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/…`
- `index.html:12` — `https://cdnjs.cloudflare.com/…/leaflet.min.css`
- `index.html:13` — `https://cdnjs.cloudflare.com/…/leaflet.min.js`

and a fourth third-party origin is contacted whenever the Map panel opens:

- `index.html:1373` — `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

**Three consequences, in ascending order of seriousness:**

1. **Accuracy.** §2 is a document later work orders cite for what PupPad *is*. Two
   unpinned-by-integrity CDN scripts is a different security and offline posture
   from "no dependencies", and architecture §5's port-to-vanilla ruling reads
   differently if the shell already carries a React-sized third-party bundle.
2. **Invariant 3.** The Map button's failure mode when Leaflet is unavailable is
   not a degraded map — it is the un-closable overlay of §1.6. Runtime caching
   (§10.1) masks this after the first successful online load, which makes it a
   *latent* failure that appears only after a cache reap.
3. **Northstar §5 non-goal.** *"Advertising, analytics, or any third-party network
   call. Not a preference. A third-party call from a child's app is a category of
   thing this project will not contain."* PupPad makes three unconditional
   third-party calls on every cold load and a fourth per map tile. The non-goal is
   plainly aimed at trackers rather than at a tile server, but **as written the
   shipped code contradicts it**, and a non-goal that the code already violates
   will not stop the next proposal.

**This is a ruling for Scotty, not a builder's call, and not a fix for this WO** —
`index.html` is a protected surface. The options, stated neutrally: self-host
Leaflet and drop Supabase's UMD bundle (costs three `urlsToCache` lines, buys
invariant 3 outright); or narrow northstar §5's wording to name what it actually
forbids (tracking, ads, telemetry, data about Buddy) and let §2 record the two
CDN dependencies honestly. **The games surface is unaffected either way** —
architecture §5 already rules games strictly offline, and §8.3's `api` makes that
structural.

### 10.4 Verified correct — no contradiction

Recorded because a check that passed is evidence too:

| §3 claim | Verified |
|---|---|
| `index.html` is 1,942 lines; `sw.js` is 43 | exact |
| Repo is 5 files + no `.github/`, no tests | exact (`.github/` confirmed absent) |
| `sw.js:1` — `var CACHE_NAME = 'pup-pad-v16'` | exact |
| Pages: `build_type: legacy`, `source: {branch: main, path: /}`, `https_enforced: true` | exact — re-queried this session |
| §3.1 — no CI exists, so a merge to `main` is a deploy | confirmed: no workflow anywhere in the tree |
| §2 — three of eight buttons open a panel (Map/Draw/Camera) | confirmed (§1.1) |
| §2 — `index.html:1680-1699` is a hardcoded `if (btn.id === …)` chain | confirmed (§2) |
| §5 rules that Power's `powerUp` sound is reassigned to games-open, "the best in the bank and outlives the button" | **ruling confirmed as costless** — `powerUp` occurs at exactly two lines, its definition `index.html:84` and the Power record `:105`, so reassigning it orphans nothing (§4). *The reachability finding is this document's, not a claim of architecture §5.* |
| §5 — Block Pop ships both `easy` 6×6 and `classic` 8×8, already a `Mode` with sizes mapped | confirmed at `types.ts:39-42` |

### 10.5 Staleness, not contradiction

Marked separately so they are not counted as findings:

- §3 says *"No `.github/`, no tests, **no docs**"*. `docs/` now exists — created
  the same day, by the commits that produced the architecture itself. The row is
  timestamped and was true when measured.
- §3 records Claude Code `2.1.251`; the box now reports `2.1.252`. Above the
  stated floor either way.
- **§6's** `sw.js:19-27` citation for the activate handler (at
  `architecture.md:160`) is two lines short — the handler spans `sw.js:19-29`.
  §6.3 above cites it correctly. *(An earlier draft attributed this citation to
  architecture §3, which contains no such citation — corrected after the
  adversarial pass, finding F18.)*

---

## 11. What a later work order can now cite

| Question | Answer |
|---|---|
| Exact function signature a game module exports | §8.1 — `export default function mount(host, api) → teardown` |
| Exact registry entry fields | §9.1 — **nine** required, none optional |
| How a game is configured | §8.3 — `api.entry.params`, from its own registry entry |
| What CI must assert about the registry | §9.2, §9.4 — twelve checks, each closing a silent failure |
| The contract's known limits | §8.6 — sound is the sharpest, and needs a ruling |
| Disposition of both Grok workspaces | §7.2, §7.3 — 22 files wanted of 487 |
| Contradictions against architecture §3 | §10 — **not empty**: one contradiction (§10.1), one understatement (§10.2), one material error outside §3 (§10.3) |
| What a new cached asset requires | §6.1 — one `urlsToCache` line + a `CACHE_NAME` bump |
| Whether invariant 6 holds under this contract | §9.5 — yes, for the games surface; the rail buttons wait on `PUP-WO-0200` |

**Protected surfaces, as a checkable fact:** `git diff origin/main --stat` for
this branch shows changes under `docs/` only — two files, this one and
`docs/FEEDBACK.md`. `index.html`, `sw.js`, `manifest.json`, `icon-192.png` and
`icon-512.png` diff to empty. No application code was changed.

> **Why `docs/FEEDBACK.md` and not `./FEEDBACK.md`.** WO §6 says the feedback file
> is "parked with the branch"; WO §3.1 says "changes under `docs/` only. **Any
> other path fails.**" A root-level `FEEDBACK.md` satisfies the first and fails the
> second — and the second is not mere hygiene: architecture §6's bootstrap
> exception makes the `docs/`-only property *the thing that makes merging a P0 work
> order safe*, because Pages serves nothing under `docs/`. Placing it under `docs/`
> satisfies both readings. Flagged for CC-A rather than decided silently.
> *(Conflict found by the adversarial pass, finding F24.)*
