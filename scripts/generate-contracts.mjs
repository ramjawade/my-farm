/**
 * Regenerates `projects/home/src/app/core/api/contracts/*.contract.ts` (and
 * `index.ts`) from `projects/backend/openapi.json` — see issue #196.
 *
 * Usage:  npm run generate:contracts
 *
 * `projects/backend/openapi.json` is produced by
 * `projects/backend/scripts/export_openapi.py` (needs Python + the backend's
 * deps) and is committed, so this script only needs Node — no backend
 * environment required to regenerate the frontend types.
 *
 * `common.contract.ts` and `reference.contract.ts` are intentionally NOT
 * touched here (see their own header comments): those endpoints hand-build
 * a response envelope (`response_model=dict`) that has no schema for
 * openapi-typescript to read.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import prettier from 'prettier';
import { CONTRACT_FILES } from './contract-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OPENAPI_JSON = path.join(REPO_ROOT, 'projects/backend/openapi.json');
const CONTRACTS_DIR = path.join(REPO_ROOT, 'projects/home/src/app/core/api/contracts');
const GENERATED_SCHEMA_PATH = path.join(CONTRACTS_DIR, 'generated/openapi-schema.ts');

// Fixed order, matching the barrel's existing (dependency-aware) ordering —
// farmer before auth (auth's SessionResponse nests a farmer), everything
// else grouped by how often it's touched. common/reference are hand-written.
const BARREL_ORDER = [
  'common.contract.ts',
  'farmer.contract.ts',
  'auth.contract.ts',
  'farm.contract.ts',
  'land.contract.ts',
  'crop.contract.ts',
  'activity.contract.ts',
  'expense.contract.ts',
  'attachment.contract.ts',
  'reference.contract.ts',
];

const GENERATED_BANNER = (sourceFiles) => `/**
 * GENERATED — do not edit by hand.
 *
 * Run \`npm run generate:contracts\` to update, after regenerating
 * \`projects/backend/openapi.json\` (see projects/backend/scripts/export_openapi.py).
 * Source schema${sourceFiles.length > 1 ? 's' : ''}: ${sourceFiles.join(', ')}.
 */\n\n`;

async function main() {
  const schema = JSON.parse(fs.readFileSync(OPENAPI_JSON, 'utf-8'));

  // 1. The raw, full openapi-typescript output — internal, not imported
  //    directly by app code (app code only ever imports the flat named
  //    types below, via the barrel).
  const ast = await openapiTS(schema);
  const rawTypes = astToString(ast);
  const schemaFileContent = `/**\n * GENERATED — do not edit by hand. Run \`npm run generate:contracts\` to update.\n * Full raw type output from projects/backend/openapi.json via openapi-typescript.\n */\n\n${rawTypes}`;
  const prettierConfig = (await prettier.resolveConfig(GENERATED_SCHEMA_PATH)) ?? {};
  const formattedSchema = await prettier.format(schemaFileContent, {
    ...prettierConfig,
    filepath: GENERATED_SCHEMA_PATH,
  });
  fs.mkdirSync(path.dirname(GENERATED_SCHEMA_PATH), { recursive: true });
  fs.writeFileSync(GENERATED_SCHEMA_PATH, formattedSchema);

  // 2. One flat, named-export file per entity, matching the app's existing
  //    import surface (e.g. `import { ActivityResponse } from '../contracts'`).
  for (const entry of CONTRACT_FILES) {
    const schemaNames = entry.exports.map((e) => e.schema);
    const lines = entry.exports.map(
      (e) => `export type ${e.name} = components['schemas']['${e.schema}'];`,
    );
    const content =
      `${entry.header}\n\n` +
      GENERATED_BANNER(schemaNames) +
      `import type { components } from './generated/openapi-schema';\n\n` +
      lines.join('\n') +
      '\n';
    fs.writeFileSync(path.join(CONTRACTS_DIR, entry.file), content);
  }

  // 3. The barrel — every file in BARREL_ORDER that actually exists.
  const existing = BARREL_ORDER.filter((f) => fs.existsSync(path.join(CONTRACTS_DIR, f)));
  const barrel =
    `/**\n` +
    ` * MyFarm API contracts — the frontend's request/response shapes for every\n` +
    ` * backend endpoint the app calls.\n` +
    ` *\n` +
    ` * Most of these are GENERATED from the backend's OpenAPI schema\n` +
    ` * (projects/backend/openapi.json) via \`npm run generate:contracts\` (issue\n` +
    ` * #196). CI regenerates and diffs them on every push, so a backend schema\n` +
    ` * change that isn't reflected here fails the build instead of drifting\n` +
    ` * silently. \`common.contract.ts\` and \`reference.contract.ts\` are\n` +
    ` * exceptions — hand-written, since their endpoints hand-build a response\n` +
    ` * shape openapi-typescript can't see (see their own header comments).\n` +
    ` */\n\n` +
    existing.map((f) => `export * from './${f.replace(/\.ts$/, '')}';`).join('\n') +
    '\n';
  fs.writeFileSync(path.join(CONTRACTS_DIR, 'index.ts'), barrel);

  console.log(
    `Regenerated ${CONTRACT_FILES.length} contract file(s) + index.ts + generated/openapi-schema.ts`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
