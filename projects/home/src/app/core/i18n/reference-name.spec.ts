import { TranslateService } from '@ngx-translate/core';

import { resolveReferenceName, slugifyReferenceName } from './reference-name';

describe('slugifyReferenceName', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugifyReferenceName('Land Preparation')).toBe('land_preparation');
  });

  it('strips punctuation and trims stray leading/trailing underscores', () => {
    expect(slugifyReferenceName('  Bajra! ')).toBe('bajra');
  });
});

describe('resolveReferenceName', () => {
  function fakeTranslate(dict: Record<string, string>): TranslateService {
    return {
      instant: (key: string) => dict[key] ?? key,
    } as unknown as TranslateService;
  }

  it('returns the translated label when a key matches the seeded/curated set', () => {
    const translate = fakeTranslate({ 'crop.wheat': 'गहू' });

    expect(resolveReferenceName(translate, 'crop', 'Wheat')).toBe('गहू');
  });

  it('falls back to the raw stored name when no key matches (farmer-typed value)', () => {
    const translate = fakeTranslate({});

    expect(resolveReferenceName(translate, 'crop', 'Bajra')).toBe('Bajra');
  });

  it('returns an empty string for empty input without a translate lookup', () => {
    const translate = fakeTranslate({});
    spyOn(translate, 'instant');

    expect(resolveReferenceName(translate, 'crop', '')).toBe('');
    expect(translate.instant).not.toHaveBeenCalled();
  });
});
