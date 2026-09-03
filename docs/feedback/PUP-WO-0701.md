# PUP-WO-0701 — builder feedback (PART 1: the transport. The voice panel is NOT built.)

**Subject:** `build/wo-0701` on live `main` `d76ae8a`.
**Fence:** `sw.js`, `manifest.json`, icons, `games/` **diff to empty**.

## 0. WHAT IS AND IS NOT IN THIS PR — stated first

**Built and red-proven:** §S.2 (the inbound gate), §S.3 (the unreleased channel), §S.4
(the uncapped array). **These were the prerequisites, and one of them was a live breach on
the shipped app.**

**NOT built:** the voice panel itself — recorder, presets, sliders, playback, send.
**Acceptance items 3–8 are untouched and I am not claiming them.** Reporting a work order
complete when the feature it is named for does not exist is the failure this project has
spent a week refusing to commit; the transport work is a coherent, shippable half and it
is the half that had a security defect in it.

## 1. The fourth `.subscribe(` — resolved before building, as §S.3 required

`:2733` is **`seam.subscribe`, the games control-panel seam — not a Supabase channel** —
and **it does release**: its `unsub()` is called in `panelTeardown` at `:2737`.

**So the finding is unchanged and slightly sharper: three Supabase channels, zero
released.** The fourth is a different mechanism that already does the right thing.

## 2. The breach was real, and the check proves it by watching the network

The plant that restores the pre-fix behaviour produces **an actual HTTP request** to an
attacker-named origin: `the child's device fetched an attacker-named origin (1 request(s))`.

**The assertion is the network, not the regex.** A check that fed strings to
`safeMediaUrl` and compared return values would grade the validator against itself. This
one routes a hostile payload through the real receive path and asserts **the browser made
no request** — the property invariant 3 is actually about.

## 3. THE AUDIENCE — recorded, as §S.5 requires, so it is a choice and not a silence

**Voice will inherit `device_id=neq.<self>` with `self:false`, no per-clip addressing and
no revocation.** Every paired device receives every clip, and nothing can be taken back.

That is **already true of photos today**. It is fine for an X-mark and it is not obviously
fine for a recording of a three-year-old. **Not fixed here — the blast radius is Scotty's
decision** — but it is now written down rather than inherited.

## 3a. FIVE CHECKS WERE UNREGISTERED, AND FOUR OF THEM HAD ALREADY MERGED

CC-A caught check 24 missing from `ci.yml`. **Checking the rest found four more:**

| check | work order | state |
|---|---|---|
| 22 + controls | `PUP-WO-0603` | **MERGED, never ran in CI** |
| 23 + controls | `PUP-WO-0602` | **MERGED, never ran in CI** |
| 24 | this one | not yet merged |

**So the zoom hardening and the radar fix have been on `main` with no CI protection at
all.** Each was written with its controls, each was shown red against a planted defect,
and none of them would have caught a regression in anybody's build but mine.

**The sentence is my own, from `PUP-WO-0400`:** *"A check never seen red is not a check,
AND AN UNREGISTERED ONE DOES NOT RUN."* I wrote it and then shipped three unregistered
checks.

**Why it is easy, and why that matters more than the slip:** the check runs locally, goes
red on the plant, and does its whole job in front of you. **The step that makes it exist
for everyone else leaves no trace when it is skipped.** Nothing fails. CI stays green.
**A missing check and a passing one are the same colour** — which is the same shape as
every "passes by not running" defect this project has spent a fortnight finding, this time
one level up, in the registration rather than the assertion.

All five are registered here, and the job's `timeout-minutes` is raised 20 → 32 **before**
the first run: it already sat at 18m0s green on a 2-core runner and this adds five
browser-bound checks. The last CI budget guessed here was cancelled at 10m17s, and a
cancellation looks exactly like a failure.

**BUILT HERE, RULED BY CC-A, and the reasoning is why it is not a precedent for folding:**
`ci.yml` was already open in this PR and inside the fence — the cheapest moment it will
ever have — and **numbering it means it waits in the queue while unregistered checks stay
invisible, which is the exact failure the item describes.** A parked item about things
being invisible is a shape this project has paid for repeatedly. It is also what keeps the
five registrations *true*: shipping them without it defers the same defect by one work
order.

**Check 25 asserts the EQUALITY, derived from the directory, never a list** — a list goes
stale exactly the way `ci.yml` did, and the next file someone adds is the one missing from
both. It fails closed if the directory match returns nothing, so it cannot pass by finding
no work to do. **Red proof:** adding an unregistered `demo-*.mjs` exits **1** with
`demo-planted-unregistered.mjs is not registered in ci.yml`; removing it exits **0**.
*(Exit codes read directly — not through a pipe, which is how `node --check` was misread
earlier in this same session.)*

**CC-A's half, recorded because they recorded it:** merge discipline verified the fence,
CI green, and the fix at source — **it never asked whether an added check RUNS.** Scope
answers what changed; it does not answer what became active. That is why it reached `main`
three times instead of once, and it is now a standing rule in `TEMPLATE.md`.

## 4. Verdict

| | |
|---|---|
| check 1 | **PASS** |
| **check 24** | **PASS** — 5 assertions |
| **red proof** | the pre-fix gate produces a real beacon request; the check catches it |
| Fence | held |

**Owed and not built:** the voice panel (§2.1–2.3, acceptance 3–8), and the bare-`click`
controls, which §S.4 gave their own number.
