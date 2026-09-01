#!/usr/bin/env node
/**
 * CHECK 1 — Syntax.
 * Parses every .js in the repo AND the inline script of index.html.
 * Parse only: no execution, no linting, no style opinions.
 *
 * Line numbers are reported against index.html directly: the extracted body is
 * padded with blank lines so that parser line N is file line N. That is the
 * difference between a usable failure and "there is an error somewhere in 1,900
 * lines".
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, extname } from 'node:path';
import { extractInlineScripts } from './lib/inline-script.mjs';

const REPO = process.argv[2] || process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);
const tmp = mkdtempSync(join(tmpdir(), 'puppad-syntax-'));
const failures = [];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    // A dangling symlink would make statSync throw and take the whole check down
    // with a raw stack trace — red, but for a reason the check never names.
    if (!existsSync(p)) { console.log(`  skip  ${relative(REPO, p)}  (broken symlink or unreadable)`); continue; }
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Parse `source` in the mode a browser would use.
 *
 * CLASSIC SCRIPT — vm.Script, NOT `node --check`. This distinction is the whole
 * correctness of this check. `node --check` on a .js/.cjs file parses as
 * CommonJS, which wraps the source in a function, and a function body legalises
 * constructs a browser classic script rejects. `return;` at top level is the
 * concrete case: `node --check` accepts it, Chromium refuses to execute the
 * entire script with "Illegal return statement". vm.Script compiles in true
 * global-script mode and rejects it, matching the browser.
 *
 * MODULE — `node --check` on a .mjs file, which is genuine module mode (and
 * correctly rejects top-level return as well).
 */
function parse(source, isModule, label) {
  if (!isModule) {
    try {
      new vm.Script(source, { filename: label });
      return null;
    } catch (e) {
      const line = e.stack?.split('\n')[0] ?? label;
      return `${line}\n${e.name}: ${e.message}`;
    }
  }
  const f = join(tmp, `u${failures.length}_${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(f, source);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    return String(e.stderr || e.message).replaceAll(f, label).trim();
  }
}

/** ES module syntax is a parse error in script mode, so choose the mode deliberately. */
const looksLikeModule = (src) =>
  /^\s*(import\s|export\s|import\s*\{|export\s*\{|import\s*\()/m.test(src);

// ---- every .js in the repo (excluding CI tooling, which is not shipped) ----
const jsFiles = walk(REPO).filter(p => ['.js', '.mjs', '.cjs'].includes(extname(p)));
for (const p of jsFiles) {
  const rel = relative(REPO, p);
  const src = readFileSync(p, 'utf8');
  const isModule = extname(p) === '.mjs' || (extname(p) === '.js' && looksLikeModule(src));
  const err = parse(src, isModule, rel);
  if (err) failures.push({ unit: rel, err });
  else console.log(`  ok  ${rel}  (${src.split('\n').length} lines, ${isModule ? 'module' : 'classic script'})`);
}

// ---- the inline script of index.html ----
const htmlPath = join(REPO, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const inline = extractInlineScripts(html);
if (inline.length === 0) {
  failures.push({ unit: 'index.html', err: 'No inline script found. index.html carries all behaviour in one inline <script>; finding none means the extractor or the file changed shape.' });
}
for (const s of inline) {
  // Pad so parser line N == index.html line N.
  const padded = '\n'.repeat(s.startLine - 1) + s.source;
  const err = parse(padded, s.isModule, 'index.html');
  if (err) failures.push({ unit: `index.html (inline script, line ${s.startLine})`, err });
  else console.log(`  ok  index.html inline script  (${s.source.split('\n').length} lines from line ${s.startLine}, ${s.isModule ? 'module' : 'classic script'})`);
}

if (failures.length) {
  console.error(`\nCHECK 1 FAILED — ${failures.length} unit(s) did not parse:\n`);
  for (const f of failures) console.error(`--- ${f.unit} ---\n${f.err}\n`);
  process.exit(1);
}
console.log(`\nCHECK 1 PASSED — ${jsFiles.length} .js file(s) + ${inline.length} inline script(s) parse.`);
