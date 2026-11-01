import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { LoadErrorComponent } from './load-error.component';
import { PageLoadingComponent } from './page-loading.component';

function create<T>(component: new () => T) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection(), provideTranslateService()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, instance: fixture.componentInstance };
}

describe('PageLoadingComponent', () => {
  it('shows a spinner, "Loading…" and one line', () => {
    const { el } = create(PageLoadingComponent);

    expect(el.querySelector('.spinner-border')).not.toBeNull();
    expect(el.textContent).toContain('states.loading.title');
    expect(el.textContent).toContain('states.loading.text');
  });

  it('is announced as a status', () => {
    const { el } = create(PageLoadingComponent);

    const region = el.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
  });
});

describe('LoadErrorComponent', () => {
  it('shows the title, the line and a Try again button', () => {
    const { el } = create(LoadErrorComponent);

    expect(el.textContent).toContain('states.error.title');
    expect(el.textContent).toContain('states.error.text');
    expect(el.querySelector('button')!.textContent).toContain('states.error.retry');
  });

  it('is announced as an alert', () => {
    const { el } = create(LoadErrorComponent);

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('asks to retry when the button is pressed', () => {
    const { el, instance } = create(LoadErrorComponent);
    let retries = 0;
    instance.retry.subscribe(() => retries++);

    el.querySelector('button')!.click();

    expect(retries).toBe(1);
  });

  it('uses a real, focusable button so the keyboard works without extra code', () => {
    const { el } = create(LoadErrorComponent);
    const button = el.querySelector('button')!;

    // A native button is reached with Tab and turns Enter or Space into a click.
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.tabIndex).toBe(0);
    expect(button.disabled).toBeFalse();
  });
});
