import { cssColor, cssColorAlpha } from './css-token';

describe('css-token', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = ':root { --test-base: #2f7a3f; --test-alias: var(--test-base); }';
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('resolves a token to an rgb colour', () => {
    expect(cssColor('--test-base')).toBe('rgb(47, 122, 63)');
  });

  it('resolves a token defined through another token', () => {
    expect(cssColor('--test-alias')).toBe('rgb(47, 122, 63)');
  });

  it('adds alpha to a resolved token', () => {
    expect(cssColorAlpha('--test-base', 0.25)).toBe('rgba(47, 122, 63, 0.25)');
  });
});
