# PUP-WO-0602 — The radar's long press, on both phones

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `fc9a3f6`; **verify live HEAD**).
**Branch:** `build/wo-0602`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P6 — shipped-app remediation. **This reaches the device Buddy uses.**
**Subject SHA:** citations resolved at **`fc9a3f6`**, paired with symbols.

**Grounds:** northstar invariants 1 and 2 · architecture §3 (the fleet) · `PUP-WO-0000.md`
§8.2 obligation 2 · roadmap P6 · **Scotty, on both phones.**

> **What this is:** the long press on the radar — **the feature this app exists for** —
> does not spawn an X. **On the S10+ the browser's context menu opens instead. On the
> S25 Ultra nothing happens at all.** Two symptoms, one gesture, two devices.

**Cadence:** build. One PR, left unmerged. **Verified on BOTH phones before it closes.**

---

## 0. IT IS NOT A REGRESSION, AND THAT IS THE MOST IMPORTANT THING IN THIS DOCUMENT

**Established at source, not assumed:**

- **`git log -L 3333,3360:index.html` returns EXACTLY ONE COMMIT — `f64db7e "Add files
  via upload"`.** The long-press block has **never been modified** since the original
  import. Not by P2, not by P3, not by any work order.
- **There are ZERO global `document`/`window` listeners for `pointer*`, `touch*` or
  `contextmenu` in the entire file.** Nothing the games work added can intercept this;
  every listener P2/P3 introduced is bound to its own element.

**So nothing we built broke this.** The honest reading is that **the app's core feature
has never worked on an Android phone**, and nobody long-pressed the radar on one until
now. *Calling it a regression would put the blame on recent work and, worse, would imply
the earlier build was verified on hardware when it was not.*

**ONE ALTERNATIVE MUST BE TESTED BEFORE THAT IS ACCEPTED, AND IT IS CHEAP.** Scotty's
screenshots are **Chrome tabs**. `manifest.json` declares `display: fullscreen`, and an
**installed PWA can handle long-press differently from a browser tab.** *If it works
installed and fails in a tab, this is an environment difference rather than a dead
feature — and the fix, the urgency and what we believe about the earlier build all
change.* **Test installed vs tab on BOTH phones first, and report that before fixing
anything.**

## 1. DEFECT A — nothing prevents the context menu. Verified.

**`contextmenu` occurs ZERO times in `index.html`.** Android Chrome fires it on long
press and nothing calls `preventDefault`, so the browser's menu wins.

**And the two properties that look like they would cover it do not.** `html, body` carry
`touch-action:none` and `user-select:none` (`index.html:17`); **neither suppresses
`contextmenu`**, and **`-webkit-touch-callout` occurs ZERO times.** *That is the S10+
symptom exactly.*

## 2. DEFECT B — no `pointercancel` on the radar, and the shell already has the remedy

The radar binds **`pointerdown`, `pointerup`, `pointerleave` and nothing else**
(`index.html:3333-3357`). **When the browser claims a gesture it fires `pointercancel`,
and that path is unhandled** — so the timer's fate depends on which event the device
chooses to send. *That is the most likely shape of the S25's silence: the two phones
resolve one gesture through different events and only some paths are wired.*

**THE FILE ALREADY CONTAINS THE FIX, TWICE, AND THE RADAR PREDATES BOTH:**

| | |
|---|---|
| `wireTap` | `index.html:2100` — `addEventListener('pointercancel', … armed = false)` |
| a panel slider | `index.html:2474` — `addEventListener('pointercancel', endDrag)` |
| **the radar** | **none** |

**`wireTap` is the shell's own child-tap idiom and the radar does not use it** — it calls
`addEventListener` raw, because it was written before `wireTap` existed. **This is the
same shape as `.bp-drag[hidden]`: the remedy is in the file, applied to the newer code,
and the older code never went back for it.**

**RULE WITH EVIDENCE, DO NOT ASSUME: should the radar use `wireTap`?** It already handles
`pointercancel`, the second-finger case and the sliding tap — all three of which a
three-year-old produces. **But it is a TAP helper and this is a LONG PRESS**, so it may
not fit. **Read it and say which, with the reason.** If it does not fit, the long press
needs the same three properties built deliberately rather than inherited by accident.

## 3. BOTH PHONES, OR IT IS NOT FIXED

**Two devices, two different failures, one gesture. A fix verified on one phone is
exactly what we already have.** Acceptance requires, on **both** the S10+ and the S25
Ultra, **installed and in a tab**:

1. A long press on the radar spawns an X **and no context menu appears.**
2. The X reaches the other device *(both connected; this is the feature)*.
3. A short tap still spawns a paw and **does not** spawn an X.
4. A long press **interrupted** — finger dragged off the radar, a second finger landing,
   the browser claiming the gesture — leaves **no X and no stuck timer**, and the next
   ordinary tap still works. *(That is defect B's real test.)*
5. **Nothing else on the console loses its context menu or its text selection.** A
   blanket `preventDefault` on `document` would satisfy §1 and break the adult surfaces;
   **scope the suppression to the radar.**

**DO NOT GUESS WHICH DEVICE DOES WHAT.** Scotty has both. **Where a claim needs hardware,
build the check, state that it is unverified, and stop** — a measurement that looks like
a device result and is really a desktop result is worse than none.

## 4. Fence · 5. Pass · 6. Feedback

**Only `index.html` and, if a check is added, `.github/ci/demo-*.mjs`.** `sw.js`,
`manifest.json`, the icons, and **all three of `games/`** diff to empty.

**`index.html` IS SERVED FROM `main:/`, SO THIS MERGE REACHES THE ROOT BUILD** — P6's
dependency note is real. `/stable/` is unaffected and stays Scotty's.

**Security lens: NO.** *(architecture §5 — this reads no byte the device did not create.
`pushXMark` sends one; it does not parse an inbound payload. If the build touches the
RECEIVE path, that is a different work order and a flag-and-stop.)*

Right-sized pass. **Every new check red with a plant that is a real defect and parses.**
Probe: a long press that slides; a second finger mid-press; a press interrupted by the
context menu; a press with Supabase unconfigured; and the same five on both phones.

`FEEDBACK.md` parked with the work. Order: build → freeze → pass → disposition → feedback
→ PR. **Flag-and-stop:** a document-level `preventDefault`; any change to the receive
path; any claim about a phone that was measured on a desktop; a check you cannot show
going red.
