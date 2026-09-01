#!/usr/bin/env node
/**
 * CHECK 2 — Asset manifest.
 * Every LOCAL asset referenced by index.html (and by manifest.json, whose icons
 * index.html pulls in transitively) must appear in sw.js's urlsToCache.
 *
 * Local means same-origin and relative. The three third-party tags at
 * index.html:11-13 are excluded, not flagged — they are PUP-WO-0600's subject.
 *
 * Direction matters: this asserts referenced ⊆ cached. It deliberately does NOT
 * assert the reverse, because urlsToCache legitimately holds './' (the directory
 * form of index.html) which nothing references by name.
 *
 * ONE DELIBERATE EXCLUSION: the service worker script itself. It is referenced
 * by navigator.serviceWorker.register('sw.js') (index.html:1935), but it must NOT
 * appear in its own urlsToCache. The browser fetches and updates a worker through
 * its own registration path, never from the Cache API, and a worker that caches
 * itself can serve a stale copy of itself and pin an old cache generation. So it
 * is excluded by rule, derived from the register() call rather than hardcoded.
 *
 * WHAT THIS SCANNER CANNOT SEE — stated because a check's blind spot is part of
 * its specification: a path assembled at runtime, e.g. './games/' + id + '.js'.
 * It sees string literals. This is survivable because the games registry
 * (findings §9.1) stores each module path as a literal `module:` field, so the
 * literal is present in index.html even though the import that consumes it is
 * computed. If a later work order computes module paths instead of listing them,
 * this check goes blind and northstar invariant 6's manifest promise loses its
 * mechanical half.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.argv[2] || process.cwd();
const html = readFileSync(join(REPO, 'index.html'), 'utf8');
const sw = readFileSync(join(REPO, 'sw.js'), 'utf8');

// ---- what sw.js caches ----
const listMatch = sw.match(/urlsToCache\s*=\s*\[([\s\S]*?)\]/);
if (!listMatch) {
  console.error('CHECK 2 FAILED — could not find urlsToCache array in sw.js (sw.js:2-8).');
  console.error('The check cannot verify what it cannot parse, and silently passing here would be worse than failing.');
  process.exit(1);
}
const norm = (p) => p.replace(/^\.\//, '').replace(/^\//, '');
const cached = new Set([...listMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => norm(m[1])));

// ---- what is referenced ----
const ASSET_EXT = /\.(html|js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|woff2?|ttf|otf|mp3|ogg|wav|webmanifest)$/i;
const isLocal = (u) =>
  !/^[a-z][a-z0-9+.-]*:/i.test(u) &&        // http:, https:, data:, blob:, mailto:
  !u.startsWith('//') &&                     // protocol-relative
  !u.startsWith('#');

// The registered service worker script — excluded from the must-be-cached set.
// Derived from the register() call so it stays correct if the filename changes.
const swRegistered = new Set(
  [...html.matchAll(/serviceWorker\s*\.\s*register\s*\(\s*['"]([^'"]+)['"]/g)].map(m => norm(m[1]))
);

const refs = new Map(); // normalised path -> [how it was found]
function note(raw, how) {
  if (!raw || !isLocal(raw)) return;
  const clean = raw.split(/[?#]/)[0].trim();
  if (!clean || !ASSET_EXT.test(clean)) return;
  const k = norm(clean);
  if (!refs.has(k)) refs.set(k, []);
  refs.get(k).push(how);
}

// (a) HTML attributes that fetch: src, href
for (const m of html.matchAll(/\b(src|href)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
  note(m[3] ?? m[4], `index.html ${m[1]}=`);
}
// (b) CSS url() inside inline <style>
for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) note(m[1], 'index.html css url()');
// (c) any string literal in the inline script that looks like a local asset path —
//     catches serviceWorker.register('sw.js'), import('./games/x.js'), new Image().src, fetch()
for (const m of html.matchAll(/['"`]([^'"`\n]*\.(?:html|js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|woff2?|ttf|otf|mp3|ogg|wav|webmanifest))['"`]/gi)) {
  note(m[1], 'index.html string literal');
}
// (d) manifest.json icons — local assets the installed app needs offline, reached
//     through index.html's <link rel="manifest">.
const manifestPath = join(REPO, 'manifest.json');
if (existsSync(manifestPath)) {
  try {
    const mf = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const icon of mf.icons || []) note(icon.src, 'manifest.json icons[].src');
    if (mf.start_url) note(mf.start_url, 'manifest.json start_url');
  } catch (e) {
    console.error(`CHECK 2 FAILED — manifest.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

// ---- compare ----
const missing = [];
for (const [path, hows] of refs) {
  if (swRegistered.has(path)) continue;                       // see ONE DELIBERATE EXCLUSION above
  if (!cached.has(path)) missing.push({ path, hows: [...new Set(hows)] });
}

console.log(`  urlsToCache (${cached.size}): ${[...cached].map(c => c || './').join(', ')}`);
console.log(`  local assets referenced (${refs.size}): ${[...refs.keys()].join(', ')}`);
if (swRegistered.size) console.log(`  excluded (a worker must not cache itself): ${[...swRegistered].join(', ')}`);

if (missing.length) {
  console.error(`\nCHECK 2 FAILED — ${missing.length} local asset(s) referenced but not in sw.js's urlsToCache:\n`);
  for (const m of missing) console.error(`  ${m.path}\n    referenced by: ${m.hows.join('; ')}`);
  console.error(`\nAdd each to urlsToCache in sw.js (sw.js:2-8). Anything not listed is absent from a cold`);
  console.error(`offline install — northstar invariant 3, and the manifest half of invariant 6.`);
  process.exit(1);
}
console.log(`\nCHECK 2 PASSED — all ${refs.size} local asset reference(s) are cached.`);
