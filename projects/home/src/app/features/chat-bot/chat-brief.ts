import { BriefResponse } from '../../core/api/assistant-api.service';

/** `TranslateService.instant`, narrowed to what the brief needs. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount);
}

/**
 * Render the structured brief (#289) as chat text, in the app language.
 *
 * The backend sends data rather than words so this works in en/hi/mr and
 * while the model provider is down. The result is plain multi-line text, so
 * the same string can be shown now and restored later from saved history.
 * Sections the backend left out are simply absent.
 */
export function buildBriefText(brief: BriefResponse, t: Translate): string {
  if (!brief.has_data) return t('chatBot.brief.welcome');

  const firstName = brief.name?.trim().split(/\s+/)[0];
  const lines = [
    firstName
      ? t('chatBot.brief.greeting', { name: firstName })
      : t('chatBot.brief.greetingNoName'),
  ];

  const weather = brief.weather;
  if (weather && weather.temp_c != null) {
    const line = t('chatBot.brief.weather', {
      land: weather.land,
      temp: Math.round(weather.temp_c),
      description: weather.description ?? '',
    });
    // 'mock' means the backend had no live data; don't present it as real.
    lines.push(weather.source === 'mock' ? `${line} ${t('chatBot.brief.approximate')}` : line);
  }

  if (brief.pending) {
    const key =
      brief.pending.count === 1 ? 'chatBot.brief.pendingOne' : 'chatBot.brief.pendingMany';
    lines.push(t(key, { count: brief.pending.count }));
    for (const item of brief.pending.next) {
      const detail = [item.activity, item.land ?? item.crop, item.date].filter(Boolean);
      lines.push(`• ${detail.join(' · ')}`);
    }
  }

  if (brief.spend_7d) {
    lines.push(t('chatBot.brief.spend7d', { amount: formatRupees(brief.spend_7d.total) }));
  }

  if (lines.length === 1) lines.push(t('chatBot.brief.nothingNew'));
  return lines.join('\n');
}
