# PUP-WO-0103 — ROUND 5 FREEZE

**Frozen at HEAD `23d9b427f87be8dce0654c78fb5a75b1e02ef83f`**, branch `build/wo-0103`, 2026-09-01.

**CORRECTION, from the round-5 pass — this file cited a §6.1 member that does not
exist.** It said *"Architecture §6.1 member 5: a record that stays trusted because it
stayed unchanged."* `architecture.md:256` says the family has **four** members and
`:278` says *"In all four…"*; `grep "member 5"` across the whole repository returned
exactly one hit — this file. The IDEA is real and IS in §6.1, at `architecture.md:318`,
as an **unnumbered** paragraph: *"A freeze verifies that the artifact stopped moving.
It does not verify that the artifact was correct when it stopped, and a stale baseline
passes every freeze check there is."* So the number was invented in the act of citing
it, which is member 4 — and it is the worse form of member 4, because a number reads as
a reference and the destination looks like it ought to exist. Whether that paragraph
becomes member 5 is the architect's call, not mine.

The hashes below make this tree tamper-evident during the adversarial pass. They do **not** make its claims true — that is the second half of the
procedure, ratified out of PUP-WO-0105 and required by CC-A's round-5 dispatch:
**`docs/feedback/PUP-WO-0103.md` is itself a frozen deliverable and its CLAIMS are
measured against the tree**, not merely hashed.

Re-verify at disposition with exactly this, from the repo root:

```sh
sha256sum -c docs/findings/PUP-WO-0103-r5-freeze.sums
```

**KNOWN GAP IN THIS FREEZE, found by the pass:** `.github/ci/package-lock.json` is
tracked and is NOT in the list below. `package.json` is. The lockfile is what pins
Playwright, and Playwright is what checks 4, 6, 9 and 10 actually do — so it is the one
tracked file that can change a verdict without changing a hash here. Excluded by a
filter I wrote to keep the table short. It is included in the disposition freeze.

There is no commit-SHA field for this file inside this file. That field is
structurally impossible to get right — a file cannot contain the hash of the commit
that contains it — and PUP-WO-0105 established that removing such a field beats
working around it, because a reader trusts a field.


## Frozen deliverables (21)

| sha256 | file |
|---|---|
| `4d56952b0fb13bf8f9b6c13a6d4c34a075bac3af447636a1df4335d7576e2f97` | `.github/ci/.gitignore` |
| `0ae90bebe45c986764f992b7ec473ecfbf7a53a98938b70cd4fa9b26d4df2e25` | `.github/ci/check-assets.mjs` |
| `1bccba79e65f9166996a9376052bec25e92dd9b7353246d4fdb04ca60b1b03ae` | `.github/ci/check-cache-isolation.mjs` |
| `fd97af461d6dc65010870cc6a06a604b89b3ea8f63fe4d0795b6d3f5b5e45dcb` | `.github/ci/check-cache-name.mjs` |
| `c3688ca4d633a76d2ce9b61f2f509f622a5ad4b6a1fa0cdcd4dd831a86e69390` | `.github/ci/check-error-caching.mjs` |
| `136050bf555527c2fd4c9bce6e0a5f336bd971e5437325e93e7b4586d7b5814d` | `.github/ci/check-load.mjs` |
| `43c3b500e00f87d9318f20d8c7f6662d1b25ae821b59397c07c1cc878e6a9b1d` | `.github/ci/check-mutations.mjs` |
| `a9ad152a4200d561b0d2740ba34cfff0c811cdd14e17012a3d3e7aeecb9bdddb` | `.github/ci/check-syntax.mjs` |
| `b17e50cf065e2666d4184cd8306589194049acef84a6a921dc4d95a06bd44325` | `.github/ci/check-two-trees.mjs` |
| `59d64710116450c178c624f4328ab7134089a096177a3cda91118cf481681cd0` | `.github/ci/demo-error-poisoning.mjs` |
| `a0eda4aea17c9d35fad5bbfd4792ea6581cfeebdbb8ead24c060165b2dc52014` | `.github/ci/demo-quota-install.mjs` |
| `c923e4a07d625078df83958f21232d0466fc351c47965956713c47fd0a917feb` | `.github/ci/demo-two-path-caches.mjs` |
| `02be166f87dc5c24fc2f14ac486b59737cc8a5b6c3ae5af40924bd98e252b03e` | `.github/ci/lib/inline-script.mjs` |
| `8fa34aad69c9010895e50db3ea77d716d3018493446708aa266a0ca56cde8b28` | `.github/ci/lib/sw-cdp.mjs` |
| `44ee253963d2ed4fafaecb24bd6c48ff264b129c759f82dcec875a76176616e6` | `.github/ci/lib/sw-harness.mjs` |
| `dd1b0f948ce4e85d1fc9bb00bb6d9a2e0b2444908c81ddaba82548a99a851426` | `.github/ci/package.json` |
| `4633c0d0a32eb791837cf3c409d1538bf3035b46a381c6d1c4e361092cd3b3b4` | `.github/workflows/ci.yml` |
| `83ba097409b3bca94809fe4872381ba82428de37150d5b08313091e7daa88879` | `docs/feedback/PUP-WO-0103.md` |
| `1b708c57a1a8a759a6c87165e50efb95f714dd97d34e2cb060fb87b327b5adf0` | `docs/findings/PUP-WO-0103-adversarial.md` |
| `22c385eaf30865f11930b2050e715053bb30ce616567ec4f50d7c8ce7c498948` | `index.html` |
| `d9a1c3b3d30d992212799dec017299253c557b77319cdf3f8a39c1c074919130` | `sw.js` |
