/** One entry of the app's main navigation (sidebar and phone tab bar). */
export interface NavItem {
  /** Matches `data.section` on the routes that belong to this item. */
  readonly key: string;
  readonly labelKey: string;
  /** Bootstrap Icons class. */
  readonly icon: string;
  readonly link: string;
  /** Show a tab in the phone tab bar. */
  readonly phoneTab: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', labelKey: 'shell.nav.home', icon: 'bi-house-door', link: '/', phoneTab: true },
  { key: 'lands', labelKey: 'shell.nav.lands', icon: 'bi-map', link: '/map', phoneTab: true },
  {
    key: 'crops',
    labelKey: 'shell.nav.crops',
    icon: 'bi-grid-3x3-gap',
    link: '/crops',
    phoneTab: true,
  },
  {
    key: 'activity',
    labelKey: 'shell.nav.activity',
    icon: 'bi-activity',
    link: '/activities',
    phoneTab: true,
  },
  {
    key: 'reports',
    labelKey: 'shell.nav.reports',
    icon: 'bi-bar-chart-line',
    link: '/reports',
    phoneTab: true,
  },
  {
    key: 'prices',
    labelKey: 'shell.nav.prices',
    icon: 'bi-currency-rupee',
    link: '/prices',
    phoneTab: true,
  },
  {
    key: 'weather',
    labelKey: 'shell.nav.weather',
    icon: 'bi-cloud-sun',
    link: '/weather',
    phoneTab: false,
  },
  {
    key: 'assistant',
    labelKey: 'shell.nav.assistant',
    icon: 'bi-chat-dots',
    link: '/chat',
    phoneTab: false,
  },
];

/** Up to two initials from a name, drawn locally (no third-party avatar request). */
export function userInitials(fullName: string | null | undefined): string {
  const name = fullName?.trim() || 'User';
  const words = name.split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
}
