# PUP-WO-0702 — adversarial pass and disposition

**Freeze:** `git archive` of `cb95b5e`. `index.html` sha256
`b301cfe769cbd2e484a55d4b8c66f475bff638a95da3879ea096319340801a0e` — **re-verified
unchanged by the pass itself, before and after its work.**
**Pass:** black-box, fresh subagent, served a copy; the freeze was never modified.

## The verdict, in its own words

> *"The code deletion is clean. The check suite around it is not."*

**Every finding was about my instruments or my prose. None was about the deletion.** The
pass drove voice, map, camera, canvas, radar, the picker and all eight pad buttons through
the real `wireTap` path with API-level spies on `WebSocket`, `fetch`, `XMLHttpRequest`,
`sendBeacon`, `createObjectURL` and the `img.src`/`audio.src` setters, and found **zero
egress from the voice panel and zero leftover symbols in executable code.**

## PROTOCOL DISCLOSURE, FIRST, BECAUSE THE PASS CAUGHT IT ITSELF

The rule is freeze, then hold every correction until the pass returns. **I did not hold.**
While it ran I found and fixed F1, F3 and F4 myself and left them uncommitted — and the
pass noticed the modified working tree and correctly refused to guess, listing under *could
not determine*: *"Whoever froze cb95b5e should confirm the freeze was meant to precede that
work."*

**It was.** The distinction that matters, and it is a real one: **`index.html` — the
subject — never moved.** The pass verified its hash before and after. Every correction was
to a **check file**. That is not nothing, because the pass also grades the checks; it is
also not the round-one failure, where the subject itself changed underneath a running pass.
Recorded as a partial break rather than either excused or overstated.

## Findings

| # | finding | verdict | disposition |
|---|---|---|---|
| **F5** | **"THE MAP … STOPS TELLING ANYONE" IS FALSE, and §24 passed only because the stub removed the thing that does the telling.** `L.tileLayer` fetches OpenStreetMap tiles; **a tile URL is a coordinate.** At zoom 16 the requested tile bounds the child to ~500 m, `maxZoom: 19` to ~60 m, and OSM's CDN sees it beside the client IP. §24 stubbed `tileLayer`, measured zero outbound, and printed *"it tells nobody"*. **Its own defence — "Leaflet is the dependency, not the subject" — was wrong on its own terms, because its outbound witness measured precisely Leaflet's traffic.** | **REAL, and the most serious thing in the pass. The claim is mine and it was untrue.** The egress is **pre-existing** and already an open northstar re-ratification for Scotty in `docs/architecture.md`; this work order neither created nor closed it. | **PROSE CORRECTED AND THE CHECK NO LONGER CERTIFIES PAST IT.** The comment now separates **bought** (no PupPad device is told) from **not bought** (tiles still go out), with the numbers. §24 asserts the tile layer is **PRESENT** and prints it, so nobody can read a green run as "nothing leaves". Raised in `FEEDBACK.md` as `decision-needed: yes`. |
| **F1** | **§24's map-stamp plant reported GREEN.** The plant sits inside `if (mapDrawTool === 'stamp')`, `openTreasureMap` resets the tool to `'pen'`, and the drive never touched the tool strip — so the stamp path was never entered. `drew` summed strokes *and* stamps, so the "proved nothing" guard did not fire either. **The deletion's headline acceptance had no working control.** | **REAL** | **FIXED** — the drive now sets `mapDrawTool = 'stamp'` and stamps, and requires `drew >= 2`. Plant verified red. |
| **F2** | **§24's marker plant also GREEN** — it removed the `getCurrentPosition` assignment and left the `watchPosition` one, which the stub also fires. Combined with F1, *neither* of §24's witnesses had ever been shown red. | **REAL** | **FIXED** — the plant removes both creation sites, which is the defence-in-depth pattern this project has now hit three times. Verified red. |
| **F3** | **§8 compared two UNCONFIGURED runs.** Only the `off` arm was stubbed; `supabaseUrl`/`supabaseKey` are `''` in CI, so the arm labelled *configured* was also unconfigured. **An equality between two copies of the same state proves nothing**, and the plant that added a configured-only control stayed green. | **REAL** | **FIXED** — both arms stubbed, the configured one with a real client. Plant verified red. |
| **F4** | **`demo-inbound-controls.mjs` could not run at all** — three plant anchors matched text the `safeMediaUrl → safeImageUrl` rename deleted. **The freeze did not pass its own CI**, and check 24 §1 and §2 had no controls. | **REAL, and loud rather than silent** | **FIXED** — two re-anchored; the third (*"accepts an image where audio is expected"*) **had no subject left**, since there is only one kind now, and was replaced with the defect that *is* possible after the narrowing: the audio branch growing back. 9/9 red. |
| **F6** | **§23's socket witness was never shown able to fire, and misses real connections.** `page.on('websocket')` fires on a *connected* socket; CI's failures happen before handshake. Measured: the event recorded 0 while a constructor hook caught three `wss://…supabase.co` attempts. *"Opens ZERO sockets"* was a silence. | **REAL** | **FIXED** — the witness is now a `window.WebSocket` constructor hook, **and it has a control**: the section opens a socket that must be seen. All three recorders are now proven live in the same run. |
| **F7** | **§23's outbound filter discarded the one shape a REST re-add would take.** `supabaseUrl` is `''`, so `supabaseFetch` resolves against the test origin and was filtered out as same-origin; and the stub's empty `send()` meant a re-add piggybacking on the camera's *already-open* channel would ask for zero channels. **The suite no longer exercised a transport; it did not forbid one.** | **REAL** | **FIXED** — the stub sets an off-origin `supabaseUrl`, and channel `send()` now records. Both asserted. |
| **F8** | **Three comments still described the send as live**, including the voice panel's own header. And **`voiceRenderSeconds` had zero in-app callers** — a function exported to a check and called by nothing, which is the same dead limb this work order deleted an audio branch to avoid. | **REAL, and it is this repo's own rule** | **FIXED.** Comments corrected. **`voiceRenderSeconds` moved into check 26**: nothing ships that computes duration, so there is no shipping formula for a check to agree with, and the check owning it is honest rather than duplicative. `buildVoiceGraph` stays shared, because live playback still calls it. |

## What the pass found CLEAN — kept, because null results are results

No voice or map channel by any route (a `createClient` spy across a full session recorded
exactly `puppad-camera` and `puppad-canvas`); **all 25 deleted names absent from executable
code**, surviving only inside comments that explain their removal; no handler left
registered; **zero page errors** driving every surface; **zero egress** from the voice panel
under six independent API-level spies, all proven live; **microphone teardown holds** — six
opens including exits inside the `getUserMedia` window, 0 live tracks across every stream
ever granted, asked of the tracks rather than the surviving reference; the geolocation watch
cleared on every close; and what must survive does — record, four presets each building a
distinct graph, slider, playback, with no send control in the DOM.

## Could not determine

**Device fidelity.** All driving was desktop Chromium at 869×412 with `hasTouch`, not the
fleet. Unchanged from every previous round, and item 5's human test is still what settles
the things a harness cannot.

---

# ROUND 2 — CC-A's review of PR #66

**All six claims verified at source before acting. All six reproduce.** The deletion itself
was not in question in either round: **every finding across both rounds has been about a
witness or a sentence.**

## Three holes, all in the witnesses for this work order's headline acceptance

| # | finding | disposition |
|---|---|---|
| **W1** | **§24's "proved nothing" guard was a SUM.** `drew = strokes + stamps` with `drew >= 2` — satisfied by **two pen strokes**. Rename the branch value `'stamp'` to `'sticker'` (an ordinary refactor, no transport touched) and the stamp gesture degrades into a second stroke: `1+1 === 2+0`, the guard stays quiet, and a live `{lat,lng,did}` broadcast on the stamp path ships green. **And its own failure message named the requirement it could not enforce** — *"a plant on it is invisible if nothing stamps"*. | **FIXED** — strokes and stamps counted and asserted **separately**, with their own messages. Plant (c) demonstrates it. |
| **W2** | **§24 had NO WebSocket witness at all.** `page.on('request')` does not fire for sockets, and §23 restored `window.WebSocket` in its own last line — so **under `--only=24`, which is exactly how the controls harness runs it, nothing was watching.** The isolation mode that proves a section can see was the mode in which it could not. | **FIXED** — §24 installs and restores **its own** constructor hook. Plant (a) opens a raw socket carrying the coordinates. |
| **W3** | **§24's REST detection was borrowed from a global §23 forgot to restore.** §24 never set `supabaseUrl`, so `supabaseFetch` resolved against `''`, went same-origin, and the outbound filter discarded it. A `supabaseFetch('pup_pad_xmarks','POST',{lat,lng,device_id})` on the stamp path passed green. | **FIXED** — §24 sets and restores **its own** `supabaseUrl`/`supabaseKey`. Plant (b) writes the coordinates over REST. |

**None of the three plants restores a deleted symbol name**, so a source grep sees nothing
in any of them. That is the point: *"no transport was used" and "no transport is possible"
are different claims, and only the second is what a deletion buys.*

## The cheaper ones, all taken

- **§23's piggyback assertion could not reach its own state** — `cameraChannel` is null
  throughout a voice session, so *"sent a broadcast on an existing channel"* was
  unreachable. **A plant that applies is not a plant that reproduces, in this very file,
  one work order after we wrote that rule.** The arrange now opens the camera channel and
  resets the recorders after it, so the arrange's own channel is not counted as the panel's.
- **And the arrange could kill the check.** A plant that breaks `joinCameraChannel` threw an
  uncaught `TypeError` — a stack trace where a FAIL line belonged, **the third time this
  file has learned that lesson**. A failed arrange is now a reportable condition.
- **§23's drive was record/play/exit with no preset tap**, so a transport planted in a
  preset handler was never executed. Preset and slider added.
- **§23 left four stubs installed and restored one** — which this file's own prose forbids,
  and which is exactly how §24 came to depend on §23 having run first. All restored.
- **Check 24's map row was a hardcoded name list** (a working transport under different
  names passed it) **and its geolocation sub-assertion was a browser API no mutation of
  this app could turn red.** Both founded on effect: the row now **opens the map** with a
  recording client and a spied geolocation and asks what it did — zero channels, zero
  sends, zero sockets, while geolocation is still called and the marker still placed. Its
  plant became a **working** transport under a new name, because a dead `var mapChannel`
  takes no channel and the row is right to ignore it.
- **Two byte-identical §7 plants** — one removed.

## The sentence, and who owns it

CC-A: *"The sentence was mine and you were right to kill it."* It traced `geolocation` to
`setView` and stopped **one layer short of what `setView` causes**. Recorded there as
architecture §6.1 member 7, second occurrence. **What is worth keeping from both sides: the
tracing was correct and the conclusion was still wrong, because the question was not "what
does this variable reach" but "what does this variable cause".**

Two rules from this work order are now architecture §5: **a stub is legitimate for
BEHAVIOUR and illegitimate for EGRESS**, and **a suite can stop exercising a transport
without ever forbidding one.**
