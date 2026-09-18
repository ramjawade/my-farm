/**
 * Short ISO-ish codes, matching the account's stored `preferredLanguage`
 * format (backend default "en", see FarmerBase.preferred_language).
 * Single source of truth for the profile language dropdown and the i18n
 * runtime switch (#190) — don't re-declare this list elsewhere.
 *
 * `supported: false` entries have no translation content yet
 * (`projects/home/public/i18n/<code>.json` doesn't exist) — they're
 * listed so the roadmap is visible, but callers must not let a user
 * select one (#210).
 */
export interface SupportedLanguage {
  value: string;
  label: string;
  supported: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { value: 'en', label: 'English (English)', supported: true },
  { value: 'hi', label: 'Hindi (हिन्दी)', supported: true },
  { value: 'mr', label: 'Marathi (मराठी)', supported: true },
  { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)', supported: false },
  { value: 'te', label: 'Telugu (తెలుగు)', supported: false },
  { value: 'ta', label: 'Tamil (தமிழ்)', supported: false },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)', supported: false },
  { value: 'bn', label: 'Bengali (বাংলা)', supported: false },
  { value: 'es', label: 'Spanish (Español)', supported: false },
];
