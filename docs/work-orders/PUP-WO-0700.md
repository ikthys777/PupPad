# PUP-WO-0700 — The sticker anchor, and two share buttons

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0700`. **Author:** CC-A · **Builder:** to be assigned.
**Phase:** P7 · **Phase exit gate:** `docs/roadmap.md` P7, items 1, 2, 5, 6.
**Depends on:** `PUP-WO-0301` merged — it also edits `index.html` and there is one
builder.
**Grounds:** `docs/northstar.md` invariants 1, 3, 5 · `docs/architecture.md` §5 ·
`docs/roadmap.md` P7 · `index.html`.

> **What this is:** one shipped defect and two one-tap buttons, all in `index.html`'s
> camera and gallery surfaces. It is **NOT** voice (`PUP-WO-0701`), not a game, and
> not `sw.js`.

**Cadence:** build. One PR **opened at park**, left unmerged for review.

---

## 0. THE FENCE — stated ONCE, referenced everywhere, restated nowhere

**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.

**The gate CC-A runs at merge is exactly this block**, pasted into the merge commit.

## 1. The sticker defect — diagnosed, verified, and it is the project's own recurring shape

**Symptom (Scotty, on a device):** *"stickers don't stay anchored once it converts to
the smaller size."*

**Verified at source on `main` by CC-A, by symbol rather than line number:**

- ~~**Position is proportional in both paths and is CORRECT.** The preview writes
  `left:xPct% top:yPct% transform:translate(-50%,-50%)`; the burn computes
  `px = s.xPct/100*w`, `py = s.yPct/100*h`. **Nothing is wrong with the placement.**~~

  > **STRUCK 2026-09-02. THIS WAS FALSE, AND CC-B REFUTED IT AT SOURCE.** Position is
  > wrong whenever the photograph is letterboxed — **7 of the 9 viewports measured**.
  > `#camReviewCanvas` is `object-fit:contain` and `#camStickerLayer` is `inset:0` over
  > the same box, so the tap is taken against the ELEMENT box and applied to the
  > CANVAS; the two agree only at exactly 50%, or when the photo fills the box. At
  > 1920x500 the sticker landed **214px** from where it was placed.
  >
  > **The lesson is about the verification, not the geometry.** This section was
  > checked at source, by symbol rather than line number, and it was still wrong —
  > because it confirmed that both paths use a *percentage* and never asked
  > **a percentage OF WHAT**. Confirming an expression is not confirming its
  > coordinate system. Architecture §6.1 gains member 7 for this: *a check that
  > resolves the reference and stops one layer short of the frame it is expressed in.*
- **Size is proportional in ONE path only.** The preview hardcodes
  **`font-size:36px`**. The burn computes **`sz = Math.round(w * 0.06)`**.

**So the two agree only where `w * 0.06 ≈ 36`, i.e. `w ≈ 600`, and diverge
everywhere else.** A differently-sized emoji at the same centre covers different
content, which is exactly what "not anchored" looks like to someone holding the
device. *(Diagnosis raised by the co-architect and confirmed by CC-A at source.)*

**THE FIX IS ONE EXPRESSION, NOT TWO THAT MUST AGREE.** A single scale constant,
applied to whichever width is in play — the preview layer's width in the preview, the
canvas width in the burn. **Two expressions that must agree is the defect class this
project has paid for most** (architecture §5's fence-stated-once ruling is the same
shape one level up), and replacing one hardcoded number with a matching second
hardcoded number would reproduce it.

**The test follows from the fix:** §3.2 checks three rendered widths, because a single
width cannot distinguish "correct" from "correct at 600px."

## 2. The two buttons

- **CAPTURE** — on a received shared image, pull it into this device's own gallery.
  **AND FIRST, ANSWER WHAT THAT MEANS, because it is not obvious:** measured
  2026-09-02, `cameraGallery` is a **plain in-memory array persisted nowhere**, and
  **`closeCamera()` empties it** — so today "its own gallery" survives only until the
  panel closes. **Capturing into a store that dies on close may be exactly right**
  under Scotty's *"cache-only… because kids"*, and it may be useless. **Rule it in the
  feedback before building the button**, and if it needs to persist, that is a
  flag-and-stop and a separate decision, not a quiet `localStorage.setItem`.
- **RESHARE** — on an expanded cached image, send it out again.

**Both one-tap and operable by a non-reader.** Icons carry the meaning; any word is
for the adult. **Follow the existing gallery affordances rather than inventing a new
control language** — a child who has learned one gesture should not need a second.

**Gate them exactly as the existing panels do:** `isSupabaseConfigured()`, the same
`if (!isSupabaseConfigured()) return` shape used at every current call site. **Do not
invent a new gate.**

## 3. Acceptance — proven, not asserted

1. **The fence in §0 holds.** Run it, paste it, do not restate it.
2. **The sticker lands at the same proportion at THREE different rendered widths**,
   demonstrated with images — one of which must be well away from 600px wide.
3. **One expression demonstrated:** show that preview and burn read the same constant.
   *A grep proving there is no second literal is the cheapest form of this.*
4. **CAPTURE and RESHARE each in one tap**, and **pressed with a finger, not
   `page.click`** *(architecture §6.1 member 6)*.
5. **Supabase unconfigured:** both buttons degrade like the existing panels, the
   console stays usable, nothing traps.
6. **One tap back from every state.**
7. **Every demonstration asserts the commit and the failing step name.**

## 4. Scope fence — NOT in this work order

- **Voice** — `PUP-WO-0701`.
- **The sticky `state.pop` toast** on panel gates — `PUP-WO-0106`'s §3.2 question.
- **`sw.js`, games, the picker** (§0).

## 5. Adversarial pass

Black-box, fresh subagent. **Freeze protocol (architecture §5):** `git archive` for a
read-only pass; `git clone` when git-dependent checks must run; **never `cp -r` of a
worktree.** SHA-256 at freeze, re-verified at disposition, **and read the feedback
file as a deliverable, measuring its claims** (§6.1 member 5).

Probes: make the sticker diverge at some width the fix did not consider; capture or
reshare something that is not an image; strand the child mid-transfer; press
everything with two fingers and with a sliding tap.

## 6. Upward feedback

`docs/feedback/PUP-WO-0700.md`; verbatim exchange in
`docs/findings/PUP-WO-0700-adversarial.md`.

## 7. Flag-and-stop

- Any need to touch `sw.js`, `manifest.json`, an icon, or `games/` (§0).
- **The single-expression fix proving impossible** because the two coordinate spaces
  cannot be reconciled — that is a finding, not a licence to ship two constants.
- A button that cannot be made operable by a non-reader.
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-02 from Scotty's device testing. **The sticker diagnosis is
the co-architect's**, confirmed by CC-A at source rather than accepted: position
correct in both paths, size proportional in one. **It is the two-expressions-that-must-
agree class, which is the most expensive recurring shape in this project.**
