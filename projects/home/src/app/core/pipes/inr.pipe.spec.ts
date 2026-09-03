import { InrPipe } from './inr.pipe';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('uses Indian digit grouping', () => {
    expect(pipe.transform(123450)).toBe('₹1,23,450');
    expect(pipe.transform(950)).toBe('₹950');
  });

  it('handles empty values', () => {
    expect(pipe.transform(null)).toBe('₹0');
    expect(pipe.transform(undefined)).toBe('₹0');
  });
});
