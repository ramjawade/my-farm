/** Device-level language choice; works before sign-in. Kept by the legacy storage cleanup. */
export const LANGUAGE_STORAGE_KEY = 'my_farm_language';

/** Languages with full translations, in the order the switch shows them. */
export const APP_LANGUAGES = ['mr', 'hi', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'mr';

/** Narrows a stored or profile value; anything unsupported is `null`. */
export function asAppLanguage(value: unknown): AppLanguage | null {
  return APP_LANGUAGES.find((l) => l === value) ?? null;
}
