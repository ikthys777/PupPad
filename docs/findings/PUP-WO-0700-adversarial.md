# PUP-WO-0700 — the adversarial pass, and its disposition

**Subject frozen at `0b74487c3e1c60c0145d21b1da375c8c6d90914e`**, exported with
`git archive` — no `.git`, so committing was inexpressible from inside the pass.

```
962f99b0007e1b0fa945e7f88885c5379ed7fd41e76772656660f67731849b48  index.html
fb4b0d5b1d0554ec612bda555db29d89c681ebe567240a854380083cde2a0a75  .github/ci/demo-sticker-share.mjs
a60950ea7a8f0518e6cf0870e99563d7282a0ae55f33517dc633a1aa3b35639d  docs/feedback/PUP-WO-0700.md
```

**The pass found that the fix this work order exists to make was still wrong, and that
the check written to prove it was blind to that by construction.** Everything below is
dispositioned; the numbers are the pass's, and where I re-derived them independently I say
so.

---

## THE HEADLINE — the fix removed the second *constant* and left a second *answer*

`#camReviewCanvas` is `width:100%;height:100%;**object-fit:contain**` and
`#camStickerLayer` is `inset:0` over the same parent. **So the layer is the ELEMENT box
and the photograph is letterboxed inside it.** Sizing the preview at 6% of the layer and
the burn at 6% of the canvas is the same fraction **of two different rectangles**.

Measured by the pass through the shipped path, one sticker, canvas 3840×2160:

| viewport | layer | photo box | what check 20 said | on screen | error |
|---|---|---|---|---|---|
| 1024×640 *(check 20's own vp #1)* | 1024×552 | 981×552 | 6.000% vs 5.990% | 61.4 vs 58.8px | **−4.3%** |
| 1366×768 | 1366×680 | 1209×680 | 6.000% vs 5.990% | 82.0 vs 72.4 | **−11.7%** |
| 1440×820 *(check 20's own vp #3)* | 1440×732 | 1301×732 | 6.000% vs 5.990% | 86.4 vs 77.9 | **−9.8%** |
| 2400×1080 | 2400×992 | 1764×992 | 6.000% vs 5.990% | 144 vs 105.6 | **−26.7%** |
| 1920×500 | 1920×412 | 732×412 | 6.000% vs 5.990% | 115.2 vs 43.9 | **−61.9%** |

**Position drifted by the same mechanism — up to 214px, 29% of the photo width.** So the
work order's *"position is proportional in both paths and was never wrong"* is **false**
whenever the image is letterboxed, which is most sizes. That is CC-A's diagnosis, confirmed
at source, and it was right about the constant and wrong about the coordinate system.

**And the check could not see any of it.** It divided the preview by the layer width and
the burn by the canvas width — **the two denominators that make the mismatch cancel
exactly**. It reported `worst disagreement 0.0104 points` at every viewport, and it was
green in two of its own three while the defect was present in both.

**That is architecture §6.1 member 6, in the check written to close member 6:** agreement
measured in the one coordinate system where disagreement is invisible.

### Fixed

`photoBoxIn(layer, canvas)` now states **where the photo is** — once — and everything the
child places is a fraction **of the photo** in both paths. `layoutStickerEl()` positions
and sizes the preview from that box and is **re-runnable**, so a resize no longer strands
the preview at a stale size (**A4**: 1.72 percentage points, 8.6× the check's own gate, and
the sticker visibly jumped on save). A tap on the black bar is **refused** rather than
mapped onto the photograph (**A3**: a 98%/98% tap landed outside the image and burned
inside it).

**Check 20 now measures in CSS pixels on the screen** — what the child sees against where
the burn would put it in the same box. One space, no denominators to choose. It also
letterboxes on purpose: 1920×500 gives a 1188px bar.

| | before the pass | after |
|---|---|---|
| 1024×640 (43px bar) | 61.4 vs 58.8px | **58.9 vs 58.8px**, centres 0.0px apart |
| 1920×500 (1188px bar) | 115.2 vs 43.9px, **214px** apart | **43.9 vs 43.9px**, centres **0.0px** apart |

**Shown red against the shipped defect**, same check, `layoutStickerEl` reverted to the
element box: `1920x500 — preview 115.2px vs burn 43.9px, centres 214.0px apart`. **That
reproduces the pass's independently-measured 214px exactly**, from a different instrument.

---

## The injection sink, which this work order made worse before it made it better

**B1, CRITICAL.** `showRemotePhoto` built `'<img src="'+dataUrl+'"…'` into `innerHTML`, and
`dataUrl` arrives verbatim from a broadcast payload. A payload of
`x" onerror="…" data-z="` closed the attribute and **ran script in the child's app**.

That sink pre-existed. **What this work order did was extend its blast radius**: CAPTURE
stores the raw string, and `renderGallery` and `showGalleryFull` concatenate it the same
way — so one payload reached **three** sinks and outlived the four-second popup instead of
dying with it. The pass measured 3 executions from one payload. **B2**: a payload could
also plant a full-screen `position:fixed` node on `document.body` that outlived the popup
and made CAPTURE unpressable.

**Fixed at all three sinks**: the URL is **assigned as a property**, never concatenated.
There is no attribute to escape. *(This project had already closed this class — the
picker's tiles use `textContent`, and `PUP-WO-0201`'s pass recorded `<img onerror>` as
harmless there for exactly that reason.)*

**B3, and the root of B4/B5**: CAPTURE stored **anything** — a text data URL, truncated
base64, a `javascript:` URL, an empty string, a 404 path, an 8 MB string — and flipped to a
tick, **telling a child it kept something it had not**. Now validated at the point of
storage: a captured payload must be a base64 image data URL, and a refusal shows an ✕
rather than a tick. Check 20 presses all six junk shapes and asserts none is kept and none
executes.

**B5, HIGH — a latch with no way out.** RESHARE's `busy` flag was cleared only in `onload`
and `onerror`; against a request that returns **neither**, the button stayed pressed for
the life of the overlay with no retry. **The comment above it claimed to cover exactly that
case and covered only the error one.** Now a 4-second timeout releases it. *A control that
can enter a state it cannot leave is the same defect as a surface a child cannot leave.*

---

## The asymmetry this work order created

**C2 + D1, HIGH.** The expanded gallery view sits at z-index 200 over the camera panel, so
`#camCloseBtn` and the console pad are both unreachable while it is open — **`.gClose` is
the single exit.** It was wired on bare `click`, which a browser does not synthesise while
a second finger is on the glass or after ~15px of slop.

**And eleven lines away, in the same `innerHTML` string, this work order added a SEND
button wired on pointer events.** Hardening the send and not the exit, on a full-screen
surface a child can be stranded behind, is the wrong asymmetry to ship. `.gClose` now goes
through `wireTap`, and check 20 closes the expanded view with a **sliding** tap.

*(The camera panel's other controls and the gallery strip remain bare-`click` — they are
`PUP-WO-0106`'s, named as such in `wireTap`'s own comment. Recorded, not fixed. **The
feedback's earlier claim that "§4 fences it out" was wrong** — §4 fences Voice, the sticky
toast, and sw.js/games/picker, and does not mention the strip. E7, accepted.)*

---

## What the check let through — ten planted defects, and the seven that mattered

The pass planted 24 one-line mutants. **Missed, and now caught:**

| planted defect | why it passed | now |
|---|---|---|
| CAPTURE stores `''` | assertion was `after === before + 1`; **nothing looked at what was stored** | asserts the stored bytes equal the payload |
| RESHARE sends `gallery[0]` instead of the expanded one | assertion was `sends === 1`; **the argument was never inspected** | two distinguishable images; asserts the sent one is the **second**, by pixel colour |
| RESHARE bypasses `compressForBroadcast` | same | asserts the sent image is 600px JPEG |
| preview drawn 10 points from the burn | the check read `leftPct`/`topPct` and **never used them** | asserts preview-vs-burn centres in screen px |
| `line-height:1` removed | output **bit-identical**; nothing measured the preview's box | asserts the line box equals the font size |
| RESHARE fires once ever | it was only ever pressed once | presses twice across the re-arm |
| `STICKER_W_FRAC = 0.12` (or `0.9`) | the check asserted the two paths **agree**, never that the size is sane | asserts the sticker is 2–15% of the photo |

*(Two size/position mutants sat just inside the old thresholds — ×1.035 and 0.55 points. The
screen-pixel measurement replaces those thresholds with ones in the unit the defect is felt
in.)*

**Accepted, not fixed:** the fade-cancel-on-press (**E6**) does not serve the reason the
comment gives — every behaviour named as justification happens *before* the press. The
mechanism is kept because dismissing 1.2s after a tick is better than 4s of a stale popup,
but **the justification was rewritten rather than the code**. **C4**, duplicate
`snapCaptureBtn` ids across concurrent popups: real, low, and `getElementById` returns the
first — recorded.

**C3, MEDIUM, and it changes a documented ruling.** `closeCamera()` never unsubscribes the
channel, so after the camera has been opened once the popup appears over the console for the
rest of the session — and CAPTURE there stores into an array with no renderer and no cap.
So *"lives until the camera panel is next closed"* is wrong: it lives until the camera is
next **opened and then** closed, which may be never. **The feedback now says this.**

---

## False claims in my own feedback, corrected

**Scotty ruled during this work order that the adversarial pass must run BEFORE the feedback
document that ships with the PR.** He was right, and this is the evidence: the doc frozen at
`0b74487` carried claims the pass then falsified, for the second work order running.

| claim | reality |
|---|---|
| *"between 42% and 240% of its correct size"* | From its own three points: **41.7%–77.0%**. The defective sticker was **never larger** than correct. `240%` is the 1440px point read backwards and presented as the other end of a range. It shipped in `ci.yml` too. |
| *"position is proportional in both paths and was never wrong"* | False whenever letterboxed — up to 214px of drift. |
| the code comment asserting `grep -n '0\.06\|36px'` returns *"this constant, and nothing else"* | It returns **14 lines**, including a live second `36px`. **And §4 of the same document called that grep useless** — the comment claiming its result shipped anyway. |
| *"`PUP-WO-0701` §1.0a ruled cache-only… because kids"* | The quote is §1, not §1.0a; §1.0a rules **session**-scoped retention (*"reaped on PWA close or reset"*). A store `closeCamera()` empties is **stricter than**, not *"exactly"*, what was ruled. |
| §3 *"never been exercised"* vs §4 *"it did prove the gate is load-bearing"* | Contradictory in one document; §4 is right. |
| *"§4 fences [the strip] out"* | §4 does not mention it. |
| `docs/findings/PUP-WO-0700-adversarial.md` cited as an existing record | **It did not exist.** This file. §6.1 member 4. |

**Reproduced and correct:** the §0 fence (0 lines, verified against `a145734`), `36/600 =
6.000%`, the `0.0104pp` rounding, the 660px spread, all three RED numbers, `STICKER_W_FRAC`
declared once, and *"RESHARE is not painted when unconfigured"*.

---

## Probed, nothing found — stated as results

- **No uncaught page errors** anywhere across probes A–D.
- **Nothing orphaned on `document.body`** after any close-during-transfer sequence: RESHARE
  then immediate close, close during decode, CAPTURE then immediate close. Console reachable
  in one tap every time.
- **No double-send on a fast double press** — the `busy` latch holds, and the 1400ms re-arm
  then allows a genuine second send.
- **Multiple stickers, corner placement, and `deviceScaleFactor` 2 and 3** all burn at
  exactly their recorded percentages. DPR 2 was numerically identical to DPR 1.
- Portrait viewports never reach the app — `#portraitBlock` covers it, by design.

**UNVERIFIED, and it matters:** every measurement is a CI viewport with a synthetic
3840×2160 16:9 camera. **The real tablet's camera aspect and chrome heights will change the
magnitudes** — not the sign or the mechanism. The sticker was reported from a device, and
the fix has not been seen on one.
