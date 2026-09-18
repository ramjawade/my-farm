import { TranslateService } from '@ngx-translate/core';

/**
 * Reference data (crop, activity type, expense category) whose *seeded*
 * names are pre-translated by key, but which a farmer can also extend with
 * arbitrary free text at runtime (`POST /api/v1/reference/crops`, etc — see
 * #190's "Dynamic reference data" section). There's no dictionary entry for
 * text nobody has seen ahead of time, so anything without a matching key
 * falls back to the raw stored name rather than a blank or a missing-key
 * placeholder.
 */
export type ReferenceNameCategory = 'crop' | 'activity' | 'expense';

/** `"Land Preparation"` -> `"land_preparation"`. */
export function slugifyReferenceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolves a reference-data display name through the `<category>.<slug>`
 * translation key, falling back to `name` unchanged when no key matches
 * (the default `MissingTranslationHandler` returns the key itself, which
 * this detects and swaps back out for the original name).
 */
export function resolveReferenceName(
  translate: TranslateService,
  category: ReferenceNameCategory,
  name: string,
): string {
  if (!name) {
    return name;
  }
  const key = `${category}.${slugifyReferenceName(name)}`;
  const translated = translate.instant(key);
  return translated === key ? name : (translated as string);
}
