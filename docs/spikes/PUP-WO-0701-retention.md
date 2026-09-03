# PUP-WO-0701 SPIKE — where a child's voice goes, and for how long

**Cadence: SPIKE FIRST, THEN STOP.** No panel was built. No schema exists. Nothing in
`index.html` changed. This answers §1.1's four questions with running proof and stops for
CC-A's read.

**Subject:** live `main` at `8052039`, branch `build/wo-0701`.

---

## 0. The measurements, taken before any opinion

| claim | command | result |
|---|---|---|
| retention code anywhere | `grep -nE "DELETE\|expires\|retention\|purge" index.html` | **2 hits, BOTH COMMENTS** — `:153` (the AudioContext registry) and `:951` (a comment naming this very work order). **There is not one line of retention CODE in this app.** |
| comms tables | `grep -o "pup_pad_[a-z_]*"` | exactly two: `pup_pad_alerts`, `pup_pad_xmarks` |
| how rows are read | `:357`, `:369` | `device_id=neq.<self>&created_at=gte.<since>&order=…&limit=5\|20` |
| channels subscribed | `:428`, `:897`, `:1589` | three — `puppad-canvas`, `puppad-camera`, `puppad-treasuremap` |
| channels released | `grep -n "removeChannel\|unsubscribe"` | **ZERO.** |

**That last row is the finding that shapes everything else.** §1.0a's ruling — *in-memory,
because process death cannot fail to happen* — is correct and I am not arguing with it.
**But it only holds if the thing that dies is the thing that holds the data**, and this app
currently subscribes three channels and releases none.

---

## 1. WHERE DOES AUDIO LIVE — **recommendation: it never lands anywhere**

**Do not add a table and do not add Supabase Storage.** Send the clip on the existing
broadcast channel exactly as a photo is sent (`broadcastPhoto`, `:908`), and let it die
with the page.

**The evidence that this is not a compromise:** the photo path already does this, and it is
the shape §1.0a ruled for. A broadcast is **transport, not storage** — it is delivered to
whoever is subscribed at that moment and is not retained by the channel. Adding
`pup_pad_voice` would be the first row in this project's history that **stores a byte
identifying the child**, and §1.1 is right that a coordinate is not identifying and a voice
is.

**This also makes question 2 answer itself,** which is the strongest argument for it.

## 2. FOR HOW LONG, AND WHAT DELETES IT — **nothing is stored, so nothing deletes it**

Stated plainly as §1.1 demands: **if a clip is never written to a table, there is no
retention policy to write, no purge to run, and no purge that can fail to run.** That is
the same reasoning §1.0a used to choose in-memory over a purged cache, applied one layer
out — **and it is the only answer that does not require this project to acquire its first
retention mechanism in the same work order that acquires its first identifying data.**

**If CC-A or Scotty wants clips to persist**, that is a different work order and it needs a
deletion story *before* a schema, not after.

## 3. WHO CAN FETCH IT — **the current audience is wrong for audio, and it is wrong today**

`device_id=neq.<self>` is **every paired device**, and the channels carry `self: false` and
no other filter. For an X-mark that is fine. For a recording of a three-year-old it is
**every device that has ever been paired, with no per-clip addressing and no revocation.**

**I am not proposing a fix in this spike** — it is a design decision with a blast radius —
but the spike must not leave it implied: **the existing audience is a property of the
transport, and voice would inherit it silently.** Recommend it is ruled explicitly before
the panel is built.

## 4. WHAT DOES THE ADULT SEE AND CONTROL — **nothing today, and it should be its own number**

There is no surface listing what this app holds. **Under recommendation 1 there is nothing
to list** — no stored clips, no stored photos, four `localStorage` keys none of which is
media. **So the surface is not needed to ship voice**, and building it here would be scope
by drift.

**It becomes necessary the moment anything is stored**, which is exactly why it should be
numbered now and blocked on that.

---

## 5. THE SECURITY LENS — first application since PUP-WO-0700

**What this accepts:** a broadcast payload from any subscribed device. **What it does before
validating:** *everything* — `:900` reads `payload.payload.dataUrl` and hands it straight to
`showRemotePhoto`, which assigns it to `img.src`. **There is no type check, no scheme check,
and no size check anywhere on that path.**

0700 closed the **markup** sink correctly — the URL is assigned, never concatenated, and the
comment at `:920` explains why. **That closes injection. It does not close the other two
questions the lens asks.**

**THE FINDING THAT MATTERS FOR VOICE:** assigning an unvalidated string to a media element's
`src` **causes a network fetch when the string is not a `data:` URL**. `img.src` and
`audio.src` both do this. A payload of `https://attacker/x.mp3` makes the child's device
issue a request to an origin the attacker chose — **a beacon that confirms the device is
live, from inside a toy that is otherwise entirely offline.** No script executes; nothing is
stolen; northstar invariant 3 is still broken, because a core surface reached the network.

**Recommendation, and it is one line at the point of use:** require the received string to
match `^data:audio/` before assigning it, and the photo path to match `^data:image/`.
**Validate at the sink, not at the sender** — the sender is the untrusted party.

**And the size question is unanswered by anyone:** there is no cap on a broadcast payload
today. A clip length cap in the recorder bounds *what this device sends*; it does not bound
*what it accepts*. §1.0a's designed bound needs a receiving half.

---

## 6. THE TWO ITEMS 0700 RECORDED AS OWED — ruled, with a reason for each

### 6.1 `closeCamera()` never releases the channel — **THIS ONE BELONGS HERE**

Confirmed at source: `closeCamera()` (`:1554`) stops the media tracks, empties
`cameraGallery`, deletes the renderer and disconnects the ResizeObserver — **and never
touches `cameraChannel`.** `removeChannel` appears **zero** times in the file.

**It belongs in this work order and not its own, because it is the same fact as §1.0a.** The
retention ruling is *"released on close, because process death cannot fail to happen."* A
subscription that outlives its panel is **a live receiver the teardown did not release** —
so the popup keeps appearing over the console for the rest of the session, and under
recommendation 1 **the voice channel would inherit exactly that.** Building voice on this
transport without fixing it is building the second copy of a leak.

*One mechanism, not two* — the same sentence §1.0a uses.

### 6.2 CAPTURE's array with no renderer and no cap — **BELONGS HERE, and it is smaller than it looks**

It is an unbounded in-memory store on the trust boundary, and §1.0a already rules the shape:
**capped count, oldest-evicted, released on close.** Applying that ruling to the array that
already exists is not scope creep; it is the ruling's first instance.

### 6.3 The bare `click` controls — **ITS OWN NUMBER**

The camera panel's controls and the gallery strip are still wired on `click`, which
architecture §6.1 member 6 rules inert for a second finger and a sliding tap. **Real, and
unrelated to retention or to audio.** Folding it in would mean this work order touches every
control in the camera panel, and the spike's whole purpose is to keep the commitment small.
**Recommend a number of its own.**

---

## 7. What I did NOT do

**No panel. No schema. No `index.html` change. No filter code.** §0 says the spike answers
§1 and stops, and acceptance item 2 makes ratification the gate. Everything above is a
recommendation with its measurement attached, and every one of them can be overruled without
anything needing to be un-built.
