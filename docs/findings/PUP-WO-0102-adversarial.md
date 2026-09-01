# PUP-WO-0102 — adversarial pass, verbatim

**This file is the RECORD, not a summary.** Architecture §5: the verbatim exchange is
"what makes CC-B's dispatch auditable — CC-A reviews whether the pass *was any good*,
not merely what it concluded, and a summary written by the party being audited is
where a weak pass hides." The builder's summary and dispositions are in
`docs/feedback/PUP-WO-0102.md`; neither file summarises the other's job.

**Subject:** `build/wo-0102` frozen at `1719cebbf864608aab317e438ff068620ed528fe`.
**Method:** fresh-context subagent, black-box — artifact and ratified ground truth
only, no knowledge of the builder's reasoning. Dispatched by the builder per
architecture §5's amended ruling.
**Freeze:** `sw.js`, all six checks, both harness libraries, `ci.yml`, and
`docs/feedback/PUP-WO-0102.md` were committed before dispatch and unchanged for the
duration of the pass.

---

## 1. The prompt, exactly as given

```
You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author and
you have no knowledge of how or why it was built. Judge only what is in front of you.

REPO: /home/ikthys777/worktrees/PupPad/builder  (git branch build/wo-0102, frozen at 1719ceb)

PupPad is an offline-first PWA — a pretend command console for a three-year-old who
cannot read. It is published to GitHub Pages at TWO paths on ONE origin: the site root
(newest build, test device) and /stable/ (promoted build, the child's home-screen icon).

GROUND TRUTH — read these first; they are ratified and are not under review:
  docs/northstar.md          invariants, with a falsification test for each
  docs/architecture.md       §5 rulings, §6 deploy topology and cache hazard, §6.1
  docs/work-orders/PUP-WO-0102.md   the work order this artifact claims to satisfy

THE ARTIFACT UNDER REVIEW — everything here is fair game:
  sw.js                                    the service worker (this is what reaches the child)
  .github/ci/check-cache-isolation.mjs     "check 5"
  .github/ci/check-cache-name.mjs          "check 3"
  .github/ci/check-load.mjs                "check 4"
  .github/ci/demo-two-path-caches.mjs      "check 6"
  .github/ci/lib/sw-harness.mjs            the sandbox the checks run sw.js in
  .github/ci/lib/sw-cdp.mjs                raw-CDP service-worker observation
  .github/workflows/ci.yml                 the workflow
  docs/feedback/PUP-WO-0102.md             the builder's own account — TREAT AS A CLAIM, NOT A RESULT

YOU MAY RUN THINGS. node 24 is available; a Chromium is installed. The checks take the
repo root as argv[2], e.g. `node .github/ci/check-cache-isolation.mjs .`. To test a
mutation, COPY the tree to a scratch directory under /tmp and mutate the copy.
DO NOT MODIFY THE REPOSITORY — it is frozen. Do not commit, push, or change any file
under /home/ikthys777/worktrees/PupPad/builder.

PROBES — the work order names these; you are not limited to them:

1. SERVE ONE BUILD'S BYTES FROM THE OTHER COPY. The headline. Northstar invariant 7 is
   "a device serves exactly one build's assets, never a mixture", and its own
   falsification test is "load the promoted copy after the test copy has been cached;
   find any asset served from the other build." Try it offline, online, mid-upgrade,
   during promotion lag, and with one worker installing while the other is active.

2. ORPHAN A CACHE. Find a name, scope, or spelling that produces a cache no worker will
   ever reap.

3. MAKE THE LEGACY EXCEPTION MATCH SOMETHING OTHER THAN THE EXACT LITERAL 'pup-pad-v16'.

4. ASK OF EVERY FIX: WHAT LEGITIMATE BEHAVIOUR DOES THIS NOW REFUSE? This is the probe
   that has caught the most on this project. A fix that closes an attack while opening a
   violation is the normal result of testing only the attack the author imagined. An
   asset that loads fine online and is silently absent offline is a real defect
   (invariant 3), not a curiosity.

5. ATTACK EVERY STUB IN THE HARNESS. Can it actually produce the failure it screens for?
   If not, whatever it guards is unguarded. A stub whose broken answer is
   indistinguishable from its correct answer is the dangerous kind.

6. TURN THE CHECKS AGAINST THEMSELVES. Can you write a sw.js that is genuinely broken —
   reaps or reads outside its own prefix in a real browser — and still passes all six
   checks? Can you make two checks contradict each other, so that satisfying one
   requires failing the other?

7. VERIFY THE BUILDER'S CLAIMS. docs/feedback/PUP-WO-0102.md asserts specific things:
   that protected surfaces diff to empty, that no PUP-WO-0100 check was weakened, that
   every stub was shown able to fail, that sixteen mutations went red. Check them. Cite
   file:line. A claim you cannot reproduce is a finding.

REPORT — one finding per entry, most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?

Rank by consequence to the CHILD'S TABLET, not by how clever the defect is. Say plainly
which findings are disqualifying, which are real-but-tolerable, and which are cosmetic.
If you find nothing serious, say so plainly and say what you tried — an empty result you
stand behind is worth more than a padded list. Quote evidence: exact command, exact
output. Do not speculate about intent; you cannot see the author's reasoning and should
not guess at it.
```

---

## 2. The pass's report, unedited

# Adversarial review — PUP-WO-0102 @ `1719ceb`

**Reviewer:** fresh-context adversarial pass, black-box. Artifact and ground truth only; no knowledge of the builder's reasoning.
**Subject:** `build/wo-0102` frozen at `1719cebbf864608aab317e438ff068620ed528fe`.
**Base:** `origin/main = 282c33c432f103a5d46772bc68d12fcedf4ccf58` (verified as the true merge-base; see F19).
**Environment:** node v24.16.0; Chromium at `~/.cache/ms-playwright/chromium-1194/chrome-linux/chrome` (passed as `PUPPAD_CHROMIUM`). All mutation work in copies under `/tmp/pupadv/`.

---

## Verdict up front

**Nothing in `sw.js` reaches Buddy's tablet as a live defect.** I ran the northstar invariant-7 falsification test in a real browser, in both directions, plus promotion-lag, mid-upgrade and offline variants. The shipped worker does not mix builds. All four scope items are implemented and behave correctly in Chromium.

Three items are **blocking**: one deploy-day hazard that needs an architect's ruling, one missing evidence artifact the work order requires, and one false claim about a protected check. Four are **serious gate holes** — I wrote two genuinely broken workers that pass all six checks and proved the harm in a real browser. The rest are tolerable or cosmetic.

**No third serious defect in `sw.js` itself.** By WO §7's flag-and-stop test ("a third adversarial pass finding serious defects"), the answer is: the *file* is clean; the *gate around it* is not. I do not think this pass trips that stop, and I say so deliberately rather than padding to reach it.

### Severity classification, stated plainly

| | Findings |
|---|---|
| **Disqualifying** | **None in `sw.js`.** No defect I found reaches the child's tablet through the shipped worker. |
| **Blocking for acceptance** (not tablet-reaching) | F1, F2, F3 |
| **Serious — gate holes** (shipped worker correct; gate would not catch the regression) | F4, F5, F6, F7 |
| **Real but tolerable** | F8, F9, F10, F11, F12, F13 |
| **Cosmetic** | F14, F15, F16, F17, F18, F19 |

---

# BLOCKING

## F1 · Deleting `pup-pad-v16` blanks a stale `/stable/` copy offline

**Where:** `sw.js:100` (`var LEGACY_CACHE_EXACT = 'pup-pad-v16';`), `sw.js:244` (the deletion), `sw.js:66-98` (the reasoning) · **Type:** invariant-3 hazard on the promoted copy · **Decision-needed: YES**

### Why it matters

`sw.js:244` is:

```js
if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
```

This deletes `pup-pad-v16` **origin-wide, on every activation, of any worker whose scope does not end in `stable/`**. The comment block above it reasons carefully about the *reverse* direction — `sw.js:240-243`:

> *"ONLY the root worker may take it. `pup-pad-v16` was created by the root copy; stable deleting it is a cross-path deletion that leaves the root install with no cache at all until it is next loaded online (northstar invariant 3)."*

The identical harm in the **other** direction — the direction that reaches Buddy — is not mentioned anywhere in the file. If `/stable/` is published from a tree that has not been fast-forwarded past this work order, its worker still **is** the `pup-pad-v16` worker, reading and writing that exact cache. The root worker's activation destroys the promoted copy's live cache.

### Precisely what device state and what sequence produce harm

**Device state required — all four:**

1. Two deploy paths are live on one origin: `/` and `/stable/`.
2. The `/stable/` copy is served from a tree at or before `282c33c` — i.e. `sw.js` is the 43-line worker whose first line is `var CACHE_NAME = 'pup-pad-v16';`. This is `refs/heads/stable` today, and remains so until someone fast-forwards it.
3. The root copy is served from this work order's tree (`CACHE_VERSION = 'v17'`, prefix-derived name).
4. Buddy's tablet has loaded `/stable/` at least once, so it holds cache `pup-pad-v16` populated with the promoted copy's assets.

**Sequence that produces harm — three steps:**

1. The tablet (or any browser on that origin) opens `/stable/`. The old worker installs and activates; cache `pup-pad-v16` holds the promoted shell.
2. Anything at all causes the **root** worker to activate on that same origin — a visit to the test copy, a background update, or simply the same profile having both installed. Its activate handler runs `caches.delete('pup-pad-v16')`.
3. The network goes away. Buddy taps his icon.

**Result:** `/stable/index.html` does not load. There is no cache left to serve it, and the promoted copy's own worker will not rebuild one until the device is next online.

Note the asymmetry that makes this worse than a race: **step 2 is not a one-time migration.** `sw.js:66` calls this a "ONE-TIME EXCEPTION" and WO §1.3 says the legacy cache is "removed once, by exact literal". Neither is accurate — the deletion is unconditional and runs on **every** activation of the root worker, forever, until the constant is removed. So the stale `/stable/` copy is not merely blanked once; it is re-blanked every time the root worker activates, which means it can never stably hold an offline cache while a v17 root exists on the origin.

### Demonstrated, not reasoned

I demonstrated it in real Chromium against a two-tree server. Reasoning would not have been enough here — I wanted to see the tablet actually fail.

**Setup (exact):**

```bash
cd /tmp/pupadv
rm -rf mixed && mkdir -p mixed/root mixed/stable
cp /tmp/pupadv/base/index.html /tmp/pupadv/base/manifest.json /tmp/pupadv/base/icon-*.png mixed/root/
cp /tmp/pupadv/base/index.html /tmp/pupadv/base/manifest.json /tmp/pupadv/base/icon-*.png mixed/stable/
cp /tmp/pupadv/base/sw.js mixed/root/sw.js                              # NEW worker at root
(cd /tmp/pupadv/base && git show 282c33c:sw.js) > mixed/stable/sw.js    # PRE-0102 worker at /stable/
```

The `/stable/` worker is byte-for-byte the artifact's own base revision. Its first line, verified:

```
$ git show 282c33c:sw.js | head -1
var CACHE_NAME = 'pup-pad-v16';
```

**Driver** (`mixed.mjs`, the operative part — one HTTP server mapping `/` → `mixed/root` and `/stable/` → `mixed/stable`, real Chromium, no Playwright offline flag; the listener and its keep-alive sockets are closed so nothing can answer):

```js
/* 1. Buddy's tablet: the promoted copy, still on the OLD worker. */
const s=await ctx.newPage(); await s.goto(`${O}/stable/index.html`,{waitUntil:'load'});
await s.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;});
await s.reload({waitUntil:'load'}); await s.waitForTimeout(1200);
console.log('  1. /stable/ on the OLD worker. caches:',(await s.evaluate(()=>caches.keys())).join(', '));
/* 2. The test device visits root, which now carries the NEW worker. */
const r=await ctx.newPage(); await r.goto(`${O}/index.html`,{waitUntil:'load'});
await r.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;});
await r.reload({waitUntil:'load'}); await r.waitForTimeout(1500);
console.log('  2. after the ROOT (new) worker activated. caches:',(await r.evaluate(()=>caches.keys())).join(', '));
/* 3. Network gone. Can Buddy still open his icon? */
server.closeAllConnections?.(); await new Promise(x=>server.close(x));
const c=await ctx.newPage(); let t=null,e=null;
try{ await c.goto(`${O}/stable/index.html`,{waitUntil:'load',timeout:15000}); t=await c.title(); }catch(err){ e=err.message.split('\n')[0]; }
console.log(`  3. OFFLINE /stable/index.html -> ${t!==null?('loaded, title='+JSON.stringify(t)):('FAILED: '+e)}`);
```

**Exact command and exact output:**

```
$ cd /tmp/pupadv/base && PUPPAD_CHROMIUM=/home/ikthys777/.cache/ms-playwright/chromium-1194/chrome-linux/chrome \
    timeout 150 node .github/ci/mixed.mjs
  1. /stable/ on the OLD worker. caches: pup-pad-v16
  2. after the ROOT (new) worker activated. caches: puppad|%2F|v17
  3. OFFLINE /stable/index.html -> FAILED: page.goto: net::ERR_FAILED at http://127.0.0.1:34015/stable/index.html
```

Line 2 is the finding: `pup-pad-v16` is **gone** after the root worker activated, and only the root's own prefixed cache remains. Line 3 is the consequence on the tablet.

**Scope of the demonstration, stated honestly:** this is a simulated two-path deployment on a loopback server, not GitHub Pages. What it proves is the Cache API and service-worker semantics — `caches.keys()`/`caches.delete()` are origin-scoped and the deletion crosses paths. That is the mechanism, and it is not host-specific. What it does not prove is anything about GitHub Pages' particular serving behaviour, which I did not test.

### Is it in scope, and what stands between it and the tablet

Architecture §5 rules the mitigation — *"Publication refuses any copy whose worker reaps or reads outside its own prefix, and every copy a run publishes is checked in that same run"* — and `check-cache-isolation.mjs:53-62` carries exactly the diagnostic for this case:

```
CHECK 5 FAILED — this copy's sw.js defines no CACHE_PREFIX.
  That is the pre-PUP-WO-0102 worker, whose activate handler reaps by inequality:
      names.filter(function(name) { return name !== CACHE_NAME; })
  ...
  If this is the PROMOTED copy: fast-forward `stable` before publishing it.
```

That is good work and it anticipates this. But it is `PUP-WO-0103` that builds the mechanism; as of this artifact the ordering is still prose, and architecture §5's own ruling says why that matters: *"a paragraph is not a mechanism… properties hold, sequences get performed wrong once, at 2am."*

**Nothing in `sw.js` records the constraint it depends on.** A reader of `sw.js:66-98` — 33 lines of careful reasoning about this exact exception — comes away believing the only cost is a shrinking leak of `v1`–`v15`.

### Recommendation

1. Add the precondition to `sw.js`'s own comment: *this deletion is safe only while no other live copy on this origin uses `pup-pad-v16`; `stable` must be fast-forwarded past this commit before `/stable/` is published.* The comment is the record; it currently reasons about the harm in one direction and not the other.
2. Correct "ONE-TIME EXCEPTION" (`sw.js:66`) and WO §1.3's "removed once" — it is a standing origin-wide deletion on every activation.
3. **Architect's ruling required:** may `/stable/` be published at all before `stable` is fast-forwarded past `1719ceb`? If the answer is "no, by mechanism", that mechanism is `PUP-WO-0103`'s and this artifact should say it depends on it.

---

## F2 · The evidence for acceptance §3.3 and §3.7 does not exist

**Where:** `docs/feedback/PUP-WO-0102.md:4`, `:265`, `:296` · **Type:** unbacked claim · **Decision-needed: no**

### Why it matters

The feedback file cites `docs/findings/PUP-WO-0102-adversarial.md` three times:

- `:4` — *"**Verbatim adversarial exchange:** `docs/findings/PUP-WO-0102-adversarial.md`. Neither file summarises the other's job."*
- `:265` — *"Full captured output is in `docs/findings/PUP-WO-0102-adversarial.md`. The two that matter most:"*
- `:296` — *"The script is reproduced verbatim in the findings file so it can be re-run, but nothing makes it run again."*

**That file is not in the tree, not in the diff, and not on disk:**

```
$ ls -la docs/findings/
total 224
drwxr-xr-x 2 ikthys777 ikthys777  4096 Sep  1 04:11 .
drwxr-xr-x 5 ikthys777 ikthys777  4096 Sep  1 04:10 ..
-rw-r--r-- 1 ikthys777 ikthys777     0 Aug 31 18:19 .gitkeep
-rw-rw-r-- 1 ikthys777 ikthys777 42253 Sep  1 02:20 PUP-WO-0000-adversarial.md
-rw-rw-r-- 1 ikthys777 ikthys777 89054 Aug 31 23:48 PUP-WO-0000.md
-rw-rw-r-- 1 ikthys777 ikthys777 28344 Sep  1 01:38 PUP-WO-0100-adversarial.md
-rw-rw-r-- 1 ikthys777 ikthys777 56923 Sep  1 04:11 PUP-WO-0101-adversarial.md
```

The red-demo harness is separately admitted uncommitted at `:292-297`:

> *"**The red-demo harness is not committed.** It mutates `sw.js` and the harness into a scratch tree and runs the check against copies. Committing it would put a mutation engine in `.github/ci/`… **The consequence, stated plainly: these demonstrations rot.**"*

That disclosure is honest and I credit it. But combined with the missing file, the consequence is stronger than "rot": **there is no enumerated mutation list anywhere in the artifact.** `grep -nE '\b[AB][0-9]+\b'` on the feedback file returns five identifiers total — A1 (`:267`), B1 (`:272`), A6 (`:277`), A10 (`:282`), A11 (`:283`). The claim at `:264` — *"Sixteen mutations, all as predicted"* — is therefore **unauditable for twelve of sixteen**. Not disproven; unauditable.

WO §6 requires the file: *"Upward feedback: `docs/feedback/PUP-WO-0102.md`; verbatim exchange in `docs/findings/PUP-WO-0102-adversarial.md`."* Architecture §5's two-artifact ruling is explicit that the verbatim record is *"what makes CC-B's dispatch auditable — CC-A reviews whether the pass *was any good*, not merely what it concluded, and a summary written by the party being audited is where a weak pass hides."*

### What is verified anyway

I reproduced the two the document leans on hardest myself (see F6 for A1/B1 output), and a delegated verification pass reconstructed twelve mutations from the prose and ran them. **All twelve reproduced exactly as described**, including:

- **A1** — restore the origin-wide read → check 5 red on *"the root worker SERVED the other deploy path's cached bytes when offline"*.
- **A6** — restore the "must arrive canonical" rule → check 5 red on three encoding assertions.
- **A10** — reap deferred entirely → red on **pre-existing** assertions, so it does not justify the F9 trap; this matches the document's own admission at `:282`.
- **A11** — correct prefix-bounded reap **plus** a deferred origin-wide sweep → red on **the F9 trap alone**, green with the trap removed. The trap earns its place.
- **B1** — same defect as A1 with `match()` returned to the `undefined`-unconditionally form → **green** before the positive control, red with it.
- **Finding 5's `setOffline` demonstration** — the quoted output block reproduces byte-for-byte.

So the substance is real. The record is missing.

### Recommendation

Commit `docs/findings/PUP-WO-0102-adversarial.md` with the captured output before merge, or strike the three citations at `:4`, `:265`, `:296`. WO §6 requires the file and acceptance §3.3 and §3.7 rest on it. If the mutation engine is genuinely unsafe to commit on this branch, the *output* is not — and `PUP-WO-0103` touches `.github/` only and could host the engine safely, which the document itself proposes at `:297-298`.

---

## F3 · "No PUP-WO-0100 check was weakened" is false — check 3 is now defeatable by sandbox detection

**Where:** `.github/ci/check-cache-name.mjs:110-125` (the new `cacheIdentity`) versus `282c33c:.github/ci/check-cache-name.mjs` (the old `cacheName`); claim at `docs/feedback/PUP-WO-0102.md:16` and `:20-21` · **Type:** protected-check regression · **Decision-needed: YES**

### The claim under test

`docs/feedback/PUP-WO-0102.md:16`, the gates table:

> | PUP-WO-0100's four checks unmodified in intent | **STRENGTHENED, NEVER WEAKENED** | checks 1 and 2 are byte-identical to `main`; check 3 replaced a text-scrape with an evaluation; check 4 replaced a four-way permissive state test with `=== 'active'` **and** `controlled` |

`:20-23`:

> *"No `PUP-WO-0100` check was weakened, skipped or special-cased to land this. Checks 3 and 4 were made **stricter**… If you want the one-line version: nothing went green by being asked more gently."*

WO §0 makes this a flag-and-stop: *"`PUP-WO-0100`'s checks are what stands under this merge. **Weakening, skipping, or special-casing any of them to land this is a flag-and-stop.**"*

### The change

```
$ git diff 282c33c HEAD -- .github/ci/check-cache-name.mjs
...
-function cacheName(src) {
+function cacheIdentity(src) {
   if (!src) return null;
-  const m = src.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
-  return m ? m[1] : null;
+  const tmp = join(tmpdir(), `puppad-sw-${Math.random().toString(36).slice(2)}.js`);
+  try {
+    writeFileSync(tmp, src);
+    const w = loadWorker(tmp, IDENTITY_SCOPE, new FakeCacheStorage());
+    const name = w.get('CACHE_NAME');
+    return typeof name === 'string' && name.length ? name : null;
+  } catch {
+    return null;                 /* unparseable or throws at load: not an identity */
+  } finally {
+    try { unlinkSync(tmp); } catch {}
+  }
 }
```

The check now **evaluates** `sw.js` in the vm sandbox from `lib/sw-harness.mjs`. That sandbox is (`sw-harness.mjs:70-84`):

```js
  const sandbox = {
    self, caches: cacheStorage, URL, console,
    fetch: async () => { throw new Error('network disabled in harness'); },
    Promise, Response: globalThis.Response, Request: globalThis.Request,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
```

`ExtendableEvent` — and `ServiceWorkerGlobalScope`, `FetchEvent`, `Clients`, `importScripts` — exist in every real `ServiceWorkerGlobalScope` and in none of that object. So the check and the browser can compute **different** cache identities from the same source, and the check believes its own.

The builder knows this class exists. `ci.yml:103-104`:

> *"Check 5 runs sw.js in a Node sandbox, and a sandbox can be detected: a one-line `typeof ExtendableEvent !== 'undefined'` gate makes a worker behave for check 5 and reap origin-wide in Chromium."*

But `demo-two-path-caches.mjs:70-72` derives **both** names from the **same** Node harness:

```js
const probeStore = new FakeCacheStorage();
const ROOT_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}/`, probeStore).get('CACHE_NAME');
const STABLE_CACHE = loadWorker(join(REPO, 'sw.js'), `${ORIGIN}/stable/`, probeStore).get('CACHE_NAME');
```

So check 6 does not answer check 3's question directly.

### Reproduction — exact source, exact commands, exact output, both versions

Constructed as a two-commit repository so that check 3 has a real base and a real head, and a watched asset (`index.html`, which is in `urlsToCache`) genuinely changes between them — the exact condition under which check 3 is supposed to demand a bump.

**Setup (verbatim, runnable):**

```bash
set -e
rm -rf /tmp/pupadv/me/c3 && mkdir -p /tmp/pupadv/me/c3 && cd /tmp/pupadv/me/c3
git init -q . && git config user.email a@b && git config user.name t
mkdir -p .github/ci/lib
cp /tmp/pupadv/base/.github/ci/lib/sw-harness.mjs .github/ci/lib/
cp /tmp/pupadv/base/.github/ci/check-cache-name.mjs .github/ci/check-cache-name.NEW.mjs
(cd /tmp/pupadv/base && git show 282c33c:.github/ci/check-cache-name.mjs) > .github/ci/check-cache-name.OLD.mjs
# BASE revision: the pre-0102 worker, verbatim from origin/main
(cd /tmp/pupadv/base && git show 282c33c:sw.js) > sw.js
echo "<html>base</html>" > index.html
git add -A && git commit -qm base
# HEAD revision: cache identity gated on a global that exists ONLY in a real browser
python3 - <<'PY'
p='/tmp/pupadv/me/c3/sw.js'; s=open(p).read()
s=s.replace("var CACHE_NAME = 'pup-pad-v16';",
 "var CACHE_NAME = (typeof ExtendableEvent === 'undefined') ? 'pup-pad-v17' : 'pup-pad-v16';")
open(p,'w').write(s)
PY
echo "<html>CHANGED — a cached asset moved</html>" > index.html
git add -A && git commit -qm head
```

**The exact mutant source.** The entire mutation is one line — `sw.js:1` at the head revision. Everything else in the file is `282c33c:sw.js` unchanged:

```js
var CACHE_NAME = (typeof ExtendableEvent === 'undefined') ? 'pup-pad-v17' : 'pup-pad-v16';
```

Read back from the tree under test to prove no drift:

```
  head sw.js line 1: var CACHE_NAME = (typeof ExtendableEvent === 'undefined') ? 'pup-pad-v17' : 'pup-pad-v16';
```

**Command and output — the CURRENT check (this artifact):**

```
$ node .github/ci/check-cache-name.NEW.mjs .
=== NEW check 3 (this artifact) ===
  CACHE_NAME: pup-pad-v16 -> pup-pad-v17

CHECK 3 PASSED — cached asset(s) changed: index.html, and CACHE_NAME changed from "pup-pad-v16" to "pup-pad-v17".
exit=0
```

**Command and output — the PRE-CHANGE regex version (`282c33c`, the PUP-WO-0100 check):**

```
$ node .github/ci/check-cache-name.OLD.mjs .
=== OLD check 3 (origin/main, the PUP-WO-0100 version) ===
  head:  4608d889b7e95c09ac1f8bcf790b4a057ef41dc5

CHECK 3 FAILED — could not parse CACHE_NAME from sw.js at HEAD (sw.js:1).
exit=1
```

**Command and output — what a real browser computes** (a `ServiceWorkerGlobalScope` has `ExtendableEvent`; simulated here by defining it, which is exactly the discriminating condition):

```
$ node -e "globalThis.ExtendableEvent=function(){}; console.log('  browser CACHE_NAME =', (typeof ExtendableEvent==='undefined')?'pup-pad-v17':'pup-pad-v16');"
=== what a REAL browser would compute ===
  browser CACHE_NAME = pup-pad-v16
```

**The comparison, stated so a third party who trusts neither of us can check it:**

| | verdict | cache identity it believes | reality on the device |
|---|---|---|---|
| new `check-cache-name.mjs` | **PASS**, exit 0 | `pup-pad-v16 → pup-pad-v17` | — |
| old `check-cache-name.mjs` (`282c33c`) | **FAIL**, exit 1 | could not parse | — |
| Chromium | — | — | `pup-pad-v16`, unchanged |

A watched asset changed; the browser performs **no cache invalidation**; already-installed clients keep serving the previous build's assets forever — which is verbatim the failure mode the check's own error text at `:182-184` exists to prevent — and the new check reports green while printing a bump that never happens.

**One caveat I state because it matters to how you weigh this:** the old check went red because it *cannot parse a non-literal*, not because it *detected the gate*. It is a blunt instrument that happens to refuse the whole class. That is still a refusal the new check does not make, and the claim under test is "never weakened", which is an absolute.

### The mitigation — verified, and it is material

The *suite* still holds for this defect, because the current `sw.js` derives its name as `CACHE_PREFIX + CACHE_VERSION` and check 6 compares harness-derived names against what the browser actually creates. I built the realistic regression shape against the **actual frozen artifact** and ran all six:

**Mutant F, exact mutation** (`sw.js:63`):

```js
// was:  var CACHE_VERSION = 'v17';
var CACHE_VERSION = (typeof ExtendableEvent === 'undefined') ? 'v18' : 'v17';
```

plus one appended comment line to `index.html` so a watched asset genuinely changed, committed as a PR-shaped change.

```
$ cd /tmp/pupadv/me/mutF && git commit -aqm "MUTANT F" && for c in ...; do node .github/ci/$c.mjs .; done
  check 1  check-syntax             PASS
  check 2  check-assets             PASS
  check 3  check-cache-name         PASS
  check 4  check-load               PASS
  check 5  check-cache-isolation    PASS
  check 6  demo-two-path-caches     FAIL
--- check 3 said: ---
  CACHE_NAME: puppad|%2FPupPad%2F|v17 -> puppad|%2FPupPad%2F|v18
--- check 6 said: ---
  cache names derived from sw.js: root=puppad|%2F|v18 stable=puppad|%2Fstable%2F|v18
  FAIL  root worker cache missing
  FAIL  stable worker cache missing
  FAIL  the /stable/ cache was DELETED by the root worker activating — invariant 7 fails
  FAIL  the root cache puppad|%2F|v18 does not exist — this assertion tested nothing
CHECK 6 FAILED — 4:
```

So: check 6 **does** catch it — **incidentally**, because its derived names disagree with the browser's — and **misdiagnoses** it. *"the /stable/ cache was DELETED by the root worker activating — invariant 7 fails"* is the wrong diagnosis for a version-gate defect, and would send a reader hunting in the reap.

### Secondary, architect-level

`cacheIdentity` now **executes** `sw.js` from two arbitrary git revisions inside `node:vm` on the CI runner. `node:vm` is not a security boundary. The blast radius is bounded by `permissions: contents: read` (`ci.yml:26-27`) and by the workflow triggering on `pull_request`, not `pull_request_target` (`ci.yml:20`) — both correct and both load-bearing. But this is a change in kind from reading text, it happened inside a check the work order protects, and it is not mentioned in the gates table.

### Recommendation

Pick one:

1. Correct the gates line at `:16` to say check 3 traded one defeat class for another, and record the new class. *(Cheapest; preserves the honest-record property the project runs on.)*
2. Have check 3 cross-check its harness-derived identity against a browser-derived one. Check 6 already computes both halves — `demo-two-path-caches.mjs:71-72` has the harness value and `:113-118` has the browser's — so this is an assertion, not a new mechanism.
3. Keep the evaluation and add a sandbox-fidelity assertion: fail if `sw.js` references any global the sandbox does not provide.

**Decision needed:** whether option 1 alone is sufficient, or whether WO §0's flag-and-stop on weakening a PUP-WO-0100 check has been tripped and requires a ruling before merge. I flag it; I do not rule on it.

---

# SERIOUS — gate holes (probe 6: yes, twice)

Probe 6 asked: *can you write a `sw.js` that is genuinely broken — reaps or reads outside its own prefix in a real browser — and still passes all six checks?* **Yes. Twice, by two independent routes.** Both mutants were committed as PR-shaped changes in standalone repositories, and both were shown harmful in real Chromium, not merely asserted.

## F4 · A worker that serves and caches `/stable/` on navigations passes all six checks and poisons the root cache

**Where:** `.github/ci/lib/sw-harness.mjs:92-103` (the `dispatch` event shim); `check-cache-isolation.mjs:145`, `:149`, `:154`, `:178`, `:184`, `:245`, `:252` (every fake request); `demo-two-path-caches.mjs:150` · **Type:** blind spot in the gate · **Decision-needed: no**

### The mutation — one clause

```js
// sw.js:258, was:
//   if (!servesRequest(event.request.url)) return;
   if (!servesRequest(event.request.url) && event.request.mode !== 'navigate') return;
```

Committed (`abb4f9f MUTANT D: exempt navigations from the /stable/ decline`) in a standalone repo whose base is `1719ceb`.

### All six checks, exact output

```
$ cd /tmp/pupadv/me/mutD && for c in check-syntax check-assets check-cache-name check-load check-cache-isolation demo-two-path-caches; do node .github/ci/$c.mjs .; done
=== ALL SIX CHECKS vs MUTANT D (safe standalone repo) ===
  check 1  check-syntax             PASS
  check 2  check-assets             PASS
  check 3  check-cache-name         PASS
  check 4  check-load               PASS
  check 5  check-cache-isolation    PASS
  check 6  demo-two-path-caches     PASS
--- frozen repo untouched? ---
1719cebbf864608aab317e438ff068620ed528fe
(blank=clean)
```

### And it is genuinely broken — real Chromium, promotion-lag scenario

Only the root worker is registered (stable's has not registered yet), then a **top-level navigation** to `/stable/index.html`, then read back what the root cache holds:

```
############ CONTROL: unmutated sw.js (frozen artifact) ############
  root worker controls: true
  caches before: puppad|%2F|v17
  caches after : puppad|%2F|v17, puppad|%2Fstable%2F|v17
  root cache puppad|%2F|v17 holds 9 entr(ies):
      /
      /manifest.json
      /icon-192.png
      /icon-512.png
      /favicon.ico
      /index.html
      /npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
      /ajax/libs/leaflet/1.9.4/leaflet.min.js
      /ajax/libs/leaflet/1.9.4/leaflet.min.css

  >>> clean: no /stable/ bytes under the root prefix

############ MUTANT D: navigations exempted from the /stable/ decline ############
  root worker controls: true
  caches before: puppad|%2F|v17
  caches after : puppad|%2F|v17, puppad|%2Fstable%2F|v17
  root cache puppad|%2F|v17 holds 10 entr(ies):
      /
      /manifest.json
      /icon-192.png
      /icon-512.png
      /favicon.ico
      /stable/index.html
      /index.html
      /npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
      /ajax/libs/leaflet/1.9.4/leaflet.min.js
      /ajax/libs/leaflet/1.9.4/leaflet.min.css

  >>> INVARIANT 7 VIOLATED: 1 entr(ies) of the OTHER deploy path are cached under the root prefix: /stable/index.html
```

This is precisely the defect WO §1.4 exists to close — *"before the stable worker registers it can cache stable's assets under the root prefix — invariant 7 failing with disjoint names and a green gate"* — reintroduced, with a green gate.

### Root cause

Every fake request in check 5 is a bare object with one property:

```js
{ request: { url: 'https://ikthys777.github.io/PupPad/stable/index.html' } }
```

No `mode`, no `method`, no `destination`, no `headers`. `sw-harness.mjs:95-99` spreads that straight onto the event. **The sandbox cannot express a navigation, a non-GET, a `no-cors` request, or a `destination: 'document'`** — so any worker logic branching on those is structurally invisible, exactly the shape architecture §6.1 point 2 warns about (*"a stub that cannot fail is not a test"*), one level up: not a stub returning a wrong value, but a stub that cannot represent the input class at all.

And `demo-two-path-caches.mjs:150` — the browser-side counterweight — uses a subresource fetch:

```js
await fetch(origin + '/stable/manifest.json', { cache: 'no-store' });
```

never a top-level navigation to `/stable/` while the root worker controls. So neither check reaches the case.

### Recommendation

1. Give the harness a request stub with `mode`, `method`, `destination` and `headers`, and assert the `/stable/` decline holds across all of them.
2. Add one browser assertion to check 6: with only the root worker registered, navigate to `/stable/index.html`, then assert the root cache holds no entry whose path starts with `/stable/`. That is roughly ten lines and it is the assertion `demo-two-path-caches.mjs`'s own header comment (`:22-24`, item 6) claims to make.

---

## F5 · A worker whose stable copy reads origin-wide passes all six — and check 5 tests the mirror of the northstar's stated test

**Where:** `.github/ci/check-cache-isolation.mjs:198-239` · **Type:** blind spot in the gate; wrong-direction assertion · **Decision-needed: no**

### The structural finding, independent of any mutant

Northstar invariant 7's falsification column reads:

> *"Load the **promoted** copy after the **test** copy has been cached; find any asset served from the other build."*

Check 5 §8 does the **opposite**. It seeds the **stable** worker's cache and runs the **root** worker offline:

```js
const stableSeed = loadWorker(SW, STABLE_SCOPE, crossStore);          // :204
const stableCache = await crossStore.open(stableSeed.get('CACHE_NAME'));
await stableCache.put(shared, 'BYTES FROM THE OTHER DEPLOY PATH');    // :206
...
const rootOffline = loadWorker(SW, ROOT_SCOPE, crossStore);            // :229
const offline = await rootOffline.dispatch('fetch', { request: { url: shared } });  // :231
```

**The promoted copy's offline read is never exercised anywhere in the suite.** Every offline-read assertion in check 5 uses `ROOT_SCOPE`; check 6's offline cold-load (`demo-two-path-caches.mjs:193-196`) goes to `${ORIGIN}/index.html` and never to `/stable/`. WO §3.3 asks for *"Invariant 7's own falsification test, run and failed-then-passed"* — what is run is its mirror image.

The code is symmetric, so in the frozen artifact the two directions behave identically. That is exactly why the gap is invisible and worth naming: it is not wrong today; it is unguarded tomorrow.

### The mutation

```js
// sw.js:279-281, the offline branch, was:
//   return caches.open(CACHE_NAME).then(function(cache) {
//     return cache.match(event.request);
//   });
      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {
        if (hit) return hit;
        if (IS_STABLE_WORKER) return caches.match(event.request);
        return undefined;
      });
```

Committed as `adee2ec MUTANT A: the STABLE worker's offline read is origin-wide`.

### All six checks, exact output

```
$ cd /tmp/pupadv/me/mutA && for c in ...; do node .github/ci/$c.mjs .; done
=== ALL SIX CHECKS vs MUTANT A ===
  check 1  check-syntax             PASS
  check 2  check-assets             PASS
  check 3  check-cache-name         PASS
  check 4  check-load               PASS
  check 5  check-cache-isolation    PASS
  check 6  demo-two-path-caches     PASS
```

### And it is the architecture §6.1 defect, on the copy Buddy uses

I ran the northstar's test in the direction the northstar states it. Fixture: `/PupPad/stable/index.html` sitting in the **root** worker's cache — which is exactly what a pre-0102 root worker produces, since its scope covers `/stable/` and it cached unconditionally. So this is a realistic device state, not a synthetic one.

```js
const shared = O+'/PupPad/stable/index.html';
const rootSeed = loadWorker(SW, O+'/PupPad/', store);
const c = await store.open(rootSeed.get('CACHE_NAME'));
await c.put(shared, 'BYTES FROM THE TEST BUILD');   // as a pre-0102 root worker would have cached it
const stableW = loadWorker(SW, O+'/PupPad/stable/', store);
const r = await stableW.dispatch('fetch', { request: { url: shared } });
```

```
=== and mutant A IS the architecture 6.1 defect, on the STABLE worker ===
-- frozen artifact (control):
  promoted (/stable/) worker, offline, served: undefined
  >>> clean
-- mutant A:
  promoted (/stable/) worker, offline, served: "BYTES FROM THE TEST BUILD"
  >>> INVARIANT 7 FALSIFIED by its own stated test
```

### Recommendation

Run §8 in both directions — seed root's cache, run the stable worker; seed stable's cache, run the root worker. It is four lines, and one of the two is the invariant's own wording. Architecture §6.1's closing rule is *"a worker touches only what it owns — on read and on write, not only on reap"*; the check enforces that for one of the two workers.

---

## F6 · The sandbox `fetch` stub silently gates check 5's headline assertion, and was never audited

**Where:** `.github/ci/lib/sw-harness.mjs:72`; the stub enumeration at `docs/feedback/PUP-WO-0102.md:132-150` · **Type:** a stub that cannot fail — the exact class WO §3.7 and architecture §6.1 point 2 exist to eliminate · **Decision-needed: no**

### Why it matters

```js
fetch: async () => { throw new Error('network disabled in harness'); },   // sw-harness.mjs:72
```

This is the fixture that forces the worker down its `.catch()` branch — **the only path assertion 8 ever exercises**. If `fetch` resolves, the worker returns the network response and the offline branch never runs; the assertion then passes because nothing happened, which is indistinguishable from passing because the read was correctly scoped.

The feedback file's finding 3 (`:128-156`) enumerates six stubs it neutered — `match()`, `put()`, `keys()`, `delete()`, `respondWith`, and scope — and reports the correct and genuinely valuable insight at `:136-140`:

> *"**A stub fails silently exactly when its neutered return value is also a legitimate one.**"*

**The `fetch` stub is not among the six.** And it satisfies the document's own criterion at `:153-155` — *"audit the stubs whose degenerate value falls inside their legitimate range"* — perfectly: a **resolving** `fetch()` is not degenerate at all. It is what an online browser hands the worker on every single request. That is why it slipped: the rule as written points at *degenerate* values, and this stub's dangerous value is the *normal* one.

### Reproduction — exact commands, exact output

Two runs against the **same** defective `sw.js`. Only the harness differs.

**Step 1 — restore the architecture §6.1 defect** (the origin-wide offline read, i.e. mutation A1):

```bash
python3 - <<'PY'
p='/tmp/pupadv/me/stub/sw.js'; s=open(p).read()
old="""      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      });"""
new="""      return caches.match(event.request);"""
assert old in s; open(p,'w').write(s.replace(old,new))
PY
```

**Run with the harness UNCHANGED — the check works:**

```
$ node .github/ci/check-cache-isolation.mjs .
defect restored: caches.match(event.request) is CacheStorage.match
--- check 5 with the defect, harness UNCHANGED (should be RED) ---

  the root worker SERVED the other deploy path's cached bytes when offline
    CacheStorage.match is origin-wide — invariant 7 falsified by its own stated test

  northstar invariant 7: a device serves exactly one build's assets, never a mixture.
exit=1
```

**Step 2 — neuter ONLY the `fetch` stub. `sw.js` is untouched, still defective:**

```bash
python3 - <<'PY'
p='/tmp/pupadv/me/stub/.github/ci/lib/sw-harness.mjs'; s=open(p).read()
old="""    fetch: async () => { throw new Error('network disabled in harness'); },"""
new="""    fetch: async () => ({ clone: () => 'LIVE' }),"""
assert old in s; open(p,'w').write(s.replace(old,new))
PY
```

**Run — the work order's headline defect goes green:**

```
$ node .github/ci/check-cache-isolation.mjs .
sandbox fetch stub neutered (now resolves)
--- check 5, SAME defective sw.js, only the fetch stub changed ---
  ok    serves a legitimately encoded asset: /PupPad/a%2Bb.png
  ok    root worker declines the bare foreign directory: /PupPad/stable
  ok    root worker declines the bare foreign directory: /PupPad/stable?x=1

CHECK 5 PASSED — prefixes differ and do not nest; the reap is bounded to its own prefix;
  the legacy exception is an exact literal; the root worker declines /stable/.
exit=0
```

A delegated pass found this independently and by a different route, which is why I state it with confidence rather than as a curiosity.

### The positive control does not catch it — and this is the sharp part

`check-cache-isolation.mjs:208-227` adds a positive control precisely because assertion 8 has no counterweight:

```js
const seedReadback = await crossStore.match(shared);
if (seedReadback === 'BYTES FROM THE OTHER DEPLOY PATH')
  ok('cross-path seed is reachable through the store (the next assertion is not vacuous)');
```

That proves the **seed is reachable**. It does not prove **the offline branch ran**. With `fetch` resolving, the seed is still reachable, the control still passes, and the assertion below it is still vacuous. The control was aimed at the two stubs the builder had identified and lands squarely on them; it does not cover the fixture that decides whether the assertion executes at all.

### What this falsifies

- `docs/feedback/PUP-WO-0102.md:209-211`: *"Every green in this document was produced by a check that has been watched going red; this one is the reason I can say that."* — Not for the `fetch` stub.
- WO §3.7: *"Every harness stub must be shown able to fail… For each stub, show the failure it exists to detect being produced."* — Not satisfied for `sw-harness.mjs:72`.

I want to be fair about the shape of this: the builder applied the rule to six stubs, found two real defects, wrote a new assertion, and then — by his own account at `:206-211` — had to be forced by demonstration to apply the rule to the new assertion too. That is a good process catching itself one round late. This finding is the next round.

### Recommendation

Assert that the offline branch was actually taken, not only that the seed was reachable. Concretely: have the sandbox `fetch` reject with a sentinel and assert the worker's response is either the sentinel-derived value or a scoped cache hit — never the network path. Then a resolving `fetch` contradicts an assertion instead of silently skipping one.

---

## F7 · The `install` handler is never dispatched, and `addAll` is inert

**Where:** `.github/ci/lib/sw-harness.mjs:31`; absence of any `dispatch('install')` in `.github/ci/` · **Type:** unexercised surface · **Decision-needed: no**

### Evidence

```
$ rg -n "dispatch\('" .github/ci/
.github/ci/check-cache-isolation.mjs:86:await activating.dispatch('activate');
.github/ci/check-cache-isolation.mjs:136:await w2.dispatch('activate');
.github/ci/check-cache-isolation.mjs:145:const stableReq = await rootFetch.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:149:const ownReq = await rootFetch.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:154:const stableOwn = await stableFetch.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:161:await stableOnly.dispatch('activate');
.github/ci/check-cache-isolation.mjs:178:  const r = await rootServe.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:184:  const r = await rootServe.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:194:await orphan.dispatch('activate');
.github/ci/check-cache-isolation.mjs:231:const offline = await rootOffline.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:245:  const r = await rootEnc.dispatch('fetch', ...);
.github/ci/check-cache-isolation.mjs:252:  const r = await rootEnc.dispatch('fetch', ...);

$ rg -n "addAll" .github/ci/ sw.js
sw.js:213:      return cache.addAll(urlsToCache);
.github/ci/lib/sw-harness.mjs:31:      addAll: async () => {},
```

Only `activate` and `fetch` are ever dispatched, and `addAll: async () => {}` records nothing. So **check 5 cannot observe anything the precache does** — including precaching the other deploy path, which would be a direct violation of the work order's own rule (*"a worker touches only what it owns — on read, on write, and on reap"*, WO §0).

Check 6 exercises install in a real browser, but its item-6 probe (`demo-two-path-caches.mjs:149-160`) checks exactly one URL — `/stable/manifest.json` — reached by runtime fetch. A precache entry for `/stable/index.html` would not be seen, and `keys(root).length === before.length` at `:161` is unaffected by an entry added *inside* an existing cache.

### What I tried and where it went

I built mutant B — `urlsToCache` gaining `'./stable/index.html'` — expecting a clean pass. **It was caught, but for the wrong reason:**

```
  check-syntax       PASS
  check-assets       PASS
  check-cache-name   FAIL
CHECK 3 FAILED — the urlsToCache list itself changed, but CACHE_NAME is still "puppad|%2FPupPad%2F|v17".
  check-load         FAIL(exit 1)
CHECK 4 FAILED — 1 error(s) originating in PupPad's own code:
  [service worker uncaught exception] http://127.0.0.1:45169/sw.js
    TypeError: Failed to execute 'addAll' on 'Cache': Request failed
```

Check 3 caught the list change (correct, and a bump would satisfy it). Check 4 caught it only because `/stable/index.html` **does not exist** in check 4's single-tree server. In the real two-path deployment it does exist, and the equivalent using `cache.add(...).catch(() => {})` would swallow the 404 and pass. I did not build that variant to completion, so I record this as a gap I reasoned to rather than one I fully demonstrated — the demonstrated part is that `addAll` is inert and `install` is never dispatched.

### Recommendation

Make `addAll` record into the store (it already has a `store` in scope at `sw-harness.mjs:29`), dispatch `install` in check 5, and assert nothing outside `SCOPE_PATH` was precached. Roughly six lines.

---

# REAL BUT TOLERABLE

## F8 · `/stable/` has zero offline capability during promotion lag — this is what item 4 now refuses

**Where:** `sw.js:258` (`if (!servesRequest(event.request.url)) return;`) · **Type:** invariant-3 gap created by the fix · **Decision-needed: YES (runbook)**

This is probe 4's answer — *"what legitimate behaviour does this fix now refuse?"*, the probe architecture §5 ruled on 2026-09-01 and aimed squarely at this work order.

Before item 4, the root worker served `/stable/` URLs from its own cache: a mixture (invariant 7 violated), but **a working screen**. Now it declines them entirely, and nothing else is there yet.

```
$ node .github/ci/lag.mjs .
  root worker registered and controlling; caches: puppad|%2F|v17
  /stable/ worker registered?  http://127.0.0.1:39537/
  --- network cut ---
   OFFLINE  /index.html          -> loaded, title="Pup Pad"
   OFFLINE  /stable/index.html   -> FAILED: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:39537/stable/index.html
```

("Offline" here is the listener and its keep-alive sockets closed, not `context.setOffline(true)` — the builder's finding 5 established that the flag does not stop a service worker's fetch reaching loopback, and I adopted that.)

This is **correct by design** and it clears after one online load of `/stable/`, which registers stable's own worker and precaches its shell. But the operational consequence is real: if the icon is moved to `/stable/` and the tablet is handed over offline before that first load — a car, a plane, the exact use the northstar names — Buddy gets a browser error page and no adult can tell why. Northstar §6's failure list includes *"It breaks while he is playing"*; this is its cousin, *it never starts*.

**Recommendation:** `PUP-WO-0103`'s promotion runbook must require one online load of `/stable/` before the home-screen icon moves, and that should be a step someone performs and confirms, not a note. **Decision needed:** whether that belongs in the runbook or should be enforced (e.g. promotion refuses until `/stable/`'s worker is observed active on the target device).

---

## F9 · Any canonical scope other than the two deploy paths orphans a cache permanently

**Where:** `sw.js:224` · **Type:** orphan (probe 2) · **Decision-needed: no**

```js
if (CACHE_PREFIX === null || canonicalPath(SCOPE_PATH) !== SCOPE_PATH) {   // sw.js:224
```

The self-unregister guard keys on **canonicality**, not on *"am I one of the two deploy paths"*. Probe 2 asked for orphans beyond `//stable/`; this is the general one.

Real Chromium, registering three scopes from a root-controlled page:

```
$ node .github/ci/orphan.mjs .
  register(scope=".//stable/") -> registered scope=http://127.0.0.1:34277//stable/
  register(scope="/stable/") -> registered scope=http://127.0.0.1:34277/stable/
  register(scope="./sub/") -> registered scope=http://127.0.0.1:34277/sub/
  registrations now: http://127.0.0.1:34277/ | http://127.0.0.1:34277/stable/ | http://127.0.0.1:34277/sub/
  caches now       : puppad|%2F|v17 | puppad|%2Fstable%2F|v17 | puppad|%2Fsub%2F|v17
```

`puppad|%2Fsub%2F|v17` is the orphan. Its scope is **canonical**, so the self-unregister at `:224` never fires; and no other worker's prefix reaches it — `puppad|%2F|` is not a prefix of `puppad|%2Fsub%2F|v17` (position 10 is `|` versus `s`), which is the trailing-delimiter property working exactly as designed and, here, working against reaping. **Narrowing a scope requires no `Service-Worker-Allowed` header**, so this is reachable in production without any server cooperation.

Not reachable today: `index.html:1935` is

```js
navigator.serviceWorker.register('sw.js').catch(function(e) { console.log('SW:', e); });
```

— no explicit scope, so the scope is the sw.js directory. It becomes reachable the moment any page under a subdirectory registers a worker, which is plausible once `games/` exists.

**Credit where due, and I verified it rather than assuming:** the `//stable/` case WO §1.4 specifically named **does** work in a real browser. The `.//stable/` registration reports scope `http://.../` + `/stable/` (doubled slash), then unregisters itself — it is absent from `getRegistrations()` and left no cache behind. The mechanism at `:219-235` is real, not sandbox-only.

**Recommendation:** allowlist the known deploy paths rather than testing canonicality, or state explicitly that only the two paths may host a registration so the constraint is visible when `games/` lands.

---

## F10 · Two spellings are served online and silently absent offline (the F7 class again)

**Where:** `sw.js:163` (`return null; /* malformed escape: undecidable */`), `sw.js:165` (`if (d.indexOf('/') !== -1 || d.indexOf('\\') !== -1) return null;`) · **Type:** invariant 3 · **Decision-needed: no**

Sweep of the root worker (scope `/PupPad/`), `respondWith` called or not:

```
  root worker (scope /PupPad/) — respondWith called?
    SERVE   /PupPad/my%20photo.png   (space (known-good control))
    DECLINE  /PupPad/a%5Cb.png   (filename containing a backslash (%5C))
    SERVE   /PupPad/50%25.png   (filename containing a percent (%25))
    DECLINE  /PupPad/100%off.png   (BARE percent in a filename (browser sends this verbatim))
    SERVE   /PupPad/games/%F0%9F%90%B6.js   (emoji filename)
    SERVE   /PupPad/a%00b.png   (NUL byte)
    SERVE   /PupPad/.well-known/x   (leading-dot directory)
    DECLINE  /PupPad/..%2Fx   (encoded ../ )
    SERVE   /PupPad/index.html?redirect=/PupPad/stable/   (query mentioning stable)
    SERVE   /PupPad/stable-notes.html   (root file whose name starts with "stable")
    SERVE   /PupPad/stablex/y.png   (root dir whose name starts with "stable")
    SERVE   /PupPad/games/stable/x.js   (a DEEPER dir literally named stable)
    SERVE   /PupPad/   (the root directory itself)
    DECLINE  /PupPad   (the scope directory with NO trailing slash)
```

Two refusals are the F7 class — served online, silently absent offline:

- **`/PupPad/a%5Cb.png`** — a file whose name contains a backslash. Legal on Linux; GitHub Pages serves it; `sw.js:165` declines it because the decoded segment contains `\`.
- **`/PupPad/100%off.png`** — a bare `%`. The URL path percent-encode set does not encode `%`, so `new URL(...).pathname` carries it verbatim, `decodeURIComponent` throws, and `sw.js:163` declines.

`check-cache-isolation.mjs:241-248` tests three encodings — `%20`, `%C3%A9`, `%2B` — **all of which decode cleanly**. Neither refusal class is covered.

Also worth noting from the sweep, and *not* defects: `/PupPad/stable-notes.html`, `/PupPad/stablex/y.png` and `/PupPad/games/stable/x.js` are all correctly **served** — the foreign-subtree test does not over-match on the `stable` substring. `/PupPad` (bare, no trailing slash) is declined; a host 301s it to `/PupPad/`, so offline a user who types the bare path gets a network error even though the app is fully cached. Not reachable from the home-screen icon: `manifest.json`'s `start_url` is `"./index.html"`, which resolves to `/PupPad/index.html` and is served.

**Why this is only tolerable:** both refused spellings are pathological for this asset set — five precache entries (`./`, `index.html`, `manifest.json`, two icons) plus future `games/<id>.js`. I rank it low on consequence. I rank it non-zero because it is exactly the shape probe 4 exists for, and the check added to prevent recurrence does not cover the class.

**Recommendation:** add `%5C` and a bare-`%` case to `check-cache-isolation.mjs:242`'s `encodedOk` list, and decide deliberately whether they should serve or decline. Deciding "decline, and here is why" is a fine answer; not having decided is the finding.

---

## F11 · Third-party bytes are cached into the child's cache

**Where:** `sw.js:182` — `if (u.origin !== self.location.origin) return true;` · **Type:** non-goal surface · **Decision-needed: YES (small)**

Every cross-origin request is served by the worker and its response `put` into `CACHE_NAME`. Verified in real Chromium against the **unmutated** artifact:

```
$ node .github/ci/xorigin.mjs .
  playwright ctx.route ABORTED (page-level) count: 3
  entries in PupPad caches: 9; CROSS-ORIGIN entries: 3
    puppad|%2F|v17  https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css
       status=0 type=opaque bytes=0
    puppad|%2F|v17  https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js
       status=0 type=opaque bytes=0
    puppad|%2F|v17  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
       status=0 type=opaque bytes=0
```

The sweep also confirms the rule is unconditional on the origin:

```
  cross-origin:
    SERVE   https://cdn.jsdelivr.net/npm/x.js
    SERVE   https://evil.example/x.js
```

This cuts both ways, and I do not think it is simply wrong:

- **For:** it is what makes the Map panel work offline. Architecture §5 rules games strictly offline *"because invariant 3 makes offline capability non-optional"*; caching leaflet serves that.
- **Against:** northstar §5's third non-goal is *"Advertising, analytics, or any third-party network call. Not a preference. A third-party call from a child's app is a category of thing this project will not contain."* Unbounded third-party content now lives inside the child's cache, keyed by URL, with no allowlist.

The CDN loads themselves are `PUP-WO-0600`'s (architecture §2, WO §4). What is **this** artifact's is that `sw.js:182`'s comment — *"cross-origin: not our subtree question"* — frames it purely as a subtree question and says nothing about caching. The behaviour is currently a side effect of a comment about something else.

**Recommendation:** one line of stated intent at `sw.js:182`, and an architect's call on whether cross-origin responses should be cached at all before `PUP-WO-0600` removes the CDN loads.

---

## F12 · An offline cache miss raises an uncaught `TypeError` in the worker

**Where:** `sw.js:279-281` · **Type:** latent; invisible to CI · **Decision-needed: no**

`cache.match` resolves to `undefined` on a miss, and that `undefined` goes straight to `event.respondWith`:

```
$ node .github/ci/miss.mjs .
  controlled: true
  server closed — now OFFLINE. Requesting an asset that was never cached:
   page fetch -> rejected: Failed to fetch
  service-worker errors observed over CDP: 2
    [service worker uncaught exception] TypeError: Failed to convert value to 'Response'.
    [service worker uncaught exception] TypeError: Failed to convert value to 'Response'.
```

No user-visible difference — the request fails either way — so I rank this low. It matters for two reasons: check 4 now fails on **any** service-worker uncaught exception (`check-load.mjs:305-311`), and **no check exercises an offline miss**, so the condition never arises in CI.

**I tried to turn this into a gate flake and failed, and the negative result is worth recording.** Hypothesis: if a CDN is unreachable during check 4, the worker's own `fetch` rejects, the cache misses, `respondWith(undefined)` throws, the CDP watcher records a same-origin worker exception, and check 4 goes red on third-party network weather — which `check-load.mjs`'s own summary line explicitly denies is possible (*"Third-party origins were blocked for the whole run, so none of these are CDN flakiness"*). I tested it by blackholing both CDNs at the browser's resolver, changing **only** the launch args and **no assertion**:

```bash
--host-resolver-rules=MAP cdnjs.cloudflare.com 127.0.0.1:1, MAP cdn.jsdelivr.net 127.0.0.1:1
```

```
=== check 4, unchanged assertions, CDNs unreachable ===
  serving /tmp/pupadv/me/noegress at http://127.0.0.1:45133
  service worker registered: http://127.0.0.1:45133/sw.js
  worker observation verified live at end of run: http://127.0.0.1:45133/sw.js
  document title: "Pup Pad"
  service worker: active; page controlled by it after reload: true
  service worker CDP sessions watched: 1
  third-party requests blocked (expected, not failures): 3
  third-party console errors IGNORED (a naive check would go red on these): 3
  same-origin but browser-initiated, not failures: 1
    ignored  http://127.0.0.1:45133/favicon.ico:0 Failed to load resource: ... 404 (Not Found)

CHECK 4 PASSED — console clean of same-origin errors; service worker active.
exit=0
```

**Green. No flake risk demonstrated.** The hypothesis is not supported and I withdraw it. What remains is narrower: `check-load.mjs`'s summary sentence is a stronger claim than the routing actually delivers once the worker controls the page — the F11 evidence shows opaque CDN responses reaching the cache through the worker in a run where page-level routing reported three aborts.

**Recommendation:** return a synthesised `Response` (e.g. a 504) instead of `undefined` on a miss, so the worker stops throwing. Low priority — but note it interacts with F1 and F8: on a blanked or not-yet-populated copy, *every* request produces one of these.

---

## F13 · `IS_STABLE_WORKER` is a suffix test and `FOREIGN_SUBTREE` is scope-relative

**Where:** `sw.js:110-114` · **Type:** design fragility · **Decision-needed: no**

```js
var STABLE_SEGMENT = 'stable/';
var IS_STABLE_WORKER = SCOPE_PATH !== null &&
  SCOPE_PATH.length >= STABLE_SEGMENT.length &&
  SCOPE_PATH.slice(-STABLE_SEGMENT.length) === STABLE_SEGMENT;
var FOREIGN_SUBTREE = (SCOPE_PATH === null || IS_STABLE_WORKER) ? null : SCOPE_PATH + STABLE_SEGMENT;
```

Derived values at six plausible scopes:

```
  prefixes at other plausible scopes:
    scope=/PupPad/               IS_STABLE=false FOREIGN=/PupPad/stable/          NAME=puppad|%2FPupPad%2F|v17
    scope=/PupPad/stable/        IS_STABLE=true  FOREIGN=null                     NAME=puppad|%2FPupPad%2Fstable%2F|v17
    scope=/PupPad/unstable/      IS_STABLE=true  FOREIGN=null                     NAME=puppad|%2FPupPad%2Funstable%2F|v17
    scope=/PupPad/games/         IS_STABLE=false FOREIGN=/PupPad/games/stable/    NAME=puppad|%2FPupPad%2Fgames%2F|v17
    scope=/PupPad/stable/beta/   IS_STABLE=false FOREIGN=/PupPad/stable/beta/stable/ NAME=puppad|%2FPupPad%2Fstable%2Fbeta%2F|v17
    scope=/                      IS_STABLE=false FOREIGN=/stable/                 NAME=puppad|%2F|v17
```

Two properties to notice:

- `/PupPad/unstable/` reads as the stable worker (suffix match), so it would be denied the legacy exception.
- `FOREIGN_SUBTREE` is **scope-relative**: a worker at `/PupPad/games/` protects `/PupPad/games/stable/`, not the real `/PupPad/stable/`. A worker granted scope `/` protects `/stable/`, not `/PupPad/stable/`.

Neither is reachable in today's topology, and WO §4 explicitly fences *"Generalising to N paths. Two copies today."* So this is correct-by-fence, not a defect. Flagged so the assumption is visible in writing rather than discovered by the third path.

**Recommendation:** none required. One comment naming the assumption would cost a line.

---

# COSMETIC

## F14 · The cache count is wrong, and it is baked into the deliverable

**Where:** `sw.js:82-84`; `docs/feedback/PUP-WO-0102.md:217`, `:224`, `:243` · **Type:** factual error in the committed record · **Decision-needed: no (but fix before merge)**

`sw.js:82-84`:

```
 * Sixteen cache names have existed on main: pup-pad-v1, v3, and v4 through v16
 * (there was never a v2). Only v16 is listed here, so a device that last loaded
 * PupPad at v1-v15 and has not loaded since keeps that cache FOREVER — a bounded
```

Its own enumeration is `v1` + `v3` + (`v4`…`v16`) = 1 + 1 + 13 = **fifteen**. Git agrees:

```
$ for c in $(git rev-list origin/main -- sw.js); do git show $c:sw.js 2>/dev/null | grep -oE "pup-pad-v[0-9]+"; done | sort -u -V
pup-pad-v1 pup-pad-v3 pup-pad-v4 pup-pad-v5 pup-pad-v6 pup-pad-v7 pup-pad-v8 pup-pad-v9 pup-pad-v10 pup-pad-v11 pup-pad-v12 pup-pad-v13 pup-pad-v14 pup-pad-v15 pup-pad-v16
count = 15
```

`v16` is excepted, so **fourteen** are stranded, not fifteen. The decision-needed fork at `docs/feedback/PUP-WO-0102.md:215-254` is framed as *"Trading a permanent, invisible, shrinking leak for **fifteen** more origin-wide deletions"* — it is fourteen more.

**The reasoning survives entirely; only the number is wrong.** I flag it because `sw.js`'s comment *is* the durable record — the feedback file is per-WO and the comment is what a future reader finds — and because the architect is being asked to rule on a trade whose magnitude is misstated. Fix the count in `sw.js:82` and in the feedback file before merge.

## F15 · "ONE-TIME EXCEPTION" is not one-time

**Where:** `sw.js:66`; WO §1.3 ("The legacy cache is removed once, by exact literal string") · **Type:** mischaracterisation · **Decision-needed: no**

`sw.js:244` runs on every activation of every non-stable worker, unconditionally, until the constant is removed. This is the mechanism behind F1's "re-blanked every time" property, which is why I separate it from F1 rather than folding it in.

## F16 · `CACHE_NAME` is the string `"nullv17"` when the prefix is null

**Where:** `sw.js:60`, `sw.js:64` · **Type:** latent · **Decision-needed: no**

```js
var CACHE_PREFIX = SCOPE_PATH === null ? null : cachePrefixFor(SCOPE_URL);
var CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;      // null + 'v17' === "nullv17"
```

Unreachable in a browser — install returns early at `:210`, `servesRequest` returns `false` at `:175`, and activate takes the orphan branch at `:224` — so no cache named `nullv17` is ever created. But `check-cache-name.mjs:119` accepts it as a valid identity (`typeof name === 'string' && name.length`), so if a future change made it reachable, check 3 would report an identity rather than failing. A `null` guard would cost one line.

## F17 · `check-cache-isolation.mjs:80-82` self-contradicts if `CACHE_VERSION` were `'v1'`

**Where:** `.github/ci/check-cache-isolation.mjs:80-82`, `:89-95` · **Type:** latent self-contradiction · **Decision-needed: no**

```js
const ADJACENT = rootPrefix.replace(/\|$/, 'x|') + 'v17';
const UNRELATED = 'some-other-app-cache';
const rootStale = rootPrefix + 'v1';
```

If `CACHE_VERSION` were ever set to `'v1'`, `rootStale === rootName`, and the check would demand the same cache be both deleted (`expectGone`) and preserved (`expectKept`) — one assertion guaranteed to fail regardless of the worker. Only reachable by going backwards, which nobody will. Recorded because this file's own header comment at `demo-two-path-caches.mjs:65-69` names precisely this failure mode — *"A check that cannot survive the change another check requires is a check that will be deleted"* — and applied the lesson to `demo` but not to `check-cache-isolation`.

## F18 · One line citation in the feedback file does not resolve

**Where:** `docs/feedback/PUP-WO-0102.md:174` · **Type:** citation drift · **Decision-needed: no**

`:174` cites `demo-two-path-caches.mjs:161-176` for finding 5's assertion. That range is the preceding assertion plus a comment block; the assertion it describes is at `:190-207`. **Every other line citation I checked resolves correctly**, including all of `sw.js:120-140`, `sw.js:66-100`, `sw-harness.mjs:74-83`, `check-cache-isolation.mjs:208-226` and `:105-128`. WO §5 notes the freeze rule paid for itself on `PUP-WO-0101` because findings could cite the feedback file by line; this is the one place that property is slightly off.

## F19 · The acceptance command in WO §3.1 depends on which `main` the reviewer has

**Where:** `docs/work-orders/PUP-WO-0102.md:121`; `docs/feedback/PUP-WO-0102.md:17` · **Type:** reviewer trap · **Decision-needed: no**

The true base is `origin/main`, matching the builder's stated base at `docs/feedback/PUP-WO-0102.md:3` (*"from `origin/main @ 282c33c`"*):

```
$ git rev-parse origin/main;  git rev-parse main;  git merge-base origin/main HEAD
origin/main = 282c33c432f103a5d46772bc68d12fcedf4ccf58
local main  = a4be01999cb1061f05ab16d62d50273dcb2678fc
merge-base(origin/main, HEAD) = 282c33c432f103a5d46772bc68d12fcedf4ccf58
$ git merge-base --is-ancestor a4be019 1719ceb && echo "local main is BEHIND the freeze, on the same line"
yes — local main is BEHIND the freeze, on the same line
```

This worktree's local `main` is an **older ancestor** of the freeze, not a stale copy of the same tip, so acceptance item 1 gives two very different answers:

```
$ git diff --stat 282c33c HEAD | tail -1
 11 files changed, 2339 insertions(+), 38 deletions(-)
$ git diff --stat a4be019 HEAD | tail -1
 29 files changed, 7121 insertions(+), 39 deletions(-)
```

Run literally against the local ref, acceptance item 1 sweeps in all three work-order documents and `PUP-WO-0101`'s entire record, matching neither §3.1's *"`sw.js` and `docs/` only"* nor the gates table's stated scope. The builder's gates row at `:17` writes it as `git diff --stat origin/main`, which is correct — the trap is only for a reviewer who types `main`.

**The protected-surface conclusion is robust either way**, which is the part that matters:

```
$ git diff --name-status a4be019 HEAD -- index.html manifest.json icon-192.png icon-512.png
(no output)
$ git diff --name-status 282c33c HEAD -- index.html manifest.json icon-192.png icon-512.png
(no output)
```

**Recommendation:** `git fetch origin` before reviewing, and read §3.1 as `origin/main`. Worth one word in the work order, since §3.1 is already stale on a second count — the `.github/ci/` permission that reached §2 but not §3.1, self-reported by the builder at `docs/feedback/PUP-WO-0102.md:31`.

---

# What I tried that found nothing — the negative results

These are part of the record. An empty result I stand behind is worth more than a padded list.

### Probe 3 — make the legacy exception match something other than the exact literal: **failed, cleanly**

`sw.js:244` is `name === LEGACY_CACHE_EXACT`, strict equality between two strings, one of which comes from `caches.keys()`. I could not make it match anything else. `check-cache-isolation.mjs:133` already tests five near-misses (`pup-pad-v16x`, `xpup-pad-v16`, `pup-pad-v1`, `pup-pad-v17`, `PUP-PAD-V16`) and they survive. The only lever on the exception at all is the `!IS_STABLE_WORKER` guard, which is F13, and the *timing*, which is F1.

### The prefix-nesting property: **sound, and I checked the proof rather than the assertion**

`sw.js:19-26` claims no prefix can be a prefix of another because `encodeURIComponent` escapes `|` to `%7C`. Verified: for distinct paths `p₁ ≠ p₂`, `'puppad|' + enc(p₁) + '|'` can be a prefix of `'puppad|' + enc(p₂) + '|'` only if `enc(p₁) + '|'` is a prefix of `enc(p₂) + '|'`; since `'|'` never occurs inside `enc(p₂)`, that forces `enc(p₁) = enc(p₂)`. The same argument covers `prefix₁` versus `NAME₂ = prefix₂ + version`. Observed values agree: `puppad|%2FPupPad%2F|` versus `puppad|%2FPupPad%2Fstable%2F|v17` diverge at index 10 (`|` versus `P`).

### `canonicalPath`'s dot-segment handling: **I could not break it**

Traced by hand and by sweep. `/PupPad/x/../stable/index.html` → `/PupPad/stable/index.html` → declined. `/PupPad/stable/..` → `/PupPad` → declined. `/../PupPad/index.html` → `/PupPad/index.html` (the `out.length > 1` guard at `:167` correctly clamps at root, matching server behaviour). `/PupPad/a/../../PupPad/index.html` → `/PupPad/index.html`. Double-encoding (`%252Fstable`) decodes once to a literal filename, which is what a server does too. All five encodings in `check-cache-isolation.mjs:169-175` decline correctly.

### The whole-tree suite on the frozen artifact: **6/6 green**

All six checks pass against the unmutated tree, in this environment, with a local Chromium. Both browser checks (4 and 6) run here; nothing in the suite was unexercisable.

### Check 6 earns its place — verified rather than assumed

`ci.yml:103-104` claims a `typeof ExtendableEvent !== 'undefined'` gate makes a worker behave for check 5 and reap origin-wide in Chromium, and that check 6 is the answer. I built exactly that mutant (mutant E: browser-only origin-wide reap by inequality):

```
check 5: PASS
CHECK 5 PASSED — prefixes differ and do not nest; the reap is bounded to its own prefix;
  the legacy exception is an exact literal; the root worker declines /stable/.

check 6: FAIL
  after both workers installed: puppad|%2Fstable%2F|v17
  FAIL  root worker cache missing
  FAIL  an unrelated cache on the same origin was DELETED — the reap is origin-wide
  after force-activating the ROOT worker: puppad|%2Fstable%2F|v17, puppad|%2F|v17
  ok    offline cold-load served the console from cache after the legacy migration (item 5): "Pup Pad"
CHECK 6 FAILED — 2:
```

**The claim is true.** Check 6 is not decoration.

### Check 5 sees the architecture §6.1 defect — verified

With the harness intact, restoring the origin-wide read produces exactly the failure the work order asked to see (full output under F6). WO §3.3's red demonstration is real; what is missing is only its *record* (F2).

### The shipped worker does not mix builds — verified in a real browser

The control run under F4: root worker controlling, promotion-lag navigation to `/stable/index.html`, root cache holds nine entries, **none** under `/stable/`. Northstar invariant 7's falsification test, run against the artifact, in the direction the invariant states and in the mirror direction, both clean.

### Protected surfaces are genuinely untouched

```
$ git diff --stat 282c33c HEAD
 .github/ci/check-cache-isolation.mjs     | 265 ++++++++++++++
 .github/ci/check-cache-name.mjs          |  49 ++-
 .github/ci/check-load.mjs                | 101 ++++--
 .github/ci/demo-two-path-caches.mjs      | 211 +++++++++++
 .github/ci/lib/sw-cdp.mjs                | 145 ++++++++
 .github/ci/lib/sw-harness.mjs            | 107 ++++++
 .github/workflows/ci.yml                 |  35 +-
 docs/feedback/PUP-WO-0101.md             | 286 +++++++++++++++
 docs/feedback/PUP-WO-0102.md             | 335 ++++++++++++++++++
 docs/findings/PUP-WO-0101-adversarial.md | 590 +++++++++++++++++++++++++++++++
 sw.js                                    | 253 ++++++++++++-
 11 files changed, 2339 insertions(+), 38 deletions(-)
```

No `index.html`, no `manifest.json`, no icon. `check-syntax.mjs`, `check-assets.mjs` and `lib/inline-script.mjs` are absent from the diff entirely — checks 1 and 2 are byte-identical, as claimed. The `ci.yml` diff adds two steps to the `checks` job and edits comments; one job, `permissions: contents: read` at the top with no job-level override, no publication job, no `pages: write`, no `id-token`. **The gates table is accurate on every row except the "never weakened" row (F3).**

### `check-load.mjs`'s 101 changed lines are all strengthening

Random CDP port with a `Target.getTargets` liveness assertion (`sw-cdp.mjs:123-143`), fail-if-cannot-attach (`check-load.mjs:167-172`), `sessionCount() === 0` fails, `swState !== 'active'` fails where the old check accepted four states, and `controlled` is now asserted rather than merely printed. A hanging install is `CHECK 4 FAILED — never reached "active"` on the new check and `CHECK 4 PASSED` on `282c33c`'s. **Claim confirmed.**

### The feedback file's self-incriminating findings all hold up

Finding 5's `context.setOffline(true)` demonstration reproduces byte-for-byte: the flag does not stop a service worker's fetch reaching a loopback server, an offline-returns-nothing mutant passes green with it, and closing the listener catches it. Findings 2 and 4 likewise. **The document's admissions are more reliable than its absolutes** — which is a compliment to the admissions and the reason F3 and F6 are stated as sharply as they are.

---

# Disclosure — an error of mine, and its repair

I copied the tree with `cp -a`, which preserved the worktree's `.git` **pointer file** into the shared gitdir at `/home/ikthys777/PupPad/.git/worktrees/builder`. Three `git commit` calls I made from those scratch directories therefore landed on the **frozen branch** `build/wo-0102`:

```
$ git reflog -4
1c6d311 HEAD@{0}: commit: mutant mutB
90eb038 HEAD@{1}: commit: mutant mutA
bfe0dbc HEAD@{2}: commit: mutant mutD
1719ceb HEAD@{3}: commit: sw+ci: a worker touches only what it owns (PUP-WO-0102)
```

I detected it on the next status check, ran `git reset --hard 1719ceb`, rebuilt every scratch copy against an independent standalone clone (`/tmp/pupadv/std`), and warned the delegated agent before it could repeat the mistake. It confirmed it had run read-only git commands exclusively.

**Final state, verified three times during the pass and once at the end:**

```
$ git rev-parse HEAD
1719cebbf864608aab317e438ff068620ed528fe
$ git rev-parse --abbrev-ref HEAD
build/wo-0102
$ git status --porcelain
(empty)
$ git diff --stat 1719ceb
(empty)
```

The three stray commits are unreachable. Nothing else in the repository was written. I record this because a reviewer who later finds those objects in the reflog should know where they came from, and because a pass that touched its own frozen subject has to say so.

---

## 3. Builder's note on the record itself

Two things a future reader should know about this file, both of which the pass could
not have known:

**The pass committed to the frozen branch and reset it.** Its disclosure is accurate
and complete. What it could not verify is that the reset was harmless: the builder had
uncommitted post-freeze work in the tree at that moment. It survived — the reset
predated those edits — and `git status` after the pass showed exactly the four expected
modified files. Verified rather than assumed, because "I reset your branch" and "your
work is intact" are not the same sentence.

**F2 is answered by this file existing.** The pass ran before the verbatim record was
written, correctly reported it missing, and correctly refused to treat "the builder
says sixteen mutations went red" as evidence. The three citations it names now resolve.
The red-demo harness remains uncommitted for the reason the feedback file gives; its
full source is reproduced in `docs/feedback/PUP-WO-0102.md` so the demonstrations can
be re-run by hand.

---

## 4. The red demonstrations — §3.3 and §3.7 — source and captured output

**F2's substance, answered.** The pass correctly refused to accept "sixteen mutations
went red" on the builder's word: twelve of them were named nowhere. The engine's
complete source and its complete output are below, so every mutation is enumerated,
reproducible, and auditable by someone who trusts neither party.

It is **not committed under `.github/ci/`**. It mutates `sw.js` and the harness into
scratch copies, and a mutation engine on the branch that reaches Buddy's tablet is
scope this work order did not ask for. The consequence is stated plainly rather than
hidden: **nothing re-runs these automatically, so they rot.** `PUP-WO-0103` touches
`.github/` only and could host the engine safely — raised there as a decision.

Twenty-one mutations. **Fourteen (Part A)** restore a defect and require check 5 to go
RED. **Seven (Part B)** neuter a harness stub while leaving a real defect in `sw.js`,
and classify the result: SILENT means the stub was the only thing standing between
that defect and a green run — the architecture §6.1 shape — and LOUD means some other
assertion contradicts the neutered stub. The engine **fails if any mutation does not
behave as predicted**, so it is itself a check rather than a script that prints things.

### 4.1 Source — `red-demo.mjs`, verbatim

```js
#!/usr/bin/env node
/**
 * RED DEMONSTRATIONS for PUP-WO-0102 §3.3 and §3.7.
 *
 * NOT a CI check and not committed to .github/. This is a META-CHECK: it asserts
 * that check 5 GOES RED when the defect it screens for is present, and that each
 * harness stub is LOAD-BEARING — neuter the stub and a real defect walks through
 * green. It exits non-zero if any mutation ESCAPES.
 *
 * Two halves, because "the stub can fail" has two meanings:
 *   PART A — restore the defect in sw.js; check 5 must go RED.
 *   PART B — neuter the STUB while keeping a real defect in sw.js, and classify:
 *              SILENT — the check goes GREEN. The stub was the ONLY thing standing
 *                       between that defect and a green run. This is the
 *                       architecture §6.1 shape, and it is the dangerous one.
 *              LOUD   — the check goes RED anyway, because some OTHER assertion
 *                       contradicts the neutered stub's story. The stub is still
 *                       load-bearing but it fails safe.
 *
 * HOW THIS RAN THE FIRST TIME, kept because the correction is the finding.
 * I predicted SILENT for all six and was wrong on four, and then the two that WERE
 * silent — B1 and B6 — were fixed at source: check-cache-isolation.mjs now proves
 * its cross-path seed is reachable before treating a cache miss as evidence. All
 * six are LOUD as a result. The reasoning below is what found that gap.
 *
 * The original mispredicton and the correction:
 * finding: a stub fails silently exactly when its neutered return value is ALSO A
 * LEGITIMATE ONE. `match() -> undefined` and `put() -> no-op` both mean "cache
 * miss", which is indistinguishable from correct behaviour, so nothing contradicts
 * them — and that is precisely where the §6.1 blindness occurred. `keys() -> []`,
 * `delete()` no-op, a dropped `respondWith` and a wrong scope all produce states
 * some other assertion already denies. The operational rule is therefore narrower
 * and more useful than "audit every stub": AUDIT THE STUBS WHOSE DEGENERATE VALUE
 * FALLS INSIDE THEIR LEGITIMATE RANGE.
 */
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = process.argv[2] || process.cwd();
const results = [];

function run(label, { sw = [], harness = [], expect }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-red-'));
  try {
    cpSync(join(REPO, 'sw.js'), join(dir, 'sw.js'));
    cpSync(join(REPO, '.github/ci'), join(dir, 'ci'), {
      recursive: true, filter: (s) => !s.includes('node_modules'),
    });
    const patch = (file, subs) => {
      if (!subs.length) return;
      let s = readFileSync(file, 'utf8');
      for (const [a, b] of subs) {
        if (!s.includes(a)) throw new Error(`${label}: anchor not found in ${file}:\n${a}`);
        s = s.replace(a, b);
      }
      writeFileSync(file, s);
    };
    patch(join(dir, 'sw.js'), sw);
    patch(join(dir, 'ci/lib/sw-harness.mjs'), harness);

    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, [join(dir, 'ci/check-cache-isolation.mjs'), dir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      code = e.status ?? 1;
      out = (e.stdout || '') + (e.stderr || '');
    }
    const red = code !== 0;
    const observed = expect === 'RED' || expect === 'GREEN'
      ? (red ? 'RED' : 'GREEN')
      : (red ? 'LOUD' : 'SILENT');
    const pass = observed === expect;
    const fails = out.split('\n').filter((l) => l.includes('FAIL')).map((l) => l.trim());
    results.push({ label, expect, got: observed, pass, fails, code });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${label}`);
    console.log(`        expected ${expect}, got ${observed} (exit ${code})`);
    for (const f of fails.slice(0, 4)) console.log(`        ${f}`);
    if (fails.length > 4) console.log(`        ... and ${fails.length - 4} more`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n=== BASELINE — the artifact as committed ===');
run('baseline: sw.js as committed', { expect: 'GREEN' });

console.log('\n=== PART A — restore the defect, check 5 must go RED ===');

/* §3.3 THE HEADLINE. Invariant 7's own falsification test. */
run('A1  origin-wide READ restored (invariant 7, architecture §6.1)', {
  expect: 'RED',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
});

run('A2  origin-wide REAP restored (architecture §6)', {
  expect: 'RED',
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
});

run('A3  legacy exception becomes a PATTERN, not a literal', {
  expect: 'RED',
  sw: [[`name === LEGACY_CACHE_EXACT`, `name.indexOf('pup-pad-v1') === 0`]],
});

run('A4  /stable/ exclusion removed (root serves the promoted copy)', {
  expect: 'RED',
  sw: [[`  if (FOREIGN_SUBTREE !== null) {`, `  if (false) {`]],
});

run('A5  prefix delimiter dropped — root\'s prefix nests inside stable\'s name', {
  expect: 'RED',
  sw: [[`  return 'puppad|' + encodeURIComponent(path) + '|';`,
        `  return 'puppad|' + encodeURIComponent(path);`]],
});

/* THE "WHAT DOES THIS FIX REFUSE" PROBE, made mechanical. This is F7: the
 * PUP-WO-0101 encoding fix that closed an attack and opened an invariant 3
 * violation. It must be caught by assertion 9, not by anyone remembering. */
run('A6  F7 regression: require paths to ARRIVE canonical (refuses /my%20photo.png)', {
  expect: 'RED',
  sw: [[`  var parts = pathname.split('/');`,
        `  try { if (pathname !== decodeURIComponent(pathname)) return null; } catch (e) { return null; }
  var parts = pathname.split('/');`]],
});

run('A7  stable worker allowed to delete the ROOT\'s legacy cache', {
  expect: 'RED',
  sw: [[`if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;`,
        `if (name === LEGACY_CACHE_EXACT) return true;`]],
});

run('A8  non-canonical scope no longer unregisters (orphan cache)', {
  expect: 'RED',
  sw: [[`  if (CACHE_PREFIX === null || canonicalPath(SCOPE_PATH) !== SCOPE_PATH) {`,
        `  if (CACHE_PREFIX === null) {`]],
});

run('A9  bare foreign directory served (/PupPad/stable with no slash)', {
  expect: 'RED',
  sw: [[`    if (canon === FOREIGN_SUBTREE.slice(0, -1)) return false;`, ``]],
});

/* F9. The reap moved OUT of waitUntil onto a timer: every assertion above still
 * passes at the moment it measures, and the deletion lands afterwards. Requires the
 * sandbox to HAVE setTimeout — without it this mutant dies on a ReferenceError and
 * the check would appear to catch a defect it cannot actually host. */
run('A10 reap moved outside waitUntil onto a timer (F9)', {
  expect: 'RED',
  sw: [[`  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {`,
        `  setTimeout(function() {
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {`],
       [`        }).map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();`,
        `        }).map(function(name) { return caches.delete(name); })
      );
    });
  }, 50);
  self.clients.claim();`]],
});

/* A10 above goes red on the PRE-EXISTING assertions — with the reap deferred,
 * nothing has been deleted at the moment they measure. So it does not yet prove the
 * post-settle trap earns its place. THIS one does: a perfectly correct
 * prefix-bounded reap inside waitUntil, PLUS a deferred origin-wide sweep. Every
 * assertion in sections 1-2 passes, because at the moment they measure the worker
 * has behaved impeccably. Only the trap sees what happens next. */
run('A11 correct reap PLUS a deferred origin-wide sweep — the exact F9 shape', {
  expect: 'RED',
  sw: [[`  self.clients.claim();
});

self.addEventListener('fetch', function(event) {`,
        `  self.clients.claim();
  setTimeout(function() {
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n) { return n !== CACHE_NAME; })
        .map(function(n) { return caches.delete(n); }));
    });
  }, 50);
});

self.addEventListener('fetch', function(event) {`]],
});

/* ---- The four the adversarial pass found. A12-A14 and B7 each passed ALL SIX
 * checks before the fixes; they are here so that stops being true silently. ---- */

/* F4. The sandbox could not express a navigation, so a worker that exempts
 * top-level navigations from the /stable/ decline was structurally invisible. */
run('A12 navigations exempted from the /stable/ decline (pass F4)', {
  expect: 'RED',
  sw: [[`  if (!servesRequest(event.request.url)) return;`,
        `  if (!servesRequest(event.request.url) && event.request.mode !== 'navigate') return;`]],
});

/* F5. Check 5 ran the MIRROR of northstar invariant 7's stated test — it seeded
 * stable and read from root. The promoted copy's own offline read was unexercised. */
run('A13 the PROMOTED copy reads origin-wide (invariant 7 in its own direction, pass F5)', {
  expect: 'RED',
  sw: [[`        return hit || new Response('', { status: 504, statusText: 'Offline and not cached' });`,
        `        if (hit) return hit;
        if (IS_STABLE_WORKER) return caches.match(event.request);
        return new Response('', { status: 504, statusText: 'Offline and not cached' });`]],
});

/* F7. install was never dispatched and addAll recorded nothing, so the precache —
 * a third way for a worker to touch what it does not own — was unobservable. */
run('A14 the precache reaches into the other deploy path (pass F7)', {
  expect: 'RED',
  sw: [[`  './icon-512.png'
];`, `  './icon-512.png',
  './stable/index.html'
];`]],
});

console.log('\n=== PART B — neuter the STUB, keep a real defect. SILENT = the stub was the only defence ===');

/* B1 IS THE HISTORICAL DEFECT ITSELF. architecture §6.1 point 2: the stub whose
 * match() returned undefined unconditionally is what blinded the check reporting
 * on cache isolation. Same sw.js defect as A1; only the stub changes. */
/* THE HEADLINE OF §3.7. Identical sw.js to A1. A1 is RED, B1 is SILENT — one stub
 * apart. That IS architecture §6.1 point 2, reproduced on demand. */
run('B1  FakeCacheStorage.match() -> undefined, WITH the origin-wide read (the §6.1 blindness)', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  harness: [[`    for (const [, store] of this.entries) if (store.has(url)) return store.get(url);
    return undefined;`, `    return undefined;`]],
});

/* Predicted SILENT, observed LOUD: "reap did NOT delete a stale cache of its OWN
 * prefix" — the check asserts what MUST go as well as what must stay, so a delete
 * that does nothing contradicts the first half. Symmetry is the defence. */
run('B2  FakeCacheStorage.delete() made a no-op, WITH the origin-wide reap', {
  expect: 'LOUD',
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
  harness: [[`  async delete(name) {
    this.deleted.push(name);
    return this.names.delete(name);
  }`, `  async delete(name) {
    this.deleted.push(name);
    return true;
  }`]],
});

/* Predicted SILENT, observed LOUD: an empty survivor list fails every expectKept
 * assertion at once. [] is not a legitimate value here — the store was seeded. */
run('B3  FakeCacheStorage.keys() -> [], WITH the origin-wide reap', {
  expect: 'LOUD',
  sw: [[`          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;`,
        `          return name !== CACHE_NAME;`]],
  harness: [[`  async keys() { return [...this.names]; }`, `  async keys() { return []; }`]],
});

/* Predicted SILENT, observed LOUD: "root worker declined its OWN path". The check
 * asserts the worker SERVES what it owns as well as declining what it does not, so
 * a stub that makes everything look declined cannot hide an over-broad exclusion.
 * This is the "what does the fix refuse?" discipline built into the check itself. */
run('B4  dispatch() drops respondWith, WITH the /stable/ exclusion removed', {
  expect: 'LOUD',
  sw: [[`  if (FOREIGN_SUBTREE !== null) {`, `  if (false) {`]],
  harness: [[`        respondWith: (p) => responses.push(p),`, `        respondWith: () => {},`]],
});

/* Predicted SILENT, observed LOUD: two workers at one scope derive one prefix, and
 * "the two deploy paths derive different cache prefixes" denies it immediately. */
run('B5  registration.scope ignored (both workers get one scope), WITH nesting prefixes', {
  expect: 'LOUD',
  sw: [[`  return 'puppad|' + encodeURIComponent(path) + '|';`,
        `  return 'puppad|' + encodeURIComponent(path);`]],
  harness: [[`    registration: { scope },`, `    registration: { scope: 'https://ikthys777.github.io/PupPad/' },`]],
});

/* SILENT, as predicted, and for B1's reason: a put that stores nothing makes the
 * seeded foreign bytes never exist, so the read has nothing to wrongly serve. Both
 * of assertion 8's supporting stubs are of the dangerous shape — which makes the
 * origin-wide-read assertion the least-defended one in check 5. Flagged upward. */
run('B6  cache handle put/match made inert, WITH the origin-wide read', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  harness: [[`      put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },`,
             `      put: async () => {},`]],
});

/* F6 — THE STUB THE SIX-STUB AUDIT MISSED, and the reason it missed it: the rule
 * was "audit the stubs whose DEGENERATE value is also legitimate", and a RESOLVING
 * fetch is not degenerate at all — it is what an online browser hands the worker on
 * every request. The dangerous value here is the NORMAL one. Neutering it used to
 * let the architecture §6.1 defect through green, because the worker never reached
 * its offline branch and the assertion passed by not running. */
run('B7  sandbox fetch RESOLVES, WITH the origin-wide read (the audit\'s own blind spot)', {
  expect: 'LOUD',
  sw: [[`      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      }).then(function(hit) {`, `      return caches.match(event.request).then(function(hit) {`]],
  harness: [[`    fetch: async () => {
      network.attempted++; network.rejected++;
      throw new Error('network disabled in harness');
    },`, `    fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; },`]],
});

console.log('\n' + '='.repeat(78));
const escaped = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? 'ok          ' : 'MISPREDICTED'} ${r.expect.padEnd(6)} ${r.label}`);
const silent = results.filter((r) => r.got === 'SILENT');
if (escaped.length) {
  console.error(`\nRED DEMO FAILED — ${escaped.length} mutation(s) did not behave as predicted:`);
  for (const r of escaped) console.error(`  ${r.label}: expected ${r.expect}, got ${r.got}`);
  process.exit(1);
}
console.log(`\nRED DEMO PASSED — ${results.length - 1} mutations, all as predicted.`);
console.log('  PART A: all 14 defects check 5 screens for produce RED, including invariant 7\'s own');
console.log('          falsification test (A1) and the F7 "what does the fix refuse" regression (A6).');
console.log(`  PART B: every stub is load-bearing, and ${silent.length} of 7 now fail SILENT.`);
console.log('          B1 and B6 WERE silent — the two stubs whose degenerate value ("cache miss")');
console.log('          is also a legitimate one, and the pair assertion 8 rests on. The positive');
console.log('          control added to check-cache-isolation.mjs turned both LOUD.');
```

### 4.2 Captured output, verbatim

```

=== BASELINE — the artifact as committed ===
  ok   baseline: sw.js as committed
        expected GREEN, got GREEN (exit 0)

=== PART A — restore the defect, check 5 must go RED ===
  ok   A1  origin-wide READ restored (invariant 7, architecture §6.1)
        expected RED, got RED (exit 1)
        FAIL  the root worker SERVED the other deploy path's cached bytes when offline
        FAIL  THE PROMOTED COPY SERVED THE TEST BUILD'S BYTES — invariant 7 by its own stated test
        CHECK 5 FAILED — 2 assertion(s):
  ok   A2  origin-wide REAP restored (architecture §6)
        expected RED, got RED (exit 1)
        FAIL  reap DELETED the OTHER deploy path's cache — this is the origin-wide reap (architecture §6)
        FAIL  reap DELETED an adjacent prefix it does not own — this is the origin-wide reap (architecture §6)
        FAIL  reap DELETED an unrelated cache on the same origin — this is the origin-wide reap (architecture §6)
        FAIL  the legacy exception matched a NEAR MISS — it is a pattern, not a literal
        ... and 2 more
  ok   A3  legacy exception becomes a PATTERN, not a literal
        expected RED, got RED (exit 1)
        FAIL  the legacy exception matched a NEAR MISS — it is a pattern, not a literal
        CHECK 5 FAILED — 1 assertion(s):
  ok   A4  /stable/ exclusion removed (root serves the promoted copy)
        expected RED, got RED (exit 1)
        FAIL  root worker SERVES /stable/ — it can cache the promoted copy under the root prefix
        FAIL  root worker SERVES /stable/ for a subresource GET — it caches the promoted copy under the root prefix
        FAIL  root worker SERVES /stable/ for a top-level navigation — it caches the promoted copy under the root prefix
        FAIL  root worker SERVES /stable/ for a same-origin cors request — it caches the promoted copy under the root prefix
        ... and 10 more
  ok   A5  prefix delimiter dropped — root's prefix nests inside stable's name
        expected RED, got RED (exit 1)
        FAIL  stable's cache name STARTS WITH root's prefix — root would reap stable
        FAIL  reap DELETED the OTHER deploy path's cache — this is the origin-wide reap (architecture §6)
        CHECK 5 FAILED — 2 assertion(s):
  ok   A6  F7 regression: require paths to ARRIVE canonical (refuses /my%20photo.png)
        expected RED, got RED (exit 1)
        FAIL  declined a legitimately encoded asset — it works online and is absent offline
        FAIL  declined a legitimately encoded asset — it works online and is absent offline
        FAIL  declined a legitimately encoded asset — it works online and is absent offline
        FAIL  declined a legitimately encoded asset — it works online and is absent offline
        ... and 2 more
  ok   A7  stable worker allowed to delete the ROOT's legacy cache
        expected RED, got RED (exit 1)
        FAIL  stable's worker DELETED pup-pad-v16 — a cache the ROOT copy owns
        CHECK 5 FAILED — 1 assertion(s):
  ok   A8  non-canonical scope no longer unregisters (orphan cache)
        expected RED, got RED (exit 1)
        FAIL  a worker at a non-canonical scope stayed registered
        CHECK 5 FAILED — 1 assertion(s):
  ok   A9  bare foreign directory served (/PupPad/stable with no slash)
        expected RED, got RED (exit 1)
        FAIL  root worker serves the foreign directory without its trailing slash
        FAIL  root worker serves the foreign directory without its trailing slash
        CHECK 5 FAILED — 2 assertion(s):
  ok   A10 reap moved outside waitUntil onto a timer (F9)
        expected RED, got RED (exit 1)
        FAIL  reap did NOT delete a stale cache of its OWN prefix
        FAIL  reap did NOT delete the legacy cache, by exact literal
        FAIL  a cache was deleted AFTER activate settled — the reap runs outside waitUntil
        CHECK 5 FAILED — 3 assertion(s):
  ok   A11 correct reap PLUS a deferred origin-wide sweep — the exact F9 shape
        expected RED, got RED (exit 1)
        FAIL  a cache was deleted AFTER activate settled — the reap runs outside waitUntil
        CHECK 5 FAILED — 1 assertion(s):
  ok   A12 navigations exempted from the /stable/ decline (pass F4)
        expected RED, got RED (exit 1)
        FAIL  root worker SERVES /stable/ for a top-level navigation — it caches the promoted copy under the root prefix
        CHECK 5 FAILED — 1 assertion(s):
  ok   A13 the PROMOTED copy reads origin-wide (invariant 7 in its own direction, pass F5)
        expected RED, got RED (exit 1)
        FAIL  THE PROMOTED COPY SERVED THE TEST BUILD'S BYTES — invariant 7 by its own stated test
        CHECK 5 FAILED — 1 assertion(s):
  ok   A14 the precache reaches into the other deploy path (pass F7)
        expected RED, got RED (exit 1)
        FAIL  install precached OUTSIDE this worker's scope
        CHECK 5 FAILED — 1 assertion(s):

=== PART B — neuter the STUB, keep a real defect. SILENT = the stub was the only defence ===
  ok   B1  FakeCacheStorage.match() -> undefined, WITH the origin-wide read (the §6.1 blindness)
        expected LOUD, got LOUD (exit 1)
        FAIL  the cross-path seed did not take — the offline-read assertion below would pass VACUOUSLY
        FAIL  the test-build seed did not take — the promoted-copy assertion would pass VACUOUSLY
        CHECK 5 FAILED — 2 assertion(s):
  ok   B2  FakeCacheStorage.delete() made a no-op, WITH the origin-wide reap
        expected LOUD, got LOUD (exit 1)
        FAIL  reap did NOT delete a stale cache of its OWN prefix
        FAIL  reap did NOT delete the legacy cache, by exact literal
        CHECK 5 FAILED — 2 assertion(s):
  ok   B3  FakeCacheStorage.keys() -> [], WITH the origin-wide reap
        expected LOUD, got LOUD (exit 1)
        FAIL  reap DELETED its own current cache — this is the origin-wide reap (architecture §6)
        FAIL  reap DELETED the OTHER deploy path's cache — this is the origin-wide reap (architecture §6)
        FAIL  reap DELETED an adjacent prefix it does not own — this is the origin-wide reap (architecture §6)
        FAIL  reap DELETED an unrelated cache on the same origin — this is the origin-wide reap (architecture §6)
        ... and 3 more
  ok   B4  dispatch() drops respondWith, WITH the /stable/ exclusion removed
        expected LOUD, got LOUD (exit 1)
        FAIL  root worker declined its OWN path — the exclusion is too broad
        FAIL  stable worker declined its own path — the exclusion misfires on the stable copy
        FAIL  root worker declined its OWN path for a subresource GET — the rule is shape-dependent
        FAIL  root worker declined its OWN path for a top-level navigation — the rule is shape-dependent
        ... and 13 more
  ok   B5  registration.scope ignored (both workers get one scope), WITH nesting prefixes
        expected LOUD, got LOUD (exit 1)
        FAIL  the two deploy paths derive the SAME cache prefix
        FAIL  stable's cache name STARTS WITH root's prefix — root would reap stable
        FAIL  root's cache name STARTS WITH stable's prefix
        FAIL  stable worker declined its own path — the exclusion misfires on the stable copy
        ... and 5 more
  ok   B6  cache handle put/match made inert, WITH the origin-wide read
        expected LOUD, got LOUD (exit 1)
        FAIL  the cross-path seed did not take — the offline-read assertion below would pass VACUOUSLY
        FAIL  the test-build seed did not take — the promoted-copy assertion would pass VACUOUSLY
        CHECK 5 FAILED — 2 assertion(s):
  ok   B7  sandbox fetch RESOLVES, WITH the origin-wide read (the audit's own blind spot)
        expected LOUD, got LOUD (exit 1)
        FAIL  the offline branch was NOT exercised — the assertion above passed vacuously
        FAIL  the promoted copy's offline branch was NOT exercised
        CHECK 5 FAILED — 2 assertion(s):

==============================================================================
  ok           GREEN  baseline: sw.js as committed
  ok           RED    A1  origin-wide READ restored (invariant 7, architecture §6.1)
  ok           RED    A2  origin-wide REAP restored (architecture §6)
  ok           RED    A3  legacy exception becomes a PATTERN, not a literal
  ok           RED    A4  /stable/ exclusion removed (root serves the promoted copy)
  ok           RED    A5  prefix delimiter dropped — root's prefix nests inside stable's name
  ok           RED    A6  F7 regression: require paths to ARRIVE canonical (refuses /my%20photo.png)
  ok           RED    A7  stable worker allowed to delete the ROOT's legacy cache
  ok           RED    A8  non-canonical scope no longer unregisters (orphan cache)
  ok           RED    A9  bare foreign directory served (/PupPad/stable with no slash)
  ok           RED    A10 reap moved outside waitUntil onto a timer (F9)
  ok           RED    A11 correct reap PLUS a deferred origin-wide sweep — the exact F9 shape
  ok           RED    A12 navigations exempted from the /stable/ decline (pass F4)
  ok           RED    A13 the PROMOTED copy reads origin-wide (invariant 7 in its own direction, pass F5)
  ok           RED    A14 the precache reaches into the other deploy path (pass F7)
  ok           LOUD   B1  FakeCacheStorage.match() -> undefined, WITH the origin-wide read (the §6.1 blindness)
  ok           LOUD   B2  FakeCacheStorage.delete() made a no-op, WITH the origin-wide reap
  ok           LOUD   B3  FakeCacheStorage.keys() -> [], WITH the origin-wide reap
  ok           LOUD   B4  dispatch() drops respondWith, WITH the /stable/ exclusion removed
  ok           LOUD   B5  registration.scope ignored (both workers get one scope), WITH nesting prefixes
  ok           LOUD   B6  cache handle put/match made inert, WITH the origin-wide read
  ok           LOUD   B7  sandbox fetch RESOLVES, WITH the origin-wide read (the audit's own blind spot)

RED DEMO PASSED — 21 mutations, all as predicted.
  PART A: all 14 defects check 5 screens for produce RED, including invariant 7's own
          falsification test (A1) and the F7 "what does the fix refuse" regression (A6).
  PART B: every stub is load-bearing, and 0 of 7 now fail SILENT.
          B1 and B6 WERE silent — the two stubs whose degenerate value ("cache miss")
          is also a legitimate one, and the pair assertion 8 rests on. The positive
          control added to check-cache-isolation.mjs turned both LOUD.
```
