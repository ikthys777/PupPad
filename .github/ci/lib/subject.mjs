/**
 * THE SUBJECT LINE, AND WHY IT IS A LIBRARY.
 *
 * Architecture §5: a demonstration asserts the COMMIT it ran against, never the
 * conclusion alone. A green with no identifiable subject is a claim about a tree
 * nobody can name — architecture §6.1 member 1 wearing a provenance line.
 *
 * PUP-WO-0300 made check 16 fail closed and left a comment saying the sibling checks
 * did not. PUP-WO-0201 swept most of them, and by then NINE files carried a byte-for-byte
 * copy of the same eleven lines — which is how this project's fences drifted four times
 * in a week, and the reason check 16's own comment was still claiming to be alone in
 * failing closed long after it no longer was.
 *
 * THIS IS NOT YET THE ONLY COPY, AND SAYING SO WOULD BE THE DEFECT IT EXISTS TO FIX.
 * An earlier draft of this header said "seven" and "so the rule lives here, once". Both
 * were false: the count is nine, and after PUP-WO-0301 there are TEN implementations —
 * this one, used by five checks, plus the nine inline copies left untouched, including
 * check 16's. What PUP-WO-0301 §2.4 actually dispatched was the four checks that still
 * FELL OPEN — demo-error-poisoning, demo-quota-install, demo-two-path-caches and
 * check-error-caching, the last of which printed "(git unavailable)" under the word
 * SUBJECT and passed — and those four adopt it here. Converting the other nine, and
 * giving a subject to the five static checks that assert none at all
 * (check-syntax, check-assets, check-load, check-mutations, check-cache-isolation),
 * is owed and is recorded as owed in docs/feedback/PUP-WO-0301.md §5.1.
 *
 * PUPPAD_SUBJECT IS A DELIBERATE ESCAPE HATCH AND IT IS ALSO A LOOPHOLE, stated rather
 * than hidden. §5's freeze protocol hands a read-only adversarial pass a `git archive`
 * export with no `.git` at all, so `rev-parse` cannot work there and the pass must be
 * able to state its subject explicitly. What is refused is the third case: no `.git`, no
 * environment variable, and a green anyway. What is NOT verified is that the sha names a
 * commit that exists, or that it describes the tree actually under test — `SHA.test` is a
 * shape check. `PUPPAD_SUBJECT=deadbeef` will be believed.
 *
 * A SECOND, SHARPER LIMIT, measured by an adversarial pass: three of the adopters take
 * the tree to test from `process.argv[2]` but resolve their subject from the tree the
 * SCRIPT came from. Run against a mutated copy they print the repo's HEAD beside the
 * mutant's own blob hash. The blob is honest; the commit line describes the check, not
 * the subject. That is defensible for check-error-caching, which says so; for the other
 * two it is not, and it is recorded in docs/feedback/PUP-WO-0301.md §5.1 as owed.
 */
import { execFileSync } from 'node:child_process';

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * The commit under test, or exit 1. `label` is what appears in the error, e.g.
 * "CHECK 16" — the failing step name architecture §5 also requires.
 */
export function requireSubject(repo, label) {
  let commit = process.env.PUPPAD_SUBJECT || '';
  if (!commit) {
    try {
      commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* no .git, or no git; both land on the refusal below */ }
  }
  if (!SHA.test(commit)) {
    console.error(`::error::${label} cannot identify the commit it is testing.`);
    console.error('  `git rev-parse HEAD` failed and PUPPAD_SUBJECT is unset. A demonstration');
    console.error('  that cannot name its subject proves nothing about any particular tree.');
    console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
    process.exit(1);
  }
  return commit;
}

/**
 * The blob hash of one file, for the checks whose subject is a single artifact rather
 * than a tree. It ALSO requires the commit: a blob hash names a byte sequence and not
 * the tree it was read from, and two of these checks were printing a blob alone.
 * `git hash-object` needs no repository, so this fails closed only when git itself is
 * unavailable — which is still a case that must not pass silently.
 */
export function requireBlob(repo, label, path) {
  const commit = requireSubject(repo, label);
  let blob = '';
  try {
    blob = execFileSync('git', ['hash-object', path],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* falls to the refusal below */ }
  if (!SHA.test(blob)) {
    console.error(`::error::${label} cannot identify the artifact it is testing.`);
    console.error(`  \`git hash-object ${path}\` produced no hash. A demonstration that cannot`);
    console.error('  name its subject proves nothing about any particular file.');
    process.exit(1);
  }
  return { commit, blob };
}
