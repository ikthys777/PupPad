# PUP-WO-0701 — Voice messages, with voice changing

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0701`. **Author:** CC-A · **Builder:** to be assigned.
**Phase:** P7 · **Phase exit gate:** `docs/roadmap.md` P7, items 3, 4, 5, 6.
**Depends on:** `PUP-WO-0700` merged — same file, one builder.
**Grounds:** `docs/northstar.md` invariants 1, 2, 3, 5 · `docs/architecture.md` §5,
§8 · `docs/roadmap.md` P7 · `index.html`.

> **What this is:** record a short clip, change the voice, hear it back, send it to
> connected devices. It is **NOT** the camera work (`PUP-WO-0700`), not a game, and
> not realtime co-op (architecture §7, deferred with intent).

**Cadence:** **SPIKE FIRST, then STOP.** See §0. One PR, left unmerged.

---

## 0. SPIKE FIRST — because §1 is a question this project has not answered before

**Every other work order here has been build-cadence. This one is not**, and the
reason is §1: *what happens to a recording of a three-year-old's voice, and for how
long.* That is a decision, not a build step, and it must be answered **before** a
schema exists rather than after.

**The spike answers §1's four questions and stops.** Do not build the panel.

## 0a. THE FENCE — stated ONCE, referenced everywhere, restated nowhere

**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.

## 1. RETENTION — the question the spike exists for, and CC-A's measurement

### 1.0 THE DEVICE-SIDE QUESTION IS ALREADY ANSWERED, AND THE ANSWER IS "NOTHING IS STORED"

*Measured 2026-09-02 after Scotty's cache-only constraint. **The premise that images
have an unbounded-growth problem voice would inherit is REFUTED — and refuted in the
direction that makes this work order smaller.***

- **`var cameraGallery = []` — a plain in-memory array.** `.push(thumbUrl)` is its only
  growth path.
- **It is persisted NOWHERE.** No `localStorage`, no IndexedDB, no Cache API reference
  touches it. The only `localStorage` keys this app writes are `pupgame:`,
  `puppad_device_id`, `puppad_sb_key` and `puppad_sb_url`.
- **`closeCamera()` does `cameraGallery = []`.** **Photos are destroyed the moment the
  panel closes** — they do not survive closing it, let alone a reload.

**So Scotty's constraint — *"everything is cache-only on the device… because kids"* —
is already satisfied for images in the strongest possible way: nothing reaches disk at
all.** There is no cap to build and no defect to fix first. **Voice matches images by
doing the same thing: record, play, send, discard.** No Cache API, no IndexedDB, and
emphatically no base64 audio in `localStorage`.

**Two things that ARE real, and neither is what was expected:**

1. **The bound is accidental, not designed.** "Until the panel closes" is not a limit
   anyone chose, and within one session an unbounded array of base64 JPEGs grows the
   JS heap on a low-end tablet. **Cap the clip LENGTH and the in-session COUNT,
   oldest-evicted** — a designed bound where there is currently a lucky one.
2. **Photos vanishing on close was nobody's decision.** It falls out of a `= []` in a
   teardown. It may well be right under "cache-only, because kids" — but it should be
   *ruled* rather than inherited, and **it makes `PUP-WO-0700`'s CAPTURE button
   ambiguous: pulled into WHAT, if the gallery dies on close?** That is 0700's
   question and it is flagged there.

### 1.0a THE RETENTION RULING — in-memory, and the reason is that it FAILS CLOSED

*Scotty's requirement, 2026-09-02: **"It is ok to grow in the app while open; the goal
is that everything is reaped on PWA close or reset."** Session-scoped, not size-capped.*

**Three options were put to CC-A. Ruled: (a) IN-MEMORY, with `URL.createObjectURL`
rather than base64.**

| | why not |
|---|---|
| (b) `sessionStorage` | the same **synchronous ~5 MB string store**; wrong for audio for the reason it is wrong for images. |
| (c) Cache API / IndexedDB **with purge on startup** | **The argument for it was good and nearly won:** a phone silently reclaims a backgrounded PWA, and pure in-memory loses everything mid-session for no reason a three-year-old can perceive. **What decided against it: (c) satisfies "reaped on close" by RUNNING A PURGE; (a) satisfies it by THE PAGE DYING.** A purge is a thing that must *happen*. Process death cannot fail to happen. Any path that opens the store without purging — a crash before it, a future code path, a purge that throws — **leaves a child's photos on disk**. **(c) fails OPEN in exactly the direction the constraint exists to prevent**, and this project has spent two days on assertions that pass by not running. A purge that does not run is that shape holding real data. |

**And there is nothing to migrate.** Verified at source twice, the second time because the
co-architect asked to be checked: **exactly four `localStorage.setItem` calls exist** —
`puppad_device_id`, `puppad_sb_url`, `puppad_sb_key`, `pupgame:` — **none is an image**.
`cameraGallery` is the only image array, and received photos go straight into an
`<img src>` and are never stored. **Zero persisted image bytes exist on any device.**

**ONE MECHANISM, NOT TWO.** Voice uses the identical shape as images: in-memory,
released on close, **clip length and in-session count capped** so the bound is
*designed* rather than the lucky "the panel is open." *(Two expressions that must
agree is this project's most expensive recurring class — §1's own sticker defect is
the same shape.)*

**THE CONCERN THAT REMAINS, RECORDED RATHER THAN DISMISSED, AND IT IS NOT RETENTION.**
Process-reclaim loss is a **different problem pulling the opposite way**: retention
asks how *little* survives; that concern asks for *more*. Conflating them is what makes
(c) look right. And the sharper fact: **photos are already lost on PANEL CLOSE, which
is far more frequent than Android reclaiming a background process.** So if losing
photos matters, `closeCamera()`'s `cameraGallery = []` is the larger defect by orders
of magnitude — and **whether photos should survive at all is currently decided by a
`= []` in a teardown that nobody wrote as a policy.** That is Scotty's call and it is
`PUP-WO-0700`'s flagged question, not a retention mechanism.

### 1.1 What the spike must still answer — the SERVER side, which is smaller now

**Measured on `main` 2026-09-02:**

- The existing comms tables are **`pup_pad_alerts` and `pup_pad_xmarks`** — alert text
  and map coordinates.
- **`grep -cE "DELETE|expires|retention|purge" index.html` returns 1 in 2,642 lines.**
  **There is effectively no retention policy anywhere in this app.**

**A clip that reaches another device exists somewhere on Supabase, and that is where
the question now lives — not on the phone.** And it is fine for an X-mark and not
obviously fine for a recording of a child's voice. A coordinate is not identifying; a voice is. Northstar invariant 2 is about
reaching an adult's data from inside PupPad, and this is the mirror case: **the
child's own data leaving.** *"Follow the existing pattern" is not an answer here,
because the existing pattern is silence.*

**The spike must answer, with evidence and a recommendation:**

1. **Where does audio live** — Supabase row, Supabase storage, or never leaves the
   device except as a direct transfer?
2. **For how long**, and **what deletes it**? If the answer is "nothing", say so
   plainly rather than leaving it implied.
3. **Who can fetch it** — the existing tables are read by `device_id=neq.<self>`,
   which is every paired device. Is that the right audience for audio?
4. **What does the adult see and control?** There is no surface today that lists what
   this app has stored. Should there be one, and is that in this work order or its own?

**CC-A's position, offered so the spike has something to disagree with rather than a
blank page: prefer the shortest path that still delivers the toy.** If a clip can be
delivered and then deleted, that is a smaller commitment than a stored library, and
the fun for a three-year-old is in *making and hearing* the voice, not in an archive.
**Falsify that if the measurement says otherwise.**

## 2. Scope, after the spike is ratified

### 2.1 The pieces already exist — this is composition

**Verified on `main`:** `getUserMedia` is live in the camera path; `AudioContext` is
live for the sound bank; `supabaseFetch` and `isSupabaseConfigured()` are wired.
**No new library.** Reuse the single `AudioContext` — architecture records that the
shell has exactly one, lazily created and never closed, and **handing a second one out
is handing out a leak**.

### 2.2 The filters — pure Web Audio

`playbackRate` for chipmunk and monster · `detune` or a ring modulator for robot ·
`BiquadFilter` for telephone and underwater · a short delay for echo · a `WaveShaper`
for growly.

### 2.3 PRESETS **AND** SLIDERS — and the sliders are the point

**Big icon presets, and adjustable controls under them.** Scotty, after watching him:
**he likes recording his own voice and hearing it back, and he likes moving a control
and seeing what changed.** Same standing direction as `PUP-WO-0301` §2.2b: **every
parameter that can reasonably be exposed, expose.** Do not trim for tidiness.

**The only filter is invariant 1**: a preset a non-reader cannot identify from its
icon is not a preset.

## 3. Acceptance — proven, not asserted

1. **The fence in §0a holds.**
2. **§1 answered and ratified before any schema exists.** *(Spike gate.)*
3. **A clip records, and at least four filters are AUDIBLY DISTINCT on playback** —
   measured, not asserted: capture the rendered audio and show the spectra differ.
4. **A sent clip arrives on a second device.**
5. **Every preset and every slider operable with all text covered**, tested by a
   **real person who has not seen the app**. Prediction recorded first. **Do not
   simulate it** — same rule as `PUP-WO-0201` §7.
6. **One tap back from every state, including mid-record and mid-playback**, pressed
   **with a finger**.
7. **Supabase unconfigured:** degrades exactly as the existing panels do.
8. **Recording stops when the panel closes.** No live microphone survives teardown —
   the same discipline as a game module's `teardown`, and easier to get wrong.
9. **Every demonstration asserts the commit and the failing step name.**

## 4. Scope fence — NOT in this work order

- **Realtime voice / co-op** — architecture §7, deferred with intent.
- **The camera work** — `PUP-WO-0700`.
- **`sw.js`, games, the picker.**
- **A general "what has this app stored" surface**, unless §1 concludes it belongs
  here — in which case say so and it becomes scope by ruling, not by drift.

## 5. Adversarial pass

Black-box, fresh subagent. Freeze protocol per architecture §5: `git archive` /
`git clone`, **never `cp -r` of a worktree**; hashes at freeze and disposition; read
the feedback file as a deliverable.

Probes: leave the microphone running after teardown · send a clip that is not audio ·
strand the child mid-record · make a preset indistinguishable from another · reach
another device's clips · press everything with two fingers.

## 6. Upward feedback

`docs/feedback/PUP-WO-0701.md`; verbatim exchange in
`docs/findings/PUP-WO-0701-adversarial.md`. **The spike's answer to §1 goes in the
feedback file, not only in a commit message** — architecture §6.1 member 5.

## 7. Flag-and-stop

- **Anything in §1 that cannot be answered with evidence.** Guessing about a child's
  recorded voice is the one place in this project where a best-effort answer is worse
  than stopping.
- **A live microphone that outlives the panel.**
- Any need to touch `sw.js`, `manifest.json`, an icon, or `games/`.
- A preset that cannot be made identifiable by a non-reader.
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-02 from Scotty's direction — **the one he expects Buddy to
love most.** Feasibility was checked by the co-architect and confirmed by CC-A at
source: the pieces are all present and this is composition rather than new
infrastructure.

**§0 makes it spike-first for one reason, and it is not the audio.** Every other
constraint here has an answer in the existing code. **Retention does not: one match
for `DELETE|expires|retention|purge` in 2,642 lines.** A coordinate and a child's
voice are not the same kind of data, and the app currently treats everything the same
way — which nobody decided, and which therefore has to be decided now.

## §S. THE SPIKE IS RATIFIED — BUILD PHASE, RULED 2026-09-03

**All four answers accepted. `docs/spikes/PUP-WO-0701-retention.md` is the record; this is
the ruling.**

### 1. STORE NOTHING. The transport is the whole mechanism.

**Ratified.** Send on the existing broadcast and let it die with the page. **A broadcast
is transport, not storage.** And the framing that decides it is CC-B's: **a
`pup_pad_voice` table would have this project acquire its FIRST retention mechanism in
the same work order as its FIRST identifying data.** §1.1 already draws that line — a
coordinate is not identifying, **a voice is.** *Nothing deletes it because nothing stores
it: §1.0a's reasoning one layer out, and the only answer where the thing that dies is the
thing that holds the data.*

### 2. THE SINK FETCHES, AND THAT IS A LIVE INVARIANT-3 BREACH TODAY

**The lens found what `PUP-WO-0700` did not close, and I verified it at source.** 0700
closed the **markup** sink correctly — assigned, never concatenated — **which closes
injection and nothing else.**

**`index.html:900` hands `payload.payload.dataUrl` straight to `showRemotePhoto` with no
type check, no scheme check and no size check, and `:939` assigns it to `img.src`.**
**Assignment still FETCHES.** A payload naming an attacker's origin makes the child's
device issue a request to it — **a beacon confirming the device is live, from inside a
toy that is otherwise entirely offline.** No script runs, nothing is stolen, and
**northstar invariant 3 breaks anyway, because a core surface reached the network.**

**RULED: the validation lands in THIS work order, AT THE SINK, and it fixes the EXISTING
PHOTO PATH as well as the new audio one.** `^data:image/` and `^data:audio/`, at the point
of use, **because the sender is the untrusted party.** *This is not voice scope creep —
voice cannot ship on a transport with a live breach in it, and the breach is there now.*

**AND THE BOUND NEEDS ITS RECEIVING HALF.** §1.0a's *designed* bound is currently
recorder-side only, which bounds what this device **sends**, not what it **accepts**. Cap
the inbound payload too.

### 3. FOUR CHANNELS ARE SUBSCRIBED AND ZERO ARE RELEASED — one more than the spike counted

`grep -c '\.subscribe('` returns **4**; `removeChannel|\.unsubscribe\(` returns **0**.
The spike names three (`:428` canvas, `:897` camera, `:1589` map). **Resolve the fourth
before building — an unreleased channel nobody counted is an unreleased channel**, and
this section exists because the count is the thing being fixed.

### 4. THE OWED ITEMS — ruled as CC-B proposed, with the reasons accepted

| item | ruling |
|---|---|
| `closeCamera`'s missing unsubscribe | **HERE.** *"A subscription that outlives its panel is a live receiver the teardown did not release"* — the same fact as §1.0a, and voice would inherit it. **Building voice on this transport without fixing it is building the second copy of a leak.** |
| `CAPTURE`'s uncapped array | **HERE.** §1.0a's first instance: capped count, oldest evicted, released on close. **Applying the ruling to the array that already exists is not creep.** |
| the bare `click` controls | **ITS OWN NUMBER.** Real, member 6, and unrelated to retention or audio. Folding it means touching every control in the panel. |

### 5. THE AUDIENCE IS WRONG TODAY AND VOICE MUST NOT SILENTLY WIDEN IT

`device_id=neq.self`, `self:false`, no per-clip addressing, no revocation. **Not fixed
here — the blast radius is a design decision and Scotty's.** But **say in `FEEDBACK.md`
that voice inherits that audience**, so it is a recorded choice rather than a silent one.
**The adult surface gets its own number and is BLOCKED ON anything being stored** — under
§S.1 nothing is, so it is not needed to ship voice, and building it here is scope by
drift.

### 6. THE META-CHECK IS FOLDED IN — RULED, WITH THE REASONING, SO IT IS NOT A PRECEDENT

**CC-B declined to add it on their own authority and was right to ask. Ruled: BUILD IT
HERE.** *Nothing verifies that a `demo-*.mjs` in `.github/ci/` appears in `ci.yml`. It is
one assertion and it would have caught all five.*

**Why folding beats numbering, and the test is whether it makes this PR harder to review
or riskier to merge — it does neither:**

- **`ci.yml` is already open in this PR**, inside the fence. This is the cheapest moment
  it will ever have.
- **Numbering it means it waits in the queue while unregistered checks stay invisible —
  which is the exact failure the item describes.** *A parked item about things being
  invisible is the shape this project has paid for six times.*
- **It is the thing that keeps the five registrations true.** Shipping five registrations
  without it is the same defect deferred by one work order.

**Assert the equality, not a list:** every `demo-*.mjs` under `.github/ci/` appears in
`ci.yml`. **Plant it by adding a file and not registering it, and show it red.**

---

## CLOSING SEQUENCE — FOUR STEPS, AND THE FOURTH IS THE ONE THAT DECAYS

**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**

1. **Push.**
2. **Open the PR**, left unmerged.
3. **VERIFY THE NUMBER RESOLVES.** *A PR that did not open is indistinguishable from one
   nobody read.*
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**

*Added 2026-09-03. `SendMessage` appeared in **zero** work orders while being a line in
`architecture.md`, which made the handoff a convention — and a green PR once sat unclaimed
for three hours because a park never woke the reviewer. See `docs/work-orders/TEMPLATE.md`.*
