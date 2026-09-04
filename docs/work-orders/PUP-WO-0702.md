# PUP-WO-0702 — Local only: voice and location stop crossing the wire

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `916b0195`; **verify live HEAD**).
**Branch:** `build/wo-0702-local`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P7 · **Phase exit gate:** roadmap P7. **Subject SHA:** `916b0195`; every
citation is **a symbol**, because `index.html` moves constantly.

**Grounds:** northstar invariants 1, 2, 3 · `docs/architecture.md` §5 · Scotty's ruling
of 2026-09-04, which closes `docs/roadmap.md` §4·RESUME's audience question.

> **What this is:** Scotty ruled the voice audience. **The answer is not "scope the
> channel" — it is "there is no channel."** Voice becomes local only, and location data
> becomes local-function only. This work order is **a deletion**, and deletions are where
> this project has been bitten. It is first in the sequence because it SHRINKS the surface
> the next two work orders sit on — and because, per §1a, it closes a live leak.

**Cadence:** build. One PR, left unmerged.

## 0a. THE FENCE — stated once
**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.
*(Checked before writing: nothing here needs a `urlsToCache` line — it is all inside
`index.html`, which is already cached. No self-contradiction.)*

## 1. SCOPE — what stops crossing the wire

### 1.1 VOICE — Scotty's words: "bypass that concern entirely"

**No Supabase channel, no send, nothing crosses.** Remove, together and in one commit:
`joinVoiceChannel`, `broadcastVoice`, `playRemoteVoice`, `showIncomingWoof`, `sendVoice`
and the send button, and the state that existed only for them — `voiceChannel`,
`voiceInbound`, `voiceDecoding`, `voicePopups`, `voiceSending`, `voiceSendRec`,
`voiceSendNodes`, `getInboundBus`, `voiceInboundBus`, `VOICE_INBOUND_GAIN`,
`VOICE_MAX_INBOUND`, `MAX_INBOUND_AUDIO_BYTES`, `MAX_INBOUND_SECONDS`.

**What SURVIVES is the whole point:** record, choose a preset, move a slider, hear it
back. Everything `PUP-WO-0701` built for the child stays; only the wire goes.

### 1.1a `safeMediaUrl`'s AUDIO BRANCH — name its state, do not leave it ambiguous

Scotty called this out by name. **The function is still needed for the camera**, so it
stays — but `kind === 'audio'` will have **no caller**.

> **RULED: delete the audio branch and simplify the signature to what actually has a
> caller.** *A dead limb a future reader treats as live is worse than an absent one* —
> and this repo's own history is a catalogue of things believed live that were not.
> **If voice is ever networked again, that work order re-adds the branch AND its check,
> together**, which is the correct coupling.

**Say in `FEEDBACK.md` what the signature became**, so the next reader is not surprised.

### 1.2 LOCATION — and the mechanism is worse than "a coordinate"

**`broadcastMapStamp` sends `{ lat, lng, emoji, size, did: deviceId }`, and
`broadcastMapStroke` sends stroke `points` that are `{lat, lng}` pairs.** These are **real
WGS84 coordinates**, not screen percentages, over an unscoped global channel with
`self:false`, carrying a stable device id.

**And the map is centred on `getCurrentPosition` at zoom 16.** So every stamp and every
stroke is within metres of wherever the child is standing when they draw it.

**Remove:** `joinMapChannel`, `broadcastMapStroke`, `broadcastMapStamp`,
`broadcastMapClear`, the three inbound `map-*` handlers, and `mapChannel`.

**KEEP `navigator.geolocation` itself.** It never leaves the device — verified at source:
`getCurrentPosition` and `watchPosition` set `treasureMap.setView` and
`mapLocationMarker` and nothing else. **The map still knows where it is; it stops telling
anyone.** That is exactly "local-function only."

### 1.3 WHAT IS *NOT* IN THIS DELETION, and why — so it is a ruling, not an oversight

- **The radar X marks (`pushXMark` / `fetchRemoteXMarks`) STAY.** They are percentages on
  a decorative radar face, not geography. No real-world coordinate is derivable from them.
- **The alerts (`pushAlert` / `fetchRemoteAlerts`) STAY.** They carry a device id and a
  timestamp and no content.
- **The canvas channel STAYS.** Strokes on a blank canvas are drawing coordinates, not
  location.
- **The camera channel STAYS IN THIS WORK ORDER — and it is a question, not a verdict.**
  See §6.

## 2. INVARIANTS — restated by number, only the slice this touches

- **1 — a non-reader must be able to work it.** Deleting the send button removes a
  control; make sure what remains still reads as complete rather than as broken.
- **2 — one tap back from every state.** The exit must keep working through the smaller
  panel.
- **3 — no core surface reaches the network on someone else's say-so.** This work order
  makes that structurally true for voice and location rather than argued.

## 3. ACCEPTANCE — proven, not asserted

1. **The fence holds**, checked as a command.
2. **A check asserts NO VOICE TRAFFIC EXISTS.** Open the panel, record, play, and assert
   **zero Supabase channels named for voice and zero outbound requests.** *Assert the
   absence at the network, not the absence of a function name in the source* — a source
   grep is the `String(closeCamera)` defect this project has already paid for.
3. **A check asserts the map opens, draws and stamps with NO channel created and no
   outbound send**, while `mapLocationMarker` still tracks.
4. **Record → preset → slider → playback still works end to end**, pressed with a finger.
5. **No microphone survives teardown**, from every state. `PUP-WO-0701`'s §12/§15/§21 kept
   and still green — **the teardown discipline must not be a casualty of the deletion.**
6. **Supabase unconfigured behaves identically to Supabase configured**, for the voice
   panel and for the map's drawing. *That equality IS the property this work order buys*,
   and it is the cleanest way to assert it.
7. **Every deleted symbol is gone from `index.html` AND from every check and comment that
   named it.** No orphan assertions, no comments describing a mechanism that no longer
   exists. **Grep the claim, not just the file.**
8. Every demonstration asserts the commit and the failing step name.

## 4. SCOPE FENCE — NOT in this work order

- **Voice slots, extra sliders, and the sine-wave feedback** — `PUP-WO-0703`.
- **Block Pop's celebration** — `PUP-WO-0704`.
- **The camera channel** — §6, and it is Scotty's.
- **The bare `click` camera controls** — still its own number.

## 5. ADVERSARIAL PASS

Black-box, fresh subagent, `git archive` freeze — **and hold every correction until it
returns.** *(That protocol slipped once in `PUP-WO-0701`; it held in round 3.)*

**Probe the deletion specifically, because that is this work order's risk:** a channel
still joined by a path nobody deleted · a handler still registered · a symbol deleted in
one place and referenced in another · a check that passes because the thing it asserted is
gone rather than because the property holds · **a plant that applies without reproducing**
(architecture §5, and it is new) · the teardown guarantees weakened by the removal of the
code that shared them.

## 6. UPWARD FEEDBACK — `docs/feedback/PUP-WO-0702.md`

Schema per entry: finding · where (symbol) · type · recommendation · decision-needed.

**ONE QUESTION IS ALREADY OWED AND IS SCOTTY'S, NOT YOURS.** Raise it in `FEEDBACK.md`
as `decision-needed: yes` and do not act on it:

> **The camera broadcasts photographs of the child on the same unscoped global channel,
> to anyone holding the URL and the anon key.** Scotty's stated reason for making voice
> local was the audience. **That reason applies to a photograph at least as strongly as
> to a voice clip, and arguably more.** He has not ruled on it and it is not the
> builder's to assume. *Ask; do not fold it in.*

## 7. FLAG-AND-STOP

- **A live microphone that outlives the panel** — unchanged, and a deletion is exactly
  when a teardown guarantee gets weakened by accident.
- Any need to touch `sw.js`, `manifest.json`, an icon, or `games/`.
- **A deletion that cannot be made without also removing a check's ability to fail.** Say
  so and stop — do not leave a check that passes vacuously.

## 8. CLOSING SEQUENCE — FOUR STEPS, AND THE FOURTH IS THE ONE THAT DECAYS

**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**

1. **Push.**
2. **Open the PR**, left unmerged.
3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**

## 1a. WHY THIS IS FIRST, AND IT IS NOT ONLY SEQUENCING

Scotty's read was that this shrinks the surface the other work sits on. **True, and it
also closes a live leak that predates the voice panel by months.** `broadcastMapStamp`
has been putting a three-year-old's real latitude and longitude on a global channel,
paired with a stable device id, since the Map panel shipped. **Nobody was hiding it and
nobody had looked** — it took Scotty's ruling on a *different* surface to make anyone
trace this one. *(Recorded because it is the shape architecture §6.6 names: a thing
everyone would have said was obviously fine, that nobody had checked.)*
