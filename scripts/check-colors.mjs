#!/usr/bin/env node
/**
 * Colour guard (OpenSpec change: design-tokens-foundation).
 *
 * Fails when a colour literal appears outside the token layer. Every colour
 * the app renders must come from a --mf-* design token so the light/dark
 * theme can change it. Reports hex codes, rgb()/rgba()/hsl()/hsla() with
 * literal numbers, and common named colours in style declarations.
 *
 * Usage: node scripts/check-colors.mjs [--json]
 *        node scripts/check-colors.mjs --self-test
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIR = join(ROOT, 'projects');
const EXTENSIONS = new Set(['.scss', '.css', '.html', '.ts']);
const SKIP_DIRS = new Set(['node_modules', 'generated', 'dist', '.angular']);

/** Files that may hold colour literals (Sass needs real colours for Bootstrap's maths). */
const ALLOW = new Set([
  'projects/home/src/styles/_tokens.scss',
  'projects/home/src/styles/_bootstrap-variables.scss',
  'projects/home/public/manifest.webmanifest',
  'projects/home/src/manifest.webmanifest',
]);

/** Matches `<meta name="theme-color" content="#...">` so it can stay literal. */
const THEME_COLOR_META = /<meta\s+name=["']theme-color["'][^>]*>/gi;

const HEX = /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![-\w])/g;
const FUNC = /\b(?:rgba?|hsla?)\(\s*[\d.]/g;
// rgba() needs an -rgb channel token: rgba(var(--mf-leaf), .1) is invalid CSS.
const RGBA_NEEDS_CHANNEL = /rgba\(\s*var\(--mf-(?![\w-]*-rgb\))[\w-]+\)/g;
const NAMED = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'gray',
  'grey',
  'purple',
];
const NAMED_IN_DECL = new RegExp(
  `(?:^|[;{\\s"'])(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke|outline(?:-color)?|text-decoration-color|caret-color|accent-color)\\s*:\\s*[^;}"']*?\\b(?:${NAMED.join('|')})\\b`,
  'gi',
);

/** Blank out comments (keeping line breaks) so `// see #242` is not a colour. */
export function stripComments(source, ext) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (ext === '.html') {
    out = out.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  }
  if (ext === '.scss' || ext === '.ts') {
    // `//` starts a comment only at line start or after whitespace (not in `https://`).
    out = out.replace(
      /(^|[\s;{}(,])\/\/[^\n]*/g,
      (m, lead) => lead + ' '.repeat(m.length - lead.length),
    );
  }
  return out;
}

export function findColors(source, ext) {
  let text = stripComments(source, ext);
  if (ext === '.html') text = text.replace(THEME_COLOR_META, (m) => m.replace(/[^\n]/g, ' '));
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const re of [HEX, FUNC, NAMED_IN_DECL, RGBA_NEEDS_CHANNEL]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        hits.push({ line: i + 1, text: m[0].trim().slice(0, 60) });
      }
    }
  });
  return hits;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function scan() {
  const findings = [];
  for (const file of walk(SCAN_DIR)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const ext = rel.slice(rel.lastIndexOf('.'));
    if (!EXTENSIONS.has(ext) || rel.endsWith('.spec.ts') || ALLOW.has(rel)) continue;
    for (const hit of findColors(readFileSync(file, 'utf8'), ext)) {
      findings.push({ file: rel, ...hit });
    }
  }
  return findings;
}

function selfTest() {
  const must = [
    ['.scss', 'a { color: #3182ce; }'],
    ['.scss', 'a { box-shadow: 0 1px rgba(0,0,0,.1); }'],
    ['.ts', "const c = '#38a169';"],
    ['.html', '<i style="color:#fff"></i>'],
    ['.scss', 'a { background: white; }'],
    ['.scss', 'a { fill: hsl(120 50% 50%); }'],
    ['.scss', 'a { box-shadow: 0 1px rgba(var(--mf-leaf), 0.1); }'],
  ];
  const mustNot = [
    ['.ts', '// see #242 for details'],
    ['.ts', '/** Fixes #258 (parse) */ const a = 1;'],
    ['.scss', 'a { color: var(--mf-leaf); background: rgba(var(--mf-leaf-rgb), 0.1); }'],
    ['.scss', 'a { color: transparent; border: 1px solid currentColor; }'],
    ['.html', '<a href="#top">top</a> <div id="x"></div>'],
    ['.ts', "const url = 'https://example.com/#anchor';"],
    ['.html', '<meta name="theme-color" content="#2f7a3f" />'],
  ];
  let failed = 0;
  for (const [ext, src] of must) {
    if (!findColors(src, ext).length) {
      console.error(`self-test: should flag -> ${src}`);
      failed++;
    }
  }
  for (const [ext, src] of mustNot) {
    const hits = findColors(src, ext);
    if (hits.length) {
      console.error(`self-test: should ignore -> ${src} (got ${JSON.stringify(hits)})`);
      failed++;
    }
  }
  if (failed) process.exit(1);
  console.log(`check-colors self-test passed (${must.length} flagged, ${mustNot.length} ignored)`);
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = scan();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(findings, null, 1));
  } else if (findings.length) {
    for (const f of findings) console.error(`${f.file}:${f.line}  ${f.text}`);
    console.error(
      `\n${findings.length} colour literal(s) found. Use a design token (var(--mf-*)) instead.`,
    );
  } else {
    console.log('check-colors: no colour literals outside the token layer.');
  }
  process.exit(findings.length ? 1 : 0);
}
