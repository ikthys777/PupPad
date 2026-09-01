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
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
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
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Parse `source` with Node. `ext` picks script (.js/.cjs) vs module (.mjs) semantics. */
function parse(source, ext, label) {
  const f = join(tmp, `u${failures.length}_${Math.random().toString(36).slice(2)}${ext}`);
  writeFileSync(f, source);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    // Node's --check output already points at the line and column; just re-label
    // the temp path so the message names the real file.
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
  const ext = extname(p) === '.mjs' || (extname(p) === '.js' && looksLikeModule(src)) ? '.mjs' : '.cjs';
  const err = parse(src, ext, rel);
  if (err) failures.push({ unit: rel, err });
  else console.log(`  ok  ${rel}  (${src.split('\n').length} lines, ${ext === '.mjs' ? 'module' : 'script'})`);
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
  const err = parse(padded, s.isModule ? '.mjs' : '.cjs', 'index.html');
  if (err) failures.push({ unit: `index.html (inline script, line ${s.startLine})`, err });
  else console.log(`  ok  index.html inline script  (${s.source.split('\n').length} lines from line ${s.startLine}, ${s.isModule ? 'module' : 'script'})`);
}

if (failures.length) {
  console.error(`\nCHECK 1 FAILED — ${failures.length} unit(s) did not parse:\n`);
  for (const f of failures) console.error(`--- ${f.unit} ---\n${f.err}\n`);
  process.exit(1);
}
console.log(`\nCHECK 1 PASSED — ${jsFiles.length} .js file(s) + ${inline.length} inline script(s) parse.`);
