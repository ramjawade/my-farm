import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LandOutlineComponent } from './land-outline.component';

describe('LandOutlineComponent', () => {
  function render(points: { lat: number; lng: number }[]): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(LandOutlineComponent);
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the boundary as a closed path inside the 40px box', () => {
    const el = render([
      { lat: 20, lng: 73 },
      { lat: 20, lng: 73.001 },
      { lat: 20.001, lng: 73.001 },
      { lat: 20.001, lng: 73 },
    ]);
    const d = el.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.startsWith('M')).toBeTrue();
    expect(d.endsWith('Z')).toBeTrue();
    const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(numbers.length).toBe(8);
    expect(numbers.every((n) => n >= 0 && n <= 40)).toBeTrue();
  });

  it('shows a placeholder when there are fewer than 3 points', () => {
    const el = render([{ lat: 20, lng: 73 }]);
    expect(el.querySelector('path')).toBeNull();
    expect(el.querySelector('rect')).not.toBeNull();
  });

  it('is hidden from assistive technology', () => {
    expect(render([]).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
