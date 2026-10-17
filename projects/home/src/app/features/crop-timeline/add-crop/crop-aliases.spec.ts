import { ALIASED_CROP_SLUGS, cropAliases } from './crop-aliases';

describe('cropAliases', () => {
  it('gives the other names farmers use, found by the English name in any case', () => {
    expect(cropAliases('Onion')).toContain('kanda');
    expect(cropAliases('onion')).toContain('pyaz');
    expect(cropAliases('Sesame')).toContain('til');
    expect(cropAliases('Green chilli')).toContain('hirvi mirchi');
    expect(cropAliases('Sweet lime')).toContain('mosambi');
  });

  it('includes the Marathi and the Hindi names', () => {
    expect(cropAliases('Onion')).toEqual(jasmine.arrayContaining(['कांदा', 'प्याज']));
    expect(cropAliases('Tur')).toEqual(jasmine.arrayContaining(['तूर', 'अरहर']));
  });

  it('has nothing for a crop it does not know', () => {
    expect(cropAliases('Dragon fruit')).toEqual([]);
  });

  it('covers every predefined crop of the list', () => {
    const predefined = [
      'wheat',
      'rice',
      'maize',
      'jowar',
      'bajra',
      'tur',
      'gram',
      'moong',
      'urad',
      'soybean',
      'groundnut',
      'sunflower',
      'mustard',
      'sesame',
      'cotton',
      'sugarcane',
      'turmeric',
      'onion',
      'tomato',
      'potato',
      'brinjal',
      'cabbage',
      'cauliflower',
      'okra',
      'green_chilli',
      'garlic',
      'ginger',
      'capsicum',
      'grapes',
      'pomegranate',
      'banana',
      'mango',
      'orange',
      'sweet_lime',
      'papaya',
      'guava',
      'watermelon',
      'vegetables',
      'fruits',
    ];
    expect(predefined.filter((slug) => !ALIASED_CROP_SLUGS.includes(slug))).toEqual([]);
    expect(ALIASED_CROP_SLUGS.filter((slug) => !predefined.includes(slug))).toEqual([]);
  });

  it('never repeats one word for two different crops', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const slug of ALIASED_CROP_SLUGS) {
      for (const word of cropAliases(slug.replace(/_/g, ' '))) {
        const owner = seen.get(word.toLowerCase());
        if (owner && owner !== slug) clashes.push(`${word}: ${owner}/${slug}`);
        seen.set(word.toLowerCase(), slug);
      }
    }
    expect(clashes).toEqual([]);
  });
});
