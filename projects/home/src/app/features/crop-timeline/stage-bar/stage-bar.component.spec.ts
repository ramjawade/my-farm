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
    expect(el.querySelectorAll('.rounded-pill').length).toBe(4);
    expect(el.querySelectorAll('.small span').length).toBe(4);
  });

  it('marks the steps up to the current one', () => {
    const marks = Array.from(render('Fruiting / Pod Formation').querySelectorAll('.rounded-pill'));
    expect(marks.map((m) => m.classList.contains('bg-success'))).toEqual([true, true, true, false]);
  });

  it('highlights only the current step label', () => {
    const labels = Array.from(render('Vegetative Growth').querySelectorAll('.small span'));
    expect(labels.map((l) => l.classList.contains('fw-bold'))).toEqual([false, true, false, false]);
  });

  it('names the step for assistive technology', () => {
    const label = render('Harvest').querySelector('[role="img"]')?.getAttribute('aria-label');
    expect(label).toContain('cropStages.ariaLabel');
  });
});
