# PUP-WO-0705 — The tile exception lives in the mechanism, not only in prose

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0705-thirdparty`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P7. **Subject SHA:** cite **symbols**.

**Grounds:** `docs/northstar.md` invariant 3 and §5, **both amended 2026-09-04** with one
named exception · `docs/architecture.md` §5, §10 · Scotty's ruling.

> **What this is:** Scotty ruled that the OpenStreetMap basemap stays, and the northstar
> now carries that as a **named exception** rather than a contradiction. **This work order
> is the other half of his ruling: the exception must live in a check, not only in a
> document.** Until it does, nothing stops a SECOND third-party origin arriving, and
> nothing distinguishes the approved one from a new one.

**Cadence:** build. One PR, left unmerged. **Small and self-contained by design.**

## 0a. THE FENCE
**MAY change:** `.github/`, `docs/`.
**MUST diff to empty:** `index.html`, `sw.js`, `manifest.json`, both icons, `games/`.
*(This work order changes no product behaviour. If you believe it must, that is a
flag-and-stop.)*

## 1. SCOPE — an allowlist of exactly one, asserted

**A new check that enumerates every origin the app contacts on a cold load and on opening
each panel, and asserts the set equals a declared allowlist.**

- **The allowlist is DECLARED IN ONE PLACE and cited, never duplicated.** Two copies of an
  allowlist drift, and then one is wrong while both look authoritative.
- **`tile.openstreetmap.org` is IN it, with the northstar amendment date beside it.**
- **A NEW third-party origin must go RED**, and that is the whole point of the work order.
- **The Leaflet and supabase-js CDN loads are NOT approved** — architecture §10 keeps them
  open. **Decide and say plainly** whether they belong in the allowlist as *recorded but
  unratified* or whether the check fails on them today. **If including them makes the
  check green on something nobody has ruled, say so rather than quietly allowlisting it.**
  *This is the one genuine judgement in the work order; bring it back with a
  recommendation rather than deciding it silently.*

## 2. INVARIANTS

- **3 — every core surface works with no network, EXCEPT the Map panel's basemap** by the
  2026-09-04 amendment. **A check that reds on the basemap is testing the exception, not a
  defect.** Do not "fix" the map.
- **6 — a game is a data change.** No game reaches a third-party origin; check 11 already
  covers that and this does not replace it.

## 3. ACCEPTANCE

1. **The fence holds** — `index.html`, `sw.js`, `manifest.json`, icons and `games/` diff
   to empty, checked as a command.
2. **The check goes RED on a planted second third-party origin**, and red **for its own
   stated reason**.
3. **The check goes GREEN on the tile origin alone** — and its pass line **names the
   exception and its date**, so a reader of a green run learns the exception exists.
4. **A control demonstrates the plant reproduces**, not merely that it applies.
   *A plant that applies is not a plant that reproduces* — architecture §5.
5. **The check installs and restores its own witnesses** and passes under `--only`.
   *A witness inherited from a neighbour is not a witness* — architecture §5.
6. **Registered in `ci.yml` in the same commit that adds it**, with its controls. Check 25
   enforces the equality; do not make it do so after the fact.
7. Every demonstration asserts the commit and the failing step name.

## 4. SCOPE FENCE — NOT here
- **Changing what the app fetches.** Not one byte of product behaviour.
- **Bundling tiles, lowering `maxZoom`, or removing the basemap** — all three were costed
  and **Scotty chose to keep it as is.** Do not reopen.
- **Resolving the Leaflet / supabase CDN question** — architecture §10, and it is Scotty's.
  Surface it; do not settle it.
- **The voice panel and Block Pop** — `PUP-WO-0703`, `0704`.

## 5. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze, corrections held until it returns.
Probes: a second origin added on a path the drive never walks · an origin reached only
after a panel opens · the allowlist satisfied by a substring rather than an origin
(`evil-openstreetmap.org.attacker.net`) · a check that passes because nothing was fetched
at all rather than because only the allowed thing was · the arrange failing silently.

## 6. UPWARD FEEDBACK — `docs/feedback/PUP-WO-0705.md`
**Lead with the Leaflet/supabase judgement and your recommendation.**

## 7. FLAG-AND-STOP
- **Any need to change `index.html`, `sw.js`, `manifest.json`, an icon, or `games/`.**
- A check that cannot be made to fail on a second origin.

## 8. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
