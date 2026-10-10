import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { StageBarComponent } from './stage-bar.component';

describe('StageBarComponent', () => {
  function render(stage: string): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
    const fixture = TestBed.createComponent(StageBarComponent);
    fixture.componentRef.setInput('stage', stage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws four marks and four labels', () => {
    const el = render('Sowing');
    expect(el.querySelectorAll('.flex-fill').length).toBe(4);
    expect(el.querySelectorAll('.justify-content-between span').length).toBe(4);
  });

  it('marks the steps up to the current one', () => {
    const marks = Array.from(render('Fruiting / Pod Formation').querySelectorAll('.flex-fill'));
    expect(marks.map((m) => m.classList.contains('step-on'))).toEqual([true, true, false, false]);
    expect(marks.map((m) => m.classList.contains('step-now'))).toEqual([false, false, true, false]);
  });

  it('highlights only the current step label', () => {
    const labels = Array.from(
      render('Vegetative Growth').querySelectorAll('.justify-content-between span'),
    );
    expect(labels.map((l) => l.classList.contains('fw-semibold'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it('names the step for assistive technology', () => {
    const label = render('Harvest').querySelector('[role="img"]')?.getAttribute('aria-label');
    expect(label).toContain('cropStages.ariaLabel');
  });
});
