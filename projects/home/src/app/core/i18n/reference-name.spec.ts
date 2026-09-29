import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { ReferenceDataService } from '../api/reference-data.service';
import { ReferenceNamePipe } from './reference-name.pipe';

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

describe('ReferenceNamePipe with reference ids', () => {
  let pipe: ReferenceNamePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        {
          provide: ReferenceDataService,
          useValue: {
            cropName: (id: number) => (id === 1 ? 'Wheat' : ''),
            activityTypeName: (id: number) => (id === 2 ? 'Irrigation' : ''),
            expenseCategoryName: (id: number) => (id === 3 ? 'Seeds' : ''),
          },
        },
      ],
    });
    pipe = TestBed.runInInjectionContext(() => new ReferenceNamePipe());
  });

  it('resolves an id through the matching reference table', () => {
    expect(pipe.transform(1, 'crop')).toBe('Wheat');
    expect(pipe.transform(2, 'activity')).toBe('Irrigation');
    expect(pipe.transform(3, 'expense')).toBe('Seeds');
  });

  it('renders nothing for an unknown id or a category without an id table', () => {
    expect(pipe.transform(99, 'crop')).toBe('');
    expect(pipe.transform(1, 'stage')).toBe('');
  });

  it('still accepts a plain name', () => {
    expect(pipe.transform('Wheat', 'crop')).toBe('Wheat');
  });
});
