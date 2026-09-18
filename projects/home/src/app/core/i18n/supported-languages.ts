/**
 * Short ISO-ish codes, matching the account's stored `preferredLanguage`
 * format (backend default "en", see FarmerBase.preferred_language).
 * Single source of truth for the profile language dropdown and the i18n
 * runtime switch (#190) — don't re-declare this list elsewhere.
 */
export interface SupportedLanguage {
  value: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { value: 'en', label: 'English (English)' },
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
  { value: 'es', label: 'Spanish (Español)' },
];
