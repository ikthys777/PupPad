# PUP-WO-0700 — upward feedback: one expression, and a store that dies on purpose

**Builder:** CC-B. **Branch:** `build/wo-0700`, from `origin/main` at `a145734`.
**Work order:** `docs/work-orders/PUP-WO-0700.md`.
**Adversarial record:** `docs/findings/PUP-WO-0700-adversarial.md` — **it found that the
fix this work order exists to make was still wrong, and that the check written to prove it
was blind to that by construction. Read it first.**

> **PROCESS CORRECTION, ruled by Scotty during this work order:** *"you should be running
> adversarial pass before you write the feedback doc that goes along with the PR."* He is
> right, and this document is the evidence — the version frozen at `0b74487` asserted six
> things the pass then falsified, for the second work order running. **A draft is still
> frozen with the code, because the pass is required to measure the feedback file's claims
> (§6.1 member 5) and that is exactly how those six were caught. But the draft is a thing
> to be attacked, not the thing that ships.** This is the post-pass document.

---

## 0. The fence (§0), as a checkable fact

```
$ git diff origin/main -- sw.js manifest.json icon-192.png icon-512.png games/ | wc -l
0
```

Changed: `index.html`, `.github/`, `docs/` — the three §0 permits and nothing else.

## 1. §2's question, ruled BEFORE the button was built

**The work order was right that it is not obvious, and the answer is not the one the
question implies.**

Measured on `main`: `cameraGallery` is a plain in-memory array, persisted nowhere, and
`closeCamera()` empties it. So "capture into this device's own gallery" buys a snap that
**lives until the camera panel is next closed, and no longer.**

**That is the right store — and the reason is what the button replaces, not what it
achieves.** Today an incoming snap is **gone in four seconds**: `showRemotePhoto` fades its
own popup and there is no way at all to keep it. *"Until you close the camera"* against
*"four seconds"* is an enormous difference to a child looking at a picture someone just
sent, and it is exactly the retention `PUP-WO-0701` §1.0a already ruled for this app —
in-memory, never `localStorage`. *(Precisely: the "cache-only… because kids" quote is
`PUP-WO-0701` §1, not §1.0a, and §1.0a rules **session**-scoped retention — "everything is
reaped on PWA close or reset". A store `closeCamera()` empties is **stricter than** what
§1.0a ruled, not "exactly" it. The earlier draft cited the wrong section.)*

**AND THE SHIPPED BEHAVIOUR IS NEITHER, which the pass found and I had not.**
`closeCamera()` never unsubscribes the broadcast channel, so once the camera has been opened
the incoming-snap popup appears **over the console** for the rest of the session — and
CAPTURE there stores into an array with no renderer and no cap. So "lives until the camera
panel is next closed" is wrong: it lives until the camera is next **opened and then** closed,
which may be never. **That is an unbounded in-memory store with no UI. Recorded as owed
rather than quietly fixed** — unsubscribing on close changes the channel lifecycle, which is
not this work order's surface.

**Making it outlive the panel is a different decision with a different risk**, and §2 makes
that a flag-and-stop rather than a quiet `setItem`. **It is not made here.** If CC-A or
Scotty wants a snap to survive a panel close, that is a work order about storage, quotas
and what a three-year-old can accumulate unsupervised — not a line in this one.

**One consequence I did build:** the four-second fade is **cancelled on press**. Four
seconds is not long for a three-year-old to notice a new button, decide, and aim at it, and
a control that disappears mid-reach punishes hesitation. Check 20 asserts the button is
still on screen after three seconds.

## 1a. THE FIRST FIX WAS WRONG, and this is the most important thing in this document

**Removing the second CONSTANT left a second ANSWER.** `#camReviewCanvas` is
`object-fit: contain` and `#camStickerLayer` is `inset:0` over the same box — so the layer
is the **element** box and the photograph is **letterboxed inside it**. Sizing the preview
at 6% of the layer and the burn at 6% of the canvas is the same fraction of two different
rectangles. On a 1920×500 viewport the sticker was **62% too small and 214px out of place**.

**And the check I wrote could not see it.** It divided the preview by the layer width and
the burn by the canvas width — **the two denominators that make the mismatch cancel** — and
reported `worst disagreement 0.0104 points` while the defect was present in two of its own
three viewports. **Architecture §6.1 member 6, in the check written to close member 6.**

**Also false, and it is the work order's diagnosis rather than mine:** *"position is
proportional in both paths and is CORRECT."* It is correct only where the image fills the
box; everywhere else it drifts by the same mechanism, at 7 of the 9 viewports the pass
measured.

**The fix is one more thing said once: WHERE THE PHOTO IS.** `photoBoxIn(layer, canvas)`
computes the displayed image rect; everything the child places is a fraction **of the
photo** in both paths, and the layer is only a surface to draw the preview on.
`layoutStickerEl()` is re-runnable, so a resize between placing and saving no longer strands
the preview at a stale size. A tap on the black bar is **refused** rather than mapped onto
the photograph.

**Measured on screen, in CSS pixels — the unit the defect is felt in:**

| viewport | letterbox | preview | burn on screen | centres apart |
|---|---|---|---|---|
| 1024×640 | 43px | 58.9px | 58.8px | **0.0px** |
| 780×560 | 0px | 46.8px | 46.7px | **0.0px** |
| 1920×500 | **1188px** | 43.9px | 43.9px | **0.0px** |

**Shown red against the defect I shipped**, same check, one function reverted:
`1920x500 — preview 115.2px vs burn 43.9px, centres 214.0px apart`. **That reproduces the
adversarial pass's independently-measured 214px exactly, from a different instrument.**

## 2. §1 — the sticker, and why the fix is one function rather than one number

**The diagnosis was exact and I confirmed it at source before changing anything.** Position
is proportional in both paths and was never wrong. **Size was proportional in one:**

| | before | after |
|---|---|---|
| preview | `font-size:36px` | `font-size: stickerFontPx(rect.width)` |
| burn | `Math.round(w * 0.06)` | `Math.round(stickerFontPx(w))` |

`STICKER_W_FRAC = 0.06` is declared **once**, and both paths reach it through one function.
Replacing the hardcoded `36` with a second hardcoded number computed from `0.06` would have
reproduced the defect at the next change — which is the whole point of §1's ruling and the
same shape as architecture §5's fence-stated-once rule one level up.

**A third thing was wrong and the work order did not name it: `line-height`.**
`transform:translate(-50%,-50%)` centres the element's **box**, and with the default
line-height that box is about 1.2em tall, while the burn's `textBaseline:'middle'` centres
the **em box**. So the preview sat a fraction of a line above where the burn would put it —
at every width, including 600px, where everything else agreed. `line-height:1` makes the
two centrings agree. **Found by measuring the burned position against the placed position
rather than by reading the code**, which is why the check asserts position as well as size
even though position was supposed to be the half that was already correct.

### The measurement, at three widths, through the shipped path

The burn is **observed, not inferred**: `getContext` is wrapped before the app loads, so
what is asserted is what the shipped save handler actually asked the canvas to draw.

```
layer 1024px / canvas 3840px:  preview 6.000%  vs  burn 5.990%
layer  780px / canvas 3840px:  preview 6.000%  vs  burn 5.990%
layer 1440px / canvas 3840px:  preview 6.000%  vs  burn 5.990%
```

**THIS MEASUREMENT WAS THE BLIND ONE — see §1a.** It is kept because the shape of the
mistake matters more than the numbers: both fractions were correct *in their own coordinate
system*, and the check compared them in neither. The superseding measurement is §1a's, in
screen pixels. Worst disagreement **0.0104 percentage points**, across a 660px spread
including one well away from 600px. *(The residual 0.01 is `Math.round` on a 3840px canvas:
230.4px asked, 230px drawn. It is a rounding of one pixel in 3840 and it does not scale with
width.)* Position lands within **0.10 percentage points** of the 32%/41% it was placed at, at
every width.

### Shown RED against the original defect — and the trap named

The same check, same commit, one line reverted to `font-size:36px`:

```
layer 1024px:  preview 3.516%  vs  burn 5.990%
layer  780px:  preview 4.615%  vs  burn 5.990%
layer 1440px:  preview 2.500%  vs  burn 5.990%
CHECK 20 FAILED — 2
```

**The sticker was between 42% and 77% of its correct size depending on how wide the screen
happened to be.** *(An earlier draft said "42% and 240%". From its own three data points the
range is 41.7%–77.0% — the defective sticker was **never larger** than correct. `240%` was
the 1440px point read backwards and presented as the other end of a range. It shipped in
`ci.yml` too; both are corrected.)* And `36 / 600 = 6.000%` exactly — so at a 600px-wide preview the old code
was *indistinguishable from correct*. **That is why §3.2 asks for three widths and why one
of them has to be far from 600**, and it is now a fact in the check's output rather than an
argument in a document.

## 3. §2 — the two buttons

**CAPTURE** (📥, on the incoming snap) and **RESHARE** (📤, on the expanded gallery image).
An arrow into a tray against an arrow out of one — **the same in-versus-out pairing the game
panel's attract/repel control already uses**, so a child who has learned one has learned
both. No word is painted on either; `aria-label` carries the meaning for a screen reader,
which is a different audience from a non-reader and costs nothing.

Both follow the gallery's **existing** affordance language — a rounded pill at the corner of
the surface, the shape `.gClose` already uses — rather than a new control vocabulary for two
buttons. Both go through `wireTap`, so both survive a tap that slides and a tap made with a
second finger already on the glass; check 20 presses each all three ways.

**RESHARE recompresses through `compressForBroadcast` rather than sending the stored bytes.**
The gallery holds an 800px JPEG at 0.85; this app broadcasts 600px at 0.7, and
`compressForBroadcast` is the single place that decides that. Sending the stored bytes would
have been a second answer to "how big is a broadcast" — **the same two-expressions shape §1
of this work order exists to remove** — and would have put several times more data on the
wire.

### The gate

`isSupabaseConfigured()`, the same `if (!isSupabaseConfigured()) return` shape used at every
current call site. Two notes, both stated rather than left to look like oversights:

- **RESHARE is not painted at all when unconfigured.** The guard is still there and is the
  load-bearing one; the same predicate also decides whether the control is drawn, because a
  button a non-reader presses and which does nothing is invariant 1's problem. That is the
  same gate used twice, not a second gate.
- **CAPTURE's guard cannot fire today.** The popup it lives on only exists because a
  broadcast arrived, which requires Supabase. It is kept because a guard that is unreachable
  by construction *now* becomes reachable the moment someone calls `showRemotePhoto` from
  somewhere else — but I would rather record that it is currently decorative than have it
  read as a load-bearing check that has never been exercised.

## 4. What did not work, and why

- **My check named the wrong subject.** The structural assertion for the burn matched
  `/var sz\s*=\s*[^;]+;/` — and there are **four** `var sz` in `index.html`. It matched
  `scaledWidth(vsize)` four hundred lines away in an unrelated surface and reported the fix
  missing while it was present. Now anchored inside the `reviewStickers.forEach` block.
- **My fixture invented the storage keys.** I wrote `supabaseUrl`/`supabaseKey`; the app
  reads `puppad_sb_url`/`puppad_sb_key`. `isSupabaseConfigured()` stayed false and six
  assertions failed for that reason instead of their own — §6.1 member 3. *It did prove the
  gate is load-bearing: with the app unconfigured, CAPTURE refused and RESHARE was never
  painted.* Then I fixed the setter and not the clearer, so the "unconfigured" section
  tested the configured path a second time. Both now read the key names out of the source.
- **§3.3 asks for a grep proving there is no second literal, and a bare grep is useless
  here** — `0.06` matches a dozen `rgba(…,0.06)` alpha values in this file. The claim is made
  structurally instead: the fraction is declared exactly once, and both the preview and the
  burn are matched as reaching it through `stickerFontPx`. A grep that answers a different
  question is not cheaper, it is wrong.

## 5. What was deliberately NOT done

- **No persistence.** §1 above; it is a flag-and-stop and it stays flagged.
- **`sw.js`, `manifest.json`, the icons and `games/` are untouched** (§0), verified.
- **Voice**, the sticky `state.pop` toast, and `PUP-WO-0106` — fenced out by §4.
- **The gallery strip is still wired on bare `click`.** A tap that *slides* does not open a
  photo from the strip. That is a real defect of exactly the family this project has been
  bitten by three times, but Draw, Camera and Map are named in `wireTap`'s own comment as
  **`PUP-WO-0106`'s**, and §4 fences it out. **Recorded here so it is not rediscovered as
  new.** Check 20 uses a plain tap on the strip so that surface is not what fails.

## 6. Open, and not mine

- **Whether "until the camera closes" is the retention Scotty wants.** §1 rules it correct
  under the existing cache-only ruling; only he can say whether a child losing a captured
  snap on panel close is disappointing or is the point.
- **The three widths are CI viewports, not the tablet.** The proportion is now width-
  independent by construction, which is a stronger claim than any single measurement — but
  **a passing suite is not evidence a tool works**, and the sticker was reported from a
  device, not from a check.

## 7. What the adversarial pass changed — the table

**Every one of these was green before the pass ran.** Reproductions in
`docs/findings/PUP-WO-0700-adversarial.md`.

| # | found | severity | disposition |
|---|---|---|---|
| 1 | **The sticker fix was still wrong** — preview and burn sized against two different rectangles because the canvas is `object-fit:contain`. Up to **62% too small, 214px out of place**. | **critical** | `photoBoxIn()`; both paths a fraction of the **photo**. |
| 2 | **Check 20 was blind to it by construction** — the two denominators cancelled the error exactly. Green in two of its own three viewports. | **critical** | Rewritten to measure in **screen pixels**; one viewport letterboxes by 1188px on purpose. |
| 3 | **Position drifts too** — the work order's "position was never wrong" is false whenever letterboxed. | **critical** | Same fix; centres now asserted, 0.0px at all three widths. |
| 4 | **A broadcast payload executed script**, and CAPTURE extended it from one sink to three and made it persist. | **critical** | URL **assigned**, never concatenated, at all three sinks. |
| 5 | **CAPTURE stored anything** and showed a tick — text, truncated base64, `javascript:`, empty string, 8MB. | high | Validated at the point of storage; six junk shapes asserted refused. |
| 6 | **RESHARE latched dead forever** on a load that never settles, under a comment claiming to cover that case. | high | 4-second timeout. |
| 7 | **The only exit from a full-screen modal was bare `click`** — eleven lines from a SEND button this WO wired on pointer events. | high | `.gClose` through `wireTap`; closed with a sliding tap in the check. |
| 8 | **A sticker placed on the black bar** was burned onto the photograph. | high | Refused. |
| 9 | **The preview never recomputed on resize** — 1.72 points of drift, 8.6× the check's gate. | medium | `layoutStickerEl()` re-run by a `ResizeObserver`. |
| 10 | **Ten planted defects passed the check** — storing garbage, sending the wrong image, bypassing the compressor, `line-height` removed, a doubled constant. | medium | Seven now caught; see the findings file. |
| 11 | **Six false claims in this document**, including a code comment asserting a grep result the same document called useless. | medium | Corrected above, each named. |

**Accepted, not fixed, and stated as trades:** the fade-cancel's *justification* was wrong
so the justification was rewritten rather than the code; duplicate `snapCaptureBtn` ids
across concurrent popups; the channel that never unsubscribes (§1); and the camera panel's
other controls, which remain `PUP-WO-0106`'s.

**One correction to my own earlier note:** I wrote that §4 fences the gallery strip out. **It
does not** — §4 fences Voice, the sticky toast, and `sw.js`/games/picker. The strip is
`PUP-WO-0106`'s by `wireTap`'s own comment, which is a different and weaker basis. Recorded
so the next reader is not told a fence exists that does not.
