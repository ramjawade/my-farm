import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { BrandLogoComponent } from './brand-logo.component';

describe('BrandLogoComponent', () => {
  let fixture: ComponentFixture<BrandLogoComponent>;

  function render(inputs: Record<string, unknown>): HTMLImageElement {
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('img') as HTMLImageElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(BrandLogoComponent);
  });

  it('shows the full emblem at 48 px and above', () => {
    const img = render({ size: 48 });
    expect(img.getAttribute('src')).toContain('brand/logo-96.webp');
    expect(fixture.nativeElement.querySelector('.brand-logo__backing')).toBeTruthy();
  });

  it('shows the simplified mark below 48 px, without the backing', () => {
    const img = render({ size: 32 });
    expect(img.getAttribute('src')).toBe('brand/mark.svg');
    expect(fixture.nativeElement.querySelector('.brand-logo__backing')).toBeNull();
  });

  it('picks a larger emblem file for larger sizes', () => {
    expect(render({ size: 96 }).getAttribute('src')).toContain('brand/logo-192.webp');
    expect(render({ size: 160 }).getAttribute('src')).toContain('brand/logo-512.webp');
  });

  it('reserves its final size so nothing shifts when the image loads', () => {
    const img = render({ size: 96 });
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
    expect((fixture.nativeElement as HTMLElement).style.width).toBe('96px');
  });

  it('is hidden from screen readers when decorative (the default)', () => {
    const img = render({ size: 32 });
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('has the text alternative "MyFarm" when it stands alone', () => {
    const emblem = render({ size: 96, decorative: false });
    expect(emblem.getAttribute('alt')).toBe('MyFarm');
    expect(emblem.hasAttribute('aria-hidden')).toBeFalse();

    const mark = render({ size: 24, decorative: false });
    expect(mark.getAttribute('alt')).toBe('MyFarm');
  });
});
