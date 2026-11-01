export type BannerKind = 'problem' | 'warning' | 'update' | 'new';

/** What a banner can show; title and text are translation keys so a language change is not a content change. */
export interface Banner {
  readonly id: string;
  readonly kind: BannerKind;
  readonly titleKey: string;
  readonly textKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  /** Overrides the default kind label key (e.g. "Offline" instead of "Problem"). */
  readonly labelKey?: string;
  readonly action?: { readonly labelKey: string; readonly run: () => void };
  /** Top-level screens it belongs to ('home', 'weather', ...) or '*' for every screen. */
  readonly screens: readonly string[];
}

/** A banner that is shown while the function returns it, and hidden while it returns null. */
export type BannerSource = () => Banner | null;

export const BANNER_KIND_ORDER: Readonly<Record<BannerKind, number>> = {
  problem: 0,
  warning: 1,
  update: 2,
  new: 3,
};

/** Same id with the same words is the same banner; changed words make it a new one to show again. */
export function bannerContentKey(banner: Banner): string {
  return [banner.id, banner.titleKey, banner.textKey, JSON.stringify(banner.params ?? {})].join(
    '|',
  );
}
