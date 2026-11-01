import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { Banner, BannerKind } from '../../core/banners/banner.model';
import { BannerCard } from './banner';

describe('BannerCard', () => {
  let fixture: ComponentFixture<BannerCard>;
  const el = () => fixture.nativeElement as HTMLElement;
  const card = () => el().querySelector<HTMLElement>('[data-testid="banner"]')!;

  function render(kind: BannerKind, extra: Partial<Banner> = {}) {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(BannerCard);
    fixture.componentRef.setInput('banner', {
      id: 'x',
      kind,
      titleKey: 'x.title',
      textKey: 'x.text',
      screens: ['*'],
      ...extra,
    } satisfies Banner);
    fixture.detectChanges();
  }

  it('a problem has a rose border, an alert role, its label and no dismiss button', () => {
    render('problem');

    expect(card().classList).toContain('border-danger');
    expect(card().getAttribute('role')).toBe('alert');
    expect(el().textContent).toContain('banners.kind.problem');
    expect(el().querySelector('[data-testid="banner-dismiss"]')).toBeNull();
  });

  it('a custom label replaces the kind label', () => {
    render('problem', { labelKey: 'states.offline.label' });

    expect(el().textContent).toContain('states.offline.label');
    expect(el().textContent).not.toContain('banners.kind.problem');
  });

  for (const kind of ['warning', 'update', 'new'] as const) {
    it(`${kind} has the normal border, a status role and a dismiss button`, () => {
      render(kind);

      expect(card().classList).not.toContain('border-danger');
      expect(card().getAttribute('role')).toBe('status');
      expect(el().textContent).toContain(`banners.kind.${kind}`);
      expect(el().querySelector('[data-testid="banner-dismiss"]')).not.toBeNull();
    });
  }

  it('the dismiss button names the banner and emits on click', () => {
    render('update');
    let dismissed = 0;
    fixture.componentInstance.dismiss.subscribe(() => dismissed++);

    const button = el().querySelector<HTMLButtonElement>('[data-testid="banner-dismiss"]')!;
    button.click();

    expect(button.getAttribute('aria-label')).toContain('banners.dismiss');
    expect(button.tagName).toBe('BUTTON');
    expect(dismissed).toBe(1);
  });

  it('shows the action and runs it on click', () => {
    let ran = 0;
    render('update', { action: { labelKey: 'x.go', run: () => ran++ } });

    const action = el().querySelector<HTMLButtonElement>('[data-testid="banner-action"]')!;
    action.click();

    expect(action.textContent).toContain('x.go');
    expect(ran).toBe(1);
  });
});
