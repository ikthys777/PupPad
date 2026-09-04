# PUP-WO-0702 — upward feedback

**Branch `build/wo-0702-local`, based on `main` at `916b0195` (verified live).**
Adversarial disposition: `docs/findings/PUP-WO-0702-adversarial.md`.

**The fence holds.** `sw.js`, `manifest.json`, both icons and `games/` diff to empty
against `916b0195`, checked as a command. Nothing needed a `urlsToCache` line.

---

## DECISION NEEDED — TWO, and both are Scotty's, not mine

### 1. The map still tells OpenStreetMap where the child is

| field | |
|---|---|
| **finding** | **Removing the broadcast did NOT make the map silent, and my first draft of this work order claimed it did.** `L.tileLayer` fetches OSM tiles, and **a tile URL is a coordinate**: re-centred on the fix at zoom 16, the requested tile bounds the child to roughly a **500 m square**, and `maxZoom: 19` takes that to about **60 m** if they pinch in. OSM's CDN sees those paths beside the client IP. |
| **where** | `openTreasureMap` → `L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19})` |
| **type** | audience / privacy |
| **recommendation** | **None offered.** This is **pre-existing and already yours**: `docs/architecture.md` logs the OSM tiles, plus the three CDN script loads, as an open **northstar re-ratification** — northstar §5 forbids third-party network calls as a category and the console has been making them since before this work order. Nothing here changed it. What changed is that voice and PupPad-to-PupPad location stopped, which makes the tiles the *largest remaining* location egress rather than one of several. |
| **decision-needed** | **YES**, and it is the same ruling that is already open — this work order just made it sharper. **The honest summary is: the map no longer tells another PupPad device where your child is. It still tells a map server.** |

*The claim was caught by the adversarial pass, not by me. The comment in `index.html` and
check 26 §24 now separate what this deletion bought from what it did not, with the numbers,
and §24 asserts the tile layer is **present** so a green run can never be read as "nothing
leaves".*

### 2. The camera — and it is Scotty's, not mine

| field | |
|---|---|
| **finding** | **The camera broadcasts photographs of the child on the same unscoped global channel that voice was just removed from.** Anyone holding the URL and the anon key receives every photo from every install. |
| **where** | `joinCameraChannel` / `broadcastPhoto`, channel `puppad-camera`, `config: { broadcast: { self: false } }` |
| **type** | audience / privacy |
| **recommendation** | **None offered, deliberately.** Scotty's stated reason for making voice local was the audience. **That reason applies to a photograph at least as strongly as to a voice clip, and arguably more** — a photo identifies the child to a stranger without them having to recognise a voice. But "make it local" is not obviously right for the camera the way it was for voice: the camera's whole point may be showing Grampa a photo, in a way that recording a silly voice was not. |
| **decision-needed** | **YES.** Not folded in. `PUP-WO-0702` §6 says ask, do not assume, and this work order does not touch it. |

**One thing worth knowing before ruling:** this deletion did **not** make the camera safer.
It removed voice and location from that channel and left photographs on it. If the answer
is "the camera goes local too", the same shape applies and it is a smaller job than this
one was. If the answer is "the camera stays networked", that is a real choice and should be
recorded as one rather than inherited.

---

## What the signature became — §1.1a asked for this by name

`safeMediaUrl(raw, kind)` → **`safeImageUrl(raw)`**.

The audio branch had no caller once the voice transport went, and **the `kind` parameter
went with it — and so did the name.** A function still called `safeMediaUrl(raw)` that
silently accepts only images is its own small trap: the next caller passes audio, gets
`''`, and has no clue why. `safeImageUrl` cannot be misread. Check 24 asserts the rename,
the arity, **and that the old name is gone**, so two names for one gate cannot drift back.

---

## Findings

| # | finding | where | type | recommendation | decision-needed |
|---|---|---|---|---|---|
| 1 | **CC-A's location finding is exact, and I verified it before acting.** `pixelToLatLng` returns Leaflet's own lat/lng, so stamps carried `{lat, lng, emoji, size, did}` and strokes carried `{lat,lng}` pairs — real WGS84 — on an unscoped global channel beside a stable device id, from a map re-centred on `getCurrentPosition` **at zoom 16**. | `broadcastMapStamp`, `broadcastMapStroke` | leak, now closed | Removed. | no |
| 2 | **`navigator.geolocation` stays and that distinction is the work order.** Verified at source: `getCurrentPosition` and `watchPosition` set `treasureMap.setView` and `mapLocationMarker` and nothing else. | `openTreasureMap` | correctness | Kept, and check 26 §24 asserts the marker still tracks — **because "local only" done wrong is deleting the tracking too**, and that would be the wrong fix in the other direction. | no |
| 3 | **The send button is removed, not disabled.** A dimmed control a child cannot make work is worse than an absent one. The transport row is now play + record. | `openVoice` | invariant 1 | Kept as built; §8 asserts the control set is identical configured and unconfigured. | no |
| 4 | **Leaflet is CDN-only and unreachable in CI**, so check 26 §24 stubs it. **The boundary is stated in the check**: Leaflet is the *dependency*, not the subject; nothing asserts anything about Leaflet, and what is driven is the app's own pointer handlers and clear button. | `demo-voice.mjs` §24 | instrument | Recorded rather than hidden. A stub returning wrong geometry would still exercise the same send paths, because those paths do not depend on the geometry being right — only on existing. | no |
| 5 | **Pre-existing, unchanged, and not mine:** if the Leaflet CDN is unreachable the map throws *before* its CLOSE button is wired, leaving a full-screen overlay with no exit. `PUP-WO-0106`'s, named in the code already. | `openTreasureMap` | latent trap | Untouched. Flagged because this work order made me read that path closely. | no |
| 6 | **`did: deviceId` still rides six other broadcasts and nothing reads one.** Voice's was dropped in `PUP-WO-0701`; the map's went with the map. Canvas, camera and alerts still send it. | `broadcastStroke`, `broadcastStamp`, `broadcastPhoto`, `pushAlert` | privacy hygiene | One line per site. Not folded in — those panels are not this work order's. | no |

---

## What was hardest, and it was not the deleting

**Nine assertions lost their subject.** Six check sections and fourteen plants were about a
transport that no longer exists. **The temptation is to delete them quietly, and that is
precisely the failure this work order names:** a check that stops asking passes because its
subject vanished, not because a property holds.

So the absences are **asserted**: §7 asserts the inbound audio caps are *gone*; check 24 §5
asserts the map has no channel, no join and no senders *while still having geolocation*.
Both would go red if the transport came back.

**And §23's plant re-adds a channel under a DIFFERENT NAME** (`puppad-voice-v2`), because a
plant that restores the deleted symbol would only prove a source grep works. The check is
at the network — a real recording client stands by that *would* hand over a channel, and
the camera's own join proves the recorder can fire, so the zero is a measurement rather
than a silence.

## Acceptance

| # | state |
|---|---|
| 1 | **MET** — fence diffs to empty, checked as a command. |
| 2 | **MET** — §23: a full voice session asks for zero channels, makes zero outbound requests, opens zero sockets, with a client standing by; instrument proven live by the camera. |
| 3 | **MET** — §24: the map opens, tracks a real fix, draws and clears with zero channels and zero outbound. |
| 4 | **MET** — §8 and §1: record → preset → slider → playback, pressed with a finger. |
| 5 | **MET** — §12, §15, §17, §18, §20, §21 kept unchanged and green. |
| 6 | **MET** — §8 asserts configured and unconfigured are **indistinguishable**, by running one script twice and comparing state. |
| 7 | **MET** — every deleted symbol is gone from `index.html`, the checks and the comments; what remains names them only to assert their absence or to restore them in a plant. |
| 8 | every check asserts the commit and names its failing step. |
