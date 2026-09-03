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

## 4. Verdict

| | |
|---|---|
| check 1 | **PASS** |
| **check 24** | **PASS** — 5 assertions |
| **red proof** | the pre-fix gate produces a real beacon request; the check catches it |
| Fence | held |

**Owed and not built:** the voice panel (§2.1–2.3, acceptance 3–8), and the bare-`click`
controls, which §S.4 gave their own number.
