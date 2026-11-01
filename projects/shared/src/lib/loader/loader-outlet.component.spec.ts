import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LoaderOutletComponent } from './loader-outlet.component';
import { LoaderService } from './loader.service';

describe('LoaderOutletComponent', () => {
  function create() {
    TestBed.configureTestingModule({
      imports: [LoaderOutletComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(LoaderOutletComponent);
    fixture.detectChanges();
    return {
      fixture,
      loader: TestBed.inject(LoaderService),
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows nothing while no request is running', () => {
    const { el } = create();

    expect(el.querySelector('.lib-loader-backdrop')).toBeNull();
  });

  it('shows while a request runs and hides when it finishes', () => {
    const { fixture, loader, el } = create();

    const id = loader.show();
    fixture.detectChanges();
    expect(el.querySelector('.lib-loader-backdrop')).not.toBeNull();

    loader.hide(id);
    fixture.detectChanges();
    expect(el.querySelector('.lib-loader-backdrop')).toBeNull();
  });

  it('says "Loading..." unless it is given other text', () => {
    const { fixture, loader, el } = create();
    loader.show();
    fixture.detectChanges();

    expect(el.querySelector('.lib-loader-text')!.textContent).toContain('Loading...');
  });

  it('shows and announces the text it is given', () => {
    const { fixture, loader, el } = create();
    fixture.componentRef.setInput('label', 'लोड होत आहे…');
    loader.show();
    fixture.detectChanges();

    expect(el.querySelector('.lib-loader-text')!.textContent).toContain('लोड होत आहे…');
    expect(el.querySelector('[role="status"]')!.getAttribute('aria-label')).toBe('लोड होत आहे…');
  });
});
