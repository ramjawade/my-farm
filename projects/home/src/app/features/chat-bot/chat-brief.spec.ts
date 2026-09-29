import { BriefResponse } from '../../core/api/assistant-api.service';
import { buildBriefText } from './chat-brief';

/** A translator that shows the key and params, so the test reads what would be rendered. */
const t = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key} ${JSON.stringify(params)}` : key;

function brief(overrides: Partial<BriefResponse> = {}): BriefResponse {
  return { has_data: true, name: null, weather: null, pending: null, spend_7d: null, ...overrides };
}

describe('buildBriefText', () => {
  it('is just the welcome for a farmer with no data', () => {
    expect(buildBriefText(brief({ has_data: false }), t)).toBe('chatBot.brief.welcome');
  });

  it('greets by first name only', () => {
    const text = buildBriefText(brief({ name: '  Ramesh Kumar Patil ' }), t);

    expect(text.split('\n')[0]).toBe('chatBot.brief.greeting {"name":"Ramesh"}');
  });

  it('greets without a name when there is none', () => {
    expect(buildBriefText(brief(), t).split('\n')[0]).toBe('chatBot.brief.greetingNoName');
  });

  it('says so when there is data but nothing to report', () => {
    expect(buildBriefText(brief(), t).split('\n')).toEqual([
      'chatBot.brief.greetingNoName',
      'chatBot.brief.nothingNew',
    ]);
  });

  it('includes weather, rounding the temperature', () => {
    const text = buildBriefText(
      brief({
        weather: { land: 'Plot 1', temp_c: 30.6, description: 'clear sky', source: 'live' },
      }),
      t,
    );

    expect(text).toContain(
      'chatBot.brief.weather {"land":"Plot 1","temp":31,"description":"clear sky"}',
    );
    expect(text).not.toContain('approximate');
  });

  it('marks weather that is not live as approximate', () => {
    const text = buildBriefText(
      brief({ weather: { land: 'Plot 1', temp_c: 28, description: 'few clouds', source: 'mock' } }),
      t,
    );

    expect(text).toContain('chatBot.brief.approximate');
  });

  it('leaves out weather that has no temperature', () => {
    const text = buildBriefText(
      brief({ weather: { land: 'Plot 1', temp_c: null, description: null, source: 'live' } }),
      t,
    );

    expect(text).not.toContain('chatBot.brief.weather');
  });

  it('lists the soonest pending items under the count, singular and plural', () => {
    const next = [
      {
        activity: 'Irrigation',
        land: 'Plot 1',
        crop: null,
        date: '2026-10-01',
        status: 'Scheduled',
      },
      { activity: 'Spraying', land: null, crop: 'Onion', date: null, status: 'Draft' },
    ];

    const many = buildBriefText(brief({ pending: { count: 5, next } }), t).split('\n');
    expect(many).toContain('chatBot.brief.pendingMany {"count":5}');
    expect(many).toContain('• Irrigation · Plot 1 · 2026-10-01');
    expect(many).toContain('• Spraying · Onion');

    const one = buildBriefText(brief({ pending: { count: 1, next: [next[0]] } }), t);
    expect(one).toContain('chatBot.brief.pendingOne {"count":1}');
  });

  it('formats spend with Indian digit grouping', () => {
    const text = buildBriefText(brief({ spend_7d: { total: 1234567.5 } }), t);

    expect(text).toContain('chatBot.brief.spend7d {"amount":"12,34,567.5"}');
  });

  it('puts every section on its own line, in a fixed order', () => {
    const text = buildBriefText(
      brief({
        name: 'Ramesh',
        weather: { land: 'Plot 1', temp_c: 30, description: 'clear', source: 'live' },
        pending: { count: 1, next: [] },
        spend_7d: { total: 100 },
      }),
      t,
    );

    expect(text.split('\n').map((line) => line.split(' ')[0])).toEqual([
      'chatBot.brief.greeting',
      'chatBot.brief.weather',
      'chatBot.brief.pendingOne',
      'chatBot.brief.spend7d',
    ]);
  });
});
