import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideTranslateService()],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      notFound: {
        title: "This page isn't here",
        text: 'The link may be old or mistyped.',
        backToHome: 'Go to Home',
      },
    });
    translate.use('en');
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says the page is not here, with a line on why', () => {
    const el = render();

    expect(el.querySelector('h1')!.textContent).toContain("This page isn't here");
    expect(el.textContent).toContain('The link may be old or mistyped.');
  });

  it('has one way back: a link to Home', () => {
    const el = render();
    const link = el.querySelector<HTMLAnchorElement>('a.btn-primary')!;

    expect(link.textContent).toContain('Go to Home');
    expect(link.getAttribute('href')).toBe('/');
    expect(el.querySelectorAll('a').length).toBe(1);
  });

  it('opens Home when the link is followed', async () => {
    const el = render();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    el.querySelector<HTMLAnchorElement>('a.btn-primary')!.click();

    expect(router.navigateByUrl).toHaveBeenCalled();
    expect((router.navigateByUrl as jasmine.Spy).calls.mostRecent().args[0].toString()).toBe('/');
  });

  it('uses the shared empty card and drops the old wording', () => {
    const el = render();

    expect(el.querySelector('.empty-state')).not.toBeNull();
    expect(el.textContent).not.toContain("This field doesn't exist");
    expect(el.textContent).not.toContain('Back to dashboard');
  });
});
