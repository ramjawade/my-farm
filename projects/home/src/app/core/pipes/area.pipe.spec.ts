import { AreaPipe, convertArea, toSquareMeters } from './area.pipe';

describe('AreaPipe', () => {
  const pipe = new AreaPipe();

  it('converts hectares to acres', () => {
    expect(convertArea(1, 'hectares', 'acres')).toBeCloseTo(2.4711, 3);
    expect(convertArea(2, 'acres', 'hectares')).toBeCloseTo(0.8094, 3);
  });

  it('is identity for the same unit', () => {
    expect(convertArea(3.3, 'acres', 'acres')).toBe(3.3);
    expect(toSquareMeters(1, 'hectares')).toBe(10_000);
  });

  it('formats with unit suffix', () => {
    expect(pipe.transform(2.5, 'hectares')).toBe('2.5 ha');
    expect(pipe.transform(1, 'hectares', 'acres')).toBe('2.47 ac');
    expect(pipe.transform(null)).toBe('—');
  });
});
