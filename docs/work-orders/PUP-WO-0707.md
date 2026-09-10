# PUP-WO-0707 — Vendor Leaflet, and delete a third-party origin

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0707-vendor`. **Author:** CC-A · **Builder:** the PupPad builder.
**Phase:** P7. **Subject SHA:** cite **symbols**.

**Grounds:** `docs/northstar.md` invariant 3 and its 2026-09-04 basemap exception ·
`PUP-WO-0705` §A (Scotty's ruling, 2026-09-10) · `docs/architecture.md` §10.

> **What this is:** Scotty ruled that Leaflet is vendored into the repo and
> `cdnjs.cloudflare.com` is dropped rather than ratified. **This is the only work order in
> weeks that MUST touch `sw.js`** — read §0a before assuming the usual fence.

**Cadence:** build. One PR, left unmerged.

## 0a. THE FENCE — AND IT IS DELIBERATELY WIDER THAN RECENT ONES
**MAY change:** `index.html`, `sw.js`, a new vendored asset directory, `.github/`, `docs/`.
**MUST diff to empty:** `manifest.json`, both icons, `games/`.

**`sw.js` IS IN SCOPE AND MUST CHANGE.** Check 2 asserts every local asset `index.html`
references appears in `urlsToCache`; a vendored file that is not listed **is a broken image on
a cold offline device and a green check.** *(This is the "module-referenced assets" trap this
project already recorded, arriving for real.)*

## 1. SCOPE

1. **Vendor Leaflet 1.9.4 — the JS and the CSS** — into the repo, and point `index.html` at
   the local paths.
2. **Add both to `urlsToCache`.**
3. **Bump `CACHE_VERSION`** — check 3 requires it when a cached asset changes.
4. **Leave `cdn.jsdelivr.net` (supabase-js) ALONE.** §A.3 raised it and **Scotty has not ruled
   on it.** *Do not vendor it on your own judgement; do not remove it.*
5. **`PUP-WO-0705`'s allowlist loses its cdnjs entry** once this lands. **Coordinate, do not
   duplicate:** if #70 is still open, say so and let CC-A sequence it.

## 1a. PROVENANCE IS NOW OURS, AND THAT IS THE NEW OBLIGATION

**Vendoring trades "trust a CDN each load" for "trust ourselves once."** That is the better
trade **and it is not free**: the bytes in the repo are now unverifiable by anyone downstream
unless we say where they came from.

- **Record the exact source URL and the SHA-256 of each vendored file**, in a comment beside
  it and in `FEEDBACK.md`.
- **Verify the download against the published integrity hash** for Leaflet 1.9.4 before
  committing it, and **say in the feedback that you did and what it was.**
- *A vendored library with no recorded provenance is a supply-chain assertion with no
  evidence — the same defect class as a comment claiming coverage nothing tests.*

## 2. INVARIANTS
- **3 — every core surface works with no network.** This work order **moves the Map panel
  toward it**: after this, the panel's own code is local and only the tiles are remote.
- **6 — a game is a data change.** Untouched; no game module is involved.
- **7 — one build's assets, never a mixture.** The `CACHE_VERSION` bump is what preserves it.

## 3. ACCEPTANCE
1. **The fence holds** — `manifest.json`, icons and `games/` diff to empty, **three dots**.
2. **`cdnjs.cloudflare.com` is contacted ZERO times** on a cold load and across all eight
   pads — measured by `PUP-WO-0705`'s own check, not by grep.
3. **The Map panel opens and renders the basemap** with cdnjs blocked. *That is the whole
   point: today it throws `L is not defined`.*
4. **Check 2 passes** — both vendored files are in `urlsToCache`.
5. **`CACHE_VERSION` bumped**, check 3 green.
6. **Provenance recorded** — source URL and SHA-256 for each file, and the integrity check
   stated.
7. **The offline cold start still works**, and **say what this costs**: a `CACHE_VERSION` bump
   reaps runtime-cached tiles, and this project has measured that taking the map from
   **24 of 24 tiles offline to 0 of 24**. *This bump will do it once. State it rather than
   letting Scotty discover it.*
8. Every demonstration asserts the commit and the failing step name.

## 4. SCOPE FENCE — NOT here
- **supabase-js / jsdelivr** — §A.3, Scotty's to rule.
- **The tile origin itself** — ratified, stays.
- **`PUP-WO-0706`** — the camera, in flight and ahead of this in severity.

## 5. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze **into a new directory**, corrections held.
Probes: the vendored file absent from `urlsToCache` · a stale `CACHE_VERSION` · the CSS
vendored and the JS not · a cold offline start after the bump · **a plant that applies without
reproducing** · an assertion that passes because Leaflet was never loaded at all.

## 6. FLAG-AND-STOP
- **Any need to touch `manifest.json`, an icon, or `games/`.**
- **A vendored file whose hash you cannot verify against a published one.**
- Removing or vendoring supabase-js.

## 7. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
