#!/usr/bin/env node
// Translation guard: the three language files must hold exactly the same keys,
// with no empty values and the same {{placeholders}}, and templates must not
// carry raw (untranslated) text. Run: `node scripts/check-translations.mjs`
// (`--self-test` checks the detector itself, `--audit` lists raw text only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = path.join(root, 'projects/home/public/i18n');
const SRC_DIR = path.join(root, 'projects/home/src/app');
const LANGS = ['en', 'hi', 'mr'];

/** Words that are names or units, not sentences: allowed as raw text. */
const ALLOWED_RAW = new Set(['my farm', 'myfarm', 'csv', 'mm', 'km/h', 'ha / ac']);

// ---------- translation files ----------

export function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}

const placeholders = (s) => [...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

export function compareLanguages(files) {
  const problems = [];
  const base = files.en;
  for (const lang of LANGS) {
    const flat = files[lang];
    for (const key of Object.keys(base)) {
      if (!(key in flat)) problems.push(`${lang}: missing key "${key}"`);
    }
    for (const key of Object.keys(flat)) {
      if (!(key in base)) problems.push(`${lang}: extra key "${key}" (not in en)`);
      else if (flat[key].trim() === '') problems.push(`${lang}: empty value for "${key}"`);
      else if (placeholders(flat[key]) !== placeholders(base[key]))
        problems.push(`${lang}: placeholders of "${key}" differ from en ({{${placeholders(base[key])}}})`);
    }
  }
  return problems;
}

// ---------- raw text in templates ----------

const TAG = /<\/?[a-zA-Z][^\s>/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const STATIC_ATTR = /(?<![\w.\]\)-])(placeholder|title|aria-label|alt|label|aria-placeholder|message|heading|subtitle|description|actionLabel|caption|confirmText|cancelText|confirmLabel|cancelLabel|emptyText)\s*=\s*"([^"]*)"/g;

const hasWords = (s) => /[A-Za-z]{2,}/.test(s);

function clean(s) {
  return s
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .trim();
}

/** Raw (untranslated) text nodes and attributes in one template. */
export function rawTextIn(template) {
  const found = [];
  const noComments = template.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of noComments.matchAll(TAG)) {
    for (const a of tag[0].matchAll(STATIC_ATTR)) {
      const value = clean(a[2]);
      if (hasWords(value) && !ALLOWED_RAW.has(value.toLowerCase())) found.push(`${a[1]}="${value}"`);
    }
  }
  // Text literals inside {{ }} (e.g. {{ ok ? 'Saved' : 'Failed' }}); keys, class names and reference-name inputs pass.
  for (const m of noComments.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    if (/\|\s*(translate|referenceName)\b/.test(m[1])) continue;
    const expr = m[1].replace(/\|\s*(?:local\w+|date|number)\s*:\s*'[^']*'/g, '');
    for (const lit of expr.matchAll(/'([^']+)'/g)) {
      const value = lit[1].trim();
      if ((/\s/.test(value) || /^[A-Z]/.test(value)) && hasWords(value) && !ALLOWED_RAW.has(value.toLowerCase()))
        found.push(`{{ '${value}' }}`);
    }
  }
  const text = noComments
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replace(TAG, '\u0000')
    .replace(/@(?:if|else\s+if|for|switch|case|default|empty|else|defer|placeholder|loading|error)\b[^{]*\{/g, '\u0000')
    .replace(/[{}]/g, '\u0000');
  for (const piece of text.split('\u0000')) {
    const value = clean(piece).replace(/\s+/g, ' ');
    if (hasWords(value) && !ALLOWED_RAW.has(value.toLowerCase())) found.push(value);
  }
  return found;
}

function* sourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(html|ts)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)) yield full;
  }
}

export function auditTemplates() {
  const out = [];
  for (const file of sourceFiles(SRC_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    const templates = file.endsWith('.html')
      ? [text]
      : [...text.matchAll(/template:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
    for (const t of templates) {
      for (const raw of rawTextIn(t)) out.push(`${path.relative(root, file).replace(/\\/g, '/')}: ${raw}`);
    }
  }
  return out;
}

// ---------- self-test ----------

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`check-translations self-test failed: ${msg}`);
      process.exit(1);
    }
  };
  const en = { a: 'Hello {{name}}', b: 'Bye' };
  assert(compareLanguages({ en, hi: { a: 'नमस्कार {{name}}', b: 'अलविदा' }, mr: { a: 'नमस्कार {{name}}', b: 'निरोप' } }).length === 0, 'matching files pass');
  assert(compareLanguages({ en, hi: { a: 'x {{name}}' }, mr: { a: 'x {{name}}', b: 'y' } }).some((p) => p.includes('hi: missing key "b"')), 'missing key');
  assert(compareLanguages({ en, hi: { a: 'x', b: 'y' }, mr: { a: 'x {{name}}', b: ' ' } }).length === 2, 'placeholder and empty value');
  assert(rawTextIn('<p>{{ "k" | translate }}</p>').length === 0, 'bindings pass');
  assert(rawTextIn('<button>Save</button>')[0] === 'Save', 'raw text');
  assert(rawTextIn('<input placeholder="Search" aria-label="{{ \'k\' | translate }}" [placeholder]="x" />').join() === 'placeholder="Search"', 'raw attribute only');
  assert(rawTextIn('@if (a > b) { <i class="bi"></i> {{ x }} ₹ | } @else { <b>Hi</b> }').join() === 'Hi', 'control flow and symbols');
  assert(rawTextIn('<span>My Farm</span><small>12 / 30</small>').length === 0, 'names and numbers pass');
  console.log('check-translations self-test passed');
}

// ---------- main ----------

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (process.argv.includes('--audit')) {
  const found = auditTemplates();
  console.log(found.join('\n'));
  console.log(`\n${found.length} raw strings`);
} else {
  const files = {};
  for (const lang of LANGS) {
    files[lang] = flatten(JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8')));
  }
  const problems = [...compareLanguages(files), ...auditTemplates().map((r) => `raw text: ${r}`)];
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\ncheck-translations: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`check-translations: ${Object.keys(files.en).length} keys in sync; no raw template text.`);
}
